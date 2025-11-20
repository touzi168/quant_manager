import { useEffect, useState } from 'react';
import { Card, Row, Col, Spin, message, Statistic } from 'antd';
import { DollarOutlined, BarChartOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../store/api';
import EquityCurveChart from '../components/EquityCurveChart';

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard/summary');
      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (error) {
      message.error('获取数据失败');
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
      <h1 style={{ marginBottom: 24 }}>管理员仪表板</h1>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="总资产"
              value={summary?.totalAssets || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="策略数量"
              value={summary?.strategyCount || 0}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="活跃进程"
              value={summary?.activeProcessCount || 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <EquityCurveChart strategyId={null} isAdmin={true} />
    </div>
  );
}

export default AdminDashboard;

