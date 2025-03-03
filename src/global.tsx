import { useIntl } from '@umijs/max';
import { Button, message, notification } from 'antd';
import defaultSettings from '../config/defaultSettings';

const { pwa } = defaultSettings;
const isHttps = document.location.protocol === 'https:';

const clearCache = () => {
  // remove all caches
  if (window.caches) {
    caches
      .keys()
      .then((keys) => {
        keys.forEach((key) => {
          caches.delete(key);
        });
      })
      .catch((e) => console.log(e));
  }
};

// if pwa is true
if (pwa) {
  // Notify user if offline now
  window.addEventListener('sw.offline', () => {
    message.warning(useIntl().formatMessage({ id: 'app.pwa.offline' }));
  });

  // Pop up a prompt on the page asking the user if they want to use the latest version
  window.addEventListener('sw.updated', (event: Event) => {
    const e = event as CustomEvent;
    const reloadSW = async () => {
      // Check if there is sw whose state is waiting in ServiceWorkerRegistration
      // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
      const worker = e.detail && e.detail.waiting;
      if (!worker) {
        return true;
      }
      // Send skip-waiting event to waiting SW with MessageChannel
      await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (msgEvent) => {
          if (msgEvent.data.error) {
            reject(msgEvent.data.error);
          } else {
            resolve(msgEvent.data);
          }
        };
        worker.postMessage({ type: 'skip-waiting' }, [channel.port2]);
      });

      clearCache();
      window.location.reload();
      return true;
    };
    const key = `open${Date.now()}`;
    const btn = (
      <Button
        type="primary"
        onClick={() => {
          notification.destroy(key);
          reloadSW();
        }}
      >
        {useIntl().formatMessage({ id: 'app.pwa.serviceworker.updated.ok' })}
      </Button>
    );
    notification.open({
      message: useIntl().formatMessage({ id: 'app.pwa.serviceworker.updated' }),
      description: useIntl().formatMessage({ id: 'app.pwa.serviceworker.updated.hint' }),
      btn,
      key,
      onClose: async () => null,
    });
  });
} else if ('serviceWorker' in navigator && isHttps) {
  // unregister service worker
  const { serviceWorker } = navigator;
  if (serviceWorker.getRegistrations) {
    serviceWorker.getRegistrations().then((sws) => {
      sws.forEach((sw) => {
        sw.unregister();
      });
    });
  }
  serviceWorker.getRegistration().then((sw) => {
    if (sw) sw.unregister();
  });

  clearCache();
}

// 保存原始error方法
const originalError = message.error;

// 重写error方法，确保返回正确的类型
message.error = function (content, ...args): any {
  // 判断错误内容是否与特定错误相关
  if (
    typeof content === 'string' &&
    (content.includes('No specified OAuth configuration found') ||
      content === '请求失败！' ||
      content === 'Failed to fetch settings' ||
      content === '' || // 空白错误
      content.includes('请求失败'))
  ) {
    // 对特定错误，不显示任何消息
    console.log('已拦截错误提示:', content);

    // 返回一个兼容MessageType的对象
    return {
      _dummy: true,
      then: () => ({ _dummy: true }),
    };
  }

  // 对其他错误，正常显示
  return originalError(content, ...args);
};

// 拦截notification组件
const originalNotificationError = notification.error;
notification.error = function (args) {
  // 检查message和description是否包含我们要过滤的信息
  const { message, description } = args;
  if (
    (typeof message === 'string' &&
      (message.includes('OAuth') || message.includes('失败') || message === '')) ||
    (typeof description === 'string' &&
      (description.includes('OAuth') || description.includes('No specified OAuth configuration')))
  ) {
    console.log('已拦截notification错误:', message, description);
    return { _dummy: true };
  }
  return originalNotificationError(args);
};
