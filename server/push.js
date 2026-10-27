/**
 * 青序 · Web Push（PWA 推送，邮件提醒的主动触达兜底）
 *
 * - VAPID 密钥：优先读环境变量 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY；
 *   未提供则在首次启动时生成并持久化到 data/vapid.json（零配置即可跑）。
 * - 订阅列表：data/push-subscriptions.json（按 endpoint 去重）。
 * - 每晚 20:00（北京时间）由 /api/cron/reminders 调用 sendPushReminders，
 *   向所有已订阅设备推送「督促官」提醒——即使网站当天没被打开也能触达，
 *   解决"用户好几天不登录网站"收不到提醒的缺口。
 */
import webpush from "web-push";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const VAPID_FILE = join(DATA_DIR, "vapid.json");
const SUBS_FILE = join(DATA_DIR, "push-subscriptions.json");
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:noreply@qingxu.app";

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return;
  let pub = process.env.VAPID_PUBLIC_KEY || "";
  let priv = process.env.VAPID_PRIVATE_KEY || "";

  if (!pub || !priv) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (existsSync(VAPID_FILE)) {
      try {
        const v = JSON.parse(readFileSync(VAPID_FILE, "utf-8"));
        pub = v.publicKey;
        priv = v.privateKey;
      } catch {
        /* 损坏则重新生成 */
      }
    }
    if (!pub || !priv) {
      const keys = webpush.generateVAPIDKeys();
      pub = keys.publicKey;
      priv = keys.privateKey;
      try {
        writeFileSync(VAPID_FILE, JSON.stringify(keys), "utf-8");
      } catch (e) {
        console.error("[push] 保存 VAPID 失败", e && e.message);
      }
    }
  }

  webpush.setVapidDetails(VAPID_SUBJECT, pub, priv);
  vapidReady = true;
}

/** 返回 VAPID 公钥（前端订阅时用） */
export function getVapidPublicKey() {
  ensureVapid();
  if (process.env.VAPID_PUBLIC_KEY) return process.env.VAPID_PUBLIC_KEY;
  try {
    return JSON.parse(readFileSync(VAPID_FILE, "utf-8")).publicKey;
  } catch {
    return "";
  }
}

function loadSubs() {
  try {
    if (!existsSync(SUBS_FILE)) return [];
    const arr = JSON.parse(readFileSync(SUBS_FILE, "utf-8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSubs(subs) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), "utf-8");
  } catch (e) {
    console.error("[push] 保存订阅失败", e && e.message);
  }
}

/** 新增订阅（按 endpoint 去重）；subscription 含 endpoint / keys，phone 选填 */
export function addSub(sub) {
  if (!sub || !sub.endpoint) return false;
  const subs = loadSubs();
  if (!subs.find((s) => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    saveSubs(subs);
  }
  return true;
}

/** 按 endpoint 移除订阅（取消订阅 / 推送失效时调用） */
export function removeSub(endpoint) {
  const subs = loadSubs().filter((s) => s.endpoint !== endpoint);
  saveSubs(subs);
}

/**
 * 向所有订阅设备推送当晚提醒，返回成功条数。
 * @param {string} today 北京时间 YYYY-MM-DD
 */
export async function sendPushReminders(today) {
  ensureVapid();
  const subs = loadSubs();
  if (!subs.length) return 0;

  // 拉取用户态用于个性化文案（拉不到则退化为通用文案）
  let users = [];
  try {
    const { listUsers } = await import("./store.js");
    users = (await listUsers()) || [];
  } catch {
    users = [];
  }

  let sent = 0;
  for (const s of subs) {
    let title;
    let body;
    const u = s.phone ? users.find((x) => x.phone === s.phone) : null;
    if (u && u.state) {
      const master = u.state["qingxu.masterTasks"] || [];
      const dailyRaw = u.state["qingxu.dailyTasks"] || [];
      let daily = dailyRaw;
      try {
        const { launchToday } = await import("./engine.js");
        daily = launchToday(master, dailyRaw, today).dailyTasks;
      } catch {
        /* 计算失败则直接用原始数据 */
      }
      const remaining = daily.filter(
        (t) => t.date === today && t.status !== "done"
      ).length;
      const name = u.name || "同学";
      if (remaining > 0) {
        title = `青序·督促官：今天还有 ${remaining} 项没完成`;
        body = `${name}，晚上8点啦，先把【重要且紧急】和【紧急不重要】搞定，早做完早轻松～`;
      } else {
        title = `青序·督促官：今天的任务都收工啦`;
        body = `${name}，辛苦啦，明天继续加油！`;
      }
    } else {
      title = `青序·督促官：晚上8点啦`;
      body = `打开青序，看看今天的待办吧 🌿`;
    }

    const payload = JSON.stringify({ title, body, url: "/" });
    try {
      await webpush.sendNotification(s, payload, { TTL: 12 * 3600 });
      sent++;
    } catch (e) {
      // 404/410：订阅已失效（用户清除站点数据/卸载），移除避免堆积
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        removeSub(s.endpoint);
      } else {
        console.error("[push] 发送失败", e && e.message);
      }
    }
  }
  return sent;
}
