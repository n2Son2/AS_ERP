import React, { useContext, useState } from 'react';
import { ConfigSourceContext } from '@/lib/useScreenConfig';
import { ScreenConfig } from '../../../dynamic';
import { DynamicTable } from '../DynamicTable';
import { DynamicForm } from '../DynamicForm';
import { RolePermissionSheet } from '@/modules/system/system.roles/index';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, Home } from 'lucide-react';

interface DynamicScreenProps {
  config: ScreenConfig;
  moduleTitle: string;
}

export const DynamicScreen: React.FC<DynamicScreenProps> = ({ config, moduleTitle }) => {
  const source = useContext(ConfigSourceContext);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isPermissionSheetOpen, setIsPermissionSheetOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [filterEditingItem, setFilterEditingItem] = useState<any>(null);
  const [permissionRole, setPermissionRole] = useState<any>(null);

  const handleAdd = () => {
    setEditingItem(null);
    setIsViewOnly(false);
    setIsSheetOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsViewOnly(false);
    setIsSheetOpen(true);
  };

  const handleView = (item: any) => {
    setEditingItem(item);
    setIsViewOnly(true);
    setIsSheetOpen(true);
  };

  const handleConfigFilter = (item: any) => {
    setFilterEditingItem(item);
    setIsFilterSheetOpen(true);
  };

  const handlePermissionMatrix = (role: any) => {
    setPermissionRole(role);
    setIsPermissionSheetOpen(true);
  };

  const handleSuccess = () => {
    setIsSheetOpen(false);
    setIsFilterSheetOpen(false);
    setIsPermissionSheetOpen(false);
    setEditingItem(null);
    setFilterEditingItem(null);
    setPermissionRole(null);
  };

  return (
    <div className="space-y-6">
      {source === 'json' && config.table_name === 'app_functions' &&
        <p className="text-sm text-slate-500">Ứng dụng đang dùng cấu hình JSON. Các bản ghi bên dưới chỉ áp dụng khi chọn nguồn cấu hình Supabase trong Cài đặt.</p>}
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span>{moduleTitle}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-blue-600 font-medium">{config.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <Tabs defaultValue="list" className="w-auto">
          <TabsList className="bg-white border">
            <TabsTrigger value="list" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">Danh sách</TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">Thống kê</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <DynamicTable 
        config={config} 
        onEdit={handleEdit} 
        onAdd={handleAdd}
        onView={handleView}
        onConfigFilter={source === 'supabase' ? handleConfigFilter : undefined}
        onPermissionMatrix={handlePermissionMatrix}
      />

      {/* Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent style={{ width: 'min(100vw, max(800px, 50vw))', minWidth: 'min(800px, 100vw)', maxWidth: '100vw' }} className="flex flex-col h-full p-0 gap-0">
          <SheetHeader className="p-6 border-b border-slate-100 bg-white">
            <SheetTitle className="text-xl font-bold text-slate-800">
              {isViewOnly ? `Chi tiết ${config.title}` : editingItem ? `Chỉnh sửa ${config.title}` : `Thêm mới ${config.title}`}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <DynamicForm 
              table_name={config.table_name}
              fields={config.fields}
              initialData={editingItem}
              readOnly={isViewOnly}
              onSuccess={handleSuccess}
              onCancel={() => setIsSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Filter Configuration Sheet */}
      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent style={{ width: 'min(100vw, max(800px, 50vw))', minWidth: 'min(800px, 100vw)', maxWidth: '100vw' }} className="flex flex-col h-full p-0 gap-0">
          <SheetHeader className="p-6 border-b border-slate-100 bg-white">
            <SheetTitle className="text-xl font-bold text-slate-800">
              Cấu hình bộ lọc: {filterEditingItem?.title}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <DynamicForm 
              table_name="app_functions"
              fields={[{ 
                name: 'filters', 
                label: 'Cấu hình bộ lọc (JSON)', 
                type: 'textarea', 
                required: true,
                placeholder: '[{"key": "status", "label": "Trạng thái", "type": "select", "options": ["A", "B"]}]'
              }]}
              initialData={filterEditingItem}
              onSuccess={handleSuccess}
              onCancel={() => setIsFilterSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Role Permission Sheet */}
      {config.id === 'roles' && (
        <RolePermissionSheet 
          role={permissionRole}
          open={isPermissionSheetOpen}
          onOpenChange={setIsPermissionSheetOpen}
          onSuccess={handleSuccess}
          onCancel={() => setIsPermissionSheetOpen(false)}
        />
      )}
    </div>
  );
};
