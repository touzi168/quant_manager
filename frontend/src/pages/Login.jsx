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
      }}
    >
      <Card
        title={
          <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 'bold' }}>
            量化监控系统
          </div>
        }
        style={{ width: 400 }}
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
              prefix={<UserOutlined />}
              placeholder="邮箱"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
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
                prefix={<SafetyOutlined />}
                placeholder="Google验证码（6位）"
                size="large"
                maxLength={6}
              />
            </Form.Item>
          )}

          {error && (
            <div style={{ color: 'red', marginBottom: 16, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
            >
              {showGoogleCode ? '验证登录' : '登录'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Space>
              <Link to="/register">注册账号</Link>
              <span>|</span>
              <Link to="/forgot-password">忘记密码</Link>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
}

export default Login;

