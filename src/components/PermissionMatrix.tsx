import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, Plus, Edit2, Trash2, FileDown, Printer, ShieldCheck, Loader2 } from 'lucide-react';

interface PermissionMatrixProps {
  roleId: string;
  onSuccess?: () => void;
  onCancel: () => void;
}

interface AppFunction {
  id: string;
  title: string;
  module_group: string;
  actions: string[]; // Standard actions like ["view", "add", "edit", "delete", "export", "print"]
}

interface RolePermission {
  permission_id: string;
}

const ACTION_LIST = [
  { key: 'view', label: 'Xem', icon: Eye },
  { key: 'add', label: 'Thêm', icon: Plus },
  { key: 'edit', label: 'Sửa', icon: Edit2 },
  { key: 'delete', label: 'Xoá', icon: Trash2 },
  { key: 'export', label: 'Export', icon: FileDown },
  { key: 'print', label: 'In', icon: Printer }
];

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({ roleId, onSuccess, onCancel }) => {
  const [functions, setFunctions] = useState<AppFunction[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [roleId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all app functions
      const { data: funcData, error: funcError } = await supabase
        .from('app_functions')
        .select('id, title, module_group, actions')
        .order('module_group', { ascending: true })
        .order('title', { ascending: true });

      if (funcError) throw funcError;

      // 2. Fetch existing permissions for this role
      const { data: permData, error: permError } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleId);

      if (permError) throw permError;

      setFunctions(funcData || []);
      setPermissions(new Set(permData?.map(p => p.permission_id) || []));
    } catch (error: any) {
      toast.error('Lỗi khi tải dữ liệu phân quyền: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (funcId: string, action: string) => {
    const permId = `${funcId}:${action}`;
    const newPermissions = new Set(permissions);
    if (newPermissions.has(permId)) {
      newPermissions.delete(permId);
    } else {
      newPermissions.add(permId);
    }
    setPermissions(newPermissions);
  };

  const toggleRow = (funcId: string) => {
    const allRowPerms = ACTION_LIST.map(a => `${funcId}:${a.key}`);
    const isAllChecked = allRowPerms.every(p => permissions.has(p));
    
    const newPermissions = new Set(permissions);
    if (isAllChecked) {
      allRowPerms.forEach(p => newPermissions.delete(p));
    } else {
      allRowPerms.forEach(p => newPermissions.add(p));
    }
    setPermissions(newPermissions);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Prepare unique permission IDs and their display names
      const selectedPerms = Array.from(permissions);
      
      if (selectedPerms.length > 0) {
        // Ensure all these permission IDs exist in the 'permissions' table first
        // to avoid foreign key violations.
        const permissionsToEnsure = selectedPerms.map(perm => {
          const permId = perm as string;
          const [funcId, actionKey] = permId.split(':');
          const func = functions.find(f => f.id === funcId);
          const actionLabel = ACTION_LIST.find(a => a.key === actionKey)?.label || actionKey;
          return {
            id: permId,
            name: `${func?.title || funcId}: ${actionLabel}`,
            module: func?.module_group || 'System'
          };
        });

        const { error: ensureError } = await supabase
          .from('permissions')
          .upsert(permissionsToEnsure, { onConflict: 'id' });

        if (ensureError) throw ensureError;
      }

      // 2. Delete all existing permissions for this role
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (deleteError) throw deleteError;

      // 3. Insert new permissions
      if (selectedPerms.length > 0) {
        const insertData = selectedPerms.map(permId => ({
          role_id: roleId,
          permission_id: permId
        }));

        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(insertData);

        if (insertError) throw insertError;
      }

      toast.success('Cập nhật phân quyền thành công');
      onSuccess?.();
    } catch (error: any) {
      toast.error('Lỗi khi lưu phân quyền: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Đang tải bảng phân quyền...</p>
      </div>
    );
  }

  // Group functions by module_group
  const groupedFunctions = functions.reduce<Record<string, AppFunction[]>>((acc, func) => {
    const group = func.module_group || 'CHƯA PHÂN NHÓM';
    if (!acc[group]) acc[group] = [];
    acc[group].push(func);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl">
      <div className="flex-1 overflow-auto custom-scrollbar">
        <Table className="border-collapse">
          <TableHeader className="bg-slate-900 sticky top-0 z-10 hover:bg-slate-900 border-none">
            <TableRow className="border-none hover:bg-slate-900">
              <TableHead className="text-white font-bold px-6 py-4 min-w-[280px]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-400" />
                  <span>Cấu hình chức năng</span>
                </div>
              </TableHead>
              <TableHead className="text-center text-white w-20 px-0">
                <div className="flex flex-col items-center justify-center h-full gap-1">
                  <div className="h-5 flex items-center justify-center italic text-[10px] text-slate-400">All</div>
                  <span className="text-[10px] uppercase tracking-wider font-bold">Tất cả</span>
                </div>
              </TableHead>
              {ACTION_LIST.map(action => (
                <TableHead key={action.key} className="text-center text-white w-24 px-0">
                  <div className="flex flex-col items-center justify-center h-full gap-1 p-2">
                    <action.icon className="h-4 w-4 text-blue-400" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">{action.label}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedFunctions).map(([group, funcs]) => (
              <React.Fragment key={group}>
                <TableRow className="bg-slate-100/80 hover:bg-slate-100/80 border-y border-slate-200">
                  <TableCell colSpan={ACTION_LIST.length + 2} className="py-2 px-6 text-slate-600 font-bold text-[11px] uppercase tracking-[0.2em]">
                    {group}
                  </TableCell>
                </TableRow>
                {(funcs as AppFunction[]).map((func: AppFunction) => (
                  <TableRow key={func.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100 group">
                    <TableCell className="py-3 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{func.title}</span>
                        <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">{func.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-0">
                      <div className="flex items-center justify-center h-14">
                        <Checkbox 
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          checked={ACTION_LIST.every(a => permissions.has(`${func.id}:${a.key}`))}
                          onCheckedChange={() => toggleRow(func.id)}
                        />
                      </div>
                    </TableCell>
                    {ACTION_LIST.map(action => (
                      <TableCell key={action.key} className="p-0">
                        <div className="flex items-center justify-center h-14 border-l border-slate-50">
                          <Checkbox 
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            checked={permissions.has(`${func.id}:${action.key}`)}
                            onCheckedChange={() => togglePermission(func.id, action.key)}
                          />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Hủy bỏ</Button>
        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 gap-2 min-w-[120px]" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {saving ? 'Đang lưu...' : 'Lưu quyền'}
        </Button>
      </div>
    </div>
  );
};
