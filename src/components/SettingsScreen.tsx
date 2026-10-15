import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getSupabaseConfig } from '@/lib/supabase';
import { resolveModuleConfigSource, type ModuleConfigSource } from '@/lib/moduleConfigSource';
import { Settings, Save, RefreshCcw, KeyRound, Upload, Copy, ExternalLink, CheckCircle2, ShieldCheck, Loader2, Image as ImageIcon, Database, FileJson, HardDrive } from 'lucide-react';
import { getEVNConfig, saveEVNConfig, loginToEVN, uploadToEVN, uploadImageWithFallback } from '@/services/evnService';
import { BackupRestoreSection } from './BackupRestoreSection';

export const SettingsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'backup' | 'storage' | 'supabase'>('backup');
  const config = getSupabaseConfig();
  const [url, setUrl] = useState(config.url);
  const [key, setKey] = useState(config.key);
  const [moduleConfigSource, setModuleConfigSource] = useState(() => resolveModuleConfigSource(localStorage.getItem('MODULE_CONFIG_SOURCE')));

  // Storage Provider
  const [storageProvider, setStorageProvider] = useState<string>(
    () => localStorage.getItem('STORAGE_PROVIDER') || 'EVN'
  );

  // EVN Config
  const evnCfg = getEVNConfig();
  const [evnDomain, setEvnDomain] = useState(evnCfg.domain);
  const [evnUsername, setEvnUsername] = useState(evnCfg.username);
  const [evnPassword, setEvnPassword] = useState(evnCfg.password);
  const [evnToken, setEvnToken] = useState<string | undefined>(evnCfg.token);
  const [isGettingToken, setIsGettingToken] = useState(false);

  // Test Upload State
  const [isUploadingTest, setIsUploadingTest] = useState(false);
  const [testResultUrl, setTestResultUrl] = useState<string | null>(null);
  const [testResultData, setTestResultData] = useState<any | null>(null);

  useEffect(() => {
    localStorage.setItem('STORAGE_PROVIDER', storageProvider);
  }, [storageProvider]);

  const handleSaveSupabase = () => {
    localStorage.setItem('SUPABASE_URL', url);
    localStorage.setItem('SUPABASE_KEY', key);
    toast.success('Đã lưu cấu hình Supabase. Vui lòng tải lại trang để áp dụng.');
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleResetSupabase = () => {
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_KEY');
    toast.success('Đã khôi phục mặc định Supabase.');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleSaveEVN = () => {
    saveEVNConfig({
      domain: evnDomain,
      username: evnUsername,
      password: evnPassword,
    });
    toast.success('Đã lưu cấu hình EVN ESD Storage.');
  };

  const handleGetEVNToken = async () => {
    setIsGettingToken(true);
    try {
      const token = await loginToEVN({
        domain: evnDomain,
        username: evnUsername,
        password: evnPassword,
      });
      setEvnToken(token);
      toast.success('Lấy Token EVN thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lấy Token EVN');
    } finally {
      setIsGettingToken(false);
    }
  };

  const handleTestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTest(true);
    setTestResultUrl(null);
    setTestResultData(null);

    try {
      const result = await uploadToEVN(file);
      setTestResultUrl(result.url);
      setTestResultData(result.data);
      // Sync latest token
      const latestCfg = getEVNConfig();
      if (latestCfg.token) setEvnToken(latestCfg.token);
      toast.success('Upload ảnh test thành công!');
    } catch (err: any) {
      console.error('Test upload error:', err);
      toast.error('Lỗi khi upload ảnh test: ' + (err.message || 'Không thể upload'));
    } finally {
      setIsUploadingTest(false);
      e.target.value = '';
    }
  };

  const handleCopyUrl = (urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy);
    toast.success('Đã sao chép đường dẫn ảnh vào bộ nhớ tạm');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings className="h-4 w-4" />
            <span>Hệ thống</span>
            <span>/</span>
            <span className="text-blue-600 font-medium">Cài đặt & Dữ liệu</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight mt-1">Cài đặt hệ thống</h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'backup'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileJson className="h-4 w-4 text-indigo-600" />
            <span>Sao lưu & Khôi phục JSON</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'storage'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Lưu trữ & EVN</span>
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'supabase'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="h-4 w-4 text-emerald-600" />
            <span>Supabase Database</span>
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nguồn cấu hình module</CardTitle>
          <CardDescription>Chọn nguồn dùng để dựng menu, bảng và biểu mẫu. Dữ liệu nghiệp vụ vẫn lấy từ Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="module-config-source">Nguồn cấu hình</Label>
          <select id="module-config-source" value={moduleConfigSource}
            onChange={event => setModuleConfigSource(event.target.value as ModuleConfigSource)}
            className="block w-full rounded border p-2">
            <option value="json">JSON trong ứng dụng (mặc định, mở ngay)</option>
            <option value="supabase">Supabase (cấu hình động trong cơ sở dữ liệu)</option>
          </select>
          <p className="text-sm text-slate-500">Ở chế độ JSON, chỉnh cấu hình trong thư mục config/module. Chỉnh app_functions chỉ áp dụng khi chọn nguồn Supabase.</p>
          <Button onClick={() => {
            localStorage.setItem('MODULE_CONFIG_SOURCE', moduleConfigSource);
            window.location.reload();
          }}>Áp dụng nguồn cấu hình</Button>
        </CardContent>
      </Card>

      {/* TAB 1: BACKUP & RESTORE JSON */}
      {activeTab === 'backup' && (
        <div className="animate-in fade-in duration-200">
          <BackupRestoreSection />
        </div>
      )}

      {/* TAB 2: STORAGE & EVN */}
      {activeTab === 'storage' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Storage Provider Selection Card */}
          <Card className="shadow-sm border-slate-200 bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Chọn Provider Lưu trữ File & Ảnh
                  </CardTitle>
                  <CardDescription>
                    Lựa chọn dịch vụ lưu trữ mặc định. Khi Drive API lỗi, ứng dụng sẽ tự động fallback sang EVN ESD Storage.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    id: 'EVN',
                    title: 'EVN ESD Storage',
                    desc: 'Tự động đăng nhập & upload trực tiếp qua API EVN ESD Global',
                    badge: 'Khuyên dùng',
                  },
                  {
                    id: 'Drive API',
                    title: 'Google Drive API',
                    desc: 'Upload lên Google Drive. Tự động chuyển sang EVN nếu lỗi',
                    badge: 'Fallback EVN',
                  },
                  {
                    id: 'Local',
                    title: 'Supabase Storage',
                    desc: 'Lưu trực tiếp vào Supabase Storage Bucket của hệ thống',
                    badge: 'Tiêu chuẩn',
                  },
                ].map((p) => {
                  const isSelected = storageProvider === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setStorageProvider(p.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">{p.title}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{p.desc}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 pt-2 border-t border-slate-100">
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <span>{isSelected ? 'Đang chọn' : 'Chọn provider này'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* EVN ESD Storage Config & Test Upload */}
          <Card className="shadow-sm border-blue-200 bg-gradient-to-br from-white to-blue-50/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2 text-blue-950">
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                    Cấu hình EVN ESD Storage API
                  </CardTitle>
                  <CardDescription>
                    Cấu hình tài khoản và Token tự động phục vụ tải ảnh/tài liệu lên máy chủ EVN.
                  </CardDescription>
                </div>
                {evnToken ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Token Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    Chưa có Token
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="evnDomain" className="text-xs font-semibold text-slate-700">Domain API EVN</Label>
                  <Input
                    id="evnDomain"
                    value={evnDomain}
                    onChange={(e) => setEvnDomain(e.target.value)}
                    placeholder="http://evngenco2.web.esdglobal.com.vn"
                    className="h-10 text-xs bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evnUsername" className="text-xs font-semibold text-slate-700">Tài khoản (UserName)</Label>
                  <Input
                    id="evnUsername"
                    value={evnUsername}
                    onChange={(e) => setEvnUsername(e.target.value)}
                    placeholder="spfarm"
                    className="h-10 text-xs bg-white font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evnPassword" className="text-xs font-semibold text-slate-700">Mật khẩu (Password)</Label>
                  <Input
                    id="evnPassword"
                    type="password"
                    value={evnPassword}
                    onChange={(e) => setEvnPassword(e.target.value)}
                    placeholder="Q1w2e3r4"
                    className="h-10 text-xs bg-white font-mono"
                  />
                </div>
              </div>

              {/* Token Display */}
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                    Token Key Đã Lưu (UserTokenKey):
                  </span>
                  {evnToken && (
                    <button
                      onClick={() => handleCopyUrl(evnToken)}
                      className="text-blue-600 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <Copy className="h-3 w-3" /> Sao chép Token
                    </button>
                  )}
                </div>
                <div className="font-mono text-[11px] text-slate-700 break-all bg-slate-50 p-2 rounded border border-slate-100 max-h-16 overflow-y-auto">
                  {evnToken || <span className="text-slate-400 italic">Chưa lấy Token. Bấm "Lấy Token EVN" bên dưới để tự động cấp token mới.</span>}
                </div>
              </div>

              {/* Actions & Test Upload */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveEVN} variant="outline" className="h-10 text-xs bg-white hover:bg-slate-50 gap-2 border-slate-300">
                    <Save className="h-4 w-4 text-slate-600" />
                    Lưu tham số EVN
                  </Button>
                  <Button
                    onClick={handleGetEVNToken}
                    disabled={isGettingToken}
                    className="h-10 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-sm"
                  >
                    {isGettingToken ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    Đăng nhập & Lấy Token EVN
                  </Button>
                </div>

                {/* Test Upload Button Section */}
                <div>
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleTestUpload}
                      disabled={isUploadingTest}
                      className="hidden"
                    />
                    <div className="inline-flex items-center gap-2 h-10 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-md hover:shadow-lg transition-all cursor-pointer">
                      {isUploadingTest ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang Upload Ảnh Test...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Upload Ảnh Test sang EVN</span>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Upload Test Result Showcase */}
              {testResultUrl && (
                <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Kết quả Upload thành công trên EVN Storage:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyUrl(testResultUrl)}
                        className="h-8 text-xs gap-1.5 bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Sao chép Link
                      </Button>
                      <a
                        href={testResultUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 h-8 px-3 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Xem ảnh
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
                    <div className="w-24 h-24 rounded-lg border-2 border-emerald-300 overflow-hidden bg-white shrink-0 shadow-sm flex items-center justify-center">
                      <img
                        src={testResultUrl}
                        alt="EVN Upload Test"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <ImageIcon className="h-8 w-8 text-emerald-400 font-light" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 break-all font-mono">
                        URL: <span className="text-blue-700 underline">{testResultUrl}</span>
                      </p>
                      {testResultData && (
                        <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-x-4 gap-y-1 pt-1 font-sans">
                          <div>File ID: <span className="font-bold text-slate-800">{testResultData.ID}</span></div>
                          <div>Tên file: <span className="font-bold text-slate-800">{testResultData.FileName}</span></div>
                          <div>Thư mục: <span className="font-mono text-slate-700">{testResultData.ParentFolder}</span></div>
                          <div>Dung lượng: <span className="font-bold text-slate-800">{testResultData.Size} bytes</span></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: SUPABASE CONFIG */}
      {activeTab === 'supabase' && (
        <div className="animate-in fade-in duration-200">
          <Card className="shadow-sm border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-xl">Cấu hình Supabase</CardTitle>
              <CardDescription>
                Thiết lập kết nối tới cơ sở dữ liệu Supabase của bạn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Supabase URL</Label>
                <Input 
                  id="url" 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)} 
                  placeholder="https://your-project.supabase.co"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">Supabase Anon Key</Label>
                <Input 
                  id="key" 
                  type="password"
                  value={key} 
                  onChange={(e) => setKey(e.target.value)} 
                  placeholder="your-anon-key"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveSupabase} className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <Save className="h-4 w-4" />
                  Lưu cấu hình
                </Button>
                <Button variant="outline" onClick={handleResetSupabase} className="gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Khôi phục mặc định
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

