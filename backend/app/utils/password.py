from passlib.context import CryptContext
from typing import Tuple, List
import re

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """哈希密码"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)

def validate_password_strength(password: str) -> Tuple[bool, List[str]]:
    """验证密码强度"""
    errors = []
    
    if len(password) < 8:
        errors.append("密码长度至少8位")
    
    if not re.search(r'[A-Z]', password):
        errors.append("密码必须包含大写字母")
    
    if not re.search(r'[a-z]', password):
        errors.append("密码必须包含小写字母")
    
    if not re.search(r'\d', password):
        errors.append("密码必须包含数字")
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("密码必须包含特殊字符")
    
    return len(errors) == 0, errors

