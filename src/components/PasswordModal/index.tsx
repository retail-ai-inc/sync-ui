import { Form, Modal, message, Input } from 'antd';
import React, { useState } from 'react';
import { useIntl } from '@umijs/max';
import { updateAdminPassword } from '@/services/ant-design-pro/user';
import { LockOutlined } from '@ant-design/icons';

interface PasswordModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const intl = useIntl();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (values.newPassword !== values.confirmPassword) {
        message.error(intl.formatMessage({ id: 'pages.password.passwordMismatch' }));
        return;
      }

      setLoading(true);

      const result = await updateAdminPassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });

      setLoading(false);

      if (result.success) {
        message.success(intl.formatMessage({ id: 'pages.password.success' }));
        form.resetFields();
        onSuccess();
      } else {
        message.error(result.message || intl.formatMessage({ id: 'pages.password.failure' }));
      }
    } catch (error) {
      setLoading(false);
      console.error('表单验证或提交出错:', error);
    }
  };

  return (
    <Modal
      title={intl.formatMessage({ id: 'pages.password.title' })}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={loading}
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="oldPassword"
          label={intl.formatMessage({ id: 'pages.password.oldPassword' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.password.inputOldPassword' }),
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={intl.formatMessage({ id: 'pages.password.inputOldPassword' })}
          />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label={intl.formatMessage({ id: 'pages.password.newPassword' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.password.inputNewPassword' }),
            },
            {
              min: 6,
              message: intl.formatMessage({ id: 'pages.password.passwordTooShort' }),
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={intl.formatMessage({ id: 'pages.password.inputNewPassword' })}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={intl.formatMessage({ id: 'pages.password.confirmPassword' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.password.inputConfirmPassword' }),
            },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error(intl.formatMessage({ id: 'pages.password.passwordMismatch' })),
                );
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={intl.formatMessage({ id: 'pages.password.inputConfirmPassword' })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PasswordModal;
