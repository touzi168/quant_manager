# 量化可视化和监控系统

面向量化交易团队的可视化与监控平台，提供策略级资产监控、资金曲线分析、主机运行状态巡检以及权限管理等能力，帮助团队以统一界面掌握交易系统全貌。

## 功能亮点
- **多维度可视化**：资金曲线、资产分布、持仓分布、盈亏趋势等一览。
- **实时监控**：策略进程、服务器健康、磁盘容量、收益率等指标统一展示。
- **精细化权限**：支持用户、策略、资源三级授权，配合 Google Authenticator 保障登录安全。
- **数据聚合与缓存**：对资产、持仓、收益等高频数据进行聚合与分层缓存，兼顾实时性与性能。
- **统一 API**：所有前端与移动端均通过 API 网关访问，具备限流、审计与统一响应规范。

## 系统架构概览
```
前端 (React/Vue, 移动端)
        ↓
API 网关 (认证、限流、路由)
        ↓
核心服务集群
├─ 认证服务 (JWT + 2FA)
├─ 核心业务服务 (数据聚合、策略逻辑)
└─ 实时数据推送 (WebSocket)
        ↓
数据层
├─ MariaDB (业务数据 + 历史行情)
└─ Redis (会话、缓存、分布式锁)
        ↓
外部服务：Google Authenticator、邮件通知
```

## 技术栈
| 层级 | 技术 |
| --- | --- |
| 前端 | React 18 / Vue 3、Ant Design / Element Plus、ECharts / Chart.js、Vite / Webpack |
| 后端 | Node.js + Express 或 Python + FastAPI、Node-cron / Celery、Swagger/OpenAPI |
| 数据 | MariaDB、Redis、InfluxDB（可选时序分析） |
| 安全 | JWT、Google Authenticator、RBAC 权限体系 |
| 运维 | Docker / Docker Compose、Nginx、APM、日志与指标采集 |

## 数据库概述
- **现有表**：`account`、`assets`、`equity`、`cny_rates`、`health`、`hosts`、`income`、`mytrades`、`positions`、`processes`。
- **新增系统表**：`users`、`user_sessions`、`password_resets`、`strategies`、`user_strategy_permissions`、`system_config`、`aggregated_data_cache`、`user_access_logs`。
- **索引策略**：围绕资金曲线、持仓、交易与收入等核心查询构建复合索引，详见设计文档对应章节。

## API 设计摘要
- **认证**：登录、注册、Token 刷新、Google 2FA 开启与校验。
- **用户**：个人资料、密码修改、会话管理。
- **管理员**：用户管理、策略授权、系统配置。
- **数据展示**：管理员与普通用户分别拥有仪表盘、策略汇总、资金曲线、资产、持仓、健康状态等接口。
- **统一响应格式**：包含 `success`、`code`、`message`、`data`、`timestamp` 字段，分页接口附带 `pagination` 元数据。

## 快速开始
### 环境要求
- Node.js 18+ 或 Python 3.11+
- MariaDB 10.8+
- Redis 7+
- Docker / Docker Compose（推荐）

### 使用 Docker Compose
```bash
docker compose up -d
```
默认服务：
- `web-app`：提供前端静态资源与 API 接口。
- `mariadb`：主业务数据库，初始化库名 `quant_monitor`。
- `redis`：缓存与会话。
- `influxdb`：可选的时序指标库。

### 本地开发
1. 复制 `.env.example` 为 `.env` 并填写数据库、Redis、SMTP、JWT、Google Auth 等配置。
2. 安装依赖并启动：
   - Node.js 版本：
     ```bash
     npm install
     npm run dev
     ```
   - FastAPI 版本：
     ```bash
     pip install -r requirements.txt
     uvicorn app.main:app --reload
     ```
3. 前端使用 Vite：
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 安全与性能
- **安全**：HTTPS、JWT + 2FA、请求限流、CORS 控制、敏感数据脱敏、审计日志。
- **性能**：Redis 缓存、数据重采样（7d 原始 / ≥30d 1h 重采样）、分页与懒加载、ECharts 虚拟滚动。
- **监控**：APM、服务器与数据库指标、缓存命中率、异常登录监控。

## 部署建议
- Nginx 作为入口，负责 SSL、负载均衡及健康检查。
- Web/API 服务支持水平扩展；Redis 与 MariaDB 推荐主从或集群部署。
- 采用蓝绿/灰度发布，配合自动回滚与多层备份。

## 开发计划（建议）
1. **阶段一**：数据库设计、项目骨架、认证模块、基础 API。
2. **阶段二**：权限、数据聚合与缓存、用户/管理员界面。
3. **阶段三**：高级可视化、性能与安全测试。
4. **阶段四**：部署上线、集成测试、文档完善。

## 目录
当前仓库文件较少，设计文档位于：
- `量化可视化和监控系统设计文档.md`

## 参考
- 更多设计细节（架构、数据库、API、组件、部署、安全、运维、计划等）请查看 `量化可视化和监控系统设计文档.md`。
