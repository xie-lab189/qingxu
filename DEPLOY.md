# 青序 · 部署指南（Vercel / Netlify / Render）

「青序」现在是**全栈应用**：`server/`（Node.js + Express + JSON 文件库）+ React 前端构建产物（`dist/`）。
推荐「单服务部署」——一个平台同时托管页面和 API，前端请求同源 `/api`，零跨域配置。

---

## 方案一：Render（推荐，免费档可用，单服务）

1. **准备仓库**：把 `qingxu/` 推送到 GitHub（确保 `server/`、`dist/`、`package.json` 在根目录）。
   若 `dist/` 未入库，Render 可在构建阶段生成（见第 4 步 build command）。
2. **New → Web Service** → 连接仓库。
3. 配置：
   | 项 | 值 |
   |---|---|
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Plan | Free |
4. 部署完成后得到公网地址 `https://qingxu-xxxx.onrender.com`，所有同学可直接访问。
   - 首次访问若遇冷启动（Free 档休眠），等待约 30 秒即可。
5. 数据持久化：Free 档磁盘为临时，重启后数据丢失。**生产使用请在 Render Dashboard 挂载 Persistent Disk**（挂载到 `/opt/render/project/src/data`），或按下文「切换到 Supabase/Neon」改造数据库。

## 方案二：Vercel（前端）+ Render/Railway（后端）

1. **后端**：按方案一在 Render 部署（仅 API）。记下地址，如 `https://qingxu-api.onrender.com`。
2. **前端**：Vercel → Import 仓库 → Framework 选 Vite → 添加环境变量：
   ```
   VITE_API_URL=https://qingxu-api.onrender.com
   ```
3. Vercel 自动给出 `https://qingxu-xxxx.vercel.app`。
   - 前端所有请求经 `API_BASE` 拼接，携带 `X-User-Id` 头，跨设备同步照常工作。
   - 后端已开启 CORS，无需额外配置。

## 方案三：Netlify（前端）+ 任意 Node 托管（后端）

1. **后端**：Railway / Render / VPS 上 `node server/index.js`（PM2 守护更佳）。
2. **前端**：`npm run build` 后把 `dist/` 拖到 Netlify Drop，或在
   `netlify.toml` 配置：
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
   [build.environment]
     VITE_API_URL = "https://你的后端地址"
   ```
3. 绑定自定义域名（可选）：Netlify 域名管理中添加 `qingxu.app` 之类。

## 本地开发

```bash
npm install
npm run server        # 后端 http://localhost:8787（同时托管已构建的 dist/）
npm run dev           # 前端 Vite 开发服 http://localhost:5173
```

开发模式下前端跑在 5173、后端在 8787，请在 `.env.local` 写入：
```
VITE_API_URL=http://localhost:8787
```

## 数据库上云（Supabase / PostgreSQL，推荐）

1. **创建 Supabase 项目**（免费档）：supabase.com → New Project（选就近区域）。
2. **建表**：Supabase 控制台 → SQL Editor → 粘贴执行项目内 [`docs/schema.sql`](./docs/schema.sql)
   （`users` 主键 phone、`tasks`、`daily_logs` 三张表 + RLS 行级安全策略，已写好）。
3. **配置环境变量**（Render Dashboard 或本地 `.env`）：
   ```
   STORE_DRIVER=supabase
   SUPABASE_URL=https://你的项目.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=你的 service_role key（Settings → API）
   ```
4. 重启即完成上云；前端零改动（API 契约不变）。**MongoDB Atlas** 亦可：
   `server/store.js` 是唯一适配层，替换四个函数即可。

## 邮件提醒兜底（加分项）

1. 欢迎弹窗选填邮箱 → 注册时写入用户档案。
2. 后端 `server/mailer.js`：node-cron 每晚 21:00 扫描「有邮箱且今日任务未完成」的用户，
   Nodemailer 发送督促邮件；未配置 SMTP 时服务照常运行，仅跳过邮件。
3. 环境变量：`SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM`（QQ/163 用授权码）。
4. 测试：`POST /api/admin/send-reminders` 立即触发一次。

## 移动端说明

前端已做 375px 级响应式：移动端导航折叠为**汉堡菜单**（下拉抽屉）、任务卡片单列纵向排列、
`overflow-x: hidden` 杜绝页面横向滚动条、对话面板 `calc(100vw-3rem)`、
番茄钟胶囊避让悬浮按钮。手机浏览器（含数据流量网络）直接打开公网 URL 即可流畅使用。

## 前后端分离部署速查

| 层 | 平台 | 配置 |
|---|---|---|
| 前端 | Vercel | 已含 `vercel.json`（Vite 构建 + SPA 回退）；`VITE_API_URL=https://你的后端` |
| 前端 | Netlify | 已含 `netlify.toml`；同上环境变量 |
| 后端 | Render | 已含 `render.yaml`；Build `npm install && npm run build`，Start `npm start` |
| 后端 | Railway/VPS | `npm ci && npm run build && npm start`，配 `STORE_DRIVER=supabase` |
