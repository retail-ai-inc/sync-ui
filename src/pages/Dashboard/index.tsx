import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Spin,
  Radio,
  Checkbox,
  Space,
  Tooltip,
  Typography,
  Statistic,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import {
  fetchSyncMetrics,
  fetchChangeStreamsStatus,
  type ChangeStreamItem,
  type ChangeStreamsSummary,
} from '@/services/ant-design-pro/sync';
import { request } from '@umijs/max';
import styles from './index.less';
import { useIntl } from '@umijs/max';

const { Text } = Typography;

interface TrendDataItem {
  time: string;
  value: number;
  type: string;
  table?: string;
  tableType: string;
  color: string;
}

interface DisplayOptions {
  showSource: boolean;
  showTarget: boolean;
  showDiff: boolean;
}

interface MetricsData {
  rowCountTrend: any[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getOAuthConfig = async (provider = 'google') => {
  try {
    const response = await request(`/api/oauth/${provider}/config`, {
      method: 'GET',
      params: { provider },
    });

    // 处理特定错误
    if (!response.success && response.error === 'No specified OAuth configuration found') {
      return { success: true, data: { enabled: false } };
    }

    return response;
  } catch (error) {
    console.log('OAuth配置获取错误，视为未启用', error);
    return { success: true, data: { enabled: false } };
  }
};

const Dashboard: React.FC = () => {
  const intl = useIntl();
  const [metrics, setMetrics] = useState<MetricsData>({ rowCountTrend: [] });
  const [changeStreamsData, setChangeStreamsData] = useState<{
    changestreams: ChangeStreamItem[];
    summary: ChangeStreamsSummary;
    last_updated: string;
    tasks_count: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [changeStreamsLoading, setChangeStreamsLoading] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    showSource: true,
    showTarget: true,
    showDiff: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showGoogleLogin, setShowGoogleLogin] = useState<boolean>(false);

  // 获取指标数据
  useEffect(() => {
    const fetchMetricsData = async () => {
      setLoading(true);
      try {
        // 获取数据时使用选定的时间范围
        const response = await fetchSyncMetrics(0, {
          range: timeRange, // 使用选定的时间范围
        });
        if (response.success && response.data) {
          console.log('API返回数据:', response.data);
          setMetrics(response.data);
        }
      } catch (error) {
        console.error('获取指标数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetricsData();
  }, [timeRange]); // 当时间范围变化时重新获取数据

  // 获取ChangeStreams状态数据
  useEffect(() => {
    const fetchChangeStreamsData = async () => {
      setChangeStreamsLoading(true);
      try {
        const response = await fetchChangeStreamsStatus();
        if (response.success && response.data) {
          console.log('ChangeStreams数据:', response.data);
          setChangeStreamsData(response.data);
        }
      } catch (error) {
        console.error('获取ChangeStreams数据失败:', error);
      } finally {
        setChangeStreamsLoading(false);
      }
    };

    fetchChangeStreamsData();

    // 每30秒刷新一次数据
    const interval = setInterval(fetchChangeStreamsData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 处理时间范围变化
  const handleTimeRangeChange = (e: any) => {
    setTimeRange(e.target.value);
  };

  // 处理显示选项变化
  const handleDisplayOptionChange = (option: string, checked: boolean) => {
    setDisplayOptions({
      ...displayOptions,
      [option]: checked,
    });
  };

  // 参考 Monitor 页面的图表数据处理方式
  const getFilteredChartData = (): TrendDataItem[] => {
    if (!metrics.rowCountTrend || metrics.rowCountTrend.length === 0) return [];

    // 根据复选框过滤数据
    const rowCountFilteredRaw = metrics.rowCountTrend.filter((p: any) => {
      if (p.type === 'source' && !displayOptions.showSource) return false;
      if (p.type === 'target' && !displayOptions.showTarget) return false;
      if (p.type === 'diff' && !displayOptions.showDiff) return false;
      return true;
    });

    // 创建颜色映射
    const colorMap: Record<string, string> = {};

    // 处理数据，添加 tableType 字段用于图例显示
    const rowCountFiltered: TrendDataItem[] = rowCountFilteredRaw.map((p: any) => {
      if (!colorMap[p.table]) {
        colorMap[p.table] = p.table;
      }
      return {
        ...p,
        tableType: p.table ? `${p.table}-${p.type}` : p.type,
        color: colorMap[p.table],
      };
    });

    return rowCountFiltered;
  };

  // 获取ChangeStream状态颜色和图标
  const getStreamStatus = (stream: ChangeStreamItem) => {
    if (stream.errors > 0) {
      return {
        status: 'error',
        color: 'red',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        text: intl.formatMessage({ id: 'pages.dashboard.error' }),
      };
    }
    if (stream.pending > 0 || stream.received > stream.executed) {
      return {
        status: 'processing',
        color: 'blue',
        icon: <PlayCircleOutlined style={{ color: '#1890ff' }} />,
        text: intl.formatMessage({ id: 'pages.dashboard.processing' }),
      };
    }
    return {
      status: 'idle',
      color: 'green',
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      text: intl.formatMessage({ id: 'pages.dashboard.idle' }),
    };
  };

  // 获取任务组的整体状态
  const getTaskGroupStatus = (streams: ChangeStreamItem[]) => {
    const hasErrors = streams.some((s) => s.errors > 0);
    const hasProcessing = streams.some((s) => s.pending > 0 || s.received > s.executed);

    if (hasErrors) {
      return {
        status: 'error',
        color: 'red',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        text: intl.formatMessage({ id: 'pages.dashboard.error' }),
      };
    }
    if (hasProcessing) {
      return {
        status: 'processing',
        color: 'blue',
        icon: <PlayCircleOutlined style={{ color: '#1890ff' }} />,
        text: intl.formatMessage({ id: 'pages.dashboard.processing' }),
      };
    }
    return {
      status: 'idle',
      color: 'green',
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      text: intl.formatMessage({ id: 'pages.dashboard.idle' }),
    };
  };

  // 按Task ID分组ChangeStreams
  const groupedChangeStreams = React.useMemo(() => {
    if (!changeStreamsData?.changestreams) return {};

    return changeStreamsData.changestreams.reduce(
      (groups, stream) => {
        const taskId = stream.task_id;
        if (!groups[taskId]) {
          groups[taskId] = [];
        }
        groups[taskId].push(stream);
        return groups;
      },
      {} as Record<string, ChangeStreamItem[]>,
    );
  }, [changeStreamsData?.changestreams]);

  // 展开状态管理
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);

  // 任务组表格列
  const taskGroupColumns = [
    {
      title: intl.formatMessage({ id: 'pages.dashboard.taskId' }),
      dataIndex: 'taskId',
      key: 'taskId',
      width: 80,
      render: (taskId: string) => <Tag color="blue">{taskId}</Tag>,
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.status' }),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (_: any, record: any) => {
        const statusInfo = getTaskGroupStatus(record.streams);
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {statusInfo.icon}
            <Tag color={statusInfo.color} style={{ marginLeft: 4 }}>
              {statusInfo.text}
            </Tag>
          </div>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.streamCount' }),
      dataIndex: 'streamCount',
      key: 'streamCount',
      width: 80,
      render: (count: number) => <Statistic value={count} valueStyle={{ fontSize: '12px' }} />,
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.totalReceived' }),
      dataIndex: 'totalReceived',
      key: 'totalReceived',
      width: 80,
      render: (total: number) => <Statistic value={total} valueStyle={{ fontSize: '12px' }} />,
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.totalExecuted' }),
      dataIndex: 'totalExecuted',
      key: 'totalExecuted',
      width: 80,
      render: (total: number) => <Statistic value={total} valueStyle={{ fontSize: '12px' }} />,
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.totalInserted' }),
      dataIndex: 'totalInserted',
      key: 'totalInserted',
      width: 70,
      render: (total: number) => (
        <Statistic value={total} valueStyle={{ fontSize: '12px', color: '#52c41a' }} />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.totalUpdated' }),
      dataIndex: 'totalUpdated',
      key: 'totalUpdated',
      width: 70,
      render: (total: number) => (
        <Statistic value={total} valueStyle={{ fontSize: '12px', color: '#1890ff' }} />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.totalDeleted' }),
      dataIndex: 'totalDeleted',
      key: 'totalDeleted',
      width: 70,
      render: (total: number) => (
        <Statistic value={total} valueStyle={{ fontSize: '12px', color: '#ff7a45' }} />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.pending' }),
      dataIndex: 'totalPending',
      key: 'totalPending',
      width: 70,
      render: (total: number) => (
        <Statistic
          value={total}
          valueStyle={{ fontSize: '12px', color: total > 0 ? '#faad14' : '#52c41a' }}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.errors' }),
      dataIndex: 'totalErrors',
      key: 'totalErrors',
      width: 70,
      render: (total: number) => (
        <Statistic
          value={total}
          valueStyle={{ fontSize: '12px', color: total > 0 ? '#ff4d4f' : '#52c41a' }}
        />
      ),
    },
  ];

  // 详细流表格列
  const streamDetailColumns = [
    {
      title: intl.formatMessage({ id: 'pages.dashboard.streamName' }),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => {
        const [database, table] = name.split('.');
        return (
          <div style={{ paddingLeft: 24 }}>
            <Text strong>{table}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {database}
            </Text>
          </div>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.status' }),
      dataIndex: 'status',
      key: 'status',
      render: (_: any, record: ChangeStreamItem) => {
        const statusInfo = getStreamStatus(record);
        return (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {statusInfo.icon}
            <Tag color={statusInfo.color} style={{ marginLeft: 8 }}>
              {statusInfo.text}
            </Tag>
          </div>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.received' }),
      dataIndex: 'received',
      key: 'received',
      render: (received: number) => (
        <Statistic value={received} valueStyle={{ fontSize: '14px' }} />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.executed' }),
      dataIndex: 'executed',
      key: 'executed',
      render: (executed: number) => (
        <Statistic value={executed} valueStyle={{ fontSize: '14px' }} />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.inserted' }),
      dataIndex: 'inserted',
      key: 'inserted',
      render: (_: any, record: ChangeStreamItem) => (
        <Statistic
          value={record.operations?.inserted || 0}
          valueStyle={{ fontSize: '14px', color: '#52c41a' }}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.updated' }),
      dataIndex: 'updated',
      key: 'updated',
      render: (_: any, record: ChangeStreamItem) => (
        <Statistic
          value={record.operations?.updated || 0}
          valueStyle={{ fontSize: '14px', color: '#1890ff' }}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.deleted' }),
      dataIndex: 'deleted',
      key: 'deleted',
      render: (_: any, record: ChangeStreamItem) => (
        <Statistic
          value={record.operations?.deleted || 0}
          valueStyle={{ fontSize: '14px', color: '#ff7a45' }}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.pending' }),
      dataIndex: 'pending',
      key: 'pending',
      render: (pending: number) => (
        <Statistic
          value={pending}
          valueStyle={{ fontSize: '14px', color: pending > 0 ? '#faad14' : '#52c41a' }}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.errors' }),
      dataIndex: 'errors',
      key: 'errors',
      render: (errors: number) => (
        <Statistic
          value={errors}
          valueStyle={{ fontSize: '14px', color: errors > 0 ? '#ff4d4f' : '#52c41a' }}
        />
      ),
    },
  ];

  // 准备表格数据
  const taskGroupData = React.useMemo(() => {
    return Object.entries(groupedChangeStreams).map(([taskId, streams]) => ({
      key: taskId,
      taskId,
      streams,
      streamCount: streams.length,
      totalReceived: streams.reduce((sum, s) => sum + s.received, 0),
      totalExecuted: streams.reduce((sum, s) => sum + s.executed, 0),
      totalInserted: streams.reduce((sum, s) => sum + (s.operations?.inserted || 0), 0),
      totalUpdated: streams.reduce((sum, s) => sum + (s.operations?.updated || 0), 0),
      totalDeleted: streams.reduce((sum, s) => sum + (s.operations?.deleted || 0), 0),
      totalPending: streams.reduce((sum, s) => sum + s.pending, 0),
      totalErrors: streams.reduce((sum, s) => sum + s.errors, 0),
    }));
  }, [groupedChangeStreams]);

  // 完全按照 Monitor 页面的图表配置
  const rowCountTrendConfig = {
    data: getFilteredChartData(),
    xField: 'time',
    yField: 'value',
    seriesField: 'tableType',
    colorField: 'color',
    autoFit: true,
    smooth: true,
    slider: {
      start: 0.1,
      end: 0.9,
      x: {
        labelFormatter: (d: any) => new Date(d).toLocaleDateString(),
      },
      y: {
        labelFormatter: '~s',
      },
    },
    legend: { position: 'top' },
    height: 280,
  };

  const checkOAuthConfig = async () => {
    try {
      // 使用我们的包装函数
      const result = await getOAuthConfig('google');
      if (result.success && result.data?.enabled) {
        setShowGoogleLogin(true);
      } else {
        setShowGoogleLogin(false);
      }
    } catch (error) {
      setShowGoogleLogin(false);
      console.log('OAuth配置检查错误，不显示Google登录', error);
    }
  };

  // 在组件挂载时检查OAuth配置
  useEffect(() => {
    checkOAuthConfig();
  }, []);

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'pages.dashboard.title' })}
      className={styles.dashboardContainer}
    >
      {/* 统计卡片 */}
      <Row gutter={24} className={styles.statsRow}>
        <Col span={6}>
          <Card className={styles.statCard} bordered={false} loading={changeStreamsLoading}>
            <div className={styles.statContent}>
              <div className={styles.statTitle}>
                {intl.formatMessage({ id: 'pages.dashboard.activeStreams' })}
                <Tooltip title={intl.formatMessage({ id: 'pages.dashboard.realDataHint' })}>
                  <span style={{ display: 'inline-block' }}>
                    <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                  </span>
                </Tooltip>
              </div>
              <div className={styles.statValue}>
                <CheckCircleOutlined style={{ color: '#3f8600', marginRight: '8px' }} />
                {changeStreamsData?.summary.active_streams || 0}
              </div>
              <div className={styles.statFooter}>
                {intl.formatMessage(
                  { id: 'pages.dashboard.totalTasks' },
                  {
                    count: changeStreamsData?.tasks_count || 0,
                  },
                )}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard} bordered={false} loading={changeStreamsLoading}>
            <div className={styles.statContent}>
              <div className={styles.statTitle}>
                {intl.formatMessage({ id: 'pages.dashboard.processingRate' })}
              </div>
              <div className={styles.statValue}>
                <ClockCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                {changeStreamsData?.summary.processing_rate || '0/sec'}
              </div>
              <div className={styles.statFooter}>
                {intl.formatMessage({ id: 'pages.dashboard.realTime' })}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard} bordered={false} loading={changeStreamsLoading}>
            <div className={styles.statContent}>
              <div className={styles.statTitle}>
                {intl.formatMessage({ id: 'pages.dashboard.totalExecuted' })}
              </div>
              <div className={styles.statValue}>
                {changeStreamsData?.summary.total_executed?.toLocaleString() || '0'}
              </div>
              <div className={styles.statFooter}>
                {intl.formatMessage(
                  { id: 'pages.dashboard.totalPending' },
                  {
                    count: changeStreamsData?.summary.total_pending || 0,
                  },
                )}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard} bordered={false} loading={changeStreamsLoading}>
            <div className={styles.statContent}>
              <div className={styles.statTitle}>
                {intl.formatMessage({ id: 'pages.dashboard.totalReceived' })}
              </div>
              <div className={styles.statValue}>
                {changeStreamsData?.summary.total_received?.toLocaleString() || '0'}
              </div>
              <div className={styles.statFooter} style={{ fontSize: '10px', lineHeight: '1.1' }}>
                {changeStreamsData?.last_updated
                  ? intl.formatMessage(
                      { id: 'pages.dashboard.lastUpdated' },
                      {
                        time: new Date(changeStreamsData.last_updated).toLocaleString('ja-JP', {
                          timeZone: 'Asia/Tokyo',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                      },
                    )
                  : intl.formatMessage({ id: 'pages.dashboard.noData' })}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Active ChangeStreams */}
      <Card
        title={
          <div>
            {intl.formatMessage({ id: 'pages.dashboard.activeChangeStreams' })}
            <Tooltip title="Data refreshes automatically every 10 minutes">
              <span style={{ display: 'inline-block' }}>
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
              </span>
            </Tooltip>
          </div>
        }
        className={styles.sectionCard}
      >
        <div>
          {/* 任务组汇总表格 */}
          <Table
            columns={taskGroupColumns}
            dataSource={taskGroupData}
            rowKey="taskId"
            loading={changeStreamsLoading}
            pagination={false}
            size="small"
            className={styles.taskGroupSummary}
            expandable={{
              expandedRowKeys: expandedTasks,
              onExpandedRowsChange: (keys) => setExpandedTasks(keys as string[]),
              expandedRowRender: (record) => (
                <div style={{ margin: 0 }}>
                  <div
                    style={{
                      marginBottom: 8,
                      paddingLeft: 24,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Text type="secondary">
                      {intl.formatMessage({ id: 'pages.dashboard.streamDetails' })}
                    </Text>
                  </div>
                  <Table
                    columns={streamDetailColumns}
                    dataSource={record.streams}
                    rowKey="name"
                    pagination={false}
                    size="small"
                    className={styles.streamDetailTable}
                    showHeader={true}
                    style={{ marginLeft: 24 }}
                  />
                </div>
              ),
            }}
          />
        </div>
      </Card>

      {/* 表行数趋势图 */}
      <Card
        title={
          <div>
            {intl.formatMessage({ id: 'pages.dashboard.tableRowCountTrend' })}
            <Tooltip title="Data refreshes automatically every 10 minutes">
              <span style={{ display: 'inline-block' }}>
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
              </span>
            </Tooltip>
          </div>
        }
        className={styles.sectionCard}
      >
        <div className={styles.chartControls}>
          <div className={styles.timeRangeSelector}>
            <Radio.Group
              value={timeRange}
              onChange={handleTimeRangeChange}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="1h">
                {intl.formatMessage({ id: 'pages.dashboard.lastHour' })}
              </Radio.Button>
              <Radio.Button value="3h">
                {intl.formatMessage({ id: 'pages.dashboard.last3Hours' })}
              </Radio.Button>
              <Radio.Button value="6h">
                {intl.formatMessage({ id: 'pages.dashboard.last6Hours' })}
              </Radio.Button>
              <Radio.Button value="12h">
                {intl.formatMessage({ id: 'pages.dashboard.last12Hours' })}
              </Radio.Button>
              <Radio.Button value="1d">
                {intl.formatMessage({ id: 'pages.dashboard.lastDay' })}
              </Radio.Button>
              <Radio.Button value="2d">
                {intl.formatMessage({ id: 'pages.dashboard.last2Days' })}
              </Radio.Button>
              <Radio.Button value="7d">
                {intl.formatMessage({ id: 'pages.dashboard.last7Days' })}
              </Radio.Button>
              <Radio.Button value="custom">
                {intl.formatMessage({ id: 'pages.dashboard.custom' })}
              </Radio.Button>
            </Radio.Group>
          </div>

          <div className={styles.displayOptions}>
            <Space>
              <Checkbox
                checked={displayOptions.showSource}
                onChange={(e) => handleDisplayOptionChange('showSource', e.target.checked)}
              >
                {intl.formatMessage({ id: 'pages.dashboard.showSource' })}
              </Checkbox>
              <Checkbox
                checked={displayOptions.showTarget}
                onChange={(e) => handleDisplayOptionChange('showTarget', e.target.checked)}
              >
                {intl.formatMessage({ id: 'pages.dashboard.showTarget' })}
              </Checkbox>
              <Checkbox
                checked={displayOptions.showDiff}
                onChange={(e) => handleDisplayOptionChange('showDiff', e.target.checked)}
              >
                {intl.formatMessage({ id: 'pages.dashboard.showDiff' })}
              </Checkbox>
            </Space>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <Spin />
          </div>
        ) : (
          <Line {...rowCountTrendConfig} />
        )}
      </Card>
    </PageContainer>
  );
};

export default Dashboard;
