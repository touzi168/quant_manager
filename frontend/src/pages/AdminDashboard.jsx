import { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Spin, message, Select, Table, Tag, Statistic, Button, Space, Switch, Tooltip } from 'antd';
import { 
  DollarOutlined, 
  ReloadOutlined, 
  ClockCircleOutlined,
  WalletOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined,
  StockOutlined,
  BarChartOutlined,
  PieChartOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  MonitorOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import api from '../store/api';
import ReactECharts from 'echarts-for-react';

const { Option } = Select;

// 刷新间隔选项（单位：毫秒）
const REFRESH_INTERVALS = {
  '1m': 1 * 60 * 1000,      // 1分钟
  '5m': 5 * 60 * 1000,      // 5分钟
  '15m': 15 * 60 * 1000,    // 15分钟
  '30m': 30 * 60 * 1000,    // 30分钟
  '1h': 60 * 60 * 1000,     // 1小时
};

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
  
  // 自动刷新相关状态
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('adminDashboardAutoRefreshEnabled');
    return saved === 'true';
  });
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('adminDashboardRefreshInterval');
    return saved || '5m'; // 默认5分钟
  });
  const refreshTimerRef = useRef(null);
  const nextRefreshTimeRef = useRef(null);
  // 资金曲线相关状态
  const [timeWindow, setTimeWindow] = useState('30d'); // 时间窗口：7d, 30d, 60d, 90d, 120d, 180d, 1y, 2y, 3y, 5y, 10y
  const [showCurves, setShowCurves] = useState({
    floatingAssets: true,   // 浮动资产（净值）
    totalAssets: false,     // 总资产（净值）
    rawFloatingAssets: false, // 原始浮动资产
    maxDrawdown: true,      // 最大回撤
  });
  
  const formatLargeNumber = (value) => {
    const absValue = Math.abs(value);
    if (absValue >= 1_0000_0000) {
      return `${(value / 1_0000_0000).toFixed(2)}亿`;
    }
    if (absValue >= 1_0000) {
      return `${(value / 1_0000).toFixed(2)}万`;
    }
    if (absValue >= 1_000) {
      return `${(value / 1_000).toFixed(2)}千`;
    }
    return value.toFixed(2);
  };


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


  // 自动刷新功能
  useEffect(() => {
    // 保存自动刷新设置到localStorage
    localStorage.setItem('adminDashboardAutoRefreshEnabled', String(autoRefreshEnabled));
    localStorage.setItem('adminDashboardRefreshInterval', refreshInterval);

    // 清除现有的定时器
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // 如果启用了自动刷新，设置新的定时器
    if (autoRefreshEnabled) {
      const interval = REFRESH_INTERVALS[refreshInterval];
      
      // 设置下次刷新时间
      nextRefreshTimeRef.current = Date.now() + interval;
      
      // 设置定时器
      refreshTimerRef.current = setInterval(() => {
        // 更新下次刷新时间
        nextRefreshTimeRef.current = Date.now() + interval;
        
        // 执行刷新（不显示loading状态，静默刷新）
        fetchAllDataSilent();
      }, interval);

      // 组件卸载时清理定时器
      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }
  }, [autoRefreshEnabled, refreshInterval]);

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

  const updateEquityCurveState = (data, { preservePreviousOnEmpty = false } = {}) => {
    setEquityCurve(prev => {
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      if (preservePreviousOnEmpty && prev && prev.length > 0) {
        return prev;
      }
      return [];
    });
  };

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

  // 静默刷新（不显示loading状态）
  const fetchAllDataSilent = async () => {
    try {
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
      console.error('自动刷新数据失败:', error);
      // 静默刷新失败时不显示错误提示，避免打扰用户
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
        updateEquityCurveState(response.data.data || []);
        console.log('资金曲线数据已设置，数据量:', response.data.data?.length || 0);
      } else {
        console.warn('获取资金曲线失败: 响应未成功', response.data);
        updateEquityCurveState([], { preservePreviousOnEmpty: true });
        message.warning('最新资金曲线返回为空，已保留上一份数据');
      }
    } catch (error) {
      console.error('获取资金曲线失败:', error);
      console.error('错误详情:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      updateEquityCurveState([], { preservePreviousOnEmpty: true });
      message.error('获取资金曲线失败，展示上一次数据');
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


  // 计算时间窗口的起始日期
  const getTimeWindowStart = (window) => {
    const now = new Date();
    const daysMap = {
      '7d': 7,
      '30d': 30,
      '60d': 60,
      '90d': 90,
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

  const handleLegendSelectChange = (params) => {
    if (!params || !params.selected) return;
    const selected = params.selected;
    setShowCurves({
      floatingAssets: !!selected['浮动资产(净值)'],
      totalAssets: !!selected['总资产(净值)'],
      rawFloatingAssets: !!selected['原始浮动资产'],
      maxDrawdown: !!selected['最大回撤'],
    });
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
    const rawUnrealizedValues = [...netUnrealized];

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

    // 4. 构建图例配置
    const legendItems = ['浮动资产(净值)', '总资产(净值)', '原始浮动资产', '最大回撤'];
    const legendSelection = {
      '浮动资产(净值)': showCurves.floatingAssets,
      '总资产(净值)': showCurves.totalAssets,
      '原始浮动资产': showCurves.rawFloatingAssets,
      '最大回撤': showCurves.maxDrawdown,
    };

    // 5. 计算y轴范围（自动适应）
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

    const rawValues = showCurves.rawFloatingAssets ? rawUnrealizedValues : [];
    const rawMin = rawValues.length > 0 ? Math.min(...rawValues) : 0;
    const rawMax = rawValues.length > 0 ? Math.max(...rawValues) : 0;
    const rawRange = rawMax - rawMin;
    const rawPadding = rawValues.length > 0
      ? (rawRange > 0 ? rawRange * 0.1 : Math.max(Math.abs(rawMax) * 0.1, 1))
      : 0;

    const navAxisVisible = assetValues.length > 0 && (showCurves.floatingAssets || showCurves.totalAssets);
    const navAxisPosition = showCurves.rawFloatingAssets ? 'right' : 'left';
    const drawdownOffset = navAxisVisible && navAxisPosition === 'right' ? 60 : 0;

    const rawAxisIndex = 0;
    const navAxisIndex = 1;
    const drawdownAxisIndex = 2;

    const yAxis = [
      {
        type: 'value',
        name: '浮动资产 (原始值)',
        position: 'left',
        min: rawMin - rawPadding,
        max: rawMax + rawPadding,
        axisLabel: {
          formatter: (value) => formatLargeNumber(value),
        },
        show: showCurves.rawFloatingAssets,
      },
      {
        type: 'value',
        name: '净值',
        position: navAxisPosition,
        offset: 0,
        min: assetMin - assetPadding,
        max: assetMax + assetPadding,
        axisLabel: {
          formatter: (value) => value.toFixed(3),
        },
        show: navAxisVisible,
      },
      {
        type: 'value',
        name: '最大回撤',
        position: 'right',
        offset: drawdownOffset,
        min: drawdownMin - drawdownPadding,
        max: drawdownMax + drawdownPadding,
        axisLabel: {
          formatter: (value) => `${(value * 100).toFixed(1)}%`,
        },
        show: showCurves.maxDrawdown,
      },
    ];

    // 6. 构建系列数据
    const series = [];
    series.push({
      name: '原始浮动资产',
      type: 'line',
      yAxisIndex: rawAxisIndex,
      data: rawUnrealizedValues,
      smooth: true,
      itemStyle: { color: '#722ed1' },
    });
    series.push({
      name: '浮动资产(净值)',
      type: 'line',
      yAxisIndex: navAxisIndex,
      data: navUnrealizedValues,
      smooth: true,
      itemStyle: { color: '#1890ff' },
    });
    series.push({
      name: '总资产(净值)',
      type: 'line',
      yAxisIndex: navAxisIndex,
      data: navRealizedValues,
      smooth: true,
      itemStyle: { color: '#52c41a' },
    });
    series.push({
      name: '最大回撤',
      type: 'line',
      yAxisIndex: drawdownAxisIndex,
      data: maxDrawdown,
      smooth: true,
      lineStyle: { 
        width: 1,
        color: 'rgba(255, 77, 79, 0.5)',
      },
      itemStyle: { 
        color: 'rgba(255, 77, 79, 0.5)',
      },
      areaStyle: {
        color: 'rgba(255, 77, 79, 0.15)',
      },
      symbol: 'none',
      symbolSize: 0,
    });

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
            } else if (param.seriesName === '原始浮动资产') {
              result += `${param.marker}${param.seriesName}: ${Number(param.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD<br/>`;
            } else {
              const percentage = ((param.value - 1) * 100).toFixed(2);
              result += `${param.marker}${param.seriesName}: ${param.value.toFixed(4)} (${percentage >= 0 ? '+' : ''}${percentage}%)<br/>`;
            }
          });
          return result;
        },
      },
      legend: {
        data: legendItems,
        selected: legendSelection,
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
      yAxis,
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
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
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
          itemStyle: {
            color: (params) => {
              const colors = [
                '#667eea', '#764ba2', '#f093fb', '#f5576c',
                '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
                '#fa709a', '#fee140', '#30cfd0', '#a8edea',
              ];
              return colors[params.dataIndex % colors.length];
            },
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(102, 126, 234, 0.5)',
            },
          },
        },
      ],
    };
  };

  // 固定布局配置
  const widgetConfig = {
    assetOverview: {
      title: '资产总览',
      render: () => {
        // 更优雅的配色方案 - 浅蓝色主题，柔和渐变
        const cardStyles = [
          { 
            background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
            borderLeft: '4px solid #38bdf8',
            iconColor: '#0284c7',
          },
          { 
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            borderLeft: '4px solid #60a5fa',
            iconColor: '#2563eb',
          },
          { 
            background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
            borderLeft: '4px solid #818cf8',
            iconColor: '#4f46e5',
          },
          { 
            background: assetOverview?.unrealizedPnl >= 0 
              ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
              : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            borderLeft: `4px solid ${assetOverview?.unrealizedPnl >= 0 ? '#10b981' : '#ef4444'}`,
            iconColor: assetOverview?.unrealizedPnl >= 0 ? '#059669' : '#dc2626',
          },
          { 
            background: assetOverview?.unrealizedPnlLong >= 0
              ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
              : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            borderLeft: `4px solid ${assetOverview?.unrealizedPnlLong >= 0 ? '#3b82f6' : '#ef4444'}`,
            iconColor: assetOverview?.unrealizedPnlLong >= 0 ? '#2563eb' : '#dc2626',
          },
          { 
            background: assetOverview?.unrealizedPnlShort >= 0
              ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
              : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            borderLeft: `4px solid ${assetOverview?.unrealizedPnlShort >= 0 ? '#f59e0b' : '#ef4444'}`,
            iconColor: assetOverview?.unrealizedPnlShort >= 0 ? '#d97706' : '#dc2626',
          },
          { 
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            borderLeft: '4px solid #3b82f6',
            iconColor: '#2563eb',
          },
          { 
            background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
            borderLeft: '4px solid #f472b6',
            iconColor: '#db2777',
          },
          { 
            background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
            borderLeft: '4px solid #8b5cf6',
            iconColor: '#7c3aed',
          },
          { 
            background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
            borderLeft: '4px solid #ec4899',
            iconColor: '#db2777',
          },
          { 
            background: assetOverview?.riskExposure >= 0
              ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
              : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            borderLeft: `4px solid ${assetOverview?.riskExposure >= 0 ? '#10b981' : '#ef4444'}`,
            iconColor: assetOverview?.riskExposure >= 0 ? '#059669' : '#dc2626',
          },
          { 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderLeft: '4px solid #fbbf24',
            iconColor: '#d97706',
          },
        ];
        return (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[0].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: '1px solid #e0f2fe',
                borderLeft: cardStyles[0].borderLeft,
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
                title={<span style={{ color: cardStyles[0].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>浮动资产 (CNY)</span>}
                value={assetOverview?.floatingAssetsCNY || 0}
                prefix={<span style={{ color: cardStyles[0].iconColor, fontSize: 18, marginRight: 4 }}>¥</span>}
                precision={2}
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20, marginBottom: 0 }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[1].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: '1px solid #dbeafe',
                borderLeft: cardStyles[1].borderLeft,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Statistic
                title={<span style={{ color: cardStyles[1].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>浮动资产 (USD)</span>}
                value={assetOverview?.floatingAssetsUSD || 0}
                prefix={<DollarOutlined style={{ color: cardStyles[1].iconColor, fontSize: 18 }} />}
                precision={2}
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20, marginBottom: 0 }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[2].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: '1px solid #e0e7ff',
                borderLeft: cardStyles[2].borderLeft,
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
                title={<span style={{ color: cardStyles[2].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>总资产 (USD)</span>}
                value={assetOverview?.totalAssets || 0}
                prefix={<WalletOutlined style={{ color: cardStyles[2].iconColor, fontSize: 18 }} />}
                precision={2}
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20, marginBottom: 0 }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[3].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: `1px solid ${assetOverview?.unrealizedPnl >= 0 ? '#d1fae5' : '#fee2e2'}`,
                borderLeft: cardStyles[3].borderLeft,
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
                title={<span style={{ color: cardStyles[3].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>未实现盈亏 (USD)</span>}
                value={assetOverview?.unrealizedPnl || 0}
                prefix={assetOverview?.unrealizedPnl >= 0 
                  ? <RiseOutlined style={{ color: cardStyles[3].iconColor, fontSize: 18 }} />
                  : <FallOutlined style={{ color: cardStyles[3].iconColor, fontSize: 18 }} />
                }
                precision={2}
                valueStyle={{ 
                  color: cardStyles[3].iconColor, 
                  fontWeight: 700, 
                  fontSize: 20,
                  marginBottom: 0
                }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[4].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: `1px solid ${assetOverview?.unrealizedPnlLong >= 0 ? '#dbeafe' : '#fee2e2'}`,
                borderLeft: cardStyles[4].borderLeft,
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
                title={<span style={{ color: cardStyles[4].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>未实现盈亏(多头)</span>}
                value={assetOverview?.unrealizedPnlLong || 0}
                prefix={<ThunderboltOutlined style={{ color: cardStyles[4].iconColor, fontSize: 18 }} />}
                precision={2}
                valueStyle={{ 
                  color: cardStyles[4].iconColor, 
                  fontWeight: 700, 
                  fontSize: 20,
                  marginBottom: 0
                }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[5].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: `1px solid ${assetOverview?.unrealizedPnlShort >= 0 ? '#fef3c7' : '#fee2e2'}`,
                borderLeft: cardStyles[5].borderLeft,
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
                title={<span style={{ color: cardStyles[5].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>未实现盈亏(空头)</span>}
                value={assetOverview?.unrealizedPnlShort || 0}
                prefix={<ThunderboltOutlined style={{ color: cardStyles[5].iconColor, fontSize: 18 }} />}
                precision={2}
                valueStyle={{ 
                  color: cardStyles[5].iconColor, 
                  fontWeight: 700, 
                  fontSize: 20,
                  marginBottom: 0
                }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[6].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: '1px solid #dbeafe',
                borderLeft: cardStyles[6].borderLeft,
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
                title={<span style={{ color: cardStyles[6].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>多头市值 (USD)</span>}
                value={assetOverview?.longMarketValue || 0}
                prefix={<RiseOutlined style={{ color: cardStyles[6].iconColor, fontSize: 18 }} />}
                precision={2}
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20, marginBottom: 0 }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[7].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: '1px solid #fce7f3',
                borderLeft: cardStyles[7].borderLeft,
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
                title={<span style={{ color: cardStyles[7].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>空头市值 (USD)</span>}
                value={assetOverview?.shortMarketValue || 0}
                prefix={<FallOutlined style={{ color: cardStyles[7].iconColor, fontSize: 18 }} />}
                precision={2}
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20, marginBottom: 0 }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[8].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: '1px solid #e0e7ff',
                borderLeft: cardStyles[8].borderLeft,
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
                title={<span style={{ color: cardStyles[8].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>多头杠杆率</span>}
                value={assetOverview?.longLeverage || 0}
                prefix={<StockOutlined style={{ color: cardStyles[8].iconColor, fontSize: 18 }} />}
                precision={4}
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20, marginBottom: 0 }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[9].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: '1px solid #fce7f3',
                borderLeft: cardStyles[9].borderLeft,
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
                title={<span style={{ color: cardStyles[9].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>空头杠杆率</span>}
                value={assetOverview?.shortLeverage || 0}
                prefix={<StockOutlined style={{ color: cardStyles[9].iconColor, fontSize: 18 }} />}
                precision={4}
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20, marginBottom: 0 }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[10].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: `1px solid ${assetOverview?.riskExposure >= 0 ? '#d1fae5' : '#fee2e2'}`,
                borderLeft: cardStyles[10].borderLeft,
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
                title={<span style={{ color: cardStyles[10].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>风险敞口</span>}
                value={assetOverview?.riskExposure || 0}
                prefix={<SafetyCertificateOutlined style={{ color: cardStyles[10].iconColor, fontSize: 18 }} />}
                precision={4}
                valueStyle={{ 
                  color: cardStyles[10].iconColor, 
                  fontWeight: 700, 
                  fontSize: 20,
                  marginBottom: 0
                }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card 
              size="small" 
              bodyStyle={{ 
                padding: '12px 16px 8px 16px',
                background: cardStyles[11].background,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
              style={{ 
                border: '1px solid #fef3c7',
                borderLeft: cardStyles[11].borderLeft,
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
                title={<span style={{ color: cardStyles[11].iconColor, fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'block' }}>美元兑RMB汇率</span>}
                value={assetOverview?.usdToCnyRate || 0}
                prefix={<BarChartOutlined style={{ color: cardStyles[11].iconColor, fontSize: 18 }} />}
                precision={4}
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20, marginBottom: 0 }}
                style={{ margin: 0, padding: 0 }}
              />
            </Card>
          </Col>
        </Row>
        );
      },
    },
    equityCurve: {
      title: '资金曲线',
      render: () => (
        <Card
          title={
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              <DashboardOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              资金曲线
            </span>
          }
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
                <Option value="90d">90天</Option>
                <Option value="120d">120天</Option>
                <Option value="180d">半年</Option>
                <Option value="1y">1年</Option>
                <Option value="2y">2年</Option>
                <Option value="3y">3年</Option>
                <Option value="5y">5年</Option>
                <Option value="10y">10年</Option>
              </Select>
            </Space>
          }
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: 8,
          }}
        >
          <ReactECharts 
            className="chart-container"
            option={getEquityCurveOption()} 
            notMerge={true}
            lazyUpdate={false}
            onEvents={{ legendselectchanged: handleLegendSelectChange }}
            key={`equity-curve-${timeWindow}-${JSON.stringify(showCurves)}-${equityCurve.length}`}
          />
        </Card>
      ),
    },
    periodPnl: {
      title: '周期盈亏',
      render: () => (
        <Card
          title={
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              <BarChartOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              周期盈亏
            </span>
          }
          extra={
            <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
              <Option value="day">按天</Option>
              <Option value="week">按周</Option>
              <Option value="month">按月</Option>
            </Select>
          }
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: 8,
          }}
        >
          <ReactECharts className="chart-container" option={getPeriodPnlOption()} />
        </Card>
      ),
    },
    assetDistribution: {
      title: '资产分布',
      render: () => (
        <Card 
          title={
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              <PieChartOutlined style={{ marginRight: 8, color: '#722ed1' }} />
              资产分布
            </span>
          }
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: 8,
          }}
        >
          <ReactECharts className="chart-container" option={getAssetDistributionOption()} />
        </Card>
      ),
    },
    hostsStatus: {
      title: '服务器状态',
      render: () => (
        <Card 
          title={
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              <MonitorOutlined style={{ marginRight: 8, color: '#1890ff' }} />
              服务器状态
            </span>
          }
          size="small"
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: 8,
          }}
        >
          <div className="table-scroll">
            <Table
              dataSource={hostsStatus}
              rowKey="hostname"
              pagination={false}
              size="small"
              className="admin-table-styled"
              style={{
                borderRadius: 8,
                overflow: 'hidden',
              }}
              rowClassName={(record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
              columns={[
                { 
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>主机名</span>, 
                  dataIndex: 'hostname', 
                  key: 'hostname',
                  render: (text) => <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span>
                },
                {
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>磁盘使用率</span>,
                  dataIndex: 'diskUsed',
                  key: 'diskUsed',
                  align: 'right',
                  render: (value) => (
                    <span style={{ 
                      color: value > 90 ? '#ef4444' : '#10b981',
                      fontWeight: 600,
                      fontSize: 13
                    }}>
                      {value ? `${value.toFixed(2)}%` : '-'}
                    </span>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>磁盘空闲率</span>,
                  dataIndex: 'diskFree',
                  key: 'diskFree',
                  align: 'right',
                  render: (value) => (
                    <span style={{ 
                      color: value < 20 ? '#ef4444' : value < 40 ? '#f59e0b' : '#10b981',
                      fontWeight: 600,
                      fontSize: 13
                    }}>
                      {value ? `${value.toFixed(2)}%` : '-'}
                    </span>
                  ),
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
        <Card 
          title={
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              <DeploymentUnitOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              策略状态
            </span>
          }
          size="small"
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: 8,
          }}
        >
          <div className="table-scroll">
            <Table
              dataSource={healthStatus}
              rowKey={(record) => `${record.hostname}-${record.accountName}-${record.strategyName}`}
              pagination={false}
              size="small"
              className="admin-table-styled"
              style={{
                borderRadius: 8,
                overflow: 'hidden',
              }}
              rowClassName={(record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
              columns={[
                { 
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>主机名</span>, 
                  dataIndex: 'hostname', 
                  key: 'hostname',
                  render: (text) => <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span>
                },
                { 
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>账户</span>, 
                  dataIndex: 'accountName', 
                  key: 'accountName',
                  render: (text) => <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span>
                },
                { 
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>策略</span>, 
                  dataIndex: 'strategyName', 
                  key: 'strategyName',
                  render: (text) => <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span>
                },
                {
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>运行时间</span>,
                  dataIndex: 'runTime',
                  key: 'runTime',
                  render: (text) => {
                    if (!text) {
                      return <span style={{ color: '#64748b', fontSize: 12, fontWeight: 500 }}>-</span>;
                    }
                    const runTime = new Date(text);
                    const now = new Date();
                    const diffMinutes = (now - runTime) / (1000 * 60);
                    const isOver65Minutes = diffMinutes > 65;
                    const formattedTime = runTime.toLocaleString('zh-CN');
                    return (
                      <span style={{ 
                        color: isOver65Minutes ? '#ef4444' : '#10b981', 
                        fontSize: 12, 
                        fontWeight: 500 
                      }}>
                        {formattedTime}
                      </span>
                    );
                  },
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
        <Card 
          title={
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              <DatabaseOutlined style={{ marginRight: 8, color: '#722ed1' }} />
              进程状态
            </span>
          }
          size="small"
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: 8,
          }}
        >
          <div 
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              overflowX: 'auto',
            }}
          >
            <Table
              dataSource={processStatus}
              rowKey={(record) => `${record.hostname}-${record.name}`}
              pagination={false}
              size="small"
              className="admin-table-styled"
              scroll={{ y: 350 }}
              style={{
                borderRadius: 8,
                overflow: 'hidden',
              }}
              rowClassName={(record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
              columns={[
                { 
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>主机名</span>, 
                  dataIndex: 'hostname', 
                  key: 'hostname',
                  render: (text) => <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span>
                },
                { 
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>进程名</span>, 
                  dataIndex: 'name', 
                  key: 'name',
                  render: (text) => <span style={{ fontWeight: 500, color: '#334155' }}>{text}</span>
                },
                {
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>状态</span>,
                  dataIndex: 'status',
                  key: 'status',
                  align: 'center',
                  render: (status) => {
                    const isOnline = status === 'online';
                    return (
                      <Tag 
                        color={isOnline ? 'success' : 'error'}
                        style={{ 
                          borderRadius: 12,
                          fontWeight: 600,
                          padding: '4px 12px',
                          margin: 0,
                          border: 'none',
                          backgroundColor: isOnline ? '#10b981' : '#ef4444',
                          color: '#fff',
                        }}
                      >
                        {isOnline ? '在线' : '离线'}
                      </Tag>
                    );
                  },
                },
                {
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>CPU</span>,
                  dataIndex: 'cpu',
                  key: 'cpu',
                  align: 'right',
                  render: (value) => (
                    <span style={{ 
                      color: value > 80 ? '#ef4444' : value > 50 ? '#f59e0b' : '#10b981',
                      fontWeight: 600,
                      fontSize: 13
                    }}>
                      {value ? `${value.toFixed(2)}%` : '-'}
                    </span>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600, color: '#0f172a' }}>内存</span>,
                  dataIndex: 'memory',
                  key: 'memory',
                  align: 'right',
                  render: (value) => (
                    <span style={{ color: '#64748b', fontWeight: 500, fontSize: 13 }}>
                      {value ? `${(value / 1024 / 1024).toFixed(2)} MB` : '-'}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </Card>
      ),
    },
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
      <style>{`
        .admin-table-styled .ant-table-thead > tr > th {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
          border-bottom: 2px solid #cbd5e1 !important;
          font-weight: 600 !important;
          color: #0f172a !important;
          padding: 12px 16px !important;
          font-size: 13px !important;
        }
        .admin-table-styled .ant-table-tbody > tr > td {
          padding: 12px 16px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          transition: all 0.2s ease !important;
        }
        .admin-table-styled .table-row-even {
          background: #ffffff !important;
        }
        .admin-table-styled .table-row-odd {
          background: #f8fafc !important;
        }
        .admin-table-styled .ant-table-tbody > tr:hover {
          background: #e0f2fe !important;
          transform: scale(1.01);
          box-shadow: 0 2px 8px rgba(29, 155, 240, 0.15);
        }
        .admin-table-styled .ant-table-container {
          border-radius: 8px;
          overflow: hidden;
        }
        .admin-table-styled .ant-table {
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
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <DashboardOutlined style={{ fontSize: 28 }} />
          管理员面板
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
                popupClassName="admin-select-dropdown"
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
            onClick={fetchAllData}
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

      {/* 固定布局 */}
      <Row gutter={[16, 16]}>
        {/* 资产总览 - 全宽 */}
        <Col xs={24}>
          {widgetConfig.assetOverview?.render()}
        </Col>

        {/* 资金曲线 - 全宽 */}
        <Col xs={24}>
          {widgetConfig.equityCurve?.render()}
        </Col>

        {/* 周期盈亏和资产分布 - 各占一半 */}
        <Col xs={24} lg={12}>
          {widgetConfig.periodPnl?.render()}
        </Col>
        <Col xs={24} lg={12}>
          {widgetConfig.assetDistribution?.render()}
        </Col>

        {/* 服务器状态、策略状态、进程状态 - 各占三分之一 */}
        <Col xs={24} sm={8}>
          {widgetConfig.hostsStatus?.render()}
        </Col>
        <Col xs={24} sm={8}>
          {widgetConfig.healthStatus?.render()}
        </Col>
        <Col xs={24} sm={8}>
          {widgetConfig.processStatus?.render()}
        </Col>
      </Row>
    </div>
  );
}

export default AdminDashboard;
