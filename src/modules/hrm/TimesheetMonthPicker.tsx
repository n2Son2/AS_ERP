import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface TimesheetMonthPickerProps {
  /** Giá trị tháng dạng 'YYYY-MM' */
  value?: string;
  /** Callback khi tháng thay đổi */
  onChange?: (month: string) => void;
  /** Tương thích với prop selectedMonth */
  selectedMonth?: string;
  /** Tương thích với prop setSelectedMonth */
  setSelectedMonth?: (month: string) => void;
  /** ClassName bổ sung */
  className?: string;
}

/** Lấy chuỗi tháng trước dạng YYYY-MM */
export const getPreviousMonthStr = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

/** Lấy ngày đầu và ngày cuối của tháng YYYY-MM */
export const getMonthRange = (monthStr: string): { start: string; end: string } => {
  if (!monthStr || !monthStr.includes('-')) return { start: '', end: '' };
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${monthStr}-01`;
  const end = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

export const TimesheetMonthPicker: React.FC<TimesheetMonthPickerProps> = ({
  value,
  onChange,
  selectedMonth,
  setSelectedMonth,
  className = '',
}) => {
  const currentVal = value ?? selectedMonth ?? '';
  const handleChange = (newVal: string) => {
    onChange?.(newVal);
    setSelectedMonth?.(newVal);
  };

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const prevMonthStr = getPreviousMonthStr();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${yyyy}-${mm}`;
      let label = `Tháng ${mm}/${yyyy}`;
      if (val === prevMonthStr) label += ' (Tháng trước)';
      else if (val === currentMonthStr) label += ' (Tháng này)';

      options.push({ value: val, label });
    }
    return options;
  }, []);

  return (
    <div className={`flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 pr-2 shadow-sm ${className}`}>
      <div className="px-3 text-xs font-semibold text-slate-700 border-r border-slate-100 flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-blue-600" />
        <span>Tháng chấm công:</span>
      </div>
      <select
        className="h-8 bg-transparent text-xs font-semibold focus:outline-none cursor-pointer text-slate-800 pr-1"
        value={currentVal}
        onChange={(e) => handleChange(e.target.value)}
      >
        {monthOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="border-l border-slate-100 pl-2">
        <Input
          type="month"
          value={currentVal}
          onChange={(e) => handleChange(e.target.value)}
          className="h-7 w-32 text-xs border-slate-200 focus:ring-1 focus:ring-blue-500 font-medium"
        />
      </div>
    </div>
  );
};
