# Lycoris Mobile

React Native 版本的前端骨架，目标与 Web 前端保持一致的核心信息结构。

当前版本已包含：
- 底部三栏导航：`地图`、`文档`、`我的`
- Auth 基础能力：`/api/login`、`/api/me`、`/api/logout`
- 地图页 v1：`react-native-webview + Leaflet`（OSM / Thunderforest / 天地图）+ 分类筛选 + 附近查询 + 收藏
- 文档页 v0：先跳转网页文档入口

## 目录结构

```text
src/
  auth/AuthProvider.tsx
  components/PageBackground.tsx
  config/runtime.ts
  lib/http.ts
  screens/
    DocsScreen.tsx
    MapScreen.tsx
    MeScreen.tsx
  theme/colors.ts
  types/
```

## 运行

1. 启动 Metro

```sh
npm start
```

2. 启动 Android

```sh
npm run android
```

3. 启动 iOS

```sh
npm run ios
```

## API 地址配置

`src/config/runtime.ts` 当前策略：
- `__DEV__ = true` 时默认 `http://10.0.2.2:8080`（Android 模拟器访问本机后端）
- 生产默认 `https://api.lycoris.online`
- `LY_THUNDERFOREST_API_KEY` / `LY_TIANDITU_API_KEY` 不再内置默认值（未注入则为空）

### Android 更安全注入（推荐）

1. 复制模板：

```sh
cp .env.mobile.example .env.mobile
```

2. 在 `mobile/.env.mobile` 填入：

```env
LY_API_BASE_URL=http://10.0.2.2:8080
LY_THUNDERFOREST_API_KEY=your_thunderforest_key
LY_TIANDITU_API_KEY=your_tianditu_key
```

3. 重新安装 App：

```sh
npm run android
```

优先级（高 -> 低）：
1. `globalThis.LY_*`（仅临时调试）
2. Android 原生 `BuildConfig` 注入（来自 `-PLY_*` / 系统环境变量 / `.env.mobile`）
3. 默认值（仅 `API_BASE_URL` 有默认；地图 key 默认空）

## Android 正式签名（Release）

1. 生成正式 keystore（示例）：

```sh
cd android
mkdir -p keystore
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore keystore/lycoris-upload.jks \
  -alias lycoris-upload \
  -keyalg RSA -keysize 2048 -validity 36500
```

2. 复制并填写签名配置：

```sh
cp keystore.properties.example keystore.properties
```

3. 构建 release apk：

```sh
./gradlew assembleRelease
```

产物路径：

`android/app/build/outputs/apk/release/app-release.apk`

## 下一步建议

1. 接入点位新增/编辑（当前“添加”按钮先跳转网页端）。
2. 把文档页改为 App 内 Markdown 渲染（离线可读）。
3. 完善“我的”页面（资料编辑、头像上传、更多账户设置）。
