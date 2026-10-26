/**
 * 青序 · 全局类型定义
 * 所有持久化实体的数据结构统一在此声明
 */

/** 任务优先级 */
export type TaskPriority = "low" | "medium" | "high";

/** 任务状态 */
export type TaskStatus = "todo" | "inProgress" | "done";

/** 学习任务 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  /** ISO 8601 日期字符串，如 2026-10-15 */
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  /** 预估耗时（分钟） */
  estimatedMinutes?: number;
  /** 关联的课程/科目 */
  subject?: string;
  createdAt: string;
  updatedAt: string;
}

import type { EmotionType } from "./emotions";

export type { EmotionMeta, EmotionType } from "./emotions";
export { EMOTIONS, getEmotion } from "./emotions";

/** 心情树洞记录 */
export interface MoodEntry {
  id: string;
  /** 情绪类型，关联 EMOTIONS 中的 9 种情绪 */
  emotion: EmotionType;
  /** 用户倾诉的正文（可选，倾诉功能后续实现） */
  content?: string;
  /** 可选标签，如 ["考试周", "失眠", "社交"] */
  tags?: string[];
  createdAt: string;
}

/** 用户信息（预留，供后续个性化干预使用） */
export interface UserProfile {
  id: string;
  nickname: string;
  grade?: string;
  major?: string;
  createdAt: string;
}

/* ---------------- 学习计划 v2（四象限 · 主动调度版） ---------------- */

/** 艾森豪威尔四象限 */
export type Quadrant =
  | "IMPORTANT_URGENT" // 重要且紧急
  | "URGENT_NOT_IMPORTANT" // 紧急不重要
  | "IMPORTANT_NOT_URGENT" // 重要不紧急（长期投资）
  | "NOT_IMPORTANT_NOT_URGENT"; // 不重要不紧急

/** 预估精力消耗 */
export type EffortLevel = "high" | "medium" | "low";

/** 任务状态 */
export type PlanTaskStatus = "todo" | "inProgress" | "done" | "deferred";

/** 象限元数据（展示色与说明） */
export const QUADRANT_META: Record<
  Quadrant,
  { label: string; short: string; color: string; soft: string; hint: string }
> = {
  IMPORTANT_URGENT: {
    label: "重要且紧急",
    short: "重要紧急",
    color: "#d96a5f",
    soft: "#fbe9e6",
    hint: "立刻做，优先级最高",
  },
  URGENT_NOT_IMPORTANT: {
    label: "紧急不重要",
    short: "紧急次要",
    color: "#5b9bd9",
    soft: "#e8f1fc",
    hint: "尽快做，可压缩范围",
  },
  IMPORTANT_NOT_URGENT: {
    label: "重要不紧急",
    short: "长期投资",
    color: "#d9a441",
    soft: "#faf0dc",
    hint: "每天做一点，最反拖延",
  },
  NOT_IMPORTANT_NOT_URGENT: {
    label: "不重要不紧急",
    short: "有余力",
    color: "#9aa5a0",
    soft: "#eef1ef",
    hint: "有空再做，可舍弃",
  },
};

/** 执行优先级排序：重要且紧急 > 紧急不重要 > 重要不紧急 > 不重要不紧急 */
export const QUADRANT_ORDER: readonly Quadrant[] = [
  "IMPORTANT_URGENT",
  "URGENT_NOT_IMPORTANT",
  "IMPORTANT_NOT_URGENT",
  "NOT_IMPORTANT_NOT_URGENT",
];

/** 精力消耗元数据（含番茄钟分钟数映射） */
export const EFFORT_META: Record<
  EffortLevel,
  { label: string; minutes: number; color: string }
> = {
  high: { label: "高", minutes: 40, color: "#d96a5f" },
  medium: { label: "中", minutes: 25, color: "#d9a441" },
  low: { label: "低", minutes: 15, color: "#5cb87f" },
};

/** 计划任务（四象限版） */
export interface PlanTask {
  id: string;
  title: string;
  quadrant: Quadrant;
  effort: EffortLevel;
  status: PlanTaskStatus;
  /** 计划安排的第几天（动态调度会重排） */
  dayIndex: number;
  /** 番茄钟时长（由精力映射：高40/中25/低15 分钟） */
  minutes: number;
  completedBy?: "timer" | "check";
  doneAt?: string;
  /** Q2 完成时是否已触发陪伴者高光鼓励 + 庆祝 */
  celebrated?: boolean;
  /** 是否被「能量加成」提前推荐到某天 */
  boosted?: boolean;
}

/** 学习计划（v2，localStorage 中凭 version 字段区分旧结构） */
export interface StudyPlan {
  id: string;
  name: string;
  totalDays: number;
  tasks: PlanTask[];
  createdAt: string;
  version: 2;
  /** 已开启过保护模式的日期（每天最多一次） */
  protectedDays?: number[];
  /** 已触发能量加成的日期（每天最多一次） */
  boostedDays?: number[];
  adjustReason?: string;
}

/** 用户录入的子任务草稿 */
export interface DraftTask {
  title: string;
  quadrant: Quadrant | "";
  effort: EffortLevel;
}

/* ==================== 智能调度中枢（v3 · 长期记忆版） ==================== */

/**
 * 主任务（masterTasks）：用户只需录入一次，永久保存在本地。
 * 系统每天依据它自动发布当日任务卡片，重启浏览器不丢失。
 */
export interface MasterTask {
  id: string;
  name: string;
  /** 总任务量（自动从任务名抓取的数字，无数值任务为空） */
  totalAmount?: number;
  unit?: string;
  totalDays: number;
  /** 开始日期 YYYY-MM-DD */
  startDate: string;
  /** 四象限分类（关键词启发式自动归类） */
  quadrant: Quadrant;
  /** 每日基准额度（量化任务=数量；非量化=1 个阶段） */
  dailyBase: number;
  createdAt: string;
  archived?: boolean;
}

/** 每日已发布任务（dailyTasks） */
export type DailyTaskStatus = "todo" | "inProgress" | "done" | "deferred";

export interface DailyTask {
  id: string;
  masterTaskId: string;
  /** 所属日期 YYYY-MM-DD */
  date: string;
  /** 相对主任务开始日的第几天 */
  dayIndex: number;
  /** 含具体任务量，如「背1000个单词 · 第1天 100个单词（累计 100/1000）」 */
  title: string;
  quadrant: Quadrant;
  /** 今日数量 */
  amount?: number;
  status: DailyTaskStatus;
  completedBy?: "timer" | "check";
  doneAt?: string;
  /** 顺延到的日期（到达该日自动复活为今日任务） */
  deferredTo?: string;
  /** 能量加成抽调 */
  boosted?: boolean;
  /** Q2 完成已触发金色庆典 */
  celebrated?: boolean;
  /** 逾期未做、带入今天 */
  overdue?: boolean;
}

/** 每日历史记录（dailyLogs） */
export interface DailyLog {
  date: string;
  mood?: EmotionType;
  doneCount: number;
  deferredTaskIds: string[];
  /** 当天是否开启过保护模式 */
  protected?: boolean;
  /** 当天是否触发过能量加成 */
  boosted?: boolean;
}

/** localStorage 存储键名统一登记，避免散落硬编码 */
export const STORAGE_KEYS = {
  tasks: "qingxu.tasks",
  /** 情绪历史（moodHistory），供心情趋势折线图使用 */
  moods: "qingxu.moods",
  profile: "qingxu.profile",
  /** 最近一次选择的情绪（仅用于主题恢复，不产生新记录） */
  lastEmotion: "qingxu.lastEmotion",
  /** @deprecated 旧版单计划结构，由 v3 主任务体系取代 */
  plan: "qingxu.plan",
  /** 已解锁的成就 id 列表 */
  achievements: "qingxu.achievements",
  /** 主任务数组（全局任务池，录入一次永久保存） */
  masterTasks: "qingxu.masterTasks",
  /** 每日已发布任务卡片 */
  dailyTasks: "qingxu.dailyTasks",
  /** 每日历史记录 */
  dailyLogs: "qingxu.dailyLogs",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
