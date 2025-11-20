from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "量化监控系统"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    PORT: int = int(os.getenv("PORT", "6666"))
    
    # JWT配置
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your_jwt_secret_key_change_in_production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_IN: int = 24 * 60 * 60  # 24小时（秒）
    
    # 数据库配置
    DB_HOST: str = os.getenv("DB_HOST", "172.168.200.200")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "test")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "test")
    DB_NAME: str = os.getenv("DB_NAME", "bquant")
    
    # Redis配置
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    
    # 邮件配置
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.example.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "noreply@example.com")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@example.com")
    
    # Google Authenticator
    GOOGLE_AUTH_ISSUER: str = os.getenv("GOOGLE_AUTH_ISSUER", "量化监控系统")
    
    # CORS配置
    _cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:7777,http://127.0.0.1:7777")
    CORS_ORIGINS: List[str] = [origin.strip() for origin in _cors_origins.split(",")]
    
    # 日志配置
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "./logs/app.log")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

