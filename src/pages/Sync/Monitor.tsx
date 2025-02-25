/**
 * Monitor.tsx
 * src/pages/Sync/Monitor.tsx
 */
import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  message,
  Table,
  Tag,
  Input,
  Select,
  Space,
  DatePicker,
  Radio,
  Switch,
  Checkbox,
} from 'antd';
import { useSearchParams, useNavigate } from '@umijs/max';
import {
  fetchMonitorData,
  fetchSyncLogs,
  fetchSyncMetrics,
  startSync,
  stopSync,
} from '@/services/ant-design-pro/sync';
import { Line } from '@ant-design/plots';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface LogItem {
  time: string;
  level: string;
  message: string;
}

interface ChartPoint {
  time: string;
  value: number;
  type: string; // 'source', 'target', 'diff', etc.
  table?: string; // 后端返回的字段
}

interface MetricsData {
  rowCountTrend: ChartPoint[];
  syncEventStats: ChartPoint[];
}

interface MonitorData {
  progress: number;
  tps: number;
  delay: number;
  status: string;
}

const Monitor: React.FC = () => {
  const [monitorData, setMonitorData] = useState<MonitorData>({
    progress: 0,
    tps: 0,
    delay: 0,
    status: 'Unknown',
  });

  // For logs
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logLevel, setLogLevel] = useState<string>('');
  const [logSearch, setLogSearch] = useState<string>('');

  // Global auto refresh
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Metrics & time range
  const [metrics, setMetrics] = useState<MetricsData>({
    rowCountTrend: [],
    syncEventStats: [],
  });
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [customTimeRange, setCustomTimeRange] = useState<[any, any]>();

  // Checkboxes for rowCountTrend
  const [showSource, setShowSource] = useState<boolean>(true);
  const [showTarget, setShowTarget] = useState<boolean>(true);
  const [showDiff, setShowDiff] = useState<boolean>(true);

  // Checkboxes for syncEventStats
  const [showInsert, setShowInsert] = useState<boolean>(true);
  const [showDelete, setShowDelete] = useState<boolean>(true);
  const [showUpdate, setShowUpdate] = useState<boolean>(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const taskId = searchParams.get('taskId');

  // ========== Reusable "loadMetrics" with parameters ==========
  const loadMetricsImpl = async (rangeParam?: string, startTime?: string, endTime?: string) => {
    if (!taskId) return;
    try {
      const res = await fetchSyncMetrics(Number(taskId), {
        range: rangeParam,
        startTime,
        endTime,
      });
      if (res.success && res.data) {
        const safeRowCountTrend = Array.isArray(res.data.rowCountTrend)
          ? res.data.rowCountTrend
          : [];
        const safeSyncEventStats = Array.isArray(res.data.syncEventStats)
          ? res.data.syncEventStats
          : [];
        setMetrics({
          rowCountTrend: safeRowCountTrend,
          syncEventStats: safeSyncEventStats,
        });
      }
    } catch {
      message.error('Failed to load metrics data');
    }
  };

  // ========== API Calls ==========
  const loadMonitor = async () => {
    if (!taskId) return;
    try {
      const res = await fetchMonitorData(Number(taskId));
      if (res.success) {
        const { progress, tps, delay, status } = res.data;
        setMonitorData({ progress, tps, delay, status });
      }
    } catch {
      message.error('Failed to load monitoring data');
    }
  };

  const loadMetrics = async () => {
    if (timeRange !== 'custom') {
      loadMetricsImpl(timeRange);
    } else {
      const startStr = customTimeRange?.[0]?.toISOString();
      const endStr = customTimeRange?.[1]?.toISOString();
      loadMetricsImpl(timeRange, startStr, endStr);
    }
  };

  const loadLogs = async () => {
    if (!taskId) return;
    try {
      const res = await fetchSyncLogs(Number(taskId), {
        level: logLevel,
        search: logSearch,
      });
      if (res.success) {
        setLogs(res.data);
      }
    } catch {
      message.error('Failed to load logs');
    }
  };

  // Pause => call stopSync
  const handlePause = async () => {
    if (!taskId) return;
    try {
      const res = await stopSync(Number(taskId));
      if (res.success) {
        message.success(res.data.msg || 'Paused successfully');
        loadMonitor();
      } else {
        message.error('Pause failed');
      }
    } catch {
      message.error('Pause failed');
    }
  };

  // Resume => call startSync
  const handleResume = async () => {
    if (!taskId) return;
    try {
      const res = await startSync(Number(taskId));
      if (res.success) {
        message.success(res.data.msg || 'Resumed successfully');
        loadMonitor();
      } else {
        message.error('Resume failed');
      }
    } catch {
      message.error('Resume failed');
    }
  };

  // ========== Effects ==========
  useEffect(() => {
    loadMonitor();
    loadMetricsImpl('1h');
    loadLogs();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (autoRefresh) {
      timer = setInterval(() => {
        loadMonitor();
        loadMetrics();
        loadLogs();
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoRefresh, timeRange, customTimeRange, logLevel, logSearch]);

  // ========== Handlers ==========
  const handleTimeRangeChange = (e: any) => {
    const newRange = e.target.value;
    setTimeRange(newRange);
    setCustomTimeRange(undefined);
    if (newRange !== 'custom') {
      loadMetricsImpl(newRange);
    }
  };

  const handleCustomTimeChange = (dates: any) => {
    setCustomTimeRange(dates);
    if (dates && dates.length === 2) {
      loadMetricsImpl('custom', dates[0].toISOString(), dates[1].toISOString());
    }
  };

  const handleLogsRefresh = () => {
    loadLogs();
  };

  const handleChangeLogLevel = (val: string) => {
    setLogLevel(val);
    loadLogs();
  };

  // ========== Logs Table ==========
  const levelColorMap: Record<string, string> = {
    ERROR: 'red',
    WARN: 'orange',
    INFO: 'blue',
    DEBUG: 'green',
  };

  const columns = [
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => {
        const color = levelColorMap[level.toUpperCase()] || 'blue';
        return <Tag color={color}>{level}</Tag>;
      },
      width: 100,
    },
    {
      title: 'Time',
      dataIndex: 'time',
      key: 'time',
      width: 200,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
    },
  ];

  // ========== Chart Config: Table Row Count Trend (Line) ==========
  // 根据复选框过滤 'source','target','diff'
  const rowCountFilteredRaw = (metrics.rowCountTrend || []).filter((p) => {
    if (p.type === 'source' && !showSource) return false;
    if (p.type === 'target' && !showTarget) return false;
    if (p.type === 'diff' && !showDiff) return false;
    return true;
  });

  // 创建一个颜色映射
  const colorMap = {};
  // const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']; // 颜色数组

  const rowCountFiltered = rowCountFilteredRaw.map((p) => {
    // 如果当前表没有颜色映射，则分配一个新颜色
    if (!colorMap[p.table]) {
      colorMap[p.table] = p.table; // 循环使用颜色
      // colorIndex++; // 删除或注释掉未使用的递增语句
    }
    return {
      ...p,
      tableType: p.table ? `${p.table}-${p.type}` : p.type,
      color: colorMap[p.table], // 为每个表分配颜色
    };
  });

  // 动态计算不同表的 source、target 和 diff 三条线
  const rowCountTrendConfig = {
    data: rowCountFiltered,
    xField: 'time',
    yField: 'value',
    seriesField: 'tableType',
    colorField: 'color',
    smooth: true,
    legend: {
      position: 'top',
    },
    slider: {
      start: 0.1, // Set the initial zoom range for the slider (10% of the data)
      end: 0.9, // Set the initial end of the zoom range (90% of the data)
      x: {
        labelFormatter: (d) => new Date(d).toLocaleDateString(), // Format the x-axis date values
      },
      y: {
        labelFormatter: '~s', // Format Y-axis labels with shorthand notation
      },
    },
    height: 300,
  };

  // ========== Chart Config: Sync Event Statistics (Line) ==========
  const eventStatsFiltered = (metrics.syncEventStats || []).filter((p) => {
    if (p.type === 'insert' && !showInsert) return false;
    if (p.type === 'delete' && !showDelete) return false;
    if (p.type === 'update' && !showUpdate) return false;
    return true;
  });

  const syncEventStatsConfig = {
    data: eventStatsFiltered,
    xField: 'time',
    yField: 'value',
    seriesField: 'type',
    autoFit: true,
    smooth: true,
    slider: {
      start: 0.1,
      end: 0.9,
    },
    legend: { position: 'top' },
    height: 200,
  };

  // ========== Return JSX ==========
  return (
    <Card
      title={
        <Space>
          <span>{`Current Monitoring Task (ID: ${taskId || 'N/A'})`}</span>
          <Tag color={monitorData.status === 'Running' ? 'green' : 'orange'}>
            {monitorData.status}
          </Tag>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={handlePause}>Pause</Button>
          <Button onClick={handleResume} type="primary">
            Resume
          </Button>
          <Switch
            checkedChildren="Auto Refresh"
            unCheckedChildren="Auto Refresh"
            checked={autoRefresh}
            onChange={(checked) => setAutoRefresh(checked)}
          />
          <Button onClick={() => navigate('/Sync')}>Back to list</Button>
        </Space>
      }
    >
      {/* Time range selection */}
      <Card style={{ marginTop: 16 }}>
        <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Radio.Group value={timeRange} onChange={handleTimeRangeChange}>
              <Radio.Button value="1h">Last 1h</Radio.Button>
              <Radio.Button value="3h">Last 3h</Radio.Button>
              <Radio.Button value="6h">Last 6h</Radio.Button>
              <Radio.Button value="12h">Last 12h</Radio.Button>
              <Radio.Button value="1d">Last 1 day</Radio.Button>
              <Radio.Button value="2d">Last 2 days</Radio.Button>
              <Radio.Button value="7d">Last 7 days</Radio.Button>
              <Radio.Button value="custom">Custom</Radio.Button>
            </Radio.Group>
          </Col>
          {timeRange === 'custom' && (
            <Col>
              <RangePicker onChange={handleCustomTimeChange} showTime />
            </Col>
          )}
        </Row>

        {/* Table Row Count Trend */}
        <Card title="Table Row Count Trend" style={{ marginBottom: 16 }}>
          <Space style={{ marginBottom: 16 }}>
            <Checkbox checked={showSource} onChange={(e) => setShowSource(e.target.checked)}>
              Show Source
            </Checkbox>
            <Checkbox checked={showTarget} onChange={(e) => setShowTarget(e.target.checked)}>
              Show Target
            </Checkbox>
            <Checkbox checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)}>
              Show Diff
            </Checkbox>
          </Space>
          <Line {...rowCountTrendConfig} />
        </Card>

        {/* Sync Event Statistics */}
        <Card title="Sync Event Statistics">
          <Space style={{ marginBottom: 16 }}>
            <Checkbox checked={showInsert} onChange={(e) => setShowInsert(e.target.checked)}>
              Insert
            </Checkbox>
            <Checkbox checked={showDelete} onChange={(e) => setShowDelete(e.target.checked)}>
              Delete
            </Checkbox>
            <Checkbox checked={showUpdate} onChange={(e) => setShowUpdate(e.target.checked)}>
              Update
            </Checkbox>
          </Space>
          <Line {...syncEventStatsConfig} />
        </Card>
      </Card>

      {/* Logs Table */}
      <Card title="Error / Warning / Log List" style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="Select level"
            style={{ width: 120 }}
            onChange={handleChangeLogLevel}
            allowClear
            value={logLevel || undefined}
          >
            <Option value="INFO">INFO</Option>
            <Option value="WARN">WARN</Option>
            <Option value="ERROR">ERROR</Option>
            <Option value="DEBUG">DEBUG</Option>
          </Select>
          <Input
            placeholder="Search logs"
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            style={{ width: 200 }}
          />
          <Button onClick={handleLogsRefresh}>Refresh</Button>
        </Space>
        <Table<LogItem>
          columns={columns}
          dataSource={logs}
          rowKey={(record) => record.time + record.message}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
        />
      </Card>
    </Card>
  );
};

export default Monitor;
