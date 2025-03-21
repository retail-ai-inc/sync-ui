import React, { useState, useEffect } from 'react';
import { Card, Select, Input, Button, Table, Space, message, Row, Col, Divider, Tag } from 'antd';
import { fetchSyncList } from '@/services/ant-design-pro/sync';
import { executeSql } from '@/services/ant-design-pro/sql';
import { useIntl } from '@umijs/max';
import { PlayCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

const SqlDebug: React.FC = () => {
  const intl = useIntl();
  const [syncList, setSyncList] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [sourceData, setSourceData] = useState<any>(null);
  const [targetData, setTargetData] = useState<any>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // 加载同步任务列表
  useEffect(() => {
    const loadSyncTasks = async () => {
      setLoading(true);
      try {
        const res = await fetchSyncList();
        if (res.success) {
          setSyncList(res.data);
          if (res.data.length > 0) {
            setSelectedTaskId(res.data[0].id);
            setSelectedTask(res.data[0]);
          }
        }
      } catch (error) {
        message.error(intl.formatMessage({ id: 'pages.sqlDebug.loadTasksFailed' }));
        console.error('加载同步任务失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSyncTasks();
  }, [intl]);

  // 处理任务选择变化
  const handleTaskChange = (taskId: number) => {
    setSelectedTaskId(taskId);
    const task = syncList.find((item) => item.id === taskId);
    setSelectedTask(task);
    // 清空之前的结果
    setSourceData(null);
    setTargetData(null);
  };

  // 处理SQL输入变化
  const handleSqlChange = (value: string) => {
    setSqlQuery(value);
  };

  // 执行SQL查询
  const executeQuery = async (target: boolean = false) => {
    if (!selectedTaskId) {
      message.warning(intl.formatMessage({ id: 'pages.sqlDebug.selectTaskFirst' }));
      return;
    }

    if (!sqlQuery.trim()) {
      message.warning(intl.formatMessage({ id: 'pages.sqlDebug.enterSqlFirst' }));
      return;
    }

    // 设置对应的加载状态
    if (target) {
      setLoadingTarget(true);
    } else {
      setLoadingSource(true);
    }

    try {
      const res = await executeSql({
        taskId: selectedTaskId,
        sql: sqlQuery,
        target: target,
      });

      console.log('API response:', res);

      if (res.success) {
        if (target) {
          setTargetData(res.data);
        } else {
          setSourceData(res.data);
        }
        message.success(
          target
            ? intl.formatMessage({ id: 'pages.sqlDebug.targetQuerySuccess' })
            : intl.formatMessage({ id: 'pages.sqlDebug.sourceQuerySuccess' }),
        );
      } else {
        message.error(
          target
            ? intl.formatMessage({ id: 'pages.sqlDebug.targetQueryFailed' })
            : intl.formatMessage({ id: 'pages.sqlDebug.sourceQueryFailed' }),
        );
      }
    } catch (error) {
      message.error(
        target
          ? intl.formatMessage({ id: 'pages.sqlDebug.targetQueryError' })
          : intl.formatMessage({ id: 'pages.sqlDebug.sourceQueryError' }),
      );
      console.error('执行SQL出错:', error);
    } finally {
      if (target) {
        setLoadingTarget(false);
      } else {
        setLoadingSource(false);
      }
    }
  };

  // 执行源和目标数据库查询
  const executeQueryBoth = async () => {
    await executeQuery(false);
    await executeQuery(true);
  };

  // 判断是否为MongoDB数据源
  const isMongoDB = (sourceType?: string) => {
    return sourceType?.toLowerCase().includes('mongo');
  };

  // 添加检测Redis数据源的函数
  const isRedis = (sourceType?: string) => {
    return sourceType?.toLowerCase().includes('redis');
  };

  // 添加检测PostgreSQL数据源的函数
  const isPostgreSQL = (sourceType?: string) => {
    return (
      sourceType?.toLowerCase().includes('postgres') ||
      sourceType?.toLowerCase().includes('postgresql')
    );
  };

  // 生成查询模板SQL
  const generateSelectSql = () => {
    if (isRedis(selectedTask?.sourceType)) {
      setSqlQuery(''); // 清空输入框
      message.info(intl.formatMessage({ id: 'pages.sqlDebug.redisNotSupported' }));
      return;
    }

    if (isMongoDB(selectedTask?.sourceType)) {
      setSqlQuery(`db.users.find({}).sort({_id: -1}).limit(100)`);
    } else {
      setSqlQuery(`SELECT * FROM users 
ORDER BY id DESC 
LIMIT 100;`);
    }
  };

  // 生成插入模板SQL
  const generateInsertSql = () => {
    if (isRedis(selectedTask?.sourceType)) {
      setSqlQuery(''); // 清空输入框
      message.info(intl.formatMessage({ id: 'pages.sqlDebug.redisNotSupported' }));
      return;
    }

    if (isMongoDB(selectedTask?.sourceType)) {
      setSqlQuery(`let count = 5;
let maxId = db.users.find().sort({ id: -1 }).limit(1).next()?.id || 0;
let docs = [];
for (let i = 1; i <= count; i++) {
    let newId = maxId + i;
    docs.push({
        name: "user" + newId,
        email: "user" + newId + "@example.com"
    });
}
db.users.insertMany(docs);`);
    } else {
      setSqlQuery(`INSERT INTO users (name, email)
SELECT 
    CONCAT('user', COALESCE((SELECT MAX(id) FROM users), 0) + ROW_NUMBER() OVER ()),
    CONCAT('user', COALESCE((SELECT MAX(id) FROM users), 0) + ROW_NUMBER() OVER (), '@example.com')
FROM users
LIMIT 5;
;`);
    }
  };

  // 修改生成更新模板SQL函数
  const generateUpdateSql = () => {
    if (isRedis(selectedTask?.sourceType)) {
      setSqlQuery(''); // 清空输入框
      message.info(intl.formatMessage({ id: 'pages.sqlDebug.redisNotSupported' }));
      return;
    }

    if (isMongoDB(selectedTask?.sourceType)) {
      setSqlQuery(`var newEmail = "updated_" + new Date().getTime() + "@mail.com";
var ids = db.users.find().sort({ _id: -1 }).limit(5).toArray().map(function(doc) { return doc._id; });
db.users.updateMany({ _id: { $in: ids } }, { $set: { email: newEmail } });`);
    } else if (isPostgreSQL(selectedTask?.sourceType)) {
      // PostgreSQL 特定的更新语句
      setSqlQuery(`UPDATE users 
SET email = CONCAT('updated_', id, '@mail.com')
WHERE id IN (
  SELECT id FROM users ORDER BY id DESC LIMIT 5
);`);
    } else {
      // MySQL 和其他关系型数据库的更新语句
      setSqlQuery(`UPDATE users
JOIN (
    SELECT id FROM users ORDER BY id DESC LIMIT 5
) AS subquery ON users.id = subquery.id
SET users.email = CONCAT('updated_', users.id, '@mail.com');`);
    }
  };

  // 生成删除模板SQL
  const generateDeleteSql = () => {
    if (isRedis(selectedTask?.sourceType)) {
      setSqlQuery(''); // 清空输入框
      message.info(intl.formatMessage({ id: 'pages.sqlDebug.redisNotSupported' }));
      return;
    }

    if (isMongoDB(selectedTask?.sourceType)) {
      setSqlQuery(`var ids = db.users.find().sort({ _id: -1 }).limit(5).toArray().map(function(doc) { return doc._id; });
db.users.deleteMany({_id: {$in: ids}});`);
    } else {
      setSqlQuery(`DELETE FROM users 
WHERE id IN (
  SELECT id FROM (
    SELECT id FROM users ORDER BY id DESC LIMIT 5
  ) as tmp
);`);
    }
  };

  // 准备表格列 - 更新以支持MongoDB结果格式
  const getColumns = (data: any) => {
    // 处理MongoDB结果格式 (results数组)
    if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
      // 从第一个文档中提取所有字段名作为列
      const firstDoc = data.results[0];
      const columns = Object.keys(firstDoc).map((key) => ({
        title: key,
        dataIndex: key,
        key: key,
        ellipsis: true,
      }));
      return columns;
    }

    // 处理SQL结果格式 (columns和rows)
    if (data && data.columns && Array.isArray(data.columns)) {
      return data.columns.map((col: string) => ({
        title: col,
        dataIndex: col,
        key: col,
        ellipsis: true,
      }));
    }

    return [];
  };

  // 准备表格数据 - 更新以支持MongoDB结果格式
  const getTableData = (data: any) => {
    // 处理MongoDB结果格式
    if (data && data.results && Array.isArray(data.results)) {
      return data.results.map((doc: any, index: number) => ({
        key: index,
        ...doc,
      }));
    }

    // 处理SQL结果格式
    if (data && data.rows && Array.isArray(data.rows) && data.columns) {
      return data.rows.map((row: any[], index: number) => {
        const rowData: any = { key: index };
        data.columns.forEach((col: string, colIndex: number) => {
          rowData[col] = row[colIndex];
        });
        return rowData;
      });
    }

    return [];
  };

  // 更新渲染非查询结果的函数，使其更灵活地处理各种可能的数据结构
  const renderNonQueryResult = (data: any) => {
    if (!data) return null;

    // 尝试从不同位置获取执行结果信息
    const affectedRows = data.affectedRows || data.result?.affectedRows || '-';
    const executionTime = data.executionTime || data.time || '-';
    const message = data.message || data.msg || data.result?.message || '-';

    return (
      <div className="non-query-result">
        <p>
          {intl.formatMessage({ id: 'pages.sqlDebug.affectedRows' })}: {affectedRows}
        </p>
        <p>
          {intl.formatMessage({ id: 'pages.sqlDebug.executionTime' })}: {executionTime}
        </p>
        <p>
          {intl.formatMessage({ id: 'pages.sqlDebug.message' })}: {message}
        </p>
      </div>
    );
  };

  return (
    <Card title={intl.formatMessage({ id: 'pages.sqlDebug.title' })}>
      {/* 任务选择区域 */}
      <div style={{ marginBottom: 16 }}>
        <Space align="start" size="large" style={{ width: '100%' }}>
          <div>
            <label>{intl.formatMessage({ id: 'pages.sqlDebug.selectTask' })}: </label>
            <Select
              style={{ width: 300 }}
              value={selectedTaskId}
              onChange={handleTaskChange}
              loading={loading}
            >
              {(syncList || []).map((task) => (
                <Option key={task.id} value={task.id}>
                  {task.taskName} ({task.sourceType}: {task.sourceConn?.host}/
                  {task.sourceConn?.database} → {task.targetConn?.host}/{task.targetConn?.database})
                </Option>
              ))}
            </Select>
          </div>

          {selectedTask && (
            <div>
              <Space>
                <span>{intl.formatMessage({ id: 'pages.sqlDebug.source' })}: </span>
                <Tag color="blue">
                  {selectedTask.sourceConn?.host}:{selectedTask.sourceConn?.port}/
                  {selectedTask.sourceConn?.database}
                </Tag>
                <span>{intl.formatMessage({ id: 'pages.sqlDebug.target' })}: </span>
                <Tag color="green">
                  {selectedTask.targetConn?.host}:{selectedTask.targetConn?.port}/
                  {selectedTask.targetConn?.database}
                </Tag>
              </Space>
            </div>
          )}
        </Space>
      </div>

      <Divider />

      {/* SQL模板和编辑区域 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Space>
            <span>{intl.formatMessage({ id: 'pages.sqlDebug.templates' })}:</span>
            <Button onClick={generateSelectSql} type="default">
              {intl.formatMessage({ id: 'pages.sqlDebug.select' })}
            </Button>
            <Button onClick={generateInsertSql} type="default">
              {intl.formatMessage({ id: 'pages.sqlDebug.insert' })}
            </Button>
            <Button onClick={generateUpdateSql} type="default">
              {intl.formatMessage({ id: 'pages.sqlDebug.update' })}
            </Button>
            <Button onClick={generateDeleteSql} type="default">
              {intl.formatMessage({ id: 'pages.sqlDebug.delete' })}
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Input.TextArea
            value={sqlQuery}
            onChange={(e) => handleSqlChange(e.target.value)}
            rows={6}
            style={{ width: '100%', fontFamily: 'monospace' }}
            placeholder="SELECT * FROM users LIMIT 100"
          />
        </div>

        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => executeQuery(false)}
            loading={loadingSource}
          >
            {intl.formatMessage({ id: 'pages.sqlDebug.executeSource' })}
          </Button>
          <Button type="primary" onClick={() => executeQuery(true)} loading={loadingTarget}>
            {intl.formatMessage({ id: 'pages.sqlDebug.executeTarget' })}
          </Button>
          <Button onClick={executeQueryBoth} loading={loadingSource || loadingTarget}>
            {intl.formatMessage({ id: 'pages.sqlDebug.executeBoth' })}
          </Button>
        </Space>
      </div>

      <Divider />

      {/* 结果显示区域 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={intl.formatMessage({ id: 'pages.sqlDebug.sourceResult' })}
            loading={loadingSource}
            style={{ marginBottom: 16 }}
          >
            {(sourceData && sourceData.columns) || (sourceData && sourceData.results) ? (
              <Table
                columns={getColumns(sourceData)}
                dataSource={getTableData(sourceData)}
                size="small"
                scroll={{ x: 'max-content' }}
                pagination={{ pageSize: 5 }}
              />
            ) : sourceData ? (
              renderNonQueryResult(sourceData)
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                {intl.formatMessage({ id: 'pages.sqlDebug.noResult' })}
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={intl.formatMessage({ id: 'pages.sqlDebug.targetResult' })}
            loading={loadingTarget}
            style={{ marginBottom: 16 }}
          >
            {(targetData && targetData.columns) || (targetData && targetData.results) ? (
              <Table
                columns={getColumns(targetData)}
                dataSource={getTableData(targetData)}
                size="small"
                scroll={{ x: 'max-content' }}
                pagination={{ pageSize: 5 }}
              />
            ) : targetData ? (
              renderNonQueryResult(targetData)
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                {intl.formatMessage({ id: 'pages.sqlDebug.noResult' })}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default SqlDebug;
