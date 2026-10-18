import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  FileDown, 
  Edit2, 
  Trash2, 
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  Printer,
  LayoutGrid,
  Eye,
  Copy,
  X,
  GripVertical,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Key,
  Upload,
  FileUp,
  Award,
  AlertCircle,
  FileText,
  Clock,
  Database,
  CloudUpload,
  ChevronDown,
  FileSpreadsheet,
  Users
} from 'lucide-react';
import { parseTimesheetFile, cleanDepartment, formatMinutes } from '@/lib/timesheetParser';
import { 
  exportTimesheetVouchersCombined, 
  exportTimesheetVouchersMultiSheet, 
  exportSingleEmployeeVoucher 
} from '@/lib/timesheetVoucherExporter';
import { ScreenConfig, TableColumn } from '../../dynamic';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

const getPreviousMonthStr = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

const getMonthRange = (monthStr: string) => {
  if (!monthStr || !monthStr.includes('-')) return { start: '', end: '' };
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${monthStr}-01`;
  const end = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CompactTableFilters,
  type CompactFilterDefinition,
  type CompactFilterValue,
} from './CompactTableFilters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import * as XLSX from 'xlsx-js-style';

const MONTH_FILTER_KEY = '__month';
const DATE_FILTER_KEY = '__date_range';

// DND Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DynamicTableProps {
  config: ScreenConfig;
  onEdit: (item: any) => void;
  onAdd: () => void;
  onView?: (item: any) => void;
  onConfigFilter?: (item: any) => void;
  onPermissionMatrix?: (item: any) => void;

}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc' | null;
}

// Sortable Item Component for Column Management
interface SortableColumnItemProps {
  column: TableColumn;
  isVisible: boolean;
  onToggle: (key: string) => void;
  key?: React.Key;
}

const SortableColumnItem = ({ 
  column, 
  isVisible, 
  onToggle 
}: SortableColumnItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-md group"
    >
      <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600">
        <GripVertical className="h-4 w-4" />
      </div>
      <Checkbox 
        id={`col-${column.key}`} 
        checked={isVisible} 
        onCheckedChange={() => onToggle(column.key)}
      />
      <label 
        htmlFor={`col-${column.key}`}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
      >
        {column.label}
      </label>
    </div>
  );
};

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateTableMutation } from '@/lib/configCache';
import { TimesheetSyncActions } from '@/modules/hrm';
import { createEmployeeId } from '@/modules/hrm/timesheetEmployeeSync';
import { ResetPasswordDialog } from '@/modules/system/system.users/index';
import { getModuleCustomComponent } from '@/modules/registry';

export const DynamicTable: React.FC<DynamicTableProps> = ({ 
  config, 
  onEdit, 
  onAdd, 
  onView, 
  onConfigFilter, 
  onPermissionMatrix
}) => {
  const queryClient = useQueryClient();
  const CustomFilterComponent = getModuleCustomComponent(config.custom_filter_component);
  const CustomActionsComponent = getModuleCustomComponent(config.custom_actions_component);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [pageSize, setPageSize] = useState(20);

  const isTimesheetTable = config.table_name === 'timesheets' || config.id === 'timesheets';

  // Filters state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (config.table_name === 'timesheets' || config.id === 'timesheets') {
      return getPreviousMonthStr();
    }
    return '';
  });
  // isSyncingSupabase, deleteMonthConfirmOpen, isDeletingMonth → moved to TimesheetSyncActions
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [enabledFilterKeys, setEnabledFilterKeys] = useState<string[]>(() =>
    isTimesheetTable && !CustomFilterComponent ? [MONTH_FILTER_KEY] : []
  );
  const [resetPasswordEmail, setResetPasswordEmail] = useState<string | null>(null);
  const [tsViewMode, setTsViewMode] = useState<'summary' | 'detail'>('summary');
  const [selectedEmpModal, setSelectedEmpModal] = useState<any | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Column management state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(config.columns.map(c => c.key));
  const [columnOrder, setColumnOrder] = useState<TableColumn[]>(config.columns);
  const columnSignature = JSON.stringify(config.columns);
  useEffect(() => {
    setVisibleColumns(config.columns.map(column => column.key));
    setColumnOrder(config.columns);
  }, [columnSignature]);

  // TanStack Query for data fetching
  const { 
    data: queryResult, 
    isLoading: loading, 
    refetch 
  } = useQuery({
    queryKey: ['table_data', config.table_name, searchTerm, page, sortConfig, dynamicFilters, dateFrom, dateTo, selectedMonth,
      config.date_filter_column, config.show_filter_date, config.columns.map(column => column.key), config.filters],
    queryFn: async () => {
      let result: any[] = [];
      let totalCount = 0;
      let loadError: string | null = null;

      try {
        let query = supabase
          .from(config.table_name)
          .select('*', { count: 'exact' });

        // Apply search
        if (searchTerm) {
          query = query.ilike(config.columns[0].key, `%${searchTerm}%`);
        }
        
        // Apply dynamic filters
        const tableColumns = config.columns.map(c => c.key);
        
        Object.entries(dynamicFilters).forEach(([key, value]) => {
          if (value) {
            if (tableColumns.includes(key) || key === 'id' || key === 'created_at') {
              query = query.eq(key, value);
            }
          }
        });

        // Flexible Date & Month Filter
        const dateRangeFilters = config.filters?.filter(f => f.type === 'date_range') || [];
        const dateCol = config.date_filter_column || (isTimesheetTable ? 'work_date' : 'created_at');
        if (isTimesheetTable && selectedMonth) {
          const { start, end } = getMonthRange(selectedMonth);
          if (start && end) {
            query = query.gte(dateCol, start).lte(dateCol, end);
          }
        } else if (dateRangeFilters.length > 0) {
          dateRangeFilters.forEach(f => {
            if (dateFrom) query = query.gte(f.key, dateFrom);
            if (dateTo) query = query.lte(f.key, dateTo);
          });
        } else if (config.show_filter_date !== false) {
          if (dateFrom) query = query.gte(dateCol, dateFrom);
          if (dateTo) query = query.lte(dateCol, dateTo);
        }

        // Apply sorting
        if (sortConfig.key && sortConfig.direction) {
          query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
        } else {
          query = query.order(config.table_name === 'timesheets' ? 'work_date' : 'created_at', { ascending: false });
        }

        if (isTimesheetTable) {
          // Fetch all month records for timesheet summary and daily view without truncating at page limit
          const res = await query.limit(10000);
          if (res.error) throw res.error;
          if (!res.error && res.data) {
            result = res.data;
            totalCount = res.count || res.data.length;
          }
        } else {
          const res = await query.range((page - 1) * pageSize, page * pageSize - 1);
          if (res.error) throw res.error;
          if (!res.error && res.data) {
            result = res.data;
            totalCount = res.count || res.data.length;
          }
        }
      } catch (err) {
        loadError = typeof (err as { message?: unknown })?.message === 'string'
          ? (err as { message: string }).message
          : 'Không thể kết nối đến Supabase.';
      }

      // Merge local storage items (for offline/demo/instant uploaded timesheets)
      const localKey = `local_table_${config.table_name}`;
      const localRaw = localStorage.getItem(localKey);
      if (localRaw) {
        try {
          const localItems: any[] = JSON.parse(localRaw);
          const existingIds = new Set(result.map(i => i.id));
          let filteredLocal = localItems.filter(i => !existingIds.has(i.id));

          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredLocal = filteredLocal.filter(item => 
              Object.values(item).some(val => String(val || '').toLowerCase().includes(term))
            );
          }

          Object.entries(dynamicFilters).forEach(([key, value]) => {
            if (value) {
              filteredLocal = filteredLocal.filter(item => String(item[key]) === String(value));
            }
          });

          const dateCol = config.date_filter_column || (isTimesheetTable ? 'work_date' : 'created_at');
          if (isTimesheetTable && selectedMonth) {
            const { start, end } = getMonthRange(selectedMonth);
            if (start && end) {
              filteredLocal = filteredLocal.filter(item => {
                const wDate = item[dateCol] || item.work_date || '';
                return wDate >= start && wDate <= end;
              });
            }
          } else {
            if (dateFrom) {
              filteredLocal = filteredLocal.filter(item => (item[dateCol] || '') >= dateFrom);
            }
            if (dateTo) {
              filteredLocal = filteredLocal.filter(item => (item[dateCol] || '') <= dateTo);
            }
          }

          if (isTimesheetTable) {
            // Deduplicate across Supabase and LocalStorage by (normalized employee_code, work_date)
            const dedupeMap = new Map<string, any>();
            result.forEach(item => {
              const empCode = String(item.employee_code || '').trim().toUpperCase();
              const wDate = String(item.work_date || '').trim();
              if (empCode && wDate) {
                dedupeMap.set(`${empCode}_${wDate}`, item);
              } else if (item.id) {
                dedupeMap.set(item.id, item);
              }
            });
            filteredLocal.forEach(item => {
              const empCode = String(item.employee_code || '').trim().toUpperCase();
              const wDate = String(item.work_date || '').trim();
              if (empCode && wDate) {
                dedupeMap.set(`${empCode}_${wDate}`, item);
              } else if (item.id) {
                dedupeMap.set(item.id, item);
              }
            });
            result = Array.from(dedupeMap.values());
            totalCount = result.length;
          } else {
            result = [...result, ...filteredLocal];
            totalCount = result.length;
          }
        } catch (e) {}
      } else if (isTimesheetTable && result.length > 0) {
        // Deduplicate Supabase results alone by (normalized employee_code, work_date)
        const dedupeMap = new Map<string, any>();
        result.forEach(item => {
          const empCode = String(item.employee_code || '').trim().toUpperCase();
          const wDate = String(item.work_date || '').trim();
          if (empCode && wDate) {
            dedupeMap.set(`${empCode}_${wDate}`, item);
          } else if (item.id) {
            dedupeMap.set(item.id, item);
          }
        });
        result = Array.from(dedupeMap.values());
        totalCount = result.length;
      }

      // Default sort by Employee Code (Mã NV) unless sortConfig is specified
      if (sortConfig.key && sortConfig.direction) {
        result.sort((a, b) => {
          const valA = a[sortConfig.key];
          const valB = b[sortConfig.key];
          if (valA === valB) return 0;
          if (valA == null) return 1;
          if (valB == null) return -1;
          if (typeof valA === 'number' && typeof valB === 'number') {
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
          }
          const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        });
      } else {
        result.sort((a, b) => {
          const codeA = String(a.employee_code || a.code || '');
          const codeB = String(b.employee_code || b.code || '');
          const cmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
          if (cmp !== 0) return cmp;
          const dateA = String(a.work_date || a.created_at || '');
          const dateB = String(b.work_date || b.created_at || '');
          return dateA.localeCompare(dateB);
        });
      }

      return { items: result || [], totalCount: totalCount || 0, loadError };
    }
  });

  const rawData = queryResult?.items || [];
  const totalCount = queryResult?.totalCount || 0;

  // For detail mode pagination on timesheets, slice rawData
  const data = useMemo(() => {
    if (isTimesheetTable && tsViewMode === 'detail') {
      return rawData.slice((page - 1) * pageSize, page * pageSize);
    }
    return rawData;
  }, [rawData, isTimesheetTable, tsViewMode, page, pageSize]);

  const employeeSummaries = useMemo(() => {
    if (config.table_name !== 'timesheets' && config.id !== 'timesheets') return [];

    const map = new Map<string, {
      employee_code: string;
      employee_name: string;
      department: string;
      total_work_days: number;
      total_work_hours: number;
      total_overtime: number;
      late_count: number;
      late_minutes: number;
      early_count: number;
      early_minutes: number;
      absent_count: number;
      records: any[];
      seenDates: Set<string>;
    }>();

    rawData.forEach((row: any) => {
      const rawCode = String(row.employee_code || '').trim();
      const rawName = String(row.employee_name || '').trim();
      const key = (rawCode || rawName || 'NV').toUpperCase();

      let emp = map.get(key);
      if (!emp) {
        emp = {
          employee_code: rawCode || '---',
          employee_name: rawName || '---',
          department: cleanDepartment(row.department),
          total_work_days: 0,
          total_work_hours: 0,
          total_overtime: 0,
          late_count: 0,
          late_minutes: 0,
          early_count: 0,
          early_minutes: 0,
          absent_count: 0,
          records: [],
          seenDates: new Set()
        };
        map.set(key, emp);
      }

      const wDate = String(row.work_date || '').trim();
      if (wDate && emp.seenDates.has(wDate)) {
        return; // Avoid duplicate date aggregation for the same employee
      }
      if (wDate) {
        emp.seenDates.add(wDate);
      }

      if (rawName && (emp.employee_name === '---' || emp.employee_name === 'Nhân viên')) {
        emp.employee_name = rawName;
      }
      if (row.department && cleanDepartment(row.department) !== '-') {
        emp.department = cleanDepartment(row.department);
      }

      emp.records.push(row);
      emp.total_work_days += Number(row.work_day) || 0;
      emp.total_work_hours += Number(row.total_hours) || 0;
      emp.total_overtime += Number(row.overtime_1) || 0;

      const late = Number(row.late_minutes) || 0;
      const early = Number(row.early_minutes) || 0;

      if (late > 0) {
        emp.late_count += 1;
        emp.late_minutes += late;
      }
      if (early > 0) {
        emp.early_count += 1;
        emp.early_minutes += early;
      }
      if (row.status === 'Vắng mặt') {
        emp.absent_count += 1;
      }
    });

    const list = Array.from(map.values()).map(emp => ({
      ...emp,
      total_work_days: Number(emp.total_work_days.toFixed(2)),
      total_work_hours: Number(emp.total_work_hours.toFixed(2)),
      total_overtime: Number(emp.total_overtime.toFixed(2)),
    }));

    list.sort((a, b) => {
      if (sortConfig.key && sortConfig.direction) {
        const valA = a[sortConfig.key as keyof typeof a];
        const valB = b[sortConfig.key as keyof typeof b];
        if (valA != null && valB != null) {
          if (typeof valA === 'number' && typeof valB === 'number') {
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
          }
          const strA = String(valA);
          const strB = String(valB);
          const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        }
      }
      return String(a.employee_code || '').localeCompare(String(b.employee_code || ''), undefined, { numeric: true, sensitivity: 'base' });
    });

    return list;
  }, [rawData, config.table_name, config.id, sortConfig]);

  const activeTotalCount = useMemo(() => {
    if (isTimesheetTable && tsViewMode === 'summary') {
      return employeeSummaries.length;
    }
    return totalCount;
  }, [isTimesheetTable, tsViewMode, employeeSummaries.length, totalCount]);

  const paginatedEmployeeSummaries = useMemo(() => {
    if (isTimesheetTable && tsViewMode === 'summary') {
      return employeeSummaries.slice((page - 1) * pageSize, page * pageSize);
    }
    return employeeSummaries;
  }, [isTimesheetTable, tsViewMode, employeeSummaries, page, pageSize]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(data.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setDeleteConfirm({ open: true, ids: selectedIds });
  };

  const confirmDeleteAction = async () => {
    const idsToDelete = deleteConfirm.ids;
    const isBulk = idsToDelete.length > 1;
    setDeleteConfirm({ open: false, ids: [] });
    
    if (isBulk) setIsDeletingBulk(true);

    const promise = new Promise(async (resolve, reject) => {
      try {
        const { error } = await supabase
          .from(config.table_name)
          .delete()
          .in('id', idsToDelete);

        if (error) throw error;
        
        setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
        invalidateTableMutation(queryClient, config.table_name, idsToDelete);
        resolve(true);
      } catch (error) {
        reject(error);
      } finally {
        if (isBulk) setIsDeletingBulk(false);
      }
    });

    toast.promise(promise, {
      loading: isBulk ? 'Đang xóa các bản ghi đã chọn...' : 'Đang xóa bản ghi...',
      success: isBulk ? 'Đã xóa thành công các bản ghi' : 'Xóa bản ghi thành công',
      error: (err: any) => 'Lỗi khi xóa: ' + err.message,
    });
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, ids: [id] });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.findIndex((i) => i.key === active.id);
        const newIndex = items.findIndex((i) => i.key === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleExportVouchersCombined = () => {
    if (employeeSummaries.length === 0) {
      toast.error('Không có dữ liệu chấm công để xuất');
      return;
    }
    try {
      exportTimesheetVouchersCombined(employeeSummaries, selectedMonth);
      toast.success(`Đã xuất file Excel Dạng Phiếu Gốc (${employeeSummaries.length} nhân sự) thành công!`);
    } catch (error: any) {
      console.error('Export Vouchers Combined Error:', error);
      toast.error('Lỗi khi xuất file Excel dạng phiếu: ' + error.message);
    }
  };

  const handleExportVouchersMultiSheet = () => {
    if (employeeSummaries.length === 0) {
      toast.error('Không có dữ liệu chấm công để xuất');
      return;
    }
    try {
      exportTimesheetVouchersMultiSheet(employeeSummaries, selectedMonth);
      toast.success(`Đã xuất file Excel Dạng Phiếu Gốc (Mỗi NV 1 sheet) thành công!`);
    } catch (error: any) {
      console.error('Export Vouchers MultiSheet Error:', error);
      toast.error('Lỗi khi xuất file Excel: ' + error.message);
    }
  };

  const handleExportSingleEmployeeExcel = (emp: any) => {
    if (!emp || !emp.records || emp.records.length === 0) {
      toast.error('Không có dữ liệu chấm công của nhân sự này');
      return;
    }

    try {
      exportSingleEmployeeVoucher(emp, selectedMonth);
      toast.success(`Đã xuất phiếu chấm công Excel chuẩn cho ${emp.employee_name} thành công!`);
    } catch (error: any) {
      console.error('Export Single Employee Voucher Error:', error);
      toast.error('Lỗi khi xuất phiếu Excel: ' + error.message);
    }
  };

  const handleExportExcelDetailedPerEmployee = (includeSummarySheet: boolean = true) => {
    if (employeeSummaries.length === 0) {
      toast.error('Không có dữ liệu chấm công để xuất');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      if (includeSummarySheet) {
        const summaryHeaders = [
          'MÃ NV',
          'HỌ VÀ TÊN',
          'BỘ PHẬN',
          'NGÀY CÔNG',
          'GIỜ LÀM',
          'TĂNG CA (OT)',
          'ĐI TRỄ / VỀ SỚM',
          'PHÉP / VẮNG'
        ];

        const summaryRows = employeeSummaries.map(emp => {
          let lateEarlyStr = 'Đúng giờ';
          if (emp.late_count > 0 || emp.early_count > 0) {
            const parts: string[] = [];
            if (emp.late_count > 0) {
              parts.push(`${emp.late_count} lần (${formatMinutes(emp.late_minutes)})`);
            }
            if (emp.early_count > 0) {
              parts.push(`Sớm ${emp.early_count} lần (${formatMinutes(emp.early_minutes)})`);
            }
            lateEarlyStr = parts.join(' - ');
          }
          const phepVangStr = emp.absent_count > 0 ? `${emp.absent_count} ngày` : '-';
          return [
            emp.employee_code,
            emp.employee_name,
            emp.department,
            emp.total_work_days,
            `${emp.total_work_hours}h`,
            `+${emp.total_overtime}h`,
            lateEarlyStr,
            phepVangStr
          ];
        });

        const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
        const range = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1:A1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + "1";
          if (!wsSummary[address]) continue;
          wsSummary[address].s = {
            fill: { fgColor: { rgb: "2F5597" } },
            font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 },
            alignment: { vertical: "center", horizontal: "center" }
          };
        }
        const colWidths = summaryHeaders.map((header, index) => {
          const maxDataLen = summaryRows.reduce((max, row) => {
            const val = row[index] ? String(row[index]) : '';
            return Math.max(max, val.length);
          }, header.length);
          return { wch: Math.max(maxDataLen + 4, 12) };
        });
        wsSummary['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, wsSummary, 'TONG_HOP');
      }

      const usedSheetNames = new Set<string>();
      if (includeSummarySheet) usedSheetNames.add('TONG_HOP');

      employeeSummaries.forEach(emp => {
        let cleanName = `${emp.employee_code}_${emp.employee_name}`
          .replace(/[:\\/?*\[\]]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanName.length > 28) {
          cleanName = cleanName.substring(0, 28);
        }
        let sheetName = cleanName || 'NV';
        let dupCounter = 1;
        while (usedSheetNames.has(sheetName)) {
          sheetName = `${cleanName}_${dupCounter}`;
          dupCounter++;
        }
        usedSheetNames.add(sheetName);

        const monthTitle = selectedMonth ? `THÁNG ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}` : '';
        const titleRow = [`BẢNG CHẤM CÔNG CHI TIẾT - ${monthTitle}`];
        const empInfoRow = [`Mã NV: ${emp.employee_code}`, `Họ tên: ${emp.employee_name}`, `Bộ phận: ${emp.department}`];
        const summaryInfoRow = [
          `Tổng ngày công: ${emp.total_work_days}`,
          `Tổng giờ làm: ${emp.total_work_hours}h`,
          `Tăng ca OT: +${emp.total_overtime}h`,
          `Trễ: ${emp.late_count} lần (${formatMinutes(emp.late_minutes)})`,
          `Sớm: ${emp.early_count} lần (${formatMinutes(emp.early_minutes)})`
        ];
        const emptyRow = [''];

        const headers = [
          'NGÀY',
          'THỨ',
          'VÀO 1',
          'RA 1',
          'VÀO 2',
          'RA 2',
          'TRỄ',
          'SỚM',
          'CÔNG',
          'GIỜ LÀM',
          'TĂNG CA (OT)',
          'TRẠNG THÁI'
        ];

        const sortedRecords = [...(emp.records || [])].sort((a, b) => (a.work_date || '').localeCompare(b.work_date || ''));

        const dataRows = sortedRecords.map(r => {
          let formattedDate = r.work_date || '';
          if (formattedDate.includes('-')) {
            const parts = formattedDate.split('-');
            if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }

          return [
            formattedDate,
            r.day_of_week || '',
            r.check_in_1 || '-',
            r.check_out_1 || '-',
            r.check_in_2 || '-',
            r.check_out_2 || '-',
            r.late_minutes > 0 ? formatMinutes(r.late_minutes) : '-',
            r.early_minutes > 0 ? formatMinutes(r.early_minutes) : '-',
            Number(r.work_day) || 0,
            `${Number(r.total_hours) || 0}h`,
            r.overtime_1 > 0 ? `+${r.overtime_1}h` : '-',
            r.status || 'Đúng giờ'
          ];
        });

        const sheetAOA = [
          titleRow,
          empInfoRow,
          summaryInfoRow,
          emptyRow,
          headers,
          ...dataRows
        ];

        const wsEmp = XLSX.utils.aoa_to_sheet(sheetAOA);

        const colWidths = headers.map((h, i) => {
          let maxLen = h.length;
          dataRows.forEach(row => {
            const valStr = String(row[i] || '');
            if (valStr.length > maxLen) maxLen = valStr.length;
          });
          return { wch: Math.max(maxLen + 3, 11) };
        });
        wsEmp['!cols'] = colWidths;

        for (let C = 0; C < headers.length; ++C) {
          const address = XLSX.utils.encode_cell({ r: 4, c: C });
          if (!wsEmp[address]) continue;
          wsEmp[address].s = {
            fill: { fgColor: { rgb: "2F5597" } },
            font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 },
            alignment: { vertical: "center", horizontal: "center" }
          };
        }

        XLSX.utils.book_append_sheet(wb, wsEmp, sheetName);
      });

      const fileName = `Bang_Cham_Cong_Chi_Tiet_Tung_NV_${selectedMonth || format(new Date(), 'yyyyMM')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Đã xuất file Excel chi tiết ${employeeSummaries.length} nhân sự (mỗi người 1 sheet) thành công!`);
    } catch (error: any) {
      console.error('Export Detailed Excel Error:', error);
      toast.error('Lỗi khi xuất Excel chi tiết: ' + error.message);
    }
  };

  const handleExportExcel = () => {
    if ((config.table_name === 'timesheets' || config.id === 'timesheets') && tsViewMode === 'summary') {
      if (employeeSummaries.length === 0) {
        toast.error('Không có dữ liệu để xuất');
        return;
      }

      try {
        const headers = [
          'MÃ NV',
          'HỌ VÀ TÊN',
          'BỘ PHẬN',
          'NGÀY CÔNG',
          'GIỜ LÀM',
          'TĂNG CA (OT)',
          'ĐI TRỄ / VỀ SỚM',
          'PHÉP / VẮNG'
        ];

        const rows = employeeSummaries.map(emp => {
          let lateEarlyStr = 'Đúng giờ';
          if (emp.late_count > 0 || emp.early_count > 0) {
            const parts: string[] = [];
            if (emp.late_count > 0) {
              parts.push(`${emp.late_count} lần (${formatMinutes(emp.late_minutes)})`);
            }
            if (emp.early_count > 0) {
              parts.push(`Sớm ${emp.early_count} lần (${formatMinutes(emp.early_minutes)})`);
            }
            lateEarlyStr = parts.join(' - ');
          }

          const phepVangStr = emp.absent_count > 0 ? `${emp.absent_count} ngày` : '-';

          return [
            emp.employee_code,
            emp.employee_name,
            emp.department,
            emp.total_work_days,
            `${emp.total_work_hours}h`,
            `+${emp.total_overtime}h`,
            lateEarlyStr,
            phepVangStr
          ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_col(C) + "1";
          if (!ws[address]) continue;
          ws[address].s = {
            fill: { fgColor: { rgb: "2F5597" } },
            font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 },
            alignment: { vertical: "center", horizontal: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
        }

        const colWidths = headers.map((header, index) => {
          const maxDataLen = rows.reduce((max, row) => {
            const val = row[index] ? String(row[index]) : '';
            return Math.max(max, val.length);
          }, header.length);
          return { wch: Math.max(maxDataLen + 4, 12) };
        });
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tong_Hop_Nhan_Vien');
        XLSX.writeFile(wb, `Bang_Tong_Hop_Nhan_Vien_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);

        toast.success('Xuất file Excel tổng hợp thành công');
        return;
      } catch (error: any) {
        console.error('Export Excel Error:', error);
        toast.error('Lỗi khi xuất Excel: ' + error.message);
        return;
      }
    }

    if (data.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    try {
      // 1. Prepare data for Excel
      const headers = activeColumns.map(col => col.label);
      const rows = data.map(item => {
        return activeColumns.map(col => {
          let val = item[col.key];
          if (col.type === 'date' && val) {
            return format(new Date(val), 'dd/MM/yyyy');
          }
          if (col.type === 'number' && val !== null && val !== undefined) {
            return val;
          }
          return val || '';
        });
      });

      // 2. Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // 3. Apply styles to headers
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1"; // Header is always row 1
        if (!ws[address]) continue;
        ws[address].s = {
          fill: {
            fgColor: { rgb: "2F5597" } // Dark blue from the image
          },
          font: {
            color: { rgb: "FFFFFF" },
            bold: true,
            sz: 10
          },
          alignment: {
            vertical: "center",
            horizontal: "center"
          },
          border: {
             top: { style: "thin", color: { rgb: "000000" } },
             bottom: { style: "thin", color: { rgb: "000000" } },
             left: { style: "thin", color: { rgb: "000000" } },
             right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }

      // 4. Auto-fit columns
      const colWidths = activeColumns.map((col, index) => {
        const headerLen = col.label.length;
        const maxDataLen = data.reduce((max, item) => {
          const val = item[col.key];
          let strVal = '';
          if (col.type === 'date' && val) strVal = format(new Date(val), 'dd/MM/yyyy');
          else if (col.type === 'number') strVal = (val || 0).toString();
          else strVal = (val || '').toString();
          return Math.max(max, strVal.length);
        }, 0);
        
        return { wch: Math.max(headerLen, maxDataLen) + 5 };
      });
      ws['!cols'] = colWidths;

      // 5. Create workbook and save
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, config.title || 'Data');
      XLSX.writeFile(wb, `${config.id}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
      
      toast.success('Xuất file Excel thành công');
    } catch (error: any) {
      console.error('Export Excel Error:', error);
      toast.error('Lỗi khi xuất Excel: ' + error.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleTimesheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Đang phân tích file chấm công & xử lý danh sách nhân sự...');

    try {
      const rawRecords = await parseTimesheetFile(file);
      if (!rawRecords || rawRecords.length === 0) {
        toast.dismiss(toastId);
        toast.error('Không tìm thấy dữ liệu chấm công hợp lệ trong file');
        return;
      }

      // 1. Fetch existing employees from DB & LocalStorage to map or create missing
      let dbEmps: any[] = [];
      try {
        const { data: resEmps } = await supabase.from('employees').select('*');
        if (resEmps) dbEmps = resEmps;
      } catch (err) {
        console.log('Fetch DB employees fallback:', err);
      }

      const localEmpRaw = localStorage.getItem('local_table_employees');
      let localEmps: any[] = [];
      if (localEmpRaw) {
        try { localEmps = JSON.parse(localEmpRaw); } catch(err){}
      }

      const empMap = new Map<string, any>();
      dbEmps.forEach(emp => {
        const codeKey = String(emp.code || emp.employee_code || '').trim().toUpperCase();
        if (codeKey) empMap.set(codeKey, emp);
      });
      localEmps.forEach(emp => {
        const codeKey = String(emp.code || emp.employee_code || '').trim().toUpperCase();
        if (codeKey) {
          const existing = empMap.get(codeKey);
          empMap.set(codeKey, { ...existing, ...emp });
        }
      });

      // 2. Identify distinct employees in the uploaded file
      const fileEmpsMap = new Map<string, { code: string; name: string; department: string }>();
      rawRecords.forEach(r => {
        const empCode = String(r.employee_code || 'NV001').trim();
        const empName = String(r.employee_name || '').trim();
        const dept = cleanDepartment(r.department);
        if (empCode) {
          const normCode = empCode.toUpperCase();
          const curr = fileEmpsMap.get(normCode);
          if (!curr) {
            fileEmpsMap.set(normCode, { code: empCode, name: empName, department: dept });
          } else {
            if ((!curr.name || curr.name === 'Nhân viên' || curr.name === '---') && empName && empName !== 'Nhân viên' && empName !== '---') {
              curr.name = empName;
            }
            if ((!curr.department || curr.department === '-') && dept && dept !== '-') {
              curr.department = dept;
            }
          }
        }
      });

      // 3. Process employees: map existing or create new
      const employeesToSave = new Map<string, any>();
      let newEmpCount = 0;
      let mappedEmpCount = 0;

      fileEmpsMap.forEach((fileEmp, normCode) => {
        const existingEmp = empMap.get(normCode);

        if (existingEmp) {
          mappedEmpCount++;
          let updated = false;
          const empToSave = { ...existingEmp };

          if ((!empToSave.name || empToSave.name === 'Nhân viên' || empToSave.name === '---') && fileEmp.name && fileEmp.name !== 'Nhân viên' && fileEmp.name !== '---') {
            empToSave.name = fileEmp.name;
            updated = true;
          }
          if ((!empToSave.department || empToSave.department === '-') && fileEmp.department && fileEmp.department !== '-') {
            empToSave.department = fileEmp.department;
            updated = true;
          }

          if (updated) {
            employeesToSave.set(normCode, empToSave);
            empMap.set(normCode, empToSave);
          }
        } else {
          newEmpCount++;
          const newEmp = {
            id: createEmployeeId(),
            code: fileEmp.code,
            name: (fileEmp.name && fileEmp.name !== '---' && fileEmp.name !== 'Nhân viên') ? fileEmp.name : `Nhân viên ${fileEmp.code}`,
            department: (fileEmp.department && fileEmp.department !== '-') ? fileEmp.department : 'Văn phòng',
            position: 'Nhân viên',
            status: 'Đang làm việc',
            created_at: new Date().toISOString()
          };
          employeesToSave.set(normCode, newEmp);
          empMap.set(normCode, newEmp);
        }
      });

      // 4. Save/upsert new or updated employees to LocalStorage & Supabase
      if (employeesToSave.size > 0) {
        const empListToSave = Array.from(employeesToSave.values());

        const updatedLocalEmpsMap = new Map<string, any>();
        localEmps.forEach(e => {
          const k = String(e.code || e.employee_code || '').trim().toUpperCase();
          if (k) updatedLocalEmpsMap.set(k, e);
        });
        empListToSave.forEach(e => {
          const k = String(e.code || e.employee_code || '').trim().toUpperCase();
          if (k) updatedLocalEmpsMap.set(k, e);
        });
        localStorage.setItem('local_table_employees', JSON.stringify(Array.from(updatedLocalEmpsMap.values())));

        try {
          const { error: empErr } = await supabase.from('employees').upsert(empListToSave, { onConflict: 'code' });
          if (empErr) {
            await supabase.from('employees').upsert(empListToSave, { onConflict: 'id' });
          }
        } catch (dbErr) {
          console.log('Supabase employee upsert info:', dbErr);
        }

        queryClient.invalidateQueries({ queryKey: ['table_data', 'employees'] });
      }

      // 5. Deduplicate timesheet records & map resolved employee names and departments
      const uniqueMap = new Map<string, any>();
      rawRecords.forEach(r => {
        const empCode = String(r.employee_code || 'NV001').trim();
        const normCode = empCode.toUpperCase();
        const wDate = String(r.work_date || '').trim();

        const mappedEmp = empMap.get(normCode);
        let finalName = r.employee_name || '';
        let finalDept = cleanDepartment(r.department);

        if (mappedEmp) {
          if (mappedEmp.name && mappedEmp.name !== '---' && mappedEmp.name !== 'Nhân viên') {
            finalName = mappedEmp.name;
          }
          if (mappedEmp.department && mappedEmp.department !== '-') {
            finalDept = mappedEmp.department;
          }
        }

        if (wDate) {
          const key = `${normCode}_${wDate}`;
          const cleanCode = empCode.replace(/[^a-zA-Z0-9]/g, '');
          uniqueMap.set(key, {
            ...r,
            employee_code: empCode,
            employee_name: finalName || 'Nhân viên',
            department: finalDept || 'Văn phòng',
            id: `ts_${cleanCode}_${wDate}`
          });
        }
      });
      const deduplicatedRecords = Array.from(uniqueMap.values());

      // 6. Save/merge with local storage by (normalized employee_code, work_date)
      const localKey = `local_table_${config.table_name}`;
      const existingRaw = localStorage.getItem(localKey);
      let existing: any[] = [];
      if (existingRaw) {
        try { existing = JSON.parse(existingRaw); } catch(err){}
      }
      
      const localMap = new Map<string, any>();
      existing.forEach((item: any) => {
        const empCode = String(item.employee_code || 'NV001').trim();
        const wDate = String(item.work_date || '').trim();
        if (wDate) {
          const key = `${empCode.toUpperCase()}_${wDate}`;
          localMap.set(key, item);
        }
      });
      deduplicatedRecords.forEach((item: any) => {
        const empCode = String(item.employee_code || 'NV001').trim();
        const wDate = String(item.work_date || '').trim();
        if (wDate) {
          const key = `${empCode.toUpperCase()}_${wDate}`;
          localMap.set(key, item);
        }
      });
      const updatedLocal = Array.from(localMap.values());
      localStorage.setItem(localKey, JSON.stringify(updatedLocal));

      // 7. Upsert to Supabase
      try {
        await supabase.from(config.table_name).upsert(deduplicatedRecords, { onConflict: 'id' });
      } catch (dbErr) {
        console.log('Supabase upsert info:', dbErr);
      }

      toast.dismiss(toastId);

      let empMsg = '';
      if (newEmpCount > 0) {
        empMsg = ` (Đã tự động thêm ${newEmpCount} nhân sự mới vào danh sách Nhân sự)`;
      } else if (mappedEmpCount > 0) {
        empMsg = ` (Đã ghép nối dữ liệu với ${mappedEmpCount} nhân sự hiện có)`;
      }

      toast.success(`Đã tải lên ${deduplicatedRecords.length} bản ghi chấm công${empMsg}!`);
      invalidateTableMutation(queryClient, config.table_name);
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error('Upload timesheet error:', err);
      toast.error('Lỗi đọc file chấm công: ' + (err.message || 'File không đúng định dạng'));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // handleSyncToSupabase + handleConfirmDeleteMonth → src/modules/hrm/TimesheetSyncActions.tsx



  const resetColumns = () => {
    setVisibleColumns(config.columns.map(c => c.key));
    setColumnOrder(config.columns);
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedMonth('');
    setDynamicFilters({});
  };

  const handleResetPassword = (emailInput: string) => {
    if (!emailInput) {
      toast.error('Người dùng này không có email');
      return;
    }
    
    // Normalize email if it's just a username
    const normalizedEmail = emailInput.includes('@') ? emailInput : `${emailInput}@sonanh.com`;
    setResetPasswordEmail(normalizedEmail);
  };

  const renderCell = (item: any, column: any) => {
    const value = item[column.key];

    if (column.key === 'department' || (typeof value === 'string' && (value.includes('&#45;') || value === '-----'))) {
      const cleaned = cleanDepartment(value);
      return <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 font-normal">{cleaned}</Badge>;
    }

    if ((column.key === 'late_minutes' || column.key === 'early_minutes') && (typeof value === 'number' || typeof value === 'string')) {
      const valNum = Number(value) || 0;
      if (valNum <= 0) return '-';
      return formatMinutes(valNum);
    }

    if (column.type === 'badge') {
      const variants: Record<string, string> = {
        'Active': 'bg-green-100 text-green-700 border-green-200',
        'Inactive': 'bg-gray-100 text-gray-700 border-gray-200',
        'Admin': 'bg-purple-100 text-purple-700 border-purple-200',
        'User': 'bg-blue-100 text-blue-700 border-blue-200',
        'Thu': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Chi': 'bg-rose-100 text-rose-700 border-rose-200',
        'Chờ duyệt': 'bg-amber-100 text-amber-700 border-amber-200',
        'Hoàn thành': 'bg-blue-100 text-blue-700 border-blue-200',
        'Đã hủy': 'bg-rose-100 text-rose-700 border-rose-200',
        'true': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'false': 'bg-slate-100 text-slate-700 border-slate-200',
        'Đúng giờ': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Đi trễ': 'bg-amber-100 text-amber-700 border-amber-200',
        'Về sớm': 'bg-orange-100 text-orange-700 border-orange-200',
        'Vắng mặt': 'bg-rose-100 text-rose-700 border-rose-200',
        'Cuối tuần': 'bg-slate-100 text-slate-700 border-slate-200',
      };
      return (
        <Badge variant="outline" className={variants[value] || 'bg-slate-100 text-slate-700 border-slate-200'}>
          {value}
        </Badge>
      );
    }

    if (column.type === 'date' && value) {
      return format(new Date(value), 'dd/MM/yyyy');
    }

    if (column.type === 'number') {
      const currencyKeys = ['amount', 'price', 'so_tien', 'tong_tien', 'cost', 'revenue'];
      if (currencyKeys.includes(column.key) || config.id === 'transactions') {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
      }
      return value ?? 0;
    }

    return value;
  };

  const activeColumns = columnOrder.filter(col => visibleColumns.includes(col.key));
  
  // Logic identifying if date range filter should be shown:
  // 1. If JSON has a date_range filter, use its 'visible' property (default true)
  // 2. If NO date_range in JSON, fall back to 'show_filter_date' toggle
  const jsonDateFilter = config.filters?.find(f => f.type === 'date_range');
  const hasDateRangeFilter = jsonDateFilter 
    ? jsonDateFilter.visible !== false 
    : config.show_filter_date !== false;

  const compactFilterDefinitions = useMemo<CompactFilterDefinition[]>(() => {
    const tableColumns = new Set(config.columns.map((column) => column.key));
    const definitions: CompactFilterDefinition[] = [];

    if (isTimesheetTable && !CustomFilterComponent) {
      definitions.push({ key: MONTH_FILTER_KEY, label: 'Thời gian', type: 'month' });
    } else if (hasDateRangeFilter && !CustomFilterComponent) {
      definitions.push({
        key: DATE_FILTER_KEY,
        label: jsonDateFilter?.label || 'Thời gian',
        type: 'date_range',
      });
    }

    config.filters
      ?.filter((filter) => filter.type !== 'date_range' && filter.visible !== false)
      .filter((filter) => tableColumns.has(filter.key) || filter.key === 'id' || filter.key === 'created_at')
      .forEach((filter) => definitions.push({
        key: filter.key,
        label: filter.label,
        type: filter.type,
        options: filter.options,
      }));

    return definitions;
  }, [CustomFilterComponent, config.columns, config.filters, hasDateRangeFilter, isTimesheetTable, jsonDateFilter?.label]);

  const compactFilterValues = useMemo<Record<string, CompactFilterValue>>(() => ({
    ...dynamicFilters,
    [DATE_FILTER_KEY]: { from: dateFrom, to: dateTo },
    [MONTH_FILTER_KEY]: selectedMonth,
  }), [dateFrom, dateTo, dynamicFilters, selectedMonth]);

  useEffect(() => {
    setEnabledFilterKeys(isTimesheetTable && !CustomFilterComponent ? [MONTH_FILTER_KEY] : []);
  }, [config.id, CustomFilterComponent, isTimesheetTable]);

  const handleCompactFilterValueChange = (key: string, value: CompactFilterValue) => {
    setPage(1);
    if (key === DATE_FILTER_KEY && typeof value !== 'string') {
      setDateFrom(value.from);
      setDateTo(value.to);
      return;
    }
    if (key === MONTH_FILTER_KEY && typeof value === 'string') {
      setSelectedMonth(value);
      return;
    }
    if (typeof value === 'string') {
      setDynamicFilters((current) => ({ ...current, [key]: value }));
    }
  };

  const clearCompactFilter = (key: string) => {
    setPage(1);
    if (key === DATE_FILTER_KEY) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    if (key === MONTH_FILTER_KEY) {
      setSelectedMonth('');
      return;
    }
    setDynamicFilters((current) => ({ ...current, [key]: '' }));
  };

  // Admin always has full permissions
  const userRole = 'Admin'; 
  const isAdmin = userRole === 'Admin';

  const show_action_add = isAdmin || config.show_action_add !== false;
  const show_action_edit = isAdmin || config.show_action_edit !== false;
  const show_action_view = isAdmin || config.show_action_view !== false;
  const show_action_delete = isAdmin || config.show_action_delete !== false;
  const show_action_export = isAdmin || config.show_action_export !== false;
  const show_action_print = isAdmin || config.show_action_print !== false;
  const show_action_upload = config.id === 'timesheets' || config.table_name === 'timesheets' || (config.actions as string[])?.includes('upload');
  const show_search = config.show_search !== false;

  return (
    <div className="space-y-4 printable-area">
      {queryResult?.loadError && (
        <div role="alert" className="no-print rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p>Không tải được dữ liệu Supabase của {config.title}: {queryResult.loadError}</p>
          <p>Dữ liệu cục bộ (nếu có) vẫn được hiển thị.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>Thử tải lại</Button>
        </div>
      )}
      {/* Advanced Toolbar */}
      <div className="no-print toolbar-container">
        <div className="flex flex-wrap items-center gap-2">
          {(config.table_name === 'timesheets' || config.id === 'timesheets') && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <Button 
                variant={tsViewMode === 'summary' ? 'default' : 'ghost'} 
                size="sm" 
                className={`h-8 text-xs font-semibold ${tsViewMode === 'summary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => {
                  setTsViewMode('summary');
                  setSearchTerm('');
                  setPage(1);
                }}
              >
                Bảng tổng hợp Nhân viên
              </Button>
              <Button 
                variant={tsViewMode === 'detail' ? 'default' : 'ghost'} 
                size="sm" 
                className={`h-8 text-xs font-semibold ${tsViewMode === 'detail' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => {
                  setTsViewMode('detail');
                  setPage(1);
                }}
              >
                Chi tiết từng ngày
              </Button>
            </div>
          )}

          {CustomFilterComponent && (
            <CustomFilterComponent
              value={selectedMonth}
              onChange={setSelectedMonth}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              config={config}
            />
          )}

          <CompactTableFilters
            searchTerm={searchTerm}
            onSearchTermChange={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
            showSearch={show_search}
            filters={compactFilterDefinitions}
            enabledFilterKeys={enabledFilterKeys}
            onEnabledFilterKeysChange={setEnabledFilterKeys}
            values={compactFilterValues}
            onValueChange={handleCompactFilterValueChange}
            onClearFilter={clearCompactFilter}
            onClearAll={resetFilters}
          />

          {selectedIds.length > 0 && show_action_delete && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="gap-2 h-10 px-4 animate-in fade-in slide-in-from-left-2"
              onClick={handleDeleteSelected}
              disabled={isDeletingBulk}
            >
              <Trash2 className="h-4 w-4" />
              Xóa ({selectedIds.length})
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Popover>
              <PopoverTrigger render={
                <Button variant="outline" size="icon" aria-label="Cột hiển thị" className="h-10 w-10 bg-blue-600 text-white hover:bg-blue-700 border-none" />
              }>
                  <LayoutGrid className="h-5 w-5" />
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="p-3 border-b flex items-center justify-between bg-slate-50/50">
                  <span className="text-sm font-semibold">Cột hiển thị</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{visibleColumns.length}/{config.columns.length}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetColumns}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="p-2 max-h-80 overflow-y-auto custom-scrollbar">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={columnOrder.map(c => c.key)}
                      strategy={verticalListSortingStrategy}
                    >
                      {columnOrder.map((col) => (
                        <SortableColumnItem 
                          key={col.key} 
                          column={col} 
                          isVisible={visibleColumns.includes(col.key)}
                          onToggle={toggleColumn}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </PopoverContent>
            </Popover>

            {show_action_upload && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".xlsx, .xls, .xml, .csv" 
                  className="hidden" 
                  onChange={handleTimesheetUpload}
                />
                <Button 
                  variant="outline" 
                  className="gap-2 h-10 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 font-semibold shadow-sm" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload file chấm công
                </Button>
              </>
            )}

            {CustomActionsComponent ? (
              <CustomActionsComponent
                tableName={config.table_name}
                selectedMonth={selectedMonth}
                rawData={rawData}
                config={config}
              />
            ) : isTimesheetTable ? (
              <TimesheetSyncActions
                tableName={config.table_name}
                selectedMonth={selectedMonth}
                rawData={rawData}
              />
            ) : null}

            {show_action_export && (
              isTimesheetTable ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" className="gap-2 h-10 border-slate-300 bg-white hover:bg-slate-50 font-semibold shadow-sm text-slate-800" />
                  }>
                      <FileDown className="h-4 w-4 text-emerald-600" />
                      <span>Xuất Excel</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 p-1.5 shadow-lg border-slate-200">
                    <DropdownMenuItem 
                      className="flex items-start gap-2.5 p-2.5 cursor-pointer rounded-md font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={handleExportVouchersCombined}
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                          Xuất Dạng Phiếu Gốc (Tất cả NV trên 1 sheet)
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-800 border-emerald-300">Chuẩn .xml</Badge>
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Mẫu phiếu có công thức tính, tô màu CN/Lý do, cột Vi phạm & Phạt</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-start gap-2.5 p-2.5 cursor-pointer rounded-md font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                      onClick={handleExportVouchersMultiSheet}
                    >
                      <Users className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-blue-900">Xuất Dạng Phiếu Gốc (Mỗi NV 1 sheet)</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Tạo các sheet phiếu chấm công riêng biệt kèm công thức cho từng NV</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-start gap-2.5 p-2.5 cursor-pointer rounded-md font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => handleExportExcelDetailedPerEmployee(true)}
                    >
                      <FileText className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-slate-800">Xuất Bảng Lưới TH + Chi tiết (Mỗi NV 1 sheet)</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Dạng bảng lưới gồm 1 Sheet tổng hợp & các Sheet chi tiết</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="flex items-start gap-2.5 p-2.5 cursor-pointer rounded-md font-medium text-slate-700 hover:bg-slate-100"
                      onClick={handleExportExcel}
                    >
                      <FileText className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-slate-800">Xuất Bảng Tổng Hợp Đơn (1 Sheet)</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Chỉ xuất 1 sheet danh sách tổng kết toàn công ty</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" className="gap-2 h-10" onClick={handleExportExcel}>
                  <FileDown className="h-4 w-4" />
                  Xuất Excel
                </Button>
              )
            )}
            {show_action_print && (
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
              </Button>
            )}
            {onConfigFilter && <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10 text-slate-600 border-slate-200 hover:bg-slate-50"
              title="Cấu hình bộ lọc màn hình"
              onClick={() => onConfigFilter?.(config)}
            >
              <Settings className="h-4 w-4" />
            </Button>}
            {show_action_add && (
              <Button onClick={onAdd} className="bg-blue-600 hover:bg-blue-700 gap-2 h-10">
                <Plus className="h-4 w-4" />
                Thêm
              </Button>
            )}
          </div>
        </div>

      </div>

      {/* Table Section */}
      {(config.table_name === 'timesheets' || config.id === 'timesheets') && tsViewMode === 'summary' ? (
        <div className="rounded-xl border border-slate-800 bg-[#121826] overflow-hidden shadow-xl text-slate-100">
          <Table className="print-hide-actions">
            <TableHeader className="bg-[#1a2234] border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-[#1a2234]">
                <TableHead className="font-semibold text-slate-300 text-xs">MÃ NV</TableHead>
                <TableHead className="font-semibold text-slate-300 text-xs">HỌ VÀ TÊN</TableHead>
                <TableHead className="font-semibold text-slate-300 text-xs">BỘ PHẬN</TableHead>
                <TableHead className="font-semibold text-slate-300 text-xs">NGÀY CÔNG</TableHead>
                <TableHead className="font-semibold text-slate-300 text-xs">GIỜ LÀM</TableHead>
                <TableHead className="font-semibold text-slate-300 text-xs">TĂNG CA (OT)</TableHead>
                <TableHead className="font-semibold text-slate-300 text-xs">ĐI TRỄ / VỀ SỚM</TableHead>
                <TableHead className="font-semibold text-slate-300 text-xs">PHÉP / VẮNG</TableHead>
                <TableHead className="font-semibold text-slate-300 text-xs">XẾP LOẠI</TableHead>
                <TableHead className="text-right font-semibold text-slate-300 text-xs">THAO TÁC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-800/80">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-slate-400">
                    Đang tải dữ liệu chấm công...
                  </TableCell>
                </TableRow>
              ) : employeeSummaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-slate-400">
                    Chưa có dữ liệu chấm công. Hãy bấm "Upload file chấm công" để tải file Excel/XML.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployeeSummaries.map((emp) => (
                  <TableRow key={emp.employee_code} className="hover:bg-slate-800/50 transition-colors border-slate-800/60">
                    <TableCell className="font-mono text-slate-400 font-semibold text-sm">{emp.employee_code}</TableCell>
                    <TableCell className="font-bold text-slate-100 text-sm">{emp.employee_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-800/80 text-slate-300 border-slate-700/80 font-medium">
                        {emp.department}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-emerald-400 text-base">{emp.total_work_days}</TableCell>
                    <TableCell className="font-semibold text-slate-200 text-sm">{emp.total_work_hours}h</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/80">
                        +{emp.total_overtime}h
                      </span>
                    </TableCell>
                    <TableCell>
                      {emp.late_count === 0 && emp.early_count === 0 ? (
                        <span className="text-emerald-400 font-semibold text-xs">Đúng giờ</span>
                      ) : (
                        <div className="space-y-0.5 text-xs">
                          {emp.late_count > 0 && (
                            <div className="text-amber-400 font-bold">{emp.late_count} lần ({formatMinutes(emp.late_minutes)})</div>
                          )}
                          {emp.early_count > 0 && (
                            <div className="text-rose-400 font-semibold">Sớm {emp.early_count} lần ({formatMinutes(emp.early_minutes)})</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {emp.absent_count > 0 ? `${emp.absent_count} ngày` : '-'}
                    </TableCell>
                    <TableCell>
                      {emp.late_count === 0 && emp.early_count === 0 && emp.absent_count === 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-800/80">
                          <Award className="h-3.5 w-3.5 text-emerald-400" /> Xuất sắc
                        </span>
                      ) : emp.late_count > 5 || emp.absent_count > 1 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/90 text-amber-300 border border-amber-800/80">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400" /> Cần chú ý
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-950/90 text-blue-300 border border-blue-800/80">
                          Tốt
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-slate-800"
                          title="Xem danh sách từng ngày"
                          onClick={() => {
                            setSearchTerm(emp.employee_code);
                            setTsViewMode('detail');
                            setPage(1);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800"
                          title="Phiếu tổng hợp chi tiết"
                          onClick={() => setSelectedEmpModal(emp)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <Table className="print-hide-actions">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    className="rounded border-gray-300" 
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                {activeColumns.map((col) => (
                  <TableHead 
                    key={col.key} 
                    className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {sortConfig.key === col.key ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={activeColumns.length + 2} className="h-32 text-center text-muted-foreground">
                    Đang tải dữ liệu...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeColumns.length + 2} className="h-32 text-center text-muted-foreground">
                    Chưa có dữ liệu.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item, idx) => (
                  <TableRow key={item.id || idx} className={`transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                    <TableCell>
                      <Checkbox 
                        className="rounded border-gray-300" 
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={(checked) => handleSelectOne(item.id, !!checked)}
                      />
                    </TableCell>
                    {activeColumns.map((col) => (
                      <TableCell key={col.key}>
                        {renderCell(item, col)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {config.id === 'functions' && onConfigFilter && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Cấu hình bộ lọc"
                            onClick={() => onConfigFilter(item)}
                          >
                            <Filter className="h-4 w-4" />
                          </Button>
                        )}
                        {config.id === 'roles' && onPermissionMatrix && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            title="Phân quyền vai trò"
                            onClick={() => onPermissionMatrix(item)}
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {config.id === 'users' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Đặt lại mật khẩu & Gửi Email"
                            onClick={() => handleResetPassword(item.email)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        )}
                        {show_action_view && onView && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                            title="Xem chi tiết"
                            onClick={() => onView(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {show_action_edit && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => onEdit(item)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {show_action_delete && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button variant="ghost" size="icon" aria-label="Thao tác bản ghi" className="h-8 w-8" />
                          }>
                              <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {show_action_view && onView && (
                              <DropdownMenuItem onClick={() => onView(item)}>
                                <Eye className="mr-2 h-4 w-4" /> Xem chi tiết
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              const { id, created_at, ...copy } = item;
                              onAdd();
                              // Logic to pre-fill form for copy would be here
                            }}>
                              <Copy className="mr-2 h-4 w-4" /> Sao chép
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, ids: [] })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4">
              <TriangleAlert className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-center text-xl">Xác nhận xóa dữ liệu?</DialogTitle>
            <DialogDescription className="text-center py-2">
              {deleteConfirm.ids.length > 1 
                ? `Bạn có chắc chắn muốn xóa ${deleteConfirm.ids.length} bản ghi đã chọn? Hành động này không thể hoàn tác.`
                : 'Bạn có chắc chắn muốn xóa bản ghi này? Hành động này không thể hoàn tác.'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm({ open: false, ids: [] })} className="flex-1">
              Hủy bỏ
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAction} className="flex-1 bg-rose-600 hover:bg-rose-700">
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Month Data Confirmation Dialog → moved to src/modules/hrm/TimesheetSyncActions.tsx */}

      {config.id === 'users' && (
        <ResetPasswordDialog 
          email={resetPasswordEmail}
          onClose={() => setResetPasswordEmail(null)}
        />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 no-print pagination-container">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Hiển thị {activeTotalCount > 0 ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, activeTotalCount)} trên {activeTotalCount} bản ghi
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Hiển thị:</span>
            <select 
              value={pageSize} 
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 w-[65px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2 py-1 font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>/ trang</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="bg-blue-600 text-white hover:bg-blue-700">{page}</Button>
            {activeTotalCount > page * pageSize && (
               <span className="text-xs text-slate-400 mx-1">...</span>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page * pageSize >= activeTotalCount}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Employee Detail Modal */}
      <Dialog open={!!selectedEmpModal} onOpenChange={(open) => !open && setSelectedEmpModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Phiếu tổng hợp chấm công cá nhân
              </DialogTitle>
              <DialogDescription className="mt-1">
                Chi tiết công, giờ làm và lịch sử vào ra của nhân viên
              </DialogDescription>
            </div>
            {selectedEmpModal && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-medium shrink-0 mr-6"
                onClick={() => handleExportSingleEmployeeExcel(selectedEmpModal)}
              >
                <FileDown className="h-4 w-4" />
                Xuất Excel cá nhân
              </Button>
            )}
          </DialogHeader>

          {selectedEmpModal && (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
                <div>
                  <div className="text-xs text-muted-foreground">Nhân viên</div>
                  <div className="font-bold text-slate-900 text-lg">{selectedEmpModal.employee_name}</div>
                  <div className="text-xs text-slate-500 font-mono">Mã: {selectedEmpModal.employee_code}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Bộ phận</div>
                  <div className="font-semibold text-slate-800">{selectedEmpModal.department}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Tổng công làm việc</div>
                  <div className="font-bold text-emerald-600 text-2xl">{selectedEmpModal.total_work_days} công</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div className="text-xs text-blue-600 font-medium">Tổng giờ làm</div>
                  <div className="text-xl font-bold text-blue-900">{selectedEmpModal.total_work_hours}h</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                  <div className="text-xs text-purple-600 font-medium">Tăng ca (OT)</div>
                  <div className="text-xl font-bold text-purple-900">+{selectedEmpModal.total_overtime}h</div>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                  <div className="text-xs text-amber-600 font-medium">Đi trễ</div>
                  <div className="text-xl font-bold text-amber-900">{selectedEmpModal.late_count} lần ({formatMinutes(selectedEmpModal.late_minutes)})</div>
                </div>
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-100">
                  <div className="text-xs text-rose-600 font-medium">Về sớm</div>
                  <div className="text-xl font-bold text-rose-900">{selectedEmpModal.early_count} lần ({formatMinutes(selectedEmpModal.early_minutes)})</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Lịch sử chấm công các ngày</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-100">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Ngày</TableHead>
                        <TableHead className="text-xs font-semibold">Thứ</TableHead>
                        <TableHead className="text-xs font-semibold">Vào 1</TableHead>
                        <TableHead className="text-xs font-semibold">Ra 1</TableHead>
                        <TableHead className="text-xs font-semibold">Đi trễ</TableHead>
                        <TableHead className="text-xs font-semibold">Về sớm</TableHead>
                        <TableHead className="text-xs font-semibold">Công</TableHead>
                        <TableHead className="text-xs font-semibold">Tổng giờ</TableHead>
                        <TableHead className="text-xs font-semibold">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEmpModal.records.map((r: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium">{r.work_date}</TableCell>
                          <TableCell className="text-xs">{r.day_of_week}</TableCell>
                          <TableCell className="text-xs font-mono font-semibold text-blue-700">{r.check_in_1 || '---'}</TableCell>
                          <TableCell className="text-xs font-mono font-semibold text-indigo-700">{r.check_out_1 || '---'}</TableCell>
                          <TableCell className="text-xs font-semibold text-amber-600">{r.late_minutes ? formatMinutes(r.late_minutes) : '-'}</TableCell>
                          <TableCell className="text-xs font-semibold text-rose-600">{r.early_minutes ? formatMinutes(r.early_minutes) : '-'}</TableCell>
                          <TableCell className="text-xs font-bold text-emerald-600">{r.work_day}</TableCell>
                          <TableCell className="text-xs">{r.total_hours}h</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className={
                              r.status === 'Đúng giờ' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                              r.status === 'Đi trễ' || r.status === 'Về sớm' || r.status === 'Đi trễ, về sớm' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setSelectedEmpModal(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};



