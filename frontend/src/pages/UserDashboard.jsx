import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, Row, Col, Spin, message, Button, Space } from 'antd';
import { ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../store/api';

function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState([]);
  const accentPalette = [
    {
      badge: 'linear-gradient(135deg, #38bdf8, #6366f1)',
      border: 'rgba(99, 102, 241, 0.4)',
      glow: '0 10px 30px rgba(99, 102, 241, 0.25)',
    },
    {
      badge: 'linear-gradient(135deg, #f472b6, #ec4899)',
      border: 'rgba(236, 72, 153, 0.35)',
      glow: '0 10px 30px rgba(236, 72, 153, 0.25)',
    },
    {
      badge: 'linear-gradient(135deg, #34d399, #10b981)',
      border: 'rgba(16, 185, 129, 0.35)',
      glow: '0 10px 30px rgba(16, 185, 129, 0.2)',
    },
  ];

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

  const isAdmin = user?.role === 'admin';
  const handleView = (id) => navigate(`/strategy/${id}`);

  return (
    <div className="dashboard-wrapper">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 12,
      }}>
        <div>
          <h1 style={{ 
            margin: 0,
            color: '#fff',
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 8,
          }}>
            我的策略库
          </h1>
          <p style={{ 
            margin: 0,
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: 14,
          }}>
            监控 {strategies.length || '0'} 个策略，实时掌握收益波动与风险敞口。
          </p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchStrategies}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            刷新数据
          </Button>
          {isAdmin && (
            <Button 
              type="primary" 
              onClick={() => navigate('/admin/strategies')}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              策略管理台
            </Button>
          )}
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
          <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>正在同步策略数据...</p>
        </div>
      ) : strategies.length === 0 ? (
        <div className="empty-card">
          暂无可用策略，请联系管理员开通权限或点击刷新重试。
        </div>
      ) : (
        <div className="dashboard-grid">
          {strategies.map((strategy, index) => {
            const accent = accentPalette[index % accentPalette.length];
            return (
              <div
                key={strategy.id}
                className="strategy-card"
                style={{ borderColor: accent.border, boxShadow: accent.glow }}
              >
                <span className="strategy-card__badge" style={{ background: accent.badge }}>
                  精选策略
                </span>
                <div className="strategy-card__title">{strategy.name}</div>
                <p className="strategy-card__description">
                  {strategy.description || '暂无描述，建议补充策略亮点与风控规则。'}
                </p>
                <div className="strategy-card__meta">
                  <span>账户：{strategy.accountEmail || '未绑定账户'}</span>
                  <Button
                    type="link"
                    icon={<ArrowRightOutlined />}
                    onClick={() => handleView(strategy.id)}
                  >
                    查看详情
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UserDashboard;

