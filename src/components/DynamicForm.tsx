import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FormField } from '../../dynamic';
import { supabase } from '@/lib/supabase';
import { invalidateTableMutation } from '@/lib/configCache';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

import { SearchableSelect } from './SearchableSelect';
import { DynamicSelect } from './DynamicSelect';

import { Textarea } from '@/components/ui/textarea';
import { Trash2, Save, X, Plus, Edit2, Sparkles, Send, Loader2 } from 'lucide-react';
import { ai, MODELS } from '@/lib/gemini';

const TypeSchema = {
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
  STRING: 'STRING',
  BOOLEAN: 'BOOLEAN',
} as const;

interface DynamicFormProps {
  table_name: string;
  fields: FormField[];
  initialData?: any;
  readOnly?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

import { Checkbox } from '@/components/ui/checkbox';
import { Copy, History, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export const DynamicForm: React.FC<DynamicFormProps> = ({ 
  table_name, 
  fields, 
  initialData, 
  readOnly = false,
  onSuccess, 
  onCancel 
}) => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: useMemo(() => {
      if (!initialData) {
        return fields.reduce((acc, field) => ({
          ...acc,
          [field.name]: field.defaultValue !== undefined ? field.defaultValue : (field.type === 'boolean' ? false : '')
        }), {});
      }
      
      const values = { ...initialData };
      fields.forEach(field => {
        if (field.type === 'textarea' && (field.name === 'columns' || field.name === 'fields' || field.name === 'filters' || field.name === 'actions')) {
          if (typeof values[field.name] === 'object') {
            values[field.name] = JSON.stringify(values[field.name], null, 2);
          }
        }
        // Ensure boolean fields are actual booleans
        if (field.type === 'boolean') {
          values[field.name] = values[field.name] === 'true' || values[field.name] === true;
        }
      });
      return values;
    }, [initialData, fields])
  });

  const [aiPrompt, setAiPrompt] = React.useState('');
  const [functionPrompt, setFunctionPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [aiSuggestion, setAiSuggestion] = React.useState<string | null>(null);
  const [jsonHistory, setJsonHistory] = React.useState<string[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);

  // Generate a unique key for history based on table and specific function ID
  const historyKey = React.useMemo(() => {
    let key = `json_history_${table_name}`;
    if (table_name === 'app_functions' && initialData?.id) {
      key += `_${initialData.id}`;
    }
    return key;
  }, [table_name, initialData?.id]);

  // Load history from localStorage
  React.useEffect(() => {
    const savedHistory = localStorage.getItem(historyKey);
    if (savedHistory) {
      try {
        setJsonHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading history:', e);
        setJsonHistory([]);
      }
    } else {
      setJsonHistory([]);
    }
  }, [historyKey]);

  const saveToHistory = (json: string) => {
    if (!json || json === '[]' || json === 'null') return;
    
    setJsonHistory(prev => {
      // Don't save if it's the same as the last one
      if (prev[0] === json) return prev;
      
      const newHistory = [json, ...prev.filter(item => item !== json)].slice(0, 10);
      localStorage.setItem(historyKey, JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleGenerateAI = async (fieldName: string) => {
    if (!aiPrompt) {
      toast.error('Vui lòng nhập yêu cầu cho AI');
      return;
    }

    setIsGenerating(true);
    try {
      const field = fields.find(f => f.name === fieldName);
      if (!field) return;

      const systemInstruction = `Bạn là một chuyên gia thiết kế hệ thống phần mềm. 
Nhiệm vụ của bạn là gợi ý cấu hình bộ lọc (filters) cho bảng dữ liệu "${table_name}".
Cấu hình phải là một mảng JSON các đối tượng.
Mỗi đối tượng có các thuộc tính:
- key: tên trường trong DB (ví dụ: status, category_id, created_at)
- label: nhãn hiển thị Tiếng Việt (ví dụ: Trạng thái, Nhóm hàng, Ngày tạo)
- type: loại input, dùng "select", "text", hoặc "date_range" (đối với bộ lọc Từ ngày - Đến ngày).
- options: (chỉ dùng nếu type là "select") mảng các chuỗi giá trị lựa chọn.
- visible: (tùy chọn) boolean để ẩn/hiện bộ lọc (mặc định true).

Lưu ý quan trọng: 
1. Hệ thống có ô tìm kiếm chung mặc định. Nếu yêu cầu "ẩn ô tìm kiếm", hãy thêm một bộ lọc giả với key là "SYSTEM_HIDE_SEARCH" và gán visible: false để người dùng biết là đã ghi nhận (hoặc đơn giản là không gợi ý thêm bộ lọc liên quan đến tìm kiếm chung).
2. Chỉ gợi ý các cột chắc chắn có trong bảng "${table_name}". Nếu có yêu cầu lọc theo thời gian, hãy ưu tiên dùng type: "date_range" với key là "created_at".

Ví dụ: [{"key": "status", "label": "Trạng thái", "type": "select", "options": ["Hoàn thành", "Đang xử lý", "Đã hủy"]}, {"key": "created_at", "label": "Thời gian", "type": "date_range", "visible": true}]`;

      const response = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: `Gợi ý cấu hình bộ lọc cho bảng "${table_name}" dựa trên yêu cầu này: ${aiPrompt}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: TypeSchema.ARRAY,
            items: {
              type: TypeSchema.OBJECT,
              properties: {
                key: { type: TypeSchema.STRING },
                label: { type: TypeSchema.STRING },
                type: { type: TypeSchema.STRING, enum: ["select", "text", "date_range"] },
                options: { type: TypeSchema.ARRAY, items: { type: TypeSchema.STRING } },
                visible: { type: TypeSchema.BOOLEAN }
              },
              required: ["key", "label", "type"]
            }
          }
        },
      });

      if (response.text) {
        const generatedFilters = JSON.parse(response.text);
        
        // Handle special AI instruction to hide search
        const hideSearchIndex = generatedFilters.findIndex((f: any) => f.key === 'SYSTEM_HIDE_SEARCH');
        if (hideSearchIndex !== -1) {
          setValue('show_search', false);
          // Remove the dummy key before setting the value
          generatedFilters.splice(hideSearchIndex, 1);
        }

        setAiSuggestion(JSON.stringify(generatedFilters, null, 2));
        toast.success('AI đã gợi ý cấu hình bộ lọc mới');
        setAiPrompt('');
      } else {
        throw new Error('Không nhận được phản hồi từ AI');
      }
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      toast.error('Lỗi khi gọi AI: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const [activeTab, setActiveTab] = React.useState('general');

  const allFields = useMemo(() => {
    if (table_name !== 'app_functions') return fields;
    
    // For app_functions, ensure sql_schema is always in fields
    const hasSqlSchema = fields.some(f => f.name === 'sql_schema');
    if (hasSqlSchema) return fields;
    
    return [
      ...fields,
      { name: 'sql_schema', label: 'SQL Schema (Supabase)', type: 'textarea', section: 'Cấu hình nâng cao' }
    ] as FormField[];
  }, [fields, table_name]);

  const handleGenerateFullFunctionAI = async () => {
    if (!functionPrompt) {
      toast.error('Vui lòng nhập mô tả chức năng');
      return;
    }
    setIsGenerating(true);
    try {
      const currentValues = watch();
      const systemInstruction = `Bạn là một chuyên gia thiết kế hệ thống ERP chạy trên React và Supabase.
Nhiệm vụ của bạn là sinh cấu hình chức năng (ScreenConfig) dựa trên yêu cầu của người dùng.
Kết quả phải là một JSON với các trường:
- id: mã định danh duy nhất (ví dụ: products)
- title: tên hiển thị (ví dụ: Quản lý sản phẩm)
- table_name: tên bảng trong database (số nhiều, ví dụ: products)
- icon: tên Lucide icon phù hợp (ví dụ: Package)
- columns: chuỗi JSON mảng các cột hiển thị (key, label, type: text/number/date/badge/boolean)
- fields: chuỗi JSON mảng các trường trong form (name, label, type, required: boolean, colSpan: 1-12)
- filters: chuỗi JSON mảng các bộ lọc (key, label, type: select/text/date_range)
- sql_schema: Mã SQL đầy đủ để tạo bảng trên Supabase, bao cả ENABLE RLS và chính sách SELECT, INSERT, UPDATE, DELETE cho public (vì đây là demo).

Lưu ý: 
1. Các trường columns, fields, filters PHẢI là chuỗi JSON đã stringify đẹp.
2. Nếu có dữ liệu hiện tại được cung cấp, hãy cố gắng giữ lại những phần hợp lý hoặc cải tiến dựa trên đó thay vì xóa sạch.`;

      const response = await ai.models.generateContent({
        model: MODELS.FLASH,
        contents: [
          { role: 'user', parts: [{ text: `Dữ liệu hiện tại: ${JSON.stringify(currentValues)}\n\nYêu cầu bổ sung/cập nhật: ${functionPrompt}` }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: TypeSchema.OBJECT,
            properties: {
              id: { type: TypeSchema.STRING },
              title: { type: TypeSchema.STRING },
              table_name: { type: TypeSchema.STRING },
              icon: { type: TypeSchema.STRING },
              columns: { type: TypeSchema.STRING },
              fields: { type: TypeSchema.STRING },
              filters: { type: TypeSchema.STRING },
              sql_schema: { type: TypeSchema.STRING }
            },
            required: ["id", "title", "table_name", "columns", "fields"]
          } as any
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        Object.keys(data).forEach(key => {
          setValue(key as any, data[key]);
        });
        toast.success('AI đã sinh cấu hình chức năng và mã SQL thành công');
      }
    } catch (error: any) {
      console.error('AI Function Generator Error:', error);
      toast.error('Lỗi khi gọi AI: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (data: any) => {
    // Only include fields that are actually in the form definition
    const filteredData: any = {};
    fields.forEach(field => {
      let value = data[field.name];
      
      // Process JSON fields if any
      if (field.type === 'textarea' && (field.name === 'columns' || field.name === 'fields' || field.name === 'filters' || field.name === 'actions')) {
        try {
          if (value && typeof value === 'string') {
            value = JSON.parse(value);
          }
        } catch (e) {
          // Keep as is if not valid JSON
        }
      }
      
      filteredData[field.name] = value;
      
      // Save to history if it's filters
      if (field.name === 'filters' && typeof value === 'object') {
        saveToHistory(JSON.stringify(value, null, 2));
      }
    });

    // Special logic for app_functions: if we have an ID but not in form, include it for upsert
    // This allows "promoting" a static screen from config.ts to a dynamic screen in DB
    const finalData = { ...filteredData };
    
    // Ensure ID is included for updates if it's not in the form fields
    if (initialData?.id && !finalData.id) {
      finalData.id = initialData.id;
    }

    try {
      if (initialData?.id) {
        // Update existing record
        const { error } = await supabase
          .from(table_name)
          .update(finalData)
          .eq('id', initialData.id);
        
        if (error) throw error;

        toast.success('Cập nhật thành công');
      } else if (finalData.id) {
        // Upsert if ID is provided but it might be new (like in app_functions promotion)
        const { error } = await supabase
          .from(table_name)
          .upsert(finalData, { onConflict: 'id' });
        
        if (error) throw error;

        toast.success('Lưu thành công');
      } else {
        // Insert new record
        const { error } = await supabase
          .from(table_name)
          .insert([finalData]);
        
        if (error) throw error;

        toast.success('Thêm mới thành công');
      }
      invalidateTableMutation(queryClient, table_name, initialData?.id ? [initialData.id] : undefined);
      onSuccess();
    } catch (error: any) {
      logger.error(`Lỗi khi lưu dữ liệu vào bảng ${table_name}`, { error, data: finalData });
      toast.error('Lỗi: ' + error.message);
    }
  };

  const formValues = watch();

  const isFieldVisible = (field: FormField) => {
    if (field.hidden) return false;
    if (!field.visibleWhen) return true;

    const targetValue = formValues[field.visibleWhen.field];
    const triggerValue = field.visibleWhen.value;

    switch (field.visibleWhen.operator) {
      case 'eq': return String(targetValue) === String(triggerValue);
      case 'neq': return String(targetValue) !== String(triggerValue);
      case 'contains': return String(targetValue).toLowerCase().includes(String(triggerValue).toLowerCase());
      case 'in': return Array.isArray(triggerValue) && triggerValue.map(String).includes(String(targetValue));
      default: return true;
    }
  };

  const sections = useMemo(() => {
    const groups: { [key: string]: FormField[] } = {};
    const sectionNames: string[] = [];
    
    allFields.forEach(field => {
      const sectionName = field.section || '_DEFAULT_';
      if (!groups[sectionName]) {
        groups[sectionName] = [];
        sectionNames.push(sectionName);
      }
      groups[sectionName].push(field);
    });
    
    return { groups, sectionNames };
  }, [allFields]);

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) return;

    try {
      const { error } = await supabase
        .from(table_name)
        .delete()
        .eq('id', initialData.id);
      
      if (error) throw error;
      toast.success('Xóa thành công');
      invalidateTableMutation(queryClient, table_name, initialData?.id ? [initialData.id] : undefined);
      onSuccess();
    } catch (error: any) {
      logger.error(`Lỗi khi xóa bản ghi trong bảng ${table_name}`, { error, id: initialData.id });
      toast.error('Lỗi: ' + error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="dynamic-form flex min-w-0 flex-col h-full bg-slate-50/20">
      {/* Tab Selector if in app_functions */}
      {table_name === 'app_functions' && !readOnly && (
        <div className="px-6 pt-4 bg-white border-b border-slate-100">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-slate-100/50 p-1 w-full sm:w-auto h-12">
              <TabsTrigger value="general" className="px-6 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                Thông tin chung
              </TabsTrigger>
              <TabsTrigger value="advanced" className="px-6 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                Cấu hình & SQL
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <Tabs value={activeTab} className="h-full">
          <TabsContent value="general" className="mt-0 p-6 space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
            {table_name === 'app_functions' && !readOnly && (
              <div className="p-5 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-blue-700">
                    <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">AI Function Architect</h3>
                      <p className="text-[10px] text-slate-500">Mô tả chức năng để AI tự động thiết kế dựa trên dữ liệu hiện tại</p>
                    </div>
                  </div>
                  {isGenerating && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-blue-100 rounded-full shadow-sm">
                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      <span className="text-[10px] font-medium text-blue-600">Đang kiến tạo...</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Textarea 
                    placeholder="Mô tả yêu cầu, ví dụ: Bổ sung thêm trường mã số thuế và thay đổi icon thành Bank..." 
                    className="bg-white border-blue-100 min-h-[80px] text-sm focus:ring-blue-500/20 transition-all resize-none shadow-sm"
                    value={functionPrompt}
                    onChange={(e) => setFunctionPrompt(e.target.value)}
                  />
                  <Button 
                    type="button"
                    onClick={handleGenerateFullFunctionAI}
                    disabled={isGenerating || !functionPrompt}
                    className="bg-blue-600 hover:bg-blue-700 h-auto px-6 flex-col gap-2 shadow-lg shadow-blue-500/20 group transition-all"
                  >
                    <Send className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Generate</span>
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-8">
              {sections.sectionNames
                .filter(name => activeTab === 'general' ? name !== 'Cấu hình nâng cao' : true)
                .map((sectionName) => (
                <div key={sectionName} className="space-y-6">
                  {sectionName !== '_DEFAULT_' && (
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{sectionName}</h3>
                      <div className="flex-1 h-[1px] bg-slate-100" />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-12 gap-x-6 gap-y-5">
                    {sections.groups[sectionName].map((field) => {
                      if (!isFieldVisible(field)) return null;
                      
                      const colSpan = Math.min(12, Math.max(4, Math.round(field.colSpan || 12)));
                      
                      return (
                        <div 
                          key={field.name} 
                          className="dynamic-form-field space-y-2"
                          style={{ '--form-field-span': colSpan } as React.CSSProperties}
                        >
                          {field.type === 'boolean' ? (
                            <div className="flex min-w-0 items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors h-full min-h-[52px]">
                              <Checkbox 
                                id={field.name}
                                className="shrink-0"
                                checked={watch(field.name)}
                                onCheckedChange={(checked) => !readOnly && setValue(field.name, checked)}
                                disabled={readOnly || field.readOnly}
                              />
                              <Label 
                                htmlFor={field.name}
                                className="min-w-0 flex-1 whitespace-normal break-words text-sm leading-5 font-semibold text-slate-700 cursor-pointer"
                              >
                                {field.label}
                              </Label>
                            </div>
                          ) : (
                            <>
                              <Label htmlFor={field.name} className="text-sm font-semibold text-slate-700">
                                {field.label} {field.required && <span className="text-rose-500">*</span>}
                              </Label>
                              
                              {field.type === 'select' ? (
                                <DynamicSelect 
                                  options={field.options}
                                  sourceTable={field.sourceTable}
                                  sourceValue={field.sourceValue}
                                  sourceLabel={field.sourceLabel}
                                  value={watch(field.name)}
                                  onChange={(val) => !readOnly && !field.readOnly && setValue(field.name, val)}
                                  placeholder={`Chọn ${field.label}`}
                                  className="w-full h-11"
                                  disabled={readOnly || field.readOnly}
                                />
                              ) : field.type === 'textarea' ? (
                                <div className="space-y-4">
                                  <div className="relative group">
                                    <Textarea 
                                      id={field.name}
                                      placeholder={field.placeholder || `Nhập ${field.label}`}
                                      className={cn(
                                        "min-h-[150px] font-mono text-xs bg-white border-slate-200 focus:ring-blue-500/20 transition-all pr-10",
                                        field.name === 'sql_schema' && "min-h-[300px] bg-slate-900 text-slate-300 border-slate-800 focus:bg-slate-950 focus:text-white"
                                      )}
                                      {...register(field.name, { required: field.required })}
                                      disabled={readOnly || field.readOnly}
                                    />
                                    {field.name === 'sql_schema' && watch(field.name) && (
                                      <div className="absolute right-2 top-2 z-10 flex gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                                          onClick={() => {
                                            navigator.clipboard.writeText(watch(field.name));
                                            toast.success('Đã sao chép mã SQL');
                                          }}
                                          title="Sao chép SQL"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                    {field.name === 'filters' && !readOnly && jsonHistory.length > 0 && (
                                      <div className="absolute right-2 top-2 z-10">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                          onClick={() => setShowHistory(!showHistory)}
                                          title="Lịch sử cấu hình"
                                        >
                                          <History className="h-4 w-4" />
                                        </Button>
                                        
                                        {showHistory && (
                                          <div className="absolute right-0 top-10 w-80 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lịch sử cấu hình (10 gần nhất)</span>
                                              <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-4 w-4" 
                                                onClick={() => setShowHistory(false)}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                            {jsonHistory.map((historyItem, idx) => (
                                              <button
                                                key={idx}
                                                type="button"
                                                className="w-full text-left p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100 transition-all group"
                                                onClick={() => {
                                                  setValue(field.name, historyItem);
                                                  setShowHistory(false);
                                                  toast.success('Đã áp dụng cấu hình từ lịch sử');
                                                }}
                                              >
                                                <pre className="text-[9px] text-slate-500 truncate font-mono">
                                                  {historyItem}
                                                </pre>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {field.name === 'filters' && !readOnly && (
                                    <div className="space-y-4">
                                      <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center gap-2 text-blue-700">
                                          <Sparkles className="h-4 w-4" />
                                          <span className="text-sm font-bold">AI Assistant - Gợi ý bộ lọc</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <Input 
                                            placeholder="Ví dụ: Gợi ý các bộ lọc cho quản lý kho hàng với trạng thái và ngày nhập..." 
                                            className="bg-white border-blue-100 h-10 flex-1"
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleGenerateAI(field.name);
                                              }
                                            }}
                                          />
                                          <Button 
                                            type="button"
                                            onClick={() => handleGenerateAI(field.name)}
                                            disabled={isGenerating || !aiPrompt}
                                            className="bg-blue-600 hover:bg-blue-700 h-10 w-10 p-0 shadow-lg shadow-blue-500/20"
                                          >
                                            {isGenerating ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Send className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>
                                        
                                        {aiSuggestion && (
                                          <div className="mt-4 p-3 bg-white border border-blue-100 rounded-lg shadow-sm animate-in zoom-in-95 duration-200">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-[10px] font-bold text-blue-600 uppercase">Gợi ý từ AI:</span>
                                              <div className="flex gap-1">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 px-2 text-[10px] gap-1 text-slate-500 hover:text-blue-600"
                                                  onClick={() => {
                                                    navigator.clipboard.writeText(aiSuggestion);
                                                    toast.success('Đã sao chép vào bộ nhớ tạm');
                                                  }}
                                                >
                                                  <Copy className="h-3 w-3" />
                                                  Sao chép
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 px-2 text-[10px] gap-1 text-blue-600 hover:bg-blue-50 font-bold"
                                                  onClick={() => {
                                                    setValue(field.name, aiSuggestion);
                                                    saveToHistory(aiSuggestion);
                                                    setAiSuggestion(null);
                                                    toast.success('Đã áp dụng gợi ý');
                                                  }}
                                                >
                                                  <Check className="h-3 w-3" />
                                                  Áp dụng
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7 text-slate-400"
                                                  onClick={() => setAiSuggestion(null)}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </div>
                                            <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto max-h-40">
                                              {aiSuggestion}
                                            </pre>
                                          </div>
                                        )}
            
                                        <p className="text-[10px] text-slate-500 italic">
                                          * AI sẽ tự động phân tích bảng "{table_name}" và yêu cầu của bạn để sinh mã cấu hình JSON.
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : field.type === 'date' ? (
                                <Input 
                                  id={field.name}
                                  type="date"
                                  className="h-11 bg-white border-slate-200 focus:ring-blue-500/20 transition-all"
                                  {...register(field.name, { required: field.required })}
                                  disabled={readOnly || field.readOnly}
                                />
                              ) : (
                                <Input 
                                  id={field.name}
                                  type={field.type}
                                  placeholder={field.placeholder || `Nhập ${field.label}`}
                                  className="h-11 bg-white border-slate-200 focus:ring-blue-500/20 transition-all"
                                  {...register(field.name, { required: field.required })}
                                  disabled={readOnly || field.readOnly}
                                />
                              )}
                            </>
                          )}
                          
                          {errors[field.name] && (
                            <p className="text-xs text-rose-500 font-medium">Trường này là bắt buộc</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="mt-0 p-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col gap-8">
              {sections.groups['Cấu hình nâng cao']?.map((field) => {
                if (!isFieldVisible(field)) return null;
                
                return (
                  <div key={field.name} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={field.name} className="text-sm font-bold text-slate-800">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </Label>
                      {field.name === 'sql_schema' && (
                        <span className="text-[10px] font-mono px-2 py-1 bg-slate-100 rounded text-slate-500 uppercase">Supabase Definition</span>
                      )}
                    </div>
                    
                    <div className="relative group">
                      <Textarea 
                        id={field.name}
                        placeholder={field.placeholder || `Cấu hình ${field.label}`}
                        className={cn(
                          "font-mono text-[11px] bg-white border-slate-200 focus:ring-blue-500/20 transition-all leading-relaxed",
                          field.name === 'sql_schema' ? "min-h-[500px] bg-slate-950 text-emerald-400 border-slate-800 focus:text-emerald-300" : "min-h-[250px]"
                        )}
                        {...register(field.name, { required: field.required })}
                        disabled={readOnly || field.readOnly}
                      />
                      
                      <div className="absolute right-3 top-3 z-10 flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800"
                          onClick={() => {
                            navigator.clipboard.writeText(watch(field.name));
                            toast.success(`Đã sao chép ${field.label}`);
                          }}
                          title={`Sao chép ${field.label}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {field.name === 'fields' && (
                      <p className="text-[10px] text-slate-500 italic">
                        * Cấu hình form JSON bao gồm: name, label, type, required (boolean), colSpan (1-12), section (tên nhóm).
                      </p>
                    )}
                  </div>
                );
              })}
              
              {!sections.groups['Cấu hình nâng cao'] && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4 border-2 border-dashed border-slate-100 rounded-2xl">
                  <Edit2 className="h-10 w-10 opacity-20" />
                  <p className="text-sm">Không có nội dung cấu hình nâng cao cho bảng này.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Fixed Footer Area */}
      {!readOnly && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 backdrop-blur-sm sticky bottom-0">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            className="h-10 px-6 bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
          >
            Hủy bỏ
          </Button>
          
          <div className="flex items-center gap-3">
            {initialData?.id && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleDelete}
                className="h-10 px-4 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </Button>
            )}
            
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="h-10 px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 gap-2"
            >
              {isSubmitting ? (
                'Đang lưu...'
              ) : initialData?.id ? (
                <><Edit2 className="h-4 w-4" /> Cập nhật</>
              ) : (
                <><Plus className="h-4 w-4" /> Thêm mới</>
              )}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
};

