import { useEffect, useState } from 'react';
import { Spin, message, Button } from 'antd';
import { history, useModel, useIntl } from '@umijs/max';
import { handleGoogleCallback } from '@/services/ant-design-pro/user';
import { flushSync } from 'react-dom';

console.log('=== GoogleCallback组件被加载 ===');

const GoogleCallback: React.FC = () => {
  console.log('GoogleCallback函数组件执行');
  const { initialState, setInitialState } = useModel('@@initialState');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loginSuccess, setLoginSuccess] = useState<boolean>(false);
  const intl = useIntl();

  console.log('GoogleCallback state已初始化');

  useEffect(() => {
    setDebugInfo(intl.formatMessage({ id: 'pages.googleCallback.initializing' }));
  }, [intl]);

  const processGoogleCode = async (code: string) => {
    console.log(`处理授权码: ${code.substring(0, 10)}...`);
    try {
      setDebugInfo(
        (prev) => prev + '\n' + intl.formatMessage({ id: 'pages.googleCallback.processingCode' }),
      );

      console.log('准备发送请求到后端API...');
      const result = await handleGoogleCallback(code);

      console.log('Google回调API响应:', result);
      setDebugInfo((prev) => prev + `\n获得响应: ${JSON.stringify(result)}`);

      if (result.status === 'ok') {
        // token已在handleGoogleCallback函数中存储到localStorage
        setDebugInfo(
          (prev) =>
            prev +
            `\n${intl.formatMessage({ id: 'pages.googleCallback.tokenSaved' })}${result.accessToken?.length || 0}`,
        );

        message.success(intl.formatMessage({ id: 'pages.googleCallback.loginSuccess' }));
        setLoginSuccess(true);

        console.log('正在获取用户信息');
        const userInfo = await initialState?.fetchUserInfo?.();
        console.log('用户信息:', userInfo);

        if (userInfo) {
          // 使用flushSync确保状态立即更新
          flushSync(() => {
            setInitialState((s) => ({
              ...s,
              currentUser: userInfo,
            }));
          });

          setDebugInfo(
            (prev) =>
              prev + '\n' + intl.formatMessage({ id: 'pages.googleCallback.userStateUpdated' }),
          );
          console.log('用户状态已更新，等待重定向...');

          // 添加短暂延迟确保状态更新被应用
          setTimeout(() => {
            console.log('跳转到首页');
            history.push('/');
          }, 200);
        } else {
          throw new Error('获取用户信息失败');
        }
      } else {
        throw new Error('Google登录响应不成功');
      }
    } catch (error) {
      setLoading(false);
      console.error('Google登录处理错误:', error);

      // 详细的错误信息记录
      if (error.response) {
        console.error('错误响应:', error.response);
        setDebugInfo((prev) => prev + `\n错误状态: ${error.response.status}`);
        setDebugInfo((prev) => prev + `\n错误详情: ${JSON.stringify(error.response.data || {})}`);
      }

      setDebugInfo(
        (prev) => prev + `\n错误: ${error instanceof Error ? error.message : String(error)}`,
      );
      message.error(intl.formatMessage({ id: 'pages.googleCallback.loginFailed' }));
    }
  };

  const handleManualProcess = () => {
    console.log('手动处理Google登录');
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      setDebugInfo(intl.formatMessage({ id: 'pages.googleCallback.manualProcessing' }));
      processGoogleCode(code);
    } else {
      setDebugInfo(intl.formatMessage({ id: 'pages.googleCallback.noAuthCodeFound' }));
    }
  };

  useEffect(() => {
    console.log('GoogleCallback useEffect执行');
    console.log('当前URL:', window.location.href);

    setDebugInfo(intl.formatMessage({ id: 'pages.googleCallback.componentLoaded' }));
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      console.log('找到授权码，长度:', code.length);
      setDebugInfo(
        (prev) =>
          prev +
          `\n${intl.formatMessage({ id: 'pages.googleCallback.foundAuthCode' })}${code.substring(0, 10)}...`,
      );

      // 为防止请求超时导致用户卡在加载页面
      const timeoutId = setTimeout(() => {
        setDebugInfo(
          (prev) => prev + '\n' + intl.formatMessage({ id: 'pages.googleCallback.apiTimeout' }),
        );
        setLoading(false);
      }, 10000);

      // 立即处理授权码
      (async () => {
        try {
          await processGoogleCode(code);
          clearTimeout(timeoutId);
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('处理授权码时发生错误:', error);
          setLoading(false);
        }
      })();
    } else {
      console.log('没有找到授权码参数');
      setLoading(false);
      setDebugInfo(intl.formatMessage({ id: 'pages.googleCallback.noAuthCode' }));
      message.error('无效的回调请求：缺少授权码参数');
    }

    return () => {
      console.log('GoogleCallback组件卸载');
    };
  }, [intl]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '20px',
      }}
    >
      {loading ? (
        <Spin size="large" tip={intl.formatMessage({ id: 'pages.googleCallback.processing' })} />
      ) : (
        <>
          <h2>
            {loginSuccess
              ? intl.formatMessage({ id: 'pages.googleCallback.success' })
              : intl.formatMessage({ id: 'pages.googleCallback.debug' })}
          </h2>
          {loginSuccess && (
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <Button type="primary" onClick={() => history.push('/')}>
                {intl.formatMessage({ id: 'pages.googleCallback.enterHome' })}
              </Button>
            </div>
          )}
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '4px',
              width: '80%',
              maxWidth: '800px',
              overflowX: 'auto',
              margin: '20px 0',
            }}
          >
            {debugInfo}
          </pre>
          {!loginSuccess && (
            <>
              <Button type="primary" onClick={handleManualProcess}>
                {intl.formatMessage({ id: 'pages.googleCallback.retry' })}
              </Button>
              <Button style={{ marginTop: '10px' }} onClick={() => history.push('/user/login')}>
                {intl.formatMessage({ id: 'pages.googleCallback.returnLogin' })}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GoogleCallback;
