# 夏水仙 Lycoris 🌸

[简体中文](./README.md) | [English](./README.en.md)

**夏水仙**是一个为**跨性别者**提供**无障碍设施信息**和**互助信息**的平台 💗

夏水仙目前由以下页面组成：

- 地图：夏水仙的**核心功能**，我们可以在地图上标注无障碍卫生间、跨性别友好的医疗机构、母婴室等地点，实现信息共享
- 文档：目前编写了**雪雁的HRT指南**；旨在尽量用最简洁的语言、最容易理解的方式，把行之有效的HRT方案和踩过的坑分享给大家
- 关于：介绍夏水仙的项目理念、背景故事与联系方式，让来到这里的人知道这盏小灯为何被点亮

目前有**网页端**和基于 **React Native** 的**移动端**可供使用。

## Android APK 下载

[下载 Lycoris 1.0.1 Android APK](https://github.com/Eleanor1018/lycoris/releases/download/v1.0.1/Lycoris-v1.0.1.apk) · [SHA-256 校验文件](https://github.com/Eleanor1018/lycoris/releases/download/v1.0.1/Lycoris-v1.0.1.apk.sha256) · [发布说明](https://github.com/Eleanor1018/lycoris/releases/tag/v1.0.1)

本次版本为 **Lycoris 1.0.1（versionCode 3）**，支持 **Android 7.0 及以上**，包含 `arm64-v8a` 和 `x86_64` 架构。APK 沿用 2026-09-06 开始使用的 Release 签名，可在真机侧载安装。

**旧 v1.0 或此前开发包无法被本包覆盖安装，需先卸载旧包。卸载会清除本机登录状态、设置等应用数据。**

2026-09-06 使用同一证书的 **1.0.3 测试版（versionCode 2）可以直接覆盖更新**，无需卸载。本次显示版本为 1.0.1，Android 用于判断更新顺序的 `versionCode` 已由 2 递增至 3。

APK 包含运行所需的 JavaScript 和文档资源，**不需要启动 Metro**；连接生产 API `https://api.lycoris.online`，地图和账号等在线功能需要网络。

## 地图的内置功能

- 标记：可以在地图上标注无障碍卫生间，友好医疗机构，母婴室等点位信息，包含名称 图片 开放时间等。
- 搜索附近：快速搜索定位点附近（0-10000m）的无障碍卫生间等信息。
- 收藏：可以把点位添加到自己的收藏列表中，需要时快速查看。

**注意：添加或编辑点位需要管理员审核，这是为了防止被恶意破坏，敬请谅解。**

## 我们的理念

&ensp;&ensp;&ensp;&ensp;**以温柔与专业守护跨性别者的日常安全，让信息共享成为彼此的光。**

&ensp;&ensp;&ensp;&ensp;所有跨性别都有权利生活在阳光下，自然的展示自己，不必躲闪，不必隐藏，堂堂正正，大大方方。每一个人都应当有平等的权益，跨性别者也不例外。

&ensp;&ensp;&ensp;&ensp;社会的进步是缓慢的，然而每一个微小的努力都会被看见。就从无障碍卫生间开始。  

&ensp;&ensp;&ensp;&ensp;我们会搜集很多个无障碍卫生间，只要打开手机，就可以看到哪里可以上厕所。这样做，就可以让跨性别者，尽量不被误解、避免尴尬，能够放心大胆的出门。

&ensp;&ensp;&ensp;&ensp;**你不是孤单的。**
无论你现在处在探索、挣扎，还是重建生活的哪一步，你都值得被尊重、被认真对待。我们希望在你需要的时候，给你一点真实可用的支持，让你在现实世界里更安全一点、少受一点伤。

&ensp;&ensp;&ensp;&ensp;如果这盏小灯能在某个夜晚帮到你，那我们做的一切，就都值得。

## 技术栈

开发者快速了解项目：[程序架构](./docs/architecture.md)。

- frontend： React(Typescript)
- backend: Spring-Boot(Java)
- mobile: React Native（TypeScript，包含 Android / iOS 原生桥接）
- SQL: PostgreSQL（PostGIS 可选）

## 开源协议

本项目采用 [MIT License](./LICENSE) 开源。

## 克隆与初始化

本仓库已采用单仓库（Monorepo）结构，`backend` / `frontend` / `mobile` 都在同一个仓库中。

### 1. 准备环境并获取代码

| 组件 | 本仓库的要求 |
| --- | --- |
| JavaScript | Node.js 22（至少 22.12.0）或 Node.js 20（至少 20.19.4），以及随 Node 安装的 npm；同时满足 Vite 7 和 React Native 0.83.1 的要求。 |
| 后端 | JDK 21，设置 `JAVA_HOME`；Maven Wrapper 会下载 Maven 3.9.12 和项目依赖，无需另装 Maven。 |
| 数据库 | PostgreSQL 与 `psql` 工具；项目使用 `lycoris` 数据库。PostGIS 可按需要安装，当前附近查询使用普通经纬度字段与 SQL 距离计算。 |
| 缓存与会话 | Redis；下面提供 Docker 启动示例，也可使用本机 Redis。当前 Spring Boot 配置会自动启用 Redis 会话，开发环境也需要启动 Redis。 |
| Android | Android Studio、Android SDK Platform 36、Build-Tools 36.0.0、NDK 27.1.12297006；模拟器或开启 USB 调试的 Android 设备。 |
| iOS | macOS、完整 Xcode、Ruby/Bundler 与 CocoaPods；详细要求见 [iOS 指南](./mobile/IOS.md)。 |

以下示例获取包含本 README 所述功能的 `feature/ui-redesign` 分支：

```bash
git clone --branch feature/ui-redesign https://github.com/Eleanor1018/lycoris.git
cd lycoris
```

已有仓库时切换到该分支再更新；本机配置和依赖分别安装，不要复制其他机器的 `node_modules`。

```bash
git switch feature/ui-redesign
git pull
```

以下各节从仓库根目录开始操作。后端、网页和 Metro 分别保留在独立终端运行。

### 2. 后端：数据库、配置与依赖

启动 PostgreSQL，使用有建库权限的数据库账号创建本地开发库。下面以本机 `postgres` 账号为例，按提示输入自己设置的数据库口令：

```bash
psql -h localhost -U postgres -d postgres -c "CREATE DATABASE lycoris;"
```

如果数据库已经存在，跳过建库。若要使用 PostGIS，先安装与 PostgreSQL 匹配的扩展包，再由有权限的账号执行；当前版本的地图查询不要求此扩展：

```bash
psql -h localhost -U postgres -d lycoris -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Redis 可使用本机服务，或启动一个只绑定本机端口的开发容器：

```bash
docker run --name lycoris-redis -p 127.0.0.1:6379:6379 -d redis:7-alpine
```

如果已创建该容器，下次使用 `docker start lycoris-redis`。随后准备后端配置：

```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env` 中的 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD`，使它们对应自己的开发库；同时核对 `REDIS_HOST`、`REDIS_PORT` 和 `REDIS_PASSWORD`。不要沿用模板口令。

- 将模板中的 `SPRING_SESSION_STORE_TYPE` 设为 `redis`，并保持 Redis 可连接。当前 Spring Boot 3.5 的会话自动配置不以该变量的 `none` 值作为禁用开关。
- `MARKER_CACHE_REDIS_ENABLED` 和 `REGISTER_RATE_LIMIT_REDIS_ENABLED` 分别控制点位缓存与注册限流的 Redis 使用，不能关闭 Redis 会话。
- 本地 HTTP 调试保留 `SERVER_SSL_ENABLED=false`、`SESSION_COOKIE_SECURE=false`、`SESSION_COOKIE_SAME_SITE=lax`，并将 CORS 来源保留为本地网页地址。

**Spring Boot 和 Maven 不会自动读取 `.env`。** 以下命令显式将它作为 Java properties 导入；使用模板的 `KEY=value` 格式，值不额外包裹引号。操作系统环境变量也可提供这些配置。

macOS / Linux：

```bash
./mvnw spring-boot:run '-Dspring-boot.run.arguments=--spring.config.import=optional:file:.env[.properties]'
```

Windows PowerShell：

```powershell
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.arguments=--spring.config.import=optional:file:.env[.properties]'
```

首次运行会解析并下载后端依赖。默认监听 `http://localhost:8080`；可访问 `http://localhost:8080/api/markers/public` 检查 JSON 响应，空开发库返回空列表是正常的。

上述命令使用默认 `application.yml`。仓库另提供可选的 `application-local.yml`，需要其本地限流等设置时，在启动命令后追加 `'-Dspring-boot.run.profiles=local'`。

当前 `ddl-auto=update` 会为**空的开发库**创建实体表。已有数据库升级前先备份并停止旧后端，再按 [数据库迁移说明](./backend/deploy/migrations/README.md) 依次核对 `2026-09-05-bugfix-versions.sql` 和 `2026-09-06-marker-translations.sql`；这些脚本修改既有表，不能作为空库建表脚本。生产环境的约束、外键和索引应按迁移说明单独核对。

后端检查和打包可在 `backend/` 执行 `./mvnw verify`（Windows 为 `.\mvnw.cmd verify`）。仓库的 `docker-compose.local.yml` 只定义后端和 Redis，仍依赖宿主机 PostgreSQL；它不是完整的数据库初始化方案。

### 3. 网页：安装依赖并启动

在新的终端，从仓库根目录执行：

```bash
cd frontend
npm ci
cp .env.example .env.local
```

编辑 `frontend/.env.local`，本地开发保持 `VITE_API_BASE_URL=` 为空。没有对应底图 key 时，把 `VITE_THUNDERFOREST_API_KEY`、`VITE_TIANDITU_API_KEY` 等模板值清空，使用 OSM。

```bash
npm run dev
```

按终端显示的地址打开网页，默认是 `http://localhost:5173`。Vite 将 `/api` 和 `/uploads` 代理到 `http://localhost:8080`；自定义代理目标时，在启动 Vite 的**进程环境**中设置 `VITE_BACKEND_URL`。若本机存在配置的 HTTPS 证书与私钥，Vite 会自动使用 HTTPS，以终端输出为准。

构建和检查：

```bash
npm run build
npm run lint
```

静态产物在 `frontend/dist/`。部署静态网页时配置 `VITE_API_BASE_URL` 为目标 API；开发服务器的代理不会随静态产物发布。

### 4. Mobile：安装依赖并启动 Android / iOS

在新的终端，从仓库根目录安装移动端锁定的 JavaScript 依赖：

```bash
cd mobile
npm ci
```

**Android：** 在 Android Studio 的 SDK Manager 安装上述 SDK/NDK，配置 `ANDROID_HOME` 或本机 `android/local.properties` 的 `sdk.dir`，然后启动模拟器或连接调试设备。

```bash
cp .env.mobile.example .env.mobile
```

编辑 `mobile/.env.mobile`：Android 模拟器访问电脑上的后端可使用 `LY_API_BASE_URL=http://10.0.2.2:8080`；真机需改为手机可访问的电脑局域网地址。未使用的底图 key 留空即可。此配置编译进原生应用，修改后需要重新安装应用。

在 `mobile/` 启动 Metro：

```bash
npm start
```

另开终端，在 `mobile/` 安装并运行 Android 应用：

```bash
npm run android
```

**iOS（仅 macOS）：** 在 Mac 上重新运行 `npm ci`，安装完整 Xcode 和 Ruby/Bundler，再安装仓库 Gemfile 与 Pods 依赖：

```bash
bundle install
cd ios
bundle exec pod install
cd ..
npm start
```

另开终端，在 `mobile/` 执行 `npm run ios`。iOS 开发版默认从 Metro 主机推导后端的 8080 端口；自定义 Debug/Release 地址使用 `ios/RuntimeConfig.local.json`，不读取 Android 的 `.env.mobile`。Xcode、模拟器、真机网络、权限、签名和 Archive 的完整步骤见 [mobile/IOS.md](./mobile/IOS.md)。

移动端检查：

```bash
npm test -- --runInBand
npx tsc --noEmit
npm run lint
```

更多移动端配置见 [mobile/README.md](./mobile/README.md)。本地开发步骤与上方可直接安装的测试 APK 独立；后续更新包应沿用本次 Release 的包名和签名。
