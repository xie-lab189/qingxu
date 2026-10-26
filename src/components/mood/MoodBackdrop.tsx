import { AnimatePresence, motion } from "framer-motion";
import { useEmotion } from "@/hooks/useEmotionTheme";

/**
 * 情绪主题背景层
 * 选择情绪后，以当前情绪色渲染一层径向渐变光晕，
 * 通过 AnimatePresence 双层交叉淡入淡出实现平滑过渡（渐变本身不可 CSS 过渡）
 */
export function MoodBackdrop() {
  const { current } = useEmotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <AnimatePresence initial={false}>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.65 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(65% 55% at 50% -5%, ${current.soft} 0%, transparent 72%)`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
