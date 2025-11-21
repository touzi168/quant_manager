import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Spin, message, Statistic, Table, Tabs } from 'antd';
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

  const getTrendColor = (value) => (value >= 0 ? '#52c41a' : '#ff4d4f');

  const assetStats = assets
    ? [
        {
          key: 'floatingAssetsCNY',
          title: '浮动资产 (CNY)',
          value: assets.floatingAssetsCNY,
          precision: 2,
          valueStyle: { color: '#1890ff' },
        },
        {
          key: 'floatingAssetsUSD',
          title: '浮动资产 (USD)',
          value: assets.floatingAssetsUSD,
          precision: 2,
          valueStyle: { color: '#1890ff' },
        },
        {
          key: 'totalAssets',
          title: '总资产 (USD)',
          value: assets.totalAssets,
          precision: 2,
          valueStyle: { color: '#52c41a' },
        },
        {
          key: 'unrealizedPnl',
          title: '未实现盈亏 (USD)',
          value: assets.unrealizedPnl,
          precision: 2,
          valueStyle: { color: getTrendColor(assets.unrealizedPnl) },
        },
        {
          key: 'unrealizedPnlLong',
          title: '未实现盈亏(多头)',
          value: assets.unrealizedPnlLong,
          precision: 2,
          valueStyle: { color: getTrendColor(assets.unrealizedPnlLong) },
        },
        {
          key: 'unrealizedPnlShort',
          title: '未实现盈亏(空头)',
          value: assets.unrealizedPnlShort,
          precision: 2,
          valueStyle: { color: getTrendColor(assets.unrealizedPnlShort) },
        },
        {
          key: 'longMarketValue',
          title: '多头市值 (USD)',
          value: assets.longMarketValue,
          precision: 2,
          valueStyle: { color: '#1890ff' },
        },
        {
          key: 'shortMarketValue',
          title: '空头市值 (USD)',
          value: assets.shortMarketValue,
          precision: 2,
          valueStyle: { color: '#ff4d4f' },
        },
        {
          key: 'longLeverage',
          title: '多头杠杆率',
          value: assets.longLeverage,
          precision: 4,
          valueStyle: { color: '#1890ff' },
        },
        {
          key: 'shortLeverage',
          title: '空头杠杆率',
          value: assets.shortLeverage,
          precision: 4,
          valueStyle: { color: '#ff4d4f' },
        },
        {
          key: 'riskExposure',
          title: '风险敞口',
          value: assets.riskExposure,
          precision: 4,
          valueStyle: { color: getTrendColor(assets.riskExposure) },
        },
        {
          key: 'usdToCnyRate',
          title: '美元兑RMB汇率',
          value: assets.usdToCnyRate,
          precision: 4,
        },
      ]
    : [];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{strategy.name}</h1>

      {assetStats.length > 0 && (
        <>
          <h2 style={{ margin: '32px 0 16px' }}>资产概览</h2>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {assetStats.map((stat) => (
              <Col xs={24} sm={12} lg={4} key={stat.key}>
                <Card
                  size="small"
                  bodyStyle={{ padding: 12 }}
                  style={{ minHeight: 110 }}
                >
                  <Statistic
                    title={stat.title}
                    value={stat.value ?? 0}
                    precision={stat.precision}
                    valueStyle={stat.valueStyle}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

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

