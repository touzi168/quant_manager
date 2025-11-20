import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Spin, message, Statistic, Table, Tabs } from 'antd';
import { DollarOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import api from '../store/api';
import EquityCurveChart from '../components/EquityCurveChart';

function StrategyDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchSummary();
  }, [id]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/user/dashboard/summary/${id}`);
      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (error) {
      message.error('获取策略数据失败');
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

  if (!summary) {
    return <div>策略不存在</div>;
  }

  const { strategy, assets, positions, equity } = summary;

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{strategy.name}</h1>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="净实现资金"
              value={equity?.netRealized || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总资金"
              value={equity?.netUnrealized || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总资产"
              value={assets?.totalAssets || 0}
              prefix={<RiseOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="持仓数量"
              value={positions?.length || 0}
              prefix={<FallOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="equity"
        items={[
          {
            key: 'equity',
            label: '资金曲线',
            children: <EquityCurveChart strategyId={id} />,
          },
          {
            key: 'positions',
            label: '持仓详情',
            children: (
              <Card>
                <Table
                  dataSource={positions || []}
                  columns={[
                    { title: '交易对', dataIndex: 'symbol', key: 'symbol' },
                    { title: '持仓量', dataIndex: 'totalPosition', key: 'totalPosition' },
                    { title: '未实现盈亏', dataIndex: 'totalUnrealizedProfit', key: 'totalUnrealizedProfit' },
                    { title: '平均入场价', dataIndex: 'avgEntryPrice', key: 'avgEntryPrice' },
                  ]}
                  rowKey="symbol"
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

export default StrategyDetail;

