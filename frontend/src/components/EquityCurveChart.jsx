import { useCallback, useEffect, useState } from 'react';
import { Card, Select, Space, Spin, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import api from '../store/api';

const { Option } = Select;

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

const calculateWindowDrawdownFromNav = (navValues) => {
  if (!navValues || navValues.length === 0) return [];
  const drawdowns = [];
  let peak = null;

  navValues.forEach((nav) => {
    if (peak === null || nav > peak) {
      peak = nav;
    }
    if (peak > 0) {
      const drawdown = (peak - nav) / peak;
      drawdowns.push(-drawdown);
    } else {
      drawdowns.push(0);
    }
  });

  return drawdowns;
};

function EquityCurveChart({ strategyId, isAdmin = false }) {
  const [loading, setLoading] = useState(false);
  const [equityCurve, setEquityCurve] = useState([]);
  const [timeWindow, setTimeWindow] = useState('30d');
  const [showCurves, setShowCurves] = useState({
    floatingAssets: true,
    totalAssets: false,
    rawFloatingAssets: false,
    maxDrawdown: true,
  });

  const updateEquityCurveState = (data, { preservePreviousOnEmpty = false } = {}) => {
    setEquityCurve((prev) => {
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      if (preservePreviousOnEmpty && prev && prev.length > 0) {
        return prev;
      }
      return [];
    });
  };

  const fetchEquityCurve = useCallback(async () => {
    try {
      setLoading(true);
      let url;
      if (isAdmin || !strategyId) {
        url = `/admin/dashboard/equity-curve-drawdown?timeRange=${timeWindow}`;
      } else {
        url = `/user/dashboard/equity/${strategyId}?timeRange=${timeWindow}`;
      }
      const response = await api.get(url);
      if (response.data.success) {
        updateEquityCurveState(response.data.data || []);
      } else {
        updateEquityCurveState([], { preservePreviousOnEmpty: true });
        message.warning('资金曲线返回为空，已保留上一份数据');
      }
    } catch (error) {
      message.error('获取资金曲线失败，展示上一次数据');
      updateEquityCurveState([], { preservePreviousOnEmpty: true });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, strategyId, timeWindow]);

  useEffect(() => {
    fetchEquityCurve();
  }, [fetchEquityCurve]);

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

  const getEquityCurveOption = () => {
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
          textStyle: { fontSize: 16, color: '#999' },
        };
      }

      return option;
    };

    if (!equityCurve || !Array.isArray(equityCurve) || equityCurve.length === 0) {
      return getBaseOption('暂无数据');
    }

    const filteredData = equityCurve.filter(
      (item) => item && (item.netUnrealized !== undefined || item.netRealized !== undefined)
    );

    if (filteredData.length === 0) {
      return getBaseOption('选定时间窗口内暂无数据');
    }

    const times = filteredData.map((item) => item.time || '').filter(Boolean);
    const netUnrealized = filteredData.map((item) => parseFloat(item.netUnrealized) || 0);
    const netRealized = filteredData.map((item) => parseFloat(item.netRealized) || 0);
    const rawUnrealizedValues = [...netUnrealized];

    const baseUnrealized = netUnrealized[0] || 1;
    const baseRealized = netRealized[0] || 1;

    const navUnrealizedValues = netUnrealized.map((value) =>
      baseUnrealized !== 0 ? value / baseUnrealized : 1
    );
    const navRealizedValues = netRealized.map((value) =>
      baseRealized !== 0 ? value / baseRealized : 1
    );

    const maxDrawdown = calculateWindowDrawdownFromNav(navUnrealizedValues);

    const legendItems = ['浮动资产(净值)', '总资产(净值)', '原始浮动资产', '最大回撤'];
    const legendSelection = {
      '浮动资产(净值)': showCurves.floatingAssets,
      '总资产(净值)': showCurves.totalAssets,
      '原始浮动资产': showCurves.rawFloatingAssets,
      '最大回撤': showCurves.maxDrawdown,
    };

    const assetValues = [];
    if (showCurves.floatingAssets) assetValues.push(...navUnrealizedValues);
    if (showCurves.totalAssets) assetValues.push(...navRealizedValues);

    const assetMin = assetValues.length > 0 ? Math.min(...assetValues) : 0;
    const assetMax = assetValues.length > 0 ? Math.max(...assetValues) : 1;
    const assetRange = assetMax - assetMin;
    const assetPadding = assetRange > 0 ? assetRange * 0.1 : 0.1;

    const drawdownMin =
      showCurves.maxDrawdown && maxDrawdown.length > 0 ? Math.min(...maxDrawdown) : -1;
    const drawdownMax =
      showCurves.maxDrawdown && maxDrawdown.length > 0 ? Math.max(...maxDrawdown) : 0;
    const drawdownRange = drawdownMax - drawdownMin;
    const drawdownPadding = drawdownRange > 0 ? drawdownRange * 0.1 : 0.1;

    const rawValues = showCurves.rawFloatingAssets ? rawUnrealizedValues : [];
    const rawMin = rawValues.length > 0 ? Math.min(...rawValues) : 0;
    const rawMax = rawValues.length > 0 ? Math.max(...rawValues) : 0;
    const rawRange = rawMax - rawMin;
    const rawPadding =
      rawValues.length > 0
        ? rawRange > 0
          ? rawRange * 0.1
          : Math.max(Math.abs(rawMax) * 0.1, 1)
        : 0;

    const navAxisVisible =
      assetValues.length > 0 && (showCurves.floatingAssets || showCurves.totalAssets);
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

    const series = [
      {
        name: '原始浮动资产',
        type: 'line',
        yAxisIndex: rawAxisIndex,
        data: rawUnrealizedValues,
        smooth: true,
        itemStyle: { color: '#722ed1' },
      },
      {
        name: '浮动资产(净值)',
        type: 'line',
        yAxisIndex: navAxisIndex,
        data: navUnrealizedValues,
        smooth: true,
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '总资产(净值)',
        type: 'line',
        yAxisIndex: navAxisIndex,
        data: navRealizedValues,
        smooth: true,
        itemStyle: { color: '#52c41a' },
      },
      {
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
      },
    ];

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((param) => {
            if (param.seriesName === '最大回撤') {
              result += `${param.marker}${param.seriesName}: ${(param.value * 100).toFixed(2)}%<br/>`;
            } else if (param.seriesName === '原始浮动资产') {
              result += `${param.marker}${param.seriesName}: ${Number(param.value).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} USD<br/>`;
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
      series,
    };
  };

  return (
    <Card
      title="资金曲线"
      extra={
        <Space>
          <Select value={timeWindow} onChange={setTimeWindow} style={{ width: 120 }}>
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
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
        </div>
      ) : (
        <ReactECharts
          className="chart-container"
          option={getEquityCurveOption()}
          notMerge={true}
          lazyUpdate={false}
          onEvents={{ legendselectchanged: handleLegendSelectChange }}
          style={{ height: 450 }}
          key={`strategy-equity-${strategyId || 'all'}-${timeWindow}-${JSON.stringify(showCurves)}-${equityCurve.length}`}
        />
      )}
    </Card>
  );
}

export default EquityCurveChart;

