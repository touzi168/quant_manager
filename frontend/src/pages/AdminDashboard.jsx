import { useEffect, useState } from 'react';
import { Card, Row, Col, Spin, message, Select, Table, Tag, Statistic, Button, Dropdown, Checkbox, Space } from 'antd';
import { DollarOutlined, SettingOutlined, ReloadOutlined, DragOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import api from '../store/api';
import ReactECharts from 'echarts-for-react';

const { Option } = Select;

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [assetOverview, setAssetOverview] = useState(null);
  const [hostsStatus, setHostsStatus] = useState([]);
  const [healthStatus, setHealthStatus] = useState([]);
  const [processStatus, setProcessStatus] = useState([]);
  const [equityCurve, setEquityCurve] = useState([]);
  const [periodPnl, setPeriodPnl] = useState([]);
  const [assetDistribution, setAssetDistribution] = useState([]);
  const [period, setPeriod] = useState('day');
  // 资金曲线相关状态
  const [timeWindow, setTimeWindow] = useState('30d'); // 时间窗口：7d, 30d, 60d, 120d, 180d, 1y, 2y, 3y, 5y, 10y
  const [showCurves, setShowCurves] = useState({
    floatingAssets: true,  // 浮动资产
    totalAssets: false,    // 总资产
    maxDrawdown: true,     // 最大回撤
  });
  
  // 布局配置
  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem('adminDashboardLayout');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      { id: 'assetOverview', x: 0, y: 0, w: 24, h: 1, visible: true },
      { id: 'equityCurve', x: 0, y: 1, w: 24, h: 1, visible: true },
      { id: 'periodPnl', x: 0, y: 2, w: 12, h: 1, visible: true },
      { id: 'assetDistribution', x: 12, y: 2, w: 12, h: 1, visible: true },
      { id: 'hostsStatus', x: 0, y: 3, w: 8, h: 1, visible: true },
      { id: 'healthStatus', x: 8, y: 3, w: 8, h: 1, visible: true },
      { id: 'processStatus', x: 16, y: 3, w: 8, h: 1, visible: true },
    ];
  });
  
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    fetchPeriodPnl();
  }, [period]);

  useEffect(() => {
    // 时间窗口改变时重新获取资金曲线数据
    fetchEquityCurve();
  }, [timeWindow]);

  useEffect(() => {
    // 保存布局到localStorage
    localStorage.setItem('adminDashboardLayout', JSON.stringify(layout));
  }, [layout]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      // 使用 Promise.allSettled 确保所有请求都能执行，即使某个失败也不影响其他
      await Promise.allSettled([
        fetchAssetOverview(),
        fetchHostsStatus(),
        fetchHealthStatus(),
        fetchProcessStatus(),
        fetchEquityCurve(),
        fetchPeriodPnl(),
        fetchAssetDistribution(),
      ]);
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetOverview = async () => {
    try {
      const response = await api.get('/admin/dashboard/asset-overview');
      if (response.data.success) {
        setAssetOverview(response.data.data);
      }
    } catch (error) {
      console.error('获取资产总览失败:', error);
    }
  };

  const fetchHostsStatus = async () => {
    try {
      const response = await api.get('/admin/dashboard/hosts-status');
      if (response.data.success) {
        setHostsStatus(response.data.data);
      }
    } catch (error) {
      console.error('获取服务器状态失败:', error);
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const response = await api.get('/admin/dashboard/health-status');
      if (response.data.success) {
        setHealthStatus(response.data.data);
      }
    } catch (error) {
      console.error('获取健康状态失败:', error);
    }
  };

  const fetchProcessStatus = async () => {
    try {
      const response = await api.get('/admin/dashboard/process-status');
      if (response.data.success) {
        setProcessStatus(response.data.data);
      }
    } catch (error) {
      console.error('获取进程状态失败:', error);
    }
  };

  const fetchEquityCurve = async () => {
    try {
      console.log('开始获取资金曲线数据...', { timeWindow });
      const response = await api.get(`/admin/dashboard/equity-curve-drawdown?timeRange=${timeWindow}`);
      console.log('资金曲线数据响应:', response.data);
      if (response.data.success) {
        setEquityCurve(response.data.data || []);
        console.log('资金曲线数据已设置，数据量:', response.data.data?.length || 0);
      } else {
        console.warn('获取资金曲线失败: 响应未成功', response.data);
      }
    } catch (error) {
      console.error('获取资金曲线失败:', error);
      console.error('错误详情:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      // 设置空数组，避免显示"暂无数据"时一直显示
      setEquityCurve([]);
    }
  };

  const fetchPeriodPnl = async () => {
    try {
      const response = await api.get(`/admin/dashboard/period-pnl?period=${period}&limit=30`);
      if (response.data.success) {
        setPeriodPnl(response.data.data);
      }
    } catch (error) {
      console.error('获取周期盈亏失败:', error);
    }
  };

  const fetchAssetDistribution = async () => {
    try {
      const response = await api.get('/admin/dashboard/asset-distribution');
      if (response.data.success) {
        setAssetDistribution(response.data.data);
      }
    } catch (error) {
      console.error('获取资产分布失败:', error);
    }
  };

  // 拖拽处理
  const handleDragStart = (e, itemId) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', itemId);
  };

  const handleDragOver = (e, itemId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (itemId !== draggedItem) {
      setDragOverItem(itemId);
    }
  };

  const handleDragEnd = () => {
    if (draggedItem && dragOverItem && draggedItem !== dragOverItem) {
      const newLayout = [...layout];
      const draggedIndex = newLayout.findIndex(item => item.id === draggedItem);
      const targetIndex = newLayout.findIndex(item => item.id === dragOverItem);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [dragged] = newLayout.splice(draggedIndex, 1);
        newLayout.splice(targetIndex, 0, dragged);
        
        // 重新计算y坐标
        newLayout.forEach((item, index) => {
          item.y = index;
        });
        
        setLayout(newLayout);
      }
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const toggleVisibility = (itemId) => {
    setLayout(layout.map(item => 
      item.id === itemId ? { ...item, visible: !item.visible } : item
    ));
  };

  // 计算时间窗口的起始日期
  const getTimeWindowStart = (window) => {
    const now = new Date();
    const daysMap = {
      '7d': 7,
      '30d': 30,
      '60d': 60,
      '120d': 120,
      '180d': 180,  // 半年
      '1y': 365,
      '2y': 730,
      '3y': 1095,
      '5y': 1825,
      '10y': 3650,
    };
    const days = daysMap[window] || 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    return startDate;
  };

  // 计算窗口内的最大回撤（基于原始资产值）
  // 每个时间点显示从历史最高点到当前点的回撤（不是累积最大回撤）
  const calculateWindowDrawdown = (filteredData) => {
    if (filteredData.length === 0) return [];
    
    const drawdowns = [];
    let peak = null;
    
    filteredData.forEach(item => {
      const netUnrealized = item.netUnrealized;
      
      // 更新峰值（历史最高点）
      if (peak === null || netUnrealized > peak) {
        peak = netUnrealized;
      }
      
      // 计算当前回撤：从峰值到当前值的回撤
      if (peak > 0) {
        const drawdown = (peak - netUnrealized) / peak;
        drawdowns.push(-drawdown); // 负值，表示回撤
      } else {
        drawdowns.push(0);
      }
    });
    
    return drawdowns;
  };

  // 计算窗口内的最大回撤（基于净值）
  // 每个时间点显示从历史最高净值到当前净值的回撤
  const calculateWindowDrawdownFromNav = (navValues) => {
    if (navValues.length === 0) return [];
    
    const drawdowns = [];
    let peak = null;
    
    navValues.forEach(nav => {
      // 更新峰值（历史最高净值）
      if (peak === null || nav > peak) {
        peak = nav;
      }
      
      // 计算当前回撤：从峰值到当前净值的回撤
      if (peak > 0) {
        const drawdown = (peak - nav) / peak;
        drawdowns.push(-drawdown); // 负值，表示回撤
      } else {
        drawdowns.push(0);
      }
    });
    
    return drawdowns;
  };

  // 资金曲线图表配置
  const getEquityCurveOption = () => {
    // 基础配置函数
    const getBaseOption = (titleText = null) => {
      const option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: [],
        },
        yAxis: [],
        series: [],
      };
      
      if (titleText) {
        option.title = {
          text: titleText,
          left: 'center',
          top: 'center',
          textStyle: { fontSize: 16, color: '#999' }
        };
      }
      
      return option;
    };

    // 检查数据是否存在
    if (!equityCurve || !Array.isArray(equityCurve) || equityCurve.length === 0) {
      return getBaseOption('暂无数据');
    }

    // 后端已经根据时间窗口过滤了数据，直接使用
    // 只需要验证数据有效性
    const filteredData = equityCurve.filter(item => 
      item && (item.netUnrealized !== undefined || item.netRealized !== undefined)
    );

    if (filteredData.length === 0) {
      return getBaseOption('选定时间窗口内暂无数据');
    }

    const times = filteredData.map(item => item.time || '').filter(Boolean);
    const netUnrealized = filteredData.map(item => parseFloat(item.netUnrealized) || 0);
    const netRealized = filteredData.map(item => parseFloat(item.netRealized) || 0);

    // 2. 按基金净值法计算收益（以窗口开始时的值为基准）
    const baseUnrealized = netUnrealized[0] || 1;
    const baseRealized = netRealized[0] || 1;
    
    // 基金净值法：净值 = 当前值 / 基准值
    // 净值1.0表示和基准一样，1.2表示比基准高20%，0.8表示比基准低20%
    const navUnrealizedValues = netUnrealized.map(value => 
      baseUnrealized !== 0 ? value / baseUnrealized : 1
    );
    const navRealizedValues = netRealized.map(value => 
      baseRealized !== 0 ? value / baseRealized : 1
    );

    // 3. 计算窗口内的最大回撤（基于净值计算，与资产曲线保持一致）
    // 使用浮动资产的净值来计算回撤
    const maxDrawdown = calculateWindowDrawdownFromNav(navUnrealizedValues);

    // 4. 构建图例数据
    const legendData = [];
    if (showCurves.floatingAssets) legendData.push('浮动资产');
    if (showCurves.totalAssets) legendData.push('总资产');
    if (showCurves.maxDrawdown) legendData.push('最大回撤');

    // 如果没有选中任何曲线，显示提示
    if (legendData.length === 0) {
      return getBaseOption('请至少选择一条曲线显示');
    }

    // 5. 构建系列数据
    const series = [];
    if (showCurves.floatingAssets) {
      series.push({
        name: '浮动资产',
        type: 'line',
        yAxisIndex: 0,
        data: navUnrealizedValues,
        smooth: true,
        itemStyle: { color: '#1890ff' },
      });
    }
    if (showCurves.totalAssets) {
      series.push({
        name: '总资产',
        type: 'line',
        yAxisIndex: 0,
        data: navRealizedValues,
        smooth: true,
        itemStyle: { color: '#52c41a' },
      });
    }
    if (showCurves.maxDrawdown) {
      series.push({
        name: '最大回撤',
        type: 'line',
        yAxisIndex: 1,
        data: maxDrawdown,
        smooth: true,
        // 线条样式：浅色细线
        lineStyle: { 
          width: 1,
          color: 'rgba(255, 77, 79, 0.5)',
        },
        // 数据点样式：不显示或浅色
        itemStyle: { 
          color: 'rgba(255, 77, 79, 0.5)',
        },
        // 填充区域：浅红色半透明
        areaStyle: {
          color: 'rgba(255, 77, 79, 0.15)', // 浅红色填充
        },
        // 确保填充从0轴开始（对于负值，会自动从数据点向上填充到0）
        symbol: 'none', // 不显示数据点
        symbolSize: 0,
      });
    }

    // 6. 计算y轴范围（自动适应）
    const assetValues = [];
    if (showCurves.floatingAssets) assetValues.push(...navUnrealizedValues);
    if (showCurves.totalAssets) assetValues.push(...navRealizedValues);
    
    const assetMin = assetValues.length > 0 ? Math.min(...assetValues) : 0;
    const assetMax = assetValues.length > 0 ? Math.max(...assetValues) : 1;
    const assetRange = assetMax - assetMin;
    const assetPadding = assetRange > 0 ? assetRange * 0.1 : 0.1; // 10%的padding

    const drawdownMin = showCurves.maxDrawdown && maxDrawdown.length > 0 
      ? Math.min(...maxDrawdown) 
      : -1;
    const drawdownMax = showCurves.maxDrawdown && maxDrawdown.length > 0 
      ? Math.max(...maxDrawdown) 
      : 0;
    const drawdownRange = drawdownMax - drawdownMin;
    const drawdownPadding = drawdownRange > 0 ? drawdownRange * 0.1 : 0.1;

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          let result = `${params[0].axisValue}<br/>`;
          params.forEach(param => {
            if (param.seriesName === '最大回撤') {
              result += `${param.marker}${param.seriesName}: ${(param.value * 100).toFixed(2)}%<br/>`;
            } else {
              // 显示净值（相对于基准的比例）
              const percentage = ((param.value - 1) * 100).toFixed(2);
              result += `${param.marker}${param.seriesName}: ${param.value.toFixed(4)} (${percentage >= 0 ? '+' : ''}${percentage}%)<br/>`;
            }
          });
          return result;
        },
      },
      legend: {
        data: legendData,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: times,
      },
      yAxis: [
        ...(assetValues.length > 0 ? [{
          type: 'value',
          name: '净值',
          position: 'left',
          min: assetMin - assetPadding,
          max: assetMax + assetPadding,
          axisLabel: {
            formatter: (value) => value.toFixed(3),
          },
        }] : []),
        ...(showCurves.maxDrawdown ? [{
          type: 'value',
          name: '最大回撤',
          position: assetValues.length > 0 ? 'right' : 'left',
          min: drawdownMin - drawdownPadding,
          max: drawdownMax + drawdownPadding,
          axisLabel: {
            formatter: (value) => `${(value * 100).toFixed(1)}%`,
          },
        }] : []),
      ],
      series: series,
    };
  };

  // 周期盈亏图表配置
  const getPeriodPnlOption = () => {
    const periods = periodPnl.map(item => item.period).reverse();
    const pnls = periodPnl.map(item => item.pnl).reverse();

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: periods,
      },
      yAxis: {
        type: 'value',
        name: '盈亏 (USD)',
      },
      series: [
        {
          name: '盈亏',
          type: 'bar',
          data: pnls,
          itemStyle: {
            color: (params) => params.value >= 0 ? '#52c41a' : '#ff4d4f',
          },
        },
      ],
    };
  };

  // 资产分布图表配置
  const getAssetDistributionOption = () => {
    const assets = assetDistribution.map(item => item.asset);
    const values = assetDistribution.map(item => Math.abs(item.netUnrealized));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: assets,
      },
      yAxis: {
        type: 'log',
        name: '资产 (USD)',
      },
      series: [
        {
          name: '资产分布',
          type: 'bar',
          data: values,
          itemStyle: { color: '#1890ff' },
        },
      ],
    };
  };

  // 栏目配置
  const widgetConfig = {
    assetOverview: {
      title: '资产总览',
      render: () => (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="浮动资产 (CNY)"
                value={assetOverview?.floatingAssetsCNY || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="浮动资产 (USD)"
                value={assetOverview?.floatingAssetsUSD || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="总资产 (USD)"
                value={assetOverview?.totalAssets || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="未实现盈亏 (USD)"
                value={assetOverview?.unrealizedPnl || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: assetOverview?.unrealizedPnl >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="未实现盈亏(多头)"
                value={assetOverview?.unrealizedPnlLong || 0}
                precision={2}
                valueStyle={{ color: assetOverview?.unrealizedPnlLong >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="未实现盈亏(空头)"
                value={assetOverview?.unrealizedPnlShort || 0}
                precision={2}
                valueStyle={{ color: assetOverview?.unrealizedPnlShort >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="多头市值 (USD)"
                value={assetOverview?.longMarketValue || 0}
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="空头市值 (USD)"
                value={assetOverview?.shortMarketValue || 0}
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="多头杠杆率"
                value={assetOverview?.longLeverage || 0}
                precision={4}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="空头杠杆率"
                value={assetOverview?.shortLeverage || 0}
                precision={4}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="风险敞口"
                value={assetOverview?.riskExposure || 0}
                precision={4}
                valueStyle={{ color: assetOverview?.riskExposure >= 0 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="美元兑RMB汇率"
                value={assetOverview?.usdToCnyRate || 0}
                precision={4}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    equityCurve: {
      title: '资金曲线',
      render: () => (
        <Card
          title="资金曲线"
          extra={
            <Space>
              <Select
                value={timeWindow}
                onChange={setTimeWindow}
                style={{ width: 120 }}
              >
                <Option value="7d">7天</Option>
                <Option value="30d">30天</Option>
                <Option value="60d">60天</Option>
                <Option value="120d">120天</Option>
                <Option value="180d">半年</Option>
                <Option value="1y">1年</Option>
                <Option value="2y">2年</Option>
                <Option value="3y">3年</Option>
                <Option value="5y">5年</Option>
                <Option value="10y">10年</Option>
              </Select>
              <Checkbox.Group
                value={Object.keys(showCurves).filter(key => showCurves[key])}
                onChange={(checkedValues) => {
                  setShowCurves({
                    floatingAssets: checkedValues.includes('floatingAssets'),
                    totalAssets: checkedValues.includes('totalAssets'),
                    maxDrawdown: checkedValues.includes('maxDrawdown'),
                  });
                }}
                options={[
                  { label: '浮动资产', value: 'floatingAssets' },
                  { label: '总资产', value: 'totalAssets' },
                  { label: '最大回撤', value: 'maxDrawdown' },
                ]}
              />
            </Space>
          }
        >
          <ReactECharts 
            option={getEquityCurveOption()} 
            style={{ height: '400px' }}
            notMerge={true}
            lazyUpdate={false}
            key={`equity-curve-${timeWindow}-${JSON.stringify(showCurves)}-${equityCurve.length}`}
          />
        </Card>
      ),
    },
    periodPnl: {
      title: '周期盈亏',
      render: () => (
        <Card
          title="周期盈亏"
          extra={
            <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
              <Option value="day">按天</Option>
              <Option value="week">按周</Option>
              <Option value="month">按月</Option>
            </Select>
          }
        >
          <ReactECharts option={getPeriodPnlOption()} style={{ height: '400px' }} />
        </Card>
      ),
    },
    assetDistribution: {
      title: '资产分布',
      render: () => (
        <Card title="资产分布">
          <ReactECharts option={getAssetDistributionOption()} style={{ height: '400px' }} />
        </Card>
      ),
    },
    hostsStatus: {
      title: '服务器状态',
      render: () => (
        <Card title="服务器状态" size="small" style={{ height: '100%' }}>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table
              dataSource={hostsStatus}
              rowKey="hostname"
              pagination={false}
              size="small"
              columns={[
                { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
                {
                  title: '磁盘使用率',
                  dataIndex: 'diskUsed',
                  key: 'diskUsed',
                  render: (value) => value ? `${value.toFixed(2)}%` : '-',
                },
                {
                  title: '磁盘空闲率',
                  dataIndex: 'diskFree',
                  key: 'diskFree',
                  render: (value) => value ? `${value.toFixed(2)}%` : '-',
                },
              ]}
            />
          </div>
        </Card>
      ),
    },
    healthStatus: {
      title: '策略状态',
      render: () => (
        <Card title="策略状态" size="small" style={{ height: '100%' }}>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table
              dataSource={healthStatus}
              rowKey={(record) => `${record.hostname}-${record.accountName}-${record.strategyName}`}
              pagination={false}
              size="small"
              columns={[
                { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
                { title: '账户', dataIndex: 'accountName', key: 'accountName' },
                { title: '策略', dataIndex: 'strategyName', key: 'strategyName' },
                {
                  title: '运行时间',
                  dataIndex: 'runTime',
                  key: 'runTime',
                  render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-',
                },
              ]}
            />
          </div>
        </Card>
      ),
    },
    processStatus: {
      title: '进程状态',
      render: () => (
        <Card title="进程状态" size="small" style={{ height: '100%' }}>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table
              dataSource={processStatus}
              rowKey={(record) => `${record.hostname}-${record.name}`}
              pagination={false}
              size="small"
              columns={[
                { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
                { title: '进程名', dataIndex: 'name', key: 'name' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => (
                    <Tag color={status === 'online' ? 'green' : 'red'}>{status}</Tag>
                  ),
                },
                {
                  title: 'CPU',
                  dataIndex: 'cpu',
                  key: 'cpu',
                  render: (value) => value ? `${value.toFixed(2)}%` : '-',
                },
                {
                  title: '内存',
                  dataIndex: 'memory',
                  key: 'memory',
                  render: (value) => value ? `${(value / 1024 / 1024).toFixed(2)} MB` : '-',
                },
              ]}
            />
          </div>
        </Card>
      ),
    },
  };

  // 栏目设置菜单
  const widgetMenuItems = layout.map(item => ({
    key: item.id,
    label: (
      <Checkbox
        checked={item.visible}
        onChange={() => toggleVisibility(item.id)}
      >
        {widgetConfig[item.id]?.title || item.id}
      </Checkbox>
    ),
  }));

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const visibleLayout = layout.filter(item => item.visible);

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>管理员仪表板</h1>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAllData}
            loading={loading}
          >
            刷新
          </Button>
          <Dropdown
            menu={{ items: widgetMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button icon={<SettingOutlined />}>
              栏目设置
            </Button>
          </Dropdown>
        </Space>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(24, 1fr)',
        gap: '16px',
        gridAutoRows: 'minmax(400px, auto)',
      }}>
        {visibleLayout.map((item) => {
          const config = widgetConfig[item.id];
          if (!config) return null;

          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragEnd={handleDragEnd}
              style={{
                gridColumn: `span ${item.w}`,
                gridRow: `span ${item.h}`,
                cursor: 'move',
                opacity: draggedItem === item.id ? 0.5 : 1,
                border: dragOverItem === item.id ? '2px dashed #1890ff' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DragOutlined style={{ cursor: 'move', color: '#999' }} />
                    {config.title}
                  </div>
                }
                extra={
                  <Button
                    type="text"
                    size="small"
                    icon={item.visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    onClick={() => toggleVisibility(item.id)}
                  />
                }
                style={{ height: '100%' }}
              >
                {config.render()}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AdminDashboard;
