/**
 * 认证相关工具函数
 */

// 获取token及相关信息
export const getAuthInfo = () => {
  const token = localStorage.getItem('accessToken');
  return {
    isLoggedIn: !!token,
    token: token,
  };
};

// 保存从Google或账号登录获取的token
export const saveAuthToken = (token: string, tokenType = 'Bearer') => {
  if (!token) return false;

  localStorage.setItem('accessToken', token);
  localStorage.setItem('tokenType', tokenType);
  localStorage.setItem('loginTime', Date.now().toString());

  return true;
};

// 获取 token
export const getToken = (): string | null => {
  return localStorage.getItem('accessToken');
};

// 设置 token
export const setToken = (token: string): void => {
  localStorage.setItem('accessToken', token);
};

// 清除 token
export const removeToken = (): void => {
  localStorage.removeItem('accessToken');
};

// 检查是否已登录
export const isLoggedIn = (): boolean => {
  return !!getToken();
};
