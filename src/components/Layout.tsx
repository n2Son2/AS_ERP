import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  ChevronDown, 
  Search, 
  Bell,
  Command,
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
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) setIsSidebarOpen(false);
    setSearch('');
    setIsSearchOpen(false);
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
    <div className="erp-shell flex h-dvh overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3">Đến nội dung chính</a>
      {isSidebarOpen && <button aria-label="Đóng điều hướng" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside onKeyDown={e => { if (e.key === 'Escape') setIsSidebarOpen(false); }} id="app-navigation" aria-label="Điều hướng chính" className={cn('erp-sidebar fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col lg:static', !isSidebarOpen && 'hidden lg:flex lg:w-16')}>
        <Link to="/" aria-label="AS ERP — Trang chủ" className="flex min-h-16 items-center gap-3 px-4">
          <span className="erp-brand-mark flex size-8 shrink-0 items-center justify-center"><Command className="size-4" /></span>
          {isSidebarOpen && <div className="min-w-0"><p className="truncate text-[17px] font-semibold tracking-tight text-foreground">AS ERP</p><p className="truncate text-[11px] text-muted-foreground">Quản trị doanh nghiệp</p></div>}
        </Link>
        <button aria-label="Đóng menu" onClick={() => setIsSidebarOpen(false)} className="mx-3 mt-2 flex min-h-11 items-center justify-center gap-2 rounded-lg text-slate-600 hover:bg-slate-50 lg:hidden"><X className="size-4" />Đóng menu</button>
        <nav className="custom-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
          {isSidebarOpen && <p className="px-2.5 pt-2 pb-1.5 text-[11px] text-muted-foreground">Vận hành</p>}
          <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined} title="Tổng quan" className={cn('erp-nav', location.pathname === '/' && 'is-active')}><LayoutDashboard className="size-5 shrink-0" />{isSidebarOpen && 'Tổng quan'}</Link>
          {navigationError && isSidebarOpen && <p role="status" className="px-3 py-2 text-xs text-amber-700">Không cập nhật được menu. Đang dùng cấu hình đã có.</p>}
          {modules.map(module => <div key={module.id}>
            <button title={module.title} aria-label={module.title} aria-expanded={isSidebarOpen && expandedModules.includes(module.id)} onClick={() => { if (!isSidebarOpen) setIsSidebarOpen(true); toggleModule(module.id); }} className="erp-nav w-full justify-between">
              <span className="flex min-w-0 items-center gap-3"><Icon name={module.icon || 'Folder'} className="size-5 shrink-0" />{isSidebarOpen && <span className="text-left">{module.title}</span>}</span>
              {isSidebarOpen && <ChevronDown className={cn('size-4 shrink-0 transition-transform', expandedModules.includes(module.id) && 'rotate-180')} />}
            </button>
            {isSidebarOpen && expandedModules.includes(module.id) && <div className="my-1 ml-5 flex flex-col gap-0.5 border-l border-border pl-2">{module.screens.map(screen => <Link key={screen.id} to={`/screen/${module.id}/${screen.id}`} onMouseEnter={() => prefetchScreen(screen.id)} onFocus={() => prefetchScreen(screen.id)} aria-current={location.pathname === `/screen/${module.id}/${screen.id}` ? 'page' : undefined} className={cn('erp-nav text-sm', location.pathname === `/screen/${module.id}/${screen.id}` && 'is-active')}>{screen.title}</Link>)}</div>}
          </div>)}
          {isSidebarOpen && <p className="px-2.5 pt-5 pb-1.5 text-[11px] text-muted-foreground">Quản trị</p>}
          <Link title="Nhật ký lỗi" to="/logs" className={cn('erp-nav', location.pathname === '/logs' && 'is-active')}><FileText className="size-5 shrink-0" />{isSidebarOpen && 'Nhật ký lỗi'}</Link>
          <Link title="Cài đặt & sao lưu" to="/settings" className={cn('erp-nav', location.pathname === '/settings' && 'is-active')}><Settings className="size-5 shrink-0" />{isSidebarOpen && 'Cài đặt & sao lưu'}</Link>
        </nav>
        <div className="border-t border-slate-100 p-3"><button title="Đăng xuất" onClick={handleLogout} className="erp-nav w-full text-rose-600"><LogOut className="size-5 shrink-0" />{isSidebarOpen && 'Đăng xuất'}</button></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="erp-header relative flex min-h-16 shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" aria-label={isSidebarOpen ? 'Thu gọn điều hướng' : 'Mở điều hướng'} aria-expanded={isSidebarOpen} aria-controls="app-navigation" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu /></Button>
            <div className="min-w-0"><h1 className="truncate text-lg font-semibold tracking-tight">{activeScreen?.title || (location.pathname === '/settings' ? 'Cài đặt & sao lưu' : location.pathname === '/logs' ? 'Nhật ký lỗi' : 'Tổng quan')}</h1><p className="hidden text-xs text-muted-foreground sm:block">{activeScreen?.moduleTitle || 'Không gian làm việc'}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('relative hidden sm:block', isSearchOpen && 'block!')}>
              <InputGroup className="erp-search h-9 w-[220px] lg:w-[280px]">
                <InputGroupAddon><Search /><span className="sr-only">Tìm kiếm</span></InputGroupAddon>
                <InputGroupInput id="screen-search" type="search" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setIsSearchOpen(false); } }} placeholder="Tìm màn hình" autoComplete="off" />
                <InputGroupAddon align="inline-end" className="hidden lg:flex"><InputGroupText>⌘ K</InputGroupText></InputGroupAddon>
              </InputGroup>
              {search.trim() && <div aria-label="Kết quả tìm màn hình" className="erp-search-results absolute right-0 top-[calc(100%+8px)] w-[min(360px,calc(100vw-32px))] p-2">{matches.length ? matches.map(screen => <Link className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted" key={`${screen.moduleId}:${screen.id}`} to={`/screen/${screen.moduleId}/${screen.id}`}><span>{screen.title}</span><span className="text-xs text-muted-foreground">{screen.moduleTitle}</span></Link>) : <p role="status" className="p-3 text-sm text-muted-foreground">Không tìm thấy màn hình phù hợp.</p>}</div>}
            </div>
            <Button className="sm:hidden" variant="outline" size="icon" aria-label="Tìm màn hình" aria-expanded={isSearchOpen} onClick={() => setIsSearchOpen(value => !value)}><Search /></Button>
            <div className="hidden items-center gap-3 text-muted-foreground 2xl:flex"><HeaderClock /></div>
            <Button variant="outline" size="icon" aria-label="Thông báo"><Bell /></Button>
            <div className="flex items-center gap-2"><div className="hidden text-right lg:block"><p className="text-sm font-medium">{userDisplayName}</p><p className="text-[11px] text-muted-foreground">{userRole}</p></div><div className="erp-avatar flex size-9 items-center justify-center text-xs font-semibold">{userDisplayName.substring(0, 2).toUpperCase()}</div></div>
          </div>
          {isSearchOpen && <div className="absolute inset-x-3 top-full z-30 mt-2 sm:hidden"><InputGroup className="erp-search h-10 bg-card"><InputGroupAddon><Search /></InputGroupAddon><InputGroupInput autoFocus type="search" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setIsSearchOpen(false); } }} placeholder="Tìm màn hình" /></InputGroup>{search.trim() && <div className="erp-search-results mt-2 p-2">{matches.length ? matches.map(screen => <Link className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted" key={`${screen.moduleId}:${screen.id}`} to={`/screen/${screen.moduleId}/${screen.id}`}><span>{screen.title}</span><span className="text-xs text-muted-foreground">{screen.moduleTitle}</span></Link>) : <p className="p-3 text-sm text-muted-foreground">Không tìm thấy màn hình phù hợp.</p>}</div>}</div>}
        </header>
        <main id="main-content" tabIndex={-1} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 outline-none sm:p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
};
