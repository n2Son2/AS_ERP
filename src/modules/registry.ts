import React from 'react';
import { TimesheetMonthPicker, TimesheetSyncActions } from './hrm';
import { RolePermissionSheet, ResetPasswordDialog } from './system';

/**
 * Registry ánh xạ tên component từ cấu hình JSON (ModuleConfig / ScreenConfig)
 * sang React Component thực tế tương ứng.
 */
export const MODULE_CUSTOM_COMPONENTS: Record<string, React.ComponentType<any>> = {
  TimesheetMonthPicker,
  TimesheetSyncActions,
  RolePermissionSheet,
  ResetPasswordDialog,
};

/**
 * Lấy custom component theo tên được chỉ định trong JSON cấu hình.
 * @param name Tên component, ví dụ "TimesheetMonthPicker", "TimesheetSyncActions"
 * @returns React Component hoặc null nếu không tìm thấy
 */
export function getModuleCustomComponent(name?: string): React.ComponentType<any> | null {
  if (!name || typeof name !== 'string') return null;
  return MODULE_CUSTOM_COMPONENTS[name] || null;
}

/**
 * Đăng ký bổ sung một dynamic component mới vào registry lúc runtime nếu cần.
 */
export function registerModuleCustomComponent(name: string, component: React.ComponentType<any>): void {
  MODULE_CUSTOM_COMPONENTS[name] = component;
}
