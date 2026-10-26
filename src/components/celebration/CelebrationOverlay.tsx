import { AnimatePresence, motion } from "framer-motion";
import { Confetti } from "./Confetti";

interface CelebrationOverlayProps {
  open: boolean;
  onClose: () => void;
  /** 大图标 / emoji */
  emoji: string;
  title: string;
  message: string;
  /** 是否展示 100% 进度条庆祝动画 */
  showProgress?: boolean;
  /** 金色庆典模式：完成「重要不紧急」长期投资任务时的华丽变体 */
  golden?: boolean;
}

/** 金色庆典配色 */
const GOLD_PALETTE = [
  "#d9a441",
  "#f5d06f",
  "#b07d1e",
  "#f9e3a8",
  "#e8b54a",
  "#fff3d6",
];

/**
 * 庆祝弹窗：励志寄语 / 成就解锁 / 长期投资高光 共用
 * 撒花特效 + 弹性入场 + 可选进度条拉满动画；golden 模式使用金色撒花与描边
 */
export function CelebrationOverlay({
  open,
  onClose,
  emoji,
  title,
  message,
  showProgress = false,
  golden = false,
}: CelebrationOverlayProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
          onClick={onClose}
        >
          <Confetti count={golden ? 130 : 70} palette={golden ? GOLD_PALETTE : undefined} />
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card mx-6 w-full max-w-md p-10 text-center"
            style={
              golden
                ? {
                    border: "2px solid rgba(217,164,65,0.65)",
                    boxShadow:
                      "0 0 0 6px rgba(217,164,65,0.12), 0 20px 60px -16px rgba(217,164,65,0.45)",
                  }
                : undefined
            }
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="text-6xl"
            >
              {emoji}
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-5 text-xl font-semibold"
              style={golden ? { color: "#9a6b12" } : undefined}
            >
              {title}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-3 text-sm leading-relaxed text-muted-foreground"
            >
              {message}
            </motion.p>

            {showProgress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>今日任务</span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="font-semibold text-primary"
                  >
                    100%
                  </motion.span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-emerald-400"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                  />
                </div>
              </motion.div>
            )}

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              type="button"
              onClick={onClose}
              className="mt-8 rounded-2xl bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              收下这份鼓励
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
