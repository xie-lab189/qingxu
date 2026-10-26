/**
 * 青序 · 后端服务（v5 · 云端多用户版）
 *
 * - STORE_DRIVER=json（默认）/ supabase（云端 PostgreSQL，见 docs/schema.sql）
 * - 手机号 = 唯一用户 ID（Primary Key），所有数据按手机号隔离
 * - 语义路由：register / tasks / task/plan / mood/replan + 全量状态同步
 * - 每晚 20:00（北京时间）邮件提醒：由外部定时器（cron-job.org）触发 /api/cron/reminders 执行，Nodemailer 发送、显式 UTC+8、不依赖服务器时区；SMTP 未配置时自动跳过
 * - 同时托管前端构建产物（dist/），支持单服务部署
 *
 * 启动：npm start（默认 8787 端口，PORT 环境变量可覆盖）
 */
import express from "express";
import cors from "cors";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findUser, readState, upsertUser, writeState, listUsers } from "./store.js";
import { createMasterTask, launchToday, replanByMood, dateKey } from "./engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
// 部署平台会注入 PORT；未注入时兜底 3000（与发布探针一致）。
// 本地开发可用 `PORT=8787 npm start` 恢复原端口。
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

/** 简易请求日志 */
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/** 取用户标识：优先 X-User-Id 头，其次 query.phone（所有接口必须携带） */
function resolvePhone(req) {
  const phone = String(req.headers["x-user-id"] || req.query.phone || "");
  return /^1\d{10}$/.test(phone) ? phone : null;
}

/** 健康检查 */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "qingxu-api",
    driver: process.env.STORE_DRIVER || "json",
    time: new Date().toISOString(),
  });
});

/* ---------------- 用户 ---------------- */

/** 注册 / 登录（幂等；手机号为主键） */
async function handleRegister(req, res) {
  const { name, phone, email } = req.body ?? {};
  if (!phone || !/^1\d{10}$/.test(String(phone))) {
    return res.status(400).json({ error: "请输入有效的 11 位手机号" });
  }
  try {
    const record = await upsertUser(String(phone), String(name ?? "").trim(), email);
    res.json({
      user: {
        name: record.name,
        phone: record.phone,
        email: record.email ?? null,
        createdAt: record.created_at ?? record.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.post("/api/register", handleRegister);
/** 兼容旧路径 */
app.post("/api/auth/register", handleRegister);

/** 查询用户（Session 恢复校验） */
app.get("/api/auth/:phone", async (req, res) => {
  const record = await findUser(req.params.phone);
  if (!record) return res.status(404).json({ error: "用户不存在" });
  res.json({ user: { name: record.name, phone: record.phone } });
});

/* ---------------- 语义接口（核心业务） ---------------- */

/** 今日任务清单（CheckTodayPlan）：服务端每日自动发布 + 返回今日任务 */
app.get("/api/tasks", async (req, res) => {
  const phone = resolvePhone(req);
  if (!phone) return res.status(401).json({ error: "缺少有效用户标识（X-User-Id / phone）" });
  const record = await readState(phone);
  if (!record) return res.status(404).json({ error: "用户不存在" });

  const state = record.state ?? {};
  const masterTasks = state["qingxu.masterTasks"] ?? [];
  let dailyTasks = state["qingxu.dailyTasks"] ?? [];
  const today = dateKey();
  const launched = launchToday(masterTasks, dailyTasks, today);
  dailyTasks = launched.dailyTasks;

  // 有自动发布的卡片则回写存储
  if (launched.created.length > 0 || launched.carried.length > 0 || launched.revived.length > 0) {
    await writeState(phone, { ...state, "qingxu.dailyTasks": dailyTasks });
  }

  const todayTasks = dailyTasks
    .filter((t) => t.date === today && t.status !== "deferred")
    .sort((a, b) => {
      const ORDER = ["IMPORTANT_URGENT","URGENT_NOT_IMPORTANT","IMPORTANT_NOT_URGENT","NOT_IMPORTANT_NOT_URGENT"];
      return ORDER.indexOf(a.quadrant) - ORDER.indexOf(b.quadrant);
    });
  res.json({ today, created: launched.created.length, todayTasks });
});

/** 录入任务并生成计划：按用户选择的四象限 + 天数自动拆解、发布今日卡片 */
app.post("/api/task/plan", async (req, res) => {
  const phone = resolvePhone(req);
  if (!phone) return res.status(401).json({ error: "缺少有效用户标识" });
  const { name, days, quadrant } = req.body ?? {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: "请提供任务名称" });
  const totalDays = Math.min(Math.max(parseInt(days, 10) || 0, 1), 30);
  const VALID = ["IMPORTANT_URGENT","IMPORTANT_NOT_URGENT","URGENT_NOT_IMPORTANT","NOT_IMPORTANT_NOT_URGENT"];
  if (!VALID.includes(quadrant)) {
    return res.status(400).json({ error: "请由用户选择四象限分类" });
  }
  const record = await readState(phone);
  if (!record) return res.status(404).json({ error: "用户不存在" });

  const state = record.state ?? {};
  const masterTask = createMasterTask(String(name).trim(), totalDays, quadrant);
  const masterTasks = [...(state["qingxu.masterTasks"] ?? []), masterTask];
  const launched = launchToday(masterTasks, state["qingxu.dailyTasks"] ?? [], dateKey());
  await writeState(phone, {
    ...state,
    "qingxu.masterTasks": masterTasks,
    "qingxu.dailyTasks": launched.dailyTasks,
  });
  res.json({ masterTask, createdToday: launched.created });
});

/** 情绪驱动重规划：写入心情 + 实时重写今日任务列表（服务端口径） */
app.post("/api/mood/replan", async (req, res) => {
  const phone = resolvePhone(req);
  if (!phone) return res.status(401).json({ error: "缺少有效用户标识" });
  const { mood } = req.body ?? {};
  if (!mood) return res.status(400).json({ error: "请提供 mood" });
  const record = await readState(phone);
  if (!record) return res.status(404).json({ error: "用户不存在" });

  const state = record.state ?? {};
  const dailyTasks = state["qingxu.dailyTasks"] ?? [];
  const logs = state["qingxu.dailyLogs"] ?? [];
  const moods = state["qingxu.moods"] ?? [];
  const today = dateKey();

  const result = replanByMood(mood, dailyTasks, today);
  const nextLogs = logs.some((l) => l.date === today)
    ? logs.map((l) =>
        l.date === today
          ? {
              ...l,
              mood,
              protected: l.protected || result.mode === "protect",
              boosted: l.boosted || result.mode === "boost",
              deferredTaskIds:
                result.mode === "protect"
                  ? [...new Set([...(l.deferredTaskIds ?? []), ...result.affectedIds])]
                  : l.deferredTaskIds ?? [],
            }
          : l
      )
    : [
        {
          date: today,
          mood,
          doneCount: 0,
          deferredTaskIds: result.mode === "protect" ? result.affectedIds : [],
          protected: result.mode === "protect",
          boosted: result.mode === "boost",
        },
        ...logs,
      ];

  await writeState(phone, {
    ...state,
    "qingxu.dailyTasks": result.dailyTasks,
    "qingxu.dailyLogs": nextLogs,
    "qingxu.moods": [
      { id: `m_${Date.now()}`, emotion: mood, createdAt: new Date().toISOString() },
      ...moods,
    ],
    "qingxu.lastEmotion": JSON.stringify(mood),
  });

  res.json({
    mode: result.mode,
    affectedIds: result.affectedIds,
    todayTasks: result.dailyTasks.filter(
      (t) => t.date === today && t.status !== "deferred"
    ),
  });
});

/* ---------------- 全量状态同步（前端本地优先，云端权威） ---------------- */

app.get("/api/state/:phone", async (req, res) => {
  const record = await readState(req.params.phone);
  if (!record) return res.status(404).json({ error: "用户不存在" });
  res.json({
    state: record.state,
    updatedAt: record.updated_at ?? record.updatedAt,
  });
});

app.put("/api/state/:phone", async (req, res) => {
  const { state } = req.body ?? {};
  if (!state || typeof state !== "object") {
    return res.status(400).json({ error: "state 必须为对象" });
  }
  const record = await writeState(req.params.phone, state);
  if (!record) return res.status(404).json({ error: "用户不存在" });
  res.json({
    ok: true,
    updatedAt: record.updated_at ?? record.updatedAt,
  });
});

/** 手动触发邮件提醒（测试用；生产由定时任务每天 20:00 北京时间自动执行） */
app.post("/api/admin/send-reminders", async (_req, res) => {
  const { sendNightlyReminders } = await import("./mailer.js");
  res.json(await sendNightlyReminders("manual", true));
});

/** 全量数据导出（备份用）：带令牌保护，返回所有用户的完整云端状态 JSON。
 *  用途：平台变动前把云端数据落地留存；与 /api/cron/reminders 共用 CRON_TOKEN 鉴权。 */
app.get("/api/admin/export", async (req, res) => {
  const secrets = readSecrets();
  const token = process.env.CRON_TOKEN || secrets.CRON_TOKEN || "";
  const provided =
    (req.query && req.query.token) || (req.headers && req.headers["x-cron-token"]) || "";
  if (token && provided !== token) {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const users = await listUsers();
    res.json({
      app: "qingxu",
      exportedAt: new Date().toISOString(),
      driver: process.env.STORE_DRIVER || "json",
      count: users.length,
      users,
    });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

/** 外部定时器（如 cron-job.org）专用入口：每天 20:00（北京时间）由外部服务调用。
 *  - 带令牌保护（secrets.json 的 CRON_TOKEN）：避免被任意第三方随意触发
 *  - force=false：复用 sendNightlyReminders 内部的"当日已发"标记，与进程内定时任务互斥，绝不重复投递
 *  - 该 HTTP 请求本身会唤醒被托管平台休眠的服务端，从而满足"用户当天没打开网页也要发信"的诉求
 */
// 同时支持 GET / POST：外部定时器（EasyCron / cron-job.org）默认发 GET，
// 历史仅注册 POST 会导致 GET 404、邮件永远不触发。这里用 all 统一兜底。
app.all("/api/cron/reminders", async (req, res) => {
  const secrets = readSecrets();
  const token = process.env.CRON_TOKEN || secrets.CRON_TOKEN || "";
  const provided =
    (req.query && req.query.token) || (req.headers && req.headers["x-cron-token"]) || "";
  if (token && provided !== token) {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const { sendNightlyReminders } = await import("./mailer.js");
    const result = await sendNightlyReminders("cron", false);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

/* ---------------- 大模型对话代理（服务端持 Key，用户零配置、绕开 CORS） ----------------
 * 前端（src/lib/llmClient.ts）只请求同源 /api/chat，不携带任何 Key / Authorization 头；
 * 真实智谱 Key 由本服务端读取并转发，浏览器不直连厂商接口、也不把 Key 暴露给第三方。
 *
 * Key / 配置来源（优先级从高到低）：系统环境变量 > server/secrets.json。
 * 后者用于没有环境变量入口的部署平台（如 WorkBuddy 发布平台）：部署者把智谱 Key 填进
 * server/secrets.json，重新发布后所有访客即可零配置对话。 */
const ZHIPU_BASE_DEFAULT = "https://open.bigmodel.cn/api/paas/v4";

/** 读取 server/secrets.json（带缓存）；文件缺失 / 解析失败时返回 {}，不影响服务启动。 */
let cachedSecrets = null;
function readSecrets() {
  if (cachedSecrets) return cachedSecrets;
  try {
    const parsed = JSON.parse(readFileSync(join(__dirname, "secrets.json"), "utf-8"));
    cachedSecrets = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    cachedSecrets = {};
  }
  return cachedSecrets;
}

app.post("/api/chat", express.json({ limit: "2mb" }), async (req, res) => {
  const body = req.body ?? {};
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: { message: "缺少 messages 字段" } });
  }

  const secrets = readSecrets();
  const apiKey =
    (process.env.ZHIPU_API_KEY || "").trim() || (secrets.ZHIPU_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({
      error: {
        message:
          "服务端尚未配置智谱 Key：请在项目 server/secrets.json 中填入 ZHIPU_API_KEY（到 https://open.bigmodel.cn/usercenter/apikeys 申请），或由部署方通过环境变量 ZHIPU_API_KEY 提供，保存后重新启动/重新部署即可。",
      },
    });
  }

  const baseURL = (
    process.env.ZHIPU_BASE_URL ||
    secrets.ZHIPU_BASE_URL ||
    ZHIPU_BASE_DEFAULT
  ).replace(/\/+$/, "");
  const model = process.env.ZHIPU_MODEL || secrets.ZHIPU_MODEL || "glm-4-flash";
  const upstream = `${baseURL}/chat/completions`;

  try {
    const r = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 写死：服务端隐藏 Key，浏览器永远拿不到、也无需配置
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
        max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 800,
        stream: false,
      }),
    });
    const text = await r.text();
    const ct = r.headers.get("content-type");
    if (ct) res.set("Content-Type", ct);
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ error: { message: `转发到智谱失败：${e.message}` } });
  }
});

/* ---------------- 前端静态托管 ---------------- */

const DIST = join(__dirname, "..", "dist");
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(join(DIST, "index.html"));
    }
    next();
  });
}

app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
  console.log(`🌱 青序服务已启动: http://localhost:${PORT}`);
  console.log(`   存储驱动: ${process.env.STORE_DRIVER || "json"}`);
  console.log(`   API 健康检查: http://localhost:${PORT}/api/health`);
});
