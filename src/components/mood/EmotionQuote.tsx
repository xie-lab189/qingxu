import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEmotion } from "@/hooks/useEmotionTheme";
import { MOOD_SENTENCES } from "@/lib/moodSentences";
import { pickSmart } from "@/lib/random";
import { getEmotion } from "@/types";

/**
 * 治愈短句反馈面板
 * 语料来自 moodSentences 动态随机库（9 情绪 × 10+ 条），
 * pickSmart 保证不与上一次重复 —— 拒绝复读机。
 */
export function EmotionQuote() {
  const { latestEntry, dismissQuote } = useEmotion();

  return (
    <AnimatePresence mode="wait">
      {latestEntry && (
        <motion.div
          key={latestEntry.id}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass-card relative overflow-hidden p-8"
          style={{
            borderColor: `${getEmotion(latestEntry.emotion).color}55`,
          }}
        >
          {/* 情绪色光晕 */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
            style={{
              backgroundColor: getEmotion(latestEntry.emotion).soft,
            }}
          />
          <button
            type="button"
            onClick={dismissQuote}
            aria-label="收起"
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex items-start gap-5">
            <motion.span
              className="text-4xl"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{
                repeat: Infinity,
                duration: 3.2,
                ease: "easeInOut",
              }}
            >
              {getEmotion(latestEntry.emotion).emoji}
            </motion.span>
            <div className="space-y-3">
              <p className="text-lg leading-relaxed text-foreground">
                {pickSmart(
                  MOOD_SENTENCES[latestEntry.emotion],
                  `mood-quote:${latestEntry.emotion}`
                )}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5" />
                已悄悄记下这一刻 ·
                {new Date(latestEntry.createdAt).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
