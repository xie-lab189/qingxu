/**
 * 青序 · 统计数据计算
 * 心情趋势、打卡热力、连续打卡 streak
 */
import type { DailyLog, DailyTask, EmotionType, MoodEntry } from "@/types";

/** 情绪愉悦度（1-5），用于折线图量化 */
export const EMOTION_VALENCE: Record<EmotionType, number> = {
  low: 1,
  lonely: 1.5,
  stressed: 1.8,
  irritable: 2,
  anxious: 2.2,
  tired: 2.5,
  calm: 4,
  expectant: 4.5,
  energized: 5,
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface TrendPoint {
  /** MM/dd */
  date: string;
  /** 当日平均愉悦度，无记录为 null */
  score: number | null;
  count: number;
}

/** 过去 N 天的心情趋势（含无记录的日期，保证折线连续） */
export function buildMoodTrend(entries: MoodEntry[], days: number): TrendPoint[] {
  // 按日聚合
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const e of entries) {
    const key = dayKey(new Date(e.createdAt));
    const agg = byDay.get(key) ?? { sum: 0, count: 0 };
    agg.sum += EMOTION_VALENCE[e.emotion];
    agg.count += 1;
    byDay.set(key, agg);
  }

  const result: TrendPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const agg = byDay.get(key);
    result.push({
      date: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
      score: agg ? Math.round((agg.sum / agg.count) * 10) / 10 : null,
      count: agg?.count ?? 0,
    });
  }
  return result;
}

export interface HeatmapCell {
  date: string;
  /** 周列内第几天（0=周一） */
  weekday: number;
  count: number;
}

/** 打卡热力日历数据：最近 weeks 周，按周一对齐的格子数组 */
export function buildHeatmap(entries: MoodEntry[], weeks = 16): HeatmapCell[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const key = dayKey(new Date(e.createdAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = new Date();
  // 对齐到本周一
  const monday = new Date(today);
  const offset = (today.getDay() + 6) % 7; // 周日=6
  monday.setDate(today.getDate() - offset - (weeks - 1) * 7);

  const cells: HeatmapCell[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d > today) break;
    const key = dayKey(d);
    cells.push({
      date: key,
      weekday: (d.getDay() + 6) % 7,
      count: counts.get(key) ?? 0,
    });
  }
  return cells;
}

/** 连续打卡天数（从最近一次有记录的日期往前数） */
export function computeStreak(entries: MoodEntry[]): number {
  const days = [...new Set(entries.map((e) => dayKey(new Date(e.createdAt))))].sort();
  if (days.length === 0) return 0;
  let streak = 1;
  for (let i = days.length - 1; i > 0; i--) {
    const diff =
      (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86_400_000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

/** 成就判定所需的汇总统计 */
export interface UserStats {
  moodCount: number;
  streakDays: number;
  distinctEmotions: number;
  /** 是否有 7 点前记录（破晓者） */
  hasDawn: boolean;
  /** 是否有 23 点后记录（夜话者） */
  hasNight: boolean;
  /** 番茄钟完成任务数 */
  timerDoneCount: number;
  hasPlan: boolean;
  /** 是否有完整完成的一天 */
  hasPerfectDay: boolean;
  /** 能量加成任务完成数（提前完成被推荐的 Q2） */
  boostDoneCount: number;
}

export function computeStats(
  entries: MoodEntry[],
  dailyTasks: DailyTask[],
  logs: DailyLog[]
): UserStats {
  const emotions = new Set(entries.map((e) => e.emotion));
  return {
    moodCount: entries.length,
    streakDays: computeStreak(entries),
    distinctEmotions: emotions.size,
    hasDawn: entries.some((e) => new Date(e.createdAt).getHours() < 7),
    hasNight: entries.some((e) => new Date(e.createdAt).getHours() >= 23),
    timerDoneCount: dailyTasks.filter(
      (t) => t.status === "done" && t.completedBy === "timer"
    ).length,
    hasPlan: dailyTasks.length > 0,
    boostDoneCount: dailyTasks.filter((t) => t.boosted && t.status === "done")
      .length,
    // 完成 ≥3 项且无需顺延的一天 = 完美一天
    hasPerfectDay: logs.some((l) => l.doneCount >= 3),
  };
}
