import { motion } from "framer-motion";
import { Wind } from "lucide-react";
import { BreathingTrainer } from "@/components/relief/BreathingTrainer";
import { useEmotion } from "@/hooks/useEmotionTheme";
import { COMFORT_MOODS } from "@/agents/config";

/**
 * 减压页：呼吸放松训练器
 * 4-7-8 呼吸法 + 缩放动画 + 阶段倒计时，焦虑时跟着圆圈呼吸
 */
export default function ReliefPage() {
  const { current } = useEmotion();
  const needCalm = current && COMFORT_MOODS.includes(current.id);

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-colors duration-700">
            <Wind className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-wide">呼吸减压</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {needCalm
                ? `检测到你此刻有些「${current.label}」，先别管任务，跟着圆圈做几轮深呼吸。`
                : "焦虑、烦躁、睡不着的时候，跟着圆圈做几轮 4-7-8 呼吸，身体会先平静下来。"}
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="glass-card px-6 py-10"
      >
        <BreathingTrainer />
      </motion.section>
    </div>
  );
}
