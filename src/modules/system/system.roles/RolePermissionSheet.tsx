import React from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from '@/components/ui/sheet';
import { PermissionMatrix } from '@/components/PermissionMatrix';

export interface RolePermissionSheetProps {
  /** Đối tượng vai trò đang được chọn để phân quyền (ví dụ { id, name, ... }) */
  role: any | null;
  /** Trạng thái đóng/mở Sheet */
  open: boolean;
  /** Callback thay đổi trạng thái đóng/mở Sheet */
  onOpenChange: (open: boolean) => void;
  /** Callback khi lưu phân quyền thành công */
  onSuccess?: () => void;
  /** Callback khi hủy thao tác */
  onCancel?: () => void;
}

/**
 * RolePermissionSheet - Sheet phân quyền vai trò chuyên biệt cho module system (roles)
 */
export const RolePermissionSheet: React.FC<RolePermissionSheetProps> = ({
  role,
  open,
  onOpenChange,
  onSuccess,
  onCancel,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[95vw] lg:max-w-[1200px] flex flex-col h-full p-0 gap-0">
        <SheetHeader className="p-6 border-b border-slate-100 bg-white">
          <SheetTitle className="text-xl font-bold text-slate-800">
            Phân quyền vai trò: {role?.name}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden p-6">
          <PermissionMatrix 
            roleId={role?.id}
            onSuccess={onSuccess}
            onCancel={onCancel || (() => onOpenChange(false))}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
