export type FieldType = 'text' | 'number' | 'email' | 'password' | 'select' | 'date' | 'badge' | 'boolean' | 'textarea';

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  sourceTable?: string;
  sourceValue?: string;
  sourceLabel?: string;
  placeholder?: string;
  defaultValue?: any;
  // Layout properties
  colSpan?: number; // 1 to 12 (Tailwind grid)
  section?: string; // Group fields under a header
  // Logic properties
  hidden?: boolean;
  readOnly?: boolean;
  visibleWhen?: {
    field: string;
    operator: 'eq' | 'neq' | 'contains' | 'in';
    value: any;
  };
}

export interface TableColumn {
  key: string;
  label: string;
  type: FieldType;
  sortable?: boolean;
  filterable?: boolean;
  width?: string; // css width e.g. "150px"
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date_range';
  options?: string[];
  visible?: boolean;
}

export interface ScreenConfig {
  id: string;
  title: string;
  table_name: string;
  icon?: string;
  columns: TableColumn[];
  fields: FormField[];
  filters?: FilterConfig[];
  actions?: ('add' | 'edit' | 'delete' | 'export' | 'import' | 'print' | 'view')[];
  // New configuration flags
  show_on_sidebar?: boolean;
  show_filter_date?: boolean;
  show_filter_status?: boolean;
  show_action_add?: boolean;
  show_action_edit?: boolean;
  show_action_view?: boolean;
  show_action_delete?: boolean;
  show_action_export?: boolean;
  show_action_print?: boolean;
  show_search?: boolean;
  date_filter_column?: string;
  sql_schema?: string;
  // Dynamic module custom components
  custom_filter_component?: string;
  custom_actions_component?: string;
  custom_components?: Record<string, string>;
}

export interface ModuleConfig {
  id: string;
  title: string;
  icon: string;
  screens: ScreenConfig[];
}
