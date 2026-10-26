import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Flame,
  History,
  Play,
  Shield,
  Zap,
} from "lucide-react";
import { CelebrationOverlay } from "@/components/celebration/CelebrationOverlay";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useScheduler } from "@/hooks/useScheduler";
import { fmtSeconds, useTimer } from "@/hooks/useTimer";
import { investPraiseReply } from "@/agents/config";
import { QUADRANT_META, type DailyTask } from "@/types";

/** 能量加成任务完成的额外奖励语（督促官） */
const BOOST_BONUS = [
  "隐藏奖励到账！你提前完成了未来的任务，本督促官正式宣布：今日加分！🚀",
  "漂亮！这一件是向「未来的自己」借来的胜利，利滚利，血赚！",
  "加成任务完成！今天我必须给你一个大大的表扬，不许谦虚！",
];

/**
 * 今日待办列表（TodayTodoList）
 * 工作台与任务规划页共用：按四象限排序的任务卡片 + 打卡按钮。
 * 情绪重排（保护模式/能量加成）时卡片以平滑动画消失或加入。
 */
export function TodayTodoList() {
  const {
    todayTasks,
    today,
    todayDoneCount,
    protectedToday,
    boostedToday,
    completeDailyTask,
    undoComplete,
    startDailyTask,
    pauseDailyTask,
    markCelebrated,
  } = useScheduler();
  const { proactive } = useAgentChat();
  const { start, remainingOf } = useTimer();
  /** 长期投资（Q2）完成的金色庆典 */
  const [golden, setGolden] = useState<string | null>(null);

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const handleCheck = (task: DailyTask) => {
    if (task.status === "done") {
      undoComplete(task.id);
      return;
    }
    const done = completeDailyTask(task.id, "check");
    if (!done) return;
    // 差异化反馈：Q2 金色庆典 + 陪伴者高光；加成任务督促官奖励
    if (done.quadrant === "IMPORTANT_NOT_URGENT" && !done.celebrated) {
      markCelebrated(done.id);
      setGolden(done.title);
      proactive("companion", investPraiseReply());
    } else if (done.boosted) {
      proactive("supervisor", BOOST_BONUS[Math.floor(Math.random() * BOOST_BONUS.length)]);
    }
  };

  /** 标记/取消「进行中」（完成一半） */
  const handleStart = (task: DailyTask) => {
    if (task.status === "inProgress") {
      pauseDailyTask(task.id);
    } else {
      startDailyTask(task.id);
    }
  };

  const todoCount = todayTasks.filter((t) => t.status !== "done").length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-7"
    >
      {/* 头部：日期 + 完成进度 + 模式徽标 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <History className="h-4 w-4 text-muted-foreground" />
          今日待办
          <span className="text-xs font-normal text-muted-foreground">
            {dateLabel}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {protectedToday && (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "#fbe9e6", color: "#a04a41" }}>
              <Shield className="h-3 w-3" /> 保护模式
            </span>
          )}
          {boostedToday && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
              <Zap className="h-3 w-3" /> 能量加成
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
            <Flame className="h-3 w-3" />
            已完成 {todayDoneCount} 项{todoCount > 0 ? ` · 剩余 ${todoCount}` : ""}
          </span>
        </div>
      </div>

      {/* 保护模式说明条 */}
      <AnimatePresence>
        {protectedToday && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden rounded-2xl border border-white/70 px-4 py-3 text-xs leading-relaxed"
            style={{ backgroundColor: "#fbe9e6", color: "#a04a41" }}
          >
            🛡 今天只保留了必须完成的任务，其余已顺延并平摊到后续天数。完成保底，就是胜利。
          </motion.p>
        )}
      </AnimatePresence>

      {/* 任务卡片列表（重排时平滑消失/加入） */}
      <motion.ul layout className="mt-5 space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {todayTasks.map((task) => {
            const meta = QUADRANT_META[task.quadrant];
            const done = task.status === "done";
            const remaining = remainingOf(task.id);
            return (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, x: 40 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={`flex items-start gap-3 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-xs ${
                  done ? "opacity-60" : ""
                } ${task.boosted && !done ? "border-amber-300/70" : ""}`}
                style={
                  task.boosted && !done
                    ? { boxShadow: "0 6px 24px -8px rgba(217,164,65,0.35)" }
                    : undefined
                }
              >
                {/* 打卡按钮 */}
                <button
                  type="button"
                  onClick={() => handleCheck(task)}
                  aria-label={done ? "取消完成" : "标记完成"}
                  className="mt-0.5 shrink-0 text-primary transition-transform hover:scale-110 active:scale-95"
                >
                  {done ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: meta.soft, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {task.boosted && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        ⚡ 加成
                      </span>
                    )}
                    {task.overdue && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        逾期带入
                      </span>
                    )}
                    {task.status === "inProgress" && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: "rgba(47,125,107,0.15)", color: "#2f7d6b" }}
                      >
                        进行中
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1.5 text-sm font-medium text-foreground ${
                      done ? "line-through" : ""
                    }`}
                  >
                    {task.title}
                  </p>
                  {remaining !== null && !done && (
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-primary">
                      ⏳ 剩余 {fmtSeconds(remaining)}
                    </p>
                  )}
                </div>

                {/* 标记「进行中」（完成一半） */}
                {!done && (
                  <button
                    type="button"
                    onClick={() => handleStart(task)}
                    aria-label={task.status === "inProgress" ? "取消进行中" : "标记进行中"}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
                    style={
                      task.status === "inProgress"
                        ? { backgroundColor: "#2f7d6b", color: "#fff" }
                        : { backgroundColor: "rgba(47,125,107,0.12)", color: "#2f7d6b" }
                    }
                  >
                    <Play className="h-3.5 w-3.5" />
                    {task.status === "inProgress" ? "进行中" : "标记进行中"}
                  </button>
                )}

                {/* 开始任务（番茄钟） */}
                {!done && remaining === null && (
                  <button
                    type="button"
                    onClick={() => start(task.id, task.title)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:opacity-80"
                  >
                    <Play className="h-3.5 w-3.5" />
                    开始任务
                  </button>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>

        {todayTasks.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-white/40 p-8 text-center text-sm text-muted-foreground">
            今天没有待办任务。去「任务规划」添加一个目标，或安心享受这一天。
          </li>
        )}
      </motion.ul>

      {/* 长期投资（重要不紧急）金色庆典 */}
      <CelebrationOverlay
        open={golden !== null}
        onClose={() => setGolden(null)}
        emoji="🧱"
        title="长期投资 · 达成"
        message={
          golden
            ? `「${golden}」——这件「重要不紧急」的事，是大多数人永远做不到的。你为未来的自己铺了一块砖。`
            : ""
        }
        golden
      />
    </motion.section>
  );
}
