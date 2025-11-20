"""
数据库迁移脚本
运行: python -m app.database.migrate
"""
from app.core.database import init_pool, execute_update
from app.utils.password import hash_password
from app.utils.logger import logger
import os
from dotenv import load_dotenv

load_dotenv()

def create_tables():
    """创建系统表"""
    try:
        logger.info("开始创建数据库表...")
        
        # 用户表
        execute_update("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL COMMENT '用户邮箱，即用户名',
                password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
                nickname VARCHAR(100) COMMENT '用户昵称',
                role ENUM('admin', 'user') DEFAULT 'user' COMMENT '用户角色',
                is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
                google_secret VARCHAR(32) COMMENT 'Google Authenticator密钥',
                google_enabled BOOLEAN DEFAULT FALSE COMMENT '是否启用Google认证',
                last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表'
        """)
        logger.info("✓ 用户表创建成功")
        
        # 用户会话表
        execute_update("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_session_token (session_token),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会话表'
        """)
        logger.info("✓ 用户会话表创建成功")
        
        # 密码重置表
        execute_update("""
            CREATE TABLE IF NOT EXISTS password_resets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                reset_token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_reset_token (reset_token),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='密码重置表'
        """)
        logger.info("✓ 密码重置表创建成功")
        
        # 策略表
        execute_update("""
            CREATE TABLE IF NOT EXISTS strategies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL COMMENT '策略名称',
                description TEXT COMMENT '策略描述',
                account_email VARCHAR(255) NOT NULL COMMENT '关联的交易所账户',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_account_email (account_email),
                INDEX idx_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略表'
        """)
        logger.info("✓ 策略表创建成功")
        
        # 用户策略关联表
        execute_update("""
            CREATE TABLE IF NOT EXISTS user_strategy_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                strategy_id INT NOT NULL,
                permission_type ENUM('view', 'manage') DEFAULT 'view',
                granted_by INT COMMENT '授权人ID',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE,
                FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
                UNIQUE KEY unique_user_strategy (user_id, strategy_id),
                INDEX idx_user_id (user_id),
                INDEX idx_strategy_id (strategy_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户策略权限表'
        """)
        logger.info("✓ 用户策略权限表创建成功")
        
        # 系统配置表
        execute_update("""
            CREATE TABLE IF NOT EXISTS system_config (
                id INT AUTO_INCREMENT PRIMARY KEY,
                config_key VARCHAR(100) UNIQUE NOT NULL,
                config_value TEXT,
                description VARCHAR(255),
                updated_by INT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_config_key (config_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表'
        """)
        logger.info("✓ 系统配置表创建成功")
        
        # 聚合数据缓存表
        execute_update("""
            CREATE TABLE IF NOT EXISTS aggregated_data_cache (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cache_key VARCHAR(255) UNIQUE NOT NULL,
                cache_type ENUM('asset_summary', 'position_summary', 'equity_curve', 'health_status') NOT NULL,
                data JSON NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cache_type (cache_type),
                INDEX idx_expires_at (expires_at),
                INDEX idx_cache_key (cache_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聚合数据缓存表'
        """)
        logger.info("✓ 聚合数据缓存表创建成功")
        
        # 用户访问日志表
        execute_update("""
            CREATE TABLE IF NOT EXISTS user_access_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(50),
                resource_id VARCHAR(100),
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_action (user_id, action),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户访问日志表'
        """)
        logger.info("✓ 用户访问日志表创建成功")
        
        # 创建现有数据库表的索引（如果不存在）
        try:
            execute_update("CREATE INDEX IF NOT EXISTS idx_equity_email_time ON equity(email(768), time)")
        except:
            pass
        
        try:
            execute_update("CREATE INDEX IF NOT EXISTS idx_positions_email_symbol ON positions(email(768), symbol(768))")
        except:
            pass
        
        try:
            execute_update("CREATE INDEX IF NOT EXISTS idx_mytrades_email_time ON mytrades(email, time)")
        except:
            pass
        
        try:
            execute_update("CREATE INDEX IF NOT EXISTS idx_income_email_time ON income(email, time)")
        except:
            pass
        
        logger.info("✓ 数据库索引创建完成")
        logger.info("数据库表创建完成！")
    except Exception as e:
        logger.error(f"数据库表创建失败: {e}")
        raise

def create_default_admin():
    """创建默认管理员账户"""
    try:
        from app.core.database import execute_query
        
        # 检查是否已存在管理员
        admins = execute_query("SELECT id FROM users WHERE role = 'admin'")
        
        if admins:
            logger.info("管理员账户已存在，跳过创建")
            return
        
        # 创建默认管理员
        default_password = os.getenv("ADMIN_DEFAULT_PASSWORD", "Admin@123456")
        password_hash = hash_password(default_password)
        
        execute_update(
            "INSERT INTO users (email, password_hash, nickname, role, is_active) VALUES (%s, %s, %s, 'admin', TRUE)",
            ("admin@quant-monitor.com", password_hash, "系统管理员")
        )
        
        logger.info("✓ 默认管理员账户创建成功")
        logger.info(f"  邮箱: admin@quant-monitor.com")
        logger.info(f"  密码: {default_password}")
        logger.warning("⚠ 请尽快修改默认管理员密码！")
    except Exception as e:
        logger.error(f"创建默认管理员失败: {e}")
        raise

def migrate():
    """执行迁移"""
    try:
        init_pool()
        create_tables()
        create_default_admin()
        logger.info("数据库迁移完成！")
    except Exception as e:
        logger.error(f"数据库迁移失败: {e}")
        raise

if __name__ == "__main__":
    migrate()

