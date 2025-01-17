// src/pages/DataSync/AddSyncForm.tsx

import React, { useState, useEffect } from 'react';
import { StepsForm, ProFormText, ProFormSelect } from '@ant-design/pro-components';
import { Modal, message, Button, Transfer, Space } from 'antd';
import type { TransferProps } from 'antd';
import { addSyncTask, updateSyncTask } from '@/services/ant-design-pro/sync';

interface SyncConn {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
}

interface MappingItem {
  sourceTable: string;
  targetTable: string;
}

interface SyncRecord {
  id?: number;
  taskName?: string;
  sourceType?: string;
  sourceConn?: SyncConn;
  targetConn?: SyncConn;
  mappings?: MappingItem[];
}

interface AddSyncFormProps {
  record?: SyncRecord;
  onSuccess: () => void;
  onCancel: () => void;
}

// example data for Transfer
const mockData = [
  { key: 'users', title: 'users', description: 'table users' },
  { key: 'orders', title: 'orders', description: 'table orders' },
  { key: 'products', title: 'products', description: 'table products' },
  { key: 'logs', title: 'logs', description: 'table logs' },
];

const AddSyncForm: React.FC<AddSyncFormProps> = ({ record, onSuccess, onCancel }) => {
  const [targetKeys, setTargetKeys] = useState<TransferProps['targetKeys']>([]);
  const [selectedKeys, setSelectedKeys] = useState<TransferProps['selectedKeys']>([]);

  useEffect(() => {
    if (record && record.mappings) {
      const keys = record.mappings.map((m) => m.sourceTable);
      setTargetKeys(keys);
    } else {
      setTargetKeys([]);
    }
  }, [record]);

  // Combine data from the 4 steps and submit
  const handleSubmit = async (values: any) => {
    values.mappings = targetKeys.map((key) => ({ sourceTable: key, targetTable: key }));

    let res;
    if (record && record.id) {
      res = await updateSyncTask({ id: record.id, ...values });
    } else {
      res = await addSyncTask(values);
    }

    if (res.success) {
      message.success(record && record.id ? 'Update success' : 'Add success');
      onSuccess();
    } else {
      message.error(record && record.id ? 'Update failed' : 'Add failed');
    }
  };

  const testSourceConn = () => {
    message.info('Test source DB connection success (demo)');
  };

  const testTargetConn = () => {
    message.info('Test target DB connection success (demo)');
  };

  const onTransferChange: TransferProps['onChange'] = (nextTargetKeys) => {
    setTargetKeys(nextTargetKeys);
  };
  const onSelectChange: TransferProps['onSelectChange'] = (
    sourceSelectedKeys,
    targetSelectedKeys,
  ) => {
    setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
  };

  return (
    <StepsForm
      onFinish={handleSubmit}
      stepsFormRender={(dom, submitter) => {
        return (
          <Modal
            title={
              record && record.id ? 'Edit Data Sync Configuration' : 'Add Data Sync Configuration'
            }
            open
            footer={submitter}
            onCancel={() => {
              onCancel();
            }}
            destroyOnClose
            width={800}
          >
            {dom}
          </Modal>
        );
      }}
    >
      {/* Step 1: Source Type & Task Name */}
      <StepsForm.StepForm
        name="dataSourceTypeStep"
        title="Source Type"
        initialValues={{
          sourceType: record?.sourceType || 'MongoDB',
          taskName: record?.taskName || '',
        }}
      >
        <ProFormText
          name="taskName"
          label="Task Name"
          placeholder="Please enter the task name"
          rules={[{ required: true, message: 'Please enter the task name' }]}
        />
        <ProFormSelect
          name="sourceType"
          label="Source Type"
          rules={[{ required: true, message: 'Please select the source type' }]}
          options={[
            { label: 'MongoDB', value: 'MongoDB' },
            { label: 'MySQL', value: 'MySQL' },
            { label: 'MariaDB', value: 'MariaDB' },
            { label: 'PostgreSQL', value: 'PostgreSQL' },
            { label: 'Redis', value: 'Redis' },
          ]}
        />
      </StepsForm.StepForm>

      {/* Step 2: Source DB connection info */}
      <StepsForm.StepForm
        name="sourceConnStep"
        title="Source DB Connection"
        initialValues={{
          sourceConn: record?.sourceConn || {},
        }}
      >
        <ProFormText
          name={['sourceConn', 'host']}
          label="Host"
          placeholder="Host"
          rules={[{ required: true, message: 'Please enter the source DB host' }]}
        />
        <ProFormText
          name={['sourceConn', 'port']}
          label="Port"
          placeholder="Port"
          rules={[{ required: true, message: 'Please enter the source DB port' }]}
        />
        <ProFormText name={['sourceConn', 'user']} label="Username" placeholder="Username" />
        <ProFormText
          name={['sourceConn', 'password']}
          label="Password"
          placeholder="Password"
          fieldProps={{ type: 'password' }}
        />
        <ProFormText
          name={['sourceConn', 'database']}
          label="Database Name"
          placeholder="Database Name"
          rules={[{ required: true, message: 'Please enter the source DB name' }]}
        />
        <Space>
          <Button onClick={testSourceConn}>Test Connection</Button>
        </Space>
      </StepsForm.StepForm>

      {/* Step 3: Target DB connection info */}
      <StepsForm.StepForm
        name="targetConnStep"
        title="Target DB Connection"
        initialValues={{
          targetConn: record?.targetConn || {},
        }}
      >
        <ProFormText
          name={['targetConn', 'host']}
          label="Host"
          placeholder="Host"
          rules={[{ required: true, message: 'Please enter the target DB host' }]}
        />
        <ProFormText
          name={['targetConn', 'port']}
          label="Port"
          placeholder="Port"
          rules={[{ required: true, message: 'Please enter the target DB port' }]}
        />
        <ProFormText name={['targetConn', 'user']} label="Username" placeholder="Username" />
        <ProFormText
          name={['targetConn', 'password']}
          label="Password"
          placeholder="Password"
          fieldProps={{ type: 'password' }}
        />
        <ProFormText
          name={['targetConn', 'database']}
          label="Database Name"
          placeholder="Database Name"
          rules={[{ required: true, message: 'Please enter the target DB name' }]}
        />
        <Space>
          <Button onClick={testTargetConn}>Test Connection</Button>
        </Space>
      </StepsForm.StepForm>

      {/* Step 4: table mapping */}
      <StepsForm.StepForm name="mappingStep" title="Table/Collection Mapping">
        <Transfer
          dataSource={mockData}
          titles={['Available Tables', 'Selected']}
          targetKeys={targetKeys}
          selectedKeys={selectedKeys}
          onChange={onTransferChange}
          onSelectChange={onSelectChange}
          render={(item) => item.title}
          listStyle={{
            width: 200,
            height: 300,
          }}
        />
      </StepsForm.StepForm>
    </StepsForm>
  );
};

export default AddSyncForm;
