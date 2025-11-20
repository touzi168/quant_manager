import { useEffect, useState } from 'react';
import { Card, Select, Checkbox, Spin, Row, Col, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import api from '../store/api';

const { Option } = Select;

function EquityCurveChart({ strategyId, isAdmin = false }) {
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [timeRange, setTimeRange] = useState('30d');
  const [displayCurves, setDisplayCurves] = useState(['net_unrealized', 'max_drawdown']);

  const availableCurves = [
    { key: 'net_unrealized', name: '总资金(含未实现盈亏)', color: '#1890ff' },
    { key: 'net_realized', name: '净实现资金', color: '#52c41a' },
    { key: 'max_drawdown', name: '最大回撤', color: '#f5222d' },
  ];

  const timeRangeOptions = [
    { value: '7d', label: '7天' },
    { value: '30d', label: '30天' },
    { value: '60d', label: '60天' },
    { value: '90d', label: '90天' },
    { value: '120d', label: '120天' },
    { value: '180d', label: '180天' },
    { value: '360d', label: '360天' },
    { value: '720d', label: '720天' },
  ];

  useEffect(() => {
    fetchEquityData();
  }, [strategyId, timeRange, isAdmin]);

  const fetchEquityData = async () => {
    try {
      setLoading(true);
      let url;
      if (isAdmin || !strategyId) {
        // 管理员模式，获取总资金曲线
        url = `/admin/dashboard/equity-curve?timeRange=${timeRange}`;
      } else {
        // 用户模式，获取策略资金曲线
        url = `/user/dashboard/equity/${strategyId}?timeRange=${timeRange}`;
      }
      
      const response = await api.get(url);
      if (response.data.success) {
        setChartData(response.data.data);
      }
    } catch (error) {
      message.error('获取资金曲线数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getChartOption = () => {
    if (!chartData || chartData.length === 0) {
      return {};
    }

    const series = [];
    const times = chartData.map((item) => item.time);

    if (displayCurves.includes('net_unrealized')) {
      series.push({
        name: '总资金(含未实现盈亏)',
        type: 'line',
        data: chartData.map((item) => item.netUnrealized || item.net_unrealized),
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.1)' },
            ],
          },
        },
      });
    }

    if (displayCurves.includes('net_realized')) {
      series.push({
        name: '净实现资金',
        type: 'line',
        data: chartData.map((item) => item.netRealized || item.net_realized),
        smooth: true,
      });
    }

    if (displayCurves.includes('max_drawdown')) {
      series.push({
        name: '最大回撤',
        type: 'line',
        yAxisIndex: 1,
        data: chartData.map((item) => item.maxDrawdown || item.max_drawdown || 0),
        smooth: true,
        lineStyle: { color: '#f5222d' },
      });
    }

    return {
      title: {
        text: '资金曲线分析',
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          let tooltip = `${params[0].name}<br/>`;
          params.forEach((param) => {
            if (param.seriesName.includes('回撤')) {
              tooltip += `${param.seriesName}: ${param.value.toFixed(2)}%<br/>`;
            } else {
              tooltip += `${param.seriesName}: ${param.value.toFixed(2)} USDT<br/>`;
            }
          });
          return tooltip;
        },
      },
      legend: {
        data: displayCurves.map((key) =>
          availableCurves.find((c) => c.key === key)?.name
        ),
        bottom: 10,
      },
      xAxis: {
        type: 'category',
        data: times,
      },
      yAxis: [
        {
          type: 'value',
          name: '资金 (USDT)',
          position: 'left',
        },
        {
          type: 'value',
          name: '回撤 (%)',
          position: 'right',
          min: 0,
          max: 100,
        },
      ],
      series,
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          start: 0,
          end: 100,
          height: 30,
        },
      ],
    };
  };

  return (
    <Card
      title="资金曲线分析"
      extra={
        <Select
          value={timeRange}
          style={{ width: 120 }}
          onChange={(value) => {
            setTimeRange(value);
          }}
        >
          {timeRangeOptions.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Checkbox.Group
              value={displayCurves}
              onChange={setDisplayCurves}
            >
              <Row gutter={[16, 8]}>
                {availableCurves.map((curve) => (
                  <Col span={8} key={curve.key}>
                    <Checkbox value={curve.key}>{curve.name}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </div>
          <ReactECharts
            option={getChartOption()}
            style={{ height: '450px', width: '100%' }}
          />
        </div>
      )}
    </Card>
  );
}

export default EquityCurveChart;

