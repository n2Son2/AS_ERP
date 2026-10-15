import type { QueryClient } from '@tanstack/react-query';

export const configKeys = {
  navigation: (scope: string) => ['module_navigation', scope] as const,
  screen: (scope: string, id: string) => ['screen_config', scope, id] as const,
};

export function invalidateTableMutation(client: QueryClient, tableName: string, ids?: string[]) {
  void client.invalidateQueries({ queryKey: ['table_data', tableName] });
  void client.invalidateQueries({ queryKey: ['select_options', tableName] });
  if (tableName !== 'app_functions') return;
  void client.invalidateQueries({ queryKey: ['module_navigation'] });
  void client.invalidateQueries({ predicate: query =>
    query.queryKey[0] === 'screen_config' && (!ids?.length || ids.includes(String(query.queryKey[2]))) });
}
