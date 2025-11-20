import { useEffect, useState } from 'react';
import { Table, Button, message, Modal, Form, Select, Space } from 'antd';
import api from '../store/api';

function AdminPermissions() {
  const [strategies, setStrategies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchStrategies();
    fetchUsers();
  }, []);

  const fetchStrategies = async () => {
    try {
      const response = await api.get('/admin/strategies');
      if (response.data.success) {
        setStrategies(response.data.data);
      }
    } catch (error) {
      message.error('获取策略列表失败');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users?page_size=1000');
      if (response.data.success) {
        setUsers(response.data.data.list);
      }
    } catch (error) {
      message.error('获取用户列表失败');
    }
  };

  const fetchPermissions = async (strategyId) => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/strategies/${strategyId}/users`);
      if (response.data.success) {
        setPermissions(response.data.data);
      }
    } catch (error) {
      message.error('获取权限列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStrategySelect = (strategyId) => {
    setSelectedStrategy(strategyId);
    if (strategyId) {
      fetchPermissions(strategyId);
    }
  };

  const handleAddPermission = async () => {
    try {
      const values = await form.validateFields();
      await api.post(`/admin/strategies/${selectedStrategy}/users`, values);
      message.success('权限分配成功');
      setModalVisible(false);
      form.resetFields();
      fetchPermissions(selectedStrategy);
    } catch (error) {
      message.error('权限分配失败');
    }
  };

  const handleDeletePermission = async (userId) => {
    Modal.confirm({
      title: '确认撤销',
      content: '确定要撤销该用户的权限吗？',
      onOk: async () => {
        try {
          await api.delete(`/admin/strategies/${selectedStrategy}/users/${userId}`);
          message.success('权限撤销成功');
          fetchPermissions(selectedStrategy);
        } catch (error) {
          message.error('权限撤销失败');
        }
      },
    });
  };

  const columns = [
    { title: '用户邮箱', dataIndex: 'email', key: 'email' },
    { title: '用户昵称', dataIndex: 'nickname', key: 'nickname' },
    { title: '权限类型', dataIndex: 'permissionType', key: 'permissionType' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          danger
          onClick={() => handleDeletePermission(record.userId)}
        >
          撤销权限
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>权限管理</h1>

      <div style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 300 }}
          placeholder="选择策略"
          onChange={handleStrategySelect}
        >
          {strategies.map((strategy) => (
            <Select.Option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </Select.Option>
          ))}
        </Select>
        {selectedStrategy && (
          <Button
            type="primary"
            style={{ marginLeft: 16 }}
            onClick={() => setModalVisible(true)}
          >
            分配权限
          </Button>
        )}
      </div>

      {selectedStrategy && (
        <Table
          columns={columns}
          dataSource={permissions}
          rowKey="id"
          loading={loading}
        />
      )}

      <Modal
        title="分配策略权限"
        open={modalVisible}
        onOk={handleAddPermission}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="user_id"
            label="用户"
            rules={[{ required: true, message: '请选择用户' }]}
          >
            <Select placeholder="选择用户">
              {users.map((user) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.email} ({user.nickname})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="permission_type"
            label="权限类型"
            rules={[{ required: true, message: '请选择权限类型' }]}
          >
            <Select>
              <Select.Option value="view">查看</Select.Option>
              <Select.Option value="manage">管理</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AdminPermissions;

