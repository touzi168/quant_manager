import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, message, Space } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';

function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);
  const [form] = Form.useForm();
  const [showGoogleCode, setShowGoogleCode] = useState(false);

  const onFinish = async (values) => {
    try {
      const result = await dispatch(login(values)).unwrap();
      if (result) {
        message.success('登录成功');
        navigate('/dashboard');
      }
    } catch (err) {
      // 如果错误信息包含"需要Google验证码"，显示Google验证码输入框
      if (err && err.includes && err.includes('Google验证码')) {
        setShowGoogleCode(true);
        message.warning('请输入Google验证码');
      } else {
        message.error(err || '登录失败');
      }
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '20px',
      }}
    >
      {/* 装饰性背景元素 */}
      <div
        style={{
          position: 'absolute',
          top: '-100px',
          left: '-100px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          filter: 'blur(80px)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-150px',
          right: '-150px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          filter: 'blur(100px)',
          zIndex: 0,
        }}
      />
      
      <style>{`
        .login-card .ant-input-affix-wrapper,
        .login-card .ant-input {
          transition: all 0.3s ease !important;
        }
        .login-card .ant-input-affix-wrapper:focus,
        .login-card .ant-input-affix-wrapper-focused,
        .login-card .ant-input:focus {
          border-color: #667eea !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15) !important;
        }
        .login-card .ant-input-affix-wrapper:hover,
        .login-card .ant-input:hover {
          border-color: #8b5cf6 !important;
        }
      `}</style>
      <Card
        className="login-card"
        title={
          <div style={{ 
            textAlign: 'center', 
            fontSize: 28, 
            fontWeight: 700, 
            color: '#0f172a',
            marginBottom: 8,
            letterSpacing: '0.02em',
          }}>
            量化监控系统
          </div>
        }
        style={{ 
          width: 420,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)',
          border: 'none',
          position: 'relative',
          zIndex: 1,
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
        }}
        bodyStyle={{ padding: '40px 32px' }}
        headStyle={{
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          padding: '24px 32px 16px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
          borderRadius: '16px 16px 0 0',
        }}
      >
        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#667eea' }} />}
              placeholder="请输入邮箱地址"
              size="large"
              style={{
                borderRadius: 10,
                height: 48,
                fontSize: 15,
                paddingLeft: 16,
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#667eea' }} />}
              placeholder="请输入密码"
              size="large"
              style={{
                borderRadius: 10,
                height: 48,
                fontSize: 15,
                paddingLeft: 16,
              }}
            />
          </Form.Item>

          {showGoogleCode && (
            <Form.Item
              name="googleCode"
              rules={[
                { required: true, message: '请输入Google验证码' },
                { len: 6, message: '验证码必须是6位数字' },
              ]}
            >
              <Input
                prefix={<SafetyOutlined style={{ color: '#667eea' }} />}
                placeholder="Google验证码（6位）"
                size="large"
                maxLength={6}
                style={{
                  borderRadius: 10,
                  height: 48,
                  fontSize: 15,
                  paddingLeft: 16,
                }}
              />
            </Form.Item>
          )}

          {error && (
            <div style={{ 
              color: '#ef4444', 
              marginBottom: 16, 
              textAlign: 'center',
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <Form.Item style={{ marginBottom: 8, marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{
                height: 48,
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
              }}
            >
              {showGoogleCode ? '验证登录' : '登录'}
            </Button>
          </Form.Item>

          <div style={{ 
            textAlign: 'center', 
            marginTop: 24,
            paddingTop: 24,
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
          }}>
            <Space size="middle">
              <Link 
                to="/register" 
                style={{ 
                  color: '#667eea', 
                  fontWeight: 500,
                  fontSize: 14,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#764ba2';
                  e.target.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#667eea';
                  e.target.style.textDecoration = 'none';
                }}
              >
                注册账号
              </Link>
              <span style={{ color: '#cbd5e1', fontSize: 14 }}>|</span>
              <Link 
                to="/forgot-password" 
                style={{ 
                  color: '#667eea', 
                  fontWeight: 500,
                  fontSize: 14,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#764ba2';
                  e.target.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#667eea';
                  e.target.style.textDecoration = 'none';
                }}
              >
                忘记密码
              </Link>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
}

export default Login;

