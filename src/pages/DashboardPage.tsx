import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sunrise, CalendarCheck, Heart, Flame } from "lucide-react";
import { useEmotion } from "@/hooks/useEmotionTheme";
import { useScheduler } from "@/hooks/useScheduler";
import { readOne } from "@/lib/storage";
import { getCurrentUser } from "@/lib/profileService";
import { computeStreak } from "@/lib/stats";
import { EmotionGrid } from "@/components/mood/EmotionGrid";
import { TodayTodoList } from "@/components/tasks/TodayTodoList";
import { MoodTrendChart } from "@/components/stats/MoodTrendChart";
import { HeatmapCalendar } from "@/components/stats/HeatmapCalendar";
import { AchievementWall } from "@/components/stats/AchievementWall";
import { getEmotion, STORAGE_KEYS } from "@/types";

/** 根据系统真实时间动态问候（按指定的 5 个时段划分）；有昵称带上称呼，无昵称默认「同学」 */
function greetingByHour(name: string): { title: string; sub: string } {
  const h = new Date().getHours();
  const who = name.trim() || "同学";
  if (h >= 5 && h < 11)
    return {
      title: `早上好，${who}`,
      sub: "一日之计在于晨，但也不必着急，一步一步来。",
    };
  if (h >= 11 && h < 14)
    return {
      title: `中午好，${who}`,
      sub: "忙了一上午，记得好好吃顿饭，给身体充个电。",
    };
  if (h >= 14 && h < 18)
    return {
      title: `下午好，${who}`,
      sub: "午后容易疲倦，记得喝水、起身活动一下。",
    };
  if (h >= 18 && h < 24)
    return {
      title: `晚上好，${who}`,
      sub: "不管完成了多少，先肯定坚持到此刻的自己。",
    };
  return {
    title: `夜深了，${who}`,
    sub: "夜深了，身体和梦都在等你，早点休息吧。",
  };
}

/**
 * 主工作台（Dashboard · v3）
 * 今日待办置顶 + 情绪速记 + 趋势图 / 热力日历 / 成就墙
 */
export default function DashboardPage() {
  const { entries, current } = useEmotion();
  const { todayTasks, progress } = useScheduler();
  const greetName = getCurrentUser()?.name ?? "";
  const lastMood = entries[0];
  const lastMeta = lastMood ? getEmotion(lastMood.emotion) : null;

  const streak = useMemo(() => computeStreak(entries), [entries]);
  const unlockedIds = useMemo(
    () => new Set<string>(readOne<string[]>(STORAGE_KEYS.achievements) ?? []),
    // entries 变化意味着 AchievementChecker 刚写过成就，随之重读
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries]
  );

  const todoDone = todayTasks.filter((t) => t.status === "done").length;

  const stats = [
    {
      icon: Heart,
      title: "此刻心情",
      value: current
        ? `${current.emoji} ${current.label}`
        : lastMeta
          ? `${lastMeta.emoji} ${lastMeta.label}`
          : "——",
      desc:
        entries.length > 0
          ? `累计记录 ${entries.length} 次`
          : "点击下方心情卡片，今日任务将实时重排",
    },
    {
      icon: CalendarCheck,
      title: "今日待办",
      value: `${todoDone} / ${todayTasks.length}`,
      desc:
        todayTasks.length > 0
          ? `全局进度 ${progress.pct}%`
          : "去「任务规划」添加目标，每天自动生成",
    },
    {
      icon: Flame,
      title: "连续打卡",
      value: `${streak} 天`,
      desc: streak > 0 ? "继续保持，火焰不熄" : "从今天开始点燃第一簇火",
    },
  ];

  return (
    <div className="space-y-8">
      {/* 问候区 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-8"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-colors duration-700">
            <Sunrise className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-wide">
              {greetingByHour(greetName).title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {greetingByHour(greetName).sub}
            </p>
          </div>
        </div>
      </motion.section>

      {/* 概览卡片 */}
      <section className="grid gap-5 sm:grid-cols-3">
        {stats.map(({ icon: Icon, title, value, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.08 }}
            className="glass-card p-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-colors duration-700">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-sm text-muted-foreground">{title}</h3>
            <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{desc}</p>
          </motion.div>
        ))}
      </section>

      {/* 情绪速记：点击即触发今日任务重排（保护模式 / 能量加成） */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card space-y-4 p-7"
      >
        <p className="text-sm font-medium text-foreground">
          此刻感觉如何？点一下，今日待办会为你实时重排
        </p>
        <EmotionGrid />
      </motion.section>

      {/* 今日待办（最显眼位置） */}
      <TodayTodoList />

      {/* 心情趋势折线图（moodHistory 驱动） */}
      <MoodTrendChart entries={entries} />

      {/* 打卡热力日历 */}
      <HeatmapCalendar entries={entries} />

      {/* 成就徽章墙 */}
      <AchievementWall unlockedIds={unlockedIds} />
    </div>
  );
}
