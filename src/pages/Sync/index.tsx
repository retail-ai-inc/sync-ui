import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  message,
  Modal,
  Tag,
  Input,
  Dropdown,
  Menu,
  Checkbox,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  RedoOutlined,
  SettingOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import AddSync from './AddSync';
import {
  fetchSyncList,
  startSync,
  stopSync,
  deleteSyncTask,
  fetchSyncTables,
  SyncTableItem,
} from '@/services/ant-design-pro/sync';
import { useNavigate, useAccess } from '@umijs/max';

interface SyncConn {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
}

interface MappingItem {
  sourceTable: string;
  targetTable: string;
}

interface SyncItem {
  id: number;
  taskName?: string;
  sourceType: string;
  status: string;
  lastUpdateTime?: string;
  lastRunTime?: string;

  sourceConn?: SyncConn;
  targetConn?: SyncConn;
  mappings?: {
    sourceDatabase?: string;
    sourceSchema?: string;
    tables: MappingItem[];
    targetDatabase?: string;
    targetSchema?: string;
  }[];
}

interface SyncTablesData {
  syncDate: string;
  tableCount: number;
  tables: SyncTableItem[];
  taskId: string;
}

const statusColorMap: Record<string, string> = {
  Running: 'green',
  Stopped: 'default',
  Error: 'red',
};

const SyncList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncList, setSyncList] = useState<SyncItem[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SyncItem | null>(null);

  // Query
  const [searchValue, setSearchValue] = useState('');

  // Controlling displayed columns
  const [displayColumns, setDisplayColumns] = useState<string[]>([
    'id',
    'taskName',
    'sourceType',
    'source',
    'target',
    'status',
    'lastUpdateTime',
    'lastRunTime',
    'action',
  ]);

  const navigate = useNavigate();
  const searchInputRef = useRef<any>(null);
  const access = useAccess();
  const isGuest = !access.canAdmin;

  const [expandedData, setExpandedData] = useState<Record<number, SyncTablesData>>({});
  const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);
  const [loadingDetails, setLoadingDetails] = useState<Record<number, boolean>>({});

  // 获取任务表详情
  const fetchTaskDetails = async (taskId: number, forceRefresh: boolean = false) => {
    if ((expandedData[taskId] && !forceRefresh) || loadingDetails[taskId]) return Promise.resolve();

    setLoadingDetails((prev) => ({ ...prev, [taskId]: true }));

    try {
      const res = await fetchSyncTables(taskId);
      if (res.success) {
        setExpandedData((prev) => ({ ...prev, [taskId]: res.data }));
        return Promise.resolve(res.data);
      } else {
        message.error('Failed to load task details');
        return Promise.reject(new Error('Failed to load task details'));
      }
    } catch (error) {
      console.error('Error loading task details:', error);
      message.error('Error loading task details');
      return Promise.reject(error);
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  // Load data
  const loadData = async () => {
    setLoading(true);
    // 保存当前已展开的行IDs
    const expandedIds = [...expandedRowKeys];

    try {
      const res = await fetchSyncList();
      if (res.success) {
        console.log('res.data =>', res.data);
        setSyncList(res.data || []);

        // 修改：先清空展开数据，然后等待所有的fetchTaskDetails完成
        setExpandedData({});

        // 使用Promise.all等待所有展开行数据加载完成
        if (expandedIds.length > 0) {
          const detailPromises = expandedIds.map((id) => fetchTaskDetails(id, true));
          await Promise.all(detailPromises);
        }
      }
    } catch (error) {
      message.error('Failed to load data');
    }
    setLoading(false);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  useEffect(() => {
    loadData();

    // Focus the search input after the component mounts
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Start task
  const handleStart = async (id: number) => {
    const res = await startSync(id);
    if (res.success) {
      message.success(res.data.msg);
      loadData();
    }
  };

  // Stop task
  const handleStop = async (id: number) => {
    const res = await stopSync(id);
    if (res.success) {
      message.success(res.data.msg);
      loadData();
    }
  };

  // Edit
  const handleEdit = (record: SyncItem) => {
    setEditingRecord(record);
    setAddModalOpen(true);
  };

  // Delete
  const handleDelete = async (record: SyncItem) => {
    Modal.confirm({
      title: 'Confirm to delete this sync task?',
      content: record.taskName ? `Task Name: ${record.taskName}` : undefined,
      onOk: async () => {
        try {
          const res = await deleteSyncTask(record.id);
          if (res.success) {
            message.success('Deleted successfully');
            loadData();
          } else {
            message.error('Deletion failed');
          }
        } catch (err) {
          message.error('Deletion failed');
        }
      },
    });
  };

  // Search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleSearch = () => {
    message.info(`Search keyword: ${searchValue}`);
  };

  const handleReset = () => {
    setSearchValue('');
  };

  // Toggle column
  const handleToggleColumn = (key: string, checked: boolean) => {
    setDisplayColumns((prev) => {
      if (checked) {
        return [...prev, key];
      }
      return prev.filter((colKey) => colKey !== key);
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: 'Task Name',
      dataIndex: 'taskName',
      key: 'taskName',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Source Type',
      dataIndex: 'sourceType',
      key: 'sourceType',
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      ellipsis: true,
      render: (_: any, record: SyncItem) => {
        const text = record.sourceConn?.host || '';
        return (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Target',
      dataIndex: 'target',
      key: 'target',
      ellipsis: true,
      render: (_: any, record: SyncItem) => {
        const text = record.targetConn?.host || '';
        return (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_: any, record: SyncItem) => {
        return <Tag color={statusColorMap[record.status] || 'default'}>{record.status}</Tag>;
      },
    },
    {
      title: 'Last Update Time',
      dataIndex: 'lastUpdateTime',
      key: 'lastUpdateTime',
    },
    {
      title: 'Last Run Time',
      dataIndex: 'lastRunTime',
      key: 'lastRunTime',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: SyncItem) => (
        <Space>
          {record.status === 'Running' ? (
            <Button
              onClick={() => handleStop(record.id)}
              danger
              disabled={isGuest}
              title={isGuest ? 'Guest用户无权操作' : ''}
            >
              Stop
            </Button>
          ) : (
            <Button
              onClick={() => handleStart(record.id)}
              type="primary"
              disabled={isGuest}
              title={isGuest ? 'Guest用户无权操作' : ''}
            >
              Start
            </Button>
          )}
          <Button onClick={() => navigate(`/Sync/monitor?taskId=${record.id}`)}>Monitor</Button>
          <Button
            onClick={() => handleEdit(record)}
            disabled={isGuest}
            title={isGuest ? 'Guest用户无权操作' : ''}
          >
            Edit
          </Button>
          <Button
            danger
            onClick={() => handleDelete(record)}
            disabled={isGuest}
            title={isGuest ? 'Guest用户无权操作' : ''}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  // Only show chosen columns
  const displayedColumns = columns.filter((col) => displayColumns.includes(col.key as string));

  // Simple front-end filter
  const filteredData = (syncList || []).filter((item) => {
    const kw = searchValue.toLowerCase();
    return (
      (item.taskName || '').toLowerCase().includes(kw) ||
      (item.sourceType || '').toLowerCase().includes(kw) ||
      (item.sourceConn?.host || '').toLowerCase().includes(kw) ||
      (item.targetConn?.host || '').toLowerCase().includes(kw)
    );
  });

  // 计算总的今日同步记录数
  const calculateTotalSyncedToday = (tables: SyncTableItem[]) => {
    return tables.reduce((total, table) => total + table.syncedToday, 0);
  };

  // 根据新的API响应格式更新展开行渲染
  const expandedRowRender = (record: SyncItem) => {
    const data = expandedData[record.id];

    if (loadingDetails[record.id]) {
      return <div style={{ padding: '20px 0', textAlign: 'center' }}>Loading table details...</div>;
    }

    if (!data || !data.tables || data.tables.length === 0) {
      return (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          {data ? 'No table data available' : 'Failed to load table details'}
        </div>
      );
    }

    const totalSyncedToday = calculateTotalSyncedToday(data.tables);

    const detailColumns = [
      {
        title: 'Table Name',
        dataIndex: 'tableName',
        key: 'tableName',
        width: '25%',
      },
      {
        title: 'Records Synced Today',
        dataIndex: 'syncedToday',
        key: 'syncedToday',
        width: '25%',
        sorter: (a: SyncTableItem, b: SyncTableItem) => a.syncedToday - b.syncedToday,
        render: (value: number) => (
          <span>
            <ClockCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            {value.toLocaleString()}
          </span>
        ),
      },
      {
        title: 'Total Rows',
        dataIndex: 'totalRows',
        key: 'totalRows',
        width: '25%',
        sorter: (a: SyncTableItem, b: SyncTableItem) => a.totalRows - b.totalRows,
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: 'Last Sync Time',
        dataIndex: 'lastSyncTime',
        key: 'lastSyncTime',
        width: '25%',
      },
    ];

    return (
      <div style={{ margin: '0 10px' }}>
        <Card
          bordered={false}
          className="expanded-detail-card"
          // title={`Tables in sync task: ${record.taskName || record.id}`}
          title={
            <Space>
              <Tag color="blue">{`Sync Date: ${data.syncDate}`}</Tag>
              <Tag color="green">{`Tables: ${data.tableCount}`}</Tag>
              <Tag color="purple">{`Today Synced: ${totalSyncedToday.toLocaleString()} records`}</Tag>
            </Space>
          }
          style={{ backgroundColor: '#f5f5f5' }}
        >
          <Table
            dataSource={data.tables}
            columns={detailColumns}
            rowKey="tableName"
            pagination={data.tables.length > 10 ? { pageSize: 10 } : false}
            size="small"
            className="gray-table"
            style={{
              backgroundColor: '#f5f5f5',
            }}
            rowClassName={() => 'gray-table-row'}
          />
        </Card>
      </div>
    );
  };

  // 在return语句之前添加以下CSS样式
  const tableStyles = `
    .gray-table .ant-table {
      background-color: #f5f5f5;
    }
    .gray-table .ant-table-thead > tr > th {
      background-color: #f5f5f5;
    }
    .gray-table-row {
      background-color: #f5f5f5;
    }
    .gray-table .ant-table-tbody > tr:hover > td {
      background-color: #e8e8e8;
    }
  `;

  return (
    <>
      <style>{tableStyles}</style>
      <Card
        title="Data Sync Tasks"
        extra={
          <Space>
            <Input
              ref={searchInputRef}
              placeholder="Search keyword"
              value={searchValue}
              onChange={handleSearchChange}
              style={{ width: 150 }}
            />
            <Button onClick={handleSearch}>Search</Button>
            <Button onClick={handleReset}>Reset</Button>

            <Button icon={<RedoOutlined />} onClick={() => loadData()}>
              Refresh
            </Button>

            <Dropdown
              overlay={
                <Menu>
                  {columns.map((col) => (
                    <Menu.Item key={col.key}>
                      <Checkbox
                        checked={displayColumns.includes(col.key as string)}
                        onChange={(e) => handleToggleColumn(col.key as string, e.target.checked)}
                      >
                        {col.title}
                      </Checkbox>
                    </Menu.Item>
                  ))}
                </Menu>
              }
              placement="bottomLeft"
            >
              <Button icon={<SettingOutlined />}>Columns</Button>
            </Dropdown>

            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setEditingRecord(null);
                setAddModalOpen(true);
              }}
              disabled={isGuest}
              title={isGuest ? 'Guest用户无权操作' : ''}
            >
              Add new sync task
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredData}
          columns={displayedColumns}
          rowKey={(record) => record.id}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowRender,
            onExpand: (expanded, record) => {
              if (expanded) {
                fetchTaskDetails(record.id);
                setExpandedRowKeys([...expandedRowKeys, record.id]);
              } else {
                setExpandedRowKeys(expandedRowKeys.filter((key) => key !== record.id));
              }
            },
            expandedRowKeys,
            expandIcon: ({ expanded, onExpand, record }) =>
              expanded ? (
                <Button
                  type="text"
                  icon={
                    <PlusOutlined
                      style={{ transform: 'rotate(45deg)', transition: 'transform 0.2s' }}
                    />
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand(record, e);
                  }}
                  style={{ padding: 0, margin: 0 }}
                />
              ) : (
                <Button
                  type="text"
                  icon={<PlusOutlined style={{ transition: 'transform 0.2s' }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand(record, e);
                  }}
                  style={{ padding: 0, margin: 0 }}
                />
              ),
          }}
          onRow={(record) => ({
            onClick: () => {
              const isExpanded = expandedRowKeys.includes(record.id);
              if (isExpanded) {
                setExpandedRowKeys(expandedRowKeys.filter((key) => key !== record.id));
              } else {
                fetchTaskDetails(record.id);
                setExpandedRowKeys([...expandedRowKeys, record.id]);
              }
            },
          })}
        />

        <Modal
          title={editingRecord ? 'Edit Data Sync Configuration' : 'Add Data Sync Configuration'}
          open={addModalOpen}
          footer={null}
          onCancel={() => setAddModalOpen(false)}
          destroyOnClose
          width={800}
        >
          <AddSync
            record={editingRecord || undefined}
            onSuccess={() => {
              setAddModalOpen(false);
              setEditingRecord(null);
              loadData();
            }}
            onCancel={() => {
              setAddModalOpen(false);
              setEditingRecord(null);
            }}
          />
        </Modal>
      </Card>
    </>
  );
};

export default SyncList;
