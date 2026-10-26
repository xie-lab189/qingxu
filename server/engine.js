/**
 * 青序 · 服务端调度引擎（src/lib/scheduler.ts 的 JS 端口）
 *
 * 用于后端语义接口（POST /api/task/plan、POST /api/mood/replan）与
 * 邮件定时任务在服务端独立计算。前端仍是同算法 TS 版本的唯一 UI 数据源。
 */

const QUADRANT_ORDER = [
  "IMPORTANT_URGENT",
  "URGENT_NOT_IMPORTANT",
  "IMPORTANT_NOT_URGENT",
  "NOT_IMPORTANT_NOT_URGENT",
];
const POSITIVE_MOODS = ["energized", "calm", "expectant"];
const NEGATIVE_MOODS = ["stressed", "tired", "anxious", "low", "lonely", "irritable"];

const URGENT_RE = /考|期末|期中|截止|ddl|DDL|明天|今晚|提交|补考|挂科|答辩|测验|交/;
const CHORE_RE = /作业|实验报告|填表|打印|表格|截图|抄写|整理材料|盖章/;
const HABIT_RE = /背|单词|记|阅读|晨读|练字|听力|口语|刷题|复习|精读|泛读|锻炼|跑步|跳绳/;

export function classifyQuadrant(title) {
  if (URGENT_RE.test(title)) return "IMPORTANT_URGENT";
  if (CHORE_RE.test(title)) return "URGENT_NOT_IMPORTANT";
  if (HABIT_RE.test(title)) return "IMPORTANT_NOT_URGENT";
  return "IMPORTANT_NOT_URGENT";
}

const STAGE_TEMPLATES = [
  { pattern: /复习|备考|考试|期末|期中|考研/, stages: ["梳理知识框架与考纲范围","分模块复习·第一部分","分模块复习·第二部分","刷题巩固·易错点整理","错题回顾与查漏补缺","全真模拟自测","最后过一遍核心考点"] },
  { pattern: /论文|报告|毕设|开题|文献/, stages: ["查文献与收集资料","列提纲、搭逻辑框架","写引言","写正文·第一部分","写正文·第二部分","修改与润色","格式检查与定稿"] },
  { pattern: /英语|四级|六级|雅思|托福/, stages: ["词汇：新词 + 复习旧词","听力训练","阅读精做一篇","写作 / 翻译练习","口语跟读模仿","整套真题模拟","错题回顾总结"] },
  { pattern: /作业|实验|课程设计|大作业|作品/, stages: ["读题并明确验收要求","搭建基础框架","完成核心部分·第一步","完成核心部分·第二步","完善细节","自检验收并提交"] },
];
const GENERIC_STAGES = ["明确目标与范围","收集资料与准备","执行·第一阶段","执行·第二阶段","执行·第三阶段","检查与收尾"];

export function getStages(name) {
  return STAGE_TEMPLATES.find((t) => t.pattern.test(name))?.stages ?? GENERIC_STAGES;
}

function pad(n) { return String(n).padStart(2, "0"); }
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function diffDays(a, b) {
  return Math.round((new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000);
}
function genId() {
  return `mt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 抓取任务名中的数字与单位（与前端 parseTaskAndCalculate 同源逻辑） */
export function parseQuantified(name) {
  const cleaned = name.trim().replace(/\s+/g, "");
  const m = cleaned.match(/(\d+)\s*([一-龥]{0,4})?/);
  if (!m?.[1]) return { cleaned };
  const total = parseInt(m[1], 10);
  let unit = m[2] || "个";
  if (unit.length > 1 && /^[个道本篇章节份套组次]/.test(unit)) unit = unit.slice(1);
  return { cleaned, total, unit };
}

export function amountFor(m, dayIndex) {
  if (!m.totalAmount) return 1;
  const base = Math.floor(m.totalAmount / m.totalDays);
  const rem = m.totalAmount % m.totalDays;
  return base + (dayIndex <= rem ? 1 : 0);
}
export function cumFor(m, dayIndex) {
  let s = 0;
  for (let i = 1; i <= dayIndex; i++) s += amountFor(m, i);
  return s;
}

export function makeDailyTask(m, dayIndex, date) {
  const base = { id: genId(), masterTaskId: m.id, date, dayIndex, quadrant: m.quadrant, status: "todo" };
  if (m.totalAmount && m.unit) {
    const amount = amountFor(m, dayIndex);
    return { ...base, title: `${m.name} · 第${dayIndex}天 ${amount}个${m.unit}（累计 ${cumFor(m, dayIndex)}/${m.totalAmount}）`, amount };
  }
  const stages = getStages(m.name);
  return { ...base, title: `${m.name} · ${stages[(dayIndex - 1) % stages.length]}`, amount: 1 };
}

/** checkAndLaunchTodayPlan：逾期带入 + 顺延复活 + 每日自动发布 */
export function launchToday(masterTasks, dailyTasks, today = dateKey()) {
  const tasks = dailyTasks.map((t) => ({ ...t }));
  const created = [], carried = [], revived = [];
  for (const t of tasks) if (t.status === "todo" && t.date < today) { t.date = today; t.overdue = true; carried.push(t); }
  for (const t of tasks) if (t.status === "deferred" && t.deferredTo === today) { t.status = "todo"; t.date = today; t.deferredTo = undefined; revived.push(t); }
  for (const m of masterTasks) {
    if (m.archived) continue;
    const dayIndex = diffDays(today, m.startDate) + 1;
    if (dayIndex < 1 || dayIndex > m.totalDays) continue;
    if (tasks.some((t) => t.masterTaskId === m.id && t.date === today && !t.overdue)) continue;
    const task = makeDailyTask(m, dayIndex, today);
    tasks.push(task); created.push(task);
  }
  return { dailyTasks: tasks, created, carried, revived };
}

/**
 * 情绪重规划（v5 收紧版）：
 * - protect：今日只保留「重要且紧急」，其余全部顺延到明天（第 i 件 → 明天+i 天）
 * - boost：复活今日被顺延的 Q2 / 从未来抽调最近一件 Q2
 */
export function replanByMood(mood, dailyTasks, today = dateKey()) {
  const tasks = dailyTasks.map((t) => ({ ...t }));
  if (POSITIVE_MOODS.includes(mood)) {
    const affected = [];
    for (const t of tasks) {
      if (t.date === today && t.status === "deferred" && t.quadrant === "IMPORTANT_NOT_URGENT") {
        t.status = "todo"; t.deferredTo = undefined; t.boosted = true; affected.push(t.id);
      }
    }
    const hasInu = tasks.some((t) => t.date === today && t.status === "todo" && t.quadrant === "IMPORTANT_NOT_URGENT");
    if (!hasInu) {
      const future = tasks.filter((t) => t.status === "todo" && t.quadrant === "IMPORTANT_NOT_URGENT" && t.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (future) { future.date = today; future.boosted = true; affected.push(future.id); }
    }
    return { dailyTasks: tasks, mode: affected.length ? "boost" : "none", affectedIds: affected };
  }
  if (NEGATIVE_MOODS.includes(mood)) {
    const todayTasks = tasks
      .filter((t) => t.date === today && t.status === "todo")
      .sort((a, b) => QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant));
    // 只保留「重要且紧急」
    const deferred = todayTasks.filter((t) => t.quadrant !== "IMPORTANT_URGENT");
    deferred.forEach((t, i) => { t.status = "deferred"; t.deferredTo = addDays(today, 1 + i); });
    return { dailyTasks: tasks, mode: deferred.length ? "protect" : "none", affectedIds: deferred.map((t) => t.id) };
  }
  return { dailyTasks: tasks, mode: "none", affectedIds: [] };
}

/** 新建主任务（用户自选象限，缺省时才启发式兜底） */
export function createMasterTask(name, totalDays, quadrant) {
  const { cleaned, total, unit } = parseQuantified(name);
  const days = Math.min(Math.max(totalDays, 1), 30);
  const daily = total ? Math.ceil(total / days) : 1;
  return {
    id: genId(),
    name: cleaned,
    totalAmount: total,
    unit,
    totalDays: days,
    startDate: dateKey(),
    quadrant: quadrant ?? classifyQuadrant(cleaned),
    dailyBase: daily,
    createdAt: new Date().toISOString(),
  };
}
