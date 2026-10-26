import { useCallback, useEffect, useRef, useState } from "react";
import { CelebrationOverlay } from "@/components/celebration/CelebrationOverlay";
import { findNewAchievements, type Achievement } from "@/lib/achievements";
import { computeStats } from "@/lib/stats";
import { readAll, readOne } from "@/lib/storage";
import { useEmotion } from "@/hooks/useEmotionTheme";
import { STORAGE_KEYS, type DailyLog, type DailyTask } from "@/types";

/** 计划/任务变更时派发的事件名（v3：调度中枢打卡、顺延、重排后触发成就检查） */
export const PLAN_CHANGED_EVENT = "qingxu:plan-changed";

/**
 * 成就监听与解锁触发（无 UI 主体，负责弹出解锁动画）
 * 监听：心情记录变化、任务变更事件
 */
export function AchievementChecker() {
  const { entries } = useEmotion();
  /** 已解锁集合用 ref 同步维护，避免在 setState updater 中产生副作用（StrictMode 下会双调用） */
  const unlockedRef = useRef<ReadonlySet<string>>(
    new Set(readOne<string[]>(STORAGE_KEYS.achievements) ?? [])
  );
  /** 待展示的解锁队列（逐个展示） */
  const [queue, setQueue] = useState<Achievement[]>([]);
  const checkingRef = useRef(false);

  const check = useCallback(() => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const dailyTasks = readAll<DailyTask>(STORAGE_KEYS.dailyTasks);
      const logs = readAll<DailyLog>(STORAGE_KEYS.dailyLogs);
      const stats = computeStats(entries, dailyTasks, logs);
      const fresh = findNewAchievements(stats, unlockedRef.current);
      if (fresh.length === 0) return;
      const next = new Set(unlockedRef.current);
      fresh.forEach((a) => next.add(a.id));
      unlockedRef.current = next;
      localStorage.setItem(
        STORAGE_KEYS.achievements,
        JSON.stringify([...next])
      );
      setQueue((q) => [...q, ...fresh]);
    } finally {
      checkingRef.current = false;
    }
  }, [entries]);

  /* 心情记录变化时检查 */
  useEffect(() => {
    check();
  }, [check]);

  /* 计划变更事件（任务页派发） */
  useEffect(() => {
    window.addEventListener(PLAN_CHANGED_EVENT, check);
    return () => window.removeEventListener(PLAN_CHANGED_EVENT, check);
  }, [check]);

  const current = queue[0];

  return (
    <>
      {current && (
        <CelebrationOverlay
          open
          onClose={() => setQueue((q) => q.slice(1))}
          emoji={current.emoji}
          title={`成就解锁 · ${current.name}`}
          message={current.desc}
        />
      )}
    </>
  );
}
