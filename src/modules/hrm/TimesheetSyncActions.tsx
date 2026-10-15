import React, { useState } from 'react';
import { Database, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateTableMutation } from '@/lib/configCache';
import { cleanDepartment } from '@/lib/timesheetParser';
import { buildEmployeeSyncPlan, type ExistingEmployee } from './timesheetEmployeeSync';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonthRange(monthStr: string) {
  if (!monthStr || !monthStr.includes('-')) return { start: '', end: '' };
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${monthStr}-01`,
    end: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimesheetSyncActionsProps {
  /** Tên bảng Supabase (thường là 'timesheets') */
  tableName: string;
  /** Tháng đang chọn, dạng 'YYYY-MM' */
  selectedMonth: string;
  /** Dữ liệu chấm công đang hiển thị trong bảng */
  rawData: any[];
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * TimesheetSyncActions
 *
 * Hai nút tách từ DynamicTable dành riêng cho module HRM / màn hình timesheets:
 *   1. Cập nhật dữ liệu lên Supabase (sync + deduplicate)
 *   2. Xóa dữ liệu tháng (Supabase + localStorage)
 *
 * Nhận toàn bộ dependency qua props; không đọc state bên ngoài.
 */
export const TimesheetSyncActions: React.FC<TimesheetSyncActionsProps> = ({
  tableName,
  selectedMonth,
  rawData,
}) => {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // ── Sync to Supabase ────────────────────────────────────────────────────────

  const handleSyncToSupabase = async () => {
    const localKey = `local_table_${tableName}`;
    const localRaw = localStorage.getItem(localKey);
    let localItems: any[] = [];
    if (localRaw) {
      try { localItems = JSON.parse(localRaw); } catch { /* invalid JSON */ }
    }

    const { start, end } = getMonthRange(selectedMonth);

    const monthLocalItems = selectedMonth
      ? localItems.filter(item => {
          const d = item.work_date || '';
          return d >= start && d <= end;
        })
      : localItems;

    // Deduplicate keyed by employee_code + work_date
    const dedupeMap = new Map<string, any>();

    rawData.forEach(item => {
      const empCode = String(item.employee_code || '').trim();
      const wDate = String(item.work_date || '').trim();
      if (empCode && wDate) dedupeMap.set(`${empCode.toUpperCase()}_${wDate}`, item);
    });

    monthLocalItems.forEach(item => {
      const empCode = String(item.employee_code || '').trim();
      const wDate = String(item.work_date || '').trim();
      if (empCode && wDate) dedupeMap.set(`${empCode.toUpperCase()}_${wDate}`, item);
    });

    const recordsToSync = Array.from(dedupeMap.values()).map(r => {
      const empCode = String(r.employee_code || '').trim();
      const wDate = String(r.work_date || '').trim();
      const cleanCode = empCode.replace(/[^a-zA-Z0-9]/g, '');
      return {
        id: `ts_${cleanCode}_${wDate}`,
        employee_code: empCode,
        employee_name: r.employee_name || 'Nhân viên',
        department: cleanDepartment(r.department),
        work_date: wDate,
        day_of_week: r.day_of_week || '',
        check_in_1: r.check_in_1 || null,
        check_out_1: r.check_out_1 || null,
        check_in_2: r.check_in_2 || null,
        check_out_2: r.check_out_2 || null,
        work_day: Number(r.work_day) || 0,
        total_hours: Number(r.total_hours) || 0,
        late_minutes: Number(r.late_minutes) || 0,
        early_minutes: Number(r.early_minutes) || 0,
        overtime_1: Number(r.overtime_1) || 0,
        status: r.status || 'Đúng giờ',
      };
    });

    if (recordsToSync.length === 0) {
      toast.error(`Không có dữ liệu chấm công tháng ${selectedMonth} để cập nhật lên Supabase`);
      return;
    }

    setIsSyncing(true);
    const monthLabel = selectedMonth
      ? `tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`
      : '';
    const toastId = toast.loading(
      `Đang làm sạch & đồng bộ ${recordsToSync.length} bản ghi chấm công ${monthLabel} lên Supabase...`
    );

    try {
      const { data: existingEmployees, error: employeeReadError } = await supabase
        .from('employees')
        .select('id, code, name, department, position, phone, email, join_date, status, created_at');
      if (employeeReadError) throw employeeReadError;

      const employeePlan = buildEmployeeSyncPlan(
        recordsToSync,
        (existingEmployees || []) as ExistingEmployee[],
      );
      if (employeePlan.rows.length > 0) {
        const { error: employeeUpsertError } = await supabase
          .from('employees')
          .upsert(employeePlan.rows, { onConflict: 'code' });
        if (employeeUpsertError) throw employeeUpsertError;
      }

      // Xóa bản ghi cũ trùng lặp trước khi upsert
      if (selectedMonth && start && end) {
        const { error: deleteErr } = await supabase
          .from(tableName)
          .delete()
          .gte('work_date', start)
          .lte('work_date', end);
        if (deleteErr) console.warn('Pre-sync delete warning:', deleteErr);
      }

      const { error } = await supabase
        .from(tableName)
        .upsert(recordsToSync, { onConflict: 'id' });
      if (error) throw error;

      // Làm sạch localStorage
      if (localRaw) {
        try {
          const allLocal: any[] = JSON.parse(localRaw);
          const otherMonths = allLocal.filter(item => {
            const d = item.work_date || '';
            return selectedMonth ? !(d >= start && d <= end) : false;
          });
          localStorage.setItem(localKey, JSON.stringify([...otherMonths, ...recordsToSync]));
        } catch { /* ignore */ }
      }

      toast.dismiss(toastId);
      toast.success(
        `Đã cập nhật ${recordsToSync.length} bản ghi chấm công và đồng bộ ${employeePlan.sourceCount} nhân sự ${monthLabel} lên Supabase` +
        (employeePlan.newCount > 0 ? ` (thêm mới ${employeePlan.newCount})` : '') +
        (employeePlan.updatedCount > 0 ? ` (bổ sung thông tin ${employeePlan.updatedCount})` : '')
      );
      invalidateTableMutation(queryClient, 'employees');
      invalidateTableMutation(queryClient, tableName);
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error('Supabase Sync Error:', err);
      toast.error('Lỗi khi cập nhật lên Supabase: ' + (err.message || 'Không thể ghi dữ liệu'));
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Delete Month ────────────────────────────────────────────────────────────

  const handleConfirmDeleteMonth = async () => {
    if (!selectedMonth) {
      toast.error('Vui lòng chọn tháng chấm công cần xóa');
      return;
    }

    setDeleteConfirmOpen(false);
    setIsDeleting(true);

    const { start, end } = getMonthRange(selectedMonth);
    const [yyyy, mm] = selectedMonth.split('-');
    const monthDisplay = `tháng ${mm}/${yyyy}`;
    const toastId = toast.loading(`Đang xoá dữ liệu chấm công ${monthDisplay}...`);

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .gte('work_date', start)
        .lte('work_date', end);
      if (error) console.error('Supabase delete month error:', error);

      const localKey = `local_table_${tableName}`;
      const localRaw = localStorage.getItem(localKey);
      if (localRaw) {
        try {
          const localItems = JSON.parse(localRaw);
          if (Array.isArray(localItems)) {
            const remaining = localItems.filter((item: any) => {
              const wDate = item.work_date || '';
              return !(wDate >= start && wDate <= end);
            });
            localStorage.setItem(localKey, JSON.stringify(remaining));
          }
        } catch (e) {
          console.error('LocalStorage clean error:', e);
        }
      }

      toast.dismiss(toastId);
      toast.success(`Đã xoá toàn bộ dữ liệu chấm công ${monthDisplay} thành công!`);
      invalidateTableMutation(queryClient, tableName);
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error('Delete month data error:', err);
      toast.error('Lỗi khi xoá dữ liệu chấm công: ' + (err.message || 'Không thể xoá'));
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const monthDisplay = selectedMonth
    ? `${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`
    : '';

  return (
    <>
      {/* Nút Cập nhật lên Supabase */}
      <Button
        variant="default"
        className="gap-2 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-all"
        onClick={handleSyncToSupabase}
        disabled={isSyncing || isDeleting}
      >
        <Database className="h-4 w-4" />
        {isSyncing ? 'Đang cập nhật...' : 'Cập nhật dữ liệu lên Supabase'}
      </Button>

      {/* Nút Xóa dữ liệu tháng */}
      <Button
        variant="outline"
        className="gap-2 h-10 border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 font-semibold shadow-sm transition-all"
        onClick={() => setDeleteConfirmOpen(true)}
        disabled={isSyncing || isDeleting || !selectedMonth}
        title={
          selectedMonth
            ? `Xoá toàn bộ dữ liệu chấm công tháng ${monthDisplay}`
            : 'Chọn tháng để xoá'
        }
      >
        <Trash2 className="h-4 w-4 text-rose-600" />
        <span>Xoá dữ liệu tháng</span>
      </Button>

      {/* Dialog xác nhận xóa tháng */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4 shadow-sm">
              <Trash2 className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-slate-900">
              Xóa dữ liệu chấm công tháng {monthDisplay}?
            </DialogTitle>
            <DialogDescription className="text-center py-2 text-slate-600">
              Bạn có chắc chắn muốn xóa{' '}
              <strong className="text-rose-600 font-semibold">
                toàn bộ dữ liệu chấm công tháng {monthDisplay}
              </strong>{' '}
              khỏi cơ sở dữ liệu Supabase và bộ nhớ ứng dụng?
              <div className="mt-3 text-xs text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200 font-medium text-left leading-relaxed">
                ⚠️ <strong>Cảnh báo:</strong> Thao tác này sẽ xoá tất cả các bản ghi giờ vào/ra,
                tính công và tăng ca trong tháng này và không thể phục hồi lại.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="flex-1"
            >
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteMonth}
              disabled={isDeleting}
              className="flex-1 bg-rose-600 hover:bg-rose-700 font-semibold shadow-md shadow-rose-200"
            >
              {isDeleting ? 'Đang xoá...' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
