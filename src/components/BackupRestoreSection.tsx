import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Upload,
  Database,
  RefreshCw,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sparkles,
  Loader2,
  HardDrive,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  exportAllTablesToJson,
  analyzeBackupJson,
  restoreTablesFromJson,
  getTablesOverview,
  BackupTableInfo,
  BackupFileStructure,
  RestoreProgress,
  RestoreResult
} from '@/services/backupService';

export const BackupRestoreSection: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Overview stats
  const [tablesOverview, setTablesOverview] = useState<BackupTableInfo[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');

  // Import / Inspection Dialog State
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<BackupFileStructure | null>(null);
  const [analyzedTables, setAnalyzedTables] = useState<BackupTableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [fileName, setFileName] = useState('');

  // Restore Execution State
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

  // Load overview stats on mount
  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      const data = await getTablesOverview();
      setTablesOverview(data);
    } catch (err) {
      console.error('Error loading tables overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const totalCurrentRecords = tablesOverview.reduce((acc, t) => acc + t.count, 0);

  // Handle Export All Tables
  const handleExport = async () => {
    setIsExporting(true);
    setExportProgressText('Đang khởi tạo gói dữ liệu...');
    try {
      const res = await exportAllTablesToJson((tbl, idx, total) => {
        setExportProgressText(`Đang trích xuất ${tbl} (${idx}/${total})...`);
      });
      toast.success(`Đã xuất toàn bộ dữ liệu (${res.totalRecords} bản ghi) thành công! File: ${res.fileName}`);
      loadOverview();
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error('Lỗi khi xuất dữ liệu: ' + (err.message || 'Không thể tạo file JSON'));
    } finally {
      setIsExporting(false);
      setExportProgressText('');
    }
  };

  // Handle JSON File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        toast.error('Không thể đọc nội dung file');
        return;
      }

      const analysis = analyzeBackupJson(content);
      if (!analysis.valid || !analysis.data) {
        toast.error(analysis.error || 'File JSON không đúng định dạng sao lưu');
        return;
      }

      setParsedBackup(analysis.data);
      setAnalyzedTables(analysis.tablesSummary);
      setSelectedTables(analysis.tablesSummary.map(t => t.tableName));
      setIsInspectOpen(true);
    };

    reader.onerror = () => {
      toast.error('Lỗi khi đọc file máy tính');
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Toggle Table Selection in Restore Dialog
  const toggleSelectTable = (tName: string) => {
    setSelectedTables(prev =>
      prev.includes(tName) ? prev.filter(t => t !== tName) : [...prev, tName]
    );
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedTables(analyzedTables.map(t => t.tableName));
    } else {
      setSelectedTables([]);
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!parsedBackup || selectedTables.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 bảng dữ liệu để khôi phục');
      return;
    }

    setIsRestoring(true);
    try {
      const result = await restoreTablesFromJson(
        parsedBackup,
        selectedTables,
        restoreMode,
        (progress) => {
          setRestoreProgress(progress);
        }
      );

      setRestoreResult(result);
      setIsInspectOpen(false);
      setIsResultOpen(true);

      // Invalidate all query caches
      queryClient.invalidateQueries();
      toast.success(`Đã khôi phục thành công ${result.totalRestored} bản ghi!`);
      loadOverview();
    } catch (err: any) {
      console.error('Restore error:', err);
      toast.error('Lỗi trong quá trình khôi phục: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input for JSON Restore */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Backup & Restore Card */}
      <Card className="shadow-sm border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/15 to-blue-50/25">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2.5 text-indigo-950 font-bold">
                <Database className="h-5 w-5 text-indigo-600" />
                Sao lưu & Khôi phục Dữ liệu (JSON Backup & Restore)
              </CardTitle>
              <CardDescription className="text-slate-600 mt-1">
                Xuất toàn bộ cơ sở dữ liệu các bảng thành file JSON dự phòng an toàn hoặc khôi phục dữ liệu từ file JSON đã tải về bất kỳ lúc nào.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadOverview}
              disabled={loadingOverview || isExporting}
              className="h-9 gap-1.5 bg-white hover:bg-slate-50 border-slate-300 text-xs shrink-0 self-start sm:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${loadingOverview ? 'animate-spin' : ''}`} />
              Làm mới thống kê
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Action Hub - 2 Big Operation Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Block */}
            <div className="p-5 rounded-xl border border-indigo-100 bg-white/90 shadow-sm flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      <Download className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Xuất toàn bộ dữ liệu</h4>
                      <p className="text-[11px] text-slate-500">Tải về file sao lưu .JSON chứa toàn bộ bảng</p>
                    </div>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                    {totalCurrentRecords} bản ghi
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Đóng gói tất cả dữ liệu: Nhân sự, Chấm công, Bộ phận, Danh mục, Giao dịch tài chính, Cấu hình chức năng và cài đặt vào 1 file duy nhất.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-sm"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{exportProgressText || 'Đang đóng gói dữ liệu...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Tải file JSON Sao lưu Toàn bộ</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Import / Restore Block */}
            <div className="p-5 rounded-xl border border-emerald-100 bg-white/90 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Khôi phục / Restore từ JSON</h4>
                      <p className="text-[11px] text-slate-500">Chọn file .JSON để nạp lại dữ liệu</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                    Xem trước & Chọn bảng
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Tải lên file JSON dự phòng để khôi phục hoặc bổ sung dữ liệu vào hệ thống. Hỗ trợ chế độ Gộp thông minh (Merge) hoặc Ghi đè (Replace).
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-11 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-800 font-bold text-xs gap-2"
                >
                  <FileJson className="h-4 w-4 text-emerald-600" />
                  <span>Chọn File JSON để Khôi phục</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Database Live Tables Grid Overview */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                Tổng quan dữ liệu hiện có trong hệ thống ({tablesOverview.length} bảng)
              </h4>
              <span className="text-xs font-medium text-slate-500">
                Tổng cộng: <strong className="text-indigo-700 font-bold">{totalCurrentRecords}</strong> bản ghi
              </span>
            </div>

            {loadingOverview ? (
              <div className="flex items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-100 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                <span className="text-xs text-slate-500 font-medium">Đang kiểm tra số lượng bản ghi các bảng...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {tablesOverview.map((tbl) => (
                  <div
                    key={tbl.tableName}
                    className="p-3 bg-white rounded-lg border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-2 hover:border-indigo-200 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[130px]" title={tbl.label}>
                          {tbl.label}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0 border-slate-200">
                          {tbl.module || 'HRM'}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-mono text-slate-600">
                        {tbl.tableName}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-600 font-medium">Số bản ghi:</span>
                      <span className={`font-bold font-mono ${tbl.count > 0 ? 'text-indigo-700' : 'text-slate-600'}`}>
                        {tbl.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* INSPECT & RESTORE MODAL */}
      <Dialog open={isInspectOpen} onOpenChange={setIsInspectOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 text-indigo-950 font-bold">
              <FileJson className="h-5 w-5 text-indigo-600" />
              Xem trước & Cấu hình Khôi phục Dữ liệu
            </DialogTitle>
            <DialogDescription>
              File: <strong className="text-slate-800 font-mono">{fileName}</strong> &bull; Ngày xuất:{' '}
              {parsedBackup?.exportDate ? new Date(parsedBackup.exportDate).toLocaleString('vi-VN') : 'Không rõ'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Mode selection */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">1. Chọn chế độ khôi phục:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setRestoreMode('merge')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    restoreMode === 'merge'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">Gộp & Cập nhật (Merge & Upsert)</span>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Khuyên dùng</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bổ sung các bản ghi mới và cập nhật bản ghi trùng ID mà không xóa dữ liệu khác hiện có.
                  </p>
                </div>

                <div
                  onClick={() => setRestoreMode('replace')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    restoreMode === 'replace'
                      ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">Ghi đè toàn bộ (Replace)</span>
                    <Badge className="bg-amber-100 text-amber-800 text-[10px]">Thay thế</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Xóa sạch dữ liệu cũ của các bảng được chọn và thay thế hoàn toàn bằng dữ liệu trong file backup.
                  </p>
                </div>
              </div>
            </div>

            {/* Table Selection with Bulk Actions */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700">
                  2. Chọn các bảng muốn khôi phục ({selectedTables.length}/{analyzedTables.length}):
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll(true)}
                    className="h-7 text-[11px] text-indigo-600 hover:text-indigo-700 px-2"
                  >
                    Chọn tất cả
                  </Button>
                  <span className="text-slate-300">|</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll(false)}
                    className="h-7 text-[11px] text-slate-500 hover:text-slate-700 px-2"
                  >
                    Bỏ chọn
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                {analyzedTables.map((tbl) => {
                  const isChecked = selectedTables.includes(tbl.tableName);
                  return (
                    <div
                      key={tbl.tableName}
                      onClick={() => toggleSelectTable(tbl.tableName)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-white border-indigo-200 shadow-xs'
                          : 'bg-slate-100/60 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelectTable(tbl.tableName)}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{tbl.label}</p>
                          <p className="text-[10px] font-mono text-slate-600">{tbl.tableName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px]">
                          {tbl.count} bản ghi
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Restore Execution Progress */}
            {isRestoring && restoreProgress && (
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    {restoreProgress.message}
                  </span>
                  <span>{restoreProgress.progressPercent}%</span>
                </div>
                <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${restoreProgress.progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsInspectOpen(false)}
              disabled={isRestoring}
              className="text-xs"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={handleExecuteRestore}
              disabled={isRestoring || selectedTables.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang khôi phục...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Bắt đầu Khôi phục ({selectedTables.length} bảng)</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESTORE RESULT SUMMARY DIALOG */}
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 text-emerald-800 font-bold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Kết quả Khôi phục Dữ liệu
            </DialogTitle>
            <DialogDescription>
              Đã khôi phục tổng cộng <strong className="text-slate-900">{restoreResult?.totalRestored}</strong> bản ghi vào hệ thống.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto space-y-2 py-2 custom-scrollbar">
            {restoreResult?.details.map((d, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  d.status === 'success'
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : d.status === 'warning'
                    ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                    : 'bg-rose-50/60 border-rose-200 text-rose-900'
                }`}
              >
                <div>
                  <span className="font-bold">{d.tableLabel}</span>
                  <p className="text-[11px] opacity-80">{d.message}</p>
                </div>
                <Badge variant="outline" className="font-mono bg-white font-bold">
                  {d.count}
                </Badge>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setIsResultOpen(false);
                window.location.reload();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Xác nhận & Làm mới giao diện
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
