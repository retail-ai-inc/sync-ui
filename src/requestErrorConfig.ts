import type { RequestOptions } from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import { message } from 'antd';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { notification } from 'antd';

// 错误处理方案： 错误类型
enum ErrorShowType {
  SILENT = 0,
  WARN_MESSAGE = 1,
  ERROR_MESSAGE = 2,
  NOTIFICATION = 3,
  REDIRECT = 9,
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ResponseStructure {
  success: boolean;
  data: any;
  errorCode?: number;
  errorMessage?: string;
  showType?: ErrorShowType;
}

// 添加请求响应类型定义
interface RequestResponse {
  success: boolean;
  data: any;
  errorCode?: number;
  errorMessage?: string;
  error?: string;
}

/**
 * @name 错误处理
 * pro 自带的错误处理， 可以在这里做自己的改动
 * @doc https://umijs.org/docs/max/request#配置
 */
export const errorConfig: RequestConfig = {
  // 错误处理: https://umijs.org/docs/max/request#配置
  errorConfig: {
    // 错误抛出
    errorThrower: (res) => {
      // 如果是OAuth配置未找到的错误，不抛出错误
      if (res && res.error === 'No specified OAuth configuration found') {
        return;
      }

      // 其他情况正常抛出错误
      const { success, data, errorMessage } = res as unknown as RequestResponse;
      if (!success) {
        const error: any = new Error(errorMessage);
        error.name = 'BizError';
        error.info = { errorMessage, errorCode: data?.errorCode, errorData: data?.errorData };
        throw error;
      }
    },

    // 错误接收及处理
    errorHandler: (error: any, opts: any) => {
      // 如果是关于OAuth未配置的错误，静默处理
      if (
        error.response &&
        error.response.data &&
        error.response.data.error === 'No specified OAuth configuration found'
      ) {
        return { success: true, data: { enabled: false } };
      }

      if (opts?.skipErrorHandler) throw error;
      // 我们的错误处理器
      if (error.response) {
        // Axios 的错误
        // 请求成功发出且服务器也响应了状态码，但状态代码超出了 2xx 的范围
        message.error(`Response status:${error.response.status}`);
      } else if (error.request) {
        // 请求已经成功发起，但没有收到响应
        // error.request 在浏览器中是 XMLHttpRequest 的实例
        // 而在node.js中是http.ClientRequest的实例
        message.error('None response! Please retry.');
      } else {
        // 发送请求时出了点问题
        if (error.message && !error.message.includes('No specified OAuth configuration found')) {
          message.error('Request error, please retry.');
        }
      }
    },
  },

  // 请求拦截器
  requestInterceptors: [
    (config: RequestOptions) => {
      // 拦截请求配置，进行个性化处理。
      const url = config?.url;

      // 获取token
      const token = localStorage.getItem('accessToken');
      const tokenType = localStorage.getItem('tokenType') || 'Bearer';

      // 如果token存在，添加到所有请求的头部
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `${tokenType} ${token}`,
        };
      }

      // 如果是OAuth相关的请求，添加特定标记
      if (url?.includes('/api/oauth') && url?.includes('/config')) {
        config.headers = {
          ...config.headers,
          'X-OAuth-Request': 'true',
        };
      }

      return { ...config };
    },
  ],

  // 响应拦截器
  responseInterceptors: [
    (response) => {
      // 拦截响应数据，进行个性化处理
      const { data } = response;

      // 如果是OAuth请求，且返回了特定错误，转换为成功响应
      if (
        response.config?.headers?.['X-OAuth-Request'] === 'true' &&
        data &&
        !data.success &&
        data.error === 'No specified OAuth configuration found'
      ) {
        response.data = {
          success: true,
          data: { enabled: false },
        };
      }

      return response;
    },
  ],
};
