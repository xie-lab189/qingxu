import { motion } from "framer-motion";
import { Award, Lock } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/achievements";

interface AchievementWallProps {
  unlockedIds: ReadonlySet<string>;
}

/** 成就徽章墙：已解锁亮色 + 呼吸微光，未解锁灰色锁定 */
export function AchievementWall({ unlockedIds }: AchievementWallProps) {
  const unlocked = ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id));
  const locked = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id));

  const renderBadge = (
    id: string,
    emoji: string,
    name: string,
    desc: string,
    isUnlocked: boolean,
    index: number
  ) => (
    <motion.div
      key={id}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      whileHover={isUnlocked ? { y: -4, scale: 1.04 } : undefined}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center ${
        isUnlocked
          ? "border-white/70 bg-white/85 shadow-soft"
          : "border-border/50 bg-white/40 opacity-60"
      }`}
    >
      <span
        className={`relative flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
          isUnlocked ? "bg-accent" : "bg-secondary grayscale"
        }`}
      >
        {isUnlocked && (
          <span className="absolute inset-0 animate-breathe rounded-2xl bg-primary/15" />
        )}
        <span className="relative">{emoji}</span>
      </span>
      <p
        className={`flex items-center gap-1 text-xs font-semibold ${
          isUnlocked ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {!isUnlocked && <Lock className="h-3 w-3" />}
        {name}
      </p>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </motion.div>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-7"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Award className="h-4 w-4 text-muted-foreground" />
          成就徽章
        </h2>
        <span className="text-xs text-muted-foreground">
          已解锁 {unlocked.length} / {ACHIEVEMENTS.length}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {unlocked.map((a, i) => renderBadge(a.id, a.emoji, a.name, a.desc, true, i))}
        {locked.map((a, i) =>
          renderBadge(a.id, a.emoji, a.name, a.desc, false, unlocked.length + i)
        )}
      </div>
    </motion.section>
  );
}
