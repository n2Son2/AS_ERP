import { supabase } from '@/lib/supabase';
import { APP_CONFIG } from '@/config';

export interface BackupTableInfo {
  tableName: string;
  label: string;
  module?: string;
  count: number;
  sampleRow?: any;
}

export interface BackupFileStructure {
  version: string;
  appName: string;
  exportDate: string;
  timestamp: number;
  totalTables: number;
  totalRecords: number;
  tables: Record<string, any[]>;
  localConfigs?: Record<string, any>;
}

export interface RestoreProgress {
  tableName: string;
  tableLabel: string;
  currentTableIndex: number;
  totalTables: number;
  recordsCount: number;
  stage: 'clearing' | 'inserting' | 'completed' | 'error';
  message: string;
  progressPercent: number;
}

export interface RestoreResult {
  success: boolean;
  totalRestored: number;
  details: {
    tableName: string;
    tableLabel: string;
    count: number;
    status: 'success' | 'warning' | 'error';
    message?: string;
  }[];
}

// Known standard table labels mapping
const KNOWN_TABLE_LABELS: Record<string, { label: string; module: string }> = {
  departments: { label: 'Bộ phận (HRM)', module: 'hrm' },
  employees: { label: 'Nhân sự (HRM)', module: 'hrm' },
  timesheets: { label: 'Bảng Chấm công (HRM)', module: 'hrm' },
  categories: { label: 'Nhóm hàng hóa (Danh mục)', module: 'catalog' },
  units: { label: 'Đơn vị tính (Danh mục)', module: 'catalog' },
  transactions: { label: 'Thu chi giao dịch (Tài chính)', module: 'finance' },
  app_functions: { label: 'Cấu hình Chức năng (Hệ thống)', module: 'system' },
  users: { label: 'Người dùng (Hệ thống)', module: 'system' },
  roles: { label: 'Vai trò & Phân quyền', module: 'system' },
  module_groups: { label: 'Nhóm chức năng', module: 'system' },
  system_logs: { label: 'Nhật ký hệ thống', module: 'system' }
};

/**
 * Get all registered and dynamic table names across the app
 */
export const getAllSystemTables = async (): Promise<{ tableName: string; label: string; module: string }[]> => {
  const tableMap = new Map<string, { tableName: string; label: string; module: string }>();

  // 1. Static config modules
  APP_CONFIG.forEach(module => {
    module.screens.forEach(screen => {
      const tName = screen.table_name || screen.id;
      if (tName) {
        tableMap.set(tName, {
          tableName: tName,
          label: screen.title || KNOWN_TABLE_LABELS[tName]?.label || tName,
          module: module.title || module.id
        });
      }
    });
  });

  // 2. Known default tables
  Object.entries(KNOWN_TABLE_LABELS).forEach(([tName, meta]) => {
    if (!tableMap.has(tName)) {
      tableMap.set(tName, {
        tableName: tName,
        label: meta.label,
        module: meta.module
      });
    }
  });

  // 3. Query app_functions from Supabase for any custom dynamic tables
  try {
    const { data: dynamicFuncs } = await supabase
      .from('app_functions')
      .select('id, title, table_name, module_group, module_id');
    
    if (dynamicFuncs && Array.isArray(dynamicFuncs)) {
      dynamicFuncs.forEach(func => {
        const tName = func.table_name || func.id;
        if (tName && !tableMap.has(tName)) {
          tableMap.set(tName, {
            tableName: tName,
            label: func.title || tName,
            module: func.module_group || func.module_id || 'Tùy chỉnh'
          });
        }
      });
    }
  } catch (err) {
    console.log('Notice: Could not fetch dynamic tables from app_functions', err);
  }

  return Array.from(tableMap.values());
};

/**
 * Fetch all records for a specific table from Supabase & LocalStorage merged
 */
export const fetchTableData = async (tableName: string): Promise<any[]> => {
  let dbRows: any[] = [];

  // Fetch from Supabase (with pagination support if large)
  try {
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + step - 1);

      if (error) {
        // Table might not exist in Supabase or permission restricted
        break;
      }

      if (data && data.length > 0) {
        dbRows = [...dbRows, ...data];
        if (data.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      } else {
        hasMore = false;
      }
    }
  } catch (err) {
    console.log(`Notice fetching DB for ${tableName}:`, err);
  }

  // Merge with localStorage items
  const localKey = `local_table_${tableName}`;
  const localRaw = localStorage.getItem(localKey);
  if (localRaw) {
    try {
      const localItems: any[] = JSON.parse(localRaw);
      if (Array.isArray(localItems)) {
        if (tableName === 'timesheets') {
          // Deduplicate by employee_code + work_date
          const dedupe = new Map<string, any>();
          dbRows.forEach(r => {
            const key = `${r.employee_code || ''}_${r.work_date || ''}` || r.id;
            if (key) dedupe.set(key, r);
          });
          localItems.forEach(r => {
            const key = `${r.employee_code || ''}_${r.work_date || ''}` || r.id;
            if (key) dedupe.set(key, r);
          });
          dbRows = Array.from(dedupe.values());
        } else {
          const existingIds = new Set(dbRows.map(r => r.id).filter(Boolean));
          const newLocals = localItems.filter(r => !r.id || !existingIds.has(r.id));
          dbRows = [...dbRows, ...newLocals];
        }
      }
    } catch (e) {
      console.error(`Error parsing local storage for table ${tableName}:`, e);
    }
  }

  return dbRows;
};

/**
 * Get summary stats for all tables in the system
 */
export const getTablesOverview = async (): Promise<BackupTableInfo[]> => {
  const allTables = await getAllSystemTables();
  const results: BackupTableInfo[] = [];

  for (const t of allTables) {
    try {
      const rows = await fetchTableData(t.tableName);
      results.push({
        tableName: t.tableName,
        label: t.label,
        module: t.module,
        count: rows.length,
        sampleRow: rows[0] || null
      });
    } catch (e) {
      results.push({
        tableName: t.tableName,
        label: t.label,
        module: t.module,
        count: 0
      });
    }
  }

  return results;
};

/**
 * Export all system table data into a downloadable JSON file
 */
export const exportAllTablesToJson = async (
  onProgress?: (currentTable: string, index: number, total: number) => void
): Promise<{ fileName: string; totalRecords: number; totalTables: number }> => {
  const allTables = await getAllSystemTables();
  const tablesData: Record<string, any[]> = {};
  let totalRecords = 0;

  for (let i = 0; i < allTables.length; i++) {
    const t = allTables[i];
    if (onProgress) {
      onProgress(t.label || t.tableName, i + 1, allTables.length);
    }
    const rows = await fetchTableData(t.tableName);
    tablesData[t.tableName] = rows;
    totalRecords += rows.length;
  }

  // Also backup essential local storage configs
  const localConfigs: Record<string, any> = {
    STORAGE_PROVIDER: localStorage.getItem('STORAGE_PROVIDER'),
    EVN_STORAGE_CONFIG: localStorage.getItem('EVN_STORAGE_CONFIG'),
    SUPABASE_URL: localStorage.getItem('SUPABASE_URL'),
  };

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  const fileName = `ERP_Full_Backup_${dateStr}_${timeStr}.json`;

  const backupPayload: BackupFileStructure = {
    version: '1.0.0',
    appName: 'AS ERP System',
    exportDate: now.toISOString(),
    timestamp: now.getTime(),
    totalTables: allTables.length,
    totalRecords,
    tables: tablesData,
    localConfigs
  };

  // Convert to JSON and trigger download
  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName,
    totalRecords,
    totalTables: Object.keys(tablesData).filter(k => (tablesData[k] || []).length > 0).length
  };
};

/**
 * Validate and analyze an uploaded JSON file before restoring
 */
export const analyzeBackupJson = (jsonContent: string): {
  valid: boolean;
  error?: string;
  data?: BackupFileStructure;
  tablesSummary: BackupTableInfo[];
  totalRecords: number;
} => {
  try {
    const parsed = JSON.parse(jsonContent);

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'File JSON không hợp lệ hoặc rỗng.', tablesSummary: [], totalRecords: 0 };
    }

    let tablesObj: Record<string, any[]> = {};
    let version = '1.0.0';
    let exportDate = new Date().toISOString();
    let localConfigs = {};

    // Standard structured backup
    if (parsed.tables && typeof parsed.tables === 'object') {
      tablesObj = parsed.tables;
      version = parsed.version || '1.0.0';
      exportDate = parsed.exportDate || new Date().toISOString();
      localConfigs = parsed.localConfigs || {};
    } else {
      // Direct key-value tables format: { "employees": [...], "departments": [...] }
      Object.keys(parsed).forEach(key => {
        if (Array.isArray(parsed[key])) {
          tablesObj[key] = parsed[key];
        }
      });
    }

    const tableKeys = Object.keys(tablesObj);
    if (tableKeys.length === 0) {
      return {
        valid: false,
        error: 'Không tìm thấy dữ liệu bảng nào trong file JSON.',
        tablesSummary: [],
        totalRecords: 0
      };
    }

    let totalRecords = 0;
    const tablesSummary: BackupTableInfo[] = tableKeys.map(tName => {
      const rows = Array.isArray(tablesObj[tName]) ? tablesObj[tName] : [];
      totalRecords += rows.length;
      const meta = KNOWN_TABLE_LABELS[tName];
      return {
        tableName: tName,
        label: meta ? meta.label : tName,
        module: meta ? meta.module : 'Tùy chỉnh',
        count: rows.length,
        sampleRow: rows[0] || null
      };
    });

    const validatedData: BackupFileStructure = {
      version,
      appName: parsed.appName || 'AS ERP System',
      exportDate,
      timestamp: parsed.timestamp || Date.now(),
      totalTables: tableKeys.length,
      totalRecords,
      tables: tablesObj,
      localConfigs
    };

    return {
      valid: true,
      data: validatedData,
      tablesSummary,
      totalRecords
    };
  } catch (err: any) {
    return {
      valid: false,
      error: 'Lỗi giải mã file JSON: ' + (err.message || 'Cú pháp không hợp lệ'),
      tablesSummary: [],
      totalRecords: 0
    };
  }
};

/**
 * Execute restore of selected tables from parsed JSON
 */
export const restoreTablesFromJson = async (
  backupData: BackupFileStructure,
  selectedTableNames: string[],
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (progress: RestoreProgress) => void
): Promise<RestoreResult> => {
  const resultDetails: RestoreResult['details'] = [];
  let totalRestored = 0;

  const tablesToProcess = selectedTableNames.filter(t => backupData.tables[t]);
  const totalTables = tablesToProcess.length;

  for (let i = 0; i < tablesToProcess.length; i++) {
    const tableName = tablesToProcess[i];
    const rows = backupData.tables[tableName] || [];
    const meta = KNOWN_TABLE_LABELS[tableName];
    const tableLabel = meta ? meta.label : tableName;

    if (onProgress) {
      onProgress({
        tableName,
        tableLabel,
        currentTableIndex: i + 1,
        totalTables,
        recordsCount: rows.length,
        stage: mode === 'replace' ? 'clearing' : 'inserting',
        message: `Đang xử lý bảng ${tableLabel} (${rows.length} bản ghi)...`,
        progressPercent: Math.round(((i) / totalTables) * 100)
      });
    }

    if (rows.length === 0) {
      if (mode === 'replace') {
        localStorage.removeItem(`local_table_${tableName}`);
      }
      resultDetails.push({
        tableName,
        tableLabel,
        count: 0,
        status: 'success',
        message: 'Bảng rỗng, đã hoàn tất.'
      });
      continue;
    }

    try {
      // 1. If replace mode, clear localStorage cache
      if (mode === 'replace') {
        localStorage.removeItem(`local_table_${tableName}`);
      }

      // 2. Prepare cleaned rows
      const cleanedRows = rows.map(r => {
        const item = { ...r };
        // Clean any undefined or symbol fields
        Object.keys(item).forEach(k => {
          if (item[k] === undefined) delete item[k];
        });
        return item;
      });

      // 3. Batch upsert/insert to Supabase in chunks of 50
      let supabaseSuccessCount = 0;
      let supabaseError = false;
      const chunkSize = 50;

      for (let c = 0; c < cleanedRows.length; c += chunkSize) {
        const chunk = cleanedRows.slice(c, c + chunkSize);
        try {
          // Attempt upsert with id if present
          const hasIds = chunk.every(item => item.id);
          let response;
          if (hasIds) {
            response = await supabase
              .from(tableName)
              .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
          } else {
            response = await supabase
              .from(tableName)
              .insert(chunk);
          }

          if (response.error) {
            console.warn(`Supabase upsert warning for ${tableName}:`, response.error.message);
            supabaseError = true;
          } else {
            supabaseSuccessCount += chunk.length;
          }
        } catch (chunkErr) {
          console.warn(`Supabase chunk error for ${tableName}:`, chunkErr);
          supabaseError = true;
        }
      }

      // 4. Also store in localStorage to guarantee 100% offline & instantaneous availability
      const localKey = `local_table_${tableName}`;
      if (mode === 'replace') {
        localStorage.setItem(localKey, JSON.stringify(cleanedRows));
      } else {
        // Merge with existing local
        const existingRaw = localStorage.getItem(localKey);
        let existingList: any[] = [];
        if (existingRaw) {
          try {
            existingList = JSON.parse(existingRaw);
          } catch (e) {}
        }
        
        if (tableName === 'timesheets') {
          const map = new Map<string, any>();
          existingList.forEach(item => {
            const k = `${item.employee_code || ''}_${item.work_date || ''}` || item.id;
            if (k) map.set(k, item);
          });
          cleanedRows.forEach(item => {
            const k = `${item.employee_code || ''}_${item.work_date || ''}` || item.id;
            if (k) map.set(k, item);
          });
          localStorage.setItem(localKey, JSON.stringify(Array.from(map.values())));
        } else {
          const existingIds = new Set(existingList.map(item => item.id).filter(Boolean));
          const merged = [...existingList];
          cleanedRows.forEach(item => {
            if (item.id && existingIds.has(item.id)) {
              const idx = merged.findIndex(x => x.id === item.id);
              if (idx !== -1) merged[idx] = item;
            } else {
              merged.push(item);
            }
          });
          localStorage.setItem(localKey, JSON.stringify(merged));
        }
      }

      totalRestored += cleanedRows.length;
      resultDetails.push({
        tableName,
        tableLabel,
        count: cleanedRows.length,
        status: supabaseError && supabaseSuccessCount === 0 ? 'warning' : 'success',
        message: supabaseError 
          ? `Đã nạp ${cleanedRows.length} bản ghi vào bộ nhớ hệ thống (Supabase đồng bộ một phần)`
          : `Khôi phục thành công ${cleanedRows.length} bản ghi.`
      });

    } catch (tableErr: any) {
      console.error(`Error restoring table ${tableName}:`, tableErr);
      resultDetails.push({
        tableName,
        tableLabel,
        count: 0,
        status: 'error',
        message: `Lỗi: ${tableErr.message || 'Không thể khôi phục bảng'}`
      });
    }

    if (onProgress) {
      onProgress({
        tableName,
        tableLabel,
        currentTableIndex: i + 1,
        totalTables,
        recordsCount: rows.length,
        stage: 'completed',
        message: `Đã hoàn tất bảng ${tableLabel}.`,
        progressPercent: Math.round(((i + 1) / totalTables) * 100)
      });
    }
  }

  // Restore localConfigs if available
  if (backupData.localConfigs) {
    if (backupData.localConfigs.STORAGE_PROVIDER) {
      localStorage.setItem('STORAGE_PROVIDER', backupData.localConfigs.STORAGE_PROVIDER);
    }
    if (backupData.localConfigs.EVN_STORAGE_CONFIG) {
      localStorage.setItem('EVN_STORAGE_CONFIG', backupData.localConfigs.EVN_STORAGE_CONFIG);
    }
  }

  return {
    success: resultDetails.some(d => d.status === 'success' || d.status === 'warning'),
    totalRestored,
    details: resultDetails
  };
};
