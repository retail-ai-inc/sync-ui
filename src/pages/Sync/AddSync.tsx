import React, { useState, useEffect, useRef } from 'react';
import {
  StepsForm,
  ProFormText,
  ProFormSelect,
  ProFormDependency,
} from '@ant-design/pro-components';
import {
  Modal,
  message,
  Button,
  Transfer,
  Space,
  Switch,
  Table,
  Typography,
  Collapse,
  Spin,
} from 'antd';
import { LockOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import type { TransferDirection } from 'antd/es/transfer';
import type { FormInstance } from 'antd';
import { addSyncTask, updateSyncTask, getTableSchema } from '@/services/ant-design-pro/sync';
import { useIntl } from '@umijs/max';

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
let globalSourceConn: SyncConn | null = null;

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
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  // 后端返回的真实表数据（第四步需要的表列表）
  const [tableData, setTableData] = useState<{ key: string; title: string; description: string }[]>(
    [],
  );
  const [showSecurityOptions, setShowSecurityOptions] = useState(false);
  const formRef = useRef<FormInstance>();
  const [fieldsMockData, setFieldsMockData] = useState<Record<string, any[]>>({});
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [sourceConnectionInfo, setSourceConnectionInfo] = useState<{
    sourceType: string;
    sourceConn: SyncConn;
  } | null>(null);

  // 添加 intl 实例
  const intl = useIntl();

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

  // 获取表结构信息的函数
  const fetchTableSchema = async (tableName: string) => {
    console.log('fetchTableSchema调用，tableName:', tableName);
    console.log('全局变量状态:', { globalSourceType, globalSourceConn });

    // 首先尝试使用全局变量
    if (globalSourceType && globalSourceConn) {
      console.log('使用全局变量获取表结构');
      setIsLoadingFields(true);
      try {
        const response = await getTableSchema({
          sourceType: globalSourceType,
          connection: {
            host: globalSourceConn.host || '',
            port: globalSourceConn.port || '',
            user: globalSourceConn.user || '',
            password: globalSourceConn.password || '',
            database: globalSourceConn.database || '',
          },
          tableName,
        });

        console.log('API返回的表结构数据:', response);

        if (response.success && response.data.fields) {
          // 转换API返回的数据格式为组件需要的格式
          const fieldData = response.data.fields.map((field: any) => ({
            key: `${tableName}_${field.name}`,
            fieldName: field.name, // 修改字段名以匹配列定义
            fieldType: field.type, // 修改字段名以匹配列定义
            status: 'normal', // 默认为正常状态
          }));

          console.log('转换后的字段数据:', fieldData);

          setFieldsMockData((prev) => {
            const newData = {
              ...prev,
              [tableName]: fieldData,
            };
            console.log('更新后的fieldsMockData:', newData);
            return newData;
          });
        } else {
          console.error('API返回错误或无字段数据:', response);
          message.error(intl.formatMessage({ id: 'pages.syncSettings.fetchFieldsFailed' }));
        }
      } catch (error) {
        console.error('获取表结构出错:', error);
        message.error(intl.formatMessage({ id: 'pages.syncSettings.fetchFieldsFailed' }));
      } finally {
        setIsLoadingFields(false);
      }
    } else if (sourceConnectionInfo) {
      // 如果全局变量不可用，尝试使用state
      console.log('使用state获取表结构');
      const { sourceType, sourceConn } = sourceConnectionInfo;

      if (
        !sourceType ||
        !sourceConn ||
        !sourceConn.host ||
        !sourceConn.port ||
        !sourceConn.database
      ) {
        message.error(intl.formatMessage({ id: 'pages.syncSettings.missingConnectionInfo' }));
        return;
      }

      setIsLoadingFields(true);
      try {
        const response = await getTableSchema({
          sourceType,
          connection: {
            host: sourceConn.host,
            port: sourceConn.port,
            user: sourceConn.user || '',
            password: sourceConn.password || '',
            database: sourceConn.database,
          },
          tableName,
        });

        if (response.success && response.data.fields) {
          // 转换API返回的数据格式为组件需要的格式
          const fieldData = response.data.fields.map((field: any) => ({
            key: `${tableName}_${field.name}`,
            name: field.name,
            type: field.type,
            status: 'normal', // 默认为正常状态
          }));

          setFieldsMockData((prev) => ({
            ...prev,
            [tableName]: fieldData,
          }));
        } else {
          message.error(intl.formatMessage({ id: 'pages.syncSettings.fetchFieldsFailed' }));
        }
      } catch (error) {
        console.error('获取表结构出错:', error);
        message.error(intl.formatMessage({ id: 'pages.syncSettings.fetchFieldsFailed' }));
      } finally {
        setIsLoadingFields(false);
      }
    } else {
      console.error('无法获取连接信息');
      message.error(intl.formatMessage({ id: 'pages.syncSettings.missingConnectionInfo' }));
    }
  };

  // 修改穿梭框变更处理函数，添加获取字段信息的逻辑
  const onTransferChange = (
    newTargetKeys: string[],
    direction: TransferDirection,
    moveKeys: string[],
  ) => {
    console.log('onTransferChange被调用:', { newTargetKeys, direction, moveKeys });
    setTargetKeys(newTargetKeys);

    // 找出新增的表，并获取它们的字段信息
    const addedTables = newTargetKeys.filter((key) =>
      targetKeys ? !targetKeys.includes(key) : true,
    );

    console.log('新增表:', addedTables, '当前已选表:', targetKeys);

    if (addedTables.length > 0) {
      // 使用setTimeout确保表单值已更新
      setTimeout(() => {
        addedTables.forEach((tableName) => {
          console.log('准备获取表结构:', tableName);
          fetchTableSchema(tableName);
        });
      }, 0);
    }
  };

  // 使用step name来确定当前步骤，而不是依赖索引
  useEffect(() => {
    // 检查当前是否处于表映射步骤
    if (currentStep === 3) {
      // 假设第4步索引为3
      console.log('进入第4步, 状态检查:');
      console.log('全局变量:', { globalSourceType, globalSourceConn });
      console.log('targetKeys:', targetKeys);
      console.log('tableData:', tableData);

      // 如果没有表数据但有连接信息，尝试加载表数据
      if (tableData.length === 0 && globalSourceType && globalSourceConn) {
        console.log('尝试加载表数据');
        const payload = {
          dbType: globalSourceType,
          host: globalSourceConn.host,
          port: globalSourceConn.port,
          user: globalSourceConn.user || '',
          password: globalSourceConn.password || '',
          database: globalSourceConn.database,
        };

        fetch('/api/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.success) {
              const tables: string[] = result.data.tables;
              const newTableData = tables.map((table) => ({
                key: table,
                title: table,
                description: `table ${table}`,
              }));
              setTableData(newTableData);
            }
          })
          .catch((error) => {
            console.error('加载表数据失败:', error);
          });
      }

      // 如果有选中的表，加载字段信息
      if (targetKeys && targetKeys.length > 0) {
        targetKeys.forEach((tableName) => {
          if (!fieldsMockData[tableName]) {
            console.log('准备获取表字段:', tableName);
            fetchTableSchema(tableName);
          }
        });
      }
    }
  }, [currentStep]);

  // 点击最右侧"提交"时执行
  const handleSubmit = async (values: any) => {
    // 组装 mappings 字段（仅使用一个 mapping）
    values.mappings = [
      {
        tables: (targetKeys || []).map((key) => ({
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
      message.success(
        record && record.id
          ? intl.formatMessage({ id: 'pages.sync.updateSucesss' })
          : intl.formatMessage({ id: 'pages.sync.addSucesss' }),
      );
      onSuccess();
    } else {
      message.error(
        record && record.id
          ? intl.formatMessage({ id: 'pages.sync.updateFailed' })
          : intl.formatMessage({ id: 'pages.sync.addFailed' }),
      );
    }
  };

  // 手动测试 Source DB 连接，点击"Test Connection"时执行
  const testSourceConn = async () => {
    const values = formRef.current?.getFieldsValue(true);
    const dbType = globalSourceType;
    if (!dbType) {
      message.error(intl.formatMessage({ id: 'pages.sync.selectSourceType' }));
      return;
    }
    const sourceConn = values?.sourceConn;
    if (!sourceConn || !sourceConn.host || !sourceConn.port || !sourceConn.database) {
      message.error(intl.formatMessage({ id: 'pages.sync.completeSourceConn' }));
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
        message.success(intl.formatMessage({ id: 'pages.sync.sourceConnSuccess' }));
        const tables: string[] = result.data.tables;
        const newTableData = tables.map((table) => ({
          key: table,
          title: table,
          description: `table ${table}`,
        }));
        setTableData(newTableData);
      } else {
        message.error(
          intl.formatMessage({ id: 'pages.sync.sourceConnFailed' }) +
            ': ' +
            (result.error || 'Source DB connection failed.'),
        );
      }
    } catch (error: any) {
      message.error(intl.formatMessage({ id: 'pages.sync.testConnError' }) + ': ' + error.message);
    }
  };

  // 测试 Target DB 连接
  const testTargetConn = async () => {
    const values = formRef.current?.getFieldsValue(true);
    const dbType = globalSourceType;
    if (!dbType) {
      message.error(intl.formatMessage({ id: 'pages.sync.selectSourceType' }));
      return;
    }
    const targetConn = values?.targetConn;
    if (!targetConn || !targetConn.host || !targetConn.port || !targetConn.database) {
      message.error(intl.formatMessage({ id: 'pages.sync.completeTargetConn' }));
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
        message.success(intl.formatMessage({ id: 'pages.sync.targetConnSuccess' }));
        // const tables: string[] = result.data.tables;
        // const newTableData = tables.map((table) => ({
        //   key: table,
        //   title: table,
        //   description: `table ${table}`,
        // }));
        // setTableData(newTableData);
      } else {
        message.error(
          intl.formatMessage({ id: 'pages.sync.targetConnFailed' }) +
            ': ' +
            (result.error || 'Target DB connection failed.'),
        );
      }
    } catch (error: any) {
      message.error(intl.formatMessage({ id: 'pages.sync.testConnError' }) + ': ' + error.message);
    }
  };

  // 当第二步点击「Next」按钮时，自动测试 Source 连接并获取表信息
  const handleSourceConnNext = async () => {
    const values = formRef.current?.getFieldsValue(true);
    const dbType = globalSourceType;

    if (!dbType) {
      message.error(intl.formatMessage({ id: 'pages.sync.selectSourceType' }));
      return false;
    }

    const sourceConn = values?.sourceConn;
    if (!sourceConn || !sourceConn.host || !sourceConn.port || !sourceConn.database) {
      message.error(intl.formatMessage({ id: 'pages.sync.completeSourceConn' }));
      return false;
    }

    // 保存到全局变量和state
    globalSourceConn = sourceConn;
    setSourceConnectionInfo({
      sourceType: globalSourceType,
      sourceConn: sourceConn,
    });

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
        message.success(intl.formatMessage({ id: 'pages.sync.sourceConnAutoSuccess' }));
        const tables: string[] = result.data.tables;
        const newTableData = tables.map((table) => ({
          key: table,
          title: table,
          description: `table ${table}`,
        }));
        setTableData(newTableData);
        return true;
      } else {
        message.error(
          intl.formatMessage({ id: 'pages.sync.sourceConnAutoFailed' }) +
            ': ' +
            (result.error || 'Source DB connection failed (auto load).'),
        );
        return false;
      }
    } catch (error: any) {
      message.error(intl.formatMessage({ id: 'pages.sync.testConnError' }) + ': ' + error.message);
      return false;
    }
  };

  const handleTargetConnNext = async () => {
    const values = formRef.current?.getFieldsValue(true);
    const dbType = globalSourceType;

    if (!dbType) {
      message.error(intl.formatMessage({ id: 'pages.sync.selectSourceType' }));
      return false;
    }

    const targetConn = values?.targetConn;
    if (!targetConn || !targetConn.host || !targetConn.port || !targetConn.database) {
      message.error(intl.formatMessage({ id: 'pages.sync.completeTargetConn' }));
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
        message.success(intl.formatMessage({ id: 'pages.sync.targetConnAutoSuccess' }));
        // 成功后保存源连接信息
        const formValues = formRef.current?.getFieldsValue(true);
        setSourceConnectionInfo({
          sourceType: formValues?.sourceType,
          sourceConn: formValues?.sourceConn,
        });
        return true;
      } else {
        message.error(
          intl.formatMessage({ id: 'pages.sync.targetConnAutoFailed' }) +
            ': ' +
            (result.error || 'Target DB connection failed (auto load).'),
        );
        return false;
      }
    } catch (error: any) {
      message.error(intl.formatMessage({ id: 'pages.sync.testConnError' }) + ': ' + error.message);
      return false;
    }
  };

  // Transfer 事件处理
  const onSelectChange = (sourceSelectedKeys: string[], targetSelectedKeys: string[]) => {
    setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
  };

  const TableSchemaComponent = ({ table, advancedSecurityEnabled }) => {
    // 状态管理数据安全选项
    const [securityOptions, setSecurityOptions] = useState({});

    // 处理安全选项变更
    const handleSecurityOptionChange = (fieldName, optionType) => {
      setSecurityOptions((prev) => {
        const fieldOptions = prev[fieldName] || { encrypt: false, mask: false };

        // 如果已经选择了当前选项，则取消选择
        if (fieldOptions[optionType]) {
          return {
            ...prev,
            [fieldName]: {
              ...fieldOptions,
              [optionType]: false,
            },
          };
        }

        // 否则选择当前选项，并确保另一个选项被取消
        return {
          ...prev,
          [fieldName]: {
            encrypt: optionType === 'encrypt',
            mask: optionType === 'mask',
          },
        };
      });
    };

    // 定义列
    const columns = [
      {
        title: intl.formatMessage({ id: 'pages.sync.fieldName' }),
        dataIndex: 'fieldName',
        key: 'fieldName',
      },
      {
        title: intl.formatMessage({ id: 'pages.sync.fieldType' }),
        dataIndex: 'fieldType',
        key: 'fieldType',
      },
      // 当启用高级安全选项时显示操作列
      ...(advancedSecurityEnabled
        ? [
            {
              title: intl.formatMessage({ id: 'pages.sync.securityOptions' }),
              key: 'securityOptions',
              render: (_, record) => {
                const fieldOptions = securityOptions[record.fieldName] || {
                  encrypt: false,
                  mask: false,
                };

                return (
                  <Space size="middle">
                    <Button
                      type={fieldOptions.encrypt ? 'primary' : 'default'}
                      icon={<LockOutlined />}
                      size="small"
                      onClick={() => handleSecurityOptionChange(record.fieldName, 'encrypt')}
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      {intl.formatMessage({ id: 'pages.sync.encrypt' })}
                    </Button>
                    <Button
                      type={fieldOptions.mask ? 'primary' : 'default'}
                      icon={<EyeInvisibleOutlined />}
                      size="small"
                      onClick={() => handleSecurityOptionChange(record.fieldName, 'mask')}
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      {intl.formatMessage({ id: 'pages.sync.mask' })}
                    </Button>
                  </Space>
                );
              },
            },
          ]
        : []),
    ];

    // 表格数据源 - 修改数据处理方式，直接使用传入的数组
    const dataSource = Array.isArray(table)
      ? table.map((field) => ({
          key: field.key || field.fieldName || field.name,
          fieldName: field.fieldName || field.name,
          fieldType: field.fieldType || field.type,
        }))
      : [];

    return <Table columns={columns} dataSource={dataSource} pagination={false} />;
  };

  return (
    <StepsForm
      formRef={formRef}
      onFinish={handleSubmit}
      formProps={{ preserve: true }}
      current={currentStep}
      onCurrentChange={setCurrentStep}
      stepsFormRender={(dom, submitter) => (
        <Modal
          title={
            record && record.id
              ? intl.formatMessage({ id: 'pages.sync.editConfig' })
              : intl.formatMessage({ id: 'pages.sync.addConfig' })
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
        title={intl.formatMessage({ id: 'pages.sync.sourceType' })}
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
          if (record?.sourceConn) {
            globalSourceConn = record.sourceConn;
            setSourceConnectionInfo({
              sourceType: values.sourceType,
              sourceConn: record.sourceConn,
            });
          }
          return true;
        }}
      >
        <ProFormText
          name="taskName"
          label={intl.formatMessage({ id: 'pages.sync.taskName' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTaskName' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.sync.pleaseEnterTaskName' }),
            },
          ]}
        />
        <ProFormSelect
          name="sourceType"
          label={intl.formatMessage({ id: 'pages.sync.sourceType' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.sync.pleaseSelectSourceType' }),
            },
          ]}
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
        title={intl.formatMessage({ id: 'pages.sync.sourceDBConn' })}
        initialValues={{ sourceConn: record?.sourceConn || {} }}
        onFinish={handleSourceConnNext}
      >
        <ProFormText
          name={['sourceConn', 'host']}
          label={intl.formatMessage({ id: 'pages.sync.host' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterSourceHost' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.sync.pleaseEnterSourceHost' }),
            },
          ]}
        />
        <ProFormText
          name={['sourceConn', 'port']}
          label={intl.formatMessage({ id: 'pages.sync.port' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterSourcePort' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.sync.pleaseEnterSourcePort' }),
            },
          ]}
        />
        <ProFormText
          name={['sourceConn', 'user']}
          label={intl.formatMessage({ id: 'pages.sync.username' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterSourceUsername' })}
        />
        <ProFormText
          name={['sourceConn', 'password']}
          label={intl.formatMessage({ id: 'pages.sync.password' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterSourcePassword' })}
          fieldProps={{ type: 'password' }}
        />
        <ProFormText
          name={['sourceConn', 'database']}
          label={intl.formatMessage({ id: 'pages.sync.databaseName' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterSourceDB' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.sync.pleaseEnterSourceDB' }),
            },
          ]}
        />
        <Space>
          <Button onClick={testSourceConn}>Test Connection</Button>
        </Space>
      </StepsForm.StepForm>

      {/* 步骤3：Target DB 连接信息 */}
      <StepsForm.StepForm
        name="targetConnStep"
        title={intl.formatMessage({ id: 'pages.sync.targetDBConn' })}
        initialValues={{ targetConn: record?.targetConn || {} }}
        onFinish={handleTargetConnNext}
      >
        <ProFormText
          name={['targetConn', 'host']}
          label={intl.formatMessage({ id: 'pages.sync.host' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetHost' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetHost' }),
            },
          ]}
        />
        <ProFormText
          name={['targetConn', 'port']}
          label={intl.formatMessage({ id: 'pages.sync.port' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetPort' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetPort' }),
            },
          ]}
        />
        <ProFormText
          name={['targetConn', 'user']}
          label={intl.formatMessage({ id: 'pages.sync.username' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetUsername' })}
        />
        <ProFormText
          name={['targetConn', 'password']}
          label={intl.formatMessage({ id: 'pages.sync.password' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetPassword' })}
          fieldProps={{ type: 'password' }}
        />
        <ProFormText
          name={['targetConn', 'database']}
          label={intl.formatMessage({ id: 'pages.sync.databaseName' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetDB' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetDB' }),
            },
          ]}
        />
        <Space>
          <Button onClick={testTargetConn}>Test Connection</Button>
        </Space>
      </StepsForm.StepForm>

      {/* 步骤4：表/集合映射 */}
      <StepsForm.StepForm
        name="mappingStep"
        title={intl.formatMessage({ id: 'pages.sync.tableMapping' })}
      >
        <Transfer
          dataSource={tableData}
          titles={[
            intl.formatMessage({ id: 'pages.sync.availableTables' }),
            intl.formatMessage({ id: 'pages.sync.selectedTables' }),
          ]}
          targetKeys={targetKeys}
          selectedKeys={selectedKeys}
          onChange={onTransferChange}
          onSelectChange={onSelectChange}
          render={(item) => item.title}
          listStyle={{ width: 200, height: 300 }}
        />

        {/* 添加高级安全选项开关 */}
        <div style={{ marginTop: 24, borderTop: '1px dashed #ccc', paddingTop: 16 }}>
          <Switch
            checked={showSecurityOptions}
            onChange={setShowSecurityOptions}
            style={{ marginRight: 8 }}
          />
          <Typography.Text strong>
            {intl.formatMessage({ id: 'pages.sync.advancedSecurity' })}
          </Typography.Text>
        </div>

        {/* 显示表字段及操作 */}
        {showSecurityOptions && (
          <div style={{ marginTop: 16 }}>
            <Collapse>
              {(targetKeys || []).map((tableName) => {
                console.log(`表 ${tableName} 的字段数据:`, fieldsMockData[tableName]);
                return (
                  <Collapse.Panel
                    header={`${intl.formatMessage({ id: 'pages.syncSettings.table' })}${tableName}`}
                    key={tableName}
                  >
                    {isLoadingFields && !fieldsMockData[tableName] ? (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Spin
                          tip={intl.formatMessage({ id: 'pages.syncSettings.loadingFields' })}
                        />
                      </div>
                    ) : (
                      <TableSchemaComponent
                        table={fieldsMockData[tableName] || []}
                        advancedSecurityEnabled={showSecurityOptions}
                      />
                    )}
                  </Collapse.Panel>
                );
              })}
            </Collapse>
          </div>
        )}
      </StepsForm.StepForm>
    </StepsForm>
  );
};

export default AddSync;
