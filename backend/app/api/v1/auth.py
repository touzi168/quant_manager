from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import Optional
import secrets
from app.core.database import execute_query, execute_update
from app.core.redis_client import redis_set, redis_delete
from app.utils.response import success_response, error_response
from app.utils.password import hash_password, verify_password, validate_password_strength
from app.utils.jwt import create_access_token
from app.utils.google_auth import generate_secret, generate_qr_code, verify_token as verify_google_token
from app.utils.email import send_verification_email, send_password_reset_email
from app.utils.logger import logger
from app.middleware.auth import get_current_user

router = APIRouter()

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nickname: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    google_code: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

class GoogleSetupResponse(BaseModel):
    secret: str
    qr_code: str
    manual_entry_key: str

@router.post("/register")
async def register(request: RegisterRequest):
    """用户注册"""
    # 验证密码强度
    is_valid, errors = validate_password_strength(request.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=", ".join(errors)
        )
    
    # 检查用户是否已存在
    existing = execute_query("SELECT id FROM users WHERE email = %s", (request.email,))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册"
        )
    
    # 生成验证token
    verification_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    # 创建用户
    password_hash = hash_password(request.password)
    nickname = request.nickname or request.email.split("@")[0]
    
    execute_update(
        "INSERT INTO users (email, password_hash, nickname, role, is_active) VALUES (%s, %s, %s, 'user', FALSE)",
        (request.email, password_hash, nickname)
    )
    
    # 保存验证token
    execute_update(
        "INSERT INTO password_resets (email, reset_token, expires_at) VALUES (%s, %s, %s)",
        (request.email, verification_token, expires_at)
    )
    
    # 发送验证邮件
    try:
        await send_verification_email(request.email, verification_token)
    except Exception as e:
        logger.error(f"发送验证邮件失败: {e}")
    
    return success_response(None, "注册成功，请查收邮件验证邮箱")

@router.get("/verify-email")
async def verify_email(token: str):
    """验证邮箱"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少验证token"
        )
    
    # 查找验证token
    records = execute_query(
        "SELECT email, expires_at, used_at FROM password_resets WHERE reset_token = %s AND used_at IS NULL",
        (token,)
    )
    
    if not records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的验证token"
        )
    
    record = records[0]
    if record["expires_at"] < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证token已过期"
        )
    
    # 激活用户
    execute_update("UPDATE users SET is_active = TRUE WHERE email = %s", (record["email"],))
    
    # 标记token为已使用
    execute_update("UPDATE password_resets SET used_at = NOW() WHERE reset_token = %s", (token,))
    
    return success_response(None, "邮箱验证成功")

@router.post("/login")
async def login(request: LoginRequest):
    """用户登录"""
    # 查找用户
    users = execute_query(
        "SELECT id, email, password_hash, role, is_active, google_enabled, google_secret FROM users WHERE email = %s",
        (request.email,)
    )
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误"
        )
    
    user = users[0]
    
    # 检查账户是否激活
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户未激活，请先验证邮箱"
        )
    
    # 验证密码
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误"
        )
    
    # 如果启用了Google认证，验证验证码
    if user["google_enabled"]:
        if not request.google_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="需要Google验证码"
            )
        
        if not verify_google_token(user["google_secret"], request.google_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google验证码错误"
            )
    
    # 生成JWT token
    token = create_access_token({
        "userId": user["id"],
        "email": user["email"],
        "role": user["role"]
    })
    
    # 保存会话到Redis
    token_key = f"session:{user['id']}:{token}"
    await redis_set(token_key, {"userId": user["id"], "email": user["email"]}, ttl=86400)
    
    # 更新最后登录时间
    execute_update("UPDATE users SET last_login_at = NOW() WHERE id = %s", (user["id"],))
    
    return success_response({
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"]
        }
    }, "登录成功")

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """用户登出"""
    # 从Redis删除会话（需要从请求头获取token）
    # 这里简化处理，实际应该从请求头获取token
    return success_response(None, "登出成功")

@router.post("/forgot-password")
async def forgot_password(email: EmailStr):
    """忘记密码"""
    # 检查用户是否存在
    users = execute_query("SELECT id FROM users WHERE email = %s", (email,))
    if not users:
        # 为了安全，不透露用户是否存在
        return success_response(None, "如果该邮箱存在，将收到密码重置邮件")
    
    # 生成重置token
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    
    # 保存重置token
    execute_update(
        "INSERT INTO password_resets (email, reset_token, expires_at) VALUES (%s, %s, %s)",
        (email, reset_token, expires_at)
    )
    
    # 发送重置邮件
    try:
        await send_password_reset_email(email, reset_token)
    except Exception as e:
        logger.error(f"发送重置邮件失败: {e}")
    
    return success_response(None, "如果该邮箱存在，将收到密码重置邮件")

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """重置密码"""
    # 验证密码强度
    is_valid, errors = validate_password_strength(request.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=", ".join(errors)
        )
    
    # 查找重置token
    records = execute_query(
        "SELECT email, expires_at, used_at FROM password_resets WHERE reset_token = %s AND used_at IS NULL",
        (request.token,)
    )
    
    if not records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的重置token"
        )
    
    record = records[0]
    if record["expires_at"] < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="重置token已过期"
        )
    
    # 更新密码
    password_hash = hash_password(request.password)
    execute_update("UPDATE users SET password_hash = %s WHERE email = %s", (password_hash, record["email"]))
    
    # 标记token为已使用
    execute_update("UPDATE password_resets SET used_at = NOW() WHERE reset_token = %s", (request.token,))
    
    return success_response(None, "密码重置成功")

@router.post("/google-setup")
async def google_setup(current_user: dict = Depends(get_current_user)):
    """启用Google认证"""
    users = execute_query("SELECT id, email, google_enabled FROM users WHERE id = %s", (current_user["id"],))
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    if users[0]["google_enabled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google认证已启用"
        )
    
    # 生成密钥
    secret = generate_secret(current_user["email"])
    qr_code = generate_qr_code(secret, current_user["email"])
    
    # 临时保存密钥（不立即启用）
    execute_update("UPDATE users SET google_secret = %s WHERE id = %s", (secret, current_user["id"]))
    
    return success_response({
        "secret": secret,
        "qr_code": qr_code,
        "manual_entry_key": secret
    }, "请使用Google Authenticator扫描二维码")

@router.post("/google-verify")
async def google_verify(code: str, current_user: dict = Depends(get_current_user)):
    """验证并启用Google认证"""
    if not code or len(code) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码必须是6位数字"
        )
    
    users = execute_query("SELECT google_secret FROM users WHERE id = %s", (current_user["id"],))
    
    if not users or not users[0]["google_secret"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先设置Google认证"
        )
    
    # 验证验证码
    if not verify_google_token(users[0]["google_secret"], code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误"
        )
    
    # 启用Google认证
    execute_update("UPDATE users SET google_enabled = TRUE WHERE id = %s", (current_user["id"],))
    
    return success_response(None, "Google认证已启用")

