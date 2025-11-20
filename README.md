# 量化可视化和监控系统

基于设计文档实现的完整量化交易可视化和监控系统。

## 项目结构

```
quant_manager/
├── backend/              # 后端服务 (Python + FastAPI)
│   ├── app/
│   │   ├── api/         # API路由
│   │   ├── core/        # 核心配置
│   │   ├── database/    # 数据库迁移
│   │   ├── middleware/  # 中间件
│   │   ├── services/    # 业务服务
│   │   └── utils/       # 工具函数
│   ├── main.py          # 服务器入口
│   └── requirements.txt # Python依赖
├── frontend/            # 前端应用 (React + Vite)
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/       # 页面
│   │   └── store/       # 状态管理
│   └── package.json
├── docker-compose.yml   # Docker Compose配置
└── README.md
```

## 功能特性

### 用户认证
- ✅ 用户注册（邮箱验证）
- ✅ 用户登录（JWT认证）
- ✅ Google Authenticator二次认证
- ✅ 密码重置
- ✅ 会话管理

### 权限管理
- ✅ 基于角色的访问控制（RBAC）
- ✅ 策略级别的数据隔离
- ✅ 管理员权限管理
- ✅ 用户权限分配

### 数据展示
- ✅ 资产汇总
- ✅ 持仓汇总
- ✅ 资金曲线（支持多指标、多时间范围）
- ✅ 健康状态监控
- ✅ 进程状态监控

### 管理功能
- ✅ 用户管理
- ✅ 策略管理
- ✅ 权限分配
- ✅ 系统配置

## 快速开始

### 前置要求

- Python 3.11+
- Node.js 18+
- MariaDB 10.8+
- Redis 7+
- Docker (可选)

### 本地开发

#### 1. 后端设置

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 文件配置数据库和Redis连接

# 运行数据库迁移
python -m app.database.migrate

# 启动开发服务器
python main.py
```

后端服务运行在 http://localhost:6666

#### 2. 前端设置

```bash
cd frontend
npm install
npm run dev
```

前端应用运行在 http://localhost:7777

### Docker部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 环境配置

### 后端环境变量 (.env)

```bash
# 应用配置
DEBUG=False
PORT=6666
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=86400

# 数据库配置
DB_HOST=172.168.200.200
DB_PORT=3306
DB_NAME=bquant
DB_USER=test
DB_PASSWORD=test

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 邮件配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your_email_password

# 前端URL
CORS_ORIGINS=["http://localhost:7777"]
```

## API文档

启动后端服务后，访问：
- Swagger UI: http://localhost:6666/docs
- ReDoc: http://localhost:6666/redoc

## 默认账户

运行数据库迁移后，系统会自动创建默认管理员账户：

- 邮箱: admin@quant-monitor.com
- 密码: Admin@123456

**⚠️ 请在生产环境中立即修改默认密码！**

## 数据库表结构

系统会在现有 `bquant` 数据库基础上创建以下新表：

- `users` - 用户表
- `user_sessions` - 用户会话表
- `password_resets` - 密码重置表
- `strategies` - 策略表
- `user_strategy_permissions` - 用户策略权限表
- `system_config` - 系统配置表
- `aggregated_data_cache` - 聚合数据缓存表
- `user_access_logs` - 用户访问日志表

## 技术栈

### 后端
- Python 3.11
- FastAPI
- MariaDB (MySQL)
- Redis
- JWT认证
- Google Authenticator
- Swagger/ReDoc API文档

### 前端
- React 18
- Vite
- Ant Design
- ECharts
- Redux Toolkit
- React Router

## 许可证

ISC

