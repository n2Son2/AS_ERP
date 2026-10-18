import { useMemo, useState } from 'react';
import { ChevronDown, Filter, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type CompactFilterType = 'select' | 'text' | 'date_range' | 'month';

export interface CompactFilterDefinition {
  key: string;
  label: string;
  type: CompactFilterType;
  options?: string[];
}

export type CompactFilterValue = string | { from: string; to: string };

interface CompactTableFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  showSearch?: boolean;
  filters: CompactFilterDefinition[];
  enabledFilterKeys: string[];
  onEnabledFilterKeysChange: (keys: string[]) => void;
  values: Record<string, CompactFilterValue>;
  onValueChange: (key: string, value: CompactFilterValue) => void;
  onClearFilter: (key: string) => void;
  onClearAll: () => void;
}

const formatDate = (value: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
};

const filterHasValue = (value: CompactFilterValue | undefined) => {
  if (typeof value === 'string') return Boolean(value);
  return Boolean(value?.from || value?.to);
};

const getValueLabel = (filter: CompactFilterDefinition, value: CompactFilterValue | undefined) => {
  if (!filterHasValue(value)) return 'Chưa chọn';
  if (filter.type === 'date_range' && typeof value !== 'string') {
    const from = formatDate(value.from);
    const to = formatDate(value.to);
    if (from && to) return `${from} – ${to}`;
    return from ? `Từ ${from}` : `Đến ${to}`;
  }
  if (filter.type === 'month' && typeof value === 'string') {
    const [year, month] = value.split('-');
    return month && year ? `Tháng ${month}/${year}` : value;
  }
  return String(value);
};

export function CompactTableFilters({
  searchTerm,
  onSearchTermChange,
  showSearch = true,
  filters,
  enabledFilterKeys,
  onEnabledFilterKeysChange,
  values,
  onValueChange,
  onClearFilter,
  onClearAll,
}: CompactTableFiltersProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [draftKeys, setDraftKeys] = useState<string[]>(enabledFilterKeys);

  const enabledFilters = filters.filter((filter) => enabledFilterKeys.includes(filter.key));
  const activeFilterCount = filters.filter((filter) => filterHasValue(values[filter.key])).length;
  const matchingFilters = useMemo(() => {
    const term = filterSearch.trim().toLocaleLowerCase('vi');
    return term
      ? filters.filter((filter) => filter.label.toLocaleLowerCase('vi').includes(term))
      : filters;
  }, [filterSearch, filters]);

  const setDialogState = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      setDraftKeys(enabledFilterKeys);
      setFilterSearch('');
    }
  };

  const applyFilterSelection = () => {
    enabledFilterKeys
      .filter((key) => !draftKeys.includes(key))
      .forEach(onClearFilter);
    onEnabledFilterKeysChange(draftKeys);
    setDialogOpen(false);
  };

  const removeFilter = (key: string) => {
    onClearFilter(key);
    onEnabledFilterKeysChange(enabledFilterKeys.filter((item) => item !== key));
  };

  const clearAll = () => {
    onClearAll();
    onEnabledFilterKeysChange([]);
  };

  return (
    <>
      <div
        className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-lg border bg-card px-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 max-md:min-h-11"
        data-bd-inspect-label="Tìm kiếm trong danh sách"
        data-bd-group="list-toolbar"
        data-bd-compare-size="height"
      >
        {showSearch && (
          <div className="relative h-[38px] min-w-[210px] flex-1 max-md:h-[42px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Tìm kiếm trong danh sách"
              placeholder="Tìm kiếm…"
              className="h-full !min-h-0 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
            />
          </div>
        )}

        {enabledFilters.map((filter) => {
          const currentValue = values[filter.key];
          const textValue = typeof currentValue === 'string' ? currentValue : '';
          const dateValue = typeof currentValue === 'string' || !currentValue
            ? { from: '', to: '' }
            : currentValue;

          return <Popover key={filter.key}>
            <PopoverTrigger
              render={
                <Button
                  variant="secondary"
                  size="sm"
                  className="max-w-full rounded-full border border-primary/10 bg-primary/5 text-foreground hover:bg-primary/10"
                />
              }
            >
              <span className="max-w-48 truncate">
                <span className="text-muted-foreground">{filter.label}:</span>{' '}
                {getValueLabel(filter, currentValue)}
              </span>
              <ChevronDown data-icon="inline-end" />
            </PopoverTrigger>
            <PopoverContent className="w-[min(340px,calc(100vw-32px))]" align="start">
              <PopoverHeader>
                <PopoverTitle>{filter.label}</PopoverTitle>
              </PopoverHeader>

              {filter.type === 'select' && (
                <Select
                  value={textValue}
                  onValueChange={(value) => onValueChange(filter.key, value ?? '')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Chọn ${filter.label.toLocaleLowerCase('vi')}`} />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectGroup>
                      {(filter.options ?? []).map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}

              {filter.type === 'text' && (
                <Input
                  autoFocus
                  aria-label={filter.label}
                  placeholder={`Nhập ${filter.label.toLocaleLowerCase('vi')}`}
                  value={textValue}
                  onChange={(event) => onValueChange(filter.key, event.target.value)}
                />
              )}

              {filter.type === 'month' && (
                <Input
                  type="month"
                  aria-label={filter.label}
                  value={textValue}
                  onChange={(event) => onValueChange(filter.key, event.target.value)}
                />
              )}

              {filter.type === 'date_range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${filter.key}-from`}>Từ ngày</Label>
                    <Input
                      id={`${filter.key}-from`}
                      type="date"
                      value={dateValue.from}
                      onChange={(event) => onValueChange(filter.key, {
                        from: event.target.value,
                        to: dateValue.to,
                      })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${filter.key}-to`}>Đến ngày</Label>
                    <Input
                      id={`${filter.key}-to`}
                      type="date"
                      value={dateValue.to}
                      onChange={(event) => onValueChange(filter.key, {
                        from: dateValue.from,
                        to: event.target.value,
                      })}
                    />
                  </div>
                </div>
              )}

              <Button variant="ghost" size="sm" className="self-start text-destructive" onClick={() => removeFilter(filter.key)}>
                <X data-icon="inline-start" />
                Bỏ bộ lọc
              </Button>
            </PopoverContent>
          </Popover>;
        })}

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearAll}>
            Xóa tất cả
          </Button>
        )}
      </div>

      <Button
        variant="outline"
        className="h-10 shrink-0"
        data-bd-group="list-toolbar"
        data-bd-compare-size="height"
        onClick={() => setDialogState(true)}
      >
        <Filter data-icon="inline-start" />
        Bộ lọc
        <Badge variant="secondary" className="min-w-5 justify-center px-1.5">{activeFilterCount}</Badge>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogState}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm bộ lọc</DialogTitle>
            <DialogDescription>Chọn các bộ lọc cần hiển thị trên thanh danh sách.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Tìm bộ lọc"
                placeholder="Tìm bộ lọc…"
                className="pl-8"
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
              />
            </div>

            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {matchingFilters.map((filter) => {
                const checked = draftKeys.includes(filter.key);
                return (
                  <Label key={filter.key} htmlFor={`filter-option-${filter.key}`} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted">
                    <Checkbox
                      id={`filter-option-${filter.key}`}
                      checked={checked}
                      onCheckedChange={(nextChecked) => setDraftKeys((current) =>
                        nextChecked
                          ? [...new Set([...current, filter.key])]
                          : current.filter((key) => key !== filter.key)
                      )}
                    />
                    <span>{filter.label}</span>
                  </Label>
                );
              })}
              {matchingFilters.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Không tìm thấy bộ lọc phù hợp.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={applyFilterSelection}>Áp dụng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
