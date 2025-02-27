import { Space } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import React from 'react';
import { SelectLang, useModel } from '@umijs/max';
import { AvatarDropdown as Avatar } from './AvatarDropdown';
import { createStyles } from 'antd-style';

export type SiderTheme = 'light' | 'dark';

// 创建自定义样式
const useStyles = createStyles(({ token }) => {
  return {
    right: {
      display: 'flex',
      float: 'right',
      height: '48px',
      marginLeft: 'auto',
      overflow: 'hidden',
    },
    dark: {
      color: 'white',
    },
    action: {
      display: 'flex',
      alignItems: 'center',
      height: '48px',
      padding: '0 12px',
      cursor: 'pointer',
      transition: 'all 0.3s',
      '&:hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
  };
});

const GlobalHeaderRight: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const { styles } = useStyles();

  if (!initialState || !initialState.settings) {
    return null;
  }

  const { navTheme, layout } = initialState.settings;
  let className = styles.right;

  if ((navTheme === 'dark' && layout === 'top') || layout === 'mix') {
    className = `${styles.right} ${styles.dark}`;
  }

  return (
    <Space className={className}>
      <span
        className={styles.action}
        onClick={() => {
          window.open('https://pro.ant.design/docs/getting-started');
        }}
      >
        <QuestionCircleOutlined />
      </span>
      <Avatar menu />
      <SelectLang className={styles.action} />
    </Space>
  );
};

export default GlobalHeaderRight;
