import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { fmtSeconds, useTimer } from "@/hooks/useTimer";

/**
 * 全局番茄钟悬浮胶囊（左下角）
 * 任务卡片上点击「开始任务」后，此处显示当前任务与剩余时间，可暂停/重置。
 */
export function TimerPill() {
  const { active, pause, resume, reset } = useTimer();

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 py-2.5 pl-4 pr-2.5 shadow-soft-lg backdrop-blur-xl"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Timer className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="max-w-44 truncate text-xs font-medium text-foreground">
              {active.title}
            </p>
            <p className="font-mono text-lg font-bold leading-tight tabular-nums text-primary">
              {fmtSeconds(active.remaining)}
              <span className="ml-1.5 align-middle text-[10px] font-normal text-muted-foreground">
                {active.paused ? "已暂停" : "专注中"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={active.paused ? resume : pause}
            aria-label={active.paused ? "继续" : "暂停"}
            className="rounded-xl bg-primary p-2 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
          >
            {active.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="重置计时"
            className="rounded-xl bg-secondary p-2 text-secondary-foreground transition-colors hover:opacity-80"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
