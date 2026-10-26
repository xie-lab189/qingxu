/**
 * 青序 · 智能调度中枢（React Provider）
 *
 * 职责：
 * 1. 挂载时执行 checkAndLaunchTodayPlan（launchToday）——每天自动发布今日任务卡片
 * 2. 多主任务管理（录入一次，永久保存）
 * 3. 监听 qingxu:replan 事件（心情点击）→ replanByMood 立刻重排今日列表
 * 4. 打卡 / 顺延 / 日志 的统一持久化
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PLAN_CHANGED_EVENT } from "@/components/agent/AchievementChecker";
import { protectReply } from "@/agents/config";
import { useAgentChat } from "@/hooks/useAgentChat";
import { parseTaskAndCalculate } from "@/lib/planUtils";
import { readAll, writeOne } from "@/lib/storage";
import { getSession, pushRemoteState } from "@/lib/api";
import {
  REPLAN_EVENT,
  createMasterTask,
  dateKey,
  launchToday,
  overallProgress,
  replanByMood,
  sortDaily,
  taskProgress,
} from "@/lib/scheduler";
import {
  STORAGE_KEYS,
  getEmotion,
  type DailyLog,
  type DailyTask,
  type EmotionType,
  type MasterTask,
  type Quadrant,
} from "@/types";

interface SchedulerState {
  masterTasks: MasterTask[];
  dailyTasks: DailyTask[];
  logs: DailyLog[];
  today: string;
}

function persist(s: SchedulerState) {
  writeOne(STORAGE_KEYS.masterTasks, s.masterTasks);
  writeOne(STORAGE_KEYS.dailyTasks, s.dailyTasks);
  writeOne(STORAGE_KEYS.dailyLogs, s.logs);
  // 同步到服务端：邮件定时任务（每晚 8 点督促官）依赖服务端存储的真实任务清单
  scheduleServerSync();
}

/** 防抖：合并短时间内的多次写入，1.5s 后把本地全量状态推送到服务器 */
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleServerSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const session = getSession();
    if (!session) return;
    const state: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("qingxu.")) {
        try {
          const raw = localStorage.getItem(k);
          if (raw !== null) state[k] = JSON.parse(raw);
        } catch {
          /* 忽略损坏的本地值 */
        }
      }
    }
    void pushRemoteState(session.phone, state);
  }, 1500);
}

/** 初始加载：读取本地数据 + 执行 checkAndLaunchTodayPlan + 确保今日日志存在 */
function loadInitial(): SchedulerState {
  const masterTasks = readAll<MasterTask>(STORAGE_KEYS.masterTasks);
  let dailyTasks = readAll<DailyTask>(STORAGE_KEYS.dailyTasks);
  let logs = readAll<DailyLog>(STORAGE_KEYS.dailyLogs);
  const today = dateKey();

  // 每天打开页面自动执行：逾期带入 + 顺延复活 + 发布今日卡片
  const launched = launchToday(masterTasks, dailyTasks, today);
  dailyTasks = launched.dailyTasks;

  if (!logs.some((l) => l.date === today)) {
    logs = [{ date: today, doneCount: 0, deferredTaskIds: [] }, ...logs];
  }

  const state: SchedulerState = { masterTasks, dailyTasks, logs, today };
  persist(state);
  return state;
}

interface AddResult {
  masterTask: MasterTask;
  /** 规划师简报 */
  brief: string;
}

interface SchedulerContextValue {
  masterTasks: MasterTask[];
  /** 今日待办（已按四象限排序，不含已顺延） */
  todayTasks: DailyTask[];
  logs: DailyLog[];
  today: string;
  /** 今日是否处于保护模式 / 能量加成 */
  protectedToday: boolean;
  boostedToday: boolean;
  todayDoneCount: number;
  /** 全局进度（所有进行中主任务） */
  progress: { done: number; total: number; pct: number };
  taskProgress: (m: MasterTask) => { done: number; total: number; pct: number };
  /** 添加主任务（自动解析数量 / 拆解 / 归类象限），返回简报 */
  addMasterTask: (name: string, days: number, quadrant?: Quadrant) => AddResult;
  archiveMasterTask: (id: string) => void;
  /** 打卡完成，返回更新后的任务（供庆祝反馈判断） */
  completeDailyTask: (id: string, by: "timer" | "check") => DailyTask | null;
  undoComplete: (id: string) => void;
  /** 标记任务「进行中」（完成一半，仅允许从 todo 进入） */
  startDailyTask: (id: string) => DailyTask | null;
  /** 取消「进行中」回到 todo */
  pauseDailyTask: (id: string) => DailyTask | null;
  markCelebrated: (id: string) => void;
  /** 情绪驱动重规划（也可直接调用；心情点击经 REPLAN_EVENT 自动触发） */
  replan: (mood: EmotionType) => void;
}

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

export function SchedulerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SchedulerState>(loadInitial);
  const { proactive } = useAgentChat();
  /** 供事件回调读取最新状态 */
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ---------- 今日视图（派生） ---------- */
  const todayTasks = useMemo(
    () =>
      sortDaily(
        state.dailyTasks.filter(
          (t) => t.date === state.today && t.status !== "deferred"
        )
      ),
    [state.dailyTasks, state.today]
  );
  const todayLog = useMemo(
    () => state.logs.find((l) => l.date === state.today),
    [state.logs, state.today]
  );
  const progress = useMemo(
    () => overallProgress(state.masterTasks, state.dailyTasks),
    [state.masterTasks, state.dailyTasks]
  );

  /* ---------- 主任务管理 ---------- */
  const addMasterTask = useCallback(
    (name: string, days: number, quadrant?: Quadrant): AddResult => {
      const parsed = parseTaskAndCalculate(name, days);
      const masterTask = createMasterTask(
        name,
        days,
        parsed.total,
        parsed.unit,
        parsed.daily,
        quadrant
      );
      setState((prev) => {
        const masterTasks = [...prev.masterTasks, masterTask];
        // 立即为今天发布第一张卡片
        const launched = launchToday(masterTasks, prev.dailyTasks, prev.today);
        const next: SchedulerState = { ...prev, masterTasks, dailyTasks: launched.dailyTasks };
        persist(next);
        return next;
      });
      return { masterTask, brief: parsed.brief };
    },
    []
  );

  const archiveMasterTask = useCallback((id: string) => {
    setState((prev) => {
      const masterTasks = prev.masterTasks.map((m) =>
        m.id === id ? { ...m, archived: true } : m
      );
      const next = { ...prev, masterTasks };
      persist(next);
      return next;
    });
  }, []);

  /* ---------- 打卡 ---------- */
  const completeDailyTask = useCallback(
    (id: string, by: "timer" | "check"): DailyTask | null => {
      const current = stateRef.current;
      const target = current.dailyTasks.find((t) => t.id === id);
      if (!target || (target.status !== "todo" && target.status !== "inProgress")) return null;
      const updated: DailyTask = {
        ...target,
        status: "done",
        completedBy: by,
        doneAt: new Date().toISOString(),
      };
      setState((prev) => {
        const dailyTasks = prev.dailyTasks.map((t) => (t.id === id ? updated : t));
        const logs = prev.logs.map((l) =>
          l.date === updated.date ? { ...l, doneCount: l.doneCount + 1 } : l
        );
        const next = { ...prev, dailyTasks, logs };
        persist(next);
        return next;
      });
      window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
      return updated;
    },
    []
  );

  /** 标记任务「进行中」（完成一半）——仅允许从 todo 进入 */
  const startDailyTask = useCallback((id: string): DailyTask | null => {
    const current = stateRef.current;
    const target = current.dailyTasks.find((t) => t.id === id);
    if (!target || target.status !== "todo") return null;
    const updated: DailyTask = { ...target, status: "inProgress" };
    setState((prev) => {
      const dailyTasks = prev.dailyTasks.map((t) => (t.id === id ? updated : t));
      const next = { ...prev, dailyTasks };
      persist(next);
      return next;
    });
    window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
    return updated;
  }, []);

  /** 取消「进行中」回到待办 */
  const pauseDailyTask = useCallback((id: string): DailyTask | null => {
    const current = stateRef.current;
    const target = current.dailyTasks.find((t) => t.id === id);
    if (!target || target.status !== "inProgress") return null;
    const updated: DailyTask = { ...target, status: "todo" };
    setState((prev) => {
      const dailyTasks = prev.dailyTasks.map((t) => (t.id === id ? updated : t));
      const next = { ...prev, dailyTasks };
      persist(next);
      return next;
    });
    window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
    return updated;
  }, []);

  const undoComplete = useCallback((id: string) => {
    setState((prev) => {
      const target = prev.dailyTasks.find((t) => t.id === id);
      if (!target || target.status !== "done") return prev;
      const dailyTasks = prev.dailyTasks.map((t) =>
        t.id === id
          ? { ...t, status: "todo" as const, completedBy: undefined, doneAt: undefined }
          : t
      );
      const logs = prev.logs.map((l) =>
        l.date === target.date ? { ...l, doneCount: Math.max(0, l.doneCount - 1) } : l
      );
      const next = { ...prev, dailyTasks, logs };
      persist(next);
      return next;
    });
  }, []);

  const markCelebrated = useCallback((id: string) => {
    setState((prev) => {
      const dailyTasks = prev.dailyTasks.map((t) =>
        t.id === id ? { ...t, celebrated: true } : t
      );
      const next = { ...prev, dailyTasks };
      persist(next);
      return next;
    });
  }, []);

  /* ---------- 情绪驱动重规划 ---------- */
  const replan = useCallback(
    (mood: EmotionType) => {
      const current = stateRef.current;
      const { dailyTasks, mode, affectedIds } = replanByMood(
        mood,
        current.dailyTasks,
        current.today
      );
      if (mode === "none") return;

      setState((prev) => {
        const logs = prev.logs.map((l) =>
          l.date === prev.today
            ? {
                ...l,
                mood,
                protected: l.protected || mode === "protect",
                boosted: l.boosted || mode === "boost",
                deferredTaskIds:
                  mode === "protect"
                    ? [...new Set([...l.deferredTaskIds, ...affectedIds])]
                    : l.deferredTaskIds,
              }
            : l
        );
        const next = { ...prev, dailyTasks, logs };
        persist(next);
        return next;
      });
      window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));

      // 智能体介入播报
      const label = getEmotion(mood).label;
      if (mode === "protect") {
        proactive("planner", protectReply(label));
      } else {
        proactive(
          "supervisor",
          `状态极佳（${label}），为您追加「长期投资」任务：${
            affectedIds.length
          } 件已加入今日列表，完成后有额外奖励！`
        );
      }
    },
    [proactive]
  );

  /* 心情点击（心情树洞 / 工作台）→ 自动触发重排 */
  useEffect(() => {
    const handler = (e: Event) => {
      const mood = (e as CustomEvent<{ mood: EmotionType }>).detail?.mood;
      if (mood) replan(mood);
    };
    window.addEventListener(REPLAN_EVENT, handler);
    return () => window.removeEventListener(REPLAN_EVENT, handler);
  }, [replan]);

  const value = useMemo<SchedulerContextValue>(
    () => ({
      masterTasks: state.masterTasks,
      todayTasks,
      logs: state.logs,
      today: state.today,
      protectedToday: todayLog?.protected ?? false,
      boostedToday: todayLog?.boosted ?? false,
      todayDoneCount: todayLog?.doneCount ?? 0,
      progress,
      taskProgress: (m) => taskProgress(m, state.dailyTasks),
      addMasterTask,
      archiveMasterTask,
      completeDailyTask,
      undoComplete,
      startDailyTask,
      pauseDailyTask,
      markCelebrated,
      replan,
    }),
    [
      state,
      todayTasks,
      todayLog,
      progress,
      addMasterTask,
      archiveMasterTask,
      completeDailyTask,
      undoComplete,
      startDailyTask,
      pauseDailyTask,
      markCelebrated,
      replan,
    ]
  );

  return (
    <SchedulerContext.Provider value={value}>
      {children}
    </SchedulerContext.Provider>
  );
}

export function useScheduler(): SchedulerContextValue {
  const ctx = useContext(SchedulerContext);
  if (!ctx) throw new Error("useScheduler 必须在 <SchedulerProvider> 内使用");
  return ctx;
}
