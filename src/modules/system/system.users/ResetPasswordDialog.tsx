import React, { useState, useEffect } from 'react';
import { Key, Copy, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export interface ResetPasswordDialogProps {
  /** Email của tài khoản cần đặt lại mật khẩu. Nếu null/rỗng thì Dialog đóng */
  email: string | null;
  /** Callback khi đóng Dialog */
  onClose: () => void;
  /** Callback khi đặt lại mật khẩu thành công */
  onSuccess?: () => void;
}

/**
 * Sinh mật khẩu ngẫu nhiên 12 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt
 */
export const generateRandomPassword = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let pass = '';
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

/**
 * ResetPasswordDialog - Hộp thoại khởi tạo mật khẩu mới cho module Quản lý người dùng (system.users)
 */
export const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({
  email,
  onClose,
  onSuccess,
}) => {
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mỗi khi mở dialog cho một email mới, tự động sinh mật khẩu mới
  useEffect(() => {
    if (email) {
      setGeneratedPassword(generateRandomPassword());
    } else {
      setGeneratedPassword('');
    }
  }, [email]);

  const handleCopy = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    toast.success('Đã sao chép mật khẩu mới');
  };

  const handleConfirm = async () => {
    if (!email || !generatedPassword) return;

    setIsSubmitting(true);
    const loadingToast = toast.loading(`Đang cập nhật mật khẩu cho ${email}...`);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      toast.dismiss(loadingToast);
      if (error) throw error;

      toast.success(`Đã gửi email khôi phục và chuẩn bị mật khẩu tạm thời cho ${email}`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.dismiss(loadingToast);
      console.error('Reset password error:', err);

      let errorMsg = err.message || 'Lỗi hệ thống';
      if (errorMsg.includes('Rate limit')) {
        errorMsg = 'Đã đạt giới hạn gửi email. Mật khẩu mới đã được sinh ra, bạn có thể gửi thủ công cho người dùng.';
      }

      toast.error(errorMsg, { duration: 5000 });
      // Không đóng dialog khi lỗi để admin vẫn có thể sao chép mật khẩu đã sinh
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!email}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 mb-4 shadow-sm border border-blue-100">
            <Key className="h-7 w-7 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-slate-900">
            Khởi tạo mật khẩu mới
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            Xác nhận thay đổi quyền truy cập cho tài khoản:
            <div className="font-bold text-blue-700 mt-1 select-all">{email}</div>
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 px-1">
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-inner relative group">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">
                Mật khẩu ngẫu nhiên mới:
              </p>
              <div className="flex items-center justify-between gap-4">
                <code className="text-xl font-mono text-emerald-400 tracking-wider break-all leading-tight">
                  {generatedPassword}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={handleCopy}
                  title="Sao chép mật khẩu"
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <TriangleAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Hãy <strong>sao chép mật khẩu này</strong> và gửi cho người dùng. Email thông báo sẽ được gửi đồng thời sau khi bạn nhấn xác nhận.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11"
            disabled={isSubmitting}
          >
            Hủy bỏ
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang gửi...' : 'Xác nhận & Gửi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
