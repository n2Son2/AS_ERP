import React, { useState, useEffect } from 'react';
import { logger, AppLog } from '@/lib/logger';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  RotateCcw, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Clock,
  Home
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { aiService } from '@/services/aiService';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Sparkles, Copy, Check, TriangleAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const LogScreen = () => {
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { text: string; loading: boolean }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadLogs = () => {
    setLogs(logger.getLogs());
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleClear = async () => {
    setShowClearConfirm(false);
    setIsClearing(true);

    const clearAction = async () => {
      // 1. Dọn cục bộ ngay lập tức
      logger.clear();
      setLogs([]);
      setAiSuggestions({});

      // 2. Dọn bảng audit_logs trên Supabase
      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .not('id', 'is', null);
      
      if (error) throw error;
      
      // Chờ một chút để UI cập nhật mượt mà
      await new Promise(resolve => setTimeout(resolve, 300));
      loadLogs();
      return 'Đã dọn sạch toàn bộ nhật ký thành công!';
    };

    toast.promise(clearAction(), {
      loading: 'Đang dọn dẹp nhật ký...',
      success: (data) => {
        setIsClearing(false);
        return data;
      },
      error: (err) => {
        setIsClearing(false);
        return `Có lỗi khi dọn nhật ký server: ${err.message || 'Lỗi không xác định'}`;
      },
    });
  };

  const handleGetAiSuggestion = async (log: AppLog) => {
    if (aiSuggestions[log.id]?.loading) return;

    setAiSuggestions(prev => ({
      ...prev,
      [log.id]: { text: prev[log.id]?.text || '', loading: true }
    }));

    try {
      const suggestion = await aiService.getFixSuggestion(log.message, log.stack, log.context);
      setAiSuggestions(prev => ({
        ...prev,
        [log.id]: { text: suggestion, loading: false }
      }));
    } catch (error) {
      toast.error('Không thể lấy gợi ý từ AI');
      setAiSuggestions(prev => ({
        ...prev,
        [log.id]: { ...prev[log.id], loading: false }
      }));
    }
  };

  const handleCopySuggestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã sao chép gợi ý');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelBadge = (level: AppLog['level']) => {
    switch (level) {
      case 'error':
        return <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200">Error</Badge>;
      case 'warn':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Warn</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Info</Badge>;
    }
  };

  const getLevelIcon = (level: AppLog['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span>Hệ thống</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-blue-600 font-medium">Nhật ký lỗi</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nhật ký lỗi</h1>
          <p className="text-sm text-slate-500">Xem và quản lý các sự cố phát sinh trong hệ thống</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={loadLogs}
            className="gap-2 h-10 border-slate-200"
          >
            <RotateCcw className="h-4 w-4" />
            Làm mới
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowClearConfirm(true)}
            disabled={isClearing}
            className="gap-2 h-10 text-rose-600 border-rose-100 hover:bg-rose-50 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
            Xóa toàn bộ
          </Button>
        </div>
      </div>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4">
              <TriangleAlert className="h-6 w-6 text-rose-600" />
            </div>
            <DialogTitle className="text-center text-xl">Xác nhận xóa sạch nhật ký?</DialogTitle>
            <DialogDescription className="text-center py-2">
              Thao tác này sẽ xóa mọi vết của lỗi trong trình duyệt và cả nhật ký hệ thống trên máy chủ. Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)} className="flex-1">
              Hủy bỏ
            </Button>
            <Button variant="destructive" onClick={handleClear} className="flex-1 bg-rose-600 hover:bg-rose-700">
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-48 font-semibold">Thời gian</TableHead>
              <TableHead className="w-24 font-semibold">Cấp độ</TableHead>
              <TableHead className="font-semibold">Nội dung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-slate-200" />
                    <p>Không có nhật ký nào được ghi nhận.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <React.Fragment key={log.id}>
                  <TableRow 
                    className={cn(
                      "cursor-pointer transition-colors",
                      expandedId === log.id ? "bg-slate-50" : "hover:bg-slate-50/50"
                    )}
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <TableCell>
                      {expandedId === log.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getLevelBadge(log.level)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          {getLevelIcon(log.level)}
                          <span className="truncate max-w-md">{log.message}</span>
                        </div>
                        {log.level === 'error' && (
                          <div className={cn(
                            "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all",
                            aiSuggestions[log.id]?.text 
                              ? "bg-blue-50 text-blue-600 border-blue-200" 
                              : "bg-slate-50 text-slate-400 border-slate-200 group-hover:text-blue-500 group-hover:border-blue-200"
                          )}>
                            <Sparkles className={cn("h-3 w-3", aiSuggestions[log.id]?.loading && "animate-spin")} />
                            {aiSuggestions[log.id]?.loading ? "ĐANG ANALYZE..." : aiSuggestions[log.id]?.text ? "ĐÃ CÓ GỢI Ý" : "AI FIX"}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow className="bg-slate-50/50 border-t-0 hover:bg-slate-50/50">
                      <TableCell colSpan={4} className="px-12 py-4">
                        <div className="space-y-4">
                          {log.stack && (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stack Trace</p>
                              <pre className="text-xs p-4 bg-slate-900 text-blue-300 rounded-lg overflow-x-auto custom-scrollbar leading-relaxed">
                                {log.stack}
                              </pre>
                            </div>
                          )}
                          {log.context && (
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Context Data</p>
                              <pre className="text-xs p-4 bg-slate-100 text-slate-700 rounded-lg overflow-x-auto border border-slate-200 font-mono">
                                {JSON.stringify(log.context, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* AI Suggestion Section */}
                          <div className={cn(
                            "rounded-lg border overflow-hidden",
                            aiSuggestions[log.id]?.text ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-slate-50/50 p-4"
                          )}>
                            {!aiSuggestions[log.id]?.text && !aiSuggestions[log.id]?.loading ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Sparkles className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm font-medium">Bạn muốn AI gợi ý cách sửa lỗi này?</span>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGetAiSuggestion(log);
                                  }}
                                  className="h-8 gap-2 bg-white border-blue-200 text-blue-600 hover:bg-blue-50"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Gợi ý sửa lỗi (AI)
                                </Button>
                               </div>
                            ) : (
                              <div>
                                <div className="flex items-center justify-between px-4 py-2 bg-blue-100/50 border-b border-blue-200">
                                  <div className="flex items-center gap-2 text-blue-800">
                                    <Sparkles className="h-4 w-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Gợi ý sửa lỗi từ AI</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {aiSuggestions[log.id]?.loading ? (
                                      <div className="flex items-center gap-2 text-blue-600 text-xs italic">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Đang phân tích...
                                      </div>
                                    ) : (
                                      <>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          onClick={() => handleCopySuggestion(log.id, aiSuggestions[log.id].text)}
                                          className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-200/50"
                                        >
                                          {copiedId === log.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          onClick={() => handleGetAiSuggestion(log)}
                                          className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-200/50"
                                        >
                                          <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="p-4 prose prose-sm prose-slate max-w-none">
                                  {aiSuggestions[log.id]?.loading && !aiSuggestions[log.id]?.text ? (
                                    <div className="space-y-2 py-2">
                                      <div className="h-3 w-full bg-blue-100/50 rounded animate-pulse"></div>
                                      <div className="h-3 w-5/6 bg-blue-100/50 rounded animate-pulse"></div>
                                      <div className="h-3 w-4/6 bg-blue-100/50 rounded animate-pulse"></div>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-slate-800 leading-relaxed markdown-body">
                                      <ReactMarkdown>{aiSuggestions[log.id]?.text}</ReactMarkdown>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
