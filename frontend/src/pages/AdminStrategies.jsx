import { useEffect, useState } from 'react';
import { Table, Button, message, Modal, Form, Input, InputNumber, Select, Switch, Space, Popconfirm, Dropdown, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../store/api';

const { Option } = Select;
const { TextArea } = Input;

function AdminStrategies() {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [form] = Form.useForm();
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    exchange: true,
    accountEmail: true,
    tradeType: true,
    isMain: true,
    isUnified: true,
    isActive: false,
    hedgeSell: false,
    strategy: true,
    offset: true,
    host: true,
    period: true,
    minFound: false,
    days: false,
    apiKey: false,
    secret: false,
    description: false,
    createdAt: false,
    updatedAt: false,
    action: true,
  });

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/strategies');
      if (response.data.success) {
        setStrategies(response.data.data);
      }
    } catch (error) {
      message.error('获取策略列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingStrategy(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingStrategy(record);
    form.setFieldsValue({
      name: record.name,
      exchange: record.exchange,
      accountEmail: record.accountEmail,
      isMain: record.isMain ? true : false,
      isUnified: record.isUnified ? true : false,
      isActive: record.isActive ? true : false,
      strategy: record.strategy,
      offset: record.offset,
      host: record.host,
      period: record.period,
      tradeType: record.tradeType,
      minFound: record.minFound,
      days: record.days,
      hedgeSell: record.hedgeSell ? true : false,
      apiKey: record.apiKey,
      secret: record.secret,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/strategies/${id}`);
      message.success('策略删除成功');
      fetchStrategies();
    } catch (error) {
      message.error(error.response?.data?.detail || '策略删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        exchange: values.exchange,
        account_email: values.accountEmail,
        is_main: values.isMain ? 1 : 0,
        is_unified: values.isUnified ? 1 : 0,
        is_active: values.isActive,
        strategy: values.strategy,
        offset: values.offset,
        host: values.host,
        period: values.period,
        trade_type: values.tradeType,
        min_found: values.minFound !== undefined && values.minFound !== null ? Number(values.minFound) : null,
        days: values.days !== undefined && values.days !== null ? Number(values.days) : null,
        hedge_sell: values.hedgeSell ? 1 : 0,
        api_key: values.apiKey,
        secret: values.secret,
        description: values.description,
      };

      if (editingStrategy) {
        await api.put(`/admin/strategies/${editingStrategy.id}`, payload);
        message.success('策略更新成功');
      } else {
        await api.post('/admin/strategies', payload);
        message.success('策略创建成功');
      }
      
      setModalVisible(false);
      form.resetFields();
      fetchStrategies();
    } catch (error) {
      message.error(error.response?.data?.detail || '操作失败');
    }
  };

  const allColumns = [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      align: 'center',
    },
    {
      title: '交易所',
      dataIndex: 'exchange',
      key: 'exchange',
      align: 'center',
      render: (text) => {
        const map = { binance: '币安', okex: '欧易' };
        return map[text] || text;
      },
    },
    {
      title: '账户邮箱',
      dataIndex: 'accountEmail',
      key: 'accountEmail',
      align: 'center',
    },
    {
      title: '交易类型',
      dataIndex: 'tradeType',
      key: 'tradeType',
      align: 'center',
      render: (text) => {
        const map = { swap: '合约', spot: '现货', mixed: '混合' };
        return map[text] || text;
      },
    },
    {
      title: '是否主账户',
      dataIndex: 'isMain',
      key: 'isMain',
      align: 'center',
      render: (value) => (value ? '是' : '否'),
    },
    {
      title: '统一账户',
      dataIndex: 'isUnified',
      key: 'isUnified',
      align: 'center',
      render: (value) => (value ? '是' : '否'),
    },
    {
      title: '是否激活',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center',
      render: (value) => (value ? '是' : '否'),
    },
    {
      title: '屯币卖出',
      dataIndex: 'hedgeSell',
      key: 'hedgeSell',
      align: 'center',
      render: (value) => (value ? '是' : '否'),
    },
    {
      title: '执行的策略',
      dataIndex: 'strategy',
      key: 'strategy',
      align: 'center',
    },
    {
      title: '运行的offsets',
      dataIndex: 'offset',
      key: 'offset',
      align: 'center',
    },
    {
      title: '运行的主机',
      dataIndex: 'host',
      key: 'host',
      align: 'center',
    },
    {
      title: '周期',
      dataIndex: 'period',
      key: 'period',
      align: 'center',
    },
    {
      title: '最小资金',
      dataIndex: 'minFound',
      key: 'minFound',
      align: 'center',
    },
    {
      title: '天数',
      dataIndex: 'days',
      key: 'days',
      align: 'center',
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      align: 'center',
      render: (text) => text ? '***' : '-',
    },
    {
      title: 'Secret',
      dataIndex: 'secret',
      key: 'secret',
      align: 'center',
      render: (text) => text ? '***' : '-',
    },
    {
      title: '策略描述',
      dataIndex: 'description',
      key: 'description',
      align: 'center',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center',
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      align: 'center',
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个策略吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 根据visibleColumns过滤显示的列
  const columns = allColumns.filter(col => {
    if (col.key === 'action') return true; // 操作列始终显示
    return visibleColumns[col.key] !== false;
  });

  // 列设置菜单
  const columnMenuItems = allColumns
    .filter(col => col.key !== 'action') // 操作列始终显示
    .map(col => ({
      key: col.key,
      label: (
        <Checkbox
          checked={visibleColumns[col.key] !== false}
          onChange={(e) => {
            setVisibleColumns({
              ...visibleColumns,
              [col.key]: e.target.checked,
            });
          }}
        >
          {col.title}
        </Checkbox>
      ),
    }));

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>策略管理</h1>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchStrategies}
            loading={loading}
          >
            刷新
          </Button>
          <Dropdown
            menu={{ items: columnMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button icon={<SettingOutlined />}>
              列设置
            </Button>
          </Dropdown>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            新增策略
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={strategies}
        rowKey="id"
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title={editingStrategy ? '编辑策略' : '新增策略'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={800}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            isMain: false,
            isUnified: false,
            isActive: true,
            hedgeSell: true,
          }}
        >
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="请输入策略名称" />
          </Form.Item>

          <Form.Item
            name="exchange"
            label="交易所"
            rules={[{ required: true, message: '请选择交易所' }]}
          >
            <Select placeholder="请选择交易所">
              <Option value="binance">币安</Option>
              <Option value="okex">欧易</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="accountEmail"
            label="账户邮箱"
            rules={[
              { required: true, message: '请输入账户邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入账户邮箱" />
          </Form.Item>

          <Form.Item
            name="tradeType"
            label="交易类型"
          >
            <Select placeholder="请选择交易类型">
              <Option value="swap">合约</Option>
              <Option value="spot">现货</Option>
              <Option value="mixed">混合</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isMain"
            label="是否主账户"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isUnified"
            label="统一账户"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="是否激活"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="hedgeSell"
            label="屯币卖出"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="strategy"
            label="执行的策略"
          >
            <Input placeholder="请输入执行的策略" />
          </Form.Item>

          <Form.Item
            name="offset"
            label="运行的offsets"
          >
            <Input placeholder="请输入offsets" />
          </Form.Item>

          <Form.Item
            name="host"
            label="运行的主机"
          >
            <Input placeholder="请输入主机" />
          </Form.Item>

          <Form.Item
            name="period"
            label="周期"
          >
            <Input placeholder="请输入周期" />
          </Form.Item>

          <Form.Item
            name="minFound"
            label="最小资金"
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入最小资金" min={0} />
          </Form.Item>

          <Form.Item
            name="days"
            label="天数"
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入天数" min={0} />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API Key"
          >
            <Input placeholder="请输入API Key" />
          </Form.Item>

          <Form.Item
            name="secret"
            label="Secret"
          >
            <Input.Password placeholder="请输入Secret" />
          </Form.Item>

          <Form.Item
            name="description"
            label="策略描述"
          >
            <TextArea rows={4} placeholder="请输入策略描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AdminStrategies;

