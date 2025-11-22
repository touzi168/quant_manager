import { useEffect, useState } from 'react';
import { Table, Button, message, Modal, Form, Select, Space } from 'antd';
import api from '../store/api';

function AdminPermissions() {
  const [strategies, setStrategies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]); // 存储所有权限
  const [permissions, setPermissions] = useState([]); // 当前显示的权限
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchStrategies();
    fetchUsers();
    fetchAllPermissions(); // 默认加载所有权限
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

  // 获取所有权限（遍历所有策略）
  const fetchAllPermissions = async () => {
    try {
      setLoading(true);
      const strategiesResponse = await api.get('/admin/strategies');
      if (!strategiesResponse.data.success) {
        return;
      }
      
      const allStrategies = strategiesResponse.data.data;
      
      // 遍历所有策略，获取每个策略的权限
      const permissionPromises = allStrategies.map(async (strategy) => {
        try {
          const permResponse = await api.get(`/admin/strategies/${strategy.id}/users`);
          if (permResponse.data.success && permResponse.data.data) {
            // 为每个权限添加策略信息
            return permResponse.data.data.map(perm => ({
              ...perm,
              strategyId: strategy.id,
              strategyName: strategy.name,
            }));
          }
          return [];
        } catch (error) {
          console.error(`获取策略 ${strategy.id} 的权限失败:`, error);
          return [];
        }
      });
      
      const allPermissionsResults = await Promise.all(permissionPromises);
      const allPerms = allPermissionsResults.flat();
      
      setAllPermissions(allPerms);
      // 如果没有选择策略，显示所有权限；如果已选择，则过滤
      if (selectedStrategy) {
        const filteredPerms = allPerms.filter(perm => perm.strategyId === selectedStrategy);
        setPermissions(filteredPerms);
      } else {
        setPermissions(allPerms);
      }
    } catch (error) {
      console.error('获取所有权限失败:', error);
      message.error('获取权限列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async (strategyId) => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/strategies/${strategyId}/users`);
      if (response.data.success) {
        setPermissions(response.data.data || []);
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
      // 如果选择了策略，过滤显示该策略的权限
      const filteredPerms = allPermissions.filter(perm => perm.strategyId === strategyId);
      setPermissions(filteredPerms);
    } else {
      // 如果清空选择（null/undefined），显示所有权限
      setPermissions(allPermissions);
    }
  };

  const handleAddPermission = async () => {
    try {
      const values = await form.validateFields();
      await api.post(`/admin/strategies/${selectedStrategy}/users`, values);
      message.success('权限分配成功');
      setModalVisible(false);
      form.resetFields();
      // 重新获取所有权限并更新显示
      const strategiesResponse = await api.get('/admin/strategies');
      if (strategiesResponse.data.success) {
        const allStrategies = strategiesResponse.data.data;
        const permissionPromises = allStrategies.map(async (strategy) => {
          try {
            const permResponse = await api.get(`/admin/strategies/${strategy.id}/users`);
            if (permResponse.data.success && permResponse.data.data) {
              return permResponse.data.data.map(perm => ({
                ...perm,
                strategyId: strategy.id,
                strategyName: strategy.name,
              }));
            }
            return [];
          } catch (error) {
            return [];
          }
        });
        const allPermissionsResults = await Promise.all(permissionPromises);
        const updatedAllPerms = allPermissionsResults.flat();
        setAllPermissions(updatedAllPerms);
        // 如果已选择策略，过滤显示
        if (selectedStrategy) {
          const filteredPerms = updatedAllPerms.filter(perm => perm.strategyId === selectedStrategy);
          setPermissions(filteredPerms);
        } else {
          setPermissions(updatedAllPerms);
        }
      }
    } catch (error) {
      message.error('权限分配失败');
    }
  };

  const handleDeletePermission = async (record) => {
    Modal.confirm({
      title: '确认撤销',
      content: '确定要撤销该用户的权限吗？',
      onOk: async () => {
        try {
          const strategyId = selectedStrategy || record.strategyId;
          await api.delete(`/admin/strategies/${strategyId}/users/${record.userId}`);
          message.success('权限撤销成功');
          // 重新获取所有权限并更新显示
          const strategiesResponse = await api.get('/admin/strategies');
          if (strategiesResponse.data.success) {
            const allStrategies = strategiesResponse.data.data;
            const permissionPromises = allStrategies.map(async (strategy) => {
              try {
                const permResponse = await api.get(`/admin/strategies/${strategy.id}/users`);
                if (permResponse.data.success && permResponse.data.data) {
                  return permResponse.data.data.map(perm => ({
                    ...perm,
                    strategyId: strategy.id,
                    strategyName: strategy.name,
                  }));
                }
                return [];
              } catch (error) {
                return [];
              }
            });
            const allPermissionsResults = await Promise.all(permissionPromises);
            const updatedAllPerms = allPermissionsResults.flat();
            setAllPermissions(updatedAllPerms);
            // 如果已选择策略，过滤显示
            if (selectedStrategy) {
              const filteredPerms = updatedAllPerms.filter(perm => perm.strategyId === selectedStrategy);
              setPermissions(filteredPerms);
            } else {
              setPermissions(updatedAllPerms);
            }
          }
        } catch (error) {
          message.error('权限撤销失败');
        }
      },
    });
  };

  const getColumns = () => {
    const baseColumns = [
      // 只有在显示所有权限时才显示策略名称列
      ...(selectedStrategy ? [] : [{
        title: '策略名称',
        dataIndex: 'strategyName',
        key: 'strategyName',
        render: (text) => text ? <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span> : '-',
      }]),
      { 
        title: '用户邮箱', 
        dataIndex: 'email', 
        key: 'email',
        render: (text) => text ? <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span> : '-',
      },
      { 
        title: '用户昵称', 
        dataIndex: 'nickname', 
        key: 'nickname',
        render: (text) => text ? <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span> : '-',
      },
      { 
        title: '权限类型', 
        dataIndex: 'permissionType', 
        key: 'permissionType',
        render: (text) => {
          const typeMap = { view: '查看', manage: '管理' };
          return <span style={{ fontWeight: 500, color: '#334155' }}>{typeMap[text] || text}</span>;
        },
      },
      {
        title: '操作',
        key: 'action',
        render: (_, record) => (
          <Button
            type="link"
            danger
            onClick={() => handleDeletePermission(record)}
          >
            撤销权限
          </Button>
        ),
      },
    ];
    return baseColumns;
  };

  return (
    <div>
      <style>{`
        .admin-permissions-table .ant-table-thead > tr > th {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
          border-bottom: 2px solid #cbd5e1 !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          padding: 12px 16px !important;
          font-size: 13px !important;
        }
        .admin-permissions-table .ant-table-tbody > tr > td {
          padding: 12px 16px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          transition: all 0.2s ease !important;
        }
        .admin-permissions-table .ant-table-tbody > tr:nth-child(even) {
          background: #ffffff !important;
        }
        .admin-permissions-table .ant-table-tbody > tr:nth-child(odd) {
          background: #f8fafc !important;
        }
        .admin-permissions-table .ant-table-tbody > tr:hover {
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
          权限管理
        </h1>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Select
          style={{ width: 300 }}
          placeholder="选择策略（留空显示全部）"
          allowClear
          value={selectedStrategy}
          onChange={(value) => handleStrategySelect(value || null)}
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
            onClick={() => setModalVisible(true)}
          >
            分配权限
          </Button>
        )}
      </div>

      <Table
        className="admin-permissions-table"
        style={{
          borderRadius: 8,
          overflow: 'hidden',
        }}
        rowClassName={(record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
        columns={getColumns().map(col => ({
          ...col,
          title: typeof col.title === 'string' ? <span style={{ fontWeight: 600, color: '#0f172a' }}>{col.title}</span> : col.title,
        }))}
        dataSource={permissions}
        rowKey={(record) => `${record.strategyId || 'all'}-${record.userId}-${record.id}`}
        loading={loading}
        locale={{
          emptyText: selectedStrategy ? '该策略暂无权限记录' : '暂无权限记录',
        }}
      />

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

