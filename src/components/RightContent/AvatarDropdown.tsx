import { logout } from '@/services/ant-design-pro/user';
import {
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
  LockOutlined,
  TeamOutlined,
  SafetyOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import { Spin } from 'antd';
import type { MenuProps } from 'antd';
import { createStyles } from 'antd-style';
import { stringify } from 'querystring';
import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import HeaderDropdown from '../HeaderDropdown';
import PasswordModal from '@/components/PasswordModal';
import { useIntl } from '@umijs/max';
import UserManageModal from '@/components/UserManageModal';

export type GlobalHeaderRightProps = {
  menu?: boolean;
  children?: React.ReactNode;
};

export const AvatarName = () => {
  const { initialState } = useModel('@@initialState');
  const { currentUser } = initialState || {};
  return <span className="anticon">{currentUser?.name}</span>;
};

const useStyles = createStyles(({ token }) => {
  return {
    action: {
      display: 'flex',
      height: '48px',
      marginLeft: 'auto',
      overflow: 'hidden',
      alignItems: 'center',
      padding: '0 8px',
      cursor: 'pointer',
      borderRadius: token.borderRadius,
      '&:hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
  };
});

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({ menu, children }) => {
  /**
   * 退出登录，并且将当前的 url 保存
   */
  const loginOut = async () => {
    await logout();
    const { search, pathname } = window.location;
    const urlParams = new URL(window.location.href).searchParams;
    /** 此方法会跳转到 redirect 参数所在的位置 */
    const redirect = urlParams.get('redirect');
    // Note: There may be security issues, please note
    if (window.location.pathname !== '/user/login' && !redirect) {
      history.replace({
        pathname: '/user/login',
        search: stringify({
          redirect: pathname + search,
        }),
      });
    }
  };

  // 添加密码修改模态框状态
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  // 添加用户管理模态框状态
  const [userManageModalVisible, setUserManageModalVisible] = useState(false);

  const { styles } = useStyles();
  const { initialState, setInitialState } = useModel('@@initialState');
  const intl = useIntl();

  const onMenuClick: MenuProps['onClick'] = (event) => {
    const { key } = event;
    if (key === 'logout') {
      flushSync(() => {
        setInitialState((s) => ({ ...s, currentUser: undefined }));
      });
      loginOut();
      return;
    }
    // 处理密码修改菜单项点击
    if (key === 'password') {
      setPasswordModalVisible(true);
      return;
    }
    // 处理用户管理菜单项点击
    if (key === 'userManage') {
      setUserManageModalVisible(true);
      return;
    }
    // 处理系统设置菜单项点击
    if (key === 'authSettings') {
      history.push('/settings/auth');
      return;
    }
    // 处理SQL Debug Tool菜单项点击
    if (key === 'sqlDebug') {
      history.push('/sql-debug');
      return;
    }
    history.push(`/account/${key}`);
  };

  const loading = (
    <span className={styles.action}>
      <Spin
        size="small"
        style={{
          marginLeft: 8,
          marginRight: 8,
        }}
      />
    </span>
  );

  if (!initialState) {
    return loading;
  }

  const { currentUser } = initialState;

  if (!currentUser || !currentUser.name) {
    return loading;
  }

  // 检查用户是否为管理员
  const isAdmin = currentUser && currentUser.access === 'admin';

  const menuItems: MenuProps['items'] = [
    ...(menu
      ? [
          {
            key: 'center',
            icon: <UserOutlined />,
            label: intl.formatMessage({ id: 'menu.account.center' }),
          },
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: intl.formatMessage({ id: 'menu.account.settings' }),
          },
          {
            type: 'divider' as const,
          },
        ]
      : []),
    // 只有管理员才显示修改密码、用户管理和系统设置选项
    ...(isAdmin
      ? [
          {
            key: 'password',
            icon: <LockOutlined />,
            label: intl.formatMessage({ id: 'menu.account.password' }),
          },
          {
            key: 'userManage',
            icon: <TeamOutlined />,
            label: intl.formatMessage({ id: 'menu.account.userManage' }),
          },
          {
            key: 'authSettings',
            icon: <SafetyOutlined />,
            label: intl.formatMessage({ id: 'menu.account.authSettings' }),
          },
          {
            key: 'sqlDebug',
            icon: <CodeOutlined />,
            label: intl.formatMessage({ id: 'menu.account.sqlDebug' }),
          },
        ]
      : []),
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: intl.formatMessage({ id: 'menu.account.logout' }),
    },
  ];

  // 渲染下拉菜单和模态框
  return (
    <>
      <HeaderDropdown
        menu={{
          selectedKeys: [],
          onClick: onMenuClick,
          items: menuItems,
        }}
      >
        {children}
      </HeaderDropdown>

      {/* 密码修改模态框 */}
      <PasswordModal
        visible={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        onSuccess={() => setPasswordModalVisible(false)}
      />

      {/* 用户管理模态框 */}
      <UserManageModal
        visible={userManageModalVisible}
        onCancel={() => setUserManageModalVisible(false)}
        onSuccess={() => setUserManageModalVisible(false)}
      />
    </>
  );
};
