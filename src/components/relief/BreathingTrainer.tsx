import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, Wind } from "lucide-react";

/** 4-7-8 呼吸法阶段定义 */
const PHASES = [
  {
    name: "吸气",
    seconds: 4,
    scale: 1.3,
    color: "#5cb87f",
    soft: "#e6f5ec",
    hint: "用鼻子慢慢吸气，感受腹部鼓起来",
  },
  {
    name: "屏息",
    seconds: 7,
    scale: 1.3,
    color: "#5b9bd9",
    soft: "#e8f1fc",
    hint: "轻轻屏住呼吸，放松肩膀和眉心",
  },
  {
    name: "呼气",
    seconds: 8,
    scale: 1,
    color: "#9b8cd9",
    soft: "#efecfc",
    hint: "噘起嘴唇，把气缓缓地、彻底地吐尽",
  },
] as const;

/**
 * 呼吸放松训练器（4-7-8 呼吸法）
 * 缩放动画 + 阶段倒计时 + 轮次统计，焦虑时跟着圆圈呼吸就好
 */
export function BreathingTrainer() {
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASES[0].seconds);
  const [rounds, setRounds] = useState(0);

  const phase = PHASES[phaseIdx];

  /* 进入新阶段时重置倒计时 */
  useEffect(() => {
    if (!running) return;
    setSecondsLeft(phase.seconds);
    const iv = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(iv);
  }, [running, phaseIdx, phase.seconds]);

  /* 倒计时归零 → 切换下一阶段；完成一轮时计数 +1 */
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    const next = (phaseIdx + 1) % PHASES.length;
    if (next === 0) setRounds((r) => r + 1);
    setPhaseIdx(next);
  }, [secondsLeft, running, phaseIdx]);

  const reset = () => {
    setRunning(false);
    setPhaseIdx(0);
    setSecondsLeft(PHASES[0].seconds);
    setRounds(0);
  };

  return (
    <div className="flex flex-col items-center">
      {/* 呼吸圆圈 */}
      <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
        {/* 光晕层 */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-30 blur-2xl"
          animate={{ backgroundColor: phase.color, scale: running ? phase.scale : 1 }}
          transition={{ duration: running ? phase.seconds : 0.6, ease: "easeInOut" }}
        />
        {/* 外环提示圈 */}
        <div className="absolute inset-0 rounded-full border border-white/70" />
        {/* 呼吸主体：随阶段缩放 */}
        <motion.div
          className="flex h-44 w-44 items-center justify-center rounded-full sm:h-52 sm:w-52"
          style={{ backgroundColor: phase.soft }}
          animate={{ scale: running ? phase.scale : 1 }}
          transition={{
            duration: running ? phase.seconds : 0.6,
            ease: "easeInOut",
          }}
        >
          <motion.div
            className="flex h-32 w-32 flex-col items-center justify-center rounded-full sm:h-36 sm:w-36"
            style={{ backgroundColor: `${phase.color}33` }}
            animate={{ scale: running ? phase.scale : 1 }}
            transition={{
              duration: running ? phase.seconds : 0.6,
              ease: "easeInOut",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={phase.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <p
                  className="text-lg font-semibold"
                  style={{ color: phase.color }}
                >
                  {phase.name}
                </p>
                <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
                  {Math.max(0, secondsLeft)}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>

      {/* 阶段提示 */}
      <AnimatePresence mode="wait">
        <motion.p
          key={phase.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-6 text-sm text-muted-foreground"
        >
          {phase.hint}
        </motion.p>
      </AnimatePresence>

      {/* 控制按钮 */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium text-white shadow-soft transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: phase.color }}
        >
          {running ? (
            <>
              <Pause className="h-4 w-4" /> 暂停
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> {rounds === 0 && phaseIdx === 0 ? "开始呼吸" : "继续"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition-colors hover:opacity-80"
        >
          <RotateCcw className="h-4 w-4" /> 重置
        </button>
      </div>

      {/* 轮次与说明 */}
      <div className="mt-6 flex items-center gap-2 rounded-2xl bg-white/60 px-4 py-2 text-xs text-muted-foreground">
        <Wind className="h-3.5 w-3.5" />
        已完成 {rounds} 轮 · 4-7-8 呼吸法：吸气 4 秒、屏息 7 秒、呼气 8 秒
      </div>
    </div>
  );
}
