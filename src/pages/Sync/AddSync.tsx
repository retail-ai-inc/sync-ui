import React, { useState, useEffect, useRef } from 'react';
import {
  StepsForm,
  ProFormText,
  ProFormSelect,
  ProFormDependency,
} from '@ant-design/pro-components';
import { Modal, message, Button, Transfer, Space } from 'antd';
import type { TransferProps } from 'antd';
import type { FormInstance } from 'antd';
import { addSyncTask, updateSyncTask } from '@/services/ant-design-pro/sync';

interface SyncConn {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
}

interface TableItem {
  sourceTable: string;
  targetTable: string;
}

interface MappingBlock {
  tables: TableItem[];
  sourceDatabase?: string;
  sourceSchema?: string;
  targetDatabase?: string;
  targetSchema?: string;
}

interface SyncRecord {
  id?: number;
  taskName?: string;
  sourceType?: string;
  sourceConn?: SyncConn;
  targetConn?: SyncConn;
  mappings?: MappingBlock[];
  enable?: boolean;
  status?: string;
  lastRunTime?: string;
  lastUpdateTime?: string;

  // Potential DB-specific parameters if the record is loaded for editing
  pg_replication_slot?: string;
  pg_plugin?: string;
  pg_position_path?: string;
  pg_publication_names?: string;
  mysql_position_path?: string;
  mongodb_resume_token_path?: string;
  redis_position_path?: string;
}

// 全局变量来储存 sourceType
let globalSourceType = '';

// 工具方法：生成当前时间字符串 "YYYY-MM-DD HH:mm:ss"
const getCurrentTimeString = () => {
  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

interface AddSyncProps {
  record?: SyncRecord;
  onSuccess: () => void;
  onCancel: () => void;
}

const AddSync: React.FC<AddSyncProps> = ({ record, onSuccess, onCancel }) => {
  const [targetKeys, setTargetKeys] = useState<TransferProps['targetKeys']>([]);
  const [selectedKeys, setSelectedKeys] = useState<TransferProps['selectedKeys']>([]);
  // 后端返回的真实表数据（第四步需要的表列表）
  const [tableData, setTableData] = useState<{ key: string; title: string; description: string }[]>(
    [],
  );
  const formRef = useRef<FormInstance>();

  // 编辑任务时，根据 record.mappings 初始化 Transfer 选择
  useEffect(() => {
    if (record && record.mappings && record.mappings.length > 0) {
      const firstMapping = record.mappings[0];
      if (firstMapping.tables && firstMapping.tables.length > 0) {
        const keys = firstMapping.tables.map((t) => t.sourceTable);
        setTargetKeys(keys);
      } else {
        setTargetKeys([]);
      }
    } else {
      setTargetKeys([]);
    }
  }, [record]);

  // 点击最右侧"提交"时执行
  const handleSubmit = async (values: any) => {
    // 组装 mappings 字段（仅使用一个 mapping）
    values.mappings = [
      {
        tables: targetKeys.map((key) => ({
          sourceTable: key,
          targetTable: key,
        })),
      },
    ];

    // 将 sourceType 存为 payload.type (因为 API 需要 "type" 字段)
    const dbType = values.sourceType;
    const payload: any = {
      ...values,
      type: dbType,
      lastUpdateTime: getCurrentTimeString(),
      dump_execution_path: null, // 通常置为 null, 视需要保留或删除
    };

    // 根据数据库类型保留对应的参数，其它置 null
    switch (dbType) {
      case 'postgresql':
        payload.pg_replication_slot = values.pg_replication_slot;
        payload.pg_plugin = values.pg_plugin;
        payload.pg_position_path = values.pg_position_path;
        payload.pg_publication_names = values.pg_publication_names;

        // 其余 DB 参数置 null
        payload.mysql_position_path = null;
        payload.mongodb_resume_token_path = null;
        payload.redis_position_path = null;
        break;
      case 'mysql':
        payload.mysql_position_path = values.mysql_position_path;

        payload.pg_replication_slot = null;
        payload.pg_plugin = null;
        payload.pg_position_path = null;
        payload.pg_publication_names = null;
        payload.mongodb_resume_token_path = null;
        payload.redis_position_path = null;
        break;
      case 'mariadb':
        payload.mysql_position_path = values.mysql_position_path; // reuse key name

        payload.pg_replication_slot = null;
        payload.pg_plugin = null;
        payload.pg_position_path = null;
        payload.pg_publication_names = null;
        payload.mongodb_resume_token_path = null;
        payload.redis_position_path = null;
        break;
      case 'mongodb':
        payload.mongodb_resume_token_path = values.mongodb_resume_token_path;

        payload.pg_replication_slot = null;
        payload.pg_plugin = null;
        payload.pg_position_path = null;
        payload.pg_publication_names = null;
        payload.mysql_position_path = null;
        payload.redis_position_path = null;
        break;
      case 'redis':
        payload.redis_position_path = values.redis_position_path;

        payload.pg_replication_slot = null;
        payload.pg_plugin = null;
        payload.pg_position_path = null;
        payload.pg_publication_names = null;
        payload.mysql_position_path = null;
        payload.mongodb_resume_token_path = null;
        break;
      default:
        // If no known type, set all to null
        payload.pg_replication_slot = null;
        payload.pg_plugin = null;
        payload.pg_position_path = null;
        payload.pg_publication_names = null;
        payload.mysql_position_path = null;
        payload.mongodb_resume_token_path = null;
        payload.redis_position_path = null;
        break;
    }

    let res;
    if (record && record.id) {
      // 合并旧数据
      res = await updateSyncTask({
        ...record,
        ...payload,
      });
    } else {
      // 新增任务时，默认status为Running
      payload.status = 'Running';
      res = await addSyncTask(payload);
    }

    if (res.success) {
      message.success(record && record.id ? 'Update success' : 'Add success');
      onSuccess();
    } else {
      message.error(record && record.id ? 'Update failed' : 'Add failed');
    }
  };

  // 手动测试 Source DB 连接，点击"Test Connection"时执行
  const testSourceConn = async () => {
    const values = formRef.current?.getFieldsValue(true);
    const dbType = globalSourceType;
    if (!dbType) {
      message.error('Please select a Source Type.');
      return;
    }
    const sourceConn = values?.sourceConn;
    if (!sourceConn || !sourceConn.host || !sourceConn.port || !sourceConn.database) {
      message.error('Please complete the source connection information.');
      return;
    }
    const payload = {
      dbType,
      host: sourceConn.host,
      port: sourceConn.port,
      user: sourceConn.user || '',
      password: sourceConn.password || '',
      database: sourceConn.database,
    };
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        message.success('Source DB connection successful.');
        const tables: string[] = result.data.tables;
        const newTableData = tables.map((table) => ({
          key: table,
          title: table,
          description: `table ${table}`,
        }));
        setTableData(newTableData);
      } else {
        message.error(result.error || 'Source DB connection failed.');
      }
    } catch (error: any) {
      message.error('Error testing connection: ' + error.message);
    }
  };

  // 测试 Target DB 连接
  const testTargetConn = async () => {
    const values = formRef.current?.getFieldsValue(true);
    const dbType = globalSourceType;
    if (!dbType) {
      message.error('Please select a Source Type.');
      return;
    }
    const targetConn = values?.targetConn;
    if (!targetConn || !targetConn.host || !targetConn.port || !targetConn.database) {
      message.error('Please complete the target connection information.');
      return;
    }
    const payload = {
      dbType,
      host: targetConn.host,
      port: targetConn.port,
      user: targetConn.user || '',
      password: targetConn.password || '',
      database: targetConn.database,
    };
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        message.success('Target DB connection successful.');
        // const tables: string[] = result.data.tables;
        // const newTableData = tables.map((table) => ({
        //   key: table,
        //   title: table,
        //   description: `table ${table}`,
        // }));
        // setTableData(newTableData);
      } else {
        message.error(result.error || 'Target DB connection failed.');
      }
    } catch (error: any) {
      message.error('Error testing connection: ' + error.message);
    }
  };

  // 当第二步点击「Next」按钮时，自动测试 Source 连接并获取表信息
  const handleSourceConnNext = async () => {
    const values = formRef.current?.getFieldsValue(true);
    const dbType = globalSourceType;

    if (!dbType) {
      message.error('Please select a Source Type in Step 1');
      return false;
    }

    const sourceConn = values?.sourceConn;
    if (!sourceConn || !sourceConn.host || !sourceConn.port || !sourceConn.database) {
      message.error('Please complete the source connection information in Step 2');
      return false;
    }

    const payload = {
      dbType,
      host: sourceConn.host,
      port: sourceConn.port,
      user: sourceConn.user || '',
      password: sourceConn.password || '',
      database: sourceConn.database,
    };
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        message.success('Source DB connection successful (auto load).');
        const tables: string[] = result.data.tables;
        const newTableData = tables.map((table) => ({
          key: table,
          title: table,
          description: `table ${table}`,
        }));
        setTableData(newTableData);
        return true;
      } else {
        message.error(result.error || 'Source DB connection failed (auto load).');
        return false;
      }
    } catch (error: any) {
      message.error('Error testing connection: ' + error.message);
      return false;
    }
  };

  const handleTargetConnNext = async () => {
    const values = formRef.current?.getFieldsValue(true);
    const dbType = globalSourceType;

    if (!dbType) {
      message.error('Please select a Source Type in Step 1');
      return false;
    }

    const targetConn = values?.targetConn;
    if (!targetConn || !targetConn.host || !targetConn.port || !targetConn.database) {
      message.error('Please complete the target connection information in Step 3');
      return false;
    }

    const payload = {
      dbType,
      host: targetConn.host,
      port: targetConn.port,
      user: targetConn.user || '',
      password: targetConn.password || '',
      database: targetConn.database,
    };

    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        message.success('Target DB connection successful (auto load).');
        // const _tables: string[] = result.data.tables;
        return true;
      } else {
        message.error(result.error || 'Target DB connection failed (auto load).');
        return false;
      }
    } catch (error: any) {
      message.error('Error testing connection: ' + error.message);
      return false;
    }
  };

  // Transfer 事件处理
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
      formRef={formRef}
      onFinish={handleSubmit}
      // 设置 preserve: true 确保各步骤数据不被清除
      formProps={{ preserve: true }}
      stepsFormRender={(dom, submitter) => (
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
      )}
    >
      {/* 步骤1：数据源类型和任务名称 + DB-specific params */}
      <StepsForm.StepForm
        name="dataSourceTypeStep"
        title="Source Type"
        initialValues={{
          sourceType: record?.sourceType || 'mysql',
          taskName: record?.taskName || '',
          pg_replication_slot: record?.pg_replication_slot || 'sync_slot',
          pg_plugin: record?.pg_plugin || 'pgoutput',
          pg_position_path: record?.pg_position_path || '/tmp/state/pg_position',
          pg_publication_names: record?.pg_publication_names || 'mypub',
          mysql_position_path: record?.mysql_position_path || '/tmp/state/mysql_position',
          mongodb_resume_token_path:
            record?.mongodb_resume_token_path || '/tmp/state/mongodb_resume_token',
          redis_position_path: record?.redis_position_path || '/tmp/state/redis_position',
        }}
        onFinish={async (values) => {
          globalSourceType = values.sourceType || '';
          return true;
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
            { label: 'mongodb', value: 'mongodb' },
            { label: 'mysql', value: 'mysql' },
            { label: 'mariadb', value: 'mariadb' },
            { label: 'postgresql', value: 'postgresql' },
            { label: 'redis', value: 'redis' },
          ]}
        />
        {/* 根据选择的DB类型，展示额外参数 */}
        <ProFormDependency name={['sourceType']}>
          {({ sourceType }) => {
            switch (sourceType) {
              case 'postgresql':
                return (
                  <>
                    <ProFormText name="pg_replication_slot" label="PostgreSQL Replication Slot" />
                    <ProFormText name="pg_plugin" label="PostgreSQL Plugin" />
                    <ProFormText name="pg_position_path" label="PostgreSQL Position Path" />
                    <ProFormText name="pg_publication_names" label="PostgreSQL Publication Names" />
                  </>
                );
              case 'mysql':
                return <ProFormText name="mysql_position_path" label="MySQL Position Path" />;
              case 'mariadb':
                return <ProFormText name="mysql_position_path" label="MariaDB Position Path" />;
              case 'mongodb':
                return (
                  <ProFormText name="mongodb_resume_token_path" label="MongoDB Resume Token Path" />
                );
              case 'redis':
                return <ProFormText name="redis_position_path" label="Redis Position Path" />;
              default:
                return null;
            }
          }}
        </ProFormDependency>
      </StepsForm.StepForm>

      {/* 步骤2：Source DB 连接信息 */}
      <StepsForm.StepForm
        name="sourceConnStep"
        title="Source DB Connection"
        initialValues={{ sourceConn: record?.sourceConn || {} }}
        onFinish={handleSourceConnNext}
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

      {/* 步骤3：Target DB 连接信息 */}
      <StepsForm.StepForm
        name="targetConnStep"
        title="Target DB Connection"
        initialValues={{ targetConn: record?.targetConn || {} }}
        onFinish={handleTargetConnNext}
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

      {/* 步骤4：表/集合映射 */}
      <StepsForm.StepForm name="mappingStep" title="Table/Collection Mapping">
        <Transfer
          dataSource={tableData}
          titles={['Available Tables', 'Selected']}
          targetKeys={targetKeys}
          selectedKeys={selectedKeys}
          onChange={onTransferChange}
          onSelectChange={onSelectChange}
          render={(item) => item.title}
          listStyle={{ width: 200, height: 300 }}
        />
      </StepsForm.StepForm>
    </StepsForm>
  );
};

export default AddSync;
