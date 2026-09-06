# Lycoris Mobile

Lycoris 的 React Native 手机端，与网页共用后端。iOS 的 Mac 调试、原生配置和打包步骤见 [IOS.md](IOS.md)。

当前版本已包含：
- 底部三栏导航：`地图`、`文档`、`我的`
- Auth 基础能力：`/api/login`、`/api/me`、`/api/logout`
- 地图：`react-native-webview + Leaflet`（OSM / Thunderforest / 天地图）、分类筛选、搜索、附近查询、收藏、点位贡献及编辑
- 点位中英文切换、外部地图入口和系统分享；增量渲染及请求竞态保护
- App 内 Markdown 文档及本地图片、个人资料与账户设置

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

先在 Mac 安装 Xcode、JavaScript 依赖和 CocoaPods 依赖，完整步骤见 [iOS 指南](IOS.md)。

```sh
npm run ios
```

## API 地址配置

`src/config/runtime.ts` 当前策略：
- Android 开发版默认 `http://10.0.2.2:8080`（Android 模拟器访问本机后端）
- iOS 开发版从 Metro URL 推导同一电脑的 8080 端口，无法推导时使用 `http://localhost:8080`；真机和异机后端可显式配置
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
2. 原生 `RuntimeConfig`：Android 来自 `BuildConfig`（`-PLY_*` / 系统环境变量 / `.env.mobile`）；iOS 来自构建时的 `ios/RuntimeConfig.local.json`
3. 默认值（仅 `API_BASE_URL` 有默认；地图 key 默认空）

## Android 正式签名（Release）

从 2026-09-06 的 Android 1.0.3 测试发布开始使用新的 Release 证书，SHA-256 指纹为 `e0468f0e26aa5560b9e8869ed9ba9c2cb7bd76831f1e246aaa8b222decb7a757`。后续更新必须沿用这份密钥；旧 v1.0 和开发包签名不同，不能直接覆盖安装。

已有签名时，恢复原来的 `android/keystore/lycoris-upload.jks` 和 `android/keystore.properties`，不要重新生成。二者均被 Git 忽略，需要另外安全备份；不要上传到 GitHub Release。

1. 仅在首次建立新的签名身份时生成 keystore（示例，已有应用更新跳过此步）：

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

3. 确认签名配置完整，再显式指定生产 API 构建 release APK，避免沿用本地 `.env.mobile` 的开发地址：

```sh
./gradlew assembleRelease -PLY_API_BASE_URL=https://api.lycoris.online '-PreactNativeArchitectures=arm64-v8a,x86_64'
```

产物路径：

`android/app/build/outputs/apk/release/app-release.apk`

当前 Gradle 在缺少正式签名配置时会警告并退回开发签名。发布前用 Android SDK 的 `apksigner verify --verbose --print-certs` 检查 APK，确认签名指纹与上面一致，并检查版本号递增。

## 本地检查

```sh
npm test -- --runInBand
npx tsc --noEmit
npm run lint
npm run test:ios-config
```

iOS 配置工具使用 Node 内置模块，不新增运行时依赖。iOS 原生编译和签名仍需在 Mac 上验证，详见 [IOS.md](IOS.md)。
