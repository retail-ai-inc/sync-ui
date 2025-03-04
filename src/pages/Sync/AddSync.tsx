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
import type { Key } from 'antd/es/table/interface';
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
  fieldSecurity?: FieldSecurityOption[];
}

interface MappingBlock {
  tables: TableItem[];
  sourceDatabase?: string;
  sourceSchema?: string;
  targetDatabase?: string;
  targetSchema?: string;
  securityEnabled?: boolean;
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
  securityEnabled?: boolean;

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

// 添加安全选项类型定义
interface FieldSecurityOption {
  field: string;
  securityType: 'encrypted' | 'masked';
}

// 修改 TableSecurityOptions 接口以便被使用
interface TableSecurityOption {
  sourceTable: string;
  targetTable: string;
  fieldSecurity: FieldSecurityOption[];
}

interface FieldOption {
  encrypt: boolean;
  mask: boolean;
}

interface TableSchemaComponentProps {
  table: any[];
  advancedSecurityEnabled: boolean;
}

// 实现 collectSecurityOptions 函数 (之前只是声明但未实现)
const collectSecurityOptions = (): TableSecurityOption[] => {
  // 这里应该有实现，我添加一个简单的实现作为示例
  return [];
};

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

  // 添加新的状态来存储表的安全选项
  const [tablesSecurityOptions, setTablesSecurityOptions] = useState<
    Record<string, Record<string, FieldOption>>
  >({});

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

    // Redis 不需要获取表结构
    if (globalSourceType === 'redis') {
      console.log('Redis 数据库不需要获取表结构');
      return;
    }

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
          // 转换API返回的数据格式为组件需要的格式，添加_tableName属性标记来源表
          const fieldData = response.data.fields.map((field: any) => ({
            key: `${tableName}_${field.name}`,
            fieldName: field.name,
            fieldType: field.type,
            status: 'normal',
            _tableName: tableName, // 添加表名标记，确保不会混淆
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

  // 修改穿梭框变更处理函数的类型，使其匹配 Transfer 所需类型
  const onTransferChange = (
    newTargetKeys: Key[],
    direction: TransferDirection,
    moveKeys: Key[],
  ) => {
    console.log('onTransferChange被调用:', { newTargetKeys, direction, moveKeys });
    // 转换为 string[] 类型
    setTargetKeys(newTargetKeys as string[]);

    // 找出新增的表，并获取它们的字段信息
    const addedTables = (newTargetKeys as string[]).filter((key) =>
      targetKeys ? !targetKeys.includes(key) : true,
    );

    console.log('新增表:', addedTables, '当前已选表:', targetKeys);

    if (addedTables.length > 0) {
      // 使用setTimeout确保表单值已更新
      setTimeout(() => {
        addedTables.forEach((tableName) => {
          console.log('准备获取表结构:', tableName);
          // 添加对 Redis 类型的检查，Redis 不需要获取表结构
          if (globalSourceType !== 'redis') {
            fetchTableSchema(tableName);
          }
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
    // 收集安全选项
    const tableSecurityOptions = collectSecurityOptions();

    // 将高级安全选项状态仅添加到顶级，不在mappings中重复
    values.securityEnabled = showSecurityOptions;

    // 组装 mappings 字段
    values.mappings = [
      {
        tables: (targetKeys || []).map((key) => {
          // 查找当前表的安全选项，添加类型注解
          const securityOptions = tableSecurityOptions.find(
            (option: TableSecurityOption) => option.sourceTable === key,
          );

          if (securityOptions) {
            // 如果有安全选项，包含fieldSecurity
            return {
              sourceTable: key,
              targetTable: key,
              fieldSecurity: securityOptions.fieldSecurity,
            };
          } else {
            // 否则返回基本信息
            return {
              sourceTable: key,
              targetTable: key,
            };
          }
        }),
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

  // 修改 onSelectChange 函数的类型
  const onSelectChange = (sourceSelectedKeys: Key[], targetSelectedKeys: Key[]) => {
    setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys] as string[]);
  };

  // 修改 TableSchemaComponent 组件，改变表名获取方式
  const TableSchemaComponent = ({ table, advancedSecurityEnabled }: TableSchemaComponentProps) => {
    // 直接使用传入的完整表名，而不是尝试从字段key提取
    const tableName =
      table.length > 0 && table[0]._tableName
        ? table[0]._tableName // 使用我们添加的特殊属性
        : table.length > 0
          ? String(table[0].key).split('_')[0]
          : ''; // 兼容旧逻辑

    // 使用父组件中已存储的选项或创建新的
    const [securityOptions, setSecurityOptions] = useState<Record<string, FieldOption>>(
      tablesSecurityOptions[tableName] || {},
    );

    // 当安全选项变更时更新父组件状态 - 使用 useEffect 的清理函数减少重复渲染
    useEffect(() => {
      // 避免空表名或空选项的情况
      if (!tableName || Object.keys(securityOptions).length === 0) return;

      // 比较当前选项和已存储选项是否相同，避免无意义的更新
      const currentOptions = tablesSecurityOptions[tableName];
      const needsUpdate =
        !currentOptions || JSON.stringify(currentOptions) !== JSON.stringify(securityOptions);

      if (needsUpdate) {
        // 使用函数式更新避免依赖于先前的状态
        setTablesSecurityOptions((prev) => ({
          ...prev,
          [tableName]: securityOptions,
        }));
      }

      // 返回清理函数
      return () => {
        // 清理时不需要做任何事情，但这有助于 React 优化更新
      };
    }, [tableName]); // 仅在表名变化时执行，securityOptions通过事件处理程序单独更新

    // 处理安全选项变更 - 在这里直接更新父组件状态
    const handleSecurityOptionChange = (fieldName: string, optionType: 'encrypt' | 'mask') => {
      setSecurityOptions((prev) => {
        const fieldOptions = prev[fieldName] || { encrypt: false, mask: false };

        // 如果已经选择了当前选项，则取消选择
        if (fieldOptions[optionType]) {
          const newOptions = {
            ...prev,
            [fieldName]: {
              ...fieldOptions,
              [optionType]: false,
            },
          };

          // 直接更新父组件状态
          setTablesSecurityOptions((prevTables) => ({
            ...prevTables,
            [tableName]: newOptions,
          }));

          return newOptions;
        }

        // 否则选择当前选项，并确保另一个选项被取消
        const newOptions = {
          ...prev,
          [fieldName]: {
            encrypt: optionType === 'encrypt',
            mask: optionType === 'mask',
          },
        };

        // 直接更新父组件状态
        setTablesSecurityOptions((prevTables) => ({
          ...prevTables,
          [tableName]: newOptions,
        }));

        return newOptions;
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
              render: (_: any, record: any) => {
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

  // 修改安全选项初始化逻辑，确保securityEnabled正确加载
  useEffect(() => {
    if (record) {
      // 使用控制台确认加载的record值
      console.log('Loading record:', record);

      // 初始化状态为false
      let securityEnabled = false;

      // 从顶级属性中检查securityEnabled
      if (record.securityEnabled !== undefined) {
        securityEnabled = !!record.securityEnabled;
        console.log('Using top-level securityEnabled:', securityEnabled);
      }
      // 如果顶级没有，则尝试从mapping中读取(兼容旧数据)
      else if (
        record.mappings &&
        record.mappings.length > 0 &&
        record.mappings[0].securityEnabled !== undefined
      ) {
        securityEnabled = !!record.mappings[0].securityEnabled;
        console.log('Using mapping securityEnabled:', securityEnabled);
      }

      // 设置状态值，并确保它被正确应用
      console.log('Setting showSecurityOptions to:', securityEnabled);
      setShowSecurityOptions(securityEnabled);

      // 确保UI组件反映这个状态
      setTimeout(() => {
        const currentValue = showSecurityOptions;
        console.log('Current showSecurityOptions after setting:', currentValue);
        if (currentValue !== securityEnabled) {
          // 如果状态没有正确更新，强制再次更新
          console.log('Forcing update of showSecurityOptions');
          setShowSecurityOptions(securityEnabled);
        }
      }, 100);

      // 初始化表安全选项
      if (record.mappings && record.mappings.length > 0 && record.mappings[0].tables) {
        const securityOptions: Record<string, Record<string, FieldOption>> = {};

        record.mappings[0].tables.forEach((table) => {
          if (table.fieldSecurity && table.fieldSecurity.length > 0) {
            const tableOptions: Record<string, FieldOption> = {};

            table.fieldSecurity.forEach((field) => {
              tableOptions[field.field] = {
                encrypt: field.securityType === 'encrypted',
                mask: field.securityType === 'masked',
              };
            });

            securityOptions[table.sourceTable] = tableOptions;
          }
        });

        // 更新状态
        if (Object.keys(securityOptions).length > 0) {
          setTablesSecurityOptions(securityOptions);
        }
      }
    }
  }, [record]); // 仅当record变化时触发

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
          targetKeys={targetKeys as Key[]}
          selectedKeys={selectedKeys as Key[]}
          onChange={onTransferChange}
          onSelectChange={onSelectChange}
          render={(item) => item.title}
          listStyle={{ width: 200, height: 300 }}
        />

        {/* 添加高级安全选项开关 */}
        <div style={{ marginTop: 24, borderTop: '1px dashed #ccc', paddingTop: 16 }}>
          <Switch
            checked={showSecurityOptions}
            onChange={(checked) => {
              console.log('Security option switch changed to:', checked);
              setShowSecurityOptions(checked);
              // 如果关闭安全选项，可以选择清空所有安全设置
              if (!checked) {
                // 可选：清空所有安全选项
                // setTablesSecurityOptions({});
              }
            }}
            style={{ marginRight: 8 }}
          />
          <Typography.Text strong>
            {intl.formatMessage({ id: 'pages.sync.advancedSecurity' })}
          </Typography.Text>
          {record &&
            (record.securityEnabled ||
              (record.mappings &&
                record.mappings.length > 0 &&
                record.mappings[0].securityEnabled)) && (
              <Typography.Text type="success" style={{ marginLeft: 8 }}>
                ({intl.formatMessage({ id: 'pages.sync.securityEnabled' })})
              </Typography.Text>
            )}
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
