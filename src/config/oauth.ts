// 根据环境变量或构建配置选择客户端ID
const getGoogleClientId = () => {
  // 您可以根据需要添加更多环境特定客户端ID
  const clientIds = {
    development: '495370126123-jk59og3bur7uuqgsct21bvgsb9maeb9q.apps.googleusercontent.com',
    production: '您的生产环境客户端ID', // 替换为生产环境ID
  };

  const env = process.env.NODE_ENV || 'development';
  return clientIds[env] || clientIds.development;
};

export const googleOAuthConfig = {
  clientId: getGoogleClientId(),
  scopes: ['email', 'profile'],
  getAuthUrl: () => {
    const currentHost = window.location.origin;
    const redirectUri = `${currentHost}/auth/google/callback`;

    return `https://accounts.google.com/o/oauth2/auth?client_id=${
      googleOAuthConfig.clientId
    }&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${googleOAuthConfig.scopes.join(
      ' ',
    )}&response_type=code`;
  },
};
