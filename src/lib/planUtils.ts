/**
 * 青序 · 智能规划调度引擎（v2.1 · 自动拆解量化版）
 *
 * 核心函数：
 * - parseTaskAndCalculate() 自动识别：抓取任务中的数字与单位并计算每日额度；
 *                           无数值时按阶段模板自动拆解子任务，自动归类四象限
 * - generateSmartPlan()     主动规划：四象限比例分配 + 前期保障 Q1/Q3 + 长期投资均布
 * - adjustDailySchedule()   动态调度：保护模式（状态不佳减负顺延）/ 能量加成（状态极佳推荐 Q2）
 * - renderDailyTodoList()   UI 渲染数据：生成某天的每日任务卡片列表（按象限优先级排序）
 * - readPlan()              读取并迁移旧版数据结构
 */
import { readOne } from "@/lib/storage";
import { genId } from "@/lib/storage";
import {
  EFFORT_META,
  QUADRANT_ORDER,
  STORAGE_KEYS,
  type DraftTask,
  type EffortLevel,
  type PlanTask,
  type Quadrant,
  type StudyPlan,
} from "@/types";

/* ==================== 自动识别与量化拆解 ==================== */

/** 紧急信号：出现即视为 重要且紧急 */
const URGENT_RE = /考|期末|期中|截止|ddl|DDL|明天|今晚|提交|补考|挂科|答辩|测验|交/;
/** 习惯积累型：自动归入 重要不紧急（长期投资） */
const HABIT_RE = /背|单词|记|阅读|晨读|练字|听力|口语|刷题|复习|精读|泛读|锻炼|跑步|跳绳/;
/** 事务型：自动归入 紧急不重要 */
const CHORE_RE = /作业|实验报告|填表|打印|表格|截图|抄写|整理材料|盖章/;

/** 关键词启发式象限分类（无数字任务的整体归类 & 子任务归类共用） */
export function classifyQuadrant(title: string): Quadrant {
  if (URGENT_RE.test(title)) return "IMPORTANT_URGENT";
  if (CHORE_RE.test(title)) return "URGENT_NOT_IMPORTANT";
  // 习惯积累型明确归入「重要不紧急」——最值得每天推进的长期投资
  if (HABIT_RE.test(title)) return "IMPORTANT_NOT_URGENT";
  // 其余默认同样归入「重要不紧急」，避免事务性噪音挤占优先级
  return "IMPORTANT_NOT_URGENT";
}

/** 关键词 → 阶段性拆解模板（无数值任务自动拆解用） */
const STAGE_TEMPLATES: { pattern: RegExp; stages: string[] }[] = [
  {
    pattern: /复习|备考|考试|期末|期中|考研/,
    stages: [
      "梳理知识框架与考纲范围",
      "分模块复习·第一部分",
      "分模块复习·第二部分",
      "刷题巩固·易错点整理",
      "错题回顾与查漏补缺",
      "全真模拟自测",
      "最后过一遍核心考点",
    ],
  },
  {
    pattern: /论文|报告|毕设|开题|文献/,
    stages: [
      "查文献与收集资料",
      "列提纲、搭逻辑框架",
      "写引言",
      "写正文·第一部分",
      "写正文·第二部分",
      "修改与润色",
      "格式检查与定稿",
    ],
  },
  {
    pattern: /英语|四级|六级|雅思|托福/,
    stages: [
      "词汇：新词 + 复习旧词",
      "听力训练",
      "阅读精做一篇",
      "写作 / 翻译练习",
      "口语跟读模仿",
      "整套真题模拟",
      "错题回顾总结",
    ],
  },
  {
    pattern: /作业|实验|课程设计|大作业|作品/,
    stages: [
      "读题并明确验收要求",
      "搭建基础框架",
      "完成核心部分·第一步",
      "完成核心部分·第二步",
      "完善细节",
      "自检验收并提交",
    ],
  },
];

/** 通用兜底阶段（任务类型不明确时） */
const GENERIC_STAGES = [
  "明确目标与范围",
  "收集资料与准备",
  "执行·第一阶段",
  "执行·第二阶段",
  "执行·第三阶段",
  "检查与收尾",
];

/** 导出：智能调度引擎按任务名取阶段模板（无数值任务每日发布用） */
export function getStages(name: string): string[] {
  return (
    STAGE_TEMPLATES.find((t) => t.pattern.test(name))?.stages ?? GENERIC_STAGES
  );
}

/** 阶段子任务的象限细分：冲刺/验收类 → Q1；准备/框架类 → Q2；其余跟随整体判断 */
function stageQuadrant(stage: string, overall: Quadrant): Quadrant {
  if (/自测|模拟|提交|定稿|冲刺|查漏|纠错|验收/.test(stage)) {
    return "IMPORTANT_URGENT";
  }
  if (/文献|资料|提纲|框架|收集|准备/.test(stage)) {
    return "IMPORTANT_NOT_URGENT";
  }
  return overall;
}

/** 解析结果：量化 or 模板拆解 的任务草稿 + 规划师简报 */
export interface ParsedTaskPlan {
  drafts: DraftTask[];
  /** 规划师一键生成后的简短播报 */
  brief: string;
  /** 是否成功量化为每日额度 */
  quantified: boolean;
  total?: number;
  daily?: number;
  unit?: string;
}

/**
 * 自动识别与量化拆解：
 * 1. 抓取总任务中的数字（如 1000）与单位（如 个/单词/道题），
 *    直接计算每日额度（1000 / 10 天 = 每天 100），余数均摊到前几天；
 * 2. 无数值时（如「写一篇论文」）自动按阶段模板拆解为子任务。
 * 所有产出自动归类四象限，无需用户手动分类。
 */
export function parseTaskAndCalculate(name: string, days: number): ParsedTaskPlan {
  const d = Math.min(Math.max(days, 1), 30);
  const cleaned = name.trim().replace(/\s+/g, "");

  // —— 分支一：含数字 → 量化每日额度 ——
  const numMatch = cleaned.match(/(\d+)\s*([一-龥]{0,4})?/);
  if (numMatch?.[1]) {
    const total = parseInt(numMatch[1], 10);
    let unit = numMatch[2] || "个";
    // 单位清洗：「个单词」→「单词」、「道题」→「题」；单字量词保留
    if (unit.length > 1 && /^[个道本篇章节份套组次]/.test(unit)) {
      unit = unit.slice(1);
    }

    const base = Math.floor(total / d);
    if (base >= 1) {
      const rem = total % d;
      let cum = 0;
      const drafts: DraftTask[] = Array.from({ length: d }, (_, i) => {
        const n = base + (i < rem ? 1 : 0); // 余数均摊到前几天，保证总量精确
        cum += n;
        return {
          title: `${cleaned} · 第${i + 1}天 ${n}个${unit}（累计 ${cum}/${total}）`,
          quadrant: classifyQuadrant(cleaned),
          effort: "medium" as const,
        };
      });
      const daily = Math.ceil(total / d);
      return {
        drafts,
        brief: `已为您将 ${total} 个${unit}拆解为每日约 ${daily} 个（共 ${d} 天），归入「${
          classifyQuadrant(cleaned) === "IMPORTANT_URGENT"
            ? "重要且紧急"
            : "重要不紧急·长期投资"
        }」，今日任务已生成，请查收。`,
        quantified: true,
        total,
        daily,
        unit,
      };
    }
  }

  // —— 分支二：无数值 → 阶段模板自动拆解 ——
  const template =
    STAGE_TEMPLATES.find((t) => t.pattern.test(cleaned))?.stages ?? GENERIC_STAGES;
  const overall = classifyQuadrant(cleaned);
  const drafts: DraftTask[] = template.map((stage) => ({
    title: `${cleaned} · ${stage}`,
    quadrant: stageQuadrant(stage, overall),
    effort: /模拟|自测|刷题|核心/.test(stage) ? ("high" as const) : ("medium" as const),
  }));

  return {
    drafts,
    brief: `已为您把「${cleaned}」自动拆解为 ${drafts.length} 个阶段子任务（如「${drafts[0].title.split("·")[1]?.trim() ?? "第一步"}」等），分配到 ${d} 天并按四象限排期完毕，今日任务已生成，请查收。`,
    quantified: false,
  };
}

/* ==================== 主动规划 ==================== */

/** 轮询分配：把任务列表均匀撒到给定的日期区间内 */
function assignRoundRobin(
  tasks: PlanTask[],
  dayStart: number,
  dayEnd: number
): void {
  if (tasks.length === 0) return;
  const span = Math.max(1, dayEnd - dayStart + 1);
  tasks.forEach((t, i) => {
    t.dayIndex = dayStart + (i % span);
  });
}

/**
 * 主动规划：将用户分类好的四象限任务按比例分配到每一天
 *
 * 调度策略：
 * - Q1 重要且紧急　→ 集中在周期前半段（前 50%），优先保障
 * - Q3 紧急不重要　→ 偏前期（前 2/3），与 Q1 错峰
 * - Q2 重要不紧急　→ 均匀散布整个周期（每天一点，防拖延的长期投资）
 * - Q4 不重要不紧急 → 靠后（后半段），有余力再做
 */
export function generateSmartPlan(
  name: string,
  totalDays: number,
  drafts: DraftTask[]
): StudyPlan {
  const days = Math.min(Math.max(totalDays, 1), 30);

  // 按执行优先级排序（Q1 > Q3 > Q2 > Q4），精力高者靠前
  const effortRank: Record<EffortLevel, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...drafts]
    .filter((d) => d.title.trim() && d.quadrant)
    .map(
      (d): PlanTask => ({
        id: genId(),
        title: d.title.trim(),
        quadrant: d.quadrant as Quadrant,
        effort: d.effort,
        status: "todo",
        dayIndex: 1,
        minutes: EFFORT_META[d.effort].minutes,
      })
    )
    .sort(
      (a, b) =>
        QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant) ||
        effortRank[a.effort] - effortRank[b.effort]
    );

  // 按象限分桶
  const bucket = (q: Quadrant) => sorted.filter((t) => t.quadrant === q);
  const q1 = bucket("IMPORTANT_URGENT");
  const q3 = bucket("URGENT_NOT_IMPORTANT");
  const q2 = bucket("IMPORTANT_NOT_URGENT");
  const q4 = bucket("NOT_IMPORTANT_NOT_URGENT");

  // 比例分配
  const q1End = Math.max(1, Math.ceil(days * 0.5)); // Q1：前 50%
  const q3End = Math.max(1, Math.ceil(days * 0.66)); // Q3：前 2/3
  const q4Start = Math.min(days, Math.floor(days * 0.5) + 1); // Q4：后半段

  assignRoundRobin(q1, 1, q1End);
  assignRoundRobin(q3, 1, q3End);
  assignRoundRobin(q2, 1, days); // 长期投资：全周期均布
  assignRoundRobin(q4, q4Start, days);

  return {
    id: genId(),
    name,
    totalDays: days,
    tasks: [...q1, ...q3, ...q2, ...q4],
    createdAt: new Date().toISOString(),
    version: 2,
    protectedDays: [],
    boostedDays: [],
  };
}

/* ==================== 动态调度 ==================== */

export interface AdjustResult {
  plan: StudyPlan;
  /** 保护模式下被顺延的任务数 */
  deferredCount: number;
  /** 能量加成本次提前推荐的任务 id */
  boostedIds: string[];
}

/**
 * 动态调度（情绪自适应）：
 *
 * protect（状态不佳）：
 *  - 当天保留 Q1（重要且紧急）全部 + Q3（紧急不重要）全部，
 *    其余 Q2（重要不紧急）/ Q4（不重要不紧急）标记 deferred 并平摊到后续天数
 *  - 保留的两类分别排在第一、第二顺位（按 QUADRANT_ORDER）
 *
 * boost（状态极佳）：
 *  - 从未来抽调 1-2 个 Q2（重要不紧急）到今天，标记 boosted，完成有额外奖励
 */
export function adjustDailySchedule(
  plan: StudyPlan,
  day: number,
  mode: "protect" | "boost"
): AdjustResult {
  if (mode === "protect") {
    // 先把此前被顺延（缓存中已是 deferred）的「重要且紧急 / 紧急不重要」
    // 任务复活回今天，避免旧缓存让「紧急不重要」永久消失在今日列表。
    const resurrected = plan.tasks.map((t) =>
      (t.quadrant === "IMPORTANT_URGENT" || t.quadrant === "URGENT_NOT_IMPORTANT") &&
      t.status === "deferred"
        ? { ...t, status: "todo" as const, dayIndex: day }
        : t
    );

    // 当天待办按优先级排序
    const today = resurrected
      .filter((t) => t.dayIndex === day && t.status === "todo")
      .sort(
        (a, b) => QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant)
      );

    const keep = new Set<string>();
    for (const t of today) {
      // 保护模式：保留「重要且紧急」与「紧急不重要」两类（核心利益 + 时间底线），
      // 顺延「重要不紧急」与「不重要不紧急」到后续天数
      if (t.quadrant === "IMPORTANT_URGENT" || t.quadrant === "URGENT_NOT_IMPORTANT") {
        keep.add(t.id);
      }
    }
    const toDefer = today.filter((t) => !keep.has(t.id));

    // 平摊到后续天数；已在最后一天则停留顺延状态
    const futureDays = Math.max(0, plan.totalDays - day);
    const tasks = resurrected.map((t) => {
      const idx = toDefer.findIndex((d) => d.id === t.id);
      if (idx === -1) return t;
      return {
        ...t,
        status: "deferred" as const,
        dayIndex: futureDays > 0 ? day + 1 + (idx % futureDays) : t.dayIndex,
      };
    });

    return {
      plan: { ...plan, tasks, adjustReason: "protect" },
      deferredCount: toDefer.length,
      boostedIds: [],
    };
  }

  // boost：从未来抽调 1-2 个 Q2 到今天
  const candidates = plan.tasks.filter(
    (t) =>
      t.status === "todo" &&
      t.quadrant === "IMPORTANT_NOT_URGENT" &&
      t.dayIndex > day
  );
  const picked = candidates.slice(0, 2);
  const ids = new Set(picked.map((t) => t.id));

  return {
    plan: {
      ...plan,
      tasks: plan.tasks.map((t) =>
        ids.has(t.id) ? { ...t, dayIndex: day, boosted: true } : t
      ),
    },
    deferredCount: 0,
    boostedIds: [...ids],
  };
}

/* ==================== 通用工具 ==================== */

/** 当前应进行到哪一天（按创建时间推算，封顶 totalDays） */
export function currentDayIndex(plan: StudyPlan): number {
  const elapsedDays =
    Math.floor(
      (Date.now() - new Date(plan.createdAt).getTime()) / 86_400_000
    ) + 1;
  return Math.min(Math.max(elapsedDays, 1), plan.totalDays);
}

/** 计划进度：done / 全部任务 */
export function planProgress(plan: StudyPlan): {
  done: number;
  total: number;
  pct: number;
} {
  const done = plan.tasks.filter((t) => t.status === "done").length;
  const total = plan.tasks.length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** 单任务完成 / 取消完成 */
export function setTaskDone(
  plan: StudyPlan,
  taskId: string,
  done: boolean,
  by: "timer" | "check"
): StudyPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: done ? ("done" as const) : ("todo" as const),
            completedBy: done ? by : undefined,
            doneAt: done ? new Date().toISOString() : undefined,
          }
        : t
    ),
  };
}

/** 局部更新任务（如标记 celebrated） */
export function patchTask(
  plan: StudyPlan,
  taskId: string,
  patch: Partial<PlanTask>
): StudyPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  };
}

/** 某天的任务列表：已顺延的剔除（它们已被重新分配到未来），按执行优先级排序 */
export function daySchedule(plan: StudyPlan, day: number): PlanTask[] {
  return plan.tasks
    .filter((t) => t.dayIndex === day && t.status !== "deferred")
    .sort(
      (a, b) => QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant)
    );
}

/**
 * 每日任务卡片列表（UI 渲染数据源）：
 * 返回指定天的任务卡片（含具体任务量标题、四象限标签、完成状态），
 * 顺序严格为 重要且紧急 > 紧急不重要 > 重要不紧急 > 不重要不紧急。
 * 页面主界面的打卡列表即由此驱动。
 */
export function renderDailyTodoList(plan: StudyPlan, day: number): PlanTask[] {
  return daySchedule(plan, day);
}

/* ==================== 存储迁移 ==================== */

interface LegacyPlan {
  id: string;
  name: string;
  totalDays: number;
  createdAt: string;
  tasks: {
    id: string;
    title: string;
    dayIndex: number;
    status: string;
    completedBy?: "timer" | "check";
    doneAt?: string;
  }[];
}

/** 旧版计划迁移：任务全部归入「紧急不重要」（历史自动拆解无法推断重要性），已完成保持完成 */
function migrateLegacy(raw: LegacyPlan): StudyPlan {
  return {
    id: raw.id,
    name: raw.name,
    totalDays: raw.totalDays,
    createdAt: raw.createdAt,
    version: 2,
    protectedDays: [],
    boostedDays: [],
    tasks: (raw.tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      quadrant: "URGENT_NOT_IMPORTANT" as const,
      effort: "medium" as const,
      status: t.status === "done" ? ("done" as const) : ("todo" as const),
      dayIndex: t.dayIndex,
      minutes: EFFORT_META.medium.minutes,
      completedBy: t.completedBy,
      doneAt: t.doneAt,
    })),
  };
}

/** 读取计划：v2 直读，旧版自动迁移（结构不兼容的丢弃） */
export function readPlan(): StudyPlan | null {
  const raw = readOne<StudyPlan & LegacyPlan>(STORAGE_KEYS.plan);
  if (!raw) return null;
  if (raw.version === 2) return raw as StudyPlan;
  if (raw.id && raw.name && Array.isArray(raw.tasks)) {
    const migrated = migrateLegacy(raw);
    // 迁移后即写回，下次直读
    try {
      localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(migrated));
    } catch {
      /* 忽略写回失败 */
    }
    return migrated;
  }
  return null;
}
