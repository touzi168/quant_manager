from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional
from app.core.database import execute_query, execute_update
from app.utils.response import success_response, pagination_response
from app.utils.password import hash_password, validate_password_strength
from app.middleware.auth import get_current_user, get_current_admin_user
from app.utils.logger import logger

router = APIRouter()

class UpdateUserRequest(BaseModel):
    nickname: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class AssignPermissionRequest(BaseModel):
    user_id: int
    permission_type: str

class CreateStrategyRequest(BaseModel):
    name: str
    exchange: Optional[str] = None
    account_email: str
    is_main: Optional[int] = None
    is_unified: Optional[int] = None
    is_active: Optional[bool] = True
    strategy: Optional[str] = None
    offset: Optional[str] = None
    host: Optional[str] = None
    period: Optional[str] = None
    trade_type: Optional[str] = None
    min_found: Optional[int] = None
    days: Optional[int] = None
    hedge_sell: Optional[int] = None
    api_key: Optional[str] = None
    secret: Optional[str] = None
    description: Optional[str] = None

class UpdateStrategyRequest(BaseModel):
    name: Optional[str] = None
    exchange: Optional[str] = None
    account_email: Optional[str] = None
    is_main: Optional[int] = None
    is_unified: Optional[int] = None
    is_active: Optional[bool] = None
    strategy: Optional[str] = None
    offset: Optional[str] = None
    host: Optional[str] = None
    period: Optional[str] = None
    trade_type: Optional[str] = None
    min_found: Optional[int] = None
    days: Optional[int] = None
    hedge_sell: Optional[int] = None
    api_key: Optional[str] = None
    secret: Optional[str] = None
    description: Optional[str] = None

@router.get("/users")
async def get_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_admin_user)
):
    """获取用户列表"""
    where_clause = ""
    params = []
    
    if search:
        where_clause = "WHERE email LIKE %s OR nickname LIKE %s"
        params = [f"%{search}%", f"%{search}%"]
    
    # 获取总数
    count_sql = f"SELECT COUNT(*) as total FROM users {where_clause}"
    count_result = execute_query(count_sql, tuple(params))
    total = count_result[0]["total"] if count_result else 0
    
    # 获取用户列表
    offset = (page - 1) * page_size
    sql = f"""
        SELECT id, email, nickname, role, is_active, google_enabled, last_login_at, created_at 
        FROM users {where_clause} 
        ORDER BY created_at DESC 
        LIMIT %s OFFSET %s
    """
    users = execute_query(sql, tuple(params) + (page_size, offset))
    
    return pagination_response(
        [
            {
                "id": u["id"],
                "email": u["email"],
                "nickname": u["nickname"],
                "role": u["role"],
                "isActive": u["is_active"],
                "googleEnabled": u["google_enabled"],
                "lastLoginAt": u["last_login_at"].isoformat() if u["last_login_at"] else None,
                "createdAt": u["created_at"].isoformat() if u["created_at"] else None
            }
            for u in users
        ],
        current=page,
        page_size=page_size,
        total=total
    )

@router.get("/users/{user_id}")
async def get_user(user_id: int, current_user: dict = Depends(get_current_admin_user)):
    """获取用户详情"""
    users = execute_query(
        "SELECT id, email, nickname, role, is_active, google_enabled, last_login_at, created_at, updated_at FROM users WHERE id = %s",
        (user_id,)
    )
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    user = users[0]
    
    # 获取用户的策略权限
    permissions = execute_query(
        "SELECT sp.id, sp.strategy_id, s.name as strategy_name, sp.permission_type, sp.created_at FROM user_strategy_permissions sp JOIN strategies s ON sp.strategy_id = s.id WHERE sp.user_id = %s",
        (user_id,)
    )
    
    return success_response({
        "id": user["id"],
        "email": user["email"],
        "nickname": user["nickname"],
        "role": user["role"],
        "isActive": user["is_active"],
        "googleEnabled": user["google_enabled"],
        "lastLoginAt": user["last_login_at"].isoformat() if user["last_login_at"] else None,
        "createdAt": user["created_at"].isoformat() if user["created_at"] else None,
        "updatedAt": user["updated_at"].isoformat() if user["updated_at"] else None,
        "strategyPermissions": [
            {
                "id": p["id"],
                "strategyId": p["strategy_id"],
                "strategyName": p["strategy_name"],
                "permissionType": p["permission_type"],
                "createdAt": p["created_at"].isoformat() if p["created_at"] else None
            }
            for p in permissions
        ]
    })

@router.put("/users/{user_id}")
async def update_user(user_id: int, request: UpdateUserRequest, current_user: dict = Depends(get_current_admin_user)):
    """更新用户信息"""
    # 检查用户是否存在
    users = execute_query("SELECT id FROM users WHERE id = %s", (user_id,))
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 构建更新语句
    updates = []
    params = []
    
    if request.nickname is not None:
        updates.append("nickname = %s")
        params.append(request.nickname)
    if request.role is not None:
        if request.role not in ["admin", "user"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="角色必须是admin或user"
            )
        updates.append("role = %s")
        params.append(request.role)
    if request.is_active is not None:
        updates.append("is_active = %s")
        params.append(request.is_active)
    
    if updates:
        params.append(user_id)
        sql = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
        execute_update(sql, tuple(params))
    
    return success_response(None, "用户信息更新成功")

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, current_user: dict = Depends(get_current_admin_user)):
    """删除用户"""
    # 不能删除自己
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己的账户"
        )
    
    # 检查用户是否存在
    users = execute_query("SELECT id FROM users WHERE id = %s", (user_id,))
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 删除用户（级联删除相关数据）
    execute_update("DELETE FROM users WHERE id = %s", (user_id,))
    
    return success_response(None, "用户删除成功")

@router.get("/strategies")
async def get_strategies(current_user: dict = Depends(get_current_admin_user)):
    """获取策略列表"""
    strategies = execute_query(
        """SELECT id, name, exchange, account_email, is_main, is_unified, is_active, 
           strategy, `offset`, host, period, trade_type, min_found, days, hedge_sell, 
           api_key, secret, description, created_at, updated_at 
           FROM strategies ORDER BY created_at DESC"""
    )
    
    return success_response([
        {
            "id": s["id"],
            "name": s["name"],
            "exchange": s["exchange"],
            "accountEmail": s["account_email"],
            "isMain": s["is_main"],
            "isUnified": s["is_unified"],
            "isActive": s["is_active"],
            "strategy": s["strategy"],
            "offset": s["offset"],
            "host": s["host"],
            "period": s["period"],
            "tradeType": s["trade_type"],
            "minFound": s["min_found"],
            "days": s["days"],
            "hedgeSell": s["hedge_sell"],
            "apiKey": s["api_key"],
            "secret": s["secret"],
            "description": s["description"],
            "createdAt": s["created_at"].isoformat() if s["created_at"] else None,
            "updatedAt": s["updated_at"].isoformat() if s["updated_at"] else None
        }
        for s in strategies
    ])

@router.get("/strategies/{strategy_id}")
async def get_strategy(strategy_id: int, current_user: dict = Depends(get_current_admin_user)):
    """获取策略详情"""
    strategies = execute_query(
        """SELECT id, name, exchange, account_email, is_main, is_unified, is_active, 
           strategy, `offset`, host, period, trade_type, min_found, days, hedge_sell, 
           api_key, secret, description, created_at, updated_at 
           FROM strategies WHERE id = %s""",
        (strategy_id,)
    )
    
    if not strategies:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="策略不存在"
        )
    
    s = strategies[0]
    return success_response({
        "id": s["id"],
        "name": s["name"],
        "exchange": s["exchange"],
        "accountEmail": s["account_email"],
        "isMain": s["is_main"],
        "isUnified": s["is_unified"],
        "isActive": s["is_active"],
        "strategy": s["strategy"],
        "offset": s["offset"],
        "host": s["host"],
        "period": s["period"],
        "tradeType": s["trade_type"],
        "minFound": s["min_found"],
        "days": s["days"],
        "hedgeSell": s["hedge_sell"],
        "apiKey": s["api_key"],
        "secret": s["secret"],
        "description": s["description"],
        "createdAt": s["created_at"].isoformat() if s["created_at"] else None,
        "updatedAt": s["updated_at"].isoformat() if s["updated_at"] else None
    })

@router.post("/strategies")
async def create_strategy(request: CreateStrategyRequest, current_user: dict = Depends(get_current_admin_user)):
    """创建策略"""
    # 验证exchange枚举值
    if request.exchange and request.exchange not in ["binance", "okex"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="交易所必须是binance或okex"
        )
    
    # 验证trade_type枚举值
    if request.trade_type and request.trade_type not in ["swap", "spot", "mixed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="交易类型必须是swap、spot或mixed"
        )
    
    # 检查account_email是否已存在
    existing = execute_query(
        "SELECT id FROM strategies WHERE account_email = %s",
        (request.account_email,)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该账户邮箱已存在，不可重复"
        )
    
    # 插入新策略
    execute_update(
        """INSERT INTO strategies 
           (name, exchange, account_email, is_main, is_unified, is_active, strategy, 
            `offset`, host, period, trade_type, min_found, days, hedge_sell, api_key, 
            secret, description) 
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            request.name,
            request.exchange,
            request.account_email,
            request.is_main,
            request.is_unified,
            request.is_active if request.is_active is not None else True,
            request.strategy,
            request.offset,
            request.host,
            request.period,
            request.trade_type,
            request.min_found,
            request.days,
            request.hedge_sell,
            request.api_key,
            request.secret,
            request.description
        )
    )
    
    return success_response(None, "策略创建成功")

@router.put("/strategies/{strategy_id}")
async def update_strategy(strategy_id: int, request: UpdateStrategyRequest, current_user: dict = Depends(get_current_admin_user)):
    """更新策略"""
    # 检查策略是否存在
    strategies = execute_query("SELECT id FROM strategies WHERE id = %s", (strategy_id,))
    if not strategies:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="策略不存在"
        )
    
    # 验证exchange枚举值
    if request.exchange and request.exchange not in ["binance", "okex"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="交易所必须是binance或okex"
        )
    
    # 验证trade_type枚举值
    if request.trade_type and request.trade_type not in ["swap", "spot", "mixed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="交易类型必须是swap、spot或mixed"
        )
    
    # 如果更新account_email，检查是否重复
    if request.account_email:
        existing = execute_query(
            "SELECT id FROM strategies WHERE account_email = %s AND id != %s",
            (request.account_email, strategy_id)
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该账户邮箱已存在，不可重复"
            )
    
    # 构建更新语句
    updates = []
    params = []
    
    if request.name is not None:
        updates.append("name = %s")
        params.append(request.name)
    if request.exchange is not None:
        updates.append("exchange = %s")
        params.append(request.exchange)
    if request.account_email is not None:
        updates.append("account_email = %s")
        params.append(request.account_email)
    if request.is_main is not None:
        updates.append("is_main = %s")
        params.append(request.is_main)
    if request.is_unified is not None:
        updates.append("is_unified = %s")
        params.append(request.is_unified)
    if request.is_active is not None:
        updates.append("is_active = %s")
        params.append(request.is_active)
    if request.strategy is not None:
        updates.append("strategy = %s")
        params.append(request.strategy)
    if request.offset is not None:
        updates.append("`offset` = %s")
        params.append(request.offset)
    if request.host is not None:
        updates.append("host = %s")
        params.append(request.host)
    if request.period is not None:
        updates.append("period = %s")
        params.append(request.period)
    if request.trade_type is not None:
        updates.append("trade_type = %s")
        params.append(request.trade_type)
    if request.min_found is not None:
        updates.append("min_found = %s")
        params.append(request.min_found)
    if request.days is not None:
        updates.append("days = %s")
        params.append(request.days)
    if request.hedge_sell is not None:
        updates.append("hedge_sell = %s")
        params.append(request.hedge_sell)
    if request.api_key is not None:
        updates.append("api_key = %s")
        params.append(request.api_key)
    if request.secret is not None:
        updates.append("secret = %s")
        params.append(request.secret)
    if request.description is not None:
        updates.append("description = %s")
        params.append(request.description)
    
    if updates:
        params.append(strategy_id)
        sql = f"UPDATE strategies SET {', '.join(updates)} WHERE id = %s"
        execute_update(sql, tuple(params))
    
    return success_response(None, "策略更新成功")

@router.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: int, current_user: dict = Depends(get_current_admin_user)):
    """删除策略"""
    # 检查策略是否存在
    strategies = execute_query("SELECT id FROM strategies WHERE id = %s", (strategy_id,))
    if not strategies:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="策略不存在"
        )
    
    # 删除策略（级联删除相关权限）
    execute_update("DELETE FROM strategies WHERE id = %s", (strategy_id,))
    
    return success_response(None, "策略删除成功")

@router.get("/strategies/{strategy_id}/users")
async def get_strategy_users(strategy_id: int, current_user: dict = Depends(get_current_admin_user)):
    """获取策略用户权限"""
    permissions = execute_query(
        "SELECT sp.id, sp.user_id, u.email, u.nickname, sp.permission_type, sp.created_at FROM user_strategy_permissions sp JOIN users u ON sp.user_id = u.id WHERE sp.strategy_id = %s",
        (strategy_id,)
    )
    
    return success_response([
        {
            "id": p["id"],
            "userId": p["user_id"],
            "email": p["email"],
            "nickname": p["nickname"],
            "permissionType": p["permission_type"],
            "createdAt": p["created_at"].isoformat() if p["created_at"] else None
        }
        for p in permissions
    ])

@router.post("/strategies/{strategy_id}/users")
async def assign_permission(strategy_id: int, request: AssignPermissionRequest, current_user: dict = Depends(get_current_admin_user)):
    """分配策略权限"""
    if request.permission_type not in ["view", "manage"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="权限类型必须是view或manage"
        )
    
    # 检查策略是否存在
    strategies = execute_query("SELECT id FROM strategies WHERE id = %s", (strategy_id,))
    if not strategies:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="策略不存在"
        )
    
    # 检查用户是否存在
    users = execute_query("SELECT id FROM users WHERE id = %s", (request.user_id,))
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 检查权限是否已存在
    existing = execute_query(
        "SELECT id FROM user_strategy_permissions WHERE user_id = %s AND strategy_id = %s",
        (request.user_id, strategy_id)
    )
    
    if existing:
        # 更新权限
        execute_update(
            "UPDATE user_strategy_permissions SET permission_type = %s, granted_by = %s WHERE id = %s",
            (request.permission_type, current_user["id"], existing[0]["id"])
        )
    else:
        # 创建权限
        execute_update(
            "INSERT INTO user_strategy_permissions (user_id, strategy_id, permission_type, granted_by) VALUES (%s, %s, %s, %s)",
            (request.user_id, strategy_id, request.permission_type, current_user["id"])
        )
    
    return success_response(None, "策略权限分配成功")

@router.delete("/strategies/{strategy_id}/users/{user_id}")
async def revoke_permission(strategy_id: int, user_id: int, current_user: dict = Depends(get_current_admin_user)):
    """撤销策略权限"""
    execute_update(
        "DELETE FROM user_strategy_permissions WHERE strategy_id = %s AND user_id = %s",
        (strategy_id, user_id)
    )
    
    return success_response(None, "策略权限撤销成功")

