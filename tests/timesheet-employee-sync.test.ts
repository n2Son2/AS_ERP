import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmployeeSyncPlan } from '../src/modules/hrm/timesheetEmployeeSync.ts';

test('tạo nhân sự duy nhất từ nhiều dòng chấm công và giữ mã có số 0 đầu', () => {
  const plan = buildEmployeeSyncPlan([
    { employee_code: '00001', employee_name: '---', department: '-' },
    { employee_code: '00001', employee_name: 'Hà Thị Kim Thanh', department: 'Văn phòng' },
  ], [], '2026-10-15T00:00:00.000Z');

  assert.equal(plan.sourceCount, 1);
  assert.equal(plan.newCount, 1);
  assert.deepEqual(plan.rows[0], {
    id: 'emp_00001',
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
