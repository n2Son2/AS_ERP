import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmployeeSyncPlan } from '../src/modules/hrm/timesheetEmployeeSync.ts';

test('tạo nhân sự duy nhất từ nhiều dòng chấm công và giữ mã có số 0 đầu', () => {
  const plan = buildEmployeeSyncPlan([
    { employee_code: '00001', employee_name: '---', department: '-' },
    { employee_code: '00001', employee_name: 'Hà Thị Kim Thanh', department: 'Văn phòng' },
  ], [], '2026-10-15T00:00:00.000Z', () => '123e4567-e89b-42d3-a456-426614174000');

  assert.equal(plan.sourceCount, 1);
  assert.equal(plan.newCount, 1);
  assert.deepEqual(plan.rows[0], {
    id: '123e4567-e89b-42d3-a456-426614174000',
    code: '00001',
    name: 'Hà Thị Kim Thanh',
    department: 'Văn phòng',
    position: 'Nhân viên',
    phone: null,
    email: null,
    join_date: null,
    status: 'Đang làm việc',
    created_at: '2026-10-15T00:00:00.000Z',
  });
});

test('ID nhân sự mới mặc định là UUID hợp lệ thay vì mã emp_<code>', () => {
  const plan = buildEmployeeSyncPlan([
    { employee_code: '00001', employee_name: 'Hà Thị Kim Thanh', department: 'Văn phòng' },
  ], []);

  assert.match(
    plan.rows[0].id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(plan.rows[0].code, '00001');
});

test('chỉ bổ sung trường còn thiếu và không ghi đè dữ liệu nhân sự hiện có', () => {
  const plan = buildEmployeeSyncPlan([
    { employee_code: 'NV02', employee_name: 'Tên từ chấm công', department: 'Kỹ thuật' },
  ], [{
    id: 'employee-2',
    code: 'NV02',
    name: 'Tên chính thức',
    department: null,
    phone: '0900000000',
    email: 'nv02@example.com',
  }]);

  assert.equal(plan.newCount, 0);
  assert.equal(plan.updatedCount, 1);
  assert.equal(plan.rows[0].name, 'Tên chính thức');
  assert.equal(plan.rows[0].department, 'Kỹ thuật');
  assert.equal(plan.rows[0].phone, '0900000000');
  assert.equal(plan.rows[0].email, 'nv02@example.com');
});
