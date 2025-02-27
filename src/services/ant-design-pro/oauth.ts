import { request } from '@umijs/max';

interface OAuthConfigResponse {
  data: {
    clientId: string;
    authUri: string;
    scopes: string[];
    redirectUri: string;
  };
  success: boolean;
}

/** 获取 OAuth 配置 GET /api/oauth/google/config */
export async function getOAuthConfig(provider: string) {
  return request<OAuthConfigResponse>('/api/oauth/google/config', {
    method: 'GET',
    params: { provider },
  });
}
