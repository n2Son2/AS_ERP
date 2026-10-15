import type { ModuleConfig, ScreenConfig } from '../../dynamic';

export interface NavigationScreen {
  id: string;
  module_id: string;
  title: string;
  icon?: string;
  show_on_sidebar: boolean;
}

const booleanValue = (value: unknown, fallback = true) =>
  value == null ? fallback : value === true || value === 'true';

function arrayValue<T>(value: unknown, name: string, required: boolean): T[] | undefined {
  if (value == null && !required) return undefined;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error(`Cấu hình ${name} phải là mảng.`);
  return parsed as T[];
}

export function normalizeScreenConfig(row: Record<string, any>): ScreenConfig {
  const tableName = row.table_name ?? row.tableName;
  if (typeof row.id !== 'string' || !row.id || typeof row.title !== 'string' ||
      typeof tableName !== 'string' || !tableName) {
    throw new Error('Cấu hình thiếu id, title hoặc table_name.');
  }
  const columns = arrayValue<ScreenConfig['columns'][number]>(row.columns, 'columns', true)!;
  const fields = arrayValue<ScreenConfig['fields'][number]>(row.fields, 'fields', true)!;
  if (columns.some(column => !column || typeof column.key !== 'string') ||
      fields.some(field => !field || typeof field.name !== 'string')) {
    throw new Error('Cấu hình cột hoặc trường không hợp lệ.');
  }
  const filters = arrayValue<NonNullable<ScreenConfig['filters']>[number]>(row.filters, 'filters', false);
  const actions = arrayValue<NonNullable<ScreenConfig['actions']>[number]>(row.actions, 'actions', false);
  if (filters?.some(filter => !filter || typeof filter.key !== 'string' || typeof filter.type !== 'string') ||
      actions?.some(action => typeof action !== 'string')) {
    throw new Error('Cấu hình filter hoặc action không hợp lệ.');
  }
  const flags = ['show_on_sidebar', 'show_search', 'show_filter_date', 'show_filter_status',
    'show_action_add', 'show_action_view', 'show_action_edit', 'show_action_delete',
    'show_action_export', 'show_action_print'] as const;
  const normalizedFlags = Object.fromEntries(flags.map(name => {
    const camelName = name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return [name, booleanValue(row[name] ?? row[camelName])];
  }));
  return {
    id: row.id, title: row.title, table_name: tableName, icon: row.icon,
    columns, fields, ...normalizedFlags,
    filters, actions,
    date_filter_column: row.date_filter_column ?? row.dateFilterColumn ?? 'created_at',
    sql_schema: row.sql_schema,
  };
}

export function normalizeNavigation(row: Record<string, any>): NavigationScreen {
  if (typeof row.id !== 'string' || typeof row.title !== 'string') {
    throw new Error('Cấu hình menu thiếu id hoặc title.');
  }
  return {
    id: row.id, title: row.title, module_id: row.module_id || 'system', icon: row.icon,
    show_on_sidebar: booleanValue(row.show_on_sidebar),
  };
}

export function mergeNavigation(modules: ModuleConfig[], rows: NavigationScreen[]) {
  return modules.map(module => {
    const screens = new Map<string, NavigationScreen>(module.screens
      .filter(screen => !rows.some(row => row.id === screen.id && row.module_id !== module.id))
      .map(screen => [screen.id, {
      id: screen.id, title: screen.title, icon: screen.icon, module_id: module.id,
      show_on_sidebar: screen.show_on_sidebar !== false,
    }]));
    rows.filter(row => row.module_id === module.id).forEach(row => screens.set(row.id, row));
    return { ...module, screens: [...screens.values()].filter(screen => screen.show_on_sidebar) };
  }).filter(module => module.screens.length > 0);
}

export function findStaticScreen(modules: ModuleConfig[], moduleId: string, screenId: string) {
  return modules.find(module => module.id === moduleId)?.screens.find(screen => screen.id === screenId);
}
