import { createContext, useCallback, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { APP_CONFIG } from '../config';
import { supabase } from './supabase';
import { isConfigAccessDenied, navigationQueryOptions, screenQueryOptions } from './configQueries';
import { findStaticScreen } from './screenConfig';
import type { ModuleConfigSource } from './moduleConfigSource';

export const ConfigScopeContext = createContext('anonymous');
export const ConfigSourceContext = createContext<ModuleConfigSource>('json');
export function usePrefetchScreen() {
  const scope = useContext(ConfigScopeContext);
  const source = useContext(ConfigSourceContext);
  const client = useQueryClient();
  return useCallback((id: string) => {
    if (source === 'json') return;
    void client.prefetchQuery(screenQueryOptions(scope, id, supabase));
  }, [client, scope, source]);
}
export function useModuleNavigation() {
  const scope = useContext(ConfigScopeContext);
  const source = useContext(ConfigSourceContext);
  const query = useQuery({ ...navigationQueryOptions(scope, supabase), enabled: source === 'supabase' });
  return { ...query, data: source === 'json' ? undefined : query.data, isError: source === 'supabase' && query.isError };
}
export function useScreenConfig(moduleId: string, screenId: string) {
  const scope = useContext(ConfigScopeContext);
  const source = useContext(ConfigSourceContext);
  const query = useQuery({ ...screenQueryOptions(scope, screenId, supabase), enabled: source === 'supabase' && Boolean(screenId) });
  const staticScreen = findStaticScreen(APP_CONFIG, moduleId, screenId);
  const accessDenied = source === 'supabase' && isConfigAccessDenied(query.error);
  const moduleMismatch = source === 'supabase' && Boolean(query.data && query.data.moduleId !== moduleId);
  // Metadata never substitutes a complete config. Static fallback is shown only after a failed/missing detail.
  const config = source === 'json' ? staticScreen : moduleMismatch || accessDenied ? undefined : query.data?.config ??
    (query.isError || query.isSuccess ? staticScreen : undefined);
  return { ...query, config, moduleMismatch, accessDenied,
    isPending: source === 'supabase' && query.isPending,
    isFetching: source === 'supabase' && query.isFetching,
    isError: source === 'supabase' && query.isError,
  };
}

