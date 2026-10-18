import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstRecord = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(page * pageSize, totalCount);

  return (
    <div
      className="pagination-container no-print sticky bottom-0 z-50 flex min-h-14 shrink-0 items-center justify-between gap-3 border-t border-border bg-background/95 px-3 py-2 shadow-[0_-4px_12px_-10px_rgba(15,23,42,0.35)] backdrop-blur supports-[backdrop-filter]:bg-background/90"
      data-bd-group="table-pagination"
      data-bd-align-group="table-pagination"
    >
      <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground sm:text-sm">
        <span className="truncate tabular-nums">
          {firstRecord}–{lastRecord} / {totalCount} bản ghi
        </span>
        <label className="hidden items-center gap-2 sm:flex">
          <span>Hiển thị</span>
          <select
            aria-label="Số bản ghi mỗi trang"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm font-medium text-foreground shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>/ trang</span>
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-xs tabular-nums text-muted-foreground md:inline">
          Trang {page}/{totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-11 sm:size-9"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-11 sm:size-9"
          aria-label="Trang sau"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
