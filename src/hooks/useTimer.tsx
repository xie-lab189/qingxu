/**
 * 青序 · TimerEngine（督促官的定时提醒引擎）
 *
 * 职责：
 * 1. 「开始任务」→ 启动番茄钟倒计时（默认 25 分钟），卡片实时显示剩余时间
 * 2. 倒计时结束 → 声音提示（WebAudio 合成，无需音频文件）+ 督促官弹窗
 * 3. 每晚 20:00 定点督促：「今天还有 X 个任务未完成，抓紧时间哦！」
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useScheduler } from "@/hooks/useScheduler";
import { notify } from "@/lib/notify";
import { dateKey } from "@/lib/scheduler";

export interface ActiveTimer {
  taskId: string;
  title: string;
  /** 总时长（秒） */
  duration: number;
  /** 剩余秒数 */
  remaining: number;
  paused: boolean;
}

const DEFAULT_MINUTES = 25;
const NUDGE_HOUR = 20;
const NUDGE_KEY = "qingxu.lastNudgeDate";

interface TimerContextValue {
  active: ActiveTimer | null;
  /** 开始任务（番茄钟） */
  start: (taskId: string, title: string, minutes?: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** 某任务的剩余秒（未在计时返回 null），用于卡片实时显示 */
  remainingOf: (taskId: string) => number | null;
}

const TimerContext = createContext<TimerContextValue | null>(null);

/** WebAudio 合成提示音：三声上行「叮」 */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.45);
    });
    window.setTimeout(() => ctx.close(), 2000);
  } catch {
    /* 音频不可用时静默 */
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const { proactive } = useAgentChat();
  const { todayTasks } = useScheduler();
  /** 督促官语料（复用 config 中 timerDone 风格的提醒） */
  const nudgedTodayRef = useRef<string>(
    localStorage.getItem(NUDGE_KEY) ?? ""
  );

  /* 每秒递减 */
  useEffect(() => {
    if (!active || active.paused) return;
    const iv = window.setInterval(() => {
      setActive((prev) => {
        if (!prev || prev.paused) return prev;
        const remaining = Math.max(0, prev.remaining - 1);
        if (remaining === 0) {
          // 时间到：声音 + 系统通知 + 督促官弹窗
          playChime();
          notify("青序·番茄钟", "时间到！休息 5 分钟，喝口水、伸个懒腰。");
          window.setTimeout(() => {
            proactive(
              "supervisor",
              "叮叮叮——番茄钟时间到！休息 5 分钟，喝口水、伸个懒腰。这是我批准的！"
            );
          }, 300);
          return null;
        }
        return { ...prev, remaining };
      });
    }, 1000);
    return () => window.clearInterval(iv);
  }, [active, proactive]);

  /* 每晚 20:00 定点督促（打开页面时若已过 20 点且当天未提醒，也补发一次） */
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const today = dateKey(now);
      if (now.getHours() < NUDGE_HOUR) return;
      if (nudgedTodayRef.current === today) return;
      const remaining = todayTasks.filter((t) => t.status !== "done").length;
      if (remaining === 0) {
        nudgedTodayRef.current = today;
        localStorage.setItem(NUDGE_KEY, today);
        return;
      }
      nudgedTodayRef.current = today;
      localStorage.setItem(NUDGE_KEY, today);
      // 系统级通知（权限拒绝时静默，由下方对话面板兜底）
      notify(
        "青序·督促官",
        `夜深了，还有 ${remaining} 项任务在等你，清掉它安心睡觉吧。`
      );
      proactive(
        "supervisor",
        `夜深了，今天还有 ${remaining} 个任务未完成，抓紧时间哦！清掉最后一项，安心睡觉吧～`
      );
    };
    check();
    const iv = window.setInterval(check, 60_000);
    return () => window.clearInterval(iv);
    // todayTasks 仅用于读取数量，避免频繁重建定时器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proactive]);

  const start = useCallback(
    (taskId: string, title: string, minutes: number = DEFAULT_MINUTES) => {
      setActive({ taskId, title, duration: minutes * 60, remaining: minutes * 60, paused: false });
    },
    []
  );
  const pause = useCallback(() => {
    setActive((prev) => (prev ? { ...prev, paused: true } : prev));
  }, []);
  const resume = useCallback(() => {
    setActive((prev) => (prev ? { ...prev, paused: false } : prev));
  }, []);
  const reset = useCallback(() => setActive(null), []);
  const remainingOf = useCallback(
    (taskId: string) => (active && active.taskId === taskId ? active.remaining : null),
    [active]
  );

  const value: TimerContextValue = {
    active,
    start,
    pause,
    resume,
    reset,
    remainingOf,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer 必须在 <TimerProvider> 内使用");
  return ctx;
}

/** 秒 → mm:ss */
export function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
