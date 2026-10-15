export interface AppLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  context?: any;
}

const STORAGE_KEY = 'app_logs';

export const logger = {
  getLogs: (): AppLog[] => {
    try {
      const logs = localStorage.getItem(STORAGE_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (e) {
      console.error('Failed to get logs from localStorage', e);
      return [];
    }
  },

  log: (message: string, level: AppLog['level'] = 'error', context?: any) => {
    const newLog: AppLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message,
      stack: level === 'error' ? new Error().stack : undefined,
      context,
    };

    try {
      const logs = logger.getLogs();
      logs.unshift(newLog); // Add to the beginning
      // Keep only last 100 logs
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch (e) {
      console.error('Failed to save log to localStorage', e);
    }
  },

  error: (message: string, context?: any) => logger.log(message, 'error', context),
  warn: (message: string, context?: any) => logger.log(message, 'warn', context),
  info: (message: string, context?: any) => logger.log(message, 'info', context),

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
