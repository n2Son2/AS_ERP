import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { configKeys, invalidateTableMutation } from '../src/lib/configCache';
import { isConfigAccessDenied, navigationQueryOptions, screenQueryOptions } from '../src/lib/configQueries';
import { findStaticScreen, mergeNavigation, normalizeNavigation, normalizeScreenConfig } from '../src/lib/screenConfig';
import type { ModuleConfig } from '../dynamic';
import { resolveModuleConfigSource } from '../src/lib/moduleConfigSource';

const row = {
  id: 'employees', module_id: 'hrm', title: 'Nhân sự DB', table_name: 'employees',
  columns: [{ key: 'name', label: 'Tên', type: 'text' }],
  fields: [{ name: 'name', label: 'Tên', type: 'text' }],
};
const modules: ModuleConfig[] = [{ id: 'hrm', title: 'HRM', icon: 'Users', screens: [normalizeScreenConfig(row)] }];

test('JSON is the default source; Supabase config is explicitly enabled', () => {
  assert.equal(resolveModuleConfigSource(null), 'json');
  assert.equal(resolveModuleConfigSource('unknown'), 'json');
  assert.equal(resolveModuleConfigSource('supabase'), 'supabase');
});

function fixture(options: { rows?: Record<string, any>[]; delay?: (id: string) => number; fail?: boolean } = {}) {
  const requests: { id: string; select: string; aborted: boolean }[] = [];
  const client = createClient('https://fixture.invalid', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
      const request = { id, select: url.searchParams.get('select') || '', aborted: false };
      requests.push(request);
      await new Promise<void>((resolve, reject) => {
        const signal = init?.signal;
        const abort = () => {
          request.aborted = true;
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, options.delay?.(id) ?? 0);
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
      });
      const rows = options.rows ?? [row];
      return new Response(JSON.stringify(options.fail ? { message: 'fixture denied', code: '42501' } :
        id ? rows.filter(record => record.id === id) : rows), {
        status: options.fail ? 403 : 200, headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  return { client, requests };
}

test('normalizer preserves false, camelCase and JSON arrays; rejects malformed detail', () => {
  const result = normalizeScreenConfig({ ...row, columns: JSON.stringify(row.columns),
    fields: JSON.stringify(row.fields), show_search: false, showActionEdit: 'false', filters: '[]' });
  assert.equal(result.show_search, false);
  assert.equal(result.show_action_edit, false);
  assert.deepEqual(result.columns, row.columns);
  assert.throws(() => normalizeScreenConfig({ ...row, fields: '{}' }), /phải là mảng/);
  assert.throws(() => normalizeScreenConfig({ ...row, columns: '[null]' }), /không hợp lệ/);
});

test('DB metadata overrides static navigation, hidden flags and fallback resolve consistently', () => {
  const hidden = normalizeNavigation({ ...row, show_on_sidebar: false });
  assert.deepEqual(mergeNavigation(modules, [hidden]), []);
  const renamed = normalizeNavigation({ ...row, title: 'Tên mới' });
  assert.equal(mergeNavigation(modules, [renamed])[0].screens[0].title, 'Tên mới');
  assert.equal(findStaticScreen(modules, 'hrm', 'employees')?.table_name, 'employees');
  assert.equal(findStaticScreen(modules, 'wrong', 'employees'), undefined);
});

test('detail requests deduplicate; warm cache and prefetch avoid additional HTTP; scopes are isolated', async () => {
  const { client, requests } = fixture({ delay: () => 15 });
  const cache = new QueryClient();
  try {
    const options = screenQueryOptions('connection:user1', 'employees', client);
    await Promise.all([cache.prefetchQuery(options), cache.fetchQuery(options)]);
    await cache.fetchQuery(options);
    assert.equal(requests.length, 1);
    await cache.fetchQuery(screenQueryOptions('connection:user2', 'employees', client));
    await cache.fetchQuery(screenQueryOptions('other-connection:user1', 'employees', client));
    assert.equal(requests.length, 3);
  } finally { cache.clear(); }
});

test('navigation projects metadata only, and a damaged detail does not break the menu', async () => {
  const { client, requests } = fixture({ rows: [{ ...row, columns: '{broken' }] });
  const cache = new QueryClient();
  try {
    const metadata = await cache.fetchQuery(navigationQueryOptions('scope', client));
    assert.equal(metadata.length, 1);
    assert.equal(requests[0].select, 'id,module_id,title,icon,show_on_sidebar');
    await assert.rejects(cache.fetchQuery(screenQueryOptions('scope', 'employees', client)));
  } finally { cache.clear(); }
});

test('missing record is cached as null; permission/network error remains an error', async () => {
  const cache = new QueryClient();
  const missing = fixture({ rows: [] });
  const denied = fixture({ fail: true });
  try {
    assert.equal(await cache.fetchQuery(screenQueryOptions('scope', 'missing', missing.client)), null);
    await assert.rejects(cache.fetchQuery(screenQueryOptions('scope', 'denied', denied.client)));
    assert.equal(cache.getQueryState(configKeys.screen('scope', 'denied'))?.status, 'error');
    assert.equal(isConfigAccessDenied(cache.getQueryState(configKeys.screen('scope', 'denied'))?.error), true);
    assert.equal(denied.requests.length, 1, 'config failures do not trigger retry storms');
  } finally { cache.clear(); }
});

test('business mutations preserve config cache; config mutations invalidate navigation and only the edited detail', () => {
  const cache = new QueryClient();
  try {
    for (const key of [configKeys.navigation('scope'), configKeys.screen('scope', 'employees'),
      configKeys.screen('scope', 'roles'), ['table_data', 'employees'], ['select_options', 'employees']]) {
      cache.setQueryData(key, row);
    }
    invalidateTableMutation(cache, 'employees');
    assert.equal(cache.getQueryState(configKeys.screen('scope', 'employees'))?.isInvalidated, false);
    assert.equal(cache.getQueryState(['table_data', 'employees'])?.isInvalidated, true);
    assert.equal(cache.getQueryState(['select_options', 'employees'])?.isInvalidated, true);
    invalidateTableMutation(cache, 'app_functions', ['employees']);
    assert.equal(cache.getQueryState(configKeys.navigation('scope'))?.isInvalidated, true);
    assert.equal(cache.getQueryState(configKeys.screen('scope', 'employees'))?.isInvalidated, true);
    assert.equal(cache.getQueryState(configKeys.screen('scope', 'roles'))?.isInvalidated, false);
  } finally { cache.clear(); }
});

test('concurrent A/B completion stays in its own screen key; cancellation aborts the request', async () => {
  const { client, requests } = fixture({ rows: [row, { ...row, id: 'roles' }], delay: id => id === 'employees' ? 40 : 0 });
  const cache = new QueryClient();
  try {
    const a = cache.fetchQuery(screenQueryOptions('scope', 'employees', client));
    const b = cache.fetchQuery(screenQueryOptions('scope', 'roles', client));
    await Promise.all([a, b]);
    assert.equal(cache.getQueryData<any>(configKeys.screen('scope', 'roles')).config.id, 'roles');
    assert.equal(cache.getQueryData<any>(configKeys.screen('scope', 'employees')).config.id, 'employees');
    const cancelFixture = fixture({ delay: () => 200 });
    const canceled = cache.fetchQuery(screenQueryOptions('scope', 'cancel', cancelFixture.client));
    const rejected = assert.rejects(canceled);
    await new Promise(resolve => setTimeout(resolve, 5));
    await cache.cancelQueries({ queryKey: configKeys.screen('scope', 'cancel') });
    await rejected;
    assert.equal(cancelFixture.requests[0].aborted, true);
    assert.equal(cache.getQueryState(configKeys.screen('scope', 'cancel'))?.fetchStatus, 'idle');
    assert.equal(requests.length, 2);
  } finally { cache.clear(); }
});
