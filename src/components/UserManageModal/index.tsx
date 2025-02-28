import { Table, Modal, message, Select, Button, Space, Switch, Popconfirm } from 'antd';
import React, { useState, useEffect } from 'react';
import { useIntl, useAccess } from '@umijs/max';
import { getAllUsers, updateUserAccess, deleteUser } from '@/services/ant-design-pro/user';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined } from '@ant-design/icons';

interface UserManageModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface UserTableItem extends API.CurrentUser {
  key: string;
  pendingAccess?: string;
  pendingStatus?: string;
}

const UserManageModal: React.FC<UserManageModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userList, setUserList] = useState<UserTableItem[]>([]);
  const [selectedRows, setSelectedRows] = useState<UserTableItem[]>([]);
  const intl = useIntl();
  const access = useAccess();
  const isGuest = !access.canAdmin;

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const result = await getAllUsers();
      if (result.success && result.data) {
        // 转换用户数据为表格所需格式
        const formattedUsers = result.data.map((user) => ({
          ...user,
          key: user.userId || Math.random().toString(36).substring(2),
        }));
        setUserList(formattedUsers);
      } else {
        message.error(intl.formatMessage({ id: 'pages.userManage.loadFailed' }));
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error(intl.formatMessage({ id: 'pages.userManage.loadFailed' }));
    } finally {
      setLoadingUsers(false);
    }
  };

  // 当模态框显示时获取用户列表
  useEffect(() => {
    if (visible) {
      fetchUsers();
    }
  }, [visible]);

  // 更新用户的权限和状态
  const updateSelectedUsersAccess = async (
    userId: string,
    params: { access?: string; status?: string },
  ) => {
    try {
      setLoading(true);
      const result = await updateUserAccess(userId, params);

      if (result.success) {
        message.success(intl.formatMessage({ id: 'pages.userManage.updateSuccess' }));
        await fetchUsers(); // 刷新用户列表
        setSelectedRows([]); // 清空选择
        onSuccess(); // 通知父组件操作成功
      } else {
        message.error(intl.formatMessage({ id: 'pages.userManage.updateFailed' }));
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
      message.error(intl.formatMessage({ id: 'pages.userManage.updateFailed' }));
    } finally {
      setLoading(false);
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    try {
      setLoading(true);
      const result = await deleteUser(userId);

      if (result.success) {
        message.success(intl.formatMessage({ id: 'pages.userManage.deleteSuccess' }));
        await fetchUsers(); // 刷新用户列表
        onSuccess(); // 通知父组件操作成功
      } else {
        message.error(intl.formatMessage({ id: 'pages.userManage.deleteFailed' }));
      }
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error(intl.formatMessage({ id: 'pages.userManage.deleteFailed' }));
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns: ColumnsType<UserTableItem> = [
    {
      title: intl.formatMessage({ id: 'pages.userManage.username' }),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: intl.formatMessage({ id: 'pages.userManage.email' }),
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: intl.formatMessage({ id: 'pages.userManage.currentAccess' }),
      dataIndex: 'access',
      key: 'access',
      render: (access) => <span>{access === 'admin' ? 'admin' : 'guest'}</span>,
    },
    {
      title: intl.formatMessage({ id: 'pages.userManage.newAccess' }),
      key: 'newAccess',
      render: (_, record) => (
        <Select
          defaultValue={record.access}
          style={{ width: 120 }}
          onChange={(value) => {
            // 更新单个用户的待定权限
            const updatedList = userList.map((user) =>
              user.key === record.key ? { ...user, pendingAccess: value } : user,
            );
            setUserList(updatedList);
          }}
          options={[
            { value: 'admin', label: 'admin' },
            { value: 'guest', label: 'guest' },
          ]}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.userManage.status' }),
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'active' ? 'green' : 'red' }}>
          {status === 'active'
            ? intl.formatMessage({ id: 'pages.userManage.active' })
            : intl.formatMessage({ id: 'pages.userManage.inactive' })}
        </span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.userManage.changeStatus' }),
      key: 'changeStatus',
      render: (_, record) => (
        <Switch
          checked={record.status === 'active'}
          onChange={(checked) => {
            const newStatus = checked ? 'active' : 'inactive';
            updateSelectedUsersAccess(record.userId || '', { status: newStatus });
          }}
          disabled={isGuest}
        />
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.userManage.actions' }),
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title={intl.formatMessage({ id: 'pages.userManage.deleteConfirm' })}
          onConfirm={() => handleDeleteUser(record.userId || '')}
          okText={intl.formatMessage({ id: 'pages.userManage.yes' })}
          cancelText={intl.formatMessage({ id: 'pages.userManage.no' })}
          disabled={isGuest}
        >
          <Button
            danger
            type="default"
            icon={<DeleteOutlined />}
            style={{
              borderColor: '#ff4d4f',
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
            }}
            disabled={isGuest}
            title={isGuest ? 'Guest用户无权操作' : ''}
          >
            {intl.formatMessage({ id: 'pages.userManage.delete' })}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 底部按钮
  const renderFooter = () => (
    <Space>
      <Button onClick={onCancel}>{intl.formatMessage({ id: 'pages.userManage.cancel' })}</Button>
      <Button
        type="primary"
        loading={loading}
        disabled={selectedRows.length === 0 || isGuest}
        onClick={() => {
          // 处理已选择行的权限变更
          selectedRows.forEach((user) => {
            if (user.pendingAccess) {
              updateSelectedUsersAccess(user.userId || '', { access: user.pendingAccess });
            }
          });
        }}
      >
        {intl.formatMessage({ id: 'pages.userManage.apply' })}
      </Button>
    </Space>
  );

  return (
    <Modal
      title={intl.formatMessage({ id: 'pages.userManage.title' })}
      open={visible}
      onCancel={onCancel}
      footer={renderFooter()}
      width={1000}
      maskClosable={false}
    >
      <Table
        rowSelection={{
          type: 'checkbox',
          onChange: (_, selectedRows) => {
            setSelectedRows(selectedRows);
          },
          selectedRowKeys: selectedRows.map((row) => row.key),
        }}
        columns={columns}
        dataSource={userList}
        loading={loadingUsers}
        pagination={{ pageSize: 5 }}
      />
    </Modal>
  );
};

export default UserManageModal;
