import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Check, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loginToEVN } from '../services/evnService';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      const loginEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@sonanh.com`;
      const isDemoAccount = (cleanEmail === 'phuonganh' || cleanEmail === 'phuonganh@sonanh.com') && cleanPassword === '@tho2532024';

      // Special handling for Super Admin account
      if (isDemoAccount) {
        // Attempt sign in with Supabase
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: cleanPassword,
        });

        if (signInError) {
          console.log('Supabase sign-in note for demo admin:', signInError.message);
          // Try sign up if not created in Supabase yet
          supabase.auth.signUp({
            email: loginEmail,
            password: cleanPassword,
            options: { data: { full_name: 'Phương Anh', role: 'Super Admin' } }
          }).catch(err => console.log('Signup fallback info:', err));
        }

        // Always set demo admin session for Super Admin so login never fails
        localStorage.setItem('demo_admin_session', 'true');
        loginToEVN().catch((err) => console.log('EVN login note:', err));
        toast.success('Đăng nhập Super Admin thành công!');
        onLoginSuccess();
        return;
      }

      // Normal user sign in
      let { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: cleanPassword,
      });

      if (signInError) {
        let msg = signInError.message;
        if (msg.includes('Invalid login credentials')) {
          msg = 'Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
        } else if (msg.includes('Email not confirmed')) {
          msg = 'Email chưa được xác nhận. Vui lòng kiểm tra lại.';
        }
        throw new Error(msg);
      }
      
      localStorage.removeItem('demo_admin_session');
      toast.success('Đăng nhập thành công!');
      onLoginSuccess();
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Các phân hệ trong một không gian thống nhất',
    'Tra cứu và quản lý dữ liệu tập trung',
    'Cấu hình linh hoạt theo nhu cầu sử dụng'
  ];

  return (
    <div className="erp-login flex min-h-screen bg-white">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 relative overflow-hidden flex-col justify-center px-16">
        {/* Background blobs/patterns */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 space-y-12 py-12">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-white leading-tight">
              Không gian làm việc <br />
              <span className="text-blue-500">kết nối & hiệu quả</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-md leading-relaxed">
              Truy cập các phân hệ, quản lý dữ liệu và điều phối công việc trong một giao diện tập trung.
            </p>
          </div>

          <div className="space-y-6">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span className="text-slate-300 font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-10 sm:px-12 xl:px-24">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Chào mừng trở lại</h2>
            <p className="text-slate-500">Nhập thông tin đăng nhập để truy cập vào tài khoản tập trung của bạn.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between gap-2 text-xs text-blue-900">
              <div>
                <span className="font-bold block text-blue-950">Tài khoản Super Admin:</span>
                <span className="font-mono text-slate-700">phuonganh</span> / <span className="font-mono text-slate-700">@tho2532024</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail('phuonganh');
                  setPassword('@tho2532024');
                  toast.success('Đã điền tự động tài khoản phuonganh!');
                }}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shrink-0 transition-colors"
              >
                Nhập nhanh
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Tài khoản hoặc Email <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="email"
                autoComplete="username"
                placeholder="Nhập phuonganh hoặc email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Mật khẩu <span className="text-rose-500">*</span>
                </Label>
                <button type="button" className="text-xs font-bold text-blue-600 hover:underline">
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-10 border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="remember" 
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
              />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">
                Ghi nhớ đăng nhập
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/25 gap-2 transition-all"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Hoặc đăng nhập bằng</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 border-slate-200 hover:bg-slate-50 gap-3 text-slate-700 font-medium"
            onClick={() => toast.info('Chức năng đang được phát triển')}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </Button>

          <p className="text-center text-sm text-slate-500">
            Bạn chưa có tài khoản?{' '}
            <button className="text-blue-600 font-bold hover:underline">Đăng ký ngay</button>
          </p>

          <div className="pt-8 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
              © 2026 sonanh. Bảo mật • Điều khoản sử dụng
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
