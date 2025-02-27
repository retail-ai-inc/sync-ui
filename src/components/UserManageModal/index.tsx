import { Table, Modal, message, Select, Button, Space } from 'antd';
import React, { useState, useEffect } from 'react';
import { useIntl } from '@umijs/max';
import { getAllUsers, updateUserAccess } from '@/services/ant-design-pro/user';
import type { ColumnsType } from 'antd/es/table';

interface UserManageModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface UserTableItem extends API.CurrentUser {
  key: string;
  pendingAccess?: string;
}

const UserManageModal: React.FC<UserManageModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userList, setUserList] = useState<UserTableItem[]>([]);
  const [selectedRows, setSelectedRows] = useState<UserTableItem[]>([]);
  const intl = useIntl();

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

  // 更新用户的权限
  const updateSelectedUsersAccess = async (newAccess: string) => {
    try {
      setLoading(true);

      // 批量更新选中的用户权限
      const updatePromises = selectedRows.map((user) =>
        updateUserAccess(user.userId || '', { access: newAccess }),
      );

      const results = await Promise.all(updatePromises);

      // 检查是否所有更新都成功
      const allSuccess = results.every((result) => result.success);

      if (allSuccess) {
        message.success(intl.formatMessage({ id: 'pages.userManage.updateSuccess' }));
        await fetchUsers(); // 刷新用户列表
        setSelectedRows([]); // 清空选择
        onSuccess();
      } else {
        message.error(intl.formatMessage({ id: 'pages.userManage.updateFailed' }));
      }
    } catch (error) {
      console.error('更新用户权限失败:', error);
      message.error(intl.formatMessage({ id: 'pages.userManage.updateFailed' }));
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
      render: (access) => <span>{access === 'admin' ? '管理员' : '普通用户'}</span>,
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

            // 如果用户已在选中行中，更新选中行
            if (selectedRows.some((row) => row.key === record.key)) {
              const updatedSelectedRows = selectedRows.map((row) =>
                row.key === record.key ? { ...row, pendingAccess: value } : row,
              );
              setSelectedRows(updatedSelectedRows);
            }
          }}
          options={[
            { value: 'admin', label: '管理员' },
            { value: 'guest', label: '普通用户' },
          ]}
        />
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
        disabled={selectedRows.length === 0}
        onClick={() => {
          // 获取选中行中设置了 pendingAccess 的用户，并按权限分组
          const adminUsers = selectedRows.filter((user) => user.pendingAccess === 'admin');
          const guestUsers = selectedRows.filter((user) => user.pendingAccess === 'guest');

          if (adminUsers.length > 0) {
            updateSelectedUsersAccess('admin');
          }

          if (guestUsers.length > 0) {
            updateSelectedUsersAccess('guest');
          }
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
      width={800}
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
