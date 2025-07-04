import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  Card,
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Tag,
  message,
  Tooltip,
  Transfer,
  Empty,
  Badge,
  List,
  Popover,
  Checkbox,
  Typography,
  Tabs,
} from 'antd';
import { StepsForm } from '@ant-design/pro-components';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  HistoryOutlined,
  SearchOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  TableOutlined,
  DatabaseOutlined,
  FilterOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from 'antd';
import type { Key } from 'antd/es/table/interface';
import './index.less';

const { Option } = Select;

// 备份任务状态
type JobStatus = 'enabled' | 'paused' | 'error' | 'disabled';

// 执行状态
type ExecutionStatus = 'success' | 'failed' | 'running' | 'not_run';

// 备份任务接口
interface BackupJob {
  id: string;
  name: string;
  database: {
    url: string;
    username: string;
    password: string;
    database: string;
    tables: string[];
    fields: { [key: string]: string[] };
  };
  destination: {
    gcsPath: string;
    fileNamePattern: string; // 改为文件名正则表达式
    retention?: number; // 文件保留天数
  };
  schedule: string; // Cron 表达式
  lastExecution: {
    status: ExecutionStatus;
    time: string;
    message?: string;
  };
  nextExecution: string;
  status: JobStatus;
  fileType: 'json' | 'bson' | 'csv';
  backupType: 'full' | 'incremental'; // 新增：备份类型
  query?: string; // 新增：增量备份的查询条件，JSON字符串格式
  sourceType?: 'mongodb' | 'mysql' | 'postgresql'; // 新增：数据源类型
  createdAt: string;
  updatedAt: string;
}

// 创建任务表单数据结构
interface JobFormData {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  tables: string[];
  selectedFields: {
    [table: string]: string[];
  };
  gcsPath: string;
  fileNamePattern: string; // 改为文件名正则表达式
  retention?: number; // 新增：文件保留天数
  cronExpression: string;
  fileType: 'json' | 'bson' | 'csv';
  backupType: 'full' | 'incremental'; // 新增：备份类型
  query: string; // 新增：查询条件，JSON格式字符串
  sourceType?: 'mongodb' | 'mysql' | 'postgresql'; // 新增：数据源类型
}

// 表/集合项接口
interface TableItem {
  key: string;
  title: string;
  chosen: boolean;
}

// 字段项接口
interface FieldItem {
  key: string;
  name: string;
  type: string;
  selected: boolean;
}

// 添加getTableSchema服务函数
const getTableSchema = async (params: {
  sourceType: string;
  connection: {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  };
  tableName: string;
}) => {
  try {
    const response = await fetch('/api/tables/schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取表结构出错:', error);
    return { success: false, message: '获取表结构出错' };
  }
};

// 1. 删除原有的DateRangeConfig接口，直接将类型定义在QueryField中
interface QueryField {
  field: string; // 字段名
  operator: string; // 操作符
  value: string; // 值
  table: string; // 表名
  isDateRange?: boolean; // 是否是日期范围查询
  dateRange?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom'; // 日、周、月或自定义
    startOffset: number; // 相对于当前时间的偏移量，负数表示过去
    endOffset: number; // 相对于当前时间的偏移量
  };
}

const JobList: React.FC = () => {
  const intl = useIntl();
  const [form] = Form.useForm();
  const formRef = useRef<FormInstance>();
  const [currentStep, setCurrentStep] = useState(0);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<BackupJob[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [jobModalVisible, setJobModalVisible] = useState<boolean>(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [tableFields, setTableFields] = useState<{ [table: string]: string[] }>({});
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [jobFormData, setJobFormData] = useState<JobFormData>({
    name: '',
    host: '',
    port: '',
    username: '',
    password: '',
    database: '',
    tables: [],
    selectedFields: {},
    gcsPath: '',
    fileNamePattern: '',
    cronExpression: '0 2 * * *',
    fileType: 'json',
    backupType: 'full',
    query: '{}',
  });
  const [targetTableKeys, setTargetTableKeys] = useState<string[]>([]);
  const [tableItems, setTableItems] = useState<TableItem[]>([]);
  const [fieldDataSource, setFieldDataSource] = useState<FieldItem[]>([]);
  const [currentTable, setCurrentTable] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name',
    'status',
    'jobStatus',
    'description',
    'frequency',
    'destination',
    'lastRun',
    'nextRun',
    'action',
  ]);

  // 跟踪正在运行的任务
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());

  // 添加搜索输入框引用
  const searchInputRef = useRef<any>(null);

  // 3. 修改queryFields状态定义，使用新的类型
  const [queryFields, setQueryFields] = useState<QueryField[]>([]);
  const [currentQueryField, setCurrentQueryField] = useState<string>('');
  const [currentQueryOperator, setCurrentQueryOperator] = useState<string>('eq');
  const [currentQueryValue, setCurrentQueryValue] = useState<string>('');
  const [currentQueryTable, setCurrentQueryTable] = useState<string>('');

  // 添加调试代码以检查formRef
  useEffect(() => {
    console.log('FormRef initialized:', formRef);
    // 每次formRef变化时打印
    if (formRef.current) {
      console.log('FormRef.current is available:', formRef.current);
    }
  }, [formRef.current]);

  // 当jobFormData变化且编辑模式下，更新表单值
  useEffect(() => {
    if (editingJobId && formRef.current && jobModalVisible) {
      console.log('Updating form values from jobFormData:', jobFormData.name);
      formRef.current.setFieldsValue({
        basic: {
          name: jobFormData.name,
          host: jobFormData.host,
          port: jobFormData.port,
          username: jobFormData.username,
          password: jobFormData.password,
          database: jobFormData.database,
          cronExpression: jobFormData.cronExpression,
          fileType: jobFormData.fileType,
        },
        dataSelection: {
          backupType: jobFormData.backupType,
        },
        destination: {
          gcsPath: jobFormData.gcsPath,
          fileNamePattern: jobFormData.fileNamePattern,
        },
      });
    }
  }, [editingJobId, jobFormData, jobModalVisible]);

  // 监听表单ref变化，确保它被正确初始化
  useEffect(() => {
    if (formRef.current) {
      console.log('Form instance initialized:', formRef.current);

      // 在编辑模式下设置表单初始值
      if (editingJobId && jobFormData) {
        console.log('Setting form values on formRef ready:', jobFormData);
        formRef.current.setFieldsValue({
          basic: {
            name: jobFormData.name,
            host: jobFormData.host,
            port: jobFormData.port,
            username: jobFormData.username,
            password: jobFormData.password,
            database: jobFormData.database,
            cronExpression: jobFormData.cronExpression,
            fileType: jobFormData.fileType,
          },
          destination: {
            gcsPath: jobFormData.gcsPath,
            fileNamePattern: jobFormData.fileNamePattern,
          },
        });
      }
    }
  }, [formRef.current, editingJobId, jobFormData, jobModalVisible]);

  // 监控currentStep变化，用于调试
  useEffect(() => {
    console.log('Current step changed to:', currentStep);
    console.log('Editing job id:', editingJobId);

    // 如果是编辑模式且步骤改变了，确保数据正确加载
    if (editingJobId && jobFormData) {
      console.log('Form data in current step:', jobFormData);
    }
  }, [currentStep, editingJobId]);

  // 监控模态框显示状态，确保数据正确加载
  useEffect(() => {
    // 当模态框打开，并且是编辑状态时
    if (jobModalVisible && editingJobId) {
      console.log('Modal opened for editing, ensuring data is loaded...');

      // 获取当前正在编辑的任务数据
      const job = jobs.find((j) => j.id === editingJobId);
      if (!job) return;

      // 再次尝试设置表单值，增强数据加载可靠性
      setTimeout(() => {
        console.log('Re-setting form values for editing job:', job.name);

        // 获取API返回的字段选择信息
        const selectedFields: { [table: string]: string[] } = {};

        // 将API返回的字段转换为前端需要的格式
        if (job.database.fields) {
          Object.keys(job.database.fields).forEach((table) => {
            if (typeof job.database.fields[table] === 'string') {
              // 如果是字符串，拆分为数组
              selectedFields[table] = [job.database.fields[table] as string];
            } else if (Array.isArray(job.database.fields[table])) {
              // 如果已经是数组，直接使用
              selectedFields[table] = job.database.fields[table] as unknown as string[];
            }
          });
        }

        console.log('处理后的字段选择信息:', selectedFields);

        // 填充表单数据 - 使用从jobs中获取的最新数据，而不是依赖之前的状态
        const formData: JobFormData = {
          name: job.name,
          host: job.database.url.split(':')[0],
          port: job.database.url.split(':')[1],
          username: job.database.username,
          password: job.database.password,
          database: job.database.database,
          tables: job.database.tables,
          selectedFields: selectedFields,
          gcsPath: job.destination.gcsPath,
          fileNamePattern: job.destination.fileNamePattern,
          cronExpression: job.schedule,
          fileType: job.fileType,
          backupType: job.backupType,
          query: job.query || '{}',
        };

        console.log('根据最新任务数据设置的jobFormData:', formData);

        // 确保状态更新
        setJobFormData(formData);
        setSelectedTables(job.database.tables);
      }, 500);
    }
  }, [jobModalVisible, editingJobId, jobs]);

  // 当editingJobId变化时，从jobs中获取最新的任务数据
  useEffect(() => {
    if (editingJobId && jobs.length > 0) {
      console.log('editingJobId变化，正在获取最新任务数据');

      const job = jobs.find((j) => j.id === editingJobId);
      if (!job) {
        console.error('未找到ID为', editingJobId, '的任务数据');
        return;
      }

      console.log('根据editingJobId找到的任务数据:', job);

      // 填充表单数据
      const formData: JobFormData = {
        name: job.name,
        host: job.database.url.split(':')[0],
        port: job.database.url.split(':')[1],
        username: job.database.username,
        password: job.database.password || '', // 确保password有值
        database: job.database.database,
        tables: job.database.tables,
        selectedFields: {}, // 需要从API获取
        gcsPath: job.destination.gcsPath,
        fileNamePattern: job.destination.fileNamePattern,
        cronExpression: job.schedule,
        fileType: job.fileType || 'json', // 确保fileType有值
        backupType: job.backupType || 'full', // 默认为全量备份
        query: job.query || '{}', // 确保query不是undefined
      };

      console.log('根据最新任务数据设置的jobFormData:', formData);

      // 确保状态更新
      setJobFormData(formData);
      setSelectedTables(job.database.tables);
    }
  }, [editingJobId, jobs]);

  // 获取任务列表
  const fetchJobs = async () => {
    setLoading(true);
    try {
      // 调用真实API
      const response = await fetch('/api/backup', {
        method: 'GET',
      });

      const result = await response.json();

      if (result.success) {
        // 将API返回数据格式映射到应用所需格式
        // 确保result.data是数组，如果为null或undefined则使用空数组
        const rawData = Array.isArray(result.data) ? result.data : [];

        const mappedData = rawData.map((item: any) => {
          // 处理fields字段，确保格式正确
          const fields: { [table: string]: string[] } = {};

          if (item.database && item.database.fields) {
            Object.keys(item.database.fields).forEach((table) => {
              if (typeof item.database.fields[table] === 'string') {
                // 如果是字符串，转换为数组
                fields[table] = [item.database.fields[table]];
              } else if (Array.isArray(item.database.fields[table])) {
                // 如果已经是数组，直接使用
                fields[table] = item.database.fields[table];
              }
            });
          }

          return {
            id: item.id,
            name: item.name || '',
            database: {
              url: item.database?.url || '',
              username: item.database?.username || '',
              password: item.database?.password || '',
              database: item.database?.database || '',
              tables: item.database?.tables || [],
              fields: fields, // 使用处理后的fields
            },
            destination: {
              gcsPath: item.destination?.gcsPath || '',
              fileNamePattern: item.destination?.fileNamePattern || '',
              retention: item.destination?.retention || 30,
            },
            schedule: item.schedule || '',
            lastExecution: item.lastBackupTime
              ? {
                  status: 'success' as ExecutionStatus, // 假设有备份时间表示成功
                  time: item.lastBackupTime,
                  message: '',
                }
              : undefined,
            nextExecution: item.nextBackupTime || '',
            status: (item.status as JobStatus) || 'disabled',
            fileType: (item.format as 'json' | 'bson' | 'csv') || 'json',
            backupType: (item.backupType as 'full' | 'incremental') || 'full', // 处理备份类型
            query: item.query || '{}', // 处理查询条件
            sourceType: item.sourceType as 'mongodb' | 'mysql' | 'postgresql', // 直接使用API返回的源类型
            createdAt: item.lastUpdateTime || '',
            updatedAt: item.lastUpdateTime || '',
          };
        });

        setJobs(mappedData);
        setFilteredJobs(mappedData);

        // 清理运行状态标记，因为我们获取到了最新的实际状态
        setRunningTasks(new Set());

        console.log('获取到的任务数据:', mappedData);
        if (mappedData.length > 0) {
          console.log('字段映射结果示例:', mappedData[0].database.fields || {});
        } else {
          console.log('没有找到任何备份任务');
        }
      } else {
        // 只有在API明确返回错误时才显示错误消息
        console.error('获取任务列表失败:', result.message);
        message.error(
          result.message || intl.formatMessage({ id: 'pages.backup.messages.fetchFailed' }),
        );
      }
    } catch (error) {
      // 只有在网络错误或解析错误时才显示错误消息
      console.error('获取任务列表失败:', error);
      message.error(intl.formatMessage({ id: 'pages.backup.messages.fetchFailed' }));
    } finally {
      setLoading(false);
    }
  };

  // 在组件加载时获取任务列表
  useEffect(() => {
    fetchJobs();
  }, []);

  // 获取数据库表字段
  const fetchTableFields = async (tableName: string, formData: JobFormData) => {
    try {
      // 使用与AddSync.tsx相同的服务函数
      try {
        const response = await getTableSchema({
          sourceType: formData.sourceType || 'mongodb', // 使用表单中选择的数据库类型
          connection: {
            host: formData.host || '',
            port: formData.port || '',
            user: formData.username || '',
            password: formData.password || '',
            database: formData.database || '',
          },
          tableName,
        });

        if (response.success && response.data.fields) {
          // 转换API返回的数据格式为组件需要的格式，与AddSync.tsx保持一致
          const fieldData = response.data.fields.map((field: any) => field.name);

          // 更新表字段状态
          setTableFields((prev) => ({
            ...prev,
            [tableName]: fieldData,
          }));

          return fieldData;
        } else {
          console.error(`获取表 ${tableName} 字段失败:`, response.message || '未知错误');

          // 使用模拟数据
          const mockFields = [
            '_id',
            'name',
            'description',
            'created_at',
            'updated_at',
            'field1',
            'field2',
          ];

          // 更新表字段状态
          setTableFields((prev) => ({
            ...prev,
            [tableName]: mockFields,
          }));

          return mockFields;
        }
      } catch (error) {
        console.error(`获取表 ${tableName} 字段失败:`, error);

        // 使用模拟数据
        const mockFields = [
          '_id',
          'name',
          'description',
          'created_at',
          'updated_at',
          'field1',
          'field2',
        ];

        // 更新表字段状态
        setTableFields((prev) => ({
          ...prev,
          [tableName]: mockFields,
        }));

        return mockFields;
      }
    } catch (error) {
      console.error('获取数据库表字段失败:', error);
      return [];
    }
  };

  // 处理表数据更新，当测试连接成功后调用
  const handleTablesUpdated = async (tables: string[], formData: JobFormData) => {
    try {
      if (!tables || tables.length === 0) {
        return;
      }

      // 将所有表格数据添加到tableItems状态
      const items: TableItem[] = tables.map((table) => ({
        key: table,
        title: table,
        chosen: selectedTables.includes(table),
      }));

      // 设置表格项到状态中，这样穿梭框能显示所有可用表格
      setTableItems(items);

      // 判断是新建任务还是编辑任务
      if (editingJobId) {
        // 编辑模式：保留之前选中的表，但只保留那些在新表列表中存在的
        const validSelectedTables = selectedTables.filter((t) => tables.includes(t));
        setSelectedTables(validSelectedTables);
        setTargetTableKeys(validSelectedTables);
      } else {
        // 新建模式：默认不选中任何表
        setSelectedTables([]);
        setTargetTableKeys([]);
      }

      // 为每个表获取字段信息
      const fieldsPromises = tables.map(async (table) => {
        const fields = await fetchTableFields(table, formData);
        return { table, fields };
      });

      // 并行请求所有表的字段
      const fieldsResults = await Promise.all(fieldsPromises);

      // 更新表字段状态
      const newTableFields: { [table: string]: string[] } = {};
      fieldsResults.forEach((result) => {
        if (result.fields && result.fields.length > 0) {
          newTableFields[result.table] = result.fields;
        }
      });

      setTableFields(newTableFields);

      return tables;
    } catch (error) {
      console.error('处理表格数据时出错:', error);
      return [];
    }
  };

  // 处理表选择变化
  const handleTableChange = (targetKeys: Key[]) => {
    const stringTargetKeys = targetKeys as string[];
    setTargetTableKeys(stringTargetKeys);
    setSelectedTables(stringTargetKeys);

    // 初始化新选择的表对应的字段
    const newSelectedFields = { ...jobFormData.selectedFields };

    stringTargetKeys.forEach((table) => {
      if (!newSelectedFields[table] && tableFields[table]) {
        // 默认选择所有字段
        newSelectedFields[table] = [...tableFields[table]];
      }
    });

    // 移除不再选择的表的字段
    Object.keys(newSelectedFields).forEach((table) => {
      if (!stringTargetKeys.includes(table)) {
        delete newSelectedFields[table];
      }
    });

    setJobFormData({
      ...jobFormData,
      tables: stringTargetKeys,
      selectedFields: newSelectedFields,
    });

    // 如果当前查看的表不在选中表列表中，重置当前表
    if (currentTable && !stringTargetKeys.includes(currentTable)) {
      setCurrentTable(null);
      setFieldDataSource([]);
    }
  };

  // 处理查看表字段
  const handleViewTableFields = (tableName: string) => {
    setCurrentTable(tableName);

    // 生成字段数据
    if (tableFields[tableName]) {
      // 确保从jobFormData中获取当前表的已选择字段，如果不存在则使用空数组
      const selectedFieldsForTable = jobFormData.selectedFields[tableName] || [];
      console.log(`表 ${tableName} 的已选择字段:`, selectedFieldsForTable);

      const fieldItems: FieldItem[] = tableFields[tableName].map((field) => ({
        key: field,
        name: field,
        type:
          field === '_id'
            ? 'ObjectId'
            : field.includes('_at')
              ? 'Date'
              : field.includes('price') || field.includes('amount')
                ? 'Number'
                : 'String',
        selected: selectedFieldsForTable.includes(field),
      }));

      setFieldDataSource(fieldItems);
    } else {
      setFieldDataSource([]);
    }
  };

  // 处理字段选择变化
  const handleFieldSelectionChange = (selectedRowKeys: React.Key[]) => {
    if (!currentTable) return;

    const selectedFields = selectedRowKeys as string[];

    setJobFormData({
      ...jobFormData,
      selectedFields: {
        ...jobFormData.selectedFields,
        [currentTable]: selectedFields,
      },
    });

    // 更新字段数据源中的选中状态
    setFieldDataSource((prevFields) =>
      prevFields.map((field) => ({
        ...field,
        selected: selectedFields.includes(field.key),
      })),
    );
  };

  // 穿梭框的筛选功能
  const filterTableOption = (inputValue: string, option: TableItem) => {
    return option.title.toLowerCase().indexOf(inputValue.toLowerCase()) > -1;
  };

  // 打开创建任务模态框
  const showCreateJobModal = () => {
    // 重置表单状态
    setJobFormData({
      name: '',
      host: '',
      port: '',
      username: '',
      password: '',
      database: '',
      tables: [],
      selectedFields: {},
      gcsPath: '',
      fileNamePattern: '',
      retention: 30,
      cronExpression: '0 2 * * *',
      fileType: 'json',
      backupType: 'full',
      query: '{}',
      sourceType: 'mongodb',
    });

    setSelectedTables([]);
    setTargetTableKeys([]);
    setTableItems([]);
    setCurrentTable('');
    setTableFields({});
    setQueryFields([]); // 重置查询字段
    setCurrentStep(0);
    setEditingJobId('');

    // 打开对话框
    setJobModalVisible(true);
  };

  // 打开编辑任务对话框
  const showEditJobModal = (jobId: string) => {
    // 从jobs数组中获取完整的任务数据
    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      message.error(intl.formatMessage({ id: 'pages.backup.messages.notFound' }));
      return;
    }

    console.log('加载任务进行编辑:', job);
    console.log('当前sourceType值:', job.sourceType); // 调试输出

    // 确保从第一步开始显示
    setCurrentStep(0);

    // 设置编辑ID
    setEditingJobId(jobId);

    // 从URL中提取host和port
    const urlParts = job.database.url.split(':');
    const host = urlParts[0] || '';
    const port = urlParts.length > 1 ? urlParts[1] : '';

    // 获取API返回的字段选择信息
    const selectedFields: { [table: string]: string[] } = {};

    // 将API返回的字段转换为前端需要的格式
    if (job.database.fields) {
      Object.keys(job.database.fields).forEach((table) => {
        if (typeof job.database.fields[table] === 'string') {
          // 如果是字符串，拆分为数组
          selectedFields[table] = [job.database.fields[table] as string];
        } else if (Array.isArray(job.database.fields[table])) {
          // 如果已经是数组，直接使用
          selectedFields[table] = job.database.fields[table] as unknown as string[];
        }
      });
    }

    console.log('处理后的字段选择信息:', selectedFields);

    // 处理查询条件，如果存在
    let queryFieldsArray: QueryField[] = [];
    const queryData = job.query || '{}'; // 确保query有值

    try {
      // 解析查询条件为结构化数据
      const queryObj = typeof queryData === 'object' ? queryData : JSON.parse(queryData);
      console.log('解析的查询对象:', queryObj);

      // 转换查询对象为UI使用的格式
      Object.entries(queryObj).forEach(([tableName, tableConditions]) => {
        if (typeof tableConditions === 'object' && tableConditions !== null) {
          Object.entries(tableConditions as Record<string, any>).forEach(([field, value]) => {
            // 跳过特殊字段
            if (field === '__dateRanges') return;

            // 处理日期范围条件
            if (
              value &&
              typeof value === 'object' &&
              'type' in value &&
              'startOffset' in value &&
              'endOffset' in value
            ) {
              // 这是日期范围条件
              const dateRangeValue = value as {
                type: 'daily' | 'weekly' | 'monthly' | 'custom';
                startOffset: number;
                endOffset: number;
              };

              queryFieldsArray.push({
                field,
                operator: 'dateRange',
                value: JSON.stringify(dateRangeValue),
                table: tableName,
                isDateRange: true,
                dateRange: {
                  type: dateRangeValue.type,
                  startOffset: dateRangeValue.startOffset,
                  endOffset: dateRangeValue.endOffset,
                },
              });
            }
            // 处理简单值
            else if (typeof value !== 'object') {
              queryFieldsArray.push({
                field,
                operator: 'eq',
                value: String(value),
                table: tableName,
              });
            }
            // 处理操作符对象，如 {$gte: value}
            else {
              const op = Object.keys(value)[0];
              if (op.startsWith('$')) {
                const opValue = value[op];
                queryFieldsArray.push({
                  field,
                  operator: op.replace('$', ''),
                  value: String(opValue),
                  table: tableName,
                });
              }
            }
          });
        }
      });

      console.log('解析后的查询字段:', queryFieldsArray);
    } catch (e) {
      console.error('解析查询条件失败:', e);
    }

    setQueryFields(queryFieldsArray);

    // 填充表单数据
    const formData: JobFormData = {
      name: job.name,
      host: host,
      port: port,
      username: job.database.username,
      password: job.database.password || '', // 确保password有值
      database: job.database.database,
      tables: job.database.tables,
      selectedFields: selectedFields,
      gcsPath: job.destination.gcsPath,
      fileNamePattern: job.destination.fileNamePattern,
      retention: job.destination.retention,
      cronExpression: job.schedule,
      fileType: job.fileType || 'json', // 确保fileType有值
      backupType: job.backupType || 'full', // 默认为全量备份
      query: typeof job.query === 'object' ? JSON.stringify(job.query) : job.query || '{}', // 确保query不是undefined，并且是字符串
      sourceType: job.sourceType || 'mongodb', // 使用API返回的sourceType字段
    };

    console.log('根据最新任务数据设置的jobFormData:', formData);

    // 确保状态更新
    setJobFormData(formData);
    setSelectedTables(job.database.tables);

    // 获取表和字段信息，传入最新的表单数据
    handleTablesUpdated(job.database.tables, formData);

    // 先打开模态框
    setJobModalVisible(true);

    // 在模态框打开后，设置表单的初始值，确保sourceType被正确设置
    // 这里延迟时间设置更长，确保模态框和表单完全渲染完成
    setTimeout(() => {
      if (formRef.current) {
        try {
          console.log('手动设置sourceType字段值为:', job.sourceType);

          // 重要: 先设置表单字段，然后强制更新表单
          formRef.current.setFieldsValue({
            sourceType: job.sourceType || 'mongodb',
            name: job.name,
          });

          // 记录日志以便调试
          const currentValues = formRef.current.getFieldsValue();
          console.log('设置后的sourceType值:', currentValues.sourceType);
          console.log('所有表单字段值:', currentValues);
        } catch (error) {
          console.error('设置表单字段值失败:', error);
        }
      } else {
        console.error('formRef.current不存在，无法设置表单值');
      }
    }, 500); // 增加延迟时间，确保表单完全渲染
  };

  // 关闭任务模态框
  const closeJobModal = () => {
    console.log('关闭任务模态框...');

    // 先隐藏模态框
    setJobModalVisible(false);

    // 检查是否正在编辑状态
    const isEditing = !!editingJobId;

    // 延迟一下再清除数据，避免UI闪烁
    setTimeout(() => {
      console.log('准备重置表单和状态...');

      // 重置步骤到第一步
      setCurrentStep(0);

      // 如果是正在创建新任务（不是编辑），则完全重置状态
      if (!isEditing) {
        console.log('不是编辑状态，完全重置表单数据');

        // 重置编辑状态
        setEditingJobId(null);
        setTargetTableKeys([]);
        setCurrentTable(null);
        setFieldDataSource([]);

        // 重置查询相关状态
        setQueryFields([]);
        setCurrentQueryField('');
        setCurrentQueryOperator('eq');
        setCurrentQueryValue('');
        setCurrentQueryTable('');

        // 重置表单 - 确保所有字段都被清除
        if (formRef.current) {
          formRef.current.resetFields();
        }

        // 使用form实例也重置一下
        form.resetFields();

        // 重置jobFormData到初始状态
        setJobFormData({
          name: '',
          host: '',
          port: '',
          username: '',
          password: '',
          database: '',
          tables: [],
          selectedFields: {},
          gcsPath: '',
          fileNamePattern: '',
          retention: 30,
          cronExpression: '0 2 * * *',
          fileType: 'json',
          backupType: 'full',
          query: '{}',
        });
      } else {
        console.log('是编辑状态，保留表单数据');
        // 在编辑状态下，我们不清除jobFormData，只重置表单以便下次编辑
        if (formRef.current) {
          formRef.current.resetFields();
        }
      }

      console.log('表单和状态重置完成');
    }, 300); // 延长清理时间，确保UI操作完成
  };

  // 表单提交
  const handleSubmit = async (values: any) => {
    console.log('StepsForm提交，values:', values);
    console.log('当前selectedTables状态:', selectedTables);
    console.log('当前jobFormData状态:', jobFormData);

    try {
      // 检查values的数据结构
      const isNestedStructure = values.basic && values.destination;
      console.log('是否为嵌套结构表单数据:', isNestedStructure);

      // 在编辑模式下，获取当前编辑的任务数据以提供默认值
      let jobData = null;
      if (editingJobId) {
        jobData = jobs.find((j) => j.id === editingJobId);
      }

      // 构建API请求数据
      const requestData = {
        name: isNestedStructure ? values.sourceType.name : values.name,
        sourceType: isNestedStructure
          ? values.sourceType.sourceType || (jobData ? jobData.sourceType : 'mongodb')
          : values.sourceType || (jobData ? jobData.sourceType : 'mongodb'),
        database: {
          url: isNestedStructure
            ? `${values.basic.host}:${values.basic.port}`
            : `${values.host}:${values.port}`,
          username: isNestedStructure ? values.basic.username || '' : values.username || '',
          password: isNestedStructure ? values.basic.password || '' : values.password || '',
          database: isNestedStructure ? values.basic.database : values.database,
          tables: selectedTables,
          fields: jobFormData.selectedFields || {},
        },
        destination: {
          gcsPath: isNestedStructure ? values.destination.gcsPath : values.gcsPath,
          fileNamePattern: isNestedStructure
            ? values.destination.fileNamePattern
            : values.fileNamePattern,
        },
        schedule: isNestedStructure ? values.basic.cronExpression : values.cronExpression,
        format: isNestedStructure ? values.basic.fileType : values.fileType,
        // 自动根据是否有查询条件来决定backupType
        backupType: jobFormData.query && jobFormData.query !== '{}' ? 'incremental' : 'full',
        query:
          jobFormData.query && jobFormData.query !== '{}'
            ? typeof jobFormData.query === 'string'
              ? JSON.parse(jobFormData.query)
              : jobFormData.query
            : {},
      };

      // 检查必要的字段是否存在
      if (!requestData.name) {
        message.error('任务名称不能为空');
        return false;
      }

      if (!requestData.database.database) {
        message.error('数据库名称不能为空');
        return false;
      }

      if (!requestData.schedule) {
        message.error('备份计划不能为空');
        return false;
      }

      console.log('发送到API的请求数据:', JSON.stringify(requestData, null, 2));

      if (editingJobId) {
        // 更新现有任务
        setLoading(true);
        try {
          const response = await fetch(`/api/backup/${editingJobId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
          });

          const result = await response.json();
          console.log('更新任务API响应:', result);

          if (result.success) {
            message.success(intl.formatMessage({ id: 'pages.backup.messages.taskUpdated' }));
            // 刷新任务列表以获取最新数据
            await fetchJobs();
            setJobModalVisible(false);
            return true;
          } else {
            console.error('更新任务失败:', result.message);
            message.error(
              result.message || intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }),
            );
            return false;
          }
        } catch (error) {
          console.error('更新任务失败:', error);
          message.error(intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }));
          return false;
        } finally {
          setLoading(false);
        }
      } else {
        // 创建新任务
        setLoading(true);
        try {
          const response = await fetch('/api/backup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
          });

          const result = await response.json();
          console.log('创建任务API响应:', result);

          if (result.success) {
            message.success(intl.formatMessage({ id: 'pages.backup.messages.taskCreated' }));
            // 刷新任务列表以获取最新数据
            await fetchJobs();
            setJobModalVisible(false);
            return true;
          } else {
            console.error('创建任务失败:', result.message);
            message.error(
              result.message || intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }),
            );
            return false;
          }
        } catch (error) {
          console.error('创建任务失败:', error);
          message.error(intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }));
          return false;
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
      message.error(intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }));
      return false;
    }
  };

  // 删除任务
  const handleDeleteJob = async (jobId: string) => {
    try {
      // 调用真实API
      const response = await fetch(`/api/backup/${jobId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        message.success(intl.formatMessage({ id: 'pages.backup.messages.taskDeleted' }));

        // 更新任务列表，从本地列表中删除已删除的任务
        setJobs(jobs.filter((job) => job.id !== jobId));
        setFilteredJobs(filteredJobs.filter((job) => job.id !== jobId));
      } else {
        console.error('删除任务失败:', result.message);
        message.error(
          result.message || intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }),
        );
      }
    } catch (error) {
      console.error('删除任务失败:', error);
      message.error(intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }));
    }
  };

  // 切换任务状态
  const toggleJobStatus = async (jobId: string, currentStatus: JobStatus) => {
    try {
      // 确定API端点
      const endpoint = currentStatus === 'enabled' ? 'pause' : 'resume';

      // 调用真实API
      const response = await fetch(`/api/backup/${jobId}/${endpoint}`, {
        method: 'PUT',
      });

      const result = await response.json();

      if (result.success) {
        const newStatus: JobStatus = currentStatus === 'enabled' ? 'paused' : 'enabled';

        // 临时更新本地状态，提高用户体验
        setJobs(jobs.map((job) => (job.id === jobId ? { ...job, status: newStatus } : job)));

        // 临时更新筛选后的列表
        setFilteredJobs(
          filteredJobs.map((job) => (job.id === jobId ? { ...job, status: newStatus } : job)),
        );

        message.success(
          newStatus === 'enabled'
            ? intl.formatMessage({ id: 'pages.backup.messages.taskEnabled' })
            : intl.formatMessage({ id: 'pages.backup.messages.taskPaused' }),
        );

        // 刷新任务列表，获取完整的最新数据
        await fetchJobs();
      } else {
        console.error('切换任务状态失败:', result.message);
        message.error(
          result.message || intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }),
        );
      }
    } catch (error) {
      console.error('切换任务状态失败:', error);
      message.error(intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }));
    }
  };

  // 立即运行任务
  const runJobNow = async (jobId: string) => {
    // 保存原始状态，以便在失败时恢复
    const originalJob = jobs.find((j) => j.id === jobId);
    if (!originalJob) {
      message.error('未找到对应的任务');
      return;
    }

    // 检查任务是否已经在运行中（避免重复执行）
    if (runningTasks.has(jobId)) {
      console.log('任务已在运行中，跳过重复执行');
      return;
    }

    // 确保任务在运行集合中，并更新任务状态
    flushSync(() => {
      // 确保任务在运行中的任务集合中
      setRunningTasks((prev) => new Set([...prev, jobId]));

      // 立即更新任务状态为"运行中"，提供即时的用户反馈
      const updatedJob = {
        lastExecution: {
          status: 'running' as ExecutionStatus,
          time: new Date().toISOString(),
        },
      };

      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                ...updatedJob,
              }
            : job,
        ),
      );

      setFilteredJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                ...updatedJob,
              }
            : job,
        ),
      );
    });

    // 定义状态更新函数，用于后续的状态恢复
    const updateJobStatus = (status: ExecutionStatus, lastExecution?: any) => {
      const updatedJob = {
        lastExecution: lastExecution || {
          status,
          time: new Date().toISOString(),
        },
      };

      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                ...updatedJob,
              }
            : job,
        ),
      );

      setFilteredJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                ...updatedJob,
              }
            : job,
        ),
      );
    };

    try {
      // 调用真实API
      const response = await fetch(`/api/backup/execute/${jobId}`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        message.success(intl.formatMessage({ id: 'pages.backup.messages.taskRunning' }));

        // 刷新任务列表，以获取最新状态
        setTimeout(async () => {
          await fetchJobs();
          // 移除运行状态标记
          setRunningTasks((prev) => {
            const newSet = new Set(prev);
            newSet.delete(jobId);
            return newSet;
          });
        }, 3000);
      } else {
        console.error('运行任务失败:', result.message);

        // API失败时，恢复到之前的状态
        updateJobStatus(originalJob.lastExecution?.status || 'not_run', originalJob.lastExecution);

        // 移除运行状态标记
        setRunningTasks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });

        message.error(
          result.message || intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }),
        );
      }
    } catch (error) {
      console.error('运行任务失败:', error);

      // 网络错误时，恢复到之前的状态
      updateJobStatus(originalJob.lastExecution?.status || 'not_run', originalJob.lastExecution);

      // 移除运行状态标记
      setRunningTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });

      message.error(intl.formatMessage({ id: 'pages.backup.messages.taskFailed' }));
    }
  };

  // 查看备份历史
  const viewJobHistory = (jobId: string) => {
    // 获取当前任务的GCS路径
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !job.destination.gcsPath) {
      message.error(intl.formatMessage({ id: 'pages.backup.messages.noGcsPath' }));
      return;
    }

    // 将gs://bucket-name/path 转换为 https://console.cloud.google.com/storage/browser/bucket-name/path
    const gcsPath = job.destination.gcsPath;
    let gcsUrl = '';

    try {
      // 解析GCS路径
      const matches = gcsPath.match(/^gs:\/\/([^/]+)\/?(.*)/);
      if (matches && matches.length > 1) {
        const bucket = matches[1];
        const path = matches[2] || '';

        // 构建GCS控制台URL
        gcsUrl = `https://console.cloud.google.com/storage/browser/${bucket}/${path}`;

        // 在新标签页中打开GCS URL
        window.open(gcsUrl, '_blank');
      } else {
        throw new Error('Invalid GCS path format');
      }
    } catch (error) {
      console.error('Failed to parse GCS path:', error);
      message.error(intl.formatMessage({ id: 'pages.backup.messages.invalidGcsPath' }));
    }

    // 保留此注释，以便将来可能需要恢复历史页面功能
    // navigate(`/backup/history/${jobId}`);
  };

  // 表格列定义
  const columns: ColumnsType<BackupJob> = [
    {
      title: intl.formatMessage({ id: 'pages.backup.jobList.name' }),
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Last Exec Status</span>,
      dataIndex: 'lastExecution',
      key: 'status',
      width: 130,
      render: (lastExecution: any) => {
        if (!lastExecution) {
          return (
            <Tag icon={<ClockCircleOutlined />} color="default">
              {intl.formatMessage({ id: 'pages.backup.status.notRun' })}
            </Tag>
          );
        }

        if (lastExecution.status === 'success') {
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              {intl.formatMessage({ id: 'pages.backup.status.success' })}
            </Tag>
          );
        } else if (lastExecution.status === 'failed') {
          return (
            <Tooltip title={lastExecution.message}>
              <Tag icon={<CloseCircleOutlined />} color="error">
                {intl.formatMessage({ id: 'pages.backup.status.failed' })}
              </Tag>
            </Tooltip>
          );
        } else if (lastExecution.status === 'running') {
          return (
            <Tag icon={<SyncOutlined spin />} color="processing">
              {intl.formatMessage({ id: 'pages.backup.status.running' })}
            </Tag>
          );
        } else {
          return (
            <Tag icon={<ClockCircleOutlined />} color="default">
              {intl.formatMessage({ id: 'pages.backup.status.notRun' })}
            </Tag>
          );
        }
      },
    },
    {
      title: intl.formatMessage({ id: 'pages.backup.jobList.status' }),
      dataIndex: 'status',
      key: 'jobStatus',
      width: 120,
      render: (status: JobStatus) => {
        if (status === 'enabled') {
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              {intl.formatMessage({ id: 'pages.backup.status.enabled' })}
            </Tag>
          );
        } else if (status === 'paused' || status === 'disabled') {
          return (
            <Tag icon={<PauseCircleOutlined />} color="default">
              {intl.formatMessage({ id: 'pages.backup.status.paused' })}
            </Tag>
          );
        } else {
          return (
            <Tag icon={<CloseCircleOutlined />} color="error">
              {intl.formatMessage({ id: 'pages.backup.status.error' })}
            </Tag>
          );
        }
      },
    },
    {
      title: intl.formatMessage({ id: 'pages.backup.jobList.description' }),
      key: 'description',
      width: 250,
      render: (_, record) => (
        <>
          <div>Database: {record.database.database}</div>
          <div>Tables: {record.database.tables.join(', ')}</div>
          <div>Format: {record.fileType.toUpperCase()}</div>
        </>
      ),
    },
    {
      title: intl.formatMessage({ id: 'pages.backup.jobList.frequency' }),
      dataIndex: 'schedule',
      key: 'frequency',
      width: 150,
      render: (schedule) => {
        let schedule_desc = '';

        // 简单的cron表达式解释
        if (schedule === '0 2 * * *') {
          schedule_desc = intl.formatMessage(
            { id: 'pages.backup.scheduleTimes.daily' },
            { time: '02:00' },
          );
        } else if (schedule === '0 0 * * 0') {
          schedule_desc = intl.formatMessage(
            { id: 'pages.backup.scheduleTimes.weekly' },
            { time: '00:00' },
          );
        } else if (schedule === '0 1 1 * *') {
          schedule_desc = intl.formatMessage(
            { id: 'pages.backup.scheduleTimes.monthly' },
            { time: '01:00' },
          );
        } else {
          schedule_desc = schedule;
        }

        return <Tooltip title={`Cron: ${schedule}`}>{schedule_desc}</Tooltip>;
      },
    },
    {
      title: intl.formatMessage({ id: 'pages.backup.jobList.destination' }),
      dataIndex: ['destination', 'gcsPath'],
      key: 'destination',
      width: 280,
    },
    {
      title: intl.formatMessage({ id: 'pages.backup.jobList.lastRun' }),
      dataIndex: ['lastExecution', 'time'],
      key: 'lastRun',
      width: 180,
      render: (time) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: intl.formatMessage({ id: 'pages.backup.jobList.nextRun' }),
      dataIndex: 'nextExecution',
      key: 'nextRun',
      width: 180,
      render: (time) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: intl.formatMessage({ id: 'pages.backup.jobList.actions' }),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {record.status === 'enabled' ? (
            <Tooltip title={intl.formatMessage({ id: 'pages.backup.tooltip.pause' })}>
              <Button
                type="text"
                icon={<PauseCircleOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleJobStatus(record.id, record.status);
                }}
                className="action-button"
              />
            </Tooltip>
          ) : (
            <Tooltip title={intl.formatMessage({ id: 'pages.backup.tooltip.enable' })}>
              <Button
                type="text"
                icon={<PlayCircleOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleJobStatus(record.id, record.status);
                }}
                className="action-button"
              />
            </Tooltip>
          )}
          <Tooltip title={intl.formatMessage({ id: 'pages.backup.tooltip.runNow' })}>
            <Button
              type="text"
              icon={runningTasks.has(record.id) ? <SyncOutlined spin /> : <CloudUploadOutlined />}
              disabled={
                runningTasks.has(record.id) ||
                (record.lastExecution && record.lastExecution.status === 'running') ||
                record.status === 'paused'
              }
              onClick={(e) => {
                e.stopPropagation();
                // 立即设置loading状态
                flushSync(() => {
                  setRunningTasks((prev) => new Set([...prev, record.id]));
                });
                // 然后调用API
                runJobNow(record.id);
              }}
              className="action-button"
            />
          </Tooltip>
          <Tooltip title={intl.formatMessage({ id: 'pages.backup.tooltip.openGcs' })}>
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                viewJobHistory(record.id);
              }}
              className="action-button"
            />
          </Tooltip>
          <Tooltip title={intl.formatMessage({ id: 'pages.backup.tooltip.edit' })}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                showEditJobModal(record.id);
              }}
              style={{ padding: '4px 8px', lineHeight: '1' }}
            />
          </Tooltip>
          <Tooltip title={intl.formatMessage({ id: 'pages.backup.tooltip.delete' })}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                Modal.confirm({
                  title: intl.formatMessage({ id: 'pages.backup.confirm.deleteTitle' }),
                  content: intl.formatMessage({ id: 'pages.backup.confirm.deleteContent' }),
                  okText: intl.formatMessage({ id: 'pages.backup.confirm.ok' }),
                  cancelText: intl.formatMessage({ id: 'pages.backup.confirm.cancel' }),
                  onOk: () => handleDeleteJob(record.id),
                });
              }}
              style={{ padding: '4px 8px', lineHeight: '1' }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  // 搜索框变化处理
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);

    // 在前端对已加载的数据进行过滤，不调用API
    if (value) {
      const filteredData = jobs.filter(
        (job) =>
          job.name.toLowerCase().includes(value.toLowerCase()) ||
          job.database.database.toLowerCase().includes(value.toLowerCase()) ||
          job.database.tables.some((table) => table.toLowerCase().includes(value.toLowerCase())) ||
          job.destination.gcsPath.toLowerCase().includes(value.toLowerCase()),
      );
      setFilteredJobs(filteredData);
    } else {
      setFilteredJobs(jobs);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchInputRef.current) {
        searchInputRef.current.blur();
      }
    }
  };

  const handleReset = () => {
    setSearchText('');
    setFilteredJobs(jobs);
    // 重置后聚焦回搜索框
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // 在组件加载后聚焦搜索框
  useEffect(() => {
    // Focus the search input after the component mounts
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // 刷新任务列表
  const handleRefresh = async () => {
    setLoading(true);
    try {
      // 调用真实API
      const response = await fetch('/api/backup', {
        method: 'GET',
      });

      const result = await response.json();

      if (result.success) {
        // 将API返回数据格式映射到应用所需格式
        // 确保result.data是数组，如果为null或undefined则使用空数组
        const rawData = Array.isArray(result.data) ? result.data : [];

        const mappedData = rawData.map((item: any) => {
          // 处理fields字段，确保格式正确
          const fields: { [table: string]: string[] } = {};

          if (item.database && item.database.fields) {
            Object.keys(item.database.fields).forEach((table) => {
              if (typeof item.database.fields[table] === 'string') {
                // 如果是字符串，转换为数组
                fields[table] = [item.database.fields[table]];
              } else if (Array.isArray(item.database.fields[table])) {
                // 如果已经是数组，直接使用
                fields[table] = item.database.fields[table];
              }
            });
          }

          return {
            id: item.id,
            name: item.name || '',
            database: {
              url: item.database?.url || '',
              username: item.database?.username || '',
              password: item.database?.password || '',
              database: item.database?.database || '',
              tables: item.database?.tables || [],
              fields: fields, // 使用处理后的fields
            },
            destination: {
              gcsPath: item.destination?.gcsPath || '',
              fileNamePattern: item.destination?.fileNamePattern || '',
              retention: item.destination?.retention || 30,
            },
            schedule: item.schedule || '',
            lastExecution: item.lastBackupTime
              ? {
                  status: 'success' as ExecutionStatus, // 假设有备份时间表示成功
                  time: item.lastBackupTime,
                  message: '',
                }
              : undefined,
            nextExecution: item.nextBackupTime || '',
            status: (item.status as JobStatus) || 'disabled',
            fileType: (item.format as 'json' | 'bson' | 'csv') || 'json',
            backupType: (item.backupType as 'full' | 'incremental') || 'full', // 处理备份类型
            query: item.query || '{}', // 处理查询条件
            sourceType: item.sourceType as 'mongodb' | 'mysql' | 'postgresql', // 直接使用API返回的源类型
            createdAt: item.lastUpdateTime || '',
            updatedAt: item.lastUpdateTime || '',
          };
        });

        setJobs(mappedData);

        // 清理运行状态标记，因为我们获取到了最新的实际状态
        setRunningTasks(new Set());

        // 如果有搜索条件，应用搜索过滤
        if (searchText) {
          const filteredData = mappedData.filter(
            (job: BackupJob) =>
              job.name.toLowerCase().includes(searchText.toLowerCase()) ||
              job.database.database.toLowerCase().includes(searchText.toLowerCase()) ||
              job.database.tables.some((table: string) =>
                table.toLowerCase().includes(searchText.toLowerCase()),
              ) ||
              job.destination.gcsPath.toLowerCase().includes(searchText.toLowerCase()),
          );
          setFilteredJobs(filteredData);
        } else {
          setFilteredJobs(mappedData);
        }

        message.success(intl.formatMessage({ id: 'pages.backup.messages.refreshSuccess' }));
      } else {
        // 只有在API明确返回错误时才显示错误消息
        console.error('刷新任务列表失败:', result.message);
        message.error(
          result.message || intl.formatMessage({ id: 'pages.backup.messages.refreshFailed' }),
        );
      }
    } catch (error) {
      // 只有在网络错误或解析错误时才显示错误消息
      console.error('刷新任务列表失败:', error);
      message.error(intl.formatMessage({ id: 'pages.backup.messages.refreshFailed' }));
    } finally {
      setLoading(false);
    }
  };

  // Handle column visibility change
  const handleColumnVisibilityChange = (checkedValues: string[]) => {
    setVisibleColumns(checkedValues);
  };

  // Filter columns based on visibility settings
  const getVisibleColumns = () => {
    return columns.filter((col) => {
      const key = col.key as string;
      return visibleColumns.includes(key);
    });
  };

  // Column selection popover content
  const ColumnSelectionContent = () => (
    <div className="column-selection-content">
      <Checkbox.Group value={visibleColumns} onChange={handleColumnVisibilityChange}>
        <div className="column-selection-list">
          {columns.map((column) => {
            const key = column.key as string;
            if (!key) return null;
            return (
              <div key={key} className="column-selection-item">
                <Checkbox value={key}>
                  {typeof column.title === 'string' ? column.title : key}
                </Checkbox>
              </div>
            );
          })}
        </div>
      </Checkbox.Group>
    </div>
  );

  // 验证基本信息是否已填写完整，并测试连接
  const testDatabaseConnection = async (formData: JobFormData) => {
    try {
      // 验证必填字段
      if (!formData.host || !formData.port || !formData.database) {
        message.error(intl.formatMessage({ id: 'pages.backup.messages.pleaseCompleteDBInfo' }));
        return false;
      }

      // 构建API请求参数，参考AddSync.tsx
      const payload = {
        dbType: formData.sourceType, // 直接使用传入的sourceType
        host: formData.host,
        port: formData.port,
        user: formData.username || '',
        password: formData.password || '',
        database: formData.database || '',
      };

      console.log('Testing database connection with payload:', payload);

      try {
        // 调用与AddSync.tsx相同的API端点
        const response = await fetch('/api/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // 获取数据库表信息并处理表数据
          const tables: string[] = result.data.tables;
          await handleTablesUpdated(tables, formData);

          // 测试成功消息
          message.success(intl.formatMessage({ id: 'pages.backup.messages.connectionSuccess' }));
          return true;
        } else {
          // 显示错误消息
          message.error(
            result.error || intl.formatMessage({ id: 'pages.backup.messages.connectionFailed' }),
          );
          return false;
        }
      } catch (error) {
        console.error('Database connection test failed:', error);
        message.error(intl.formatMessage({ id: 'pages.backup.messages.connectionFailed' }));
        return false;
      }
    } catch (error) {
      console.error('Error in testDatabaseConnection:', error);
      message.error(intl.formatMessage({ id: 'pages.backup.messages.pleaseCompleteDBInfo' }));
      return false;
    }
  };

  // 处理步骤变化 - 不再重复获取表和字段信息，因为handleBeforeStepChange已经完成了
  const handleStepChange = async (current: number) => {
    console.log('步骤变化到:', current);

    // 如果进入到数据选择步骤（索引为2）
    if (current === 2) {
      console.log('进入数据选择步骤 - 不需要重复获取表和字段信息，前一步已经处理');
      // 不需要任何操作，因为在handleBeforeStepChange中已经完成了连接测试和表格加载
    }
  };

  // 处理步骤切换前的验证
  const handleBeforeStepChange = async (current: number, target: number): Promise<boolean> => {
    console.log('步骤切换验证，当前步骤:', current, '目标步骤:', target);

    // 从源类型步骤（索引0）到基本信息步骤（索引1）时，不需要特殊验证
    if (current === 0 && target === 1) {
      return true;
    }

    // 从基本信息步骤（索引1）到数据选择步骤（索引2）时，验证并测试连接
    if (current === 1 && target === 2) {
      console.log('从基本信息到数据选择，进行连接验证');

      // 直接从表单获取数据并进行测试连接
      if (!formRef.current) {
        console.error('表单实例不存在，无法验证');
        message.error('表单实例不存在，请重试');
        return false;
      }

      try {
        // 先验证基本信息表单是否有效
        try {
          await formRef.current.validateFields(['basic']);
        } catch (validationError) {
          console.error('表单验证错误:', validationError);
          // 表单验证会显示错误信息，这里不需要再显示
          return false;
        }

        // 获取表单值 - 这是获取当前活动表单的值
        const allValues = formRef.current.getFieldsValue(true);
        console.log('完整表单值:', allValues);

        // 使用与Test Connection按钮相同的方式 - 直接从当前表单值获取
        // 因为我们在基本信息步骤（索引1），所以可以直接获取当前活动表单值
        const basicValues = {
          host: allValues.host,
          port: allValues.port,
          username: allValues.username,
          password: allValues.password,
          database: allValues.database,
          cronExpression: allValues.cronExpression,
          fileType: allValues.fileType,
        };

        // 添加调试信息，查看jobFormData的完整内容
        console.log('当前jobFormData内容:', jobFormData);

        // 尝试多种方式获取sourceType
        let sourceTypeValue;

        // 1. 直接从表单字段值获取
        try {
          // getFieldValue获取指定路径的值
          const sourceTypeFormValue = formRef.current.getFieldValue(['sourceType', 'sourceType']);
          console.log('通过getFieldValue获取的sourceType:', sourceTypeFormValue);
          if (sourceTypeFormValue) {
            sourceTypeValue = sourceTypeFormValue;
          }
        } catch (e) {
          console.warn('通过getFieldValue获取sourceType出错:', e);
        }

        // 2. 尝试通过validateFields获取第一步表单的值
        if (!sourceTypeValue) {
          try {
            // 验证并获取第一步表单的值
            const firstStepForm = await formRef.current.validateFields(['sourceType']);
            console.log('通过validateFields获取的第一步表单:', firstStepForm);
            if (
              firstStepForm &&
              firstStepForm.sourceType &&
              typeof firstStepForm.sourceType === 'object'
            ) {
              sourceTypeValue = firstStepForm.sourceType.sourceType;
              console.log('从validateFields提取的sourceType:', sourceTypeValue);
            } else if (
              firstStepForm &&
              firstStepForm.sourceType &&
              typeof firstStepForm.sourceType === 'string'
            ) {
              sourceTypeValue = firstStepForm.sourceType;
              console.log('从validateFields直接获取的sourceType:', sourceTypeValue);
            }
          } catch (e) {
            console.warn('通过validateFields获取sourceType出错:', e);
          }
        }

        // 3. 如果上面都失败，从jobFormData获取
        if (!sourceTypeValue) {
          sourceTypeValue = jobFormData.sourceType;
          console.log('从jobFormData获取的sourceType:', sourceTypeValue);
        }

        // 4. 从端口信息判断数据库类型
        if (!sourceTypeValue) {
          // 根据端口推断数据库类型
          if (basicValues.port === '3306') {
            sourceTypeValue = 'mysql';
            console.log('根据端口3306推断为MySQL');
          } else if (basicValues.port === '5432') {
            sourceTypeValue = 'postgresql';
            console.log('根据端口5432推断为PostgreSQL');
          } else if (basicValues.port === '27017') {
            sourceTypeValue = 'mongodb';
            console.log('根据端口27017推断为MongoDB');
          }
        }

        // 5. 兜底使用默认值
        if (!sourceTypeValue) {
          sourceTypeValue = 'mongodb'; // 默认值
          console.log('使用默认值mongodb');
        }

        console.log('步骤验证使用的sourceType:', sourceTypeValue);
        console.log('步骤验证使用的基本信息:', basicValues);
        console.log('当前编辑状态:', editingJobId);

        // 在编辑模式下，从当前编辑的任务获取额外信息
        let jobData = null;
        if (editingJobId) {
          jobData = jobs.find((j) => j.id === editingJobId);
          console.log('当前编辑的任务数据:', jobData);
        }

        // 直接使用当前表单获取的值
        const host = basicValues.host || '';
        const port = basicValues.port || '';
        const database = basicValues.database || '';

        console.log('最终使用的连接参数:', { host, port, database });

        // 验证必填字段
        if (!host || !port || !database) {
          console.error('基本信息不完整:', { host, port, database });
          message.error(intl.formatMessage({ id: 'pages.backup.messages.pleaseCompleteDBInfo' }));
          return false;
        }

        // 构建测试连接数据 - 与Test Connection按钮使用相同的方式
        const testData: JobFormData = {
          name: allValues.name || jobFormData.name,
          sourceType: sourceTypeValue, // 使用jobFormData中的sourceType
          host,
          port,
          username: basicValues.username || (jobData ? jobData.database.username : ''),
          password: basicValues.password || (jobData ? jobData.database.password : ''),
          database,
          cronExpression: basicValues.cronExpression || (jobData ? jobData.schedule : ''),
          fileType: basicValues.fileType || (jobData ? jobData.fileType : 'json'),
          tables: [],
          selectedFields: {},
          gcsPath: '',
          fileNamePattern: '',
          retention: 30,
          backupType: 'full',
          query: '{}',
        };

        console.log('步骤验证使用的测试数据:', testData);

        // 显示加载提示
        message.loading(
          intl.formatMessage({ id: 'pages.backup.messages.testingConnection' }) ||
            '正在测试连接...',
          0,
        );

        try {
          // 执行测试连接 - 确保等待结果返回
          const result = await testDatabaseConnection(testData);

          // 关闭加载提示
          message.destroy();

          if (!result) {
            message.error(
              intl.formatMessage({ id: 'pages.backup.messages.connectionRequiredToProceed' }) ||
                '连接验证失败，请确保数据库连接信息正确并测试连接成功后再继续',
            );
            return false; // 连接失败，阻止进入下一步
          }

          // 连接成功，允许进入下一步
          message.success(
            intl.formatMessage({ id: 'pages.backup.messages.connectionSuccess' }) || '连接成功',
          );
          return true;
        } catch (connError) {
          // 关闭加载提示
          message.destroy();
          console.error('连接测试失败:', connError);
          message.error(
            intl.formatMessage({ id: 'pages.backup.messages.connectionFailed' }) || '连接失败',
          );
          return false; // 连接失败，阻止进入下一步
        }
      } catch (error) {
        console.error('处理步骤验证时出错:', error);
        message.error('验证过程中发生错误，请重试');
        return false;
      }
    }

    // 其他步骤切换不需要特殊验证
    return true;
  };

  // 生成查询条件JSON字符串 - 这个函数需要在handleAddQueryField之前定义
  const updateQueryString = (fields: QueryField[]) => {
    if (fields.length === 0) {
      setJobFormData({
        ...jobFormData,
        query: '{}',
      });
      return;
    }

    try {
      // 使用表名组织查询条件
      const queryObj: Record<string, Record<string, any>> = {};

      fields.forEach((field) => {
        // 确保表对象存在
        if (!queryObj[field.table]) {
          queryObj[field.table] = {};
        }

        // 处理日期范围类型
        if (field.isDateRange && field.dateRange) {
          const dateRange = field.dateRange;

          // 直接在字段上设置日期范围配置
          queryObj[field.table][field.field] = {
            type: dateRange.type,
            startOffset: dateRange.startOffset,
            endOffset: dateRange.endOffset,
          };
        } else {
          // 处理普通值
          let value: any = field.value;

          // 处理数值类型
          if (!isNaN(Number(value)) && field.field !== '_id') {
            value = Number(value);
          }

          // 处理布尔类型
          if (value === 'true' || value === 'false') {
            value = value === 'true';
          }

          // 处理操作符
          if (field.operator === 'eq') {
            queryObj[field.table][field.field] = value;
          } else {
            if (!queryObj[field.table][field.field]) {
              queryObj[field.table][field.field] = {};
            }
            queryObj[field.table][field.field][`$${field.operator}`] = value;
          }
        }
      });

      const queryStr = JSON.stringify(queryObj);
      setJobFormData({
        ...jobFormData,
        query: queryStr,
      });
    } catch (error) {
      console.error('Error creating query string:', error);
      setJobFormData({
        ...jobFormData,
        query: '{}',
      });
    }
  };

  // 添加查询条件字段
  const handleAddQueryField = () => {
    if (!currentQueryTable) {
      message.warning(intl.formatMessage({ id: 'pages.backup.dataSelection.selectTableFirst' }));
      return;
    }

    if (!currentQueryField) {
      message.warning(intl.formatMessage({ id: 'pages.backup.query.fieldRequired' }));
      return;
    }

    // 添加查询字段到列表
    let newField: QueryField = {
      table: currentQueryTable,
      field: currentQueryField,
      operator: currentQueryOperator,
      value: currentQueryValue,
    };

    // 如果是日期范围查询，添加相关字段
    if (currentQueryOperator === 'dateRange') {
      try {
        const dateConfig = JSON.parse(currentQueryValue);
        newField = {
          ...newField,
          isDateRange: true,
          dateRange: {
            type: dateConfig.type as 'daily' | 'weekly' | 'monthly' | 'custom',
            startOffset: dateConfig.startOffset,
            endOffset: dateConfig.endOffset,
          },
        };
      } catch (e) {
        console.error('解析日期范围配置失败:', e);
        message.error(intl.formatMessage({ id: 'pages.backup.query.invalidDateRange' }));
        return;
      }
    }

    const newQueryFields = [...queryFields, newField];
    setQueryFields(newQueryFields);

    // 重置输入
    setCurrentQueryField('');
    setCurrentQueryValue('');

    // 更新查询JSON字符串
    updateQueryString(newQueryFields);
  };

  // 删除查询条件字段
  const handleRemoveQueryField = (index: number) => {
    const newFields = [...queryFields];
    newFields.splice(index, 1);
    setQueryFields(newFields);

    // 更新查询JSON字符串
    updateQueryString(newFields);
  };

  // 在return语句之前添加以下CSS样式
  const tableStyles = `
    /* 强制固定列保持样式一致 */
    .backup-table .ant-table-cell-fix-right {
      background-color: #fff !important;
      z-index: 10 !important;
    }
    .backup-table .ant-table-thead > tr > th.ant-table-cell-fix-right {
      background-color: #fafafa !important;
    }
    .backup-table .ant-table-tbody > tr:hover > td.ant-table-cell-fix-right {
      background-color: #f5f5f5 !important;
    }
    
    /* 确保按钮在同一高度对齐 */
    .action-button {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      height: 28px !important;
      width: 28px !important;
      padding: 0 !important;
      margin: 0 4px !important;
      vertical-align: middle !important;
    }
    
    /* 强制删除按钮与其他按钮保持相同的高度和位置 */
    .action-button.danger {
      color: #ff4d4f !important;
    }
    .action-button.danger:hover {
      color: #ff7875 !important;
      background: rgba(255, 77, 79, 0.1) !important;
    }
  `;

  return (
    <div className="job-list-container">
      <style>{tableStyles}</style>
      <Card
        title={intl.formatMessage({ id: 'pages.backup.jobList.title' })}
        extra={
          <Space>
            <Input
              ref={searchInputRef}
              placeholder={intl.formatMessage({ id: 'pages.backup.jobList.search.placeholder' })}
              value={searchText}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              style={{ width: 150 }}
              suffix={
                searchText ? <CloseCircleOutlined onClick={handleReset} /> : <SearchOutlined />
              }
            />
            <Button onClick={handleReset}>
              {intl.formatMessage({ id: 'pages.backup.jobList.search.reset' })}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              {intl.formatMessage({ id: 'pages.backup.jobList.refresh' })}
            </Button>
            <Popover
              content={<ColumnSelectionContent />}
              title={intl.formatMessage({ id: 'pages.backup.jobList.columns' })}
              trigger="click"
              placement="bottomLeft"
              overlayClassName="column-selection-popover"
            >
              <Button icon={<SettingOutlined />}>
                {intl.formatMessage({ id: 'pages.backup.jobList.columns' })}
              </Button>
            </Popover>
            <Button type="primary" icon={<PlusOutlined />} onClick={showCreateJobModal}>
              {intl.formatMessage({ id: 'pages.backup.jobList.createButton' })}
            </Button>
          </Space>
        }
      >
        <Table
          columns={getVisibleColumns()}
          dataSource={filteredJobs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1650, y: 500 }}
          bordered
          sticky
          className="backup-table"
          onRow={(record) => ({
            onClick: (e) => {
              // 如果点击来自按钮，不做任何处理
              if ((e.target as HTMLElement).closest('button')) {
                return;
              }

              // 可以在这里添加行点击事件处理
              console.log('Row clicked:', record.id);
            },
          })}
        />
      </Card>

      {/* 创建/编辑任务表单 - 使用StepsForm替换原来的Modal+Tabs结构 */}
      <StepsForm
        formRef={formRef}
        onFinish={handleSubmit}
        current={currentStep}
        onCurrentChange={async (current) => {
          // 验证步骤切换
          const canProceed = await handleBeforeStepChange(currentStep, current);
          if (!canProceed) {
            return;
          }

          setCurrentStep(current);
          handleStepChange(current);
        }}
        // 添加表单初始化完成回调
        onFormFinish={(name: string, values: any) => {
          console.log(`Step ${name} 完成，值:`, values);
        }}
        // 添加表单字段变化回调
        onFormChange={(name: string, info: any) => {
          console.log(`Step ${name} 字段变化:`, info);
        }}
        formProps={{
          preserve: true,
          validateMessages: {
            required: '${label} 不能为空', // 直接使用静态消息模板，Ant Design表单会自动填充label
          },
        }}
        stepsProps={{
          size: 'small',
        }}
        stepsFormRender={(dom, submitter) => (
          <Modal
            title={
              editingJobId
                ? intl.formatMessage({ id: 'pages.backup.modal.editTitle' })
                : intl.formatMessage({ id: 'pages.backup.modal.createTitle' })
            }
            open={jobModalVisible}
            onCancel={closeJobModal}
            width={800}
            footer={submitter}
            maskClosable={false}
            destroyOnClose
          >
            {dom}
          </Modal>
        )}
      >
        {/* 步骤1：源类型 */}
        <StepsForm.StepForm
          name="sourceType"
          title={intl.formatMessage({ id: 'pages.backup.tabs.sourceType' }) || 'Source Type'}
          initialValues={{
            // 这里直接从jobs数组中获取当前编辑的任务数据，而不是依赖状态
            sourceType: editingJobId
              ? // 如果是编辑模式，尝试从jobs数组中获取sourceType
                jobs.find((j) => j.id === editingJobId)?.sourceType ||
                jobFormData.sourceType ||
                'mongodb'
              : 'mongodb',
            name: editingJobId
              ? // 同样，也从jobs数组中获取name
                jobs.find((j) => j.id === editingJobId)?.name || jobFormData.name || ''
              : '',
          }}
        >
          <Form.Item
            name="name"
            label={intl.formatMessage({ id: 'pages.backup.form.name' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'pages.backup.form.name.required' }),
              },
            ]}
          >
            <Input placeholder={intl.formatMessage({ id: 'pages.backup.form.name.placeholder' })} />
          </Form.Item>

          <Form.Item
            name="sourceType"
            label={intl.formatMessage({ id: 'pages.backup.form.sourceType' }) || 'Source Type'}
            rules={[
              {
                required: true,
                message:
                  intl.formatMessage({ id: 'pages.backup.form.sourceType.required' }) ||
                  'Please select source type',
              },
            ]}
          >
            <Select
              placeholder={
                intl.formatMessage({ id: 'pages.backup.form.sourceType.placeholder' }) ||
                'Select database type'
              }
              onChange={(value) => {
                // 根据数据库类型设置默认端口
                const portMap: Record<string, string> = {
                  mongodb: '27017',
                  mysql: '3306',
                  postgresql: '5432',
                };

                // 如果formRef存在，更新端口字段
                if (formRef.current) {
                  const currentFormData = formRef.current.getFieldsValue();
                  // 检查是否已经有用户输入的端口值
                  const currentPort = currentFormData.basic?.port;

                  // 只有当端口未设置或为默认端口之一时才更新
                  if (!currentPort || Object.values(portMap).includes(currentPort)) {
                    // 在下一个渲染周期设置表单值
                    setTimeout(() => {
                      formRef.current?.setFieldValue(['basic', 'port'], portMap[value] || '');
                    }, 0);
                  }
                }

                // 更新jobFormData
                setJobFormData((prev) => ({
                  ...prev,
                  sourceType: value,
                }));
              }}
            >
              <Option value="mongodb">MongoDB</Option>
              <Option value="mysql">MySQL</Option>
              <Option value="postgresql">PostgreSQL</Option>
            </Select>
          </Form.Item>
        </StepsForm.StepForm>

        {/* 步骤2：基本信息 */}
        <StepsForm.StepForm
          name="basic"
          title={intl.formatMessage({ id: 'pages.backup.tabs.basic' })}
          initialValues={
            editingJobId
              ? {
                  host: jobFormData.host,
                  port: jobFormData.port,
                  username: jobFormData.username,
                  password: jobFormData.password,
                  database: jobFormData.database,
                  cronExpression: jobFormData.cronExpression,
                  fileType: jobFormData.fileType,
                }
              : {
                  host: '',
                  port: '',
                  username: '',
                  password: '',
                  database: '',
                  cronExpression: '0 2 * * *',
                  fileType: 'json',
                }
          }
        >
          <Form.Item
            name="host"
            label={intl.formatMessage({ id: 'pages.backup.form.host' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'pages.backup.form.host.required' }),
              },
            ]}
          >
            <Input placeholder={intl.formatMessage({ id: 'pages.backup.form.host.placeholder' })} />
          </Form.Item>

          <Form.Item
            name="port"
            label={intl.formatMessage({ id: 'pages.backup.form.port' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'pages.backup.form.port.required' }),
              },
            ]}
          >
            <Input placeholder={intl.formatMessage({ id: 'pages.backup.form.port.placeholder' })} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label={intl.formatMessage({ id: 'pages.backup.form.username' })}
              >
                <Input
                  placeholder={intl.formatMessage({ id: 'pages.backup.form.username.placeholder' })}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label={intl.formatMessage({ id: 'pages.backup.form.password' })}
              >
                <Input.Password
                  placeholder={intl.formatMessage({ id: 'pages.backup.form.password.placeholder' })}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="database"
            label={intl.formatMessage({ id: 'pages.backup.form.database' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'pages.backup.form.database.required' }),
              },
            ]}
          >
            <Input
              placeholder={intl.formatMessage({ id: 'pages.backup.form.database.placeholder' })}
            />
          </Form.Item>

          <Form.Item
            name="cronExpression"
            label={intl.formatMessage({ id: 'pages.backup.form.cronExpression' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'pages.backup.form.cronExpression.required' }),
              },
            ]}
            tooltip={intl.formatMessage({ id: 'pages.backup.form.cronExpression.tooltip' })}
          >
            <Input
              placeholder={intl.formatMessage({
                id: 'pages.backup.form.cronExpression.placeholder',
              })}
            />
          </Form.Item>

          <Form.Item
            name="fileType"
            label={intl.formatMessage({ id: 'pages.backup.form.fileType' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'pages.backup.form.fileType.required' }),
              },
            ]}
          >
            <Select placeholder={intl.formatMessage({ id: 'pages.backup.form.fileType.required' })}>
              <Option value="json">JSON</Option>
              <Option value="bson">BSON</Option>
              <Option value="csv">CSV</Option>
              <Option value="csv">SQL</Option>
            </Select>
          </Form.Item>

          <Space>
            <Button
              type="primary"
              onClick={async () => {
                if (!formRef.current) {
                  message.error('表单实例不存在，请重试');
                  return;
                }

                try {
                  // 先获取所有表单字段
                  const allFormValues = formRef.current.getFieldsValue(true);
                  console.log('测试连接时获取的表单值:', allFormValues);

                  // 获取jobFormData中的sourceType - 这是我们在表单之外维护的状态
                  const sourceTypeValue = jobFormData.sourceType;
                  console.log('从jobFormData获取的sourceType:', sourceTypeValue);

                  console.log('最终确定的sourceType值:', sourceTypeValue);
                  // 下面这行有问题 - basic字段应该从allFormValues直接获取
                  // const basicValues = allFormValues.basic || {};

                  // 正确获取basic字段 - 在StepsForm中，当前步骤的表单值直接在根级别
                  const basicValues = {
                    host: allFormValues.host,
                    port: allFormValues.port,
                    username: allFormValues.username,
                    password: allFormValues.password,
                    database: allFormValues.database,
                    cronExpression: allFormValues.cronExpression,
                    fileType: allFormValues.fileType,
                  };

                  console.log('测试连接使用的sourceType:', sourceTypeValue);
                  console.log('当前编辑状态:', editingJobId);

                  // 在编辑模式下，从当前编辑的任务获取额外信息
                  let jobData = null;
                  if (editingJobId) {
                    jobData = jobs.find((j) => j.id === editingJobId);
                    console.log('当前编辑的任务数据:', jobData);
                  }

                  // 如果在编辑模式下，即使表单没有显示全部字段，我们也应该使用现有任务的数据
                  const host =
                    basicValues.host || (jobData ? jobData.database.url.split(':')[0] : '');
                  const port =
                    basicValues.port || (jobData ? jobData.database.url.split(':')[1] : '');
                  const database =
                    basicValues.database || (jobData ? jobData.database.database : '');

                  console.log('最终使用的连接参数:', { host, port, database });

                  // 验证必要字段
                  if (!host || !port || !database) {
                    console.error('基本信息不完整:', { host, port, database });
                    message.error(
                      intl.formatMessage({ id: 'pages.backup.messages.pleaseCompleteDBInfo' }),
                    );
                    return;
                  }

                  // 获取名称 - 可能在不同的位置
                  let name = '';
                  if (allFormValues.name) {
                    name = allFormValues.name;
                  } else if (allFormValues.sourceType?.name) {
                    name = allFormValues.sourceType.name;
                  } else if (jobData) {
                    name = jobData.name;
                  }

                  console.log('使用的name值:', name);
                  console.log('使用的sourceType值:', sourceTypeValue);

                  // 构建测试连接需要的数据
                  const testData: JobFormData = {
                    name: name,
                    sourceType: sourceTypeValue || (jobData ? jobData.sourceType : 'mongodb'),
                    host,
                    port,
                    username: basicValues.username || (jobData ? jobData.database.username : ''),
                    password: basicValues.password || (jobData ? jobData.database.password : ''),
                    database,
                    cronExpression: basicValues.cronExpression || (jobData ? jobData.schedule : ''),
                    fileType: basicValues.fileType || (jobData ? jobData.fileType : 'json'),
                    tables: [],
                    selectedFields: {},
                    gcsPath: '',
                    fileNamePattern: '',
                    retention: 30,
                    backupType: 'full',
                    query: '{}',
                  };

                  console.log('测试连接使用的完整数据:', testData);

                  // 执行测试连接
                  await testDatabaseConnection(testData);
                } catch (error) {
                  console.error('测试连接过程中出错:', error);
                  message.error('测试连接失败');
                }
              }}
            >
              {intl.formatMessage({ id: 'pages.backup.form.testConnection' })}
            </Button>
          </Space>
        </StepsForm.StepForm>

        {/* 步骤3：数据选择与目标位置 */}
        <StepsForm.StepForm
          name="dataSelectionAndDestination"
          title={
            intl.formatMessage({ id: 'pages.backup.tabs.dataSelectionAndDestination' }) ||
            'Data Selection & Target Location'
          }
          initialValues={{
            backupType: jobFormData.backupType || 'full',
            gcsPath: editingJobId ? jobFormData.gcsPath : '',
            fileNamePattern: editingJobId ? jobFormData.fileNamePattern : '',
            retention: editingJobId ? jobFormData.retention : 30,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ marginBottom: 16 }}>
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <Transfer
                    dataSource={tableItems}
                    titles={[
                      intl.formatMessage({ id: 'pages.backup.dataSelection.transfer.available' }),
                      intl.formatMessage({ id: 'pages.backup.dataSelection.transfer.selected' }),
                    ]}
                    targetKeys={targetTableKeys}
                    onChange={handleTableChange}
                    filterOption={filterTableOption}
                    showSearch
                    oneWay
                    render={(item) => item.title}
                    listStyle={{
                      width: 300,
                      height: 300,
                    }}
                    operations={[
                      intl.formatMessage({ id: 'pages.backup.dataSelection.transfer.selectAdd' }),
                      intl.formatMessage({
                        id: 'pages.backup.dataSelection.transfer.selectRemove',
                      }),
                    ]}
                  />
                </Col>
              </Row>
            </div>

            {targetTableKeys.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  border: '1px solid #f0f0f0',
                  borderRadius: '4px',
                  padding: '16px',
                  height: '420px',
                  overflow: 'hidden',
                  position: 'relative',
                  width: '100%',
                  minWidth: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
                className="backup-config-container"
              >
                {/* 集合选择器 */}
                <Row gutter={[0, 16]}>
                  <Col span={24}>
                    <Space align="center">
                      <Typography.Text strong>
                        {intl.formatMessage({ id: 'pages.backup.dataSelection.selectCollection' })}
                      </Typography.Text>
                      <Select
                        style={{ width: 300 }}
                        placeholder={intl.formatMessage({
                          id: 'pages.backup.dataSelection.selectTable.placeholder',
                        })}
                        value={currentTable}
                        onChange={(value) => {
                          setCurrentTable(value);
                          setCurrentQueryTable(value);
                          handleViewTableFields(value);
                        }}
                        disabled={targetTableKeys.length === 0}
                      >
                        {targetTableKeys.map((table) => (
                          <Select.Option key={table} value={table}>
                            {table}
                          </Select.Option>
                        ))}
                      </Select>
                    </Space>
                  </Col>
                </Row>

                {/* 功能选项卡 */}
                <Tabs
                  defaultActiveKey="collections"
                  style={{
                    marginTop: 16,
                    width: '100%',
                    height: '350px',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '350px',
                    maxHeight: '350px',
                  }}
                  destroyInactiveTabPane={false}
                  animated={false}
                  tabBarStyle={{
                    marginBottom: 0,
                    background: '#fafafa',
                    borderRadius: '6px 6px 0 0',
                    padding: '4px',
                    border: '1px solid #d9d9d9',
                    borderBottom: 'none',
                    flexShrink: 0,
                  }}
                  className="backup-tab-container"
                  type="card"
                  size="small"
                  tabBarGutter={2}
                  onChange={() => {
                    // 在下一个事件循环中确保选项卡内容区域高度稳定
                    setTimeout(() => {
                      const contentWrappers = document.querySelectorAll('.tab-content-wrapper');
                      contentWrappers.forEach((wrapper) => {
                        if (wrapper) {
                          (wrapper as HTMLElement).style.height = '300px';
                          (wrapper as HTMLElement).style.minHeight = '300px';
                          (wrapper as HTMLElement).style.maxHeight = '300px';
                        }
                      });
                    }, 0);
                  }}
                >
                  {/* 集合选择选项卡 */}
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
                        <DatabaseOutlined style={{ fontSize: '12px' }} />
                        <span>
                          {intl.formatMessage({ id: 'pages.backup.dataSelection.collections' })}
                        </span>
                      </div>
                    }
                    key="collections"
                    forceRender
                  >
                    <div
                      className="tab-content-wrapper"
                      style={{
                        height: '300px',
                        minHeight: '300px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        background: '#fff',
                        border: '1px solid #d9d9d9',
                        borderTop: 'none',
                        padding: '16px',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ marginBottom: '12px' }}>
                        <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                          {intl.formatMessage({
                            id: 'pages.backup.dataSelection.collections.help',
                          })}
                        </Typography.Text>
                      </div>
                      <Table
                        dataSource={targetTableKeys.map((tableName) => ({
                          key: tableName,
                          tableName,
                          fieldCount: tableFields[tableName]?.length || 0,
                          selectedFieldCount: jobFormData.selectedFields[tableName]?.length || 0,
                          queryCount: queryFields.filter((q) => q.table === tableName).length,
                        }))}
                        columns={[
                          {
                            title: intl.formatMessage({
                              id: 'pages.backup.dataSelection.collections.name',
                            }),
                            dataIndex: 'tableName',
                            key: 'tableName',
                          },
                          {
                            title: intl.formatMessage({
                              id: 'pages.backup.dataSelection.collections.fields',
                            }),
                            dataIndex: 'fieldCount',
                            key: 'fieldCount',
                            render: (count, record) => (
                              <Space>
                                <Badge
                                  count={record.selectedFieldCount}
                                  style={{ backgroundColor: '#52c41a' }}
                                />
                                <Typography.Text type="secondary">/ {count}</Typography.Text>
                              </Space>
                            ),
                          },
                          {
                            title: intl.formatMessage({
                              id: 'pages.backup.dataSelection.collections.queries',
                            }),
                            dataIndex: 'queryCount',
                            key: 'queryCount',
                            render: (count) => (
                              <Badge
                                count={count}
                                style={{ backgroundColor: count > 0 ? '#1890ff' : '#d9d9d9' }}
                              />
                            ),
                          },
                        ]}
                        pagination={false}
                        size="small"
                        rowClassName={(record) =>
                          record.tableName === currentTable ? 'ant-table-row-selected' : ''
                        }
                        onRow={(record) => ({
                          onClick: () => {
                            setCurrentTable(record.tableName);
                            setCurrentQueryTable(record.tableName);
                            handleViewTableFields(record.tableName);
                          },
                          style: { cursor: 'pointer' },
                        })}
                      />
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
                        <span>
                          {intl.formatMessage({ id: 'pages.backup.dataSelection.queryBuilder' })}
                        </span>
                      </div>
                    }
                    key="query"
                    disabled={!currentTable}
                    forceRender
                  >
                    <div
                      className="tab-content-wrapper"
                      style={{
                        height: '300px',
                        minHeight: '300px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        background: '#fff',
                        border: '1px solid #d9d9d9',
                        borderTop: 'none',
                        padding: '16px',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                      }}
                    >
                      {currentTable ? (
                        <>
                          <div style={{ marginBottom: '12px' }}>
                            <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                              {intl.formatMessage({
                                id: 'pages.backup.dataSelection.queryBuilder.help',
                              })}
                            </Typography.Text>
                          </div>

                          {/* 添加新查询条件 */}
                          <div style={{ marginBottom: 16 }}>
                            <Typography.Title
                              level={5}
                              style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}
                            >
                              {intl.formatMessage({
                                id: 'pages.backup.dataSelection.addQueryField',
                              })}
                            </Typography.Title>

                            <Row gutter={8} align="middle">
                              <Col span={8}>
                                <Input
                                  placeholder={intl.formatMessage({
                                    id: 'pages.backup.dataSelection.fieldName',
                                  })}
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
                                      setCurrentQueryValue(
                                        JSON.stringify({
                                          type: 'daily',
                                          startOffset: -1,
                                          endOffset: 0,
                                        }),
                                      );
                                    } else {
                                      setCurrentQueryValue('');
                                    }
                                  }}
                                  style={{ width: '100%' }}
                                >
                                  <Select.Option value="eq">=</Select.Option>
                                  <Select.Option value="gt">&gt;</Select.Option>
                                  <Select.Option value="gte">&gt;=</Select.Option>
                                  <Select.Option value="lt">&lt;</Select.Option>
                                  <Select.Option value="lte">&lt;=</Select.Option>
                                  <Select.Option value="ne">!=</Select.Option>
                                  <Select.Option value="in">in</Select.Option>
                                  <Select.Option value="nin">not in</Select.Option>
                                  <Select.Option value="dateRange">dateRange</Select.Option>
                                </Select>
                              </Col>
                              <Col span={8}>
                                {currentQueryOperator !== 'dateRange' ? (
                                  <Input
                                    placeholder={intl.formatMessage({
                                      id: 'pages.backup.dataSelection.fieldValue',
                                    })}
                                    value={currentQueryValue}
                                    onChange={(e) => setCurrentQueryValue(e.target.value)}
                                    autoComplete="off"
                                  />
                                ) : (
                                  <Select
                                    value={(() => {
                                      try {
                                        const dateConfig = JSON.parse(currentQueryValue || '{}');
                                        if (dateConfig.type === 'daily') {
                                          if (
                                            dateConfig.startOffset === -1 &&
                                            dateConfig.endOffset === -1
                                          ) {
                                            return 'yesterday';
                                          }
                                        }
                                        return 'yesterday';
                                      } catch {
                                        return 'yesterday';
                                      }
                                    })()}
                                    onChange={(value) => {
                                      let dateConfig;
                                      switch (value) {
                                        case 'yesterday':
                                          dateConfig = {
                                            type: 'daily',
                                            startOffset: -1,
                                            endOffset: -1,
                                          };
                                          break;
                                        case 'last7days':
                                          dateConfig = {
                                            type: 'daily',
                                            startOffset: -7,
                                            endOffset: 0,
                                          };
                                          break;
                                        case 'last30days':
                                          dateConfig = {
                                            type: 'daily',
                                            startOffset: -30,
                                            endOffset: 0,
                                          };
                                          break;
                                        default:
                                          dateConfig = {
                                            type: 'daily',
                                            startOffset: -1,
                                            endOffset: 0,
                                          };
                                      }
                                      setCurrentQueryValue(JSON.stringify(dateConfig));
                                    }}
                                    style={{ width: '100%' }}
                                  >
                                    <Select.Option value="yesterday">
                                      {intl.formatMessage({
                                        id: 'pages.backup.dateRange.yesterday',
                                      })}
                                    </Select.Option>
                                    <Select.Option value="last7days">
                                      {intl.formatMessage({
                                        id: 'pages.backup.dateRange.last7days',
                                      })}
                                    </Select.Option>
                                    <Select.Option value="last30days">
                                      {intl.formatMessage({
                                        id: 'pages.backup.dateRange.last30days',
                                      })}
                                    </Select.Option>
                                  </Select>
                                )}
                              </Col>
                              <Col span={2}>
                                <Button
                                  type="primary"
                                  icon={<PlusOutlined />}
                                  onClick={handleAddQueryField}
                                  disabled={!currentQueryTable || !currentQueryField}
                                />
                              </Col>
                            </Row>
                          </div>

                          {/* 查询条件列表 */}
                          <div style={{ marginTop: 20 }}>
                            <Typography.Title
                              level={5}
                              style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}
                            >
                              {intl.formatMessage({ id: 'pages.backup.query.conditionList' })}
                            </Typography.Title>
                            {queryFields.filter((q) => q.table === currentTable).length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '16px', color: '#999' }}>
                                {intl.formatMessage({ id: 'pages.backup.query.noConditions' })}
                              </div>
                            ) : (
                              <List
                                bordered
                                dataSource={queryFields.filter((q) => q.table === currentTable)}
                                renderItem={(item: QueryField, index) => (
                                  <List.Item
                                    key={index}
                                    actions={[
                                      <Button
                                        key="delete"
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => {
                                          const globalIndex = queryFields.findIndex(
                                            (q) =>
                                              q.table === item.table &&
                                              q.field === item.field &&
                                              q.operator === item.operator &&
                                              q.value === item.value,
                                          );
                                          handleRemoveQueryField(globalIndex);
                                        }}
                                      />,
                                    ]}
                                  >
                                    <div
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      <Tag color="purple">{item.table}</Tag>
                                      <Tag>{item.field}</Tag>
                                      <Tag color="blue">{item.operator}</Tag>
                                      <Tag color="green">{item.value}</Tag>
                                    </div>
                                  </List.Item>
                                )}
                              />
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                          <Empty
                            description={intl.formatMessage({
                              id: 'pages.backup.dataSelection.selectTableFirst',
                            })}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        </div>
                      )}
                    </div>
                  </Tabs.TabPane>

                  {/* 字段选择选项卡 */}
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
                        <span>
                          {intl.formatMessage({ id: 'pages.backup.dataSelection.fields' })}
                        </span>
                      </div>
                    }
                    key="fields"
                    disabled={!currentTable}
                    forceRender
                  >
                    <div
                      className="tab-content-wrapper"
                      style={{
                        height: '300px',
                        minHeight: '300px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        background: '#fff',
                        border: '1px solid #d9d9d9',
                        borderTop: 'none',
                        padding: '16px',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                      }}
                    >
                      {currentTable ? (
                        <>
                          <div style={{ marginBottom: '12px' }}>
                            <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                              {intl.formatMessage({ id: 'pages.backup.dataSelection.fields.help' })}
                            </Typography.Text>
                          </div>

                          <div className="table-actions" style={{ marginBottom: '12px' }}>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => {
                                if (currentTable && tableFields[currentTable]) {
                                  const allKeys = tableFields[currentTable].map((field) => field);
                                  handleFieldSelectionChange(allKeys);
                                }
                              }}
                            >
                              {intl.formatMessage({
                                id: 'pages.backup.dataSelection.actions.selectAll',
                              })}
                            </Button>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => handleFieldSelectionChange([])}
                            >
                              {intl.formatMessage({
                                id: 'pages.backup.dataSelection.actions.clear',
                              })}
                            </Button>
                          </div>

                          <Table
                            rowSelection={{
                              type: 'checkbox',
                              selectedRowKeys: jobFormData.selectedFields[currentTable] || [],
                              onChange: handleFieldSelectionChange,
                            }}
                            columns={[
                              {
                                title: intl.formatMessage({
                                  id: 'pages.backup.dataSelection.fields.name',
                                }),
                                dataIndex: 'name',
                                key: 'name',
                              },
                              {
                                title: intl.formatMessage({
                                  id: 'pages.backup.dataSelection.fields.type',
                                }),
                                dataIndex: 'type',
                                key: 'type',
                              },
                            ]}
                            dataSource={fieldDataSource}
                            rowKey="key"
                            size="small"
                            pagination={false}
                            className="backup-field-table"
                          />
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                          <Empty
                            description={intl.formatMessage({
                              id: 'pages.backup.dataSelection.selectTableFirst',
                            })}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        </div>
                      )}
                    </div>
                  </Tabs.TabPane>

                  {/* 目标位置选项卡 */}
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
                        <CloudServerOutlined style={{ fontSize: '12px' }} />
                        <span>{intl.formatMessage({ id: 'pages.backup.tabs.destination' })}</span>
                      </div>
                    }
                    key="destination"
                    forceRender
                  >
                    <div
                      className="tab-content-wrapper"
                      style={{
                        height: '300px',
                        minHeight: '300px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        background: '#fff',
                        border: '1px solid #d9d9d9',
                        borderTop: 'none',
                        padding: '16px',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ marginBottom: '12px' }}>
                        <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                          {intl.formatMessage({ id: 'pages.backup.destination.help' }) ||
                            'Configure Google Cloud Storage settings for backup files'}
                        </Typography.Text>
                      </div>
                      <Form.Item
                        name="gcsPath"
                        label={intl.formatMessage({ id: 'pages.backup.form.gcsPath' })}
                        rules={[
                          {
                            required: true,
                            message: intl.formatMessage({
                              id: 'pages.backup.form.gcsPath.required',
                            }),
                          },
                        ]}
                        tooltip={intl.formatMessage({ id: 'pages.backup.form.gcsPath.tooltip' })}
                      >
                        <Input
                          placeholder={intl.formatMessage({
                            id: 'pages.backup.form.gcsPath.placeholder',
                          })}
                        />
                      </Form.Item>

                      <Form.Item
                        name="fileNamePattern"
                        label={intl.formatMessage({ id: 'pages.backup.form.fileNamePattern' })}
                        rules={[
                          {
                            required: true,
                            message: intl.formatMessage({
                              id: 'pages.backup.form.fileNamePattern.required',
                            }),
                          },
                          {
                            validator: (_, value) => {
                              if (!value) return Promise.resolve();
                              try {
                                new RegExp(value);
                                return Promise.resolve();
                              } catch (error) {
                                return Promise.reject(
                                  new Error(
                                    intl.formatMessage({
                                      id: 'pages.backup.form.fileNamePattern.invalid',
                                    }),
                                  ),
                                );
                              }
                            },
                          },
                        ]}
                        tooltip={intl.formatMessage({
                          id: 'pages.backup.form.fileNamePattern.tooltip',
                        })}
                      >
                        <Input
                          placeholder={intl.formatMessage({
                            id: 'pages.backup.form.fileNamePattern.placeholder',
                          })}
                          onMouseEnter={(e) => {
                            // 当鼠标悬停时显示正则表达式匹配示例
                            const pattern = (e.target as HTMLInputElement).value;
                            if (pattern) {
                              try {
                                const regex = new RegExp(pattern);
                                const examples = [
                                  'backup_2024-01-15_user_data.json',
                                  'backup_2024-01-15_product_catalog.json',
                                  'backup_2024-01-15_order_history.json',
                                  'sync_2024-01-15_logs.csv',
                                  'export_2024-01-15_analytics.bson',
                                ];
                                const matches = examples.filter((example) => regex.test(example));
                                if (matches.length > 0) {
                                  console.log('匹配的文件名示例:', matches);
                                }
                              } catch (error) {
                                console.log('正则表达式无效');
                              }
                            }
                          }}
                        />
                      </Form.Item>
                    </div>
                  </Tabs.TabPane>
                </Tabs>
              </div>
            )}
          </div>
        </StepsForm.StepForm>
      </StepsForm>
    </div>
  );
};

// 修改最后的导出部分
const BackupPage: React.FC = () => {
  return (
    <div className="backup-container">
      <JobList />
    </div>
  );
};

export default BackupPage;
