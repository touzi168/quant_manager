import pymysql
from pymysql import cursors
from contextlib import contextmanager
from app.core.config import settings
from app.utils.logger import logger
import asyncio
from typing import Optional

# 使用连接池
pool = None

def init_pool():
    global pool
    if pool is None:
        pool = pymysql.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            charset='utf8mb4',
            cursorclass=cursors.DictCursor,
            autocommit=False
        )
        logger.info("数据库连接池创建成功")
    return pool

async def init_db():
    """初始化数据库连接"""
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, init_pool)
    except Exception as e:
        logger.error(f"数据库连接失败: {e}")
        raise

@contextmanager
def get_db():
    """获取数据库连接（同步）"""
    conn = None
    try:
        if pool is None:
            init_pool()
        conn = pool
        yield conn
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"数据库操作错误: {e}")
        raise
    finally:
        pass  # 使用连接池，不关闭连接

def execute_query(sql: str, params: Optional[tuple] = None):
    """执行查询"""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(sql, params or ())
            result = cursor.fetchall()
            conn.commit()
            return result
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()

def execute_update(sql: str, params: Optional[tuple] = None):
    """执行更新"""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(sql, params or ())
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()

def execute_many(sql: str, params_list: list):
    """批量执行"""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.executemany(sql, params_list)
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            conn.rollback()
            raise
        finally:
            cursor.close()

