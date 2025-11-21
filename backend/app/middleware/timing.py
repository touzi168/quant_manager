from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time
from app.utils.logger import logger

class TimingMiddleware(BaseHTTPMiddleware):
    """请求耗时中间件"""
    
    async def dispatch(self, request: Request, call_next):
        # 记录开始时间
        start_time = time.time()
        
        # 获取客户端信息
        client_host = request.client.host if request.client else "unknown"
        client_port = request.client.port if request.client else "unknown"
        
        # 处理请求
        response = await call_next(request)
        
        # 计算耗时（毫秒）
        process_time = (time.time() - start_time) * 1000
        
        # 将耗时添加到响应头（毫秒，保留2位小数）
        response.headers["X-Process-Time"] = f"{process_time:.2f}"
        response.headers["X-Process-Time-Unit"] = "ms"
        
        # 获取状态码文本
        status_text = "OK" if response.status_code == 200 else "ERROR"
        
        # 构建请求路径（包含查询参数）
        path = str(request.url.path)
        if request.query_params:
            path += f"?{request.query_params}"
        
        # 记录访问日志（标准HTTP访问日志格式，包含耗时）
        log_msg = (
            f'{client_host}:{client_port} - '
            f'"{request.method} {path} HTTP/1.1" '
            f'{response.status_code} {status_text} '
            f'({process_time:.2f}ms)'
        )
        # 使用print直接输出到控制台，格式与uvicorn一致
        print(f"INFO:     {log_msg}")
        # 同时记录到logger
        logger.info(log_msg)
        
        return response

