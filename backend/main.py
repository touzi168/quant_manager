from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
from app.core.config import settings
from app.core.database import init_db
from app.core.redis_client import init_redis
from app.api.v1 import auth, users, admin, dashboard
from app.utils.logger import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时执行
    try:
        await init_db()
        logger.info("数据库连接成功")
        
        await init_redis()
        logger.info("Redis连接成功")
    except Exception as e:
        logger.error(f"初始化失败: {e}")
        raise
    
    yield
    
    # 关闭时执行
    logger.info("应用关闭")

app = FastAPI(
    title="量化监控系统 API",
    description="量化可视化和监控系统API文档",
    version="1.0.0",
    lifespan=lifespan
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(users.router, prefix="/api/users", tags=["用户"])
app.include_router(admin.router, prefix="/api/admin", tags=["管理员"])
app.include_router(dashboard.router, prefix="/api/user/dashboard", tags=["用户仪表板"])
app.include_router(dashboard.router, prefix="/api/admin/dashboard", tags=["管理员仪表板"])

@app.get("/health")
async def health_check():
    return {
        "success": True,
        "message": "服务运行正常",
        "timestamp": "2025-01-19T00:00:00Z"
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"全局异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "code": 500,
            "message": "服务器内部错误",
            "timestamp": "2025-01-19T00:00:00Z"
        }
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=6666,
        reload=True
    )

