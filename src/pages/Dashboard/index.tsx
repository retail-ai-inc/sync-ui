import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Row, Col, Table, Tag, Spin, Radio, Checkbox, Space, Alert, Tooltip } from 'antd';
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import { fetchSyncMetrics } from '@/services/ant-design-pro/sync';
import styles from './index.less';
import { useIntl } from '@umijs/max';
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
  const [metrics, setMetrics] = useState<any>({ rowCountTrend: [] });
  const [loading, setLoading] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [displayOptions, setDisplayOptions] = useState({
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
  const getFilteredChartData = () => {
    if (!metrics.rowCountTrend || metrics.rowCountTrend.length === 0) return [];

    // 根据复选框过滤数据
    const rowCountFilteredRaw = metrics.rowCountTrend.filter((p: any) => {
      if (p.type === 'source' && !displayOptions.showSource) return false;
      if (p.type === 'target' && !displayOptions.showTarget) return false;
      if (p.type === 'diff' && !displayOptions.showDiff) return false;
      return true;
    });

    // 创建颜色映射
    const colorMap = {};

    // 处理数据，添加 tableType 字段用于图例显示
    const rowCountFiltered = rowCountFilteredRaw.map((p: any) => {
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

  // 模拟数据
  const dbSources = [
    {
      id: 'postgres1',
      name: 'PostgreSQL (Primary)',
      tables: ['users', 'orders', 'products'],
      status: 'healthy',
    },
    { id: 'mysql1', name: 'MySQL (CRM)', tables: ['customers', 'interactions'], status: 'warning' },
  ];

  const dbTargets = [
    { id: 'data-warehouse', name: 'DataHouse', type: 'Snowflake', status: 'healthy' },
    { id: 'replica', name: 'Replication', type: 'PostgreSQL', status: 'healthy' },
  ];

  const syncFlows = [
    {
      id: 'flow1',
      source: 'postgres1',
      sourceTable: 'users',
      target: 'data-warehouse',
      targetTable: 'dim_users',
      status: 'active',
      latency: '1.2s',
      changes: 256,
      mappings: [
        { source: 'ID', target: 'user_id' },
        { source: 'email', target: 'email_address' },
        { source: 'created_at', target: 'created_date' },
      ],
      transformations: ['data desensitization (email)'],
      metrics: {
        syncsToday: '12,583',
        avgLatency: '1.3s',
      },
    },
    {
      id: 'flow2',
      source: 'postgres1',
      sourceTable: 'orders',
      target: 'data-warehouse',
      targetTable: 'fact_orders',
      status: 'active',
      latency: '1.5s',
      changes: 1024,
      mappings: [
        { source: 'order_id', target: 'order_key' },
        { source: 'customer_id', target: 'customer_key' },
        { source: 'amount', target: 'order_amount' },
      ],
      transformations: ['data desensitization'],
      metrics: {
        syncsToday: '24,128',
        avgLatency: '1.5s',
      },
    },
    {
      id: 'flow3',
      source: 'mysql1',
      sourceTable: 'customers',
      target: 'replica',
      targetTable: 'customers',
      status: 'warning',
      latency: '4.2s',
      changes: 128,
      mappings: [
        { source: 'customer_id', target: 'customer_id' },
        { source: 'name', target: 'name' },
        { source: 'contact', target: 'contact' },
      ],
      transformations: ['Preserve the original structure'],
      metrics: {
        syncsToday: '4,892',
        avgLatency: '4.2s',
      },
    },
  ];

  // 监控数据
  const monitoringStats = {
    syncStatus: '98.3%',
    healthyFlows: '2/3',
    currentLatency: '1.3s',
    latencyChange: '-0.3s',
    rowsSynced: '24,583',
    rowsChange: '+18%',
  };

  // 数据流表格列
  const flowColumns = [
    {
      title: intl.formatMessage({ id: 'pages.dashboard.dataFlow' }),
      dataIndex: 'flow',
      key: 'flow',
      render: (_, record) => {
        const source = dbSources.find((s) => s.id === record.source);
        const sourceTable = record.sourceTable;
        const targetTable = record.targetTable;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Text strong>{source?.name}</Text>
              <ArrowRightOutlined style={{ margin: '0 8px' }} />
              <Text>{dbTargets.find((t) => t.id === record.target)?.name}</Text>
            </div>
            <div>
              <Text type="secondary">
                {sourceTable} → {targetTable}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.status' }),
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          active: {
            color: 'green',
            text: intl.formatMessage({ id: 'pages.dashboard.active' }),
          },
          warning: {
            color: 'yellow',
            text: intl.formatMessage({ id: 'pages.dashboard.warning' }),
          },
          error: {
            color: 'red',
            text: intl.formatMessage({ id: 'pages.dashboard.error' }),
          },
          paused: {
            color: 'gray',
            text: intl.formatMessage({ id: 'pages.dashboard.paused' }),
          },
        };
        const { color, text } = statusMap[status] || { color: 'blue', text: status };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.latency' }),
      dataIndex: 'latency',
      key: 'latency',
      render: (latency) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ClockCircleOutlined style={{ marginRight: 8 }} />
          <span>{latency}</span>
        </div>
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.dashboard.changesCount' }),
      dataIndex: 'changes',
      key: 'changes',
    },
  ];

  // 展开行渲染函数
  const expandedRowRender = (record) => {
    return (
      <div className={styles.expandedRow}>
        <Row gutter={24}>
          <Col span={8}>
            <Card
              title={intl.formatMessage({ id: 'pages.dashboard.mappings' })}
              className={styles.expandCard}
            >
              {record.mappings &&
                record.mappings.map((mapping, index) => (
                  <div key={index} className={styles.mappingItem}>
                    <Text>{mapping.source}</Text>
                    <ArrowRightOutlined style={{ margin: '0 8px' }} />
                    <Text>{mapping.target}</Text>
                  </div>
                ))}
            </Card>
          </Col>
          <Col span={8}>
            <Card
              title={intl.formatMessage({ id: 'pages.dashboard.transformations' })}
              className={styles.expandCard}
            >
              {record.transformations &&
                record.transformations.map((transform, index) => (
                  <div key={index} className={styles.transformItem}>
                    <Text>{transform}</Text>
                  </div>
                ))}
            </Card>
          </Col>
          <Col span={8}>
            <Card
              title={intl.formatMessage({ id: 'pages.dashboard.metrics' })}
              className={styles.expandCard}
            >
              <>
                <div className={styles.metricItem}>
                  <strong>{intl.formatMessage({ id: 'pages.dashboard.syncsToday' })}:</strong>{' '}
                  {record.metrics.syncsToday}
                </div>
                <div className={styles.metricItem}>
                  <strong>{intl.formatMessage({ id: 'pages.dashboard.avgLatency' })}:</strong>{' '}
                  {record.metrics.avgLatency}
                </div>
              </>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

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
    },
    legend: { position: 'top' },
    height: 300,
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
      content={
        <Alert
          message={intl.formatMessage({ id: 'pages.dashboard.dataNotice' })}
          description={intl.formatMessage({ id: 'pages.dashboard.dataNoticeDetail' })}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      }
    >
      <Row gutter={24}>
        <Col span={8}>
          <Card className={styles.statCard} bordered={false}>
            <div className={styles.statContent}>
              <div className={styles.statTitle}>
                {intl.formatMessage({ id: 'pages.dashboard.syncStatus' })}
                <Tooltip title={intl.formatMessage({ id: 'pages.dashboard.mockDataHint' })}>
                  <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
                </Tooltip>
              </div>
              <div className={styles.statValue}>
                <CheckCircleOutlined style={{ color: '#3f8600', marginRight: '8px' }} />
                {monitoringStats.syncStatus}
              </div>
              <div className={styles.statFooter}>
                {monitoringStats.healthyFlows}{' '}
                {intl.formatMessage({ id: 'pages.dashboard.healthyFlows' })}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles.statCard} bordered={false}>
            <div className={styles.statContent}>
              <div className={styles.statTitle}>
                {intl.formatMessage({ id: 'pages.dashboard.currentLatency' })}
              </div>
              <div className={styles.statValue}>
                <ClockCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                {monitoringStats.currentLatency}
              </div>
              <div className={styles.statFooter} style={{ color: '#3f8600' }}>
                ↓ {monitoringStats.latencyChange}{' '}
                {intl.formatMessage({ id: 'pages.dashboard.comparedLastWeek' })}
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles.statCard} bordered={false}>
            <div className={styles.statContent}>
              <div className={styles.statTitle}>
                {intl.formatMessage({ id: 'pages.dashboard.rowsSyncedToday' })}
              </div>
              <div className={styles.statValue}>{monitoringStats.rowsSynced}</div>
              <div className={styles.statFooter} style={{ color: '#cf1322' }}>
                ↑ {monitoringStats.rowsChange}{' '}
                {intl.formatMessage({ id: 'pages.dashboard.comparedLastWeek' })}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 表行数趋势图 */}
      <Card
        title={
          <span>
            {intl.formatMessage({ id: 'pages.dashboard.tableRowCountTrend' })}
            <Tag color="green" style={{ marginLeft: 8 }}>
              {intl.formatMessage({ id: 'pages.dashboard.realData' })}
            </Tag>
          </span>
        }
        className={styles.trendCard}
        style={{ marginTop: 24, marginBottom: 24 }}
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

      <Card
        title={
          <span>
            {intl.formatMessage({ id: 'pages.dashboard.activeDataFlows' })}
            <Tooltip title={intl.formatMessage({ id: 'pages.dashboard.mockDataHint' })}>
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
            </Tooltip>
          </span>
        }
        className={styles.dataFlowCard}
        style={{ marginTop: 24 }}
      >
        <Table
          columns={flowColumns}
          dataSource={syncFlows}
          rowKey="id"
          expandable={{
            expandedRowRender,
            expandRowByClick: true,
          }}
          pagination={false}
        />
      </Card>
    </PageContainer>
  );
};

export default Dashboard;
