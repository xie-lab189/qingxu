# 平台「发布为应用」Bug 反馈文案

## 问题描述
通过"发布为应用"（sites deploy）发布的项目，线上站点始终返回**初次部署时生成的冻结构建产物**。后续无论怎么重新部署，都无法把本地最新的源码推上线。

## 复现步骤
1. 首次 `deploy` 项目（前端 React + Vite，服务端 Node/Express）→ 成功，线上 JS 为 `index-ZrZghzXd.js`
2. 在本地修改源码（新增功能、修改文案）并重新构建，确认本地 `dist` 已含新代码（本地产物 `index-BzZ_w-m2.js` 含新关键词）
3. 再次 `deploy` → 线上 JS 哈希**仍为 `index-ZrZghzXd.js`**，新代码未生效
4. 尝试 `unpublish` 后重新 `deploy` → sandbox 仍复用同一固定 ID `0da36461015544c8aeac2437a7b0f93e`，线上仍为旧哈希
5. 尝试换全新 `domainPrefix` 重新部署 → 仍复用同一 sandbox、同一 shareLink、同一旧哈希

## 关键证据
- 多次 deploy 返回的 `sandboxId` 始终为 `0da36461015544c8aeac2437a7b0f93e`（固定，不随 deploy / unpublish 改变）
- 线上 JS 资源名始终是 `index-ZrZghzXd.js`；搜索新代码关键词（如"今天只保留了必须完成的"、"request-email"）全部缺失
- 本地 `dist` 构建产物 `index-BzZ_w-m2.js` 包含上述关键词，证明本地源码与构建均正确
- 应用 `.genie` 标记中 `localDir` 指向本地工作目录，但平台未重新读取

## 影响
- 所有后续源码改动无法上线（含功能修复、文案调整）
- 用户侧「设置—数据管理」中**不存在"应用"管理入口或"重新部署/重建"按钮**，无法手动触发重建
- 项目开发迭代被阻断

## 期望修复（任一即可）
1. `deploy` 每次重新读取 `.genie` 声明的 `localDir` 源码并重新构建（而非复用首次 sandbox 的冻结副本）；或
2. 提供"强制重建 / 从源码重新部署"的接口或 UI 按钮；或
3. 至少保证 `unpublish` 后 `deploy` 能彻底重建 sandbox（当前未生效）

## 环境信息（供排查）
- 应用 appId：`wbapp_I0pL64JdLZibZZ7ecCz6K4`
- 域名：`qingxu.app.workbuddy.host`
- 固定 sandboxId：`0da36461015544c8aeac2437a7b0f93e`
- 技术栈：React19 + Vite + Node/Express
- 启动命令：`node_modules/.bin/vite build && node server/index.js`
