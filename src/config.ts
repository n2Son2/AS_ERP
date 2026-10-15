import { ModuleConfig, ScreenConfig } from '../dynamic';

// Tự động tải tất cả các file .json trong /src/modules và /config/module
const moduleConfigs = {
  ...import.meta.glob('./modules/**/*.json', { eager: true }),
  ...import.meta.glob('../config/module/*.json', { eager: true }),
};

const modulesMap = new Map<string, ModuleConfig>();
const pendingSubScreens: Array<{ moduleId: string; screen: ScreenConfig }> = [];

for (const [path, moduleExport] of Object.entries(moduleConfigs)) {
  const content: any = (moduleExport as any).default || moduleExport;
  if (!content) continue;

  // Lấy tên file từ path, ví dụ "../config/module/system.functions.json" -> "system.functions.json"
  const fileName = path.split('/').pop()?.replace(/\.json$/i, '') || '';
  const parts = fileName.split('.');

  if (parts.length === 1) {
    // File module chính: ví dụ "system.json", "hrm.json"
    const moduleId = content.id || parts[0];
    const existing = modulesMap.get(moduleId);
    const screens = existing ? existing.screens : [];

    const initialScreens: ScreenConfig[] = Array.isArray(content.screens) ? content.screens : [];
    for (const sc of initialScreens) {
      const idx = screens.findIndex((s) => s.id === sc.id);
      if (idx >= 0) {
        screens[idx] = sc;
      } else {
        screens.push(sc);
      }
    }

    modulesMap.set(moduleId, {
      ...content,
      id: moduleId,
      title: content.title || moduleId,
      icon: content.icon || 'Folder',
      screens,
    });
  } else {
    // File chức năng con: ví dụ "system.functions.json", "system.users.json"
    const moduleId = parts[0];
    const screenId = parts.slice(1).join('.');

    const screensToAdd: ScreenConfig[] = Array.isArray(content)
      ? content
      : Array.isArray(content.screens)
      ? content.screens
      : [content];

    for (const sc of screensToAdd) {
      if (!sc) continue;
      const normalizedScreen: ScreenConfig = {
        ...sc,
        id: sc.id || screenId,
      };
      pendingSubScreens.push({ moduleId, screen: normalizedScreen });
    }
  }
}

// Gộp các sub-screens vào module tương ứng
for (const { moduleId, screen } of pendingSubScreens) {
  let mod = modulesMap.get(moduleId);
  if (!mod) {
    mod = {
      id: moduleId,
      title: moduleId.toUpperCase(),
      icon: 'Folder',
      screens: [],
    };
    modulesMap.set(moduleId, mod);
  }
  const idx = mod.screens.findIndex((s) => s.id === screen.id);
  if (idx >= 0) {
    mod.screens[idx] = screen;
  } else {
    mod.screens.push(screen);
  }
}

const moduleOrder = ['hrm', 'catalog', 'finance', 'system'];

export const APP_CONFIG: ModuleConfig[] = Array.from(modulesMap.values()).sort((a, b) => {
  const indexA = moduleOrder.indexOf(a.id);
  const indexB = moduleOrder.indexOf(b.id);
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return 0;
});
