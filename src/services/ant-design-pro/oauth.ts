import { request } from '@umijs/max';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface OAuthConfigResponse {
  data: {
    clientId: string;
    clientSecret: string;
    authUri: string;
    redirectUri: string;
    scopes: string[];
    enabled?: boolean;
  };
  success: boolean;
  errorMessage?: string;
}

interface OAuthUpdateResponse {
  success: boolean;
  errorMessage?: string;
}

interface APIResponse {
  success: boolean;
  error?: string;
  errorMessage?: string;
  data: any;
}

/** 获取 OAuth 配置 GET /api/oauth/{provider}/config */
export async function getOAuthConfig(
  provider: string = 'google',
  options?: { [key: string]: any },
) {
  try {
    const response = await request<API.OAuthConfigResponse>(`/api/oauth/${provider}/config`, {
      method: 'GET',
      params: {
        provider,
      },
      ...(options || {}),
    });

    // 如果是"未找到配置"错误，返回一个表示未启用的结果而不是抛出错误
    if (!response.success && response.error === 'No specified OAuth configuration found') {
      return {
        success: true,
        data: { enabled: false },
      };
    }

    return response;
  } catch (error) {
    // 捕获网络错误等，如果是特定错误也返回未启用状态
    console.log('OAuth配置获取错误，视为未启用', error);
    return {
      success: true,
      data: { enabled: false },
    };
  }
}

/** 更新 OAuth 设置 PUT /api/oauth/{provider}/config */
export async function updateOAuthSettings(
  params: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    authUri?: string;
    redirectUri?: string;
    scopes?: string[];
  },
  provider: string = 'google',
) {
  // 获取token
  const token = localStorage.getItem('accessToken');

  return request<OAuthUpdateResponse>(`/api/oauth/${provider}/config`, {
    method: 'PUT',
    params: { provider },
    data: params,
    headers: {
      'X-OAuth-Request': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/** 上传 OAuth 配置文件 POST /api/oauth/{provider}/config */
export async function uploadOAuthConfig(formData: FormData, provider: string = 'google') {
  return request<OAuthUpdateResponse>(`/api/oauth/${provider}/config`, {
    method: 'POST',
    params: { provider },
    requestType: 'form',
    data: formData,
  });
}

// 创建一个包装函数专门处理OAuth请求
export async function safeGetOAuthConfig(
  provider: string = 'google',
  options?: { [key: string]: any },
) {
  try {
    const result = await request<APIResponse>(`/api/oauth/${provider}/config`, {
      method: 'GET',
      params: { provider },
      ...(options || {}),
      headers: {
        'X-OAuth-Request': 'true',
        ...(options?.headers || {}),
      },
    });

    // 如果是特定错误，转换为成功但未启用的响应
    if (!result.success && result.error === 'No specified OAuth configuration found') {
      return { success: true, data: { enabled: false } };
    }

    return result;
  } catch (error) {
    console.log('OAuth请求错误，返回未启用状态', error);
    return { success: true, data: { enabled: false } };
  }
}

// 创建一个包装函数专门处理OAuth设置更新
export async function safeUpdateOAuthSettings(
  params: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    authUri?: string;
    redirectUri?: string;
    scopes?: string[];
  },
  provider: string = 'google',
) {
  try {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      console.error('缺少授权token，无法更新OAuth设置');
      return {
        success: false,
        errorMessage: 'Authorization token required',
      };
    }

    const result = await request<APIResponse>(`/api/oauth/${provider}/config`, {
      method: 'PUT',
      params: { provider },
      data: params,
      headers: {
        'X-OAuth-Request': 'true',
        Authorization: `Bearer ${token}`,
      },
    });

    return result;
  } catch (error) {
    console.log('更新OAuth设置错误', error);

    // 检查是否是权限错误
    if (
      error.response &&
      error.response.data &&
      error.response.data.error === 'Admin privileges required'
    ) {
      return {
        success: false,
        errorMessage: '需要管理员权限',
      };
    }

    return {
      success: false,
      errorMessage: '更新OAuth设置失败',
    };
  }
}
