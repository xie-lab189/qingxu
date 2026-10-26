import { motion } from "framer-motion";
import { BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";
import { useEmotion } from "@/hooks/useEmotionTheme";
import { EMOTION_VALENCE } from "@/lib/stats";
import type { EmotionType } from "@/types";

/** 触发保护模式的负面情绪（v3：含孤独/烦躁） */
const PROTECT_MOODS: readonly EmotionType[] = [
  "stressed",
  "tired",
  "anxious",
  "low",
  "lonely",
  "irritable",
];
/** 触发能量加成的正向情绪 */
const BOOST_MOODS: readonly EmotionType[] = ["energized", "calm", "expectant"];

/**
 * 精力 / 心情状态条（关联心情树洞数据）
 * 展示当前情绪、精力刻度，以及调度系统的预判提示
 */
export function EnergyBar() {
  const { current, entries } = useEmotion();

  if (!current) {
    return (
      <div className="rounded-2xl border border-border/60 bg-white/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          ⚪ 今天还没有记录心情 —— 状态未知，去「心情树洞」点一下，规划师就能为你动态调度。
        </p>
      </div>
    );
  }

  const valence = EMOTION_VALENCE[current.id];
  const pct = Math.round((valence / 5) * 100);
  const isProtect = PROTECT_MOODS.includes(current.id);
  const isBoost = BOOST_MOODS.includes(current.id);

  const BatteryIcon =
    valence <= 2.5 ? BatteryLow : valence <= 4 ? BatteryMedium : BatteryFull;

  return (
    <motion.div
      key={current.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{current.emoji}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">
              当前状态 · {current.label}
            </p>
            <BatteryIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          {/* 精力刻度条 */}
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: current.color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {isProtect && (
          <>
            <span className="font-medium" style={{ color: "#d96a5f" }}>
              状态欠佳 · 保护模式待命：
            </span>
            进入本页时将自动只保留必要任务，其余顺延平摊到后续天数。
          </>
        )}
        {isBoost && (
          <>
            <span className="font-medium" style={{ color: "#5cb87f" }}>
              状态极佳 · 能量加成就绪：
            </span>
            规划师可能从未来抽调 1-2 件「长期投资」任务给你，完成有额外奖励。
          </>
        )}
        {!isProtect && !isBoost && "状态平稳，按既定节奏执行即可。"}
      </p>
      {entries.length === 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          （暂无历史心情数据，以上为当前选择）
        </p>
      )}
    </motion.div>
  );
}
