// src/pages/Sync/SyncList.tsx

import React, { useEffect, useState } from 'react';
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
} from 'antd';
import { PlusOutlined, RedoOutlined, SettingOutlined } from '@ant-design/icons';
import AddSync from './AddSync';
import { fetchSyncList, startSync, stopSync, deleteSyncTask } from '@/services/ant-design-pro/sync';
import { useNavigate } from '@umijs/max';

interface SyncItem {
  id: number;
  taskName?: string;
  sourceType: string;
  source: string;
  target: string;
  status: string;

  // Additional fields for new columns
  lastUpdateTime?: string;
  lastRunTime?: string;

  // For editing
  sourceConn?: {
    host?: string;
    port?: string;
    user?: string;
    password?: string;
    database?: string;
  };
  targetConn?: {
    host?: string;
    port?: string;
    user?: string;
    password?: string;
    database?: string;
  };
  mappings?: { sourceTable: string; targetTable: string }[];
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

  // For editing
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

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchSyncList();
      if (res.success) {
        setSyncList(res.data);
      }
    } catch (error) {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
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
    },
    {
      title: 'Target DB',
      dataIndex: 'target',
      key: 'target',
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
            <Button onClick={() => handleStop(record.id)} danger>
              Stop
            </Button>
          ) : (
            <Button onClick={() => handleStart(record.id)} type="primary">
              Start
            </Button>
          )}
          <Button onClick={() => navigate(`/Sync/monitor?taskId=${record.id}`)}>Monitor</Button>
          <Button onClick={() => handleEdit(record)}>Edit</Button>
          <Button danger onClick={() => handleDelete(record)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  // Only show chosen columns
  const displayedColumns = columns.filter((col) => displayColumns.includes(col.key as string));

  // Simple front-end filter
  const filteredData = syncList.filter((item) => {
    const kw = searchValue.toLowerCase();
    return (
      (item.taskName || '').toLowerCase().includes(kw) ||
      item.sourceType.toLowerCase().includes(kw) ||
      item.source.toLowerCase().includes(kw) ||
      item.target.toLowerCase().includes(kw)
    );
  });

  return (
    <Card
      title="Data Sync Tasks"
      extra={
        <Space>
          <Input
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
  );
};

export default SyncList;
