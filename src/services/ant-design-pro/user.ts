// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';

/** 获取当前的用户 GET /api/currentUser */
export async function currentUser(options?: { [key: string]: any }) {
  return request<{
    data: API.CurrentUser;
  }>('/api/currentUser', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 退出登录接口 POST /api/logout */
export async function logout(options?: { [key: string]: any }) {
  const response = await request<Record<string, any>>('/api/logout', {
    method: 'POST',
    ...(options || {}),
  });

  // 清除本地存储的 token
  localStorage.removeItem('accessToken');

  return response;
}

/** 登录接口 POST /api/login */
export async function login(body: API.LoginParams, options?: { [key: string]: any }) {
  const response = await request<API.LoginResult>('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });

  // 保存 token 到 localStorage
  if (response.accessToken) {
    localStorage.setItem('accessToken', response.accessToken);
  }

  return response;
}

/** Google OAuth 登录回调处理 */
export async function handleGoogleCallback(code: string, options?: { [key: string]: any }) {
  try {
    const response = await request<API.LoginResult & { errorMessage?: string }>(
      '/api/login/google/callback',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        data: { code },
        ...(options || {}),
      },
    );

    // 只有在响应中有accessToken时才保存token
    if (response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
    }

    return response;
  } catch (error) {
    console.error('Google callback API调用失败:', error);
    return {
      status: 'error',
      errorMessage: '登录服务暂时不可用，请稍后再试',
    };
  }
}

/** 修改管理员密码 PUT /api/updateAdminPassword */
export async function updateAdminPassword(
  params: { oldPassword: string; newPassword: string },
  options?: { [key: string]: any },
) {
  return request<API.UpdatePasswordResult>('/api/updateAdminPassword', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    data: params,
    ...(options || {}),
  });
}

/** 获取当前登录状态 GET /api/auth/status */
export async function getAuthStatus(options?: { [key: string]: any }) {
  return request<{
    isAuthenticated: boolean;
    tokenInfo?: {
      expiresAt?: number;
    };
  }>('/api/auth/status', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取所有用户列表 GET /api/users */
export async function getAllUsers(options?: { [key: string]: any }) {
  return request<{
    data: API.CurrentUser[];
    success: boolean;
    total?: number;
  }>('/api/users', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 删除用户 DELETE /api/users */
export async function deleteUser(userId: string, options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    message?: string;
  }>('/api/users', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    data: { userId },
    ...(options || {}),
  });
}

/** 更新用户权限和状态 PUT /api/users/access */
export async function updateUserAccess(
  userId: string,
  params: { access?: string; status?: string },
  options?: { [key: string]: any },
) {
  return request<{
    success: boolean;
    data?: API.CurrentUser;
    errorMessage?: string;
  }>('/api/users/access', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    data: { ...params, userId },
    ...(options || {}),
  });
}
