# Native Android Web Frontend Parity Design

## 背景

Lycoris 现在已有 Web 前端、后端和一个 React Native 移动端。新的 Android 版本不以 React Native 端为迁移标准，而是以当前 `frontend` 的 React/TypeScript 实现为蓝本，把 Web 前端的核心功能、交互逻辑和视觉风格翻译成 Kotlin 原生 Android。

这一版目标是先跑通核心逻辑。后端不改动，Android 客户端只对接现有接口。地图第一版只使用 OSM，未来再按需要补充其他瓦片源。

## 目标

- 新建独立的 Kotlin 原生 Android 工程，不破坏现有 `frontend`、`backend`、`mobile`。
- 以 Web 前端为功能和样式来源，迁移用户能真实使用的核心流程。
- 复用现有后端 API、session、上传接口和 `clientRequestId` 幂等机制。
- 第一版地图只用 OSM 跑通点位浏览、定位、点位详情和新增点位。
- 用原生 Android 能力实现地图、定位、图片选择、上传和页面导航。
- 保持实现朴素清晰，先可运行，再逐步完善体验。

## 非目标

- 不改后端接口、数据库、认证方式或上传流程。
- 不把 React Native 端作为迁移源，也不迁移 RN 特有的 WebView/Leaflet 实现方式。
- 不在第一版实现多地图源切换、离线地图包、后台定位或复杂缓存。
- 不在第一版迁移管理后台能力。
- 不重做产品信息架构，不扩大 Web 前端当前功能范围。

## 工程结构

新建目录：

```text
android-native/
```

推荐使用单 app 工程起步，包结构按功能分层：

```text
android-native/app/src/main/java/.../
  core/
    network/
    session/
    design/
    location/
    image/
  feature/
    auth/
    map/
    profile/
    documents/
    search/
  app/
```

第一版不拆多 Gradle module，避免工程复杂度过早上升。业务逻辑用普通 Kotlin 类和 repository 封装，Compose 页面只负责状态展示和事件转发。

## 技术选型

- UI：Jetpack Compose + Material 3。
- 地图：osmdroid，第一版只配置 OSM 瓦片。
- 网络：Retrofit + OkHttp。
- JSON：kotlinx.serialization。
- 会话：OkHttp CookieJar 持久化后端 session cookie。
- 本地设置：DataStore，用于保存 API base URL、地图视图状态、筛选条件和用户偏好。
- 定位：Android 标准定位能力，封装为 `LocationProvider`，页面不直接依赖具体定位实现。
- 图片：Android Photo Picker；上传前做尺寸和体积控制，再通过 multipart 调用现有接口。

## 设计风格迁移

Android 设计语言应贴近 Web 前端，而不是 RN 端。

从 `frontend/src/theme.ts` 和地图页样式迁移基础 token：

- 主色：`#5a3850` / 地图强调色 `#7a4b8f`
- 辅色：`#d0bcff`
- 页面背景：`#f8ebff`，局部可使用 Web 当前的浅灰到淡紫背景感
- 卡片背景：`#ffffff`
- 正文色：`#1d1b20`
- 次级文字：`rgba(35, 24, 40, 0.72)`
- 边框：`rgba(122, 75, 143, 0.12)`
- 按钮：圆角胶囊按钮，文字不全大写
- 表单：小尺寸输入框、柔和边框、聚焦时紫色描边

Compose 中建立 `LycorisTheme`，集中定义 `ColorScheme`、Typography、Shape 和常用组件样式。地图页的浮动按钮、筛选面板、详情弹层和表单弹窗优先按 Web 版布局语义翻译成原生组件。

## 页面迁移范围

第一阶段迁移 Web 端核心用户功能：

- 登录：对应 `frontend/src/pages/Login.tsx`
- 注册：对应 `frontend/src/pages/Register.tsx`
- 我的：对应 `frontend/src/pages/Profile.tsx`
- 修改密码：对应 `frontend/src/pages/ChangePassword.tsx`
- 地图：对应 `frontend/src/pages/Maps.tsx`
- 搜索：对应 `frontend/src/pages/Search.tsx`
- 文档：对应 `frontend/src/pages/Documents.tsx`
- 关于/首页内容：按移动端导航需要合并到“我的”或“文档”入口

第一版 Android 主导航建议为三到四个 tab：

- 地图
- 搜索
- 文档
- 我的

第一版按四个 tab 实现，保持 Web 端“地图 / 搜索 / 文档 / 我的”的核心入口清晰可见。

## 接口映射

Android 只接现有接口，不新增后端能力。

认证：

- `POST /api/login`
- `POST /api/register`
- `GET /api/me`
- `PATCH /api/me`
- `POST /api/me/avatar`
- `POST /api/me/password`
- `POST /api/logout`

地图点位：

- `GET /api/markers/viewport`
- `GET /api/markers/search`
- `GET /api/markers/nearby`
- `POST /api/markers`
- `PATCH /api/markers/{id}`
- `DELETE /api/markers/{id}`
- `POST /api/markers/{id}/image`
- `POST /api/markers/{id}/favorite`
- `DELETE /api/markers/{id}/favorite`
- `GET /api/markers/me/favorites`
- `GET /api/markers/me/created`
- `GET /api/markers/me/favorites/details`

静态资源：

- 后端返回的 `/uploads/...` 相对路径由 Android 网络层拼接为完整 URL。
- 文档 markdown 和文档图片第一版打包为 app assets，来源对应 `frontend/src/docs` 和 `frontend/src/doc_images`。

## 地图 MVP

地图第一版只关注跑通核心逻辑：

1. 显示 OSM 地图。
2. 请求前台定位权限。
3. 获取当前位置并在地图上显示。
4. 根据当前视口调用 `/api/markers/viewport`。
5. 将点位渲染为不同颜色的 marker。
6. 点击点位打开原生底部详情弹层。
7. 支持分类筛选、我的/收藏筛选。
8. 支持附近搜索，调用 `/api/markers/nearby`。
9. 支持新增点位，用户在地图上选点后填写表单。
10. 支持编辑/删除自己创建的点位，按 Web 当前权限表现处理后端返回结果。

osmdroid 通过 Compose 的 `AndroidView` 承载。Compose 层负责工具栏、浮动按钮、筛选面板、详情弹层和表单；地图 adapter 只负责地图生命周期、marker 渲染、视口变化和点击事件回调。

## 新增点位和图片上传

新增点位流程保持 Web 端逻辑：

1. 用户在地图上进入添加模式。
2. 用户选择点位坐标。
3. Android 生成一次性的 `clientRequestId`。
4. 用户填写分类、标题、描述、公开状态和开放时间。
5. 调用 `POST /api/markers`，提交文字字段和 `clientRequestId`。
6. 如果文字点位创建成功且用户选择了图片，再调用 `POST /api/markers/{id}/image`。
7. 图片上传失败不回滚文字点位，向用户提示点位已提交、图片上传失败。
8. 保存按钮在请求期间禁用，避免重复点击；后端幂等作为第二层保护。

图片选择第一版只支持从相册选择一张图片。压缩和体积限制遵循 Web/RN 当前的 5MB 约束。

## 状态和错误处理

- 网络层统一把非 2xx 响应转换为可展示错误。
- `401` 统一清理本地登录状态，并引导用户重新登录。
- 地图点位加载失败时保留现有地图状态，显示轻量提示，不清空用户上下文。
- 定位权限被拒绝时地图仍可浏览，只禁用“附近搜索”和“定位到我”。
- 图片加载失败时显示占位，不阻断点位详情。
- 弱网下所有提交按钮进入 loading/disabled 状态。

## 数据模型

Android 端建立与 Web TypeScript 类型对应的 Kotlin data class：

- `User`
- `AuthResponse`
- `Marker`
- `MarkerCategory`
- `MarkerCreateRequest`
- `MarkerUpdateRequest`
- `NearbyMarker`
- `DocumentItem`

后端返回数组、分页包装或 `{ data: ... }` 的情况由 repository 层做兼容解析，Compose 页面只消费稳定模型。

## 实施阶段

第一阶段：工程和基础能力

- 创建 `android-native` 工程。
- 建立 `LycorisTheme`。
- 建立 Retrofit/OkHttp/DataStore/session 基础设施。
- 接通 `/api/me`、登录、注册和退出。

第二阶段：地图主流程

- 接入 osmdroid OSM 地图。
- 完成定位权限和当前位置显示。
- 完成视口点位加载和点位详情弹层。
- 完成收藏、分类筛选和附近搜索。

第三阶段：点位编辑提交

- 完成新增点位表单。
- 接入 `clientRequestId`。
- 完成图片选择和上传。
- 完成编辑和删除自己点位。

第四阶段：我的、搜索、文档

- 迁移我的资料、头像、密码修改。
- 迁移我的点位和收藏列表，支持跳转地图定位。
- 迁移搜索页。
- 迁移文档页和关于内容。

第五阶段：体验打磨

- 补齐加载、空状态、错误提示。
- 优化移动端表单输入和软键盘行为。
- 做真机验证和基础 UI polish。
- 添加必要单元测试和少量手动验收脚本。

## 验收标准

- Android app 可以从干净环境启动并连接现有后端。
- 用户可以注册、登录、保持登录、退出。
- 地图能显示 OSM 和后端点位。
- 用户可以查看点位详情、收藏点位、查询附近点位。
- 用户可以新增点位，并在弱网或图片上传失败时不重复创建文字点位。
- 用户可以查看和管理“我的”基础信息、头像、密码、我的点位和收藏。
- 文档页能阅读 Web 端已有主要文档内容。
- 后端无代码改动。

## 测试策略

- 网络 repository 使用 fake service 做单元测试，覆盖登录、点位解析、上传错误和 `401`。
- `clientRequestId` 生成和提交状态用单元测试覆盖。
- 地图 adapter 的 marker 数据转换用普通 Kotlin 测试覆盖。
- Compose 页面重点做状态驱动测试，不在第一版追求完整截图测试。
- 手动验收至少覆盖登录、地图加载、定位授权、点位新增、图片失败、收藏、附近搜索、我的资料和文档阅读。

## 需要用户确认

当前设计以“Web 前端为蓝本、后端不改、OSM 先跑通、Kotlin 原生实现”为准。用户确认后，再进入实施计划，拆出可执行任务并开始创建 `android-native` 工程。
