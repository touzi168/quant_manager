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

