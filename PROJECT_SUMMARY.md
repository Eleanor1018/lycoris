# Lycoris 项目总览（2026-02-10）

本文档用于快速理解当前项目状态，作为后续开发协作的统一基线。

## 1. 仓库结构

- `frontend`：Web 前端（React + Vite + TypeScript + MUI + Leaflet）
- `backend`：后端（Spring Boot + JPA + PostgreSQL + Redis）
- `rn`：移动端雏形（React Native）

## 2. 当前产品定位

- 主线是“地图点位协作平台”
- 核心能力：点位创建、编辑提案、图片提案、收藏、附近查询、审核、管理员后台和二级密码
- 整体状态：Web + Backend 功能较完整，RN 仍在早期对接阶段

## 3. Frontend（Web）总结

### 3.1 主要技术

- React 19 + TypeScript + Vite
- MUI 组件体系
- `react-leaflet` 地图渲染
- Axios（`withCredentials`）调用后端

### 3.2 功能现状

- 路由完整：主页、地图、文档、关于、搜索、登录注册、个人中心、管理员页面
- 认证：`AuthProvider` 统一管理 `/api/me`、`/api/logout`
- 地图页能力较完整：
  - 视口加载点位（`/api/markers/viewport`）
  - 分类筛选、我的点位筛选、收藏筛选
  - 附近查询（类别 + 半径）
  - 新建点位、编辑提案、图片提案、删除、收藏
  - 搜索结果跳转地图并定位
  - 坐标复制、可用时段展示、移动端交互优化
- 个人中心：
  - 编辑昵称/代词/签名
  - 上传头像
  - 展示“我创建的点位”和“我收藏的点位”
- 文档系统：
  - Markdown 渲染
  - 自动目录
  - 阅读偏好（字号/字体）本地持久化
- 管理后台：
  - 管理入口（二级密码）
  - 审核中心（点位/编辑提案/图片提案）
  - 全量点位管理
  - 用户管理（删除/恢复/重置密码）

### 3.3 测试现状

- 已有 Cypress E2E 用例覆盖关键流程（地图、搜索跳转、移动端导航、文档页面等）

## 4. Backend 总结

### 4.1 主要技术

- Spring Boot 3.5
- Spring Security + Session
- Spring Data JPA
- PostgreSQL（附近查询依赖 PostGIS）
- Redis（Session、限流、短 TTL 缓存）

### 4.2 认证与权限

- 登录后通过 `HttpSession` 维护用户身份
- `SessionAuthFilter` 将 Session 信息注入 Security Context
- 管理员接口要求 `ROLE_ADMIN`
- 管理敏感接口要求二级密码（30 分钟 TTL）

### 4.3 点位领域能力

- 点位包含：类别、公开状态、可用状态、开放时间窗、图片、创建者等
- 审核机制：
  - 新建点位默认 `PENDING`
  - 编辑提案与图片提案独立审核
  - 管理员批准后生效
- “非本人编辑”可追踪（`lastEditedByOwner` 等字段）
- 搜索支持关键词与经纬度文本匹配
- 视口查询/附近查询支持 Redis 缓存（短时效）

### 4.4 用户管理能力

- 注册、登录、登出、修改资料、头像上传、修改密码
- 用户软删除与恢复
- 管理员重置用户密码
- 注册请求限流（Redis 优先，内存兜底）

## 5. RN（跨平台）总结

### 5.1 当前状态

- 可运行雏形，尚未与 Web 功能对齐
- 三个 tab：地图、文档、我的

### 5.2 已接入能力

- 登录态流程（`/api/login`、`/api/me`、`/api/logout`）
- 地图页 v0：加载公共点位列表（非地图交互）
- 文档页 v0：跳转到 Web 文档
- 我的页 v0：登录与基础信息显示

### 5.3 待建设方向

- 接入原生地图交互（`react-native-maps`）
- 我的页面补齐资料编辑/头像上传/收藏同步
- 文档改为 App 内渲染与离线能力

## 6. 部署与运维现状

- 后端包含 Dockerfile 与 `docker-compose.ec2.yml`
- 提供 Nginx 反代样例（`api.lycoris.online`）
- 提供发布与回滚脚本（`deploy.sh` / `rollback.sh`）
- 支持跨子域 Session Cookie 配置

## 7. 当前阶段结论

- `frontend + backend`：进入可持续迭代阶段
- `rn`：处于能力接入早期
- 后续建议优先级：
  1. 稳定并继续迭代 Web + Backend 主线功能
  2. 分阶段将 RN 与现有 API 能力对齐（先地图，再我的，再文档）
  3. 保持审核链路与数据可信度为核心产品资产

