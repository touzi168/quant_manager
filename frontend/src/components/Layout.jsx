import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Space } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  TeamOutlined,
  SafetyOutlined,
  BarChartOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';

const { Header, Sider, Content } = AntLayout;

function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const isAdmin = user?.role === 'admin';

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '我的面板',
      show: true,
    },
    {
      key: '/admin',
      icon: <BarChartOutlined />,
      label: '管理员面板',
      show: isAdmin,
    },
    {
      key: '/admin/users',
      icon: <TeamOutlined />,
      label: '用户管理',
      show: isAdmin,
    },
    {
      key: '/admin/permissions',
      icon: <SafetyOutlined />,
      label: '权限管理',
      show: isAdmin,
    },
    {
      key: '/admin/strategies',
      icon: <AppstoreOutlined />,
      label: '策略管理',
      show: isAdmin,
    },
  ].filter((item) => item.show);

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        style={{
          background: '#0f172a',
        }}
      >
        <div
          style={{
            height: 52,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: collapsed ? 14 : 16,
            letterSpacing: '0.08em',
            transition: 'all 0.3s ease',
          }}
        >
          {collapsed ? '量化' : '量化监控系统'}
        </div>
        <style>{`
          .ant-layout-sider {
            background: #0f172a !important;
          }
          .ant-layout-sider .ant-menu {
            background: transparent !important;
            border-right: none !important;
          }
          .ant-layout-sider .ant-menu-item {
            color: #ffffff !important;
            font-weight: 500 !important;
            font-size: 14px !important;
            box-shadow: none !important;
          }
          .ant-layout-sider .ant-menu-item:hover {
            background: rgba(255, 255, 255, 0.12) !important;
            color: #ffffff !important;
            box-shadow: none !important;
          }
          .ant-layout-sider .ant-menu-item-selected {
            background: rgba(29, 155, 240, 0.2) !important;
            color: #ffffff !important;
            font-weight: 600 !important;
            border-right: none !important;
            box-shadow: none !important;
          }
          .ant-layout-sider .ant-menu-item::after {
            display: none !important;
          }
          .ant-layout-sider .ant-menu-item-icon {
            color: #ffffff !important;
            font-size: 16px !important;
          }
          .ant-layout-sider .ant-menu-item-selected .ant-menu-item-icon {
            color: #ffffff !important;
          }
          .ant-layout-sider .ant-layout-sider-trigger {
            background: rgba(255, 255, 255, 0.08) !important;
            color: #ffffff !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
          }
          .ant-layout-sider .ant-layout-sider-trigger:hover {
            background: rgba(255, 255, 255, 0.15) !important;
            color: #ffffff !important;
          }
        `}</style>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            borderRight: 'none',
          }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
            量化监控系统
          </div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span style={{ color: '#334155', fontWeight: 500 }}>{user?.email}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: '24px',
            padding: 0,
            background: 'transparent',
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
}

export default Layout;

