/**
 * 青序 · 邮件提醒（督促官落实）
 *
 * 每晚 20:00（北京时间）扫描所有「填写了邮箱」的用户：
 * - 今日仍有未完成任务 → 以「督促官」口吻发送认真督促邮件，点名未完成项并要一个马上执行的动作
 * - SMTP 未配置时（环境变量 与 server/secrets.json 均未提供）静默跳过，仅打印日志，不影响主服务
 *
 * 配置方式（二选一，环境变量优先于 secrets.json）：
 *   环境变量：SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM
 *   server/secrets.json：增加同名 SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM 字段
 *   （此举与 ZHIPU Key 同一机制，绕开发布平台没有环境变量入口的限制）
 */
import nodemailer from "nodemailer";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listUsers } from "./store.js";
import { launchToday } from "./engine.js";

// 读取 server/secrets.json 作为 SMTP 配置兜底（无需平台环境变量入口）
function loadSecrets() {
  try {
    const p = join(dirname(fileURLToPath(import.meta.url)), "secrets.json");
    if (!existsSync(p)) return {};
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
const secrets = loadSecrets();

const SMTP = {
  host: process.env.SMTP_HOST || secrets.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT || secrets.SMTP_PORT || 465),
  secure: true,
  auth:
    (process.env.SMTP_USER || secrets.SMTP_USER) && (process.env.SMTP_PASS || secrets.SMTP_PASS)
      ? { user: process.env.SMTP_USER || secrets.SMTP_USER, pass: process.env.SMTP_PASS || secrets.SMTP_PASS }
      : undefined,
};
const MAIL_FROM = process.env.MAIL_FROM || secrets.MAIL_FROM || process.env.SMTP_USER || secrets.SMTP_USER || "qingxu@example.com";

const transporter = SMTP.host ? nodemailer.createTransport(SMTP) : null;

/**
 * 北京时间（UTC+8）日历字段。
 * ⚠️ 不能用 new Date() 的本机字段：部署沙箱多为 UTC 时区，"20:00" 定时会错成凌晨 4 点。
 * 这里显式 +8 小时后取 UTC 字段，得到的就是北京时间，与服务器时区无关。
 */
function beijingParts() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return {
    date: d.toISOString().slice(0, 10),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}
/** 北京时间的「今天」日期键（YYYY-MM-DD） */
function beijingDateKey() {
  return beijingParts().date;
}

/** 象限中文标签（邮件里展示用） */
function quadrantLabel(q) {
  return (
    {
      IMPORTANT_URGENT: "重要且紧急",
      URGENT_NOT_IMPORTANT: "紧急不重要",
      IMPORTANT_NOT_URGENT: "重要不紧急",
      NOT_IMPORTANT_NOT_URGENT: "不重要不紧急",
    }[q] || "待办"
  );
}

/** 单个主任务进度（与 src/lib/scheduler.ts 的 taskProgress 同源：量化按量、非量化按完成天数） */
function masterProgress(m, dailyTasks) {
  const mine = dailyTasks.filter((t) => t.masterTaskId === m.id);
  if (m.totalAmount) {
    const done = mine
      .filter((t) => t.status === "done")
      .reduce((s, t) => s + (t.amount ?? 0), 0);
    return { done, total: m.totalAmount, pct: Math.round((done / m.totalAmount) * 100) };
  }
  const done = mine.filter((t) => t.status === "done").length;
  return { done, total: m.totalDays, pct: Math.round((done / m.totalDays) * 100) };
}

/** 扫描并发送（独立导出，便于手动触发与测试）
 * @param force 为 true 时忽略"当日已发"标记（手动测试用）；定时任务传 false 防止同日重复投递
 */
// 每日已发送标记：避免定时 tick 与手动触发在同日内重复发送
let lastFiredDate = "";

export async function sendNightlyReminders(hourLabel = "20:00", force = false) {
  const today = beijingDateKey();
  // 非强制（定时）模式下，当天已发过则跳过
  if (!force && lastFiredDate === today) {
    return { sent: 0, skipped: "already-sent-today" };
  }
  if (!transporter) {
    console.log(`[mailer] ${hourLabel} 未配置 SMTP，跳过邮件提醒（在 server/secrets.json 填入 SMTP_* 即可启用）`);
    return { sent: 0, skipped: "smtp-not-configured" };
  }
  // 收件人白名单（可选）：配置 REMINDER_PHONE 时仅这些手机号收信；
  // 未配置时，默认发送给【所有登记了邮箱的用户】（email 已在注册/登录时落库）。
  const phoneFilter = (process.env.REMINDER_PHONE || secrets.REMINDER_PHONE || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let users = await listUsers();
  if (phoneFilter.length) users = users.filter((u) => phoneFilter.includes(u.phone));

  // 按收件邮箱去重：同一邮箱下可能存在多个账号（如换号残留），
  // 只发一封，并选取「今日未完成任务最多」的账号作为代表，避免重复投递。
  const byEmail = new Map();
  for (const u of users) {
    const email = String(u.email || "").trim().toLowerCase();
    if (!email) continue;
    const state = u.state ?? {};
    const daily = state["qingxu.dailyTasks"] ?? [];
    const remaining = daily.filter((t) => t.date === today && t.status !== "done").length;
    const prev = byEmail.get(email);
    if (!prev || remaining > prev.remaining) {
      byEmail.set(email, { user: u, remaining });
    }
  }
  const deduped = [...byEmail.values()].map((v) => v.user);

  let sent = 0;

  for (const u of deduped) {
    const state = u.state ?? {};
    const masterTasks = state["qingxu.masterTasks"] ?? [];
    let dailyTasks = state["qingxu.dailyTasks"] ?? [];
    // 服务端补一次当日发布，保证「今日未完成」口径准确
    dailyTasks = launchToday(masterTasks, dailyTasks, today).dailyTasks;
    const todays = dailyTasks.filter((t) => t.date === today);
    const remaining = todays.filter((t) => t.status !== "done"); // 未完成（含进行中）
    const doneList = todays.filter((t) => t.status === "done"); // 今日已完成

    // 规则一：全象限罗列今日所有未完成任务（今日原定 + 顺延到今天，二者 date 均为今天，均已包含）
    const QUAD_LIST = [
      { key: "IMPORTANT_URGENT", label: "重要且紧急", icon: "🔥" },
      { key: "IMPORTANT_NOT_URGENT", label: "重要不紧急", icon: "⏳" },
      { key: "URGENT_NOT_IMPORTANT", label: "紧急不重要", icon: "⚡" },
      { key: "NOT_IMPORTANT_NOT_URGENT", label: "不重要不紧急", icon: "🌿" },
    ];
    const taskName = (t) => t.title + (t.overdue ? "（顺延）" : "");
    const quadLines = QUAD_LIST.map((q) => {
      const items = remaining.filter((t) => t.quadrant === q.key).map(taskName);
      return items.length ? `${q.icon}【${q.label}】：${items.join("、")}` : null;
    }).filter(Boolean);

    // 规则三：里程碑彩蛋（仅达成时追加，绝不扫兴）
    const eggs = [];
    for (const m of masterTasks) {
      if (m.archived) continue;
      const p = masterProgress(m, dailyTasks);
      if (p.total <= 0) continue;
      if (p.pct >= 100) {
        eggs.push(`🎉 另外，必须为你撒花！【${m.name}】的总进度达到100%彻底通关啦！太有毅力了，为你骄傲！`);
      } else if (p.pct >= 50) {
        eggs.push(`💡 另外，有个好消息：【${m.name}】的进度已经悄悄过半（50%）啦，你真的很棒，继续加油！`);
      }
    }

    // 今日既无未完成、也无已完成、也无里程碑彩蛋 → 不发
    if (remaining.length === 0 && doneList.length === 0 && eggs.length === 0) continue;

    // 只发给「登记了邮箱」的用户；无邮箱账号跳过（不再发兜底，避免多人串发到同一地址）
    const recipient = u.email;
    if (!recipient) continue;

    // 规则二：重点催促（温柔同桌口吻，别拖延到深夜）
    const urgeLine = "别拖延啦，重点先把【重要且紧急】和【紧急不重要】的搞定，早做完早轻松！";

    try {
      const quadBlock = quadLines.length
        ? quadLines.join("<br/>")
        : "（今天没有未完成的任务，真不错～）";
      const eggBlock = eggs
        .map((e) => `<p style="color:#3f7d5a;line-height:1.8;font-size:14px;margin:6px 0">${e}</p>`)
        .join("");
      const html = `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;background:#f6f8f4;border-radius:16px">
            <p style="color:#3d4a42;line-height:1.9;font-size:15px;margin:0 0 10px"><b>晚上好呀！今天还剩这些事没做完哦：</b></p>
            <p style="color:#3d4a42;line-height:2;font-size:15px;margin:0 0 10px">${quadBlock}</p>
            <p style="color:#5a6b62;line-height:1.8;font-size:14px;margin:0 0 10px">${urgeLine}</p>
            ${eggBlock}
            <p style="color:#9aa79f;font-size:12px;margin-top:16px">—— 青序·督促官（20:00 自动提醒）</p>
          </div>`;
      await transporter.sendMail({
        from: `青序·督促官 <${MAIL_FROM}>`,
        to: recipient,
        subject: `【青序·督促官】晚上8点啦，${u.name || "同学"}${
          remaining.length ? `，今天还有 ${remaining.length} 项没完成` : "，今天的任务都收工啦"
        }`,
        html,
      });
      sent++;
    } catch (err) {
      console.error(`[mailer] 发送失败(${u.phone}):`, err.message);
    }
  }
  console.log(`[mailer] ${hourLabel} 提醒完成：发送 ${sent} 封`);
  lastFiredDate = today;
  return { sent };
}

/**
 * 定时发送由外部定时器触发：cron-job.org 每天北京时间 20:00 调用
 * POST /api/cron/reminders?token=...，由 server/index.js 路由转发到 sendNightlyReminders。
 * 不再内置进程内 setInterval 兜底（避免平台休眠/唤醒带来的时序不确定性，保证"准点"由外部调度器唯一负责）。
 */
