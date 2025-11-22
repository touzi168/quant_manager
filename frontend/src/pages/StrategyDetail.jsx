import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Spin, message, Statistic, Table, Tabs, Space, Switch, Tooltip, Button, Select } from 'antd';
import { ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import api from '../store/api';
import EquityCurveChart from '../components/EquityCurveChart';

const { Option } = Select;

// 刷新间隔选项（单位：毫秒）
const REFRESH_INTERVALS = {
  '1m': 1 * 60 * 1000,      // 1分钟
  '5m': 5 * 60 * 1000,      // 5分钟
  '15m': 15 * 60 * 1000,    // 15分钟
  '30m': 30 * 60 * 1000,    // 30分钟
  '1h': 60 * 60 * 1000,     // 1小时
};

function StrategyDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  
  // 自动刷新相关状态
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('strategyDetailAutoRefreshEnabled');
    return saved === 'true';
  });
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('strategyDetailRefreshInterval');
    return saved || '5m'; // 默认5分钟
  });
  const refreshTimerRef = useRef(null);
  const nextRefreshTimeRef = useRef(null);

  useEffect(() => {
    fetchSummary();
  }, [id]);

  // 自动刷新功能
  useEffect(() => {
    // 保存自动刷新设置到localStorage
    localStorage.setItem('strategyDetailAutoRefreshEnabled', String(autoRefreshEnabled));
    localStorage.setItem('strategyDetailRefreshInterval', refreshInterval);

    // 清除现有的定时器
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // 如果启用了自动刷新，设置新的定时器
    if (autoRefreshEnabled && id) {
      const interval = REFRESH_INTERVALS[refreshInterval];
      
      // 设置下次刷新时间
      nextRefreshTimeRef.current = Date.now() + interval;
      
      // 设置定时器
      refreshTimerRef.current = setInterval(() => {
        // 更新下次刷新时间
        nextRefreshTimeRef.current = Date.now() + interval;
        
        // 执行刷新（不显示loading状态，静默刷新）
        fetchSummarySilent();
      }, interval);

      // 组件卸载时清理定时器
      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }
  }, [autoRefreshEnabled, refreshInterval, id]);

  // 计算距离下次刷新的时间
  const [timeUntilNextRefresh, setTimeUntilNextRefresh] = useState('');
  
  useEffect(() => {
    if (!autoRefreshEnabled) {
      setTimeUntilNextRefresh('');
      return;
    }

    const updateCountdown = () => {
      if (nextRefreshTimeRef.current) {
        const remaining = Math.max(0, nextRefreshTimeRef.current - Date.now());
        const seconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const displaySeconds = seconds % 60;
        setTimeUntilNextRefresh(`${minutes}:${displaySeconds.toString().padStart(2, '0')}`);
      }
    };

    // 立即更新一次
    updateCountdown();
    
    // 每秒更新一次倒计时
    const countdownTimer = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(countdownTimer);
  }, [autoRefreshEnabled, refreshInterval]);

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

  // 静默刷新（不显示loading状态）
  const fetchSummarySilent = async () => {
    try {
      const response = await api.get(`/user/dashboard/summary/${id}`);
      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (error) {
      console.error('自动刷新策略数据失败:', error);
      // 静默刷新失败时不显示错误提示，避免打扰用户
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

  // 资产卡片样式配置（与AdminDashboard一致）
  const getCardStyle = (index, value) => {
    const cardStyles = [
      { 
        background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
        borderLeft: '4px solid #38bdf8',
        iconColor: '#0284c7',
        borderColor: '#e0f2fe',
      },
      { 
        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
        borderLeft: '4px solid #60a5fa',
        iconColor: '#2563eb',
        borderColor: '#dbeafe',
      },
      { 
        background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
        borderLeft: '4px solid #818cf8',
        iconColor: '#4f46e5',
        borderColor: '#e0e7ff',
      },
      { 
        background: (value ?? 0) >= 0 
          ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
          : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        borderLeft: `4px solid ${(value ?? 0) >= 0 ? '#10b981' : '#ef4444'}`,
        iconColor: (value ?? 0) >= 0 ? '#059669' : '#dc2626',
        borderColor: (value ?? 0) >= 0 ? '#d1fae5' : '#fee2e2',
      },
      { 
        background: (value ?? 0) >= 0
          ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
          : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        borderLeft: `4px solid ${(value ?? 0) >= 0 ? '#3b82f6' : '#ef4444'}`,
        iconColor: (value ?? 0) >= 0 ? '#2563eb' : '#dc2626',
        borderColor: (value ?? 0) >= 0 ? '#dbeafe' : '#fee2e2',
      },
      { 
        background: (value ?? 0) >= 0
          ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
          : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        borderLeft: `4px solid ${(value ?? 0) >= 0 ? '#f59e0b' : '#ef4444'}`,
        iconColor: (value ?? 0) >= 0 ? '#d97706' : '#dc2626',
        borderColor: (value ?? 0) >= 0 ? '#fef3c7' : '#fee2e2',
      },
      { 
        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
        borderLeft: '4px solid #3b82f6',
        iconColor: '#2563eb',
        borderColor: '#dbeafe',
      },
      { 
        background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
        borderLeft: '4px solid #f472b6',
        iconColor: '#db2777',
        borderColor: '#fce7f3',
      },
      { 
        background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
        borderLeft: '4px solid #8b5cf6',
        iconColor: '#7c3aed',
        borderColor: '#e0e7ff',
      },
      { 
        background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
        borderLeft: '4px solid #ec4899',
        iconColor: '#db2777',
        borderColor: '#fce7f3',
      },
      { 
        background: (value ?? 0) >= 0
          ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
          : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        borderLeft: `4px solid ${(value ?? 0) >= 0 ? '#10b981' : '#ef4444'}`,
        iconColor: (value ?? 0) >= 0 ? '#059669' : '#dc2626',
        borderColor: (value ?? 0) >= 0 ? '#d1fae5' : '#fee2e2',
      },
      { 
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        borderLeft: '4px solid #fbbf24',
        iconColor: '#d97706',
        borderColor: '#fef3c7',
      },
    ];
    return cardStyles[index % cardStyles.length];
  };

  return (
    <div>
      <style>{`
        .strategy-table-styled .ant-table-thead > tr > th {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
          border-bottom: 2px solid #cbd5e1 !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          padding: 12px 16px !important;
          font-size: 13px !important;
        }
        .strategy-table-styled .ant-table-tbody > tr > td {
          padding: 12px 16px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          transition: all 0.2s ease !important;
        }
        .strategy-table-styled .table-row-even {
          background: #ffffff !important;
        }
        .strategy-table-styled .table-row-odd {
          background: #f8fafc !important;
        }
        .strategy-table-styled .ant-table-tbody > tr:hover {
          background: #e0f2fe !important;
          transform: scale(1.01);
          box-shadow: 0 2px 8px rgba(29, 155, 240, 0.15);
        }
        .strategy-table-styled .ant-table-container {
          border-radius: 8px;
          overflow: hidden;
        }
        .strategy-table-styled .ant-table {
          border-radius: 8px;
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
          {strategy.name}
        </h1>
        <Space>
          {/* 自动刷新设置 */}
          <Space>
            <Tooltip title={autoRefreshEnabled ? `下次刷新: ${timeUntilNextRefresh}` : '启用自动刷新'}>
              <Space>
                <ClockCircleOutlined style={{ color: autoRefreshEnabled ? '#fff' : 'rgba(255, 255, 255, 0.7)' }} />
                <span style={{ fontSize: 12, color: '#fff', minWidth: 50, fontWeight: 500 }}>
                  {autoRefreshEnabled ? timeUntilNextRefresh : '自动刷新'}
                </span>
              </Space>
            </Tooltip>
            <Switch
              checked={autoRefreshEnabled}
              onChange={(checked) => {
                setAutoRefreshEnabled(checked);
                if (checked) {
                  message.success(`已启用自动刷新，间隔: ${refreshInterval === '1m' ? '1分钟' : refreshInterval === '5m' ? '5分钟' : refreshInterval === '15m' ? '15分钟' : refreshInterval === '30m' ? '30分钟' : '1小时'}`);
                } else {
                  message.info('已关闭自动刷新');
                }
              }}
              size="small"
            />
            {autoRefreshEnabled && (
              <Select
                value={refreshInterval}
                onChange={(value) => {
                  setRefreshInterval(value);
                  message.success(`刷新间隔已更改为: ${value === '1m' ? '1分钟' : value === '5m' ? '5分钟' : value === '15m' ? '15分钟' : value === '30m' ? '30分钟' : '1小时'}`);
                }}
                size="small"
                style={{ 
                  width: 80,
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                }}
                popupClassName="strategy-select-dropdown"
              >
                <Option value="1m">1分钟</Option>
                <Option value="5m">5分钟</Option>
                <Option value="15m">15分钟</Option>
                <Option value="30m">30分钟</Option>
                <Option value="1h">1小时</Option>
              </Select>
            )}
          </Space>
          
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchSummary}
            loading={loading}
            type="primary"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            手动刷新
          </Button>
        </Space>
      </div>

      {assetStats.length > 0 && (
        <>
          <h2 style={{ margin: '32px 0 16px', fontSize: 18, fontWeight: 600, color: '#0f172a' }}>资产概览</h2>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {assetStats.map((stat, index) => {
              const cardStyle = getCardStyle(index, stat.value);
              return (
                <Col xs={24} sm={12} lg={4} key={stat.key}>
                  <Card
                    size="small"
                    bodyStyle={{ 
                      padding: '12px 16px 8px 16px',
                      background: cardStyle.background,
                      borderRadius: 8,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    style={{ 
                      border: `1px solid ${cardStyle.borderColor}`,
                      borderLeft: cardStyle.borderLeft,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Statistic
                      title={<span style={{ color: cardStyle.iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>{stat.title}</span>}
                      value={stat.value ?? 0}
                      precision={stat.precision}
                      valueStyle={{ 
                        ...stat.valueStyle,
                        fontWeight: 700, 
                        fontSize: 20,
                        marginBottom: 0
                      }}
                      style={{ margin: 0, padding: 0 }}
                    />
                  </Card>
                </Col>
              );
            })}
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
              <Card
                style={{
                  border: '1px solid #e8e8e8',
                  borderRadius: 8,
                }}
              >
                <Table
                  dataSource={positions || []}
                  className="strategy-table-styled"
                  style={{
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                  rowClassName={(record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
                  columns={[
                    { 
                      title: <span style={{ fontWeight: 600, color: '#0f172a' }}>交易对</span>, 
                      dataIndex: 'symbol', 
                      key: 'symbol',
                      render: (text) => <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span>
                    },
                    { 
                      title: <span style={{ fontWeight: 600, color: '#0f172a' }}>持仓量</span>, 
                      dataIndex: 'totalPosition', 
                      key: 'totalPosition',
                      align: 'right',
                      render: (value) => (
                        <span style={{ fontWeight: 500, color: '#334155' }}>
                          {value ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </span>
                      )
                    },
                    { 
                      title: <span style={{ fontWeight: 600, color: '#0f172a' }}>未实现盈亏</span>, 
                      dataIndex: 'totalUnrealizedProfit', 
                      key: 'totalUnrealizedProfit',
                      align: 'right',
                      render: (value) => {
                        const numValue = Number(value) || 0;
                        return (
                          <span style={{ 
                            color: numValue >= 0 ? '#10b981' : '#ef4444',
                            fontWeight: 600,
                            fontSize: 13
                          }}>
                            {value ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                          </span>
                        );
                      }
                    },
                    { 
                      title: <span style={{ fontWeight: 600, color: '#0f172a' }}>平均入场价</span>, 
                      dataIndex: 'avgEntryPrice', 
                      key: 'avgEntryPrice',
                      align: 'right',
                      render: (value) => (
                        <span style={{ fontWeight: 500, color: '#334155', fontSize: 13 }}>
                          {value ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </span>
                      )
                    },
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

