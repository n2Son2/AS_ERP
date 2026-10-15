import { mergeNavigation } from './lib/screenConfig';
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate, Link } from 'react-router-dom';
import { Layout } from './components/Layout';
import { APP_CONFIG } from './config';
import { Toaster } from './components/ui/sonner';
import { Settings, Loader2, ArrowRight } from 'lucide-react';
import { Button } from './components/ui/button';
import { Login } from './components/Login';
import { supabase } from './lib/supabase';
import { ConfigScopeContext, ConfigSourceContext, useScreenConfig, useModuleNavigation, usePrefetchScreen } from './lib/useScreenConfig';
import { resolveModuleConfigSource } from './lib/moduleConfigSource';
import { getSupabaseConfig } from './lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { loginToEVN } from './services/evnService';

const DynamicScreen = lazy(() => import('./components/ui/DynamicScreen').then(module => ({ default: module.DynamicScreen })));
const SettingsScreen = lazy(() => import('./components/SettingsScreen').then(module => ({ default: module.SettingsScreen })));
const LogScreen = lazy(() => import('./components/LogScreen').then(module => ({ default: module.LogScreen })));

const ScreenWrapper = () => {
  const { moduleId = '', screenId = '' } = useParams();
  const { config, isPending, isFetching, isError, moduleMismatch, accessDenied, refetch } = useScreenConfig(moduleId, screenId);
  const moduleTitle = APP_CONFIG.find(module => module.id === moduleId)?.title || 'Chức năng';

  if (isPending) {
    return <div className="p-8 text-center text-slate-500">Đang tải cấu hình...</div>;
  }
  if (moduleMismatch || !config) {
    return <div className="p-8 text-center text-slate-500">
      <p>{accessDenied ? 'Không có quyền tải cấu hình màn hình.' :
        isError ? 'Không tải được cấu hình màn hình.' : 'Màn hình không tồn tại trong module này.'}</p>
      {isError && <Button variant="outline" onClick={() => refetch()}>Thử lại</Button>}
    </div>;
  }
  return <>
    {isError && <div role="status" className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
      Không cập nhật được cấu hình. Đang dùng cấu hình đã có.
      <Button variant="ghost" size="sm" onClick={() => refetch()}>Thử lại</Button>
    </div>}
    {isFetching && <p role="status" className="mb-2 text-xs text-slate-500">Đang cập nhật cấu hình...</p>}
    <Suspense fallback={<p className="p-8 text-slate-500">Đang mở màn hình...</p>}>
      <DynamicScreen key={`${moduleId}:${screenId}:${config.table_name}`} config={config} moduleTitle={moduleTitle} />
    </Suspense>
  </>;
};
const DashboardHome = () => {
  const { data: navigation, isError } = useModuleNavigation();
  const prefetchScreen = usePrefetchScreen();
  const modules = mergeNavigation(APP_CONFIG, navigation ?? []);
  return <div className="mx-auto max-w-7xl space-y-8">
    <section className="erp-welcome rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">AS ERP / Tổng quan</p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Một không gian. Mọi hoạt động.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Chào mừng trở lại. Truy cập các phân hệ và quản lý công việc của bạn từ một nơi tập trung.</p>
      <div className="mt-6 flex flex-wrap gap-3"><span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">{modules.length} phân hệ</span><span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{modules.reduce((total, module) => total + module.screens.length, 0)} màn hình trong menu</span></div>
    </section>
    <section aria-labelledby="modules-heading"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 id="modules-heading" className="text-lg font-semibold text-slate-900">Phân hệ làm việc</h2><p className="mt-1 text-sm text-slate-500">Chọn chức năng để bắt đầu.</p></div><span className="text-xs text-slate-500">Menu theo cấu hình hệ thống</span></div>
    {isError && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Chưa cập nhật được menu. Đang hiển thị cấu hình đã có.</p>}
    <div className="grid gap-4 md:grid-cols-2">{modules.map((module, index) => <article key={module.id} className="erp-module rounded-xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">{String(index + 1).padStart(2, '0')}</span><span className="text-xs text-slate-500">{module.screens.length} chức năng</span></div><h3 className="mb-3 text-lg font-semibold text-slate-900">{module.title}</h3><div className="space-y-1">{module.screens.map(screen => <Link key={screen.id} to={`/screen/${module.id}/${screen.id}`} onFocus={() => prefetchScreen(screen.id)} onMouseEnter={() => prefetchScreen(screen.id)} className="group flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"><span>{screen.title}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400 group-hover:text-blue-600" /></Link>)}{!module.screens.length && <p className="py-2 text-sm text-slate-500">Chưa có màn hình trong menu.</p>}</div></article>)}</div></section>
    <section className="flex flex-col justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/60 p-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><Settings aria-hidden="true" className="mt-1 size-5 shrink-0 text-blue-700" /><div><h2 className="font-semibold text-slate-900">Thiết lập không gian làm việc</h2><p className="mt-1 text-sm text-slate-600">Quản lý kết nối dữ liệu, nguồn cấu hình và sao lưu hệ thống.</p></div></div><Button asChild variant="outline" className="shrink-0 bg-white"><Link to="/settings">Mở cài đặt<ArrowRight aria-hidden="true" /></Link></Button></section>
  </div>;
};

export default function App() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoAdmin, setIsDemoAdmin] = useState(false);

  useEffect(() => {
    // Pre-fetch EVN Token for seamless uploads/fallback
    loginToEVN().catch((err) => console.log('EVN background login info:', err.message));

    // Check for demo bypass
    const demoBypass = localStorage.getItem('demo_admin_session') === 'true';
    setIsDemoAdmin(demoBypass);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear();
      if (event === 'USER_UPDATED') {
        void queryClient.invalidateQueries({ queryKey: ['screen_config'] });
        void queryClient.invalidateQueries({ queryKey: ['module_navigation'] });
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium animate-pulse">Đang kiểm tra bảo mật...</p>
      </div>
    );
  }

  if (!session && !isDemoAdmin) {
    return (
      <>
        <Login onLoginSuccess={() => {
          if (localStorage.getItem('demo_admin_session') === 'true') {
            setIsDemoAdmin(true);
          }
        }} />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <ConfigSourceContext.Provider value={resolveModuleConfigSource(localStorage.getItem('MODULE_CONFIG_SOURCE'))}>
    <ConfigScopeContext.Provider value={[getSupabaseConfig().url, session?.user?.id || 'demo', session?.user?.app_metadata?.role || ''].join('|')}>
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/screen/:moduleId/:screenId" element={<ScreenWrapper />} />
          <Route path="/settings" element={<Suspense fallback={<p>Đang mở cài đặt...</p>}><SettingsScreen /></Suspense>} />
          <Route path="/logs" element={<Suspense fallback={<p>Đang mở nhật ký...</p>}><LogScreen /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </Router>
    </ConfigScopeContext.Provider>
    </ConfigSourceContext.Provider>
  );
}


