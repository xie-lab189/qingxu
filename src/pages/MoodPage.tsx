import { motion } from "framer-motion";
import { HeartHandshake, History } from "lucide-react";
import { useEmotion } from "@/hooks/useEmotionTheme";
import { EmotionGrid } from "@/components/mood/EmotionGrid";
import { EmotionQuote } from "@/components/mood/EmotionQuote";
import { VentBox } from "@/components/mood/VentBox";
import { getEmotion } from "@/types";

/**
 * 心情树洞页
 * 9 种心情卡片 → 选择 → 记录 localStorage + 全站主题过渡 + 专属治愈短句
 */
export default function MoodPage() {
  const { entries, current } = useEmotion();
  const recent = entries.slice(0, 8);

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-colors duration-700">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-wide">心情树洞</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              此刻的心情是哪一种？轻轻点一下就好。
              {current
                ? ` 现在陪着你的是「${current.label}」的色调。`
                : " 选完之后，整个页面会染上你心情的颜色。"}
            </p>
          </div>
        </div>
      </motion.section>

      {/* 9 种心情卡片 */}
      <EmotionGrid />

      {/* 治愈短句反馈 */}
      <EmotionQuote />

      {/* 深夜倾诉树洞 */}
      <VentBox />

      {/* 最近心情足迹（读取 localStorage 演示） */}
      {recent.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-8"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <History className="h-4 w-4 text-muted-foreground" />
            最近的心情足迹
          </h2>
          <ul className="mt-4 divide-y divide-border/60">
            {recent.map((entry) => {
              const meta = getEmotion(entry.emotion);
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span>{meta.emoji}</span>
                  <span className="font-medium text-foreground">
                    {meta.label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}
    </div>
  );
}
