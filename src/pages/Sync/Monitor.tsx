/**
 * Monitor.tsx
 * src/pages/Sync/Monitor.tsx
 */
import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Progress,
  Row,
  Col,
  Statistic,
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
import { Line } from '@ant-design/plots'; // changed to a single Line chart for rowCountTrend

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
  type: string; // 'source', 'target', 'diff', or 'insert', 'delete', 'update'
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
    if (!taskId) return;
    try {
      const res = await fetchSyncMetrics(Number(taskId), {
        range: timeRange,
        startTime: customTimeRange?.[0]?.toISOString(),
        endTime: customTimeRange?.[1]?.toISOString(),
      });
      if (res.success) {
        setMetrics(res.data);
      }
    } catch {
      message.error('Failed to load metrics data');
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
    loadMetrics();
    loadLogs();
    // eslint-disable-next-line
  }, []);

  // Auto refresh everything
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
    // eslint-disable-next-line
  }, [autoRefresh, timeRange, customTimeRange, logLevel, logSearch]);

  // ========== Handlers ==========
  const handleTimeRangeChange = (e: any) => {
    setTimeRange(e.target.value);
    setCustomTimeRange(undefined);
  };

  const handleCustomTimeChange = (dates: any) => {
    setCustomTimeRange(dates);
  };

  const handleMetricsRefresh = () => {
    loadMetrics();
  };

  // Logs
  const handleLogsRefresh = () => {
    loadLogs();
  };

  // When user changes log level => automatically fetch logs
  const handleChangeLogLevel = (val: string) => {
    setLogLevel(val);
    loadLogs();
  };

  // ========== Logs Table ==========
  const columns = [
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => {
        const color = level === 'ERROR' ? 'red' : level === 'WARN' ? 'orange' : 'blue';
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
  // Filter data based on checkboxes (source, target, diff).
  const rowCountFiltered = metrics.rowCountTrend.filter(
    (p) =>
      (p.type === 'source' && showSource) ||
      (p.type === 'target' && showTarget) ||
      (p.type === 'diff' && showDiff),
  );

  const rowCountTrendConfig = {
    data: rowCountFiltered,
    xField: 'time',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    legend: { position: 'top' },
    slider: {},
  };

  // ========== Chart Config: Sync Event Statistics (Line) ==========
  // Filter data based on checkboxes (insert, delete, update).
  const eventStatsFiltered = metrics.syncEventStats.filter(
    (p) =>
      (p.type === 'insert' && showInsert) ||
      (p.type === 'delete' && showDelete) ||
      (p.type === 'update' && showUpdate),
  );

  const syncEventStatsConfig = {
    data: eventStatsFiltered,
    xField: 'time',
    yField: 'value',
    seriesField: 'type',
    autoFit: true,
    smooth: true,
    slider: {},
    legend: { position: 'top' },
  };

  // ========== Return JSX ==========
  return (
    <Card
      title={
        <Space>
          <span>{`Current Monitoring Task (ID: ${taskId || 'N/A'})`}</span>
          {/* Show current status */}
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
          {/* Global auto refresh */}
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
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <p>Current Progress</p>
            <Progress percent={monitorData.progress} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="TPS" value={monitorData.tps} suffix="/s" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Delay" value={monitorData.delay} suffix="s" precision={2} />
          </Card>
        </Col>
      </Row>

      {/* Time range selection & refresh for charts */}
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
          <Col>
            <Button type="primary" onClick={handleMetricsRefresh}>
              Refresh Charts
            </Button>
          </Col>
        </Row>

        {/* (1) Table Row Count Trend as line chart */}
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

        {/* (2) Sync Event Statistics as line chart */}
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
          {/* auto query onChange */}
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
          </Select>
          <Input
            placeholder="Search logs"
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            style={{ width: 200 }}
          />
          {/* Keep a "Refresh" button for convenience */}
          <Button onClick={handleLogsRefresh}>Refresh</Button>
        </Space>
        <Table<LogItem>
          columns={columns}
          dataSource={logs}
          rowKey={(record) => record.time + record.message}
          pagination={{ pageSize: 5 }}
        />
      </Card>
    </Card>
  );
};

export default Monitor;
