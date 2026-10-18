import { mergeNavigation } from './lib/screenConfig';
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate, Link } from 'react-router-dom';
import { Layout } from './components/Layout';
import { APP_CONFIG } from './config';
import { Toaster } from './components/ui/sonner';
import { Loader2, ArrowRight, Blocks, Database, CircleCheck } from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
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
  const screenCount = modules.reduce((total, module) => total + module.screens.length, 0);

  return <div className="mx-auto flex max-w-[1440px] flex-col gap-3">
    <section className="grid gap-3 md:grid-cols-3" aria-label="Tổng quan hệ thống">
      <Card className="erp-summary-card md:col-span-2">
        <CardHeader>
          <CardTitle className="text-xl">Không gian vận hành</CardTitle>
          <CardDescription>Truy cập nhanh các phân hệ đang được cấu hình cho hệ thống.</CardDescription>
          <CardAction><Badge variant="secondary"><CircleCheck data-icon="inline-start" /> Sẵn sàng</Badge></CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div><p className="text-2xl font-semibold tabular-nums">{modules.length}</p><p className="text-xs text-muted-foreground">Phân hệ</p></div>
          <div><p className="text-2xl font-semibold tabular-nums">{screenCount}</p><p className="text-xs text-muted-foreground">Màn hình</p></div>
        </CardContent>
      </Card>
      <Card className="erp-summary-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="size-4" /> Cấu hình</CardTitle>
          <CardDescription>Quản lý kết nối, nguồn dữ liệu và sao lưu.</CardDescription>
        </CardHeader>
        <CardContent><Link to="/settings" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">Mở cài đặt <ArrowRight className="size-4" /></Link></CardContent>
      </Card>
    </section>

    <section aria-labelledby="modules-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1"><div><h2 id="modules-heading" className="text-base font-semibold">Phân hệ làm việc</h2><p className="text-xs text-muted-foreground">Chọn một chức năng để bắt đầu.</p></div><Badge variant="outline"><Blocks data-icon="inline-start" /> {screenCount} chức năng</Badge></div>
      {isError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Chưa cập nhật được menu. Đang hiển thị cấu hình đã có.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map(module => <Card key={module.id} className="erp-module-card">
        <CardHeader>
          <CardTitle>{module.title}</CardTitle>
          <CardDescription>{module.screens.length} chức năng khả dụng</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">{module.screens.map(screen => <Link key={screen.id} to={`/screen/${module.id}/${screen.id}`} onFocus={() => prefetchScreen(screen.id)} onMouseEnter={() => prefetchScreen(screen.id)} className="group flex min-h-10 items-center justify-between gap-3 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><span className="truncate">{screen.title}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0 opacity-40 group-hover:opacity-100" /></Link>)}{!module.screens.length && <p className="py-2 text-sm text-muted-foreground">Chưa có màn hình trong menu.</p>}</CardContent>
      </Card>)}</div>
    </section>
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


