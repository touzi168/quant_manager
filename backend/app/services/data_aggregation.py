from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from app.core.database import execute_query
from app.core.redis_client import redis_get, redis_set
from app.utils.logger import logger

async def get_asset_summary(email: Optional[str] = None, strategy_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """获取资产汇总"""
    try:
        cache_key = "asset_summary"
        if email:
            cache_key += f":{email}"
        if strategy_id:
            cache_key += f":{strategy_id}"
        
        # 尝试从缓存获取
        cached = await redis_get(cache_key)
        if cached:
            return cached
        
        sql = """
            SELECT 
                email,
                exchange,
                trade_type,
                SUM(total) as total_assets,
                SUM(free) as free_assets,
                SUM(locked) as locked_assets,
                SUM(unpnl) as unrealized_pnl
            FROM assets
            WHERE time = (SELECT MAX(time) FROM assets)
        """
        
        params = []
        if email:
            sql += " AND email = %s"
            params.append(email)
        
        if strategy_id:
            # 通过策略ID查找关联的账户邮箱
            strategies = execute_query(
                "SELECT account_email FROM strategies WHERE id = %s",
                (strategy_id,)
            )
            if strategies:
                sql += " AND email = %s"
                params.append(strategies[0]["account_email"])
        
        sql += " GROUP BY email, exchange, trade_type"
        
        result = execute_query(sql, tuple(params) if params else None)
        
        # 转换为字典列表
        result_list = [
            {
                "email": r["email"],
                "exchange": r["exchange"],
                "tradeType": r["trade_type"],
                "totalAssets": float(r["total_assets"]) if r["total_assets"] else 0,
                "freeAssets": float(r["free_assets"]) if r["free_assets"] else 0,
                "lockedAssets": float(r["locked_assets"]) if r["locked_assets"] else 0,
                "unrealizedPnl": float(r["unrealized_pnl"]) if r["unrealized_pnl"] else 0
            }
            for r in result
        ]
        
        # 缓存5分钟
        await redis_set(cache_key, result_list, ttl=300)
        
        return result_list
    except Exception as e:
        logger.error(f"获取资产汇总失败: {e}")
        raise

async def get_position_summary(email: Optional[str] = None, strategy_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """获取持仓汇总"""
    try:
        cache_key = "position_summary"
        if email:
            cache_key += f":{email}"
        if strategy_id:
            cache_key += f":{strategy_id}"
        
        # 尝试从缓存获取
        cached = await redis_get(cache_key)
        if cached:
            return cached
        
        sql = """
            SELECT 
                email,
                exchange,
                trade_type,
                symbol,
                SUM(positionAmt) as total_position,
                AVG(entryPrice) as avg_entry_price,
                AVG(markPrice) as avg_mark_price,
                SUM(unRealizedProfit) as total_unrealized_profit,
                AVG(leverage) as avg_leverage
            FROM positions
            WHERE time = (SELECT MAX(time) FROM positions)
                AND positionAmt != 0
        """
        
        params = []
        if email:
            sql += " AND email = %s"
            params.append(email)
        
        if strategy_id:
            strategies = execute_query(
                "SELECT account_email FROM strategies WHERE id = %s",
                (strategy_id,)
            )
            if strategies:
                sql += " AND email = %s"
                params.append(strategies[0]["account_email"])
        
        sql += " GROUP BY email, exchange, trade_type, symbol"
        
        result = execute_query(sql, tuple(params) if params else None)
        
        result_list = [
            {
                "email": r["email"],
                "exchange": r["exchange"],
                "tradeType": r["trade_type"],
                "symbol": r["symbol"],
                "totalPosition": float(r["total_position"]) if r["total_position"] else 0,
                "avgEntryPrice": float(r["avg_entry_price"]) if r["avg_entry_price"] else 0,
                "avgMarkPrice": float(r["avg_mark_price"]) if r["avg_mark_price"] else 0,
                "totalUnrealizedProfit": float(r["total_unrealized_profit"]) if r["total_unrealized_profit"] else 0,
                "avgLeverage": float(r["avg_leverage"]) if r["avg_leverage"] else 0
            }
            for r in result
        ]
        
        # 缓存5分钟
        await redis_set(cache_key, result_list, ttl=300)
        
        return result_list
    except Exception as e:
        logger.error(f"获取持仓汇总失败: {e}")
        raise

async def get_equity_curve(email: str, strategy_id: Optional[int] = None, time_range: str = "30d") -> List[Dict[str, Any]]:
    """获取资金曲线数据"""
    try:
        cache_key = f"equity_curve:{email}:{time_range}"
        if strategy_id:
            cache_key += f":{strategy_id}"
        
        # 尝试从缓存获取
        cached = await redis_get(cache_key)
        if cached:
            return cached
        
        # 计算时间范围
        days = int(time_range.replace("d", ""))
        start_date = datetime.utcnow() - timedelta(days=days)
        
        sql = None
        params = (email, start_date)
        
        # 根据时间范围选择查询策略
        if time_range == "7d":
            # 短期：直接查询原始数据
            sql = """
                SELECT 
                    time,
                    net_realized,
                    net_unrealized,
                    long_valuation,
                    short_valuation,
                    uniMMR
                FROM equity 
                WHERE email = %s AND time >= %s
                ORDER BY time ASC
            """
        else:
            # 长期：重采样为1小时数据
            sql = """
                SELECT 
                    DATE_FORMAT(time, '%%Y-%%m-%%d %%H:00:00') as time,
                    AVG(net_realized) as net_realized,
                    AVG(net_unrealized) as net_unrealized,
                    AVG(long_valuation) as long_valuation,
                    AVG(short_valuation) as short_valuation,
                    AVG(uniMMR) as uniMMR
                FROM equity 
                WHERE email = %s AND time >= %s
                GROUP BY DATE_FORMAT(time, '%%Y-%%m-%%d %%H:00:00')
                ORDER BY time ASC
            """
        
        result = execute_query(sql, params)
        
        # 计算最大回撤
        result_list = []
        peak = None
        max_drawdown = 0
        
        for r in result:
            net_unrealized = float(r["net_unrealized"]) if r["net_unrealized"] else 0
            if peak is None or net_unrealized > peak:
                peak = net_unrealized
            
            if peak > 0:
                drawdown = ((peak - net_unrealized) / peak) * 100
                if drawdown > max_drawdown:
                    max_drawdown = drawdown
            
            result_list.append({
                "time": r["time"].isoformat() if isinstance(r["time"], datetime) else str(r["time"]),
                "netRealized": float(r["net_realized"]) if r["net_realized"] else 0,
                "netUnrealized": net_unrealized,
                "longValuation": float(r["long_valuation"]) if r["long_valuation"] else 0,
                "shortValuation": float(r["short_valuation"]) if r["short_valuation"] else 0,
                "uniMMR": float(r["uniMMR"]) if r["uniMMR"] else 0,
                "maxDrawdown": max_drawdown
            })
        
        # 缓存10分钟
        await redis_set(cache_key, result_list, ttl=600)
        
        return result_list
    except Exception as e:
        logger.error(f"获取资金曲线失败: {e}")
        raise

async def get_health_status(hostname: Optional[str] = None) -> List[Dict[str, Any]]:
    """获取健康状态"""
    try:
        cache_key = "health_status"
        if hostname:
            cache_key += f":{hostname}"
        
        # 尝试从缓存获取
        cached = await redis_get(cache_key)
        if cached:
            return cached
        
        sql = """
            SELECT 
                h.hostname,
                h.account_name,
                h.strategy_name,
                h.run_time,
                h.returns,
                h.report_time,
                ho.disk_used,
                ho.disk_free,
                ho.swap_date,
                ho.spot_date
            FROM health h
            LEFT JOIN hosts ho ON h.hostname = ho.hostname
        """
        
        params = None
        if hostname:
            sql += " WHERE h.hostname = %s"
            params = (hostname,)
        
        sql += " ORDER BY h.report_time DESC"
        
        result = execute_query(sql, params)
        
        result_list = [
            {
                "hostname": r["hostname"],
                "accountName": r["account_name"],
                "strategyName": r["strategy_name"],
                "runTime": r["run_time"].isoformat() if isinstance(r["run_time"], datetime) else str(r["run_time"]),
                "returns": r["returns"],
                "reportTime": r["report_time"].isoformat() if isinstance(r["report_time"], datetime) else str(r["report_time"]),
                "diskUsed": float(r["disk_used"]) if r["disk_used"] else None,
                "diskFree": float(r["disk_free"]) if r["disk_free"] else None,
                "swapDate": r["swap_date"].isoformat() if isinstance(r["swap_date"], datetime) else str(r["swap_date"]),
                "spotDate": r["spot_date"].isoformat() if isinstance(r["spot_date"], datetime) else str(r["spot_date"])
            }
            for r in result
        ]
        
        # 缓存1分钟
        await redis_set(cache_key, result_list, ttl=60)
        
        return result_list
    except Exception as e:
        logger.error(f"获取健康状态失败: {e}")
        raise

async def get_process_status(hostname: Optional[str] = None) -> List[Dict[str, Any]]:
    """获取进程状态"""
    try:
        sql = """
            SELECT 
                hostname,
                name,
                pid,
                uptime,
                status,
                restart_time,
                pm_id,
                memory,
                cpu,
                runtime
            FROM processes
        """
        
        params = None
        if hostname:
            sql += " WHERE hostname = %s"
            params = (hostname,)
        
        sql += " ORDER BY hostname, name"
        
        result = execute_query(sql, params)
        
        return [
            {
                "hostname": r["hostname"],
                "name": r["name"],
                "pid": r["pid"],
                "uptime": r["uptime"].isoformat() if isinstance(r["uptime"], datetime) else str(r["uptime"]),
                "status": r["status"],
                "restartTime": r["restart_time"],
                "pmId": r["pm_id"],
                "memory": r["memory"],
                "cpu": float(r["cpu"]) if r["cpu"] else None,
                "runtime": r["runtime"]
            }
            for r in result
        ]
    except Exception as e:
        logger.error(f"获取进程状态失败: {e}")
        raise

async def get_strategy_summary(strategy_id: int) -> Dict[str, Any]:
    """获取策略汇总数据"""
    try:
        # 获取策略信息
        strategies = execute_query(
            "SELECT id, name, description, account_email FROM strategies WHERE id = %s",
            (strategy_id,)
        )
        
        if not strategies:
            raise ValueError("策略不存在")
        
        strategy = strategies[0]
        email = strategy["account_email"]
        
        # 获取资产汇总
        assets = await get_asset_summary(email, strategy_id)
        
        # 获取持仓汇总
        positions = await get_position_summary(email, strategy_id)
        
        # 获取最新资金曲线点
        latest_equity = execute_query(
            "SELECT net_realized, net_unrealized FROM equity WHERE email = %s ORDER BY time DESC LIMIT 1",
            (email,)
        )
        
        # 获取健康状态
        health = await get_health_status()
        
        return {
            "strategy": {
                "id": strategy["id"],
                "name": strategy["name"],
                "description": strategy["description"],
                "accountEmail": strategy["account_email"]
            },
            "assets": assets[0] if assets else None,
            "positions": positions,
            "equity": {
                "netRealized": float(latest_equity[0]["net_realized"]) if latest_equity and latest_equity[0]["net_realized"] else 0,
                "netUnrealized": float(latest_equity[0]["net_unrealized"]) if latest_equity and latest_equity[0]["net_unrealized"] else 0
            } if latest_equity else None,
            "health": [h for h in health if h.get("accountName") == strategy["name"]]
        }
    except Exception as e:
        logger.error(f"获取策略汇总失败: {e}")
        raise

async def get_asset_overview() -> Dict[str, Any]:
    """获取资产总览数据 - 优化版本"""
    try:
        cache_key = "asset_overview:all"
        
        # 尝试从缓存获取（缓存1分钟）
        cached = await redis_get(cache_key)
        if cached:
            return cached
        
        # 获取最新资产快照时间
        latest_time = execute_query("SELECT MAX(time) as max_time FROM assets")
        if not latest_time or not latest_time[0]["max_time"]:
            result = {
                "floatingAssetsCNY": 0,
                "floatingAssetsUSD": 0,
                "totalAssets": 0,
                "unrealizedPnl": 0,
                "unrealizedPnlLong": 0,
                "unrealizedPnlShort": 0,
                "longMarketValue": 0,
                "shortMarketValue": 0,
                "longLeverage": 0,
                "shortLeverage": 0,
                "riskExposure": 0,
                "usdToCnyRate": 0,
            }
            await redis_set(cache_key, result, ttl=60)
            return result
        
        max_time = latest_time[0]["max_time"]
        
        # 使用聚合查询一次性获取所有资产数据
        assets = execute_query(
            "SELECT net_unrealized, unpnl, free, net_realized FROM assets WHERE time = %s",
            (max_time,)
        )
        
        # 获取最新持仓快照时间
        latest_position_time = execute_query("SELECT MAX(time) as max_time FROM positions")
        position_max_time = latest_position_time[0]["max_time"] if latest_position_time and latest_position_time[0]["max_time"] else None
        
        # 获取所有持仓数据
        positions = []
        if position_max_time:
            positions = execute_query(
                "SELECT positionAmt, unRealizedProfit, markPrice FROM positions WHERE time = %s",
                (position_max_time,)
            )
        
        # 计算各项指标
        total_net_unrealized = sum(float(a["net_unrealized"] or 0) for a in assets)
        total_net_realized = sum(float(a.get("net_realized") or 0) for a in assets)
        
        # 从positions表计算未实现盈亏
        total_unpnl = sum(float(p["unRealizedProfit"] or 0) for p in positions)
        
        # 多头和空头持仓
        long_positions = [p for p in positions if float(p["positionAmt"] or 0) > 0]
        short_positions = [p for p in positions if float(p["positionAmt"] or 0) < 0]
        
        # 未实现盈亏（多头和空头）
        long_unpnl = sum(float(p["unRealizedProfit"] or 0) for p in long_positions)
        short_unpnl = sum(float(p["unRealizedProfit"] or 0) for p in short_positions)
        
        # 多头和空头资产
        long_assets = [a for a in assets if float(a["free"] or 0) > 0]
        short_assets = [a for a in assets if float(a["free"] or 0) < 0]
        
        # 多头市值 = assets表中free>0的net_unrealized总和 + positions表中positionAmt>0的positionAmt*markPrice总和
        long_assets_value = sum(float(a["net_unrealized"] or 0) for a in long_assets)
        long_positions_value = sum(float(p["positionAmt"] or 0) * float(p["markPrice"] or 0) for p in long_positions)
        long_market_value = long_assets_value + long_positions_value
        
        # 空头市值 = assets表中free<0的net_unrealized总和 + positions表中positionAmt<0的positionAmt*markPrice绝对值总和
        short_assets_value = sum(float(a["net_unrealized"] or 0) for a in short_assets)
        short_positions_value = sum(abs(float(p["positionAmt"] or 0)) * float(p["markPrice"] or 0) for p in short_positions)
        short_market_value = short_assets_value + short_positions_value
        
        # 获取美元兑RMB汇率
        cny_rate = execute_query(
            "SELECT price FROM cny_rates WHERE exchange = 'binance' LIMIT 1"
        )
        usd_to_cny = float(cny_rate[0]["price"]) if cny_rate and cny_rate[0]["price"] else 7.0
        
        # 计算杠杆率
        long_leverage = (long_market_value / total_net_unrealized) if total_net_unrealized > 0 else 0
        short_leverage = (short_market_value / total_net_unrealized) if total_net_unrealized > 0 else 0
        risk_exposure = long_leverage - short_leverage
        
        result = {
            "floatingAssetsCNY": total_net_unrealized * usd_to_cny,
            "floatingAssetsUSD": total_net_unrealized,
            "totalAssets": total_net_realized,
            "unrealizedPnl": total_unpnl,
            "unrealizedPnlLong": long_unpnl,
            "unrealizedPnlShort": short_unpnl,
            "longMarketValue": long_market_value,
            "shortMarketValue": short_market_value,
            "longLeverage": long_leverage,
            "shortLeverage": short_leverage,
            "riskExposure": risk_exposure,
            "usdToCnyRate": usd_to_cny,
        }
        
        # 缓存1分钟
        await redis_set(cache_key, result, ttl=60)
        
        return result
    except Exception as e:
        logger.error(f"获取资产总览失败: {e}")
        raise

async def get_period_pnl(period: str = "day", limit: int = 30) -> List[Dict[str, Any]]:
    """获取周期盈亏统计 - 优化版本
    period: day/week/month
    limit: 最多返回的周期数
    """
    try:
        cache_key = f"period_pnl:{period}:{limit}"
        
        # 尝试从缓存获取（缓存2分钟）
        cached = await redis_get(cache_key)
        if cached:
            return cached
        
        # 使用更高效的聚合查询，直接聚合所有账户
        if period == "day":
            # 按天统计 - 使用聚合函数直接获取每天的第一条和最后一条记录
            sql = """
                SELECT 
                    DATE(time) as period_date,
                    SUM(net_unrealized) as total_unrealized,
                    MAX(net_unrealized) as max_unrealized,
                    MIN(net_unrealized) as min_unrealized,
                    (SELECT net_unrealized FROM equity e2 
                     WHERE DATE(e2.time) = DATE(e.time) 
                     AND e2.email = e.email
                     ORDER BY e2.time DESC LIMIT 1) as end_unrealized,
                    (SELECT net_unrealized FROM equity e3 
                     WHERE DATE(e3.time) = DATE(e.time) 
                     AND e3.email = e.email
                     ORDER BY e3.time ASC LIMIT 1) as start_unrealized
                FROM equity e
                WHERE email IS NOT NULL
                GROUP BY DATE(time), email
                ORDER BY period_date DESC
                LIMIT %s
            """
        elif period == "week":
            # 按周统计
            sql = """
                SELECT 
                    YEARWEEK(time, 1) as period_week,
                    email,
                    (SELECT net_unrealized FROM equity e2 
                     WHERE YEARWEEK(e2.time, 1) = YEARWEEK(e.time, 1) 
                     AND e2.email = e.email
                     ORDER BY e2.time DESC LIMIT 1) as end_unrealized,
                    (SELECT net_unrealized FROM equity e3 
                     WHERE YEARWEEK(e3.time, 1) = YEARWEEK(e.time, 1) 
                     AND e3.email = e.email
                     ORDER BY e3.time ASC LIMIT 1) as start_unrealized
                FROM equity e
                WHERE email IS NOT NULL
                GROUP BY YEARWEEK(time, 1), email
                ORDER BY period_week DESC
                LIMIT %s
            """
        else:  # month
            # 按月统计
            sql = """
                SELECT 
                    DATE_FORMAT(time, '%%Y-%%m') as period_month,
                    email,
                    (SELECT net_unrealized FROM equity e2 
                     WHERE DATE_FORMAT(e2.time, '%%Y-%%m') = DATE_FORMAT(e.time, '%%Y-%%m') 
                     AND e2.email = e.email
                     ORDER BY e2.time DESC LIMIT 1) as end_unrealized,
                    (SELECT net_unrealized FROM equity e3 
                     WHERE DATE_FORMAT(e3.time, '%%Y-%%m') = DATE_FORMAT(e.time, '%%Y-%%m') 
                     AND e3.email = e.email
                     ORDER BY e3.time ASC LIMIT 1) as start_unrealized
                FROM equity e
                WHERE email IS NOT NULL
                GROUP BY DATE_FORMAT(time, '%%Y-%%m'), email
                ORDER BY period_month DESC
                LIMIT %s
            """
        
        # 使用更简单高效的方式：先获取每个周期的开始和结束值
        if period == "day":
            sql = """
                SELECT 
                    DATE(time) as period_date,
                    MAX(CASE WHEN rn_desc = 1 THEN net_unrealized END) as end_unrealized,
                    MAX(CASE WHEN rn_asc = 1 THEN net_unrealized END) as start_unrealized
                FROM (
                    SELECT 
                        time,
                        DATE(time) as period_date,
                        net_unrealized,
                        ROW_NUMBER() OVER (PARTITION BY DATE(time), email ORDER BY time DESC) as rn_desc,
                        ROW_NUMBER() OVER (PARTITION BY DATE(time), email ORDER BY time ASC) as rn_asc
                    FROM equity
                    WHERE email IS NOT NULL
                ) t
                WHERE rn_desc = 1 OR rn_asc = 1
                GROUP BY period_date
                ORDER BY period_date DESC
                LIMIT %s
            """
        elif period == "week":
            sql = """
                SELECT 
                    YEARWEEK(time, 1) as period_week,
                    MAX(CASE WHEN rn_desc = 1 THEN net_unrealized END) as end_unrealized,
                    MAX(CASE WHEN rn_asc = 1 THEN net_unrealized END) as start_unrealized
                FROM (
                    SELECT 
                        time,
                        YEARWEEK(time, 1) as period_week,
                        net_unrealized,
                        ROW_NUMBER() OVER (PARTITION BY YEARWEEK(time, 1), email ORDER BY time DESC) as rn_desc,
                        ROW_NUMBER() OVER (PARTITION BY YEARWEEK(time, 1), email ORDER BY time ASC) as rn_asc
                    FROM equity
                    WHERE email IS NOT NULL
                ) t
                WHERE rn_desc = 1 OR rn_asc = 1
                GROUP BY period_week
                ORDER BY period_week DESC
                LIMIT %s
            """
        else:  # month
            sql = """
                SELECT 
                    DATE_FORMAT(time, '%%Y-%%m') as period_month,
                    MAX(CASE WHEN rn_desc = 1 THEN net_unrealized END) as end_unrealized,
                    MAX(CASE WHEN rn_asc = 1 THEN net_unrealized END) as start_unrealized
                FROM (
                    SELECT 
                        time,
                        DATE_FORMAT(time, '%%Y-%%m') as period_month,
                        net_unrealized,
                        ROW_NUMBER() OVER (PARTITION BY DATE_FORMAT(time, '%%Y-%%m'), email ORDER BY time DESC) as rn_desc,
                        ROW_NUMBER() OVER (PARTITION BY DATE_FORMAT(time, '%%Y-%%m'), email ORDER BY time ASC) as rn_asc
                    FROM equity
                    WHERE email IS NOT NULL
                ) t
                WHERE rn_desc = 1 OR rn_asc = 1
                GROUP BY period_month
                ORDER BY period_month DESC
                LIMIT %s
            """
        
        # 如果MySQL版本不支持窗口函数，使用更简单的方式
        # 先获取所有账户，然后对每个账户分别查询，但使用更高效的查询
        accounts = execute_query("SELECT DISTINCT email FROM equity WHERE email IS NOT NULL LIMIT 100")
        
        period_map = {}
        
        for account in accounts:
            email = account["email"]
            
            if period == "day":
                # 按天统计 - 使用更简单的查询
                sql = """
                    SELECT 
                        DATE(time) as period_date,
                        MAX(net_unrealized) as max_unrealized,
                        MIN(net_unrealized) as min_unrealized,
                        SUBSTRING_INDEX(GROUP_CONCAT(net_unrealized ORDER BY time DESC), ',', 1) as end_unrealized,
                        SUBSTRING_INDEX(GROUP_CONCAT(net_unrealized ORDER BY time ASC), ',', 1) as start_unrealized
                    FROM equity
                    WHERE email = %s
                    GROUP BY DATE(time)
                    ORDER BY period_date DESC
                    LIMIT %s
                """
            elif period == "week":
                sql = """
                    SELECT 
                        YEARWEEK(time, 1) as period_week,
                        MAX(net_unrealized) as max_unrealized,
                        MIN(net_unrealized) as min_unrealized,
                        SUBSTRING_INDEX(GROUP_CONCAT(net_unrealized ORDER BY time DESC), ',', 1) as end_unrealized,
                        SUBSTRING_INDEX(GROUP_CONCAT(net_unrealized ORDER BY time ASC), ',', 1) as start_unrealized
                    FROM equity
                    WHERE email = %s
                    GROUP BY YEARWEEK(time, 1)
                    ORDER BY period_week DESC
                    LIMIT %s
                """
            else:  # month
                sql = """
                    SELECT 
                        DATE_FORMAT(time, '%%Y-%%m') as period_month,
                        MAX(net_unrealized) as max_unrealized,
                        MIN(net_unrealized) as min_unrealized,
                        SUBSTRING_INDEX(GROUP_CONCAT(net_unrealized ORDER BY time DESC), ',', 1) as end_unrealized,
                        SUBSTRING_INDEX(GROUP_CONCAT(net_unrealized ORDER BY time ASC), ',', 1) as start_unrealized
                    FROM equity
                    WHERE email = %s
                    GROUP BY DATE_FORMAT(time, '%%Y-%%m')
                    ORDER BY period_month DESC
                    LIMIT %s
                """
            
            result = execute_query(sql, (email, limit))
            
            for r in result:
                period_key = str(r.get("period_date") or r.get("period_week") or r.get("period_month"))
                end_unrealized = float(r.get("end_unrealized") or 0)
                start_unrealized = float(r.get("start_unrealized") or 0)
                pnl = end_unrealized - start_unrealized
                
                if period_key not in period_map:
                    period_map[period_key] = {
                        "period": period_key,
                        "pnl": pnl,
                        "maxUnrealized": float(r.get("max_unrealized") or 0),
                        "minUnrealized": float(r.get("min_unrealized") or 0),
                    }
                else:
                    # 合并同一周期的数据（多个账户）
                    period_map[period_key]["pnl"] += pnl
                    period_map[period_key]["maxUnrealized"] = max(
                        period_map[period_key]["maxUnrealized"], 
                        float(r.get("max_unrealized") or 0)
                    )
                    period_map[period_key]["minUnrealized"] = min(
                        period_map[period_key]["minUnrealized"], 
                        float(r.get("min_unrealized") or 0)
                    )
        
        # 转换为列表并排序
        all_pnl = list(period_map.values())
        all_pnl.sort(key=lambda x: x["period"], reverse=True)
        return all_pnl[:limit]
    except Exception as e:
        logger.error(f"获取周期盈亏失败: {e}")
        raise

async def get_asset_distribution() -> List[Dict[str, Any]]:
    """获取资产分布数据 - 优化版本"""
    try:
        cache_key = "asset_distribution:all"
        
        # 尝试从缓存获取（缓存1分钟）
        cached = await redis_get(cache_key)
        if cached:
            return cached
        
        # 先获取最新时间，避免子查询
        latest_time_result = execute_query("SELECT MAX(time) as max_time FROM assets")
        if not latest_time_result or not latest_time_result[0]["max_time"]:
            result = []
            await redis_set(cache_key, result, ttl=60)
            return result
        
        max_time = latest_time_result[0]["max_time"]
        
        # 按币种统计
        sql = """
            SELECT 
                asset,
                SUM(net_unrealized) as total_net_unrealized
            FROM assets
            WHERE time = %s
            GROUP BY asset
            HAVING SUM(net_unrealized) > 1
            ORDER BY ABS(SUM(net_unrealized)) DESC
        """
        
        result = execute_query(sql, (max_time,))
        
        data = [
            {
                "asset": r["asset"],
                "netUnrealized": float(r["total_net_unrealized"] or 0),
            }
            for r in result
        ]
        
        # 缓存1分钟
        await redis_set(cache_key, data, ttl=60)
        
        return data
    except Exception as e:
        logger.error(f"获取资产分布失败: {e}")
        raise

async def get_equity_curve_with_drawdown(time_range: str = "30d") -> List[Dict[str, Any]]:
    """获取资金曲线和最大回撤数据（所有账户聚合）- 优化版本
    time_range: 时间范围，如 7d, 30d, 60d, 120d, 180d, 1y, 2y, 3y, 5y, 10y
    """
    try:
        cache_key = f"equity_curve_with_drawdown:all:{time_range}"
        
        # 尝试从缓存获取
        cached = await redis_get(cache_key)
        if cached:
            return cached
        
        # 计算时间范围
        if time_range.endswith('d'):
            days = int(time_range.replace("d", ""))
        elif time_range.endswith('y'):
            years = int(time_range.replace("y", ""))
            days = years * 365
        else:
            days = 30  # 默认30天
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # 根据时间范围选择查询策略
        if time_range == "7d":
            # 短期：直接查询原始数据
            sql = """
                SELECT 
                    time,
                    SUM(net_realized) as net_realized,
                    SUM(net_unrealized) as net_unrealized
                FROM equity 
                WHERE email IS NOT NULL AND time >= %s
                GROUP BY time
                ORDER BY time ASC
            """
        else:
            # 长期：重采样为1小时数据
            sql = """
                SELECT 
                    DATE_FORMAT(time, '%%Y-%%m-%%d %%H:00:00') as time,
                    SUM(net_realized) as net_realized,
                    SUM(net_unrealized) as net_unrealized
                FROM equity 
                WHERE email IS NOT NULL AND time >= %s
                GROUP BY DATE_FORMAT(time, '%%Y-%%m-%%d %%H:00:00')
                ORDER BY time ASC
            """
        
        result = execute_query(sql, (start_date,))
        
        # 转换为列表并计算最大回撤
        result_list = []
        peak = None
        max_drawdown = 0
        
        for r in result:
            net_unrealized = float(r["net_unrealized"] or 0)
            net_realized = float(r["net_realized"] or 0)
            
            # 处理时间格式
            time_key = r["time"]
            if isinstance(time_key, datetime):
                time_key = time_key.isoformat()
            else:
                time_key = str(time_key)
            
            if peak is None or net_unrealized > peak:
                peak = net_unrealized
            
            if peak > 0:
                drawdown = (peak - net_unrealized) / peak
                if drawdown > max_drawdown:
                    max_drawdown = drawdown
            
            result_list.append({
                "time": time_key,
                "netUnrealized": net_unrealized,
                "netRealized": net_realized,
                "maxDrawdown": -max_drawdown,  # 负值
            })
        
        # 统一缓存1分钟
        await redis_set(cache_key, result_list, ttl=60)
        
        return result_list
    except Exception as e:
        logger.error(f"获取资金曲线和最大回撤失败: {e}")
        raise

async def get_hosts_status() -> List[Dict[str, Any]]:
    """获取服务器状态"""
    try:
        sql = """
            SELECT 
                hostname,
                disk_used,
                disk_free,
                swap_date,
                spot_date
            FROM hosts
            ORDER BY hostname
        """
        
        result = execute_query(sql)
        
        return [
            {
                "hostname": r["hostname"],
                "diskUsed": float(r["disk_used"]) if r["disk_used"] else None,
                "diskFree": float(r["disk_free"]) if r["disk_free"] else None,
                "swapDate": r["swap_date"].isoformat() if isinstance(r["swap_date"], datetime) else str(r["swap_date"]) if r["swap_date"] else None,
                "spotDate": r["spot_date"].isoformat() if isinstance(r["spot_date"], datetime) else str(r["spot_date"]) if r["spot_date"] else None,
            }
            for r in result
        ]
    except Exception as e:
        logger.error(f"获取服务器状态失败: {e}")
        raise

