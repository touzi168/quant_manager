import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Spin, message, Button } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import api from '../store/api';

function UserDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState([]);

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const response = await api.get('/user/dashboard/strategies');
      if (response.data.success) {
        setStrategies(response.data.data);
      }
    } catch (error) {
      message.error('获取策略列表失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>我的策略</h1>
      
      {strategies.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
            暂无可用策略，请联系管理员分配权限
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {strategies.map((strategy) => (
            <Col xs={24} sm={12} lg={8} key={strategy.id}>
              <Card
                title={strategy.name}
                extra={
                  <Button
                    type="link"
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(`/strategy/${strategy.id}`)}
                  >
                    查看详情
                  </Button>
                }
                hoverable
              >
                <p style={{ color: '#666', marginBottom: 8 }}>
                  {strategy.description || '暂无描述'}
                </p>
                <p style={{ fontSize: 12, color: '#999' }}>
                  账户: {strategy.accountEmail}
                </p>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}

export default UserDashboard;

