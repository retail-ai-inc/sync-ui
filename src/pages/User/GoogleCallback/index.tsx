import { Spin, message } from 'antd';
import { useEffect } from 'react';
import { history, useModel } from '@umijs/max';
import { handleGoogleCallback } from '@/services/ant-design-pro/user';

const GoogleCallbackPage: React.FC = () => {
  const { initialState, setInitialState } = useModel('@@initialState');

  useEffect(() => {
    const processCode = async () => {
      try {
        // 从URL获取授权码
        const query = new URLSearchParams(window.location.search);
        const code = query.get('code');

        if (!code) {
          message.error('未获取到授权码');
          setTimeout(() => {
            history.push('/user/login');
          }, 1500);
          return;
        }

        // 处理授权码 - 调用API
        const response = await handleGoogleCallback(code);

        // 检查响应中是否包含accessToken
        if (response.accessToken) {
          try {
            // 确保token已保存
            if (response.accessToken) {
              localStorage.setItem('accessToken', response.accessToken);
            }

            // 延迟刷新用户状态，确保token已生效
            setTimeout(async () => {
              try {
                if (initialState?.fetchUserInfo) {
                  const userInfo = await initialState.fetchUserInfo();

                  if (userInfo) {
                    // 更新initialState
                    await setInitialState((s) => ({
                      ...s,
                      currentUser: userInfo,
                    }));

                    // 确保用户状态更新后再重定向
                    setTimeout(() => {
                      const token = localStorage.getItem('accessToken');
                      if (token) {
                        history.push('/');
                      } else {
                        message.error('登录状态异常，请重新登录');
                        history.push('/user/login');
                      }
                    }, 500);
                  } else {
                    message.error('获取用户信息失败');
                    history.push('/user/login');
                  }
                }
              } catch (error) {
                console.error('获取用户信息失败:', error);
                message.error('登录成功，但获取用户信息失败');
                history.push('/user/login');
              }
            }, 500);
          } catch (error) {
            console.error('处理认证信息失败:', error);
            message.error('登录处理失败');
            history.push('/user/login');
          }
        } else {
          message.error(response.errorMessage || '登录失败，请稍后再试');
          setTimeout(() => {
            history.push('/user/login');
          }, 1500);
        }
      } catch (error) {
        message.error('Google登录处理失败');
        console.error('Google登录处理失败:', error);
        setTimeout(() => {
          history.push('/user/login');
        }, 1500);
      }
    };

    processCode();
  }, []);

  // 显示简单的加载状态，很快就会重定向
  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
    >
      <Spin size="large" tip="正在处理登录请求..." />
    </div>
  );
};

export default GoogleCallbackPage;
