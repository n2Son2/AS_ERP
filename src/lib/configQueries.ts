import type { SupabaseClient } from '@supabase/supabase-js';
import { queryOptions } from '@tanstack/react-query';
import { configKeys } from './configCache';
import { normalizeNavigation, normalizeScreenConfig } from './screenConfig';

const CONFIG_TIMEOUT_MS = 10_000;
const DETAIL_COLUMNS = 'id,module_id,title,table_name,icon,columns,fields,filters,actions,show_on_sidebar,show_search,show_filter_date,show_filter_status,date_filter_column,show_action_add,show_action_view,show_action_edit,show_action_delete,show_action_export,show_action_print';
const cacheOptions = { staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: false as const };

export class ConfigLoadError extends Error {
  readonly code?: string;
  constructor(error: { message: string; code?: string }, readonly status: number) {
    super(error.message);
    this.name = 'ConfigLoadError';
    this.code = error.code;
  }
}

export function isConfigAccessDenied(error: unknown) {
  return error instanceof ConfigLoadError &&
    (error.status === 401 || error.status === 403 || error.code === '42501');
}

async function withConfigTimeout<T>(signal: AbortSignal, metric: string, load: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const start = performance.now();
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, CONFIG_TIMEOUT_MS);
  try { return await load(controller.signal); }
  finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    performance.measure(`erp:config:${metric}`, { start, end: performance.now() });
  }
}

export function navigationQueryOptions(scope: string, client: SupabaseClient) {
  return queryOptions({
    ...cacheOptions,
    queryKey: configKeys.navigation(scope),
    queryFn: async ({ signal }) => {
      const { data, error, status } = await withConfigTimeout(signal, 'navigation', requestSignal => client
        .from('app_functions').select('id,module_id,title,icon,show_on_sidebar').abortSignal(requestSignal));
      if (error) throw new ConfigLoadError(error, status);
      return (data ?? []).flatMap(row => {
        try { return [normalizeNavigation(row)]; }
        catch { console.warn('Bỏ qua cấu hình menu không hợp lệ:', row.id); return []; }
      });
    },
  });
}

export function screenQueryOptions(scope: string, screenId: string, client: SupabaseClient) {
  return queryOptions({
    ...cacheOptions,
    queryKey: configKeys.screen(scope, screenId),
    queryFn: async ({ signal }) => {
      const { data, error, status } = await withConfigTimeout(signal, 'detail', requestSignal => client
        .from('app_functions').select(DETAIL_COLUMNS).eq('id', screenId)
        .abortSignal(requestSignal).maybeSingle());
      if (error) throw new ConfigLoadError(error, status);
      return data ? { config: normalizeScreenConfig(data), moduleId: data.module_id || 'system' } : null;
    },
  });
}
