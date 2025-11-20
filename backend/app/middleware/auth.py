from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.jwt import verify_token
from app.core.redis_client import redis_exists
from app.core.database import execute_query
from typing import Optional

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = security):
    """获取当前用户"""
    token = credentials.credentials
    
    # 验证token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌"
        )
    
    user_id = payload.get("userId")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌格式错误"
        )
    
    # 检查token是否在Redis中
    token_key = f"session:{user_id}:{token}"
    exists = await redis_exists(token_key)
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌已失效"
        )
    
    # 获取用户信息
    users = execute_query(
        "SELECT id, email, role FROM users WHERE id = %s",
        (user_id,)
    )
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )
    
    user = users[0]
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"]
    }

async def get_current_admin_user(current_user: dict = None):
    """获取当前管理员用户"""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未认证"
        )
    
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    
    return current_user

def check_strategy_access(strategy_id: int, user_id: int, user_role: str) -> bool:
    """检查策略访问权限"""
    if user_role == "admin":
        return True
    
    from app.core.database import execute_query
    permissions = execute_query(
        "SELECT id FROM user_strategy_permissions WHERE user_id = %s AND strategy_id = %s",
        (user_id, strategy_id)
    )
    
    return len(permissions) > 0

