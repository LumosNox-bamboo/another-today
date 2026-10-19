# 跨设备云存档 · 接通与验收

## 当前状态

同步代码、数据库迁移和游戏界面已接入。正式 Supabase 项目尚未配置，公开游戏继续只在本机保存，界面明确显示“云同步尚未接通正式服务”。本地端到端测试使用模拟 Auth 接口与运行实际迁移 SQL 的 PostgreSQL（PGlite）；没有声称真实邮件、远程 Supabase 或手机原生安装包已经验收。

## 项目所有者接通服务

1. 在 https://supabase.com/dashboard 创建项目。数据库密码自行保管，无需发到聊天或提交仓库。
2. 在项目 SQL Editor 执行 [`supabase/migrations/202610190001_cloud_saves.sql`](../supabase/migrations/202610190001_cloud_saves.sql) 一次。它创建存档、历史、设备租约和权限策略；不要把这些表改成匿名公开访问。
3. 在 Authentication 的 URL 配置中，将 Site URL 和允许的回跳地址设为 `https://lumosnox-bamboo.github.io/another-today/`。启用 Email / Password；保留邮箱确认。对朋友开放注册前配置可用的邮件发送服务（通常需要自定义 SMTP），实际测试确认邮件及找回密码。不要把 SMTP 密码放入前端环境变量。
4. 从项目 Connect / API 设置取得 Project URL 和 **publishable key**（旧项目也可用 `anon` key）。不要使用 `service_role` 或 `sb_secret_`；构建会拒绝这类密钥。
5. 在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 设置：
   - `VITE_SUPABASE_URL`：项目根地址，例如 `https://your-project.supabase.co`。
   - `VITE_SUPABASE_PUBLISHABLE_KEY`：公开客户端密钥。
6. 重新运行 Deploy playable game to GitHub Pages 工作流。部署后关闭旧游戏窗口，再重新打开，检查设置中的登录入口。两项变量都为空时继续使用离线模式；只配置其中一项会让构建报错，避免发布半配置服务。

本地开发复制 `.env.example` 为 `.env.local` 后填写相同公开连接信息；该文件已忽略。相同配置也随 Electron 构建加入桌面客户端。未来移动端原生包可复用此协议，但还需要安全凭据存储、邮件深链与系统生命周期适配。

如果希望由 Codex 完成剩余接通，请提供项目 URL、publishable key，并告知第 2 步 SQL 是否已执行。仅凭公开客户端密钥不能替项目管理员创建数据库表。

## 玩家流程

- 新设备在创建角色页点击“跨设备存档 / 登录”，可直接接续云角色，无需先创建临时角色。已有角色在“设置”中登录。
- 登录不会自动上传一个尚未授权的存档。首次启用须明确同意上传完整存档，包含玩家日记、授权分享和共同活动记录；不愿上传时保持本机模式即可。
- 初次连接选择上传本机角色或接续云端角色。已有链接的设备启动时先检查版本，再补算时间；未改动的本机存档可自动跟随云端最新版本。
- 当前设备每分钟尝试同步一次。建议换设备前点击“保存并交接”：先把本机当前时间结算并保存，再上传、释放租约、暂停本机。另一台设备接续后补算间隔。
- 另一台设备正在持有租约时，显示接手提示。明确接手后，旧设备下次上传会被拒绝。断网或应用被系统挂起后，不能保证两端实时发现对方；靠服务器版本检查保证旧进度不会覆盖新进度。
- 两端都离线发展时不合并人物、剧情、经济或日记。保留本机与云端，让玩家选择一条时间线。冲突解决前暂停本机；可选择断开同步继续本机生活。
- 接续云端前，先将本机世界写入独立 IndexedDB 备份，保留最近三份。备份失败就不替换。本机和云端备份可导出，通过原有导入功能恢复；导入或新建世界会取消之前的自动同步链接。
- 云端保留最近五个已提交版本。删除云存档会删除这五版与租约，保留账号、本机世界和其他设备的本机副本。账号删除 / 平台数据请求可由项目所有者在 Supabase 管理；本版没有客户端删除账号接口。
- 删除游戏中的一条记忆并不自动抹除此前的备份。若需彻底移除云端历史，使用“删除云存档与云端历史”；本机交接备份另有清除按钮。

## 权限与数据边界

Supabase Auth 管理邮箱密码，应用不自建密码表。每个账号只有一个当前云世界。三个表启用 RLS，匿名无读取权限，登录用户只能读取自己的行；客户端没有直接 INSERT / UPDATE / DELETE 权限。

写入函数同时检查 JWT 身份与预期账号，防止异步请求跨账号串档；按账号锁住租约，比较整数版本再提交。服务器时间控制 150 秒租约，客户端时钟不决定谁的存档更新。请求 UUID 用于回执丢失恢复，历史和当前版本在同一事务内提交。存档大小上限 16 MiB，下载后再次经过现有完整存档校验。

保存内容没有放进 GitHub 仓库或 service worker 缓存。连接只允许构建配置中的 HTTPS Supabase 项目域名。云服务管理员仍可能访问数据，本版没有端到端加密。不要把本机“private / local”记忆标签误解成云端加密；是否上传由独立的完整存档授权决定。

## 测试与限制

```sh
npm test
npx playwright test --config playwright.cloud.config.ts
npm run test:web
npx playwright test --config playwright.ios.config.ts
npm run test:e2e
```

- PostgreSQL 测试执行生产迁移，验证匿名 / 外账号拒绝、直接写库拒绝、租约接手、并发版本、重试、五版历史、删除保护与账号绑定。
- 同步状态机覆盖无授权不上传、首次选择、无本机角色的接续、离线分支、干净版本跟随、失去租约、选择期间云端改变、网络回执丢失、存储失败和退出取消。
- Store 测试验证先读云端再结算、交接时阻止模拟写入、接续时沿用 `lastReal`、不重复结算、保存失败不替换、导入解绑。
- 浏览器测试使用隔离的模拟 Auth 接口（不发送邮件），但所有数据库存取均执行真实 PostgreSQL 函数。两个独立客户端在 Chromium / WebKit 中实际操作登录、授权、交接、断网冲突与备份。不能据此宣称 Supabase 邮件和生产环境已经就绪。
- 正式项目配置后还需：两个真实邮箱验证权限隔离；真手机与电脑验证交接；邮件确认与重置；PWA 安装后的重新登录；配置后的 Electron 网络访问。原生移动包及微信小游戏不属于本轮交付。

检索依据：Supabase 官方 [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)、[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)；SDK 2.118.0 类型定义与实现。未引用未经核实的免费配额或费用。

本地最终结果：160 项单元 / 集成测试、4 项双设备同步浏览器测试、12 项网页 / PWA、5 项 WebKit 与 6 项 Electron 测试通过；保留一项原有 WebKit worker API 跳过项。生产依赖审计 0 项已报告漏洞。截图见 `docs/screenshots/cloud-sync/`。
