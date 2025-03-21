import { Footer } from '@/components';
import { login } from '@/services/ant-design-pro/user';
import { UserOutlined, LockOutlined, GoogleOutlined } from '@ant-design/icons';
import { LoginForm, ProFormCheckbox, ProFormText } from '@ant-design/pro-components';
import { FormattedMessage, Helmet, history, SelectLang, useIntl, useModel } from '@umijs/max';
import { Alert, message, Button } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import Settings from '../../../../config/defaultSettings';
import { getOAuthConfig } from '@/services/ant-design-pro/oauth';

const useStyles = createStyles(({ token }) => {
  return {
    action: {
      marginLeft: '8px',
      color: 'rgba(0, 0, 0, 0.2)',
      fontSize: '24px',
      verticalAlign: 'middle',
      cursor: 'pointer',
      transition: 'color 0.3s',
      '&:hover': {
        color: token.colorPrimaryActive,
      },
    },
    lang: {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      borderRadius: token.borderRadius,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      backgroundImage:
        "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')",
      backgroundSize: '100% 100%',
    },
  };
});

const Lang = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.lang} data-lang>
      {SelectLang && <SelectLang />}
    </div>
  );
};

const LoginMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      message={content}
      type="error"
      showIcon
    />
  );
};

const Login: React.FC = () => {
  const [userLoginState, setUserLoginState] = useState<API.LoginResult>({});
  const [googleConfigLoaded, setGoogleConfigLoaded] = useState<boolean>(false);
  const [googleConfig, setGoogleConfig] = useState<OAuthConfigResponse['data'] | null>(null);
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const intl = useIntl();
  const [oauthEnabled, setOauthEnabled] = useState<boolean>(false);

  // 获取 Google OAuth 配置
  useEffect(() => {
    const loadGoogleConfig = async () => {
      try {
        // 直接使用getOAuthConfig获取配置和状态
        const response = await getOAuthConfig();
        // 检查是否启用OAuth
        const enabled =
          response.success &&
          (response.data.enabled !== undefined ? response.data.enabled : !!response.data.clientId);
        setOauthEnabled(enabled);

        // 如果启用了，设置配置
        if (enabled && response.data) {
          setGoogleConfig(response.data);
          setGoogleConfigLoaded(true);
        }
      } catch (error) {
        console.error('加载Google登录配置失败:', error);
        setGoogleConfigLoaded(false);
      }
    };

    loadGoogleConfig();
  }, []);

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      flushSync(() => {
        setInitialState((s) => ({
          ...s,
          currentUser: userInfo,
        }));
      });
    }
  };

  const handleSubmit = async (values: API.LoginParams) => {
    try {
      // 登录
      const msg = await login({ ...values, type: 'account' });
      if (msg.status === 'ok') {
        const defaultLoginSuccessMessage = intl.formatMessage({
          id: 'pages.login.success',
        });
        message.success(defaultLoginSuccessMessage);
        await fetchUserInfo();
        const urlParams = new URL(window.location.href).searchParams;
        history.push(urlParams.get('redirect') || '/');
        return;
      }
      console.log(msg);
      // 如果失败去设置用户错误信息
      setUserLoginState(msg);
    } catch (error) {
      const defaultLoginFailureMessage = intl.formatMessage({
        id: 'pages.login.failure',
      });
      console.log(error);
      message.error(defaultLoginFailureMessage);
    }
  };

  const handleGoogleLogin = () => {
    try {
      if (!googleConfig) {
        throw new Error('Google配置未加载');
      }
      const authUrl = `${googleConfig.authUri}?client_id=${
        googleConfig.clientId
      }&redirect_uri=${encodeURIComponent(googleConfig.redirectUri)}&scope=${googleConfig.scopes.join(
        ' ',
      )}&response_type=code`;

      console.log('重定向到Google授权页面');
      window.location.href = authUrl;
    } catch (error) {
      message.error('获取Google登录配置失败');
      console.error('获取Google配置错误:', error);
    }
  };

  const { status } = userLoginState;

  console.log('Current locale:', intl.locale);

  return (
    <div className={styles.container}>
      <Helmet>
        <title>
          {intl.formatMessage({
            id: 'menu.login',
          })}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <Lang />
      <div
        style={{
          flex: '1',
          padding: '32px 0',
        }}
      >
        <LoginForm
          contentStyle={{
            minWidth: 280,
            maxWidth: '75vw',
          }}
          logo={<img alt="logo" src="/logo.svg" />}
          title="Sync Data Platform"
          subTitle={intl.formatMessage({ id: 'pages.layouts.userLayout.title' })}
          submitter={{
            searchConfig: {
              submitText: intl.formatMessage({ id: 'pages.login.submit' }, { locale: 'en-US' }),
            },
          }}
          initialValues={{
            autoLogin: true,
          }}
          onFinish={async (values) => {
            await handleSubmit(values as API.LoginParams);
          }}
        >
          {status === 'error' && (
            <LoginMessage
              content={intl.formatMessage({
                id: 'pages.login.accountLogin.errorMessage',
              })}
            />
          )}
          <ProFormText
            name="username"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
            }}
            placeholder={intl.formatMessage({
              id: 'pages.login.username.placeholder',
            })}
            rules={[
              {
                required: true,
                message: <FormattedMessage id="pages.login.username.required" />,
              },
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
            }}
            placeholder={intl.formatMessage({
              id: 'pages.login.password.placeholder',
            })}
            rules={[
              {
                required: true,
                message: <FormattedMessage id="pages.login.password.required" />,
              },
            ]}
          />
          <div
            style={{
              marginBottom: 24,
            }}
          >
            <ProFormCheckbox noStyle name="autoLogin">
              <FormattedMessage id="pages.login.rememberMe" />
            </ProFormCheckbox>
            <a
              style={{
                float: 'right',
              }}
            ></a>
          </div>

          {googleConfigLoaded && oauthEnabled && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <Button
                icon={<GoogleOutlined />}
                style={{ width: '100%', marginTop: 16 }}
                onClick={handleGoogleLogin}
              >
                {intl.formatMessage({ id: 'pages.login.googleLogin' })}
              </Button>
            </div>
          )}
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
