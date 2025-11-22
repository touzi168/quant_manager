import { useEffect, useState } from 'react';
import { Table, Button, message, Modal, Form, Input, Select, Space } from 'antd';
import api from '../store/api';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [pagination.current, pagination.pageSize]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/admin/users?page=${pagination.current}&page_size=${pagination.pageSize}`
      );
      if (response.data.success) {
        setUsers(response.data.data.list);
        setPagination({
          ...pagination,
          total: response.data.data.pagination.total,
        });
      }
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    // 将数据库返回的 0/1 转换为表单需要的格式
    // 如果 isActive 是布尔值，直接使用；如果是 0/1，转换为布尔值
    const isActiveValue = typeof user.isActive === 'boolean' ? user.isActive : Boolean(user.isActive);
    form.setFieldsValue({
      nickname: user.nickname,
      role: user.role,
      isActive: isActiveValue,
    });
    setModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      // 将前端字段名转换为后端API期望的格式
      const payload = {
        nickname: values.nickname,
        role: values.role,
        is_active: values.isActive, // 转换为snake_case
      };
      await api.put(`/admin/users/${editingUser.id}`, payload);
      message.success('更新成功');
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      console.error('更新用户失败:', error);
      const errorMessage = error.response?.data?.detail || error.message || '更新失败';
      message.error(errorMessage);
    }
  };

  const handleDelete = async (userId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该用户吗？',
      onOk: async () => {
        try {
          await api.delete(`/admin/users/${userId}`);
          message.success('删除成功');
          fetchUsers();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
    { title: '角色', dataIndex: 'role', key: 'role' },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (isActive ? '激活' : '未激活'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <style>{`
        .admin-users-table .ant-table-thead > tr > th {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
          border-bottom: 2px solid #cbd5e1 !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          padding: 12px 16px !important;
          font-size: 13px !important;
        }
        .admin-users-table .ant-table-tbody > tr > td {
          padding: 12px 16px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          transition: all 0.2s ease !important;
        }
        .admin-users-table .ant-table-tbody > tr:nth-child(even) {
          background: #ffffff !important;
        }
        .admin-users-table .ant-table-tbody > tr:nth-child(odd) {
          background: #f8fafc !important;
        }
        .admin-users-table .ant-table-tbody > tr:hover {
          background: #e0f2fe !important;
          transform: scale(1.01);
          box-shadow: 0 2px 8px rgba(29, 155, 240, 0.15);
        }
      `}</style>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 12,
      }}>
        <h1 style={{ 
          margin: 0,
          color: '#fff',
          fontSize: 24,
          fontWeight: 700,
        }}>
          用户管理
        </h1>
      </div>
      <Table
        className="admin-users-table"
        style={{
          borderRadius: 8,
          overflow: 'hidden',
        }}
        columns={columns.map(col => {
          const baseCol = {
            ...col,
            title: typeof col.title === 'string' ? <span style={{ fontWeight: 600, color: '#0f172a' }}>{col.title}</span> : col.title,
          };
          if (!col.render) {
            baseCol.render = (text) => text ? <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span> : '-';
          }
          return baseCol;
        })}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, current: page, pageSize });
          },
        }}
      />

      <Modal
        title="编辑用户"
        open={modalVisible}
        onOk={handleUpdate}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="nickname" label="昵称">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select>
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="user">用户</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isActive" label="状态">
            <Select placeholder="请选择状态">
              <Select.Option value={true}>激活</Select.Option>
              <Select.Option value={false}>未激活</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AdminUsers;

