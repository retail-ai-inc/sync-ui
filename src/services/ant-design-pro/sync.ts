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
export async function updateSyncTask(data: any) {
  const { id, ...rest } = data;
  return request<{ success: boolean; data: any }>(`/api/sync/${id}`, {
    method: 'PUT',
    data: rest,
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
