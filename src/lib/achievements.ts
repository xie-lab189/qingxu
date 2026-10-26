/**
 * 青序 · 成就系统
 * 徽章定义 + 解锁判定
 */
import type { UserStats } from "./stats";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  check: (stats: UserStats) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: "first-seed",
    name: "初芽",
    desc: "第一次记录自己的心情",
    emoji: "🌱",
    check: (s) => s.moodCount >= 1,
  },
  {
    id: "streak-3",
    name: "三日坚持",
    desc: "连续打卡 3 天",
    emoji: "🔥",
    check: (s) => s.streakDays >= 3,
  },
  {
    id: "streak-7",
    name: "7日坚持",
    desc: "连续打卡 7 天",
    emoji: "🏅",
    check: (s) => s.streakDays >= 7,
  },
  {
    id: "streak-14",
    name: "半月修行",
    desc: "连续打卡 14 天",
    emoji: "💎",
    check: (s) => s.streakDays >= 14,
  },
  {
    id: "streak-30",
    name: "月度守护者",
    desc: "连续打卡 30 天",
    emoji: "🏆",
    check: (s) => s.streakDays >= 30,
  },
  {
    id: "dawn",
    name: "破晓者",
    desc: "在清晨 7 点前记录过心情",
    emoji: "🌅",
    check: (s) => s.hasDawn,
  },
  {
    id: "night-owl",
    name: "夜话者",
    desc: "在深夜 11 点后记录过心情",
    emoji: "🌙",
    check: (s) => s.hasNight,
  },
  {
    id: "collector",
    name: "情绪收藏家",
    desc: "集齐全部 9 种情绪记录",
    emoji: "🎨",
    check: (s) => s.distinctEmotions >= 9,
  },
  {
    id: "pomodoro-5",
    name: "番茄学徒",
    desc: "用番茄钟完成 5 个任务",
    emoji: "🍅",
    check: (s) => s.timerDoneCount >= 5,
  },
  {
    id: "planner-first",
    name: "蓝图绘制者",
    desc: "创建第一份学习计划",
    emoji: "🧭",
    check: (s) => s.hasPlan,
  },
  {
    id: "perfect-day",
    name: "完美一天",
    desc: "完成某一天的全部分任务",
    emoji: "⭐",
    check: (s) => s.hasPerfectDay,
  },
  {
    id: "future-investor",
    name: "未来投资人",
    desc: "在能量加成日提前完成一件推荐任务",
    emoji: "🚀",
    check: (s) => s.boostDoneCount >= 1,
  },
] as const;

/**
 * 找出本次新满足的成就（已解锁的跳过），
 * 返回新成就列表，调用方负责持久化
 */
export function findNewAchievements(
  stats: UserStats,
  unlockedIds: ReadonlySet<string>
): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id) && a.check(stats));
}
