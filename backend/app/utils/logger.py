import logging
import os
from logging.handlers import RotatingFileHandler
from app.core.config import settings

# 确保日志目录存在
log_dir = os.path.dirname(settings.LOG_FILE)
if log_dir and not os.path.exists(log_dir):
    os.makedirs(log_dir, exist_ok=True)

# 创建logger
logger = logging.getLogger("quant_monitor")
logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

# 创建formatter
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# 文件处理器
file_handler = RotatingFileHandler(
    settings.LOG_FILE,
    maxBytes=5 * 1024 * 1024,  # 5MB
    backupCount=5
)
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)

# 错误文件处理器
error_file_handler = RotatingFileHandler(
    os.path.join(os.path.dirname(settings.LOG_FILE), "error.log"),
    maxBytes=5 * 1024 * 1024,
    backupCount=5
)
error_file_handler.setLevel(logging.ERROR)
error_file_handler.setFormatter(formatter)

# 控制台处理器
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# 添加处理器
logger.addHandler(file_handler)
logger.addHandler(error_file_handler)
if settings.DEBUG:
    logger.addHandler(console_handler)

