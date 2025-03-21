import { request } from '@umijs/max';

/**
 * 执行SQL
 * @param params
 * @returns
 */
export async function executeSql(params: { taskId: number; sql: string; target: boolean }) {
  return request<{
    success: boolean;
    data: {
      columns?: string[];
      rows?: any[][];
      affectedRows?: number;
      message?: string;
      executionTime?: string;
    };
  }>('/api/sql/execute', {
    method: 'POST',
    data: params,
  });
}
