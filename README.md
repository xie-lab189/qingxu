# 青序 · 大学生学业倦怠智能干预

> 慢慢来，一切都来得及。

「青序」是一个治愈系的大学生学业倦怠智能干预应用：通过 **9 种情绪感知**、**三个多智能体人格**（规划师 / 陪伴者 / 督促官）、**多任务四象限调度**、**番茄钟督促引擎**、**情绪自适应重规划**、**减压工具**与**成就激励体系**，帮助学生在「学业压力」与「自我照顾」之间找到可持续的节奏。

**v4 · 全栈多用户版**：手机号 = 唯一用户 ID，数据存于后端（Node.js + Express），localStorage 作本地缓存，支持跨设备同步；智能体回复由**预设语料库 + 去重随机**模拟，已预留大模型 API 接入点。

---

## 快速开始

```bash
# 安装依赖（Node ≥ 20）
npm install

# 开发模式（前端 5173；后端另开终端 npm run server，配 VITE_API_URL=http://localhost:8787）
npm run dev

# 生产：构建 + 单服务启动（http://localhost:8787，API 与页面同源）
npm run build
npm start
```

技术栈：**React 19 + TypeScript + Vite + Tailwind CSS 3.4（shadcn/ui）+ Framer Motion + Recharts + Lucide React + Express**

## 架构（v4 全栈）

```
浏览器 SPA（React）
  │  localStorage 本地优先（离线可用）
  │  同步引擎 sync.ts：快照比对，10s 轮询 + 页面隐藏强制推送
  ▼
Express API（server/，端口 8787）
  POST /api/auth/register    注册/登录（手机号幂等）
  GET  /api/state/:phone     拉取全量状态（换设备水合）
  PUT  /api/state/:phone     全量推送（last-write-wins）
  静态托管 dist/（单服务部署）
  ▼
数据层 server/db.js（JSON 文件库，手机号为主键，天然隔离；
                     可整体替换为 MongoDB/PostgreSQL，仅改四个函数）
```

首次打开弹出【欢迎弹窗】：输入昵称 + 手机号 → 注册成功即记住；
Session 存于 localStorage（`qingxu.session`），下次自动识别；
换设备登录同一手机号，任务、心情、成就完整同步。

部署到 Vercel / Netlify / Render 的详细步骤见 **[DEPLOY.md](./DEPLOY.md)**。

---

## 页面与功能

| 页面 | 功能 |
|---|---|
| **工作台** | 情绪状态、学习进度、连续打卡 streak 概览；心情趋势折线图（7/30 天，Recharts）；打卡热力日历（GitHub 风格，16 周）；成就徽章墙 |
| **任务规划** | 两步向导录入：总任务 + 完成天数 → 子任务**强制分类到艾森豪威尔四象限** + 标记精力消耗；`generateSmartPlan()` 主动排期（Q1 压前半段、Q3 错峰前置、Q2 全周期均布、Q4 靠后）；两种完成方式（番茄钟 / 打卡）；精力/心情状态条；**动态调度**：状态不佳→保护模式（只留 Q1+1 个 Q3，其余顺延平摊后续天数 + 轻量感视觉），状态极佳→能量加成（抽调 1-2 个 Q2 今日推荐 + 额外奖励）；Q2「长期投资」金色庆典 + 陪伴者高光鼓励 |
| **心情树洞** | 9 种情绪卡片选择（选中后全站主题色平滑过渡 + 呼吸放大动画 + 专属治愈短句）；深夜倾诉输入区（陪伴者温柔回应）；最近心情足迹 |
| **减压** | 4-7-8 呼吸训练器（吸气 4s → 屏息 7s → 呼气 8s），缩放动画 + 阶段倒计时 + 轮次统计 |

### 任务调度算法（v2）

```
generateSmartPlan(name, days, drafts)          // 主动规划
  Q1 重要且紧急     → 周期前 50%，优先保障
  Q3 紧急不重要     → 周期前 2/3，与 Q1 错峰
  Q2 重要不紧急     → 全周期均匀散布（长期投资，防拖延）
  Q4 不重要不紧急   → 后半段，有余力再做
  精力映射：高 40min / 中 25min / 低 15min（番茄钟时长）

adjustDailySchedule(plan, day, mode)           // 动态调度（情绪自适应）
  protect（疲惫/焦虑/低落/压力大）→ 当天只留 Q1 全部 + 1 个 Q3，
                                  其余标记 deferred 并平摊到后续天数
  boost（活力/平静/期待）        → 从未来抽调 1-2 个 Q2 到今天（boosted），完成有额外奖励
```

每日列表排序严格按：重要且紧急 > 紧急不重要 > 重要不紧急 > 不重要不紧急。

### 多智能体人格

三个智能体**共用一个悬浮对话面板**（右下角），拥有独立人设、主题色与语料库：

| 智能体 | 人设 | 职责 | 主动触发场景 |
|---|---|---|---|
| 🧭 青序·规划师 | 理智、清晰 | 四象限排期、保护模式减负 | 生成计划时说明排期思路；状态不佳时开启保护模式并顺延任务 |
| 🌙 青序·陪伴者 | 温柔、共情 | 情绪疏导、树洞回应、治愈短句 | 记录负面情绪后自动安慰；深夜倾诉后回应；完成 Q2 长期投资时高光鼓励 |
| ⏰ 青序·督促官 | 活泼、略带严厉 | 打卡督促、番茄钟提醒、能量加成 | 长期未打卡提醒；番茄钟结束弹窗；状态极佳时推荐加成任务并发放奖励 |

### 激励体系

- **打卡庆祝**：当天任务全部完成 → 撒花特效 + 励志寄语 + 进度条 100% 拉满动画
- **金色庆典**：完成「重要不紧急」长期投资任务 → 金色撒花 + 专属弹窗 + 陪伴者高光鼓励（ anti-拖延 的极大肯定）
- **成就徽章（12 枚）**：初芽、三日坚持、7日坚持、半月修行、月度守护者、破晓者（7 点前记录）、夜话者（23 点后）、情绪收藏家（集齐 9 情绪）、番茄学徒、蓝图绘制者、完美一天、未来投资人（完成加成推荐任务）
- **Streak**：从最近一次打卡日往前计算连续天数，工作台实时展示

---

## 目录结构

```
src/
├── agents/
│   └── config.ts            # 三智能体定义、语料库、模拟回复引擎（★ 模型 API 接入点）
├── components/
│   ├── agent/               # AgentPanel 悬浮对话面板、AgentTriggers 主动触发、AchievementChecker 成就监听
│   ├── celebration/         # Confetti 撒花、CelebrationOverlay 庆祝弹窗
│   ├── layout/              # TopNav 顶部导航、AppLayout 布局壳
│   ├── mood/                # EmotionGrid 心情卡片、EmotionQuote 治愈短句、VentBox 倾诉树洞、MoodBackdrop 主题背景
│   ├── relief/              # BreathingTrainer 呼吸训练器
│   ├── stats/               # MoodTrendChart、HeatmapCalendar、AchievementWall
│   ├── tasks/               # PlanForm、PlanBoard、PomodoroTimer
│   └── ui/                  # shadcn/ui 组件（40+）
├── hooks/
│   ├── useEmotionTheme.tsx  # 情绪状态管理 + 主题变量注入 + 数据净化
│   └── useAgentChat.tsx     # 智能体对话状态（消息、切换、主动弹窗、打字模拟）
├── lib/
│   ├── storage.ts           # localStorage 持久化层（readAll/createItem/updateItem/deleteItem/readOne/writeOne）
│   ├── planUtils.ts         # 任务拆解模板、进度计算、情绪减负
│   ├── stats.ts             # 心情趋势、热力日历、streak、成就统计
│   └── achievements.ts      # 徽章定义与解锁判定
├── pages/                   # DashboardPage / TasksPage / MoodPage / ReliefPage
├── types/                   # 全局类型 + 情绪定义（9 种情绪）+ 存储键名登记
└── App.tsx                  # Provider 组合 + 页面切换动画
```

---

## 数据模型（localStorage）

所有键统一以 `qingxu.` 前缀登记在 `STORAGE_KEYS`（`src/types/index.ts`），互不冲突：

| 键 | 类型 | 说明 |
|---|---|---|
| `qingxu.moods` | `MoodEntry[]` | 心情记录 `{ id, emotion, content?, tags?, createdAt }`；倾诉正文挂在最近一条记录上 |
| `qingxu.lastEmotion` | `EmotionType` | 最近一次选择的情绪，仅用于刷新后恢复主题色（不产生新记录） |
| `qingxu.plan` | `StudyPlan` | 当前学习计划 `{ id, name, totalDays, tasks[], createdAt, adjusted? }`；单计划制，新建覆盖 |
| `qingxu.achievements` | `string[]` | 已解锁成就 id 列表 |
| `qingxu.tasks` / `qingxu.profile` | 预留 | 原始任务列表 / 用户资料，供后续版本使用 |

数据结构一致性保障：读取心情记录时经过 `sanitizeEntries()` 过滤非法情绪值，兼容旧版数据结构，避免渲染崩溃。

---

## 关键设计

**情绪主题系统**
选择情绪后，JS 将情绪的 HSL 分量注入 `:root` 的 `--accent` / `--accent-foreground` 变量，配合 0.8s 过渡实现全站平滑换色；页面背景光晕使用双层 `AnimatePresence` 交叉淡入淡出（CSS 无法直接过渡渐变）。

**情绪自适应介入**
- 记录负面情绪 → `AgentTriggers` 触发陪伴者安慰（按记录 id 去重）
- 状态不佳进入任务页 → `halveRemainingTasks` 将剩余任务每隔一个标记为「顺延」，规划师弹窗说明；`plan.adjusted` 持久化，每份计划仅干预一次

**模拟 AI 与真实模型的边界**
`src/agents/config.ts` 的 `getAgentReply(agentId, context)` 是唯一需要替换的函数：保持函数签名，内部改为请求大模型 API 即可，语料库可作为 system prompt 素材。触发逻辑（`proactive`）、UI（`AgentPanel`）、状态管理（`useAgentChat`）均无需改动。

---

## 已知限制与后续方向

- 打包体积超 500 kB 警告（Recharts 占主要部分），可通过路由级代码分割优化
- 番茄钟默认 25 分钟，演示时可临时调小；后续支持自定义时长
- 单计划制：一份计划完成后需「重新制定计划」，多计划并存待后续版本
- 督促官提醒为弹窗 + 未读数，未接入系统通知 / 语音
- 用户资料（`UserProfile`）已预留，昵称个性化、倦怠评估量表待接入
