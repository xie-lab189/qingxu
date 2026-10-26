import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";

interface PomodoroTimerProps {
  /** 专注时长（分钟） */
  minutes: number;
  /** 计时结束回调（标记任务完成 + 触发督促官） */
  onComplete: () => void;
  onCancel: () => void;
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 番茄钟：开始 / 暂停 / 重置，结束时回调 */
export function PomodoroTimer({ minutes, onComplete, onCancel }: PomodoroTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(true);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0 && !finishedRef.current) {
      finishedRef.current = true;
      setRunning(false);
      onComplete();
    }
  }, [secondsLeft, onComplete]);

  const total = minutes * 60;
  const pct = total === 0 ? 0 : (secondsLeft / total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-2xl border border-white/70 bg-white/70 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            番茄钟专注中
          </div>
          <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {fmt(secondsLeft)}
          </span>
        </div>

        {/* 进度环（线性进度条） */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {running ? (
              <>
                <Pause className="h-3.5 w-3.5" /> 暂停
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> {secondsLeft === total ? "开始" : "继续"}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setSecondsLeft(total);
              setRunning(false);
            }}
            className="flex items-center gap-1 rounded-xl bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:opacity-80"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 重置
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            收起
          </button>
        </div>
      </div>
    </motion.div>
  );
}
