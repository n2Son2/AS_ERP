export type ModuleConfigSource = 'json' | 'supabase';

export function resolveModuleConfigSource(value: string | null): ModuleConfigSource {
  return value === 'supabase' ? 'supabase' : 'json';
}
