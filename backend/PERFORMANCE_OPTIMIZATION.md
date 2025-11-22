# 性能优化文档

## `/api/admin/dashboard/period-pnl` 接口优化

### 问题描述
原始接口响应时间过长（~8005ms），主要问题：
1. **循环查询**：对每个账户执行单独查询（最多100个账户 × 多次查询）
2. **GROUP_CONCAT 性能差**：大数据量时性能低下
3. **无时间范围限制**：扫描所有历史数据
4. **缓存时间短**：只有2分钟

### 优化方案

#### 1. 单次聚合查询
- **原来**：获取所有账户 → 对每个账户循环查询
- **现在**：使用单次 SQL 聚合查询所有账户数据

#### 2. 使用窗口函数（MySQL 8.0+）
```sql
WITH ranked_equity AS (
    SELECT 
        DATE(time) as period_date,
        email,
        net_unrealized,
        ROW_NUMBER() OVER (PARTITION BY DATE(time), email ORDER BY time ASC) as rn_first,
        ROW_NUMBER() OVER (PARTITION BY DATE(time), email ORDER BY time DESC) as rn_last
    FROM equity
    WHERE email IS NOT NULL 
      AND time >= %s
      AND net_unrealized IS NOT NULL
)
-- 聚合所有账户数据
```

#### 3. 时间范围限制
- **原来**：查询所有历史数据
- **现在**：只查询最近 N 天的数据（day: limit+5天, week: limit+2周, month: limit+2月）
- **效果**：大幅减少扫描的数据量

#### 4. 增加缓存时间
- **原来**：2分钟
- **现在**：5分钟（因为数据更新频率不高）

#### 5. 备用方案（MySQL < 8.0）
如果窗口函数不支持，使用分步查询：
1. 获取每个周期的第一个值
2. 获取每个周期的最后一个值
3. 获取每个周期的最大最小值
4. 在应用层聚合

### 预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 响应时间 | ~8005ms | <500ms | **16x** |
| 数据库查询次数 | ~100+ | 1-3 | **30x+** |
| 扫描数据量 | 全表 | 最近35天 | **显著减少** |

### 数据库索引建议

确保有以下索引（应该已经存在）：
```sql
CREATE INDEX idx_equity_email_time ON equity(email(768), time);
```

### 监控建议

1. **缓存命中率**：监控 Redis 缓存命中率
2. **查询时间**：记录每次查询的耗时
3. **数据量**：监控扫描的数据行数

### 进一步优化建议

如果性能仍然不够理想，可以考虑：

1. **物化视图**：为周期盈亏创建物化视图，定期更新
2. **数据表分区**：按时间分区 equity 表
3. **异步更新**：后台定时任务预计算并缓存结果
4. **读写分离**：使用从库查询历史数据

