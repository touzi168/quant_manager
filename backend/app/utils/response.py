from datetime import datetime
from typing import Optional, Any, List

def success_response(data: Any = None, message: str = "操作成功", code: int = 200):
    """成功响应"""
    return {
        "success": True,
        "code": code,
        "message": message,
        "data": data,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

def error_response(message: str = "操作失败", code: int = 400, data: Any = None):
    """错误响应"""
    return {
        "success": False,
        "code": code,
        "message": message,
        "data": data,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

def pagination_response(
    list: List[Any],
    current: int = 1,
    page_size: int = 20,
    total: int = 0
):
    """分页响应"""
    return {
        "success": True,
        "code": 200,
        "data": {
            "list": list,
            "pagination": {
                "current": current,
                "pageSize": page_size,
                "total": total,
                "pages": (total + page_size - 1) // page_size if total > 0 else 0
            }
        },
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

