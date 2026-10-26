import { motion } from "framer-motion";
import { useEmotion } from "@/hooks/useEmotionTheme";
import { EMOTIONS, type EmotionType } from "@/types";

/**
 * 心情选择网格 —— 9 张情绪卡片
 * 选中卡片进入柔和呼吸放大动画，其余卡片轻微淡出以聚焦注意力
 */
export function EmotionGrid() {
  const { current, selectEmotion } = useEmotion();
  const selectedId: EmotionType | null = current?.id ?? null;

  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
      {EMOTIONS.map((emotion, index) => {
        const selected = emotion.id === selectedId;
        return (
          <motion.button
            key={emotion.id}
            type="button"
            initial={{ opacity: 0, y: 14 }}
            /* 选中后：柔和呼吸感放大缩小（scale 循环），未选中只入场一次 */
            animate={
              selected
                ? { opacity: 1, y: 0, scale: [1, 1.06, 1] }
                : { opacity: 1, y: 0, scale: 1 }
            }
            transition={
              selected
                ? {
                    delay: index * 0.05,
                    scale: {
                      repeat: Infinity,
                      duration: 3.2,
                      ease: "easeInOut",
                    },
                  }
                : { delay: index * 0.05, duration: 0.4, ease: "easeOut" }
            }
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => selectEmotion(emotion.id)}
            className="glass-card group flex flex-col items-center gap-2 px-3 py-5 outline-none transition-shadow duration-500 focus-visible:ring-2 focus-visible:ring-ring"
            style={
              selected
                ? {
                    boxShadow: `0 10px 32px -8px ${emotion.color}66`,
                    borderColor: `${emotion.color}88`,
                  }
                : undefined
            }
            aria-pressed={selected}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-transform duration-500 group-hover:scale-110"
              style={{ backgroundColor: emotion.soft }}
            >
              {emotion.emoji}
            </span>
            <span className="text-sm font-medium text-foreground">
              {emotion.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
