import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Spin,
  Select,
  Row,
  Col,
  Input,
  Tabs,
  Badge,
  Empty,
  Tooltip,
} from 'antd';
import {
  LockOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  PlusOutlined,
  FilterOutlined,
  SecurityScanOutlined,
  SettingOutlined,
  TableOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { TransferDirection } from 'antd/es/transfer';
import type { FormInstance } from 'antd';
import type { Key } from 'antd/es/table/interface';
import { addSyncTask, updateSync, getTableSchema } from '@/services/ant-design-pro/sync';
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
  countQuery?: {
    enabled: boolean;
    conditions?: Array<{
      table: string;
      field: string;
      operator: string;
      value: string;
    }>;
  };
  advancedSettings?: {
    syncIndexes?: boolean;
    ignoreDeleteOps?: boolean;
    uploadToGcs?: boolean;
    gcsAddress?: string;
  };
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

  // Advanced settings are now part of mappings.tables[].advancedSettings
  // syncIndexes?: boolean;
  // monitorDelete?: boolean;

  // Potential DB-specific parameters if the record is loaded for editing
  pg_replication_slot?: string;
  pg_plugin?: string;
  pg_position_path?: string;
  pg_publication_names?: string;
  mysql_position_path?: string;
  mongodb_resume_token_path?: string;
  redis_position_path?: string;
}

// 全局变量存储源数据库类型和连接信息
let globalSourceType = '';
let globalSourceConn: SyncConn | null = null;

// 生成当前时间字符串
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

interface FieldSecurityOption {
  field: string;
  securityType: 'encrypted' | 'masked';
}

interface FieldOption {
  encrypt: boolean;
  mask: boolean;
}

interface TableSchemaComponentProps {
  table: any[];
  advancedSecurityEnabled: boolean;
  tableName: string;
}

const AddSync: React.FC<AddSyncProps> = ({ record, onSuccess, onCancel }) => {
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [tableData, setTableData] = useState<{ key: string; title: string; description: string }[]>(
    [],
  );
  const [conditions, setConditions] = useState<
    Array<{
      table: string;
      field: string;
      operator: string;
      value: string;
    }>
  >([]);

  const formRef = useRef<FormInstance>();
  const [fieldsMockData, setFieldsMockData] = useState<Record<string, any[]>>({});
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [sourceConnectionInfo, setSourceConnectionInfo] = useState<{
    sourceType: string;
    sourceConn: SyncConn;
  } | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<string>('overview');
  const [tablesSecurityOptions, setTablesSecurityOptions] = useState<
    Record<string, Record<string, FieldOption>>
  >({});
  const [currentQueryTable, setCurrentQueryTable] = useState<string>('');
  const [currentQueryField, setCurrentQueryField] = useState<string>('');
  const [currentQueryOperator, setCurrentQueryOperator] = useState<string>('=');
  const [currentQueryValue, setCurrentQueryValue] = useState<string>('');
  const [tableAdvancedSettings, setTableAdvancedSettings] = useState<
    Record<
      string,
      { syncIndexes: boolean; ignoreDeleteOps: boolean; uploadToGcs: boolean; gcsAddress: string }
    >
  >({});

  const intl = useIntl();

  // 编辑任务时，根据 record.mappings 初始化 Transfer 选择
  useEffect(() => {
    if (record && record.mappings && record.mappings.length > 0) {
      const firstMapping = record.mappings[0];
      if (firstMapping.tables && firstMapping.tables.length > 0) {
        const keys = firstMapping.tables.map((t) => t.sourceTable);
        setTargetKeys(keys);

        // 同时设置当前查询表为第一个表
        setCurrentQueryTable(keys[0]);
      } else {
        setTargetKeys([]);
        setCurrentQueryTable('');
      }
    } else {
      setTargetKeys([]);
      setCurrentQueryTable('');
    }
  }, [record]);

  // 初始化查询条件
  useEffect(() => {
    if (record && record.mappings && record.mappings.length > 0) {
      const firstMapping = record.mappings[0];
      if (firstMapping.tables && firstMapping.tables.length > 0) {
        const allConditions: Array<{
          table: string;
          field: string;
          operator: string;
          value: string;
        }> = [];

        firstMapping.tables.forEach((table) => {
          if (table.countQuery?.conditions && table.countQuery.conditions.length > 0) {
            table.countQuery.conditions.forEach((condition) => {
              allConditions.push(condition);
            });
          } else if (table.countQuery?.enabled) {
            // 兼容旧数据格式
            if ((table.countQuery as any).companyId) {
              allConditions.push({
                table: table.sourceTable,
                field: 'companyId',
                operator: '=',
                value: (table.countQuery as any).companyId,
              });
            }

            if ((table.countQuery as any).dateField) {
              allConditions.push({
                table: table.sourceTable,
                field: (table.countQuery as any).dateField,
                operator: 'dateRange',
                value: (table.countQuery as any).dateRange || 'daily',
              });
            }
          }
        });

        if (allConditions.length > 0) {
          setConditions(allConditions);
        }
      }
    }
  }, [record]);

  // 获取表结构信息的函数
  const fetchTableSchema = async (tableName: string) => {
    // Redis 不需要获取表结构
    if (globalSourceType === 'redis') {
      return;
    }

    // 首先尝试使用全局变量
    if (globalSourceType && globalSourceConn) {
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

        if (response.success && response.data.fields) {
          const fieldData = response.data.fields.map((field: any) => ({
            key: `${tableName}_${field.name}`,
            fieldName: field.name,
            fieldType: field.type,
            status: 'normal',
            _tableName: tableName,
          }));

          setFieldsMockData((prev) => ({
            ...prev,
            [tableName]: fieldData,
          }));
        } else {
          message.error(intl.formatMessage({ id: 'pages.syncSettings.fetchFieldsFailed' }));
        }
      } catch (error) {
        message.error(intl.formatMessage({ id: 'pages.syncSettings.fetchFieldsFailed' }));
      } finally {
        setIsLoadingFields(false);
      }
    } else if (sourceConnectionInfo) {
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
          const fieldData = response.data.fields.map((field: any) => ({
            key: `${tableName}_${field.name}`,
            fieldName: field.name,
            fieldType: field.type,
            status: 'normal',
          }));

          setFieldsMockData((prev) => ({
            ...prev,
            [tableName]: fieldData,
          }));
        } else {
          message.error(intl.formatMessage({ id: 'pages.syncSettings.fetchFieldsFailed' }));
        }
      } catch (error) {
        message.error(intl.formatMessage({ id: 'pages.syncSettings.fetchFieldsFailed' }));
      } finally {
        setIsLoadingFields(false);
      }
    } else {
      message.error(intl.formatMessage({ id: 'pages.syncSettings.missingConnectionInfo' }));
    }
  };

  // 穿梭框变更处理函数
  const onTransferChange = (
    newTargetKeys: Key[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _direction: TransferDirection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _moveKeys: Key[],
  ) => {
    setTargetKeys(newTargetKeys as string[]);

    // 找出新增的表，并获取它们的字段信息和设置默认的高级设置
    const addedTables = (newTargetKeys as string[]).filter((key) =>
      targetKeys ? !targetKeys.includes(key) : true,
    );

    if (addedTables.length > 0) {
      // 为新表设置默认的高级设置
      setTableAdvancedSettings((prev) => {
        const newSettings = { ...prev };
        addedTables.forEach((tableName) => {
          if (!newSettings[tableName]) {
            newSettings[tableName] = {
              syncIndexes: false,
              ignoreDeleteOps: false,
              uploadToGcs: false,
              gcsAddress: '',
            };
          }
        });
        return newSettings;
      });

      // 获取新增表的字段信息
      setTimeout(() => {
        addedTables.forEach((tableName) => {
          if (globalSourceType !== 'redis') {
            fetchTableSchema(tableName);
          }
        });
      }, 0);
    }
  };

  // 当进入表映射步骤时，加载表数据和字段信息
  useEffect(() => {
    if (currentStep === 3) {
      // 如果没有表数据但有连接信息，尝试加载表数据
      if (tableData.length === 0 && globalSourceType && globalSourceConn) {
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
          .catch(() => {
            // 静默处理错误
          });
      }

      // 如果有选中的表，加载字段信息
      if (targetKeys && targetKeys.length > 0) {
        targetKeys.forEach((tableName) => {
          if (!fieldsMockData[tableName]) {
            fetchTableSchema(tableName);
          }
        });
      }
    }
  }, [currentStep]);

  // 点击最右侧"提交"时执行
  const handleSubmit = async (values: any) => {
    // 检查是否有任何表设置了字段安全配置
    const hasSecurityConfig = Object.values(tablesSecurityOptions).some((tableOptions) => {
      return Object.values(tableOptions).some((option) => option.encrypt || option.mask);
    });

    // 1. Construct mappings array first, incorporating per-table advanced settings
    const mappings: MappingBlock[] = [
      {
        tables: (targetKeys || []).map((tableName) => {
          const tableMapping: TableItem = {
            sourceTable: tableName,
            targetTable: tableName,
            // Integrate advancedSettings from tableAdvancedSettings state
            advancedSettings: {
              syncIndexes: tableAdvancedSettings[tableName]?.syncIndexes ?? false,
              ignoreDeleteOps: tableAdvancedSettings[tableName]?.ignoreDeleteOps ?? false,
              uploadToGcs: tableAdvancedSettings[tableName]?.uploadToGcs ?? false,
              gcsAddress: tableAdvancedSettings[tableName]?.gcsAddress ?? '',
            },
          };

          // Add fieldSecurity if enabled and configured
          if (tablesSecurityOptions[tableName]) {
            const fieldSecurity = Object.keys(tablesSecurityOptions[tableName])
              .map((fieldName) => {
                const options = tablesSecurityOptions[tableName][fieldName];
                let securityType: 'encrypted' | 'masked' | null = null;
                if (options.encrypt) securityType = 'encrypted';
                else if (options.mask) securityType = 'masked';
                if (securityType) return { field: fieldName, securityType };
                return null;
              })
              .filter((item): item is FieldSecurityOption => item !== null);
            if (fieldSecurity.length > 0) tableMapping.fieldSecurity = fieldSecurity;
          }

          // Add countQuery if there are conditions for this table
          const tableConditions = conditions.filter((c) => c.table === tableName);
          if (tableConditions.length > 0) {
            tableMapping.countQuery = { enabled: true, conditions: tableConditions };
          }

          return tableMapping;
        }),
        // Potentially: sourceDatabase, sourceSchema, targetDatabase, targetSchema
      },
    ];

    const dbType = values.sourceType;

    // 2. Explicitly build the main payload for the API, maintaining type safety
    const payload: Partial<SyncRecord> = {
      // Fields from the form (via 'values' object)
      taskName: values.taskName,
      sourceType: dbType, // Use sourceType as defined in SyncRecord
      sourceConn: values.sourceConn,
      targetConn: values.targetConn,

      // DB-specific parameters from 'values' (ensure these are optional in SyncRecord or handle undefined)
      pg_replication_slot: values.pg_replication_slot,
      pg_plugin: values.pg_plugin,
      pg_position_path: values.pg_position_path,
      pg_publication_names: values.pg_publication_names,
      mysql_position_path: values.mysql_position_path,
      mongodb_resume_token_path: values.mongodb_resume_token_path,
      redis_position_path: values.redis_position_path,

      // Mappings constructed above (now includes per-table advancedSettings)
      mappings: mappings,

      // Global security flag calculated from actual field security options
      securityEnabled: hasSecurityConfig,

      // API-managed fields
      lastUpdateTime: getCurrentTimeString(),
    };

    // 3. Set DB-specific params to undefined for other DB types if they are not applicable
    //    (Ensures only relevant params are sent, assuming optional fields in SyncRecord)
    switch (dbType) {
      case 'postgresql':
        payload.mysql_position_path = undefined;
        payload.mongodb_resume_token_path = undefined;
        payload.redis_position_path = undefined;
        break;
      case 'mysql':
      case 'mariadb': // Mariadb uses mysql_position_path
        payload.pg_replication_slot = undefined;
        payload.pg_plugin = undefined;
        payload.pg_position_path = undefined;
        payload.pg_publication_names = undefined;
        payload.mongodb_resume_token_path = undefined;
        payload.redis_position_path = undefined;
        break;
      case 'mongodb':
        payload.pg_replication_slot = undefined;
        payload.pg_plugin = undefined;
        payload.pg_position_path = undefined;
        payload.pg_publication_names = undefined;
        payload.mysql_position_path = undefined;
        payload.redis_position_path = undefined;
        break;
      case 'redis':
        payload.pg_replication_slot = undefined;
        payload.pg_plugin = undefined;
        payload.pg_position_path = undefined;
        payload.pg_publication_names = undefined;
        payload.mysql_position_path = undefined;
        payload.mongodb_resume_token_path = undefined;
        break;
      default: // If dbType is something else, all specific params are undefined
        payload.pg_replication_slot = undefined;
        payload.pg_plugin = undefined;
        payload.pg_position_path = undefined;
        payload.pg_publication_names = undefined;
        payload.mysql_position_path = undefined;
        payload.mongodb_resume_token_path = undefined;
        payload.redis_position_path = undefined;
        break;
    }

    let res;
    if (record && record.id) {
      // For update, merge with existing record fields.
      // Payload will override fields from record if they exist in payload.
      const finalBody: SyncRecord = {
        ...(record as SyncRecord), // Start with all fields from the existing record
        ...(payload as SyncRecord), // Override/add fields from the newly constructed payload
        id: record.id, // Ensure ID is present for update
        enable: record.enable, // Preserve existing 'enable' status explicitly if not in form
        status: record.status, // Preserve existing 'status' explicitly if not in form
      };

      // The top-level syncIndexes and monitorDelete are no longer in SyncRecord type.
      // If 'record' prop could have them from an old data structure, deleting them defensively is an option:
      // delete (finalBody as any).syncIndexes;
      // delete (finalBody as any).monitorDelete;
      // However, if SyncRecord type is the source of truth and updated, this shouldn't be necessary.

      res = await updateSync({ id: record.id.toString(), body: finalBody });
    } else {
      // For new tasks, set status and use the constructed payload
      (payload as SyncRecord).status = 'Running'; // Default status for new tasks
      (payload as SyncRecord).enable = true; // Default enable for new tasks
      res = await addSyncTask(payload as SyncRecord);
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

  // 表结构组件
  const TableSchemaComponent = ({
    table,
    advancedSecurityEnabled,
    tableName,
  }: TableSchemaComponentProps) => {
    const [securityOptions, setSecurityOptions] = useState<Record<string, FieldOption>>(
      tablesSecurityOptions[tableName] || {},
    );

    const handleSecurityOptionChange = useCallback(
      (fieldName: string, optionType: 'encrypt' | 'mask') => {
        const currentOptions = securityOptions[fieldName] || { encrypt: false, mask: false };

        let newFieldOptions: FieldOption;
        if (currentOptions[optionType]) {
          newFieldOptions = {
            ...currentOptions,
            [optionType]: false,
          };
        } else {
          newFieldOptions = {
            encrypt: optionType === 'encrypt',
            mask: optionType === 'mask',
          };
        }

        const newSecurityOptions = {
          ...securityOptions,
          [fieldName]: newFieldOptions,
        };

        setSecurityOptions(newSecurityOptions);
        setTablesSecurityOptions((prevTables) => ({
          ...prevTables,
          [tableName]: newSecurityOptions,
        }));
      },
      [securityOptions, tableName],
    );

    useEffect(() => {
      const parentOptions = tablesSecurityOptions[tableName] || {};
      setSecurityOptions(parentOptions);
    }, [tableName]);

    const organizeFields = (fields: any[]) => {
      const result: any[] = [];
      const nestedFields: Record<string, any[]> = {};

      fields.forEach((field) => {
        const fieldName = field.fieldName || field.name;
        if (fieldName.includes('.')) {
          const [parent, child] = fieldName.split('.');
          if (!nestedFields[parent]) {
            nestedFields[parent] = [];
            result.push({
              key: parent,
              fieldName: parent,
              fieldType: field.fieldType || field.type,
              isParent: true,
              children: nestedFields[parent],
            });
          }
          nestedFields[parent].push({
            key: `${parent}.${child}`,
            fieldName: child,
            fieldType: field.fieldType || field.type,
            fullFieldName: fieldName,
          });
        } else {
          result.push({
            key: fieldName,
            fieldName: fieldName,
            fieldType: field.fieldType || field.type,
          });
        }
      });

      return result;
    };

    const securityColumn = advancedSecurityEnabled
      ? {
          title: intl.formatMessage({ id: 'pages.sync.securityOptions' }),
          key: 'securityOptions',
          render: (_: any, record: any) => {
            const fieldName = record.fullFieldName || record.fieldName;
            if (record.isParent) {
              return null;
            }

            const fieldOptions = securityOptions[fieldName] || {
              encrypt: false,
              mask: false,
            };

            return (
              <Space size="middle">
                <Button
                  type={fieldOptions.encrypt ? 'primary' : 'default'}
                  icon={<LockOutlined />}
                  size="small"
                  onClick={() => handleSecurityOptionChange(fieldName, 'encrypt')}
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  {intl.formatMessage({ id: 'pages.sync.encrypt' })}
                </Button>
                <Button
                  type={fieldOptions.mask ? 'primary' : 'default'}
                  icon={<EyeInvisibleOutlined />}
                  size="small"
                  onClick={() => handleSecurityOptionChange(fieldName, 'mask')}
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  {intl.formatMessage({ id: 'pages.sync.mask' })}
                </Button>
              </Space>
            );
          },
        }
      : {};

    // 修改列定义
    const columns = [
      {
        title: intl.formatMessage({ id: 'pages.sync.fieldName' }),
        dataIndex: 'fieldName',
        key: 'fieldName',
        render: (text: string, record: any) => {
          // 为父字段添加加粗样式
          return record.isParent ? (
            <Typography.Text strong>{text}</Typography.Text>
          ) : (
            <span style={{ paddingLeft: record.fullFieldName ? 24 : 0 }}>{text}</span>
          );
        },
      },
      {
        title: intl.formatMessage({ id: 'pages.sync.fieldType' }),
        dataIndex: 'fieldType',
        key: 'fieldType',
      },
      ...(advancedSecurityEnabled ? [securityColumn] : []),
    ];

    // 处理表格数据源
    const dataSource = organizeFields(
      Array.isArray(table)
        ? table.map((field) => ({
            key: field.key || field.fieldName || field.name,
            fieldName: field.fieldName || field.name,
            fieldType: field.fieldType || field.type,
          }))
        : [],
    );

    return (
      <Table
        columns={columns.filter(Boolean)}
        dataSource={dataSource}
        pagination={false}
        indentSize={24}
        defaultExpandAllRows={true}
        expandable={{
          expandRowByClick: false,
          expandedRowKeys: dataSource.filter((item) => item.isParent).map((item) => item.key),
          rowExpandable: (record) => record.isParent,
        }}
      />
    );
  };

  // 初始化安全选项和高级设置
  useEffect(() => {
    if (record) {
      if (record.mappings && record.mappings.length > 0 && record.mappings[0].tables) {
        const newTablesSecurityOptions: Record<string, Record<string, FieldOption>> = {};
        const newTableAdvancedSettings: Record<
          string,
          {
            syncIndexes: boolean;
            ignoreDeleteOps: boolean;
            uploadToGcs: boolean;
            gcsAddress: string;
          }
        > = {};

        record.mappings[0].tables.forEach((table) => {
          // 加载每个表的高级设置
          newTableAdvancedSettings[table.sourceTable] = {
            syncIndexes: table.advancedSettings?.syncIndexes ?? false,
            ignoreDeleteOps: table.advancedSettings?.ignoreDeleteOps ?? false,
            uploadToGcs: table.advancedSettings?.uploadToGcs ?? false,
            gcsAddress: table.advancedSettings?.gcsAddress ?? '',
          };

          if (table.fieldSecurity && table.fieldSecurity.length > 0) {
            if (!newTablesSecurityOptions[table.sourceTable]) {
              newTablesSecurityOptions[table.sourceTable] = {};
            }

            table.fieldSecurity.forEach((security) => {
              newTablesSecurityOptions[table.sourceTable][security.field] = {
                encrypt: security.securityType === 'encrypted',
                mask: security.securityType === 'masked',
              };
            });
          }
        });

        if (Object.keys(newTablesSecurityOptions).length > 0) {
          setTablesSecurityOptions(newTablesSecurityOptions);
        }

        if (Object.keys(newTableAdvancedSettings).length > 0) {
          setTableAdvancedSettings(newTableAdvancedSettings);
        }
      }
    }
  }, [record]);

  // 添加查询条件
  const addCondition = () => {
    if (!currentQueryTable) {
      message.warning(intl.formatMessage({ id: 'pages.sync.pleaseSelectTableFirst' }));
      return;
    }

    if (!currentQueryField) {
      message.warning(intl.formatMessage({ id: 'pages.sync.fieldRequired' }));
      return;
    }

    setConditions([
      ...conditions,
      {
        table: currentQueryTable,
        field: currentQueryField,
        operator: currentQueryOperator,
        value: currentQueryValue,
      },
    ]);

    // 清空表单数据，准备添加下一个条件
    setCurrentQueryField('');
    setCurrentQueryValue('');
  };

  // 删除查询条件
  const removeCondition = (index: number) => {
    const newConditions = [...conditions];
    newConditions.splice(index, 1);
    setConditions(newConditions);
  };

  // 当表选择变化时，更新当前查询表（仅在没有设置时）
  useEffect(() => {
    if (targetKeys.length > 0 && !currentQueryTable) {
      const firstTable = targetKeys[0];
      setCurrentQueryTable(firstTable);
    }
  }, [targetKeys, currentQueryTable]);

  // 修复Tab键导航问题
  React.useEffect(() => {
    const handleTabNavigation = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const target = e.target as HTMLInputElement;

        if (target.tagName === 'INPUT' && target.value && target.closest('.ant-modal')) {
          e.preventDefault();
          e.stopImmediatePropagation();

          const modal = target.closest('.ant-modal')!;
          const visibleInputs = Array.from(
            modal.querySelectorAll('input:not([disabled]):not([type="hidden"])'),
          ).filter((input) => {
            const style = window.getComputedStyle(input);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }) as HTMLInputElement[];

          const currentIndex = visibleInputs.indexOf(target);
          const targetIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
          const targetInput = visibleInputs[targetIndex];

          if (targetInput) {
            setTimeout(() => {
              targetInput.focus();
              targetInput.select();
            }, 0);
          }
        }
      }
    };

    document.addEventListener('keydown', handleTabNavigation, { capture: true, passive: false });

    return () => {
      document.removeEventListener('keydown', handleTabNavigation, { capture: true });
    };
  }, []);

  return (
    <StepsForm
      formRef={formRef}
      onFinish={handleSubmit}
      formProps={{
        preserve: true,
        validateTrigger: [], // 完全禁用自动验证
        autoComplete: 'off', // 禁用浏览器自动完成
      }}
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
        title={intl.formatMessage({ id: 'pages.sync.sourceTypeStep' })}
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
          fieldProps={{ autoComplete: 'off' }}
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
                    <ProFormText
                      name="pg_replication_slot"
                      label="PostgreSQL Replication Slot"
                      fieldProps={{ autoComplete: 'off' }}
                    />
                    <ProFormText
                      name="pg_plugin"
                      label="PostgreSQL Plugin"
                      fieldProps={{ autoComplete: 'off' }}
                    />
                    <ProFormText
                      name="pg_position_path"
                      label="PostgreSQL Position Path"
                      fieldProps={{ autoComplete: 'off' }}
                    />
                    <ProFormText
                      name="pg_publication_names"
                      label="PostgreSQL Publication Names"
                      fieldProps={{ autoComplete: 'off' }}
                    />
                  </>
                );
              case 'mysql':
                return (
                  <ProFormText
                    name="mysql_position_path"
                    label="MySQL Position Path"
                    fieldProps={{ autoComplete: 'off' }}
                  />
                );
              case 'mariadb':
                return (
                  <ProFormText
                    name="mysql_position_path"
                    label="MariaDB Position Path"
                    fieldProps={{ autoComplete: 'off' }}
                  />
                );
              case 'mongodb':
                return (
                  <ProFormText
                    name="mongodb_resume_token_path"
                    label={
                      <span>
                        MongoDB Checkpoint Path{' '}
                        <Tooltip title="Specifies the file path for storing MongoDB checkpoint logs and position data. This path is used to track the resume token for change stream operations, ensuring data consistency during synchronization restarts.">
                          <InfoCircleOutlined style={{ color: '#1890ff' }} />
                        </Tooltip>
                      </span>
                    }
                    fieldProps={{ autoComplete: 'off' }}
                  />
                );
              case 'redis':
                return (
                  <ProFormText
                    name="redis_position_path"
                    label="Redis Position Path"
                    fieldProps={{ autoComplete: 'off' }}
                  />
                );
              default:
                return null;
            }
          }}
        </ProFormDependency>
      </StepsForm.StepForm>

      {/* 步骤2：Source DB 连接信息 */}
      <StepsForm.StepForm
        name="sourceConnStep"
        title={intl.formatMessage({ id: 'pages.sync.sourceDBConnStep' })}
        initialValues={{ sourceConn: record?.sourceConn || {} }}
        onFinish={handleSourceConnNext}
      >
        <ProFormText
          name={['sourceConn', 'host']}
          label={intl.formatMessage({ id: 'pages.sync.host' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterSourceHost' })}
          fieldProps={{ autoComplete: 'off' }}
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
          fieldProps={{ autoComplete: 'off' }}
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
          fieldProps={{ autoComplete: 'off' }}
        />
        <ProFormText
          name={['sourceConn', 'password']}
          label={intl.formatMessage({ id: 'pages.sync.password' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterSourcePassword' })}
          fieldProps={{ type: 'password', autoComplete: 'new-password' }}
        />
        <ProFormText
          name={['sourceConn', 'database']}
          label={intl.formatMessage({ id: 'pages.sync.databaseName' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterSourceDB' })}
          fieldProps={{ autoComplete: 'off' }}
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
        title={intl.formatMessage({ id: 'pages.sync.targetDBConnStep' })}
        initialValues={{ targetConn: record?.targetConn || {} }}
        onFinish={handleTargetConnNext}
      >
        <ProFormText
          name={['targetConn', 'host']}
          label={intl.formatMessage({ id: 'pages.sync.host' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetHost' })}
          fieldProps={{ autoComplete: 'off' }}
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
          fieldProps={{ autoComplete: 'off' }}
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
          fieldProps={{ autoComplete: 'off' }}
        />
        <ProFormText
          name={['targetConn', 'password']}
          label={intl.formatMessage({ id: 'pages.sync.password' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetPassword' })}
          fieldProps={{ type: 'password', autoComplete: 'new-password' }}
        />
        <ProFormText
          name={['targetConn', 'database']}
          label={intl.formatMessage({ id: 'pages.sync.databaseName' })}
          placeholder={intl.formatMessage({ id: 'pages.sync.pleaseEnterTargetDB' })}
          fieldProps={{ autoComplete: 'off' }}
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
        title={intl.formatMessage({ id: 'pages.sync.tableMappingStep' })}
      >
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ marginBottom: 16 }}>
            <Row gutter={[0, 16]}>
              <Col span={24}>
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
                  listStyle={{ width: 300, height: 300 }}
                  showSearch
                  filterOption={(inputValue, option) =>
                    option.title.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                  }
                />
              </Col>
            </Row>
          </div>

          {/* 全局设置区域 - 删除整个区域 */}

          {targetKeys.length > 0 && (
            <div
              style={{
                marginTop: 16,
                border: '1px solid #f0f0f0',
                borderRadius: '4px',
                padding: '16px',
                height: '400px',
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
              }}
              className="sync-config-container"
            >
              {/* 表选择器 */}
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <Space align="center">
                    <Typography.Text strong>
                      {intl.formatMessage({ id: 'pages.sync.selectTableLabel' })}
                    </Typography.Text>
                    <Select
                      style={{ width: 300 }}
                      placeholder={intl.formatMessage({ id: 'pages.sync.selectTableToConfig' })}
                      value={currentQueryTable}
                      onChange={(value) => {
                        setCurrentQueryTable(value);

                        // 优先显示概览Tab
                        setActiveTabKey('overview');
                      }}
                    >
                      {targetKeys.map((table) => (
                        <Select.Option key={table} value={table}>
                          {table}
                        </Select.Option>
                      ))}
                    </Select>
                  </Space>
                </Col>
              </Row>

              {/* 中心化功能选项卡 */}
              <Tabs
                defaultActiveKey="overview"
                style={{ marginTop: 16, width: '100%' }}
                destroyInactiveTabPane={false}
                animated={false}
                tabBarStyle={{
                  marginBottom: 0,
                  background: '#fafafa',
                  borderRadius: '6px 6px 0 0',
                  padding: '4px',
                  border: '1px solid #d9d9d9',
                  borderBottom: 'none',
                }}
                className="sync-tab-container"
                activeKey={activeTabKey}
                type="card"
                size="small"
                onChange={(activeKey) => {
                  setActiveTabKey(activeKey);
                  // 在下一个事件循环中确保选项卡内容区域高度稳定
                  setTimeout(() => {
                    const contentWrappers = document.querySelectorAll('.tab-content-wrapper');
                    contentWrappers.forEach((wrapper) => {
                      if (wrapper) {
                        (wrapper as HTMLElement).style.height = '300px';
                      }
                    });
                  }, 0);
                }}
                tabBarGutter={2}
              >
                {/* 表概览选项卡 */}
                <Tabs.TabPane
                  tab={
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        fontWeight: 500,
                        fontSize: '12px',
                      }}
                    >
                      <TableOutlined style={{ fontSize: '12px' }} />
                      <span>{intl.formatMessage({ id: 'pages.sync.tableOverviewTab' })}</span>
                    </div>
                  }
                  key="overview"
                  forceRender
                >
                  <div
                    className="tab-content-wrapper"
                    style={{
                      height: '300px',
                      overflowY: 'scroll',
                      background: '#fff',
                      border: '1px solid #d9d9d9',
                      borderTop: 'none',
                      padding: '16px',
                    }}
                  >
                    <div style={{ marginBottom: '12px' }}>
                      <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                        {intl.formatMessage(
                          { id: 'pages.sync.tableOverviewDesc' },
                          {
                            defaultMessage:
                              '查看所有已选择表的配置状态概览，点击表行可以选择要配置的表',
                          },
                        )}
                      </Typography.Text>
                    </div>
                    <Table
                      dataSource={targetKeys.map((tableName) => ({
                        key: tableName,
                        tableName,
                        securityCount: tablesSecurityOptions[tableName]
                          ? Object.values(tablesSecurityOptions[tableName]).filter(
                              (opt) => opt.encrypt || opt.mask,
                            ).length
                          : 0,
                        queryCount: conditions.filter((c) => c.table === tableName).length,
                      }))}
                      columns={[
                        {
                          title: intl.formatMessage({ id: 'pages.sync.tableName' }),
                          dataIndex: 'tableName',
                          key: 'tableName',
                        },
                        {
                          title: intl.formatMessage({ id: 'pages.sync.securityFields' }),
                          dataIndex: 'securityCount',
                          key: 'securityCount',
                          render: (count) => (
                            <Space>
                              <Badge
                                count={count}
                                style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }}
                              />
                              {count > 0 ? (
                                <Typography.Text type="success">
                                  {intl.formatMessage({ id: 'pages.sync.configured' })}
                                </Typography.Text>
                              ) : (
                                <Typography.Text type="secondary">
                                  {intl.formatMessage({ id: 'pages.sync.notConfigured' })}
                                </Typography.Text>
                              )}
                            </Space>
                          ),
                        },
                        {
                          title: intl.formatMessage({ id: 'pages.sync.queryConditions' }),
                          dataIndex: 'queryCount',
                          key: 'queryCount',
                          render: (count) => (
                            <Space>
                              <Badge
                                count={count}
                                style={{ backgroundColor: count > 0 ? '#1890ff' : '#d9d9d9' }}
                              />
                              {count > 0 ? (
                                <Typography.Text type="success">
                                  {intl.formatMessage({ id: 'pages.sync.configured' })}
                                </Typography.Text>
                              ) : (
                                <Typography.Text type="secondary">
                                  {intl.formatMessage({ id: 'pages.sync.notConfigured' })}
                                </Typography.Text>
                              )}
                            </Space>
                          ),
                        },
                      ]}
                      pagination={false}
                      size="small"
                      rowClassName={(record) =>
                        record.tableName === currentQueryTable ? 'ant-table-row-selected' : ''
                      }
                      onRow={(record) => ({
                        onClick: () => {
                          setCurrentQueryTable(record.tableName);
                        },
                        onDoubleClick: () => {
                          // 双击行时，如果行有安全配置则切换到Schema页，否则切换到Query页
                          setCurrentQueryTable(record.tableName);
                          const securityCount = tablesSecurityOptions[record.tableName]
                            ? Object.values(tablesSecurityOptions[record.tableName]).filter(
                                (opt) => opt.encrypt || opt.mask,
                              ).length
                            : 0;

                          // 优先展示有配置的Tab，否则默认切换到Schema
                          if (securityCount > 0) {
                            setActiveTabKey('schema');
                          } else {
                            const queryCount = conditions.filter(
                              (c) => c.table === record.tableName,
                            ).length;
                            if (queryCount > 0) {
                              setActiveTabKey('query');
                            } else {
                              setActiveTabKey('schema');
                            }
                          }
                        },
                        style: { cursor: 'pointer' },
                        title: intl.formatMessage(
                          { id: 'pages.sync.clickToSelectDoubleClickToEdit' },
                          { defaultMessage: '点击选中表，双击进入配置页' },
                        ),
                      })}
                    />
                  </div>
                </Tabs.TabPane>

                {/* 表结构选项卡 */}
                <Tabs.TabPane
                  tab={
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        fontWeight: 500,
                        fontSize: '12px',
                      }}
                    >
                      <SecurityScanOutlined style={{ fontSize: '12px' }} />
                      <span>{intl.formatMessage({ id: 'pages.sync.tableSchemaTab' })}</span>
                    </div>
                  }
                  key="schema"
                  disabled={!currentQueryTable}
                  forceRender
                >
                  <div
                    className="tab-content-wrapper"
                    style={{
                      height: '300px',
                      overflowY: 'scroll',
                      background: '#fff',
                      border: '1px solid #d9d9d9',
                      borderTop: 'none',
                      padding: '16px',
                    }}
                  >
                    {currentQueryTable ? (
                      <>
                        <div style={{ marginBottom: '12px' }}>
                          <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                            {intl.formatMessage(
                              { id: 'pages.sync.tableSchemaDesc' },
                              { defaultMessage: '为表字段配置安全选项，选择需要加密或脱敏的字段' },
                            )}
                          </Typography.Text>
                        </div>
                        {isLoadingFields && !fieldsMockData[currentQueryTable] ? (
                          <div style={{ textAlign: 'center', padding: '20px' }}>
                            <Spin
                              tip={intl.formatMessage({ id: 'pages.syncSettings.loadingFields' })}
                            />
                          </div>
                        ) : (
                          <TableSchemaComponent
                            table={fieldsMockData[currentQueryTable] || []}
                            advancedSecurityEnabled={true}
                            tableName={currentQueryTable}
                          />
                        )}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Empty
                          description={intl.formatMessage({ id: 'pages.sync.selectTableFirst' })}
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      </div>
                    )}
                  </div>
                </Tabs.TabPane>

                {/* 查询条件选项卡 */}
                <Tabs.TabPane
                  tab={
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        fontWeight: 500,
                        fontSize: '12px',
                      }}
                    >
                      <FilterOutlined style={{ fontSize: '12px' }} />
                      <span>{intl.formatMessage({ id: 'pages.sync.queryConditionsTab' })}</span>
                    </div>
                  }
                  key="query"
                  disabled={!currentQueryTable}
                  forceRender
                >
                  <div
                    className="tab-content-wrapper"
                    style={{
                      height: '300px',
                      overflowY: 'scroll',
                      background: '#fff',
                      border: '1px solid #d9d9d9',
                      borderTop: 'none',
                      padding: '16px',
                    }}
                  >
                    {currentQueryTable ? (
                      <>
                        <div style={{ marginBottom: '12px' }}>
                          <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                            {intl.formatMessage(
                              { id: 'pages.sync.queryConditionsDesc' },
                              {
                                defaultMessage:
                                  '为表配置自定义查询条件，支持多种操作符和日期范围查询',
                              },
                            )}
                          </Typography.Text>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <Typography.Title
                            level={5}
                            style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}
                          >
                            {intl.formatMessage({ id: 'pages.sync.addQueryField' })}
                          </Typography.Title>

                          <Row gutter={8} align="middle">
                            <Col span={8}>
                              <Input
                                placeholder={intl.formatMessage({ id: 'pages.sync.fieldName' })}
                                value={currentQueryField}
                                onChange={(e) => setCurrentQueryField(e.target.value)}
                                autoComplete="off"
                              />
                            </Col>
                            <Col span={6}>
                              <Select
                                value={currentQueryOperator}
                                onChange={(value) => {
                                  setCurrentQueryOperator(value);
                                  if (value === 'dateRange') {
                                    setCurrentQueryValue('daily');
                                  } else {
                                    setCurrentQueryValue('');
                                  }
                                }}
                                style={{ width: '100%' }}
                              >
                                <Select.Option value="=">=</Select.Option>
                                <Select.Option value="!=">!=</Select.Option>
                                <Select.Option value=">">{'>'}</Select.Option>
                                <Select.Option value=">=">{'>='}</Select.Option>
                                <Select.Option value="<">{'<'}</Select.Option>
                                <Select.Option value="<=">{'<='}</Select.Option>
                                <Select.Option value="dateRange">
                                  {intl.formatMessage({ id: 'pages.sync.dateRange' })}
                                </Select.Option>
                              </Select>
                            </Col>
                            <Col span={8}>
                              {currentQueryOperator !== 'dateRange' ? (
                                <Input
                                  placeholder={intl.formatMessage({ id: 'pages.sync.value' })}
                                  value={currentQueryValue}
                                  onChange={(e) => setCurrentQueryValue(e.target.value)}
                                  autoComplete="off"
                                />
                              ) : (
                                <Select
                                  value={currentQueryValue || 'daily'}
                                  onChange={(value) => setCurrentQueryValue(value)}
                                  style={{ width: '100%' }}
                                >
                                  <Select.Option value="Yesterday">
                                    {intl.formatMessage({ id: 'pages.sync.yesterday' })}
                                  </Select.Option>
                                  <Select.Option value="daily">
                                    {intl.formatMessage({ id: 'pages.sync.daily' })}
                                  </Select.Option>
                                  <Select.Option value="weekly">
                                    {intl.formatMessage({ id: 'pages.sync.weekly' })}
                                  </Select.Option>
                                  <Select.Option value="monthly">
                                    {intl.formatMessage({ id: 'pages.sync.monthly' })}
                                  </Select.Option>
                                </Select>
                              )}
                            </Col>
                            <Col span={2}>
                              <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={addCondition}
                                disabled={!currentQueryField}
                                title={
                                  !currentQueryField
                                    ? intl.formatMessage({ id: 'pages.sync.fieldRequired' })
                                    : ''
                                }
                              />
                            </Col>
                          </Row>
                        </div>

                        {/* 当前表的条件列表 */}
                        <div style={{ marginTop: 20 }}>
                          <Typography.Title
                            level={5}
                            style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}
                          >
                            {intl.formatMessage({ id: 'pages.sync.conditionList' })}
                          </Typography.Title>

                          <div
                            style={{
                              border: '1px solid #f0f0f0',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              background: '#fff',
                            }}
                          >
                            {conditions.filter((c) => c.table === currentQueryTable).length ===
                            0 ? (
                              <div style={{ textAlign: 'center', padding: '16px', color: '#999' }}>
                                {intl.formatMessage({ id: 'pages.sync.noConditions' })}
                              </div>
                            ) : (
                              conditions
                                .filter((c) => c.table === currentQueryTable)
                                .map((condition, localIndex) => {
                                  // 找到全局索引，用于删除条件
                                  const globalIndex = conditions.findIndex(
                                    (c) =>
                                      c.table === condition.table &&
                                      c.field === condition.field &&
                                      c.operator === condition.operator &&
                                      c.value === condition.value,
                                  );

                                  return (
                                    <div
                                      key={localIndex}
                                      style={{
                                        padding: '10px 16px',
                                        borderBottom:
                                          localIndex <
                                          conditions.filter((c) => c.table === currentQueryTable)
                                            .length -
                                            1
                                            ? '1px solid #f0f0f0'
                                            : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'inline-block',
                                          padding: '2px 12px',
                                          backgroundColor: '#f9f9f9',
                                          borderRadius: '4px',
                                          marginRight: '8px',
                                          border: '1px solid #e0e0e0',
                                          fontSize: '12px',
                                          height: '24px',
                                          lineHeight: '20px',
                                        }}
                                      >
                                        {condition.field}
                                      </div>
                                      <div
                                        style={{
                                          display: 'inline-block',
                                          padding: '2px 12px',
                                          backgroundColor: '#e6f7ff',
                                          borderRadius: '4px',
                                          marginRight: '8px',
                                          border: '1px solid #91d5ff',
                                          fontSize: '12px',
                                          height: '24px',
                                          lineHeight: '20px',
                                          color: '#1890ff',
                                        }}
                                      >
                                        {condition.operator}
                                      </div>
                                      <div
                                        style={{
                                          display: 'inline-block',
                                          padding: '2px 12px',
                                          backgroundColor: '#f6ffed',
                                          borderRadius: '4px',
                                          marginRight: '8px',
                                          border: '1px solid #b7eb8f',
                                          fontSize: '12px',
                                          height: '24px',
                                          lineHeight: '20px',
                                          color: '#52c41a',
                                        }}
                                      >
                                        {condition.value}
                                      </div>
                                      <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined style={{ fontSize: '14px' }} />}
                                        onClick={() => removeCondition(globalIndex)}
                                        style={{
                                          marginLeft: 'auto',
                                          padding: '0',
                                          height: '24px',
                                          width: '24px',
                                        }}
                                      />
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <Empty
                        description={intl.formatMessage({ id: 'pages.sync.selectTableFirst' })}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}
                  </div>
                </Tabs.TabPane>

                {/* 高级设置选项卡 */}
                <Tabs.TabPane
                  tab={
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        fontWeight: 500,
                        fontSize: '12px',
                      }}
                    >
                      <SettingOutlined style={{ fontSize: '12px' }} />
                      <span>{intl.formatMessage({ id: 'pages.sync.advancedSettingsTab' })}</span>
                    </div>
                  }
                  key="advanced"
                  disabled={!currentQueryTable}
                  forceRender
                >
                  <div
                    className="tab-content-wrapper"
                    style={{
                      height: '300px',
                      overflowY: 'scroll',
                      background: '#fff',
                      border: '1px solid #d9d9d9',
                      borderTop: 'none',
                      padding: '16px',
                    }}
                  >
                    {currentQueryTable ? (
                      <>
                        <div style={{ marginBottom: '12px' }}>
                          <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                            {intl.formatMessage(
                              { id: 'pages.sync.advancedSettingsDesc' },
                              {
                                defaultMessage: '配置表的高级同步选项，包括索引同步和删除操作处理',
                              },
                            )}
                          </Typography.Text>
                        </div>
                        <Typography.Title
                          level={5}
                          style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}
                        >
                          {intl.formatMessage(
                            { id: 'pages.sync.advancedSettings' },
                            { defaultMessage: 'Advanced Settings' },
                          )}
                        </Typography.Title>

                        <div
                          style={{
                            border: '1px solid #f0f0f0',
                            borderRadius: '4px',
                            padding: '16px',
                            background: '#fafafa',
                          }}
                        >
                          {/* Setting 1: Sync Indexes */}
                          <Row align="middle" style={{ marginBottom: '16px' }}>
                            <Col span={18}>
                              <div>
                                <Typography.Text strong>
                                  {intl.formatMessage(
                                    { id: 'pages.sync.syncIndexes' },
                                    { defaultMessage: 'Sync Indexes' },
                                  )}
                                </Typography.Text>
                                <div>
                                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                    {intl.formatMessage(
                                      { id: 'pages.sync.syncIndexesDesc' },
                                      { defaultMessage: '同步数据库索引结构' },
                                    )}
                                  </Typography.Text>
                                </div>
                              </div>
                            </Col>
                            <Col span={6} style={{ textAlign: 'right' }}>
                              <Switch
                                checked={
                                  tableAdvancedSettings[currentQueryTable]?.syncIndexes ?? false
                                }
                                onChange={(checked) => {
                                  setTableAdvancedSettings((prev) => ({
                                    ...prev,
                                    [currentQueryTable]: {
                                      ...(prev[currentQueryTable] || {
                                        syncIndexes: false,
                                        ignoreDeleteOps: false,
                                        uploadToGcs: false,
                                        gcsAddress: '',
                                      }),
                                      syncIndexes: checked,
                                    },
                                  }));
                                }}
                              />
                            </Col>
                          </Row>

                          {/* Setting 2: Ignore Delete Operations */}
                          <Row align="middle" style={{ marginBottom: '16px' }}>
                            <Col span={18}>
                              <div>
                                <Typography.Text strong>
                                  {intl.formatMessage(
                                    { id: 'pages.sync.ignoreDeleteOps' },
                                    { defaultMessage: 'Ignore Delete Operations' },
                                  )}
                                </Typography.Text>
                                <div>
                                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                    {intl.formatMessage(
                                      { id: 'pages.sync.ignoreDeleteOpsDesc' },
                                      { defaultMessage: '忽略删除操作，只同步新增和更新' },
                                    )}
                                  </Typography.Text>
                                </div>
                              </div>
                            </Col>
                            <Col span={6} style={{ textAlign: 'right' }}>
                              <Switch
                                checked={
                                  tableAdvancedSettings[currentQueryTable]?.ignoreDeleteOps ?? false
                                }
                                onChange={(checked) => {
                                  setTableAdvancedSettings((prev) => ({
                                    ...prev,
                                    [currentQueryTable]: {
                                      ...(prev[currentQueryTable] || {
                                        syncIndexes: false,
                                        ignoreDeleteOps: false,
                                        uploadToGcs: false,
                                        gcsAddress: '',
                                      }),
                                      ignoreDeleteOps: checked,
                                    },
                                  }));
                                }}
                              />
                            </Col>
                          </Row>

                          {/* Setting 3: Upload to GCS */}
                          <Row align="middle" style={{ marginBottom: '16px' }}>
                            <Col span={18}>
                              <div>
                                <Typography.Text strong>
                                  {intl.formatMessage(
                                    { id: 'pages.sync.uploadToGcs' },
                                    { defaultMessage: 'Upload to Google Cloud Storage' },
                                  )}
                                </Typography.Text>
                                <div>
                                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                    {intl.formatMessage(
                                      { id: 'pages.sync.uploadToGcsDesc' },
                                      { defaultMessage: '将changestream数据上传到Google云存储' },
                                    )}
                                  </Typography.Text>
                                </div>
                              </div>
                            </Col>
                            <Col span={6} style={{ textAlign: 'right' }}>
                              <Switch
                                checked={
                                  tableAdvancedSettings[currentQueryTable]?.uploadToGcs ?? false
                                }
                                onChange={(checked) => {
                                  setTableAdvancedSettings((prev) => ({
                                    ...prev,
                                    [currentQueryTable]: {
                                      ...(prev[currentQueryTable] || {
                                        syncIndexes: false,
                                        ignoreDeleteOps: false,
                                        uploadToGcs: false,
                                        gcsAddress: '',
                                      }),
                                      uploadToGcs: checked,
                                    },
                                  }));
                                }}
                              />
                            </Col>
                          </Row>

                          {/* GCS Address Input - only show when upload is enabled */}
                          {(tableAdvancedSettings[currentQueryTable]?.uploadToGcs ?? false) && (
                            <Row style={{ marginBottom: '16px' }}>
                              <Col span={24}>
                                <div style={{ marginBottom: '8px' }}>
                                  <Typography.Text strong>
                                    {intl.formatMessage(
                                      { id: 'pages.sync.gcsAddress' },
                                      { defaultMessage: 'GCS Address' },
                                    )}
                                  </Typography.Text>
                                </div>
                                <Input
                                  placeholder={intl.formatMessage(
                                    { id: 'pages.sync.gcsAddressPlaceholder' },
                                    { defaultMessage: '例如: gs://bucket-name/path/' },
                                  )}
                                  value={tableAdvancedSettings[currentQueryTable]?.gcsAddress ?? ''}
                                  onChange={(e) => {
                                    setTableAdvancedSettings((prev) => ({
                                      ...prev,
                                      [currentQueryTable]: {
                                        ...(prev[currentQueryTable] || {
                                          syncIndexes: false,
                                          ignoreDeleteOps: false,
                                          uploadToGcs: false,
                                          gcsAddress: '',
                                        }),
                                        gcsAddress: e.target.value,
                                      },
                                    }));
                                  }}
                                  autoComplete="off"
                                />
                              </Col>
                            </Row>
                          )}
                        </div>
                      </>
                    ) : (
                      <Empty
                        description={intl.formatMessage({ id: 'pages.sync.selectTableFirst' })}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}
                  </div>
                </Tabs.TabPane>
              </Tabs>
            </div>
          )}
        </div>
      </StepsForm.StepForm>
    </StepsForm>
  );
};

export default AddSync;
