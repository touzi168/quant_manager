from fastapi import APIRouter, HTTPException, status, Depends, Query, Path
from typing import Optional
from app.core.database import execute_query
from app.utils.response import success_response
from app.middleware.auth import get_current_user, get_current_admin_user, check_strategy_access
from app.services.data_aggregation import (
    get_asset_summary,
    get_position_summary,
    get_equity_curve,
    get_health_status,
    get_process_status,
    get_strategy_summary,
    get_asset_overview,
    get_period_pnl,
    get_asset_distribution,
    get_equity_curve_with_drawdown,
    get_hosts_status
)
from app.utils.logger import logger

admin_router = APIRouter(prefix="/admin/dashboard", tags=["管理员仪表板"])
user_router = APIRouter(prefix="/user/dashboard", tags=["用户仪表板"])

@admin_router.get("/summary")
async def admin_summary(current_user: dict = Depends(get_current_admin_user)):
    """总体数据汇总（管理员）"""
    try:
        # 获取所有资产汇总
        assets = await get_asset_summary()
        
        # 获取所有持仓汇总
        positions = await get_position_summary()
        
        # 获取策略数量
        strategies = execute_query("SELECT COUNT(*) as count FROM strategies WHERE is_active = TRUE")
        strategy_count = strategies[0]["count"] if strategies else 0
        
        # 获取活跃进程数
        processes = await get_process_status()
        active_process_count = len([p for p in processes if p.get("status") == "online"])
        
        # 计算总资产
        total_assets = sum(asset.get("totalAssets", 0) for asset in assets)
        
        return success_response({
            "totalAssets": total_assets,
            "strategyCount": strategy_count,
            "activeProcessCount": active_process_count,
            "assetSummary": assets,
            "positionSummary": positions
        })
    except Exception as e:
        logger.error(f"获取总体数据汇总失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取数据失败"
        )

@admin_router.get("/asset-summary")
async def admin_asset_summary(current_user: dict = Depends(get_current_admin_user)):
    """资产汇总（管理员）"""
    try:
        assets = await get_asset_summary()
        return success_response(assets)
    except Exception as e:
        logger.error(f"获取资产汇总失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取资产汇总失败"
        )

@admin_router.get("/position-summary")
async def admin_position_summary(current_user: dict = Depends(get_current_admin_user)):
    """持仓汇总（管理员）"""
    try:
        positions = await get_position_summary()
        return success_response(positions)
    except Exception as e:
        logger.error(f"获取持仓汇总失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取持仓汇总失败"
        )

@admin_router.get("/equity-curve")
async def admin_equity_curve(
    time_range: str = Query("30d", alias="timeRange"),
    current_user: dict = Depends(get_current_admin_user)
):
    """总资金曲线（管理员）"""
    try:
        # 获取所有账户的邮箱
        accounts = execute_query("SELECT DISTINCT email FROM account WHERE email IS NOT NULL")
        
        # 聚合所有账户的资金曲线
        all_equity_data = []
        for account in accounts:
            if account["email"]:
                try:
                    equity_data = await get_equity_curve(account["email"], None, time_range)
                    all_equity_data.extend(equity_data)
                except Exception as e:
                    logger.warning(f"获取账户 {account['email']} 资金曲线失败: {e}")
        
        if not all_equity_data:
            return success_response([])
        
        # 按时间聚合
        time_map = {}
        for point in all_equity_data:
            time_key = point["time"]
            if time_key not in time_map:
                time_map[time_key] = {
                    "time": time_key,
                    "netRealized": 0,
                    "netUnrealized": 0,
                    "maxDrawdown": 0
                }
            aggregated = time_map[time_key]
            aggregated["netRealized"] += point.get("netRealized", 0)
            aggregated["netUnrealized"] += point.get("netUnrealized", 0)
            aggregated["maxDrawdown"] = max(aggregated["maxDrawdown"], point.get("maxDrawdown", 0))
        
        result = sorted(time_map.values(), key=lambda x: x["time"])
        
        return success_response(result)
    except Exception as e:
        logger.error(f"获取资金曲线失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取资金曲线失败"
        )

@admin_router.get("/health-status")
async def admin_health_status(current_user: dict = Depends(get_current_admin_user)):
    """服务器健康状态（管理员）"""
    try:
        health = await get_health_status()
        return success_response(health)
    except Exception as e:
        logger.error(f"获取健康状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取健康状态失败"
        )

@admin_router.get("/process-status")
async def admin_process_status(current_user: dict = Depends(get_current_admin_user)):
    """进程健康状态（管理员）"""
    try:
        processes = await get_process_status()
        return success_response(processes)
    except Exception as e:
        logger.error(f"获取进程状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取进程状态失败"
        )

@admin_router.get("/asset-overview")
async def admin_asset_overview(current_user: dict = Depends(get_current_admin_user)):
    """获取资产总览（管理员）"""
    try:
        overview = await get_asset_overview()
        return success_response(overview)
    except Exception as e:
        logger.error(f"获取资产总览失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取资产总览失败"
        )

@admin_router.get("/period-pnl")
async def admin_period_pnl(
    period: str = Query("day", regex="^(day|week|month)$"),
    limit: int = Query(30, ge=1, le=30),
    current_user: dict = Depends(get_current_admin_user)
):
    """获取周期盈亏统计（管理员）"""
    try:
        pnl_data = await get_period_pnl(period, limit)
        return success_response(pnl_data)
    except Exception as e:
        logger.error(f"获取周期盈亏失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取周期盈亏失败"
        )

@admin_router.get("/asset-distribution")
async def admin_asset_distribution(current_user: dict = Depends(get_current_admin_user)):
    """获取资产分布（管理员）"""
    try:
        distribution = await get_asset_distribution()
        return success_response(distribution)
    except Exception as e:
        logger.error(f"获取资产分布失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取资产分布失败"
        )

@admin_router.get("/equity-curve-drawdown")
async def admin_equity_curve_drawdown(
    time_range: str = Query("30d", alias="timeRange"),
    current_user: dict = Depends(get_current_admin_user)
):
    """获取资金曲线和最大回撤（管理员）
    time_range: 时间范围，如 7d, 30d, 60d, 120d, 180d, 1y, 2y, 3y, 5y, 10y
    """
    try:
        curve_data = await get_equity_curve_with_drawdown(time_range)
        return success_response(curve_data)
    except Exception as e:
        logger.error(f"获取资金曲线失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取资金曲线失败"
        )

@admin_router.get("/hosts-status")
async def admin_hosts_status(current_user: dict = Depends(get_current_admin_user)):
    """获取服务器状态（管理员）"""
    try:
        hosts = await get_hosts_status()
        return success_response(hosts)
    except Exception as e:
        logger.error(f"获取服务器状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取服务器状态失败"
        )

@user_router.get("/strategies")
async def user_strategies(current_user: dict = Depends(get_current_user)):
    """可访问策略列表"""
    try:
        if current_user["role"] == "admin":
            # 管理员可以访问所有策略
            strategies = execute_query(
                "SELECT id, name, description, account_email, is_active FROM strategies WHERE is_active = TRUE"
            )
        else:
            # 普通用户只能访问有权限的策略
            strategies = execute_query(
                """SELECT s.id, s.name, s.description, s.account_email, s.is_active, sp.permission_type
                   FROM strategies s
                   JOIN user_strategy_permissions sp ON s.id = sp.strategy_id
                   WHERE sp.user_id = %s AND s.is_active = TRUE""",
                (current_user["id"],)
            )
        
        return success_response([
            {
                "id": s["id"],
                "name": s["name"],
                "description": s["description"],
                "accountEmail": s["account_email"],
                "isActive": s["is_active"]
            }
            for s in strategies
        ])
    except Exception as e:
        logger.error(f"获取策略列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取策略列表失败"
        )

@user_router.get("/summary/{strategy_id}")
async def user_strategy_summary(
    strategy_id: int = Path(...),
    current_user: dict = Depends(get_current_user)
):
    """策略汇总数据"""
    try:
        # 检查权限
        has_access = check_strategy_access(strategy_id, current_user["id"], current_user["role"])
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问该策略"
            )
        
        summary = await get_strategy_summary(strategy_id)
        return success_response(summary)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取策略汇总失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取策略汇总失败"
        )

@user_router.get("/assets/{strategy_id}")
async def user_strategy_assets(
    strategy_id: int = Path(...),
    current_user: dict = Depends(get_current_user)
):
    """策略资产详情"""
    try:
        has_access = check_strategy_access(strategy_id, current_user["id"], current_user["role"])
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问该策略"
            )
        
        assets = await get_asset_summary(None, strategy_id)
        return success_response(assets)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取策略资产失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取策略资产失败"
        )

@user_router.get("/positions/{strategy_id}")
async def user_strategy_positions(
    strategy_id: int = Path(...),
    current_user: dict = Depends(get_current_user)
):
    """策略持仓"""
    try:
        has_access = check_strategy_access(strategy_id, current_user["id"], current_user["role"])
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问该策略"
            )
        
        positions = await get_position_summary(None, strategy_id)
        return success_response(positions)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取策略持仓失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取策略持仓失败"
        )

@user_router.get("/equity/{strategy_id}")
async def user_strategy_equity(
    strategy_id: int = Path(...),
    time_range: str = Query("30d", alias="timeRange"),
    current_user: dict = Depends(get_current_user)
):
    """策略资金曲线"""
    try:
        has_access = check_strategy_access(strategy_id, current_user["id"], current_user["role"])
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问该策略"
            )
        
        # 获取策略关联的账户邮箱
        strategies = execute_query(
            "SELECT account_email FROM strategies WHERE id = %s",
            (strategy_id,)
        )
        
        if not strategies:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="策略不存在"
            )
        
        email = strategies[0]["account_email"]
        equity_data = await get_equity_curve(email, strategy_id, time_range)
        
        return success_response(equity_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取策略资金曲线失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取资金曲线失败"
        )

@user_router.get("/health/{strategy_id}")
async def user_strategy_health(
    strategy_id: int = Path(...),
    current_user: dict = Depends(get_current_user)
):
    """策略健康状态"""
    try:
        has_access = check_strategy_access(strategy_id, current_user["id"], current_user["role"])
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问该策略"
            )
        
        # 获取策略信息
        strategies = execute_query(
            "SELECT name FROM strategies WHERE id = %s",
            (strategy_id,)
        )
        
        if not strategies:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="策略不存在"
            )
        
        strategy_name = strategies[0]["name"]
        health = await get_health_status()
        strategy_health = [h for h in health if h.get("strategyName") == strategy_name]
        
        return success_response(strategy_health)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取策略健康状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取健康状态失败"
        )

__all__ = ["admin_router", "user_router"]
