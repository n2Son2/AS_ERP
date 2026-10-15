import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  ChevronDown, 
  Search, 
  Menu,
  X,
  LogOut,
  User,
  Clock,
  Calendar as CalendarIcon,
  FileText,
  FileJson,
  Database,
  Users,
  Wallet,
  List,
  HelpCircle
} from 'lucide-react';
import { APP_CONFIG } from '@/config';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useModuleNavigation, usePrefetchScreen } from '@/lib/useScreenConfig';
import { mergeNavigation } from '@/lib/screenConfig';

const Icon = ({ name, className }: { name: string; className?: string }) => {
  const icons = { Users, Wallet, List, Settings, Database, FileText, FileJson, User, Clock, LayoutDashboard };
  const LucideIcon = icons[name as keyof typeof icons] || HelpCircle;
  return <LucideIcon className={className} />;
};

const HeaderClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>
    <div className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" /><span>{format(now, 'HH:mm:ss')}</span></div>
    <div className="flex items-center gap-2 text-sm"><CalendarIcon className="h-4 w-4" /><span>{format(now, 'EEEE, dd/MM/yyyy', { locale: vi })}</span></div>
  </>;
};
export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [expandedModules, setExpandedModules] = useState<string[]>(['hrm', 'catalog', 'finance', 'system']);
  const location = useLocation();
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) setIsSidebarOpen(false);
    setSearch('');
  }, [location.pathname]);

  const { data: navigation, isError: navigationError } = useModuleNavigation();
  const prefetchScreen = usePrefetchScreen();
  const modules = useMemo(() => mergeNavigation(APP_CONFIG, navigation ?? []), [navigation]);

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const isDemo = localStorage.getItem('demo_admin_session') === 'true';
      if (isDemo) {
        setUser({
          email: 'phuonganh@sonanh.com',
          user_metadata: { full_name: 'Phương Anh', role: 'Super Admin' }
        });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      }
    };

    checkUser();



  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('demo_admin_session');
      await supabase.auth.signOut();
      window.location.reload(); // Refresh to clear state
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const isAdminEmail = user?.email === 'phuonganh@sonanh.com';
  const userDisplayName = isAdminEmail ? 'Phương Anh' : (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Người dùng');
  const userRole = isAdminEmail ? 'Quản trị viên hệ thống' : (user?.user_metadata?.role || 'Nhân viên');

  const matches = search.trim() ? modules.flatMap(module => module.screens
    .filter(screen => `${module.title} ${screen.title}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
    .map(screen => ({ ...screen, moduleId: module.id, moduleTitle: module.title }))) : [];
  const activeScreen = modules.flatMap(module => module.screens.map(screen => ({ ...screen, moduleTitle: module.title, path: `/screen/${module.id}/${screen.id}` }))).find(screen => screen.path === location.pathname);

  return (
    <div className="erp-shell flex h-dvh overflow-hidden bg-slate-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3">Đến nội dung chính</a>
      {isSidebarOpen && <button aria-label="Đóng điều hướng" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside onKeyDown={e => { if (e.key === 'Escape') setIsSidebarOpen(false); }} id="app-navigation" aria-label="Điều hướng chính" className={cn('erp-sidebar fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col lg:static', !isSidebarOpen && 'hidden lg:flex lg:w-20')}>
        <Link to="/" aria-label="AS ERP — Trang chủ" className="flex min-h-20 items-center gap-3 border-b border-slate-100 px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">AS</span>
          {isSidebarOpen && <div><p className="text-lg font-bold tracking-tight text-slate-800">AS ERP<span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">WORKSPACE</span></p><p className="mt-0.5 text-xs text-slate-500">Không gian quản trị tập trung</p></div>}
        </Link>
        <button aria-label="Đóng menu" onClick={() => setIsSidebarOpen(false)} className="mx-3 mt-2 flex min-h-11 items-center justify-center gap-2 rounded-lg text-slate-600 hover:bg-slate-50 lg:hidden"><X className="size-4" />Đóng menu</button>
        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-3">
          {isSidebarOpen && <p className="px-3 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Không gian làm việc</p>}
          <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined} title="Tổng quan" className={cn('erp-nav', location.pathname === '/' && 'is-active')}><LayoutDashboard className="size-5 shrink-0" />{isSidebarOpen && 'Tổng quan'}</Link>
          {navigationError && isSidebarOpen && <p role="status" className="px-3 py-2 text-xs text-amber-700">Không cập nhật được menu. Đang dùng cấu hình đã có.</p>}
          {modules.map(module => <div key={module.id}>
            <button title={module.title} aria-label={module.title} aria-expanded={isSidebarOpen && expandedModules.includes(module.id)} onClick={() => { if (!isSidebarOpen) setIsSidebarOpen(true); toggleModule(module.id); }} className="erp-nav w-full justify-between">
              <span className="flex min-w-0 items-center gap-3"><Icon name={module.icon || 'Folder'} className="size-5 shrink-0" />{isSidebarOpen && <span className="text-left">{module.title}</span>}</span>
              {isSidebarOpen && <ChevronDown className={cn('size-4 shrink-0 transition-transform', expandedModules.includes(module.id) && 'rotate-180')} />}
            </button>
            {isSidebarOpen && expandedModules.includes(module.id) && <div className="my-1 ml-5 space-y-1 border-l border-slate-100 pl-3">{module.screens.map(screen => <Link key={screen.id} to={`/screen/${module.id}/${screen.id}`} onMouseEnter={() => prefetchScreen(screen.id)} onFocus={() => prefetchScreen(screen.id)} aria-current={location.pathname === `/screen/${module.id}/${screen.id}` ? 'page' : undefined} className={cn('erp-nav text-sm', location.pathname === `/screen/${module.id}/${screen.id}` && 'is-active')}>{screen.title}</Link>)}</div>}
          </div>)}
          {isSidebarOpen && <p className="px-3 pt-7 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Quản trị</p>}
          <Link title="Nhật ký lỗi" to="/logs" className={cn('erp-nav', location.pathname === '/logs' && 'is-active')}><FileText className="size-5 shrink-0" />{isSidebarOpen && 'Nhật ký lỗi'}</Link>
          <Link title="Cài đặt & sao lưu" to="/settings" className={cn('erp-nav', location.pathname === '/settings' && 'is-active')}><Settings className="size-5 shrink-0" />{isSidebarOpen && 'Cài đặt & sao lưu'}</Link>
        </nav>
        <div className="border-t border-slate-100 p-3"><button title="Đăng xuất" onClick={handleLogout} className="erp-nav w-full text-rose-600"><LogOut className="size-5 shrink-0" />{isSidebarOpen && 'Đăng xuất'}</button></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-20 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><button aria-label={isSidebarOpen ? 'Thu gọn điều hướng' : 'Mở điều hướng'} aria-expanded={isSidebarOpen} aria-controls="app-navigation" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"><Menu className="size-5" /></button><div className="min-w-0"><p className="text-xs text-slate-500">{activeScreen?.moduleTitle || 'Không gian làm việc'}</p><p className="truncate text-sm font-semibold text-slate-900">{activeScreen?.title || (location.pathname === '/settings' ? 'Cài đặt & sao lưu' : location.pathname === '/logs' ? 'Nhật ký lỗi' : 'Tổng quan')}</p></div></div>
          <div className="flex items-center gap-4"><div className="hidden items-center gap-3 text-slate-500 xl:flex"><HeaderClock /></div><div className="flex items-center gap-3 border-l border-slate-200 pl-4"><div className="hidden text-right sm:block"><p className="text-sm font-semibold text-slate-800">{userDisplayName}</p><p className="text-xs text-slate-500">{userRole}</p></div><div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">{userDisplayName.substring(0, 2).toUpperCase()}</div></div></div>
        </header>
        <div className="relative border-b border-slate-200 bg-white px-4 py-3 lg:px-8">
          <label htmlFor="screen-search" className="sr-only">Tìm màn hình</label><Search aria-hidden="true" className="absolute left-7 top-6 size-4 text-slate-400 lg:left-11" /><input id="screen-search" type="search" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }} placeholder="Tìm màn hình theo tên hoặc phân hệ…" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          {search.trim() && <div aria-label="Kết quả tìm màn hình" className="absolute inset-x-4 top-full z-30 max-h-80 overflow-y-auto rounded-b-xl border border-slate-200 bg-white p-2 shadow-lg lg:inset-x-8">{matches.length ? matches.map(screen => <Link className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-blue-50" key={`${screen.moduleId}:${screen.id}`} to={`/screen/${screen.moduleId}/${screen.id}`}><span>{screen.title}</span><span className="text-xs text-slate-500">{screen.moduleTitle}</span></Link>) : <p role="status" className="p-3 text-sm text-slate-500">Không tìm thấy màn hình phù hợp.</p>}</div>}
        </div>
        <main id="main-content" tabIndex={-1} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 outline-none lg:p-8">{children}</main>
      </div>
    </div>
  );
};
