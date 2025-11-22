import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { register } from '../store/slices/authSlice';

function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    try {
      await dispatch(register(values)).unwrap();
      message.success('注册成功，请查收邮件验证邮箱');
      navigate('/login');
    } catch (err) {
      message.error(err || '注册失败');
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
        padding: '40px 16px',
      }}
    >
      <Card 
        title={
          <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
            用户注册
          </div>
        }
        style={{ 
          width: 450,
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        }}
        bodyStyle={{ padding: '32px' }}
      >
        <Form
          form={form}
          name="register"
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
              prefix={<MailOutlined />}
              placeholder="邮箱"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="nickname"
            rules={[{ max: 100, message: '昵称长度不能超过100字符' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="昵称（可选）"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码长度至少8位' },
            ]}
            help="密码至少8位，包含大小写字母、数字和特殊字符"
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
            >
              注册
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/login" style={{ color: '#667eea', fontWeight: 500 }}>已有账号？立即登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}

export default Register;

