# 量化监控系统后端 (Python)

## 安装依赖

```bash
pip install -r requirements.txt
```

## 配置环境变量

复制 `.env.example` 为 `.env` 并配置相关参数：

```bash
cp .env.example .env
```

## 数据库迁移

运行数据库迁移脚本创建系统表：

```bash
python -m app.database.migrate
```

## 启动服务

开发模式：
```bash
python main.py
```

或使用uvicorn：
```bash
uvicorn main:app --host 0.0.0.0 --port 6666 --reload
```

生产模式：
```bash
uvicorn main:app --host 0.0.0.0 --port 6666 --workers 4
```

## API文档

启动服务后访问：
- Swagger UI: http://localhost:6666/docs
- ReDoc: http://localhost:6666/redoc

## 项目结构

```
backend/
├── app/
│   ├── api/              # API路由
│   │   └── v1/
│   │       ├── auth.py   # 认证路由
│   │       ├── users.py  # 用户路由
│   │       ├── admin.py  # 管理员路由
│   │       └── dashboard.py  # 仪表板路由
│   ├── core/             # 核心配置
│   │   ├── config.py     # 配置
│   │   ├── database.py   # 数据库连接
│   │   └── redis_client.py  # Redis连接
│   ├── database/         # 数据库迁移
│   │   └── migrate.py
│   ├── middleware/       # 中间件
│   │   └── auth.py       # 认证中间件
│   ├── services/         # 业务服务
│   │   └── data_aggregation.py  # 数据聚合服务
│   └── utils/            # 工具函数
│       ├── logger.py     # 日志工具
│       ├── response.py   # 响应格式化
│       ├── jwt.py        # JWT工具
│       ├── password.py   # 密码工具
│       ├── google_auth.py  # Google认证工具
│       └── email.py      # 邮件工具
├── logs/                 # 日志目录
├── main.py              # 服务器入口
├── requirements.txt     # Python依赖
└── .env                 # 环境变量配置
```

