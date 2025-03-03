import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Form, Switch, Button, Upload, message, Spin, Alert, Space, Typography } from 'antd';
import { UploadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import {
  getOAuthConfig,
  updateOAuthSettings,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  uploadOAuthConfig,
} from '@/services/ant-design-pro/oauth';

const { Text } = Typography;

const AuthSettings: React.FC = () => {
  const intl = useIntl();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [oauthEnabled, setOauthEnabled] = useState<boolean>(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [oauthConfig, setOauthConfig] = useState<any>(null);

  // 获取当前设置
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await getOAuthConfig('google');
        if (response.success && response.data) {
          // 如果API返回了enabled字段，使用它；否则根据是否有配置判断
          const enabled =
            response.data.enabled !== undefined ? response.data.enabled : !!response.data.clientId;

          setOauthEnabled(enabled);
          setOauthConfig(response.data);
          form.setFieldsValue({
            googleOAuthEnabled: enabled,
          });
        }
      } catch (error) {
        console.error('获取OAuth设置失败:', error);
        message.error(intl.formatMessage({ id: 'pages.settings.auth.fetchFailed' }));
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [form, intl]);

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    setSaveLoading(true);
    try {
      const { googleOAuthEnabled } = values;

      // 如果有文件，先解析文件，然后一次性更新所有设置
      if (fileList.length > 0 && googleOAuthEnabled) {
        const file = fileList[0].originFileObj;

        if (!file) {
          throw new Error(intl.formatMessage({ id: 'pages.settings.auth.fileContentError' }));
        }

        // 读取并解析JSON文件
        const reader = new FileReader();

        try {
          const configData = await new Promise((resolve, reject) => {
            reader.onload = (e) => {
              try {
                const content = e.target?.result as string;
                console.log('读取到的文件内容:', content.substring(0, 200) + '...');

                const jsonData = JSON.parse(content);
                console.log('解析后的JSON对象:', jsonData);
                resolve(jsonData);
              } catch (error) {
                console.error('JSON解析失败:', error);
                reject(new Error(intl.formatMessage({ id: 'pages.settings.auth.jsonParseError' })));
              }
            };
            reader.onerror = (e) => {
              console.error('文件读取错误:', e);
              reject(new Error(intl.formatMessage({ id: 'pages.settings.auth.fileReadError' })));
            };
            reader.readAsText(file);
          });

          console.log('完整JSON对象:', configData);

          // 提取Google OAuth配置
          let clientId, clientSecret, authUri, redirectUri;

          // 处理Google Cloud Console下载的OAuth客户端JSON格式
          if (configData && typeof configData === 'object') {
            if ('web' in configData && configData.web) {
              console.log('检测到web格式的Google OAuth配置');
              const webConfig = configData.web as any;
              clientId = webConfig.client_id;
              clientSecret = webConfig.client_secret;
              authUri = webConfig.auth_uri;
              // 使用第一个重定向URI或指定的URI
              redirectUri = Array.isArray(webConfig.redirect_uris)
                ? webConfig.redirect_uris[0]
                : webConfig.redirect_uris;
            } else {
              console.log('使用标准格式的OAuth配置');
              const config = configData as any;
              clientId = config.client_id || config.clientId;
              clientSecret = config.client_secret || config.clientSecret;
              authUri = config.auth_uri || config.authUri;
              redirectUri = config.redirect_uri || config.redirectUri;
            }
          }

          console.log('提取的OAuth参数:', {
            clientId,
            clientSecret: clientSecret ? '***' : undefined,
            authUri,
            redirectUri,
          });

          // 验证必要的字段存在
          if (!clientId) {
            console.error('缺少client_id字段');
            throw new Error(intl.formatMessage({ id: 'pages.settings.auth.missingClientId' }));
          }
          if (!clientSecret) {
            console.error('缺少client_secret字段');
            throw new Error(intl.formatMessage({ id: 'pages.settings.auth.missingClientSecret' }));
          }
          if (!redirectUri) {
            console.error('缺少redirect_uri字段');
            throw new Error(intl.formatMessage({ id: 'pages.settings.auth.missingRedirectUri' }));
          }

          // 准备发送给后端的数据
          const oauthConfigData = {
            enabled: googleOAuthEnabled,
            clientId: clientId,
            clientSecret: clientSecret,
            authUri: authUri || 'https://accounts.google.com/o/oauth2/auth',
            redirectUri: redirectUri,
            scopes: ['email', 'profile'],
          };

          console.log('发送到后端的OAuth配置:', {
            ...oauthConfigData,
            clientSecret: '***',
          });

          // 发送完整配置到后端
          try {
            console.log('开始发送API请求...');

            const headers = new Headers();
            headers.append('Content-Type', 'application/json');
            const token = localStorage.getItem('accessToken');
            if (token) {
              headers.append('Authorization', `Bearer ${token}`);
            }

            const requestBody = JSON.stringify(oauthConfigData);
            console.log('请求体JSON字符串:', requestBody);

            const response = await fetch(`/api/oauth/google/config?provider=google`, {
              method: 'PUT',
              headers: headers,
              body: requestBody,
            });

            console.log('API响应状态:', response.status, response.statusText);

            const responseData = await response.json();
            console.log('API响应内容:', responseData);

            if (!response.ok || !responseData.success) {
              throw new Error(
                responseData.errorMessage ||
                  intl.formatMessage(
                    {
                      id: 'pages.settings.auth.apiRequestFailed',
                    },
                    { message: response.status },
                  ),
              );
            }

            console.log('OAuth配置更新成功');
          } catch (fetchError) {
            console.error('Fetch API调用失败:', fetchError);
            throw new Error(
              intl.formatMessage(
                {
                  id: 'pages.settings.auth.apiRequestFailed',
                },
                { message: fetchError.message },
              ),
            );
          }
        } catch (error) {
          console.error('处理配置文件过程出错:', error);
          if (error instanceof Error) {
            throw error;
          } else {
            throw new Error(intl.formatMessage({ id: 'pages.settings.auth.configProcessError' }));
          }
        }
      } else {
        // 没有文件，只更新启用状态
        try {
          const token = localStorage.getItem('accessToken');

          if (!token) {
            throw new Error(intl.formatMessage({ id: 'pages.settings.auth.noToken' }));
          }

          const updateResponse = await updateOAuthSettings(
            {
              enabled: googleOAuthEnabled,
            },
            'google',
          );

          if (!updateResponse.success) {
            throw new Error(
              updateResponse.errorMessage ||
                intl.formatMessage({ id: 'pages.settings.auth.updateSettingsFailed' }),
            );
          }
        } catch (error) {
          console.error('保存设置失败:', error);

          // 检查是否是权限错误
          if (
            error.response &&
            error.response.data &&
            error.response.data.error === 'Admin privileges required'
          ) {
            message.error(intl.formatMessage({ id: 'pages.settings.auth.adminRequired' }));
          } else {
            message.error(
              error.message || intl.formatMessage({ id: 'pages.settings.auth.saveFailed' }),
            );
          }

          setSaveLoading(false);
          return;
        }
      }

      message.success(intl.formatMessage({ id: 'pages.settings.auth.saveSuccess' }));
      setOauthEnabled(googleOAuthEnabled);

      // 无论如何都刷新一下配置信息
      const refreshResponse = await getOAuthConfig('google');
      if (refreshResponse.success) {
        setOauthConfig(refreshResponse.data);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error(error.message || intl.formatMessage({ id: 'pages.settings.auth.saveFailed' }));
    } finally {
      setSaveLoading(false);
    }
  };

  // 上传前检查文件
  const beforeUpload = (file: any) => {
    // 检查文件类型，允许application/json或任何以.json结尾的文件
    const isJSON = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (!isJSON) {
      message.error(intl.formatMessage({ id: 'pages.settings.auth.jsonFileOnly' }));
    }

    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error(intl.formatMessage({ id: 'pages.settings.auth.fileSizeLimit' }));
    }

    return isJSON && isLt2M;
  };

  // 处理文件变更
  const handleChange = (info: any) => {
    console.log('文件状态变更:', info.file.status, info.file.name);
    let fileList = [...info.fileList];
    // 限制只保留一个文件
    fileList = fileList.slice(-1);
    setFileList(fileList);
  };

  const uploadProps = {
    beforeUpload,
    onChange: handleChange,
    fileList,
    accept: '.json,application/json', // 增加accept属性
    customRequest: (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      { onSuccess, file, onError },
    ) => {
      // 手动处理上传，实际上传在表单提交时进行
      setTimeout(() => {
        if (onSuccess) onSuccess('ok');
      }, 0);
    },
  };

  return (
    <PageContainer title={intl.formatMessage({ id: 'pages.settings.auth.title' })}>
      <Card>
        <Spin spinning={loading}>
          {loading ? (
            <div style={{ padding: '50px 0', textAlign: 'center' }}>
              {intl.formatMessage({ id: 'pages.settings.auth.loading' })}
            </div>
          ) : (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ googleOAuthEnabled: oauthEnabled }}
            >
              <Form.Item
                name="googleOAuthEnabled"
                label={intl.formatMessage({ id: 'pages.settings.auth.enableGoogleOAuth' })}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              {oauthConfig && oauthConfig.clientId && (
                <Alert
                  type="info"
                  message={intl.formatMessage({ id: 'pages.settings.auth.currentConfig' })}
                  description={
                    <div>
                      <p>
                        {intl.formatMessage(
                          { id: 'pages.settings.auth.clientId' },
                          { id: oauthConfig.clientId },
                        )}
                      </p>
                      <p>
                        {intl.formatMessage(
                          { id: 'pages.settings.auth.redirectUri' },
                          { uri: oauthConfig.redirectUri },
                        )}
                      </p>
                      <p>
                        {intl.formatMessage(
                          { id: 'pages.settings.auth.scopes' },
                          { scopes: oauthConfig.scopes?.join(', ') },
                        )}
                      </p>
                    </div>
                  }
                  style={{ marginBottom: 24 }}
                />
              )}

              <Form.Item
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.googleOAuthEnabled !== currentValues.googleOAuthEnabled
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue('googleOAuthEnabled') ? (
                    <Form.Item
                      name="configFile"
                      label={intl.formatMessage({ id: 'pages.settings.auth.uploadConfig' })}
                      extra={intl.formatMessage({ id: 'pages.settings.auth.configFileHint' })}
                    >
                      <Upload {...uploadProps} maxCount={1}>
                        <Button icon={<UploadOutlined />}>
                          {intl.formatMessage({ id: 'pages.settings.auth.selectFile' })}
                        </Button>
                      </Upload>
                    </Form.Item>
                  ) : null
                }
              </Form.Item>

              <Alert
                message={intl.formatMessage({ id: 'pages.settings.auth.configHelp.title' })}
                description={
                  <Space direction="vertical">
                    <Text>
                      {intl.formatMessage({ id: 'pages.settings.auth.configHelp.description' })}
                    </Text>
                    <Text type="secondary">
                      <InfoCircleOutlined />{' '}
                      {intl.formatMessage({ id: 'pages.settings.auth.configHelp.hint' })}
                    </Text>
                  </Space>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={saveLoading}>
                  {intl.formatMessage({ id: 'pages.settings.auth.save' })}
                </Button>
              </Form.Item>
            </Form>
          )}
        </Spin>
      </Card>
    </PageContainer>
  );
};

export default AuthSettings;
