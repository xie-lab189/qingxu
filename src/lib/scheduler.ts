/**
 * 青序 · 智能调度引擎（v3 · 长期记忆 + 情绪驱动重规划）
 *
 * - checkAndLaunchTodayPlan 语义：launchToday() 每次打开页面自动执行——
 *   按 masterTasks 计算当天基准任务量并自动生成今日任务卡片（含逾期带入、顺延复活）
 * - replanByMood() 情绪点击后立刻重排今日列表：
 *   正向 → 复活/抽调「重要不紧急」任务；负向 → 保护模式（隐藏 Q2/Q4 并平摊顺延）
 */

/** 情绪重规划事件名：心情树洞/工作台点击情绪后派发 */
export const REPLAN_EVENT = "qingxu:replan";

import { genId } from "@/lib/storage";
import { classifyQuadrant, getStages } from "@/lib/planUtils";
import {
  QUADRANT_ORDER,
  type DailyTask,
  type EmotionType,
  type MasterTask,
  type Quadrant,
} from "@/types";

/* ---------------- 日期工具 ---------------- */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 本地日期键 YYYY-MM-DD */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 日期键 + n 天 */
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** a - b 的天数差 */
export function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) /
      86_400_000
  );
}

/* ---------------- 主任务 → 每日任务 ---------------- */

/** 指定天应完成的数量（余数均摊前几天，保证总量精确） */
export function amountFor(m: MasterTask, dayIndex: number): number {
  if (!m.totalAmount) return 1;
  const base = Math.floor(m.totalAmount / m.totalDays);
  const rem = m.totalAmount % m.totalDays;
  return base + (dayIndex <= rem ? 1 : 0);
}

/** 截止第 dayIndex 天的累计量 */
export function cumFor(m: MasterTask, dayIndex: number): number {
  let sum = 0;
  for (let i = 1; i <= dayIndex; i++) sum += amountFor(m, i);
  return sum;
}

/** 依据主任务生成某天的任务卡片（含具体任务量标题） */
export function makeDailyTask(
  m: MasterTask,
  dayIndex: number,
  date: string
): DailyTask {
  const base = {
    id: genId(),
    masterTaskId: m.id,
    date,
    dayIndex,
    quadrant: m.quadrant,
    status: "todo" as const,
  };
  if (m.totalAmount && m.unit) {
    const amount = amountFor(m, dayIndex);
    return {
      ...base,
      title: `${m.name} · 第${dayIndex}天 ${amount}个${m.unit}（累计 ${cumFor(m, dayIndex)}/${m.totalAmount}）`,
      amount,
    };
  }
  const stages = getStages(m.name);
  return {
    ...base,
    title: `${m.name} · ${stages[(dayIndex - 1) % stages.length]}`,
    amount: 1,
  };
}

export interface LaunchResult {
  dailyTasks: DailyTask[];
  /** 今日新发布 */
  created: DailyTask[];
  /** 逾期未做、带入今天 */
  carried: DailyTask[];
  /** 顺延到今天复活 */
  revived: DailyTask[];
}

/**
 * checkAndLaunchTodayPlan：
 * 打开页面时自动执行——读取 masterTasks 与当前日期，
 * ① 逾期 todo 带入今天；② 顺延到今天的任务复活；
 * ③ 为每个进行中的主任务发布今天的任务卡片（含每日基准额度）。
 */
export function launchToday(
  masterTasks: MasterTask[],
  dailyTasks: DailyTask[],
  today: string = dateKey()
): LaunchResult {
  const tasks = dailyTasks.map((t) => ({ ...t }));
  const created: DailyTask[] = [];
  const carried: DailyTask[] = [];
  const revived: DailyTask[] = [];

  // ① 逾期未完成 → 带入今天（保留原任务，标记 overdue）
  for (const t of tasks) {
    if (t.status === "todo" && t.date < today) {
      t.date = today;
      t.overdue = true;
      carried.push(t);
    }
  }

  // ② 顺延到期的任务复活
  for (const t of tasks) {
    if (t.status === "deferred" && t.deferredTo === today) {
      t.status = "todo";
      t.date = today;
      t.deferredTo = undefined;
      revived.push(t);
    }
  }

  // ③ 新一天：按主任务自动发布今日卡片
  for (const m of masterTasks) {
    if (m.archived) continue;
    const dayIndex = diffDays(today, m.startDate) + 1;
    if (dayIndex < 1 || dayIndex > m.totalDays) continue;
    const exists = tasks.some(
      (t) => t.masterTaskId === m.id && t.date === today && !t.overdue
    );
    if (exists) continue;
    const task = makeDailyTask(m, dayIndex, today);
    tasks.push(task);
    created.push(task);
  }

  return { dailyTasks: tasks, created, carried, revived };
}

/* ---------------- 情绪驱动重规划 ---------------- */

/** 触发能量加成的正向情绪 */
export const POSITIVE_MOODS: readonly EmotionType[] = ["energized", "calm", "expectant"];
/** 触发保护模式的负面情绪（含孤独/烦躁） */
export const NEGATIVE_MOODS: readonly EmotionType[] = [
  "stressed",
  "tired",
  "anxious",
  "low",
  "lonely",
  "irritable",
];

export interface ReplanResult {
  dailyTasks: DailyTask[];
  mode: "protect" | "boost" | "none";
  /** 受影响的任务 id（顺延的 / 追加的），用于日志与动画 */
  affectedIds: string[];
}

/**
 * replanByMood：点击情绪后立刻重排今日列表。
 *
 * boost（活力/平静/期待）：
 *   复活今日被顺延的「重要不紧急」任务；若今日没有，则从未来抽调最近一件。
 * protect（压力大/疲惫/焦虑/低落/孤独/烦躁）：
 *   今日保留 重要且紧急 全部 + 紧急不重要 全部，
 *   其余（重要不紧急 / 不重要不紧急）标记 deferred 并平摊到未来逐日。
 */
export function replanByMood(
  mood: EmotionType,
  dailyTasks: DailyTask[],
  today: string = dateKey()
): ReplanResult {
  const tasks = dailyTasks.map((t) => ({ ...t }));

  if (POSITIVE_MOODS.includes(mood)) {
    const affected: string[] = [];
    // 复活今日被顺延的 Q2
    for (const t of tasks) {
      if (
        t.date === today &&
        t.status === "deferred" &&
        t.quadrant === "IMPORTANT_NOT_URGENT"
      ) {
        t.status = "todo";
        t.deferredTo = undefined;
        t.boosted = true;
        affected.push(t.id);
      }
    }
    // 今日没有 Q2 → 从未来抽调最近一件
    const hasInu = tasks.some(
      (t) => t.date === today && t.status === "todo" && t.quadrant === "IMPORTANT_NOT_URGENT"
    );
    if (!hasInu) {
      const future = tasks
        .filter(
          (t) =>
            t.status === "todo" &&
            t.quadrant === "IMPORTANT_NOT_URGENT" &&
            t.date > today
        )
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      if (future) {
        future.date = today;
        future.boosted = true;
        affected.push(future.id);
      }
    }
    return {
      dailyTasks: tasks,
      mode: affected.length > 0 ? "boost" : "none",
      affectedIds: affected,
    };
  }

  if (NEGATIVE_MOODS.includes(mood)) {
    // 保护模式白名单：只保留「重要且紧急」与「紧急不重要」两类。
    // 先把此前被顺延（缓存中已是 deferred）的这两类任务复活回今天，
    // 否则旧缓存会让「紧急不重要」任务永久消失在今日列表（缓存干扰）。
    const resurrectedIds: string[] = [];
    for (const t of tasks) {
      if (
        (t.quadrant === "IMPORTANT_URGENT" || t.quadrant === "URGENT_NOT_IMPORTANT") &&
        t.status === "deferred"
      ) {
        t.status = "todo";
        t.date = today;
        t.deferredTo = undefined;
        resurrectedIds.push(t.id);
      }
    }
    const todayTasks = tasks
      .filter((t) => t.date === today && t.status === "todo")
      .sort(
        (a, b) =>
          QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant)
      );
    // 其余（重要不紧急 / 不重要不紧急）全部顺延到明天起逐日排开
    const deferred = todayTasks.filter(
      (t) => t.quadrant !== "IMPORTANT_URGENT" && t.quadrant !== "URGENT_NOT_IMPORTANT"
    );
    deferred.forEach((t, i) => {
      t.status = "deferred";
      t.deferredTo = addDays(today, 1 + i); // 明天起每天复活一件
    });
    const affected = [...resurrectedIds, ...deferred.map((t) => t.id)];
    return {
      dailyTasks: tasks,
      // 复活了被缓存顺延的 Q1/Q3，或顺延了新的 Q2/Q4，都视为已触发保护模式并持久化
      mode: affected.length > 0 ? "protect" : "none",
      affectedIds: affected,
    };
  }

  return { dailyTasks: tasks, mode: "none", affectedIds: [] };
}

/* ---------------- 排序与进度 ---------------- */

/** 今日列表排序：重要且紧急 > 紧急不重要 > 重要不紧急 > 不重要不紧急 */
export function sortDaily(tasks: DailyTask[]): DailyTask[] {
  return [...tasks].sort(
    (a, b) =>
      QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant) ||
      a.date.localeCompare(b.date)
  );
}

/** 单个主任务进度（量化按量，非量化按完成天数） */
export function taskProgress(
  m: MasterTask,
  dailyTasks: DailyTask[]
): { done: number; total: number; pct: number } {
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

/** 全局进度（所有未归档主任务汇总） */
export function overallProgress(
  masterTasks: MasterTask[],
  dailyTasks: DailyTask[]
): { done: number; total: number; pct: number } {
  const active = masterTasks.filter((m) => !m.archived);
  let done = 0;
  let total = 0;
  for (const m of active) {
    const p = taskProgress(m, dailyTasks);
    done += p.done;
    total += p.total;
  }
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** 新建主任务（录入一次，永久保存；象限由用户选择，缺省时按关键词启发式兜底） */
export function createMasterTask(
  name: string,
  totalDays: number,
  totalAmount?: number,
  unit?: string,
  daily?: number,
  quadrant?: Quadrant
): MasterTask {
  const cleaned = name.trim().replace(/\s+/g, "");
  const days = Math.min(Math.max(totalDays, 1), 30);
  return {
    id: genId(),
    name: cleaned,
    totalAmount,
    unit,
    totalDays: days,
    startDate: dateKey(),
    quadrant: quadrant ?? classifyQuadrant(cleaned),
    dailyBase: daily ?? 1,
    createdAt: new Date().toISOString(),
  };
}
