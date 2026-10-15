import assert from 'node:assert/strict';

// Optional integration check: provide Playwright via ERP_PLAYWRIGHT_MODULE; no live Supabase access.
const { chromium } = await import(process.env.ERP_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const requests = [];
const errors = [];
let denyDetail = false;
const records = [{ id: 'demo-record', name: 'Dữ liệu thử nghiệm', created_at: new Date().toISOString() }];
const config = {
  id: 'employees', module_id: 'hrm', title: 'Nhân sự thử nghiệm', table_name: 'employees', icon: 'Users',
  columns: [{ key: 'name', label: 'Tên', type: 'text' }],
  fields: [{ name: 'name', label: 'Tên', type: 'text', required: true }],
  show_search: true, show_on_sidebar: true, show_filter_date: false, show_filter_status: false,
};
const second = { ...config, id: 'demo-screen', title: 'Màn hình thứ hai', table_name: 'demo_table' };
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem('demo_admin_session', 'true');
  localStorage.setItem('MODULE_CONFIG_SOURCE', 'supabase');
});
await page.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/_')) return route.continue();
  if (!url.pathname.startsWith('/rest/v1/')) return route.abort();
  const table = url.pathname.split('/').at(-1);
  const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
  const select = url.searchParams.get('select');
  requests.push({ table, id, select, method: request.method() });
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 200 });
  if (denyDetail && table === 'app_functions' && id === 'employees' && request.method() === 'GET') {
    return route.fulfill({ status: 403, json: { code: '42501', message: 'fixture denied' } });
  }
  if (table === 'app_functions' && request.method() === 'PATCH') {
    Object.assign(config, request.postDataJSON());
    return route.fulfill({ status: 204 });
  }
  if (table === 'employees' && request.method() === 'POST') {
    const value = request.postDataJSON();
    records.push({ id: `new-${records.length}`, ...(Array.isArray(value) ? value[0] : value), created_at: new Date().toISOString() });
    return route.fulfill({ status: 201, json: [] });
  }
  let data = table === 'app_functions' ? [config, second].filter(row => !id || row.id === id) : records;
  if (table === 'app_functions' && select === 'id,module_id,title,icon,show_on_sidebar') {
    data = data.map(({ id, module_id, title, icon, show_on_sidebar }) => ({ id, module_id, title, icon, show_on_sidebar }));
  }
  return route.fulfill({ status: 200, json: data, headers: {
    'Content-Range': `0-${Math.max(data.length - 1, 0)}/${data.length}`,
    'Access-Control-Allow-Origin': '*',
  } });
});

const details = () => requests.filter(request => request.table === 'app_functions' && request.id === 'employees' && request.method === 'GET').length;
const waitFor = async predicate => {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for fixture state');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};

try {
  await page.goto(process.env.ERP_TEST_URL || 'http://127.0.0.1:3101/screen/hrm/employees');
  await page.getByRole('link', { name: 'Nhân sự thử nghiệm', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Thêm', exact: true }).waitFor();
  const firstLoadDetails = details();
  await page.getByRole('link', { name: 'Màn hình thứ hai', exact: true }).click();
  await page.waitForURL('**/screen/hrm/demo-screen');
  await page.getByRole('button', { name: 'Thêm', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Nhân sự thử nghiệm', exact: true }).click();
  await page.waitForURL('**/screen/hrm/employees');
  await page.getByRole('button', { name: 'Thêm', exact: true }).waitFor();
  assert.equal(details(), firstLoadDetails, 'warm route must reuse detail cache');

  await page.getByPlaceholder('Tìm kiếm . . .').fill('giữ trạng thái');
  await page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByPlaceholder('Nhập Tên').fill('Nhân sự mới');
  await page.getByRole('button', { name: 'Thêm mới', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.getByPlaceholder('Tìm kiếm . . .').inputValue(), 'giữ trạng thái');
  assert.equal(details(), firstLoadDetails, 'business save must not reload config');
  assert.equal(records.length, 2);

  const metadataBefore = requests.filter(request => request.table === 'app_functions' && !request.id).length;
  await page.getByRole('button', { name: 'Cấu hình bộ lọc màn hình', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Cấu hình bộ lọc (JSON) *', exact: true })
    .fill('[{"key":"name","label":"Bộ lọc mới","type":"text"}]');
  await page.getByRole('dialog').getByRole('button', { name: 'Cập nhật', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByPlaceholder('Bộ lọc mới').waitFor();
  await waitFor(() => requests.filter(request => request.table === 'app_functions' && !request.id).length > metadataBefore);
  assert.equal(details(), firstLoadDetails + 1, 'config mutation must refetch affected detail once');
  assert.equal(await page.getByPlaceholder('Tìm kiếm . . .').inputValue(), 'giữ trạng thái');
  denyDetail = true;
  await page.reload();
  await page.getByText('Không có quyền tải cấu hình màn hình.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Thêm', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  const jsonPage = await browser.newPage();
  let jsonConfigRequests = 0;
  jsonPage.on('pageerror', error => errors.push(error.message));
  await jsonPage.addInitScript(() => {
    localStorage.setItem('demo_admin_session', 'true');
    localStorage.removeItem('MODULE_CONFIG_SOURCE');
  });
  await jsonPage.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/_')) return route.continue();
    if (url.pathname === '/rest/v1/app_functions') jsonConfigRequests++;
    if (url.pathname.startsWith('/rest/v1/')) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return route.fulfill({ status: 200, json: [], headers: { 'Content-Range': '*/0' } });
    }
    return route.abort();
  });
  const jsonStart = Date.now();
  await jsonPage.goto((process.env.ERP_TEST_URL || 'http://127.0.0.1:3101/screen/hrm/employees'));
  await jsonPage.getByRole('link', { name: 'Nhân sự', exact: true }).waitFor();
  await jsonPage.getByRole('button', { name: 'Thêm', exact: true }).waitFor();
  const jsonReadyMs = Date.now() - jsonStart;
  await jsonPage.getByRole('link', { name: 'Bộ phận', exact: true }).click();
  await jsonPage.waitForURL('**/screen/hrm/departments');
  await jsonPage.getByRole('button', { name: 'Thêm', exact: true }).waitFor();
  assert.equal(jsonConfigRequests, 0, 'JSON menu and screen must not request app_functions');
  const body = await jsonPage.locator('body').innerText();
  assert.equal(body.includes('Không cập nhật được cấu hình'), false);
  assert.equal(body.includes('Không cập nhật được menu'), false);
  assert.equal(body.includes('Đang tải cấu hình'), false);
  assert.deepEqual(errors, []);
  await jsonPage.close();
  console.log(JSON.stringify({ result: 'PASS', warmCacheExtraRequests: 0, businessSaveConfigRequests: 0,
    configMutationDetailRequests: 1, searchStatePreserved: true, metadataRefreshed: true,
    deniedConfigBlocksStaticFallback: true,
    jsonDefaultConfigRequests: jsonConfigRequests, jsonConfigReadyMs: jsonReadyMs,
    jsonNoConfigWarnings: true,
    pageErrors: errors, network: 'Supabase fixtures only; external requests blocked' }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ pageErrors: errors, pageText: (await page.locator('body').innerText()).slice(0, 1200), requests }, null, 2));
  throw error;
} finally { await browser.close(); }
