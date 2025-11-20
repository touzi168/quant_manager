from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.core.database import execute_query, execute_update
from app.core.redis_client import redis_delete
from app.utils.response import success_response, error_response
from app.utils.password import hash_password, verify_password, validate_password_strength
from app.middleware.auth import get_current_user
from app.utils.logger import logger

router = APIRouter()

class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """获取用户信息"""
    users = execute_query(
        "SELECT id, email, nickname, role, google_enabled, last_login_at, created_at FROM users WHERE id = %s",
        (current_user["id"],)
    )
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    user = users[0]
    return success_response({
        "id": user["id"],
        "email": user["email"],
        "nickname": user["nickname"],
        "role": user["role"],
        "googleEnabled": user["google_enabled"],
        "lastLoginAt": user["last_login_at"].isoformat() if user["last_login_at"] else None,
        "createdAt": user["created_at"].isoformat() if user["created_at"] else None
    })

@router.put("/profile")
async def update_profile(request: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    """更新用户信息"""
    if request.nickname:
        if len(request.nickname) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="昵称长度不能超过100字符"
            )
        execute_update("UPDATE users SET nickname = %s WHERE id = %s", (request.nickname, current_user["id"]))
    
    return success_response(None, "用户信息更新成功")

@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """修改密码"""
    # 验证新密码强度
    is_valid, errors = validate_password_strength(request.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=", ".join(errors)
        )
    
    # 获取用户当前密码
    users = execute_query("SELECT password_hash FROM users WHERE id = %s", (current_user["id"],))
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 验证原密码
    if not verify_password(request.old_password, users[0]["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="原密码错误"
        )
    
    # 更新密码
    new_password_hash = hash_password(request.new_password)
    execute_update("UPDATE users SET password_hash = %s WHERE id = %s", (new_password_hash, current_user["id"]))
    
    return success_response(None, "密码修改成功")

@router.get("/sessions")
async def get_sessions(current_user: dict = Depends(get_current_user)):
    """获取登录会话"""
    sessions = execute_query(
        "SELECT id, session_token, expires_at, ip_address, user_agent, created_at FROM user_sessions WHERE user_id = %s AND expires_at > NOW() ORDER BY created_at DESC",
        (current_user["id"],)
    )
    
    return success_response([
        {
            "id": s["id"],
            "ipAddress": s["ip_address"],
            "userAgent": s["user_agent"],
            "createdAt": s["created_at"].isoformat() if s["created_at"] else None,
            "expiresAt": s["expires_at"].isoformat() if s["expires_at"] else None
        }
        for s in sessions
    ])

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, current_user: dict = Depends(get_current_user)):
    """注销会话"""
    # 检查会话是否属于当前用户
    sessions = execute_query(
        "SELECT session_token FROM user_sessions WHERE id = %s AND user_id = %s",
        (session_id, current_user["id"])
    )
    
    if not sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在"
        )
    
    # 删除会话
    execute_update("DELETE FROM user_sessions WHERE id = %s", (session_id,))
    
    # 从Redis删除token
    token_key = f"session:{current_user['id']}:{sessions[0]['session_token']}"
    await redis_delete(token_key)
    
    return success_response(None, "会话已注销")

