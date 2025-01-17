/**
 * mock/sync.ts
 * Minimal changes: ensure "status" returned by /monitor
 * Show "source"/"target"/"diff" for rowCountTrend
 * Show "insert"/"delete"/"update" for syncEventStats
 */
import { Request, Response } from 'express';

let mockData = [
  {
    id: 1,
    taskName: 'Sync Task 1',
    sourceType: 'MongoDB',
    source: '10.0.0.1/db1',
    target: '10.0.0.2/db2',
    status: 'Running',
    lastUpdateTime: '2025-01-14 12:00:00',
    lastRunTime: '2025-01-14 12:10:00',
    sourceConn: {
      host: '10.0.0.1',
      port: '27017',
      user: '',
      password: '',
      database: 'db1',
    },
    targetConn: {
      host: '10.0.0.2',
      port: '27017',
      user: '',
      password: '',
      database: 'db2',
    },
    mappings: [{ sourceTable: 'users', targetTable: 'users' }],
  },
  {
    id: 2,
    taskName: 'Sync Task 2',
    sourceType: 'MySQL',
    source: '10.0.0.3/db',
    target: '10.0.0.4/db',
    status: 'Stopped',
    lastUpdateTime: '2025-01-14 09:00:00',
    lastRunTime: '2025-01-14 09:30:00',
    sourceConn: {
      host: '10.0.0.3',
      port: '3306',
      user: 'root',
      password: '',
      database: 'test',
    },
    targetConn: {
      host: '10.0.0.4',
      port: '3306',
      user: 'root',
      password: '',
      database: 'test2',
    },
    mappings: [{ sourceTable: 'orders', targetTable: 'orders' }],
  },
  {
    id: 3,
    taskName: 'Sync Task 3',
    sourceType: 'Redis',
    source: '10.0.0.5/db',
    target: '10.0.0.6/db',
    status: 'Error',
    lastUpdateTime: '2025-01-14 08:50:00',
    lastRunTime: '2025-01-14 08:59:00',
    sourceConn: {
      host: '10.0.0.5',
      port: '6379',
      user: '',
      password: '',
      database: '',
    },
    targetConn: {
      host: '10.0.0.6',
      port: '6379',
      user: '',
      password: '',
      database: '',
    },
    mappings: [{ sourceTable: 'logs', targetTable: 'logs' }],
  },
];

/**
 * GET /api/sync
 */
const getSyncList = (req: Request, res: Response) => {
  return res.json({
    success: true,
    data: mockData,
  });
};

/**
 * POST /api/sync
 */
const createSync = (req: Request, res: Response) => {
  const newId = mockData.length + 1;
  const newTask = {
    id: newId,
    status: 'Stopped',
    lastUpdateTime: '2025-01-14 12:30:00',
    lastRunTime: '',
    ...req.body,
    source: `${req.body.sourceConn?.host}/${req.body.sourceConn?.database || ''}`,
    target: `${req.body.targetConn?.host}/${req.body.targetConn?.database || ''}`,
  };
  mockData.push(newTask);
  return res.json({
    success: true,
    data: {
      msg: 'Added successfully',
      formData: newTask,
    },
  });
};

/**
 * PUT /api/sync/:id/start
 */
const putSyncStart = (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = mockData.findIndex((item) => item.id === Number(id));
  if (idx !== -1) {
    mockData[idx].status = 'Running';
    mockData[idx].lastRunTime = new Date().toISOString();
  }
  return res.json({
    success: true,
    data: {
      msg: `Started the sync task: ${id}`,
    },
  });
};

/**
 * PUT /api/sync/:id/stop
 */
const putSyncStop = (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = mockData.findIndex((item) => item.id === Number(id));
  if (idx !== -1) {
    mockData[idx].status = 'Stopped';
  }
  return res.json({
    success: true,
    data: {
      msg: `Stopped the sync task: ${id}`,
    },
  });
};

/**
 * GET /api/sync/:id/monitor
 */
const getSyncMonitor = (req: Request, res: Response) => {
  const { id } = req.params;
  const item = mockData.find((it) => it.id === Number(id));
  if (!item) {
    return res.json({
      success: false,
      data: {},
    });
  }
  // return fixed progress/tps/delay + item.status
  return res.json({
    success: true,
    data: {
      progress: 85,
      tps: 500,
      delay: 0.2,
      status: item.status,
    },
  });
};

/**
 * GET /api/sync/:id/metrics
 * rowCountTrend => [ {time, value, type: source|target|diff}, ... ]
 * syncEventStats => [ {time, value, type: insert|delete|update}, ... ]
 */
const getSyncMetrics = (req: Request, res: Response) => {
  // Minimal mock data for demonstration
  const rowCountTrend = [
    { time: '2025-01-14 10:00', value: 100, type: 'source' },
    { time: '2025-01-14 10:00', value: 90, type: 'target' },
    { time: '2025-01-14 10:00', value: 10, type: 'diff' },

    { time: '2025-01-14 11:00', value: 150, type: 'source' },
    { time: '2025-01-14 11:00', value: 120, type: 'target' },
    { time: '2025-01-14 11:00', value: 30, type: 'diff' },

    { time: '2025-01-14 12:00', value: 180, type: 'source' },
    { time: '2025-01-14 12:00', value: 160, type: 'target' },
    { time: '2025-01-14 12:00', value: 20, type: 'diff' },
  ];

  const syncEventStats = [
    { time: '2025-01-14 10:00', value: 30, type: 'insert' },
    { time: '2025-01-14 10:00', value: 10, type: 'delete' },
    { time: '2025-01-14 10:00', value: 5, type: 'update' },

    { time: '2025-01-14 11:00', value: 40, type: 'insert' },
    { time: '2025-01-14 11:00', value: 8, type: 'delete' },
    { time: '2025-01-14 11:00', value: 10, type: 'update' },

    { time: '2025-01-14 12:00', value: 60, type: 'insert' },
    { time: '2025-01-14 12:00', value: 5, type: 'delete' },
    { time: '2025-01-14 12:00', value: 15, type: 'update' },
  ];

  return res.json({
    success: true,
    data: {
      rowCountTrend,
      syncEventStats,
    },
  });
};

/**
 * GET /api/sync/:id/logs
 */
const getSyncLogs = (req: Request, res: Response) => {
  const { level, search } = req.query;
  const logs = [
    { time: '2025-01-14 10:01:02', level: 'ERROR', message: 'some error log' },
    { time: '2025-01-14 09:59:50', level: 'WARN', message: 'some warning' },
    { time: '2025-01-14 09:59:00', level: 'INFO', message: 'some info message' },
    { time: '2025-01-14 09:58:30', level: 'INFO', message: 'another info' },
  ];

  let filtered = logs;
  if (level) {
    filtered = filtered.filter((item) => item.level === level);
  }
  if (search) {
    filtered = filtered.filter((item) =>
      item.message.toLowerCase().includes((search as string).toLowerCase()),
    );
  }

  return res.json({
    success: true,
    data: filtered,
  });
};

/**
 * PUT /api/sync/:id
 */
const putSyncUpdate = (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = mockData.findIndex((item) => item.id === Number(id));
  if (idx === -1) {
    return res.json({
      success: false,
      data: {
        msg: 'Update failed: no record',
      },
    });
  }
  const updated = {
    ...mockData[idx],
    ...req.body,
    source: `${req.body.sourceConn?.host}/${req.body.sourceConn?.database || ''}`,
    target: `${req.body.targetConn?.host}/${req.body.targetConn?.database || ''}`,
    lastUpdateTime: new Date().toISOString(),
  };
  mockData[idx] = updated;
  return res.json({
    success: true,
    data: {
      msg: 'Update success',
      formData: updated,
    },
  });
};

/**
 * DELETE /api/sync/:id
 */
const deleteSync = (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = mockData.findIndex((item) => item.id === Number(id));
  if (idx === -1) {
    return res.json({
      success: false,
      data: {
        msg: 'Deletion failed: no record',
      },
    });
  }
  mockData.splice(idx, 1);
  return res.json({
    success: true,
    data: {
      msg: 'Deleted successfully',
    },
  });
};

export default {
  'GET /api/sync': getSyncList,
  'POST /api/sync': createSync,
  'PUT /api/sync/:id/start': putSyncStart,
  'PUT /api/sync/:id/stop': putSyncStop,
  'GET /api/sync/:id/monitor': getSyncMonitor,
  'GET /api/sync/:id/metrics': getSyncMetrics,
  'GET /api/sync/:id/logs': getSyncLogs,
  'PUT /api/sync/:id': putSyncUpdate,
  'DELETE /api/sync/:id': deleteSync,
};
