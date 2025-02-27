import { useEffect, useState } from 'react';
import { Spin, message, Button } from 'antd';
import { history, useModel } from '@umijs/max';
import { handleGoogleCallback } from '@/services/ant-design-pro/user';
import { flushSync } from 'react-dom';

console.log('=== GoogleCallback组件被加载 ===');

const GoogleCallback: React.FC = () => {
  console.log('GoogleCallback函数组件执行');
  const { initialState, setInitialState } = useModel('@@initialState');
  const [debugInfo, setDebugInfo] = useState<string>('初始化...');
  const [loading, setLoading] = useState<boolean>(true);
  const [loginSuccess, setLoginSuccess] = useState<boolean>(false);

  console.log('GoogleCallback state已初始化');

  const processGoogleCode = async (code: string) => {
    console.log(`处理授权码: ${code.substring(0, 10)}...`);
    try {
      setDebugInfo((prev) => prev + '\n正在处理Google授权码...');

      console.log('准备发送请求到后端API...');
      const result = await handleGoogleCallback(code);

      console.log('Google回调API响应:', result);
      setDebugInfo((prev) => prev + `\n获得响应: ${JSON.stringify(result)}`);

      if (result.status === 'ok') {
        // token已在handleGoogleCallback函数中存储到localStorage
        setDebugInfo((prev) => prev + `\n访问令牌已保存，长度: ${result.accessToken?.length || 0}`);

        message.success('Google登录成功');
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

          setDebugInfo((prev) => prev + '\n用户状态已更新，准备跳转...');
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
      message.error('登录处理失败');
    }
  };

  const handleManualProcess = () => {
    console.log('手动处理Google登录');
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      setDebugInfo('手动处理授权码...');
      processGoogleCode(code);
    } else {
      setDebugInfo('URL中没有找到授权码');
    }
  };

  useEffect(() => {
    console.log('GoogleCallback useEffect执行');
    console.log('当前URL:', window.location.href);

    setDebugInfo('组件已加载，正在处理回调...');
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      console.log('找到授权码，长度:', code.length);
      setDebugInfo((prev) => prev + `\n找到授权码: ${code.substring(0, 10)}...`);

      // 为防止请求超时导致用户卡在加载页面
      const timeoutId = setTimeout(() => {
        setDebugInfo((prev) => prev + '\nAPI请求超时！');
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
      setDebugInfo('没有找到授权码，请确认URL格式正确');
      message.error('无效的回调请求：缺少授权码参数');
    }

    return () => {
      console.log('GoogleCallback组件卸载');
    };
  }, []);

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
        <Spin size="large" tip="正在处理Google登录..." />
      ) : (
        <>
          <h2>{loginSuccess ? '登录成功' : 'Google登录调试'}</h2>
          {loginSuccess && (
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <Button type="primary" onClick={() => history.push('/')}>
                进入首页
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
                重试认证
              </Button>
              <Button style={{ marginTop: '10px' }} onClick={() => history.push('/user/login')}>
                返回登录页
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GoogleCallback;
