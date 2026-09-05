# 在 Mac 上调试和打包 Lycoris iOS

项目使用 React Native 0.83.1，新架构保持启用。iOS 原生配置和共享代码已补齐；Windows 上能验证 JavaScript、配置生成和项目文件，Xcode 编译、签名及设备行为需要在 Mac 上完成。

## 1. 准备 Mac

安装完整 Xcode，首次打开完成组件安装，并在 Settings → Locations 选择 Command Line Tools。在 Xcode 中安装一个 iOS Simulator runtime。当前锁定的 RN 依赖要求 iOS 15.1+、Xcode 16.1+、Node 20.19.4+；使用 Mac 支持的较新 Xcode 和满足要求的 Node。安装可用的 Ruby/Bundler；CocoaPods 由仓库 Gemfile 管理，不需要额外安装全局 React Native CLI。[RN 0.83 环境说明](https://reactnative.dev/docs/0.83/set-up-your-environment)

先确认工具可用：

```sh
xcodebuild -version
xcrun simctl list devices available
node --version
ruby --version
bundle --version
```

取代码并安装锁定的 JavaScript 依赖：

```sh
git clone --branch feature/ui-redesign git@github.com:Eleanor1018/lycoris.git
cd lycoris/mobile
npm ci
bundle install
```

如果已有仓库，切到 `feature/ui-redesign` 并更新即可。不要把 Windows 的 `node_modules`、Android 构建缓存或本机配置复制到 Mac。

## 2. 选择开发后端

| 使用场景 | Debug 默认值或配置 |
| --- | --- |
| iOS Simulator，后端也在这台 Mac | 从 Metro URL 获取主机，通常为 `http://localhost:8080`。 |
| 真机与运行 Metro/后端的 Mac 在同一网络 | 从 Metro URL 获取 Mac 的主机地址，再使用端口 8080。 |
| 后端仍在 Windows 或使用其他端口 | 在下面的 Debug 配置中明确填写该电脑可达的局域网地址。 |
| Metro 地址不可用 | 回退 `http://localhost:8080`，真机此时必须显式配置。 |

`localhost` 在真机上指手机本身。Android Emulator 的 `10.0.2.2` 也不能拿来作为 iOS 的后端地址。

可选本机配置：

```sh
cp ios/RuntimeConfig.example.json ios/RuntimeConfig.local.json
```

编辑 `ios/RuntimeConfig.local.json`，例如下面的 IP 需换成运行后端电脑的实际局域网地址：

```json
{
  "Debug": {
    "LY_API_BASE_URL": "http://192.168.1.100:8080",
    "LY_THUNDERFOREST_API_KEY": "",
    "LY_TIANDITU_API_KEY": ""
  },
  "Release": {
    "LY_API_BASE_URL": "https://api.lycoris.online",
    "LY_THUNDERFOREST_API_KEY": "",
    "LY_TIANDITU_API_KEY": ""
  }
}
```

该文件已被 Git 忽略。它与 Android 的 `.env.mobile` 独立，避免把 Android 地址直接带到 iOS。地图 key 留空时仍可使用 OSM；如使用其他底图，填入对应客户端 key。编译进 App 的配置可被提取，只适合 API 地址和受限客户端地图 key，不能放数据库口令或服务端密钥。

构建环境中显式设置的同名 `LY_*` 变量优先于 JSON，包括在 `ios/.xcode.env.local` 中 `export` 的变量。它们会影响当前构建配置；只用于 Debug 的地址建议保留在 JSON 的 `Debug` 区域。命令行检查读取当前终端环境，不会加载 `.xcode.env.local`；Xcode 构建会加载该文件并再次验证。

检查两个构建配置，不会打印配置值：

```sh
npm run ios:config:check -- --configuration Debug
npm run ios:config:check -- --configuration Release
```

Xcode 构建阶段生成 DerivedData 中的 Info.plist；通过 `NativeModules.RuntimeConfig` 提供三项配置。修改本机 JSON 后需重新构建 App，单纯 Reload JS 不会更新原生配置。Debug 允许本地 HTTP 调试；Release 不带开发 HTTP 放宽且拒绝非 HTTPS 后端地址。Release 也不会沿用 Debug 的值。

真机首次访问局域网时允许系统“本地网络”权限；这与定位权限分开。若请求失败，先在 Mac 上确认目标 `/api/markers/public` 返回 JSON，再检查设备与电脑的网络和代理绕过设置。[Apple 本地网络说明](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)

## 3. 安装 Pods 并启动

```sh
cd ios
bundle exec pod install
cd ..
npm start
```

首次安装 Pods 会用 Mac 自带 Swift/CoreGraphics/ImageIO，从现有 Lycoris Logo 生成 1024px 不透明 AppIcon。生成图标被忽略，不需要再安装图像工具；源 Logo 和生成脚本已跟踪。

另开一个终端，在 `mobile/` 执行：

```sh
npm run ios
```

或使用 Xcode：

```sh
open ios/mobile.xcworkspace
```

选择 `mobile` scheme 和可用的 iPhone 模拟器，然后 Run。安装 Pods 后使用 `.xcworkspace`，这样原生依赖会一起参与构建。[RN 设备运行说明](https://reactnative.dev/docs/0.83/running-on-device)

若 Xcode 找不到 Node，在未跟踪的 `ios/.xcode.env.local` 中设置本机绝对路径，例如把 `command -v node` 的实际结果填入：

```sh
export NODE_BINARY=/absolute/path/to/node
```

保留 `pod install` 生成的 `Podfile.lock`、`bundle install` 生成的 `Gemfile.lock`；首次 Mac 编译通过后复核并提交这两个锁文件。本轮没有在 Windows 上伪造 Pods 解析结果。

## 4. 真机与 Release

在 Xcode 添加自己的 Apple 账号，选择自己的 Signing Team，并确认 Bundle Identifier 在该团队下可用。按 Xcode 提示配对 iPhone、开启设备开发者模式，然后选择该设备 Run。[Apple 设备运行说明](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device)

打包前检查 Release 配置；确认正式 API 当前可达。此前源站验证成功不代表 Cloudflare 公网入口始终可用。

```sh
npm run ios:config:check -- --configuration Release
```

在 Xcode 选择通用 iOS 设备构建目标，执行 Product → Archive，再在 Organizer 中按需要导出或上传。Release 会打包 JS 和图片资源；验证安装后的 App 在关闭 Metro 后仍能启动和加载文档。签名、导出与上传由 Mac 上的账号和证书完成。

## 5. Mac 上需要确认的行为

- 冷启动地图、点位搜索、附近查询；授予精确及大致位置，拒绝后从设置恢复，关闭系统定位后重新开启。
- 中文／英文／跟随系统，包括系统权限说明；切换语言后检查点位缺译回退和贡献语言。
- 相册选择 JPEG、HEIC、iCloud 照片，取消及超大图片；头像和点位图片上传后重新打开。
- Apple Maps 接收正确目的地；iPhone/iPad 的系统分享菜单打开与取消。
- 登录、退出、过期会话，前后台切换；竖屏、横屏、键盘和安全区域。
- Release 中图标、字体、离线文档和 JS 资源正常；无 Metro 依赖，正式接口不受 Debug 配置影响。

这些是平台运行验证，尚不能由 Windows 上的 Jest 或 JS 打包代替。发布前按实际构建结果记录 Xcode、iOS、Ruby、CocoaPods 版本及上述设备检查结果。
