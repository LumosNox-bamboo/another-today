# 手机安装与离线运行

2026-10-19，在原 0.3 项目中加入 PWA。沿用 `version: 1` 的存档、`another-today` 浏览器存储和原 GitHub Pages 地址；没有新建不兼容的游戏项目。后续可选云存档已接入正式数据库，发信服务与真实设备交接仍待验收，详见 [云同步说明](CLOUD_SYNC.md)。

## 选择与边界

| 方式 | 本次状态 | 使用方式 |
|---|---|---|
| PWA | 已实现 | 安卓 Chrome 安装；iOS Safari 分享 → 添加到主屏幕 |
| Android 原生包 | 未实现 | 后续可用 Capacitor 包装，构建签名 APK / AAB 并做真机测试 |
| iOS 原生包 | 未实现 | 后续可用 Capacitor + Xcode；分发涉及签名及 TestFlight / App Store |
| 微信小游戏 / 小程序 | 未实现 | 引擎可复用，界面、Canvas、生命周期、存储和分享需要专门适配与平台审核 |

当前目标是让朋友直接通过原网址安装。PWA 的“安装”由浏览器和系统决定，iPhone 没有可由网页调用的安装弹窗。微信内置浏览器应转到系统浏览器。

## 存档与更新

- 首次联网打开，等设置中显示“离线资源已就绪”，才可离线启动。缓存约一套网页资源，不含玩家存档。
- 进度仍保存在当前浏览器 / App 的本地存储。部分 iOS 版本的 Safari 与主屏幕 App 不共用存储；安装前导出，必要时导入。未启用云同步时，不同设备也通过导出 / 导入转移。
- 浏览器可能回收网站存储；清理数据会删除进度。PWA 不能代替存档备份。
- 关闭后不会持续运行后台计时器；使用既有 SimulationClock，在再次打开时补算。
- 缓存按完整构建版本隔离。新版下载失败保留旧版；成功后等待所有旧页面关闭再激活，不调用 `skipWaiting`，不自动刷新。只清理此游戏当前 scope 的旧资源缓存，不清理 localStorage 或其他应用缓存。
- Web 和 Electron 共用构建，`file://`、Electron 和开发服务器不注册 service worker。相对 manifest 与 scope 支持 GitHub Pages 子目录。
- 保留默认 viewport 安全区行为，不绘制到 iPhone 刘海和横屏安全区外。

## 验证命令

```sh
npm test
npm run test:web
npx playwright install webkit
npx playwright test --config playwright.ios.config.ts
npm run test:e2e
```

PWA 测试读取真实 manifest 和图标，关闭游戏页后断网重新打开，比较非空世界和存档，并验证断网游玩后的再次恢复。安装弹窗测试注入浏览器事件，只验证必须由用户点击触发，不代表真机安装已完成。

更新测试使用独立本地 HTTP 服务和真实生成的 worker，模拟下载中断、两窗口等待更新、旧版本回收、其他应用缓存保留和本地数据保留。Playwright 的 worker 生命周期检查仅在 Chromium 执行；WebKit 跳过该项，执行其余游戏和离线测试。

自动化浏览器和 iPhone 尺寸模拟不等于 Android / iPhone 真机验收。系统安装菜单、桌面图标、独立 App 冷启动、横屏刘海与系统存储回收仍需真机检查。

本地结果：133 项单元 / 集成测试、12 项 Chromium 电脑 / 手机测试、5 项 WebKit 测试、6 项 Electron 测试通过；WebKit 跳过 1 项仅 Chromium 提供 API 的生命周期检查。构建、TypeScript、格式与空白检查通过。手机安装截图保存于 `docs/screenshots/mobile-pwa/`。GitHub Pages 工作流持续运行 Chromium 与 WebKit 验收后才发布。
