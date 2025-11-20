# 快速启动指南

## 前置要求

- Python 3.11+
- Node.js 18+
- MariaDB 10.8+ (已存在 `bquant` 数据库)
- Redis 7+
- pip 和 npm

## 步骤1: 配置后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

编辑 `backend/.env` 文件，配置数据库连接：

```env
DB_HOST=172.168.200.200
DB_PORT=3306
DB_NAME=bquant
DB_USER=test
DB_PASSWORD=test

REDIS_HOST=localhost
REDIS_PORT=6379
```

## 步骤2: 初始化数据库

运行数据库迁移脚本创建系统表：

```bash
cd backend
python -m app.database.migrate
```

这将创建以下表：
- users (用户表)
- user_sessions (会话表)
- password_resets (密码重置表)
- strategies (策略表)
- user_strategy_permissions (权限表)
- system_config (系统配置表)
- aggregated_data_cache (缓存表)
- user_access_logs (访问日志表)

同时会创建默认管理员账户：
- 邮箱: admin@quant-monitor.com
- 密码: Admin@123456

## 步骤3: 启动后端服务

```bash
cd backend
python main.py
```

后端服务将在 http://localhost:6666 启动

## 步骤4: 启动前端服务

打开新的终端窗口：

```bash
cd frontend
npm install
npm run dev
```

前端应用将在 http://localhost:7777 启动

## 步骤5: 访问系统

1. 打开浏览器访问 http://localhost:7777
2. 使用默认管理员账户登录：
   - 邮箱: admin@quant-monitor.com
   - 密码: Admin@123456

## 下一步

1. **修改默认管理员密码**：登录后立即修改密码
2. **配置邮件服务**：在 `.env` 中配置SMTP设置以启用邮件功能
3. **创建策略**：在数据库中创建策略记录，关联到 `account` 表的账户
4. **分配权限**：为普通用户分配策略访问权限

## 常见问题

### 数据库连接失败

检查：
- MariaDB服务是否运行
- `.env` 中的数据库配置是否正确
- 数据库用户是否有足够权限

### Redis连接失败

检查：
- Redis服务是否运行
- `.env` 中的Redis配置是否正确

### 前端无法连接后端

检查：
- 后端服务是否正常运行在 6666 端口
- `vite.config.js` 中的代理配置是否正确

## Docker部署

如果使用Docker部署：

```bash
# 修改 docker-compose.yml 中的数据库配置
# 然后运行
docker-compose up -d
```

## API文档

后端启动后，访问以下地址查看完整的API文档：
- Swagger UI: http://localhost:6666/docs
- ReDoc: http://localhost:6666/redoc

