/**
 * service/ant-design-pro/sync.ts
 * (No major changes, just referencing that monitor includes "status" field.)
 */
import { request } from '@umijs/max';

/**
 * GET /api/sync
 */
export async function fetchSyncList() {
  return request<{
    success: boolean;
    data: any[];
  }>('/api/sync', {
    method: 'GET',
  });
}

/**
 * POST /api/sync
 */
export async function addSyncTask(data: any) {
  return request<{ success: boolean; data: any }>('/api/sync', {
    method: 'POST',
    data,
  });
}

/**
 * PUT /api/sync/{id}/start
 */
export async function startSync(id: number) {
  return request<{ success: boolean; data: any }>(`/api/sync/${id}/start`, {
    method: 'PUT',
  });
}

/**
 * PUT /api/sync/{id}/stop
 */
export async function stopSync(id: number) {
  return request<{ success: boolean; data: any }>(`/api/sync/${id}/stop`, {
    method: 'PUT',
  });
}

/**
 * GET /api/sync/{id}/monitor
 * now returns "status" in data
 */
export async function fetchMonitorData(id: number) {
  return request<{
    success: boolean;
    data: {
      progress: number;
      tps: number;
      delay: number;
      status: string;
    };
  }>(`/api/sync/${id}/monitor`, {
    method: 'GET',
  });
}

/**
 * GET /api/sync/{id}/metrics
 */
export async function fetchSyncMetrics(id: number, params: any) {
  return request<{
    success: boolean;
    data: {
      rowCountTrend: any[];
      syncEventStats: any[];
    };
  }>(`/api/sync/${id}/metrics`, {
    method: 'GET',
    params,
  });
}

/**
 * GET /api/sync/{id}/logs
 */
export async function fetchSyncLogs(id: number, params: any) {
  return request<{
    success: boolean;
    data: any[];
  }>(`/api/sync/${id}/logs`, {
    method: 'GET',
    params,
  });
}

/**
 * PUT /api/sync/{id}
 */
export async function updateSync(params: { id: string; body: API.SyncListItem }) {
  const { id, body } = params;

  // 确保安全选项的字段设置也被传递到后端
  const requestBody = {
    ...body,
    // 如果存在字段安全设置，确保它们被包含
    securityOptions: body.securityOptions || {},
  };

  return request(`/api/sync/${id}`, {
    method: 'PUT',
    data: requestBody,
  });
}

/**
 * DELETE /api/sync/{id}
 */
export async function deleteSyncTask(id: number) {
  return request<{ success: boolean; data: any }>(`/api/sync/${id}`, {
    method: 'DELETE',
  });
}

/**
 * POST /api/tables/schema
 */
export async function getTableSchema(params: {
  sourceType: string;
  connection: {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  };
  tableName: string;
}) {
  return request('/api/tables/schema', {
    method: 'POST',
    data: params,
  });
}

/**
 * GET /api/sync/{id}/tables
 * 获取同步任务的表详情及同步数据量
 */
export interface SyncTableItem {
  tableName: string;
  syncedToday: number;
  totalRows: number;
  lastSyncTime: string;
}

export interface SyncTablesResponse {
  success: boolean;
  data: {
    syncDate: string;
    tableCount: number;
    tables: SyncTableItem[];
    taskId: string;
  };
}

export async function fetchSyncTables(id: number) {
  return request<SyncTablesResponse>(`/api/sync/${id}/tables`, {
    method: 'GET',
  });
}
