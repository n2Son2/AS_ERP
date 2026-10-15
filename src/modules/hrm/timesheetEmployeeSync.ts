import { cleanDepartment } from '@/lib/timesheetParser';

export interface TimesheetEmployeeSource {
  employee_code?: unknown;
  employee_name?: unknown;
  department?: unknown;
}

export interface ExistingEmployee {
  id: string;
  code: string;
  name?: string | null;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  join_date?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export interface EmployeeSyncPlan {
  rows: ExistingEmployee[];
  sourceCount: number;
  newCount: number;
  updatedCount: number;
}

const normalizeCode = (value: unknown) => String(value || '').trim().toUpperCase();

export const createEmployeeId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // Fallback cho browser cũ; vẫn tạo đúng định dạng UUID v4 để PostgreSQL chấp nhận.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const isMissingName = (value: unknown) => {
  const name = String(value || '').trim();
  return !name || name === '---' || name === 'Nhân viên';
};

const isMissingDepartment = (value: unknown) => {
  const department = String(value || '').trim();
  return !department || department === '-';
};

export function buildEmployeeSyncPlan(
  records: TimesheetEmployeeSource[],
  existingEmployees: ExistingEmployee[],
  createdAt = new Date().toISOString(),
  createId = createEmployeeId,
): EmployeeSyncPlan {
  const existingByCode = new Map(
    existingEmployees
      .map(employee => [normalizeCode(employee.code), employee] as const)
      .filter(([code]) => Boolean(code)),
  );
  const sourceByCode = new Map<string, { code: string; name: string; department: string }>();

  records.forEach(record => {
    const code = String(record.employee_code || '').trim();
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) return;

    const name = String(record.employee_name || '').trim();
    const department = cleanDepartment(record.department);
    const current = sourceByCode.get(normalizedCode);

    if (!current) {
      sourceByCode.set(normalizedCode, { code, name, department });
      return;
    }
    if (isMissingName(current.name) && !isMissingName(name)) current.name = name;
    if (isMissingDepartment(current.department) && !isMissingDepartment(department)) {
      current.department = department;
    }
  });

  const rows: ExistingEmployee[] = [];
  let newCount = 0;
  let updatedCount = 0;

  sourceByCode.forEach((source, normalizedCode) => {
    const existing = existingByCode.get(normalizedCode);
    if (!existing) {
      rows.push({
        id: createId(),
        code: source.code,
        name: isMissingName(source.name) ? `Nhân viên ${source.code}` : source.name,
        department: isMissingDepartment(source.department) ? 'Văn phòng' : source.department,
        position: 'Nhân viên',
        phone: null,
        email: null,
        join_date: null,
        status: 'Đang làm việc',
        created_at: createdAt,
      });
      newCount += 1;
      return;
    }

    const shouldUpdateName = isMissingName(existing.name) && !isMissingName(source.name);
    const shouldUpdateDepartment = isMissingDepartment(existing.department)
      && !isMissingDepartment(source.department);
    if (!shouldUpdateName && !shouldUpdateDepartment) return;

    rows.push({
      ...existing,
      name: shouldUpdateName ? source.name : existing.name,
      department: shouldUpdateDepartment ? source.department : existing.department,
    });
    updatedCount += 1;
  });

  return { rows, sourceCount: sourceByCode.size, newCount, updatedCount };
}
