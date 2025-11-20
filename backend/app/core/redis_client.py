import redis.asyncio as aioredis
from typing import Optional, Any
from app.core.config import settings
from app.utils.logger import logger
import json

redis_client: Optional[aioredis.Redis] = None

async def init_redis():
    """初始化Redis连接"""
    global redis_client
    try:
        redis_client = await aioredis.from_url(
            f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}",
            password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
            db=settings.REDIS_DB,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        logger.info("Redis连接成功")
    except Exception as e:
        logger.error(f"Redis连接失败: {e}")
        raise

async def get_redis() -> aioredis.Redis:
    """获取Redis客户端"""
    if redis_client is None:
        await init_redis()
    return redis_client

async def redis_set(key: str, value: Any, ttl: Optional[int] = None):
    """设置缓存"""
    try:
        redis = await get_redis()
        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False)
        if ttl:
            await redis.setex(key, ttl, value)
        else:
            await redis.set(key, value)
    except Exception as e:
        logger.error(f"Redis设置错误: {e}")
        raise

async def redis_get(key: str):
    """获取缓存"""
    try:
        redis = await get_redis()
        value = await redis.get(key)
        if value:
            try:
                return json.loads(value)
            except:
                return value
        return None
    except Exception as e:
        logger.error(f"Redis获取错误: {e}")
        raise

async def redis_delete(key: str):
    """删除缓存"""
    try:
        redis = await get_redis()
        await redis.delete(key)
    except Exception as e:
        logger.error(f"Redis删除错误: {e}")
        raise

async def redis_exists(key: str) -> bool:
    """检查键是否存在"""
    try:
        redis = await get_redis()
        return await redis.exists(key) > 0
    except Exception as e:
        logger.error(f"Redis检查错误: {e}")
        return False

