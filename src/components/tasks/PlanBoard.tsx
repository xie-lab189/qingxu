import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Play,
  RefreshCcw,
  Shield,
  Sprout,
  Zap,
} from "lucide-react";
import { PomodoroTimer } from "./PomodoroTimer";
import { currentDayIndex, planProgress, renderDailyTodoList } from "@/lib/planUtils";
import {
  EFFORT_META,
  QUADRANT_META,
  type PlanTask,
  type StudyPlan,
} from "@/types";

interface PlanBoardProps {
  plan: StudyPlan;
  onCheck: (taskId: string, done: boolean) => void;
  onTimerComplete: (taskId: string) => void;
  onReset: () => void;
}

/**
 * 计划执行区（v2 · 四象限调度版）
 * - 每日列表严格按 重要且紧急 > 紧急不重要 > 重要不紧急 > 不重要不紧急 排序
 * - Q2 任务带「长期投资」角标；保护模式呈现轻量感；能量加成单独分组
 */
export function PlanBoard({ plan, onCheck, onTimerComplete, onReset }: PlanBoardProps) {
  const today = currentDayIndex(plan);
  const [selectedDay, setSelectedDay] = useState(today);
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const { done, total, pct } = planProgress(plan);

  const protectedToday = (plan.protectedDays ?? []).includes(selectedDay);

  // 当日视图：能量加成推荐置顶分组 + 主列表（renderDailyTodoList 按象限优先级排序）
  const dayTasks = renderDailyTodoList(plan, selectedDay);
  const boostedTasks = dayTasks.filter((t) => t.boosted && t.status !== "done");
  const normalTasks = dayTasks.filter((t) => !t.boosted || t.status === "done");
  const allDone =
    plan.tasks.length > 0 &&
    plan.tasks.every((t) => t.status === "done" || t.status === "deferred");

  return (
    <div className="space-y-6">
      {/* 进度总览 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card space-y-4 p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{plan.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              共 {plan.totalDays} 天 · 已完成 {done} / {total} 个任务
              {(plan.protectedDays?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  <Shield className="h-3 w-3" /> 保护模式 {plan.protectedDays!.length} 次
                </span>
              )}
              {(plan.boostedDays?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  <Zap className="h-3 w-3" /> 能量加成 {plan.boostedDays!.length} 次
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:opacity-80"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            重新制定计划
          </button>
        </div>

        {/* 进度条 */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>总进度</span>
            <span className="font-medium text-foreground">{pct}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {allDone && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground"
          >
            🎉 这份计划的所有任务都完成了！你真的做到了，好好奖励自己一下吧。
          </motion.p>
        )}
      </motion.section>

      {/* 日期选择 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: plan.totalDays }, (_, i) => i + 1).map((day) => {
          const active = day === selectedDay;
          const isToday = day === today;
          const isProtected = (plan.protectedDays ?? []).includes(day);
          const isBoosted = (plan.boostedDays ?? []).includes(day);
          const dayTasksRaw = plan.tasks.filter((t) => t.dayIndex === day && t.status !== "deferred");
          const dayDone =
            dayTasksRaw.length > 0 && dayTasksRaw.every((t) => t.status === "done");
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`relative shrink-0 rounded-2xl border px-4 py-2.5 text-sm transition-all duration-300 ${
                active
                  ? "border-transparent bg-primary font-medium text-primary-foreground shadow-soft"
                  : "border-border/70 bg-white/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                第 {day} 天
                {isProtected && <Shield className="h-3 w-3" />}
                {isBoosted && <Zap className="h-3 w-3" />}
              </span>
              {isToday && !active && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
              )}
              {dayDone && (
                <CheckCircle2
                  className={`absolute -right-1.5 -top-1.5 h-4 w-4 ${
                    active ? "text-primary-foreground" : "text-primary"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 保护模式横幅 + 轻量感列表 */}
      <motion.div
        layout
        className={`origin-top transition-all duration-700 ${
          protectedToday ? "scale-[0.98] opacity-95" : ""
        }`}
      >
        {protectedToday && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-3 rounded-2xl border border-white/70 px-5 py-4"
            style={{ backgroundColor: "#fbe9e6" }}
          >
            <Shield className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#d96a5f" }} />
            <p className="text-sm leading-relaxed" style={{ color: "#a04a41" }}>
              🛡 保护模式已开启：今天只保留必须完成的【重要且紧急】和【紧急不重要】任务，其余已顺延平摊到后续天数。完成保底，就是胜利。
            </p>
          </motion.div>
        )}

        {/* 能量加成推荐组 */}
        {boostedTasks.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <Zap className="h-3.5 w-3.5" /> 能量加成推荐 · 完成有额外奖励
            </p>
            <ul className="space-y-3">
              {boostedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  timerOpen={timerTaskId === task.id}
                  onToggleTimer={() =>
                    setTimerTaskId((id) => (id === task.id ? null : task.id))
                  }
                  onCheck={(d) => onCheck(task.id, d)}
                  onTimerComplete={() => {
                    setTimerTaskId(null);
                    onTimerComplete(task.id);
                  }}
                  boostedGroup
                />
              ))}
            </ul>
          </div>
        )}

        {/* 主任务列表（象限优先级排序） */}
        <motion.ul layout className="space-y-3">
          <AnimatePresence initial={false}>
            {normalTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                timerOpen={timerTaskId === task.id}
                onToggleTimer={() =>
                  setTimerTaskId((id) => (id === task.id ? null : task.id))
                }
                onCheck={(d) => onCheck(task.id, d)}
                onTimerComplete={() => {
                  setTimerTaskId(null);
                  onTimerComplete(task.id);
                }}
              />
            ))}
          </AnimatePresence>
          {dayTasks.length === 0 && (
            <li className="glass-card p-8 text-center text-sm text-muted-foreground">
              这一天没有安排任务，休息也是计划的一部分。
            </li>
          )}
        </motion.ul>
      </motion.div>
    </div>
  );
}

/* ---------------- 单条任务 ---------------- */

interface TaskRowProps {
  task: PlanTask;
  timerOpen: boolean;
  onToggleTimer: () => void;
  onCheck: (done: boolean) => void;
  onTimerComplete: () => void;
  /** 是否来自能量加成推荐组 */
  boostedGroup?: boolean;
}

function TaskRow({ task, timerOpen, onToggleTimer, onCheck, onTimerComplete, boostedGroup }: TaskRowProps) {
  const done = task.status === "done";
  const deferred = task.status === "deferred";
  const quadrant = QUADRANT_META[task.quadrant];
  const effort = EFFORT_META[task.effort];
  const isInvest = task.quadrant === "IMPORTANT_NOT_URGENT";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`glass-card p-5 ${deferred ? "opacity-55" : ""} ${
        boostedGroup && !done ? "border-amber-300/60" : ""
      }`}
      style={boostedGroup && !done ? { boxShadow: "0 6px 24px -8px rgba(217,164,65,0.35)" } : undefined}
    >
      <div className="flex items-start gap-3">
        {/* 直接打卡 */}
        <button
          type="button"
          onClick={() => onCheck(!done)}
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
          {/* 第一行：象限 + 精力 + 角标 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: quadrant.soft, color: quadrant.color }}
            >
              {quadrant.label}
            </span>
            <span className="flex items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
              <Zap className="h-2.5 w-2.5" />
              精力{effort.label} · {task.minutes}分钟
            </span>
            {isInvest && !done && (
              <span className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#faf0dc", color: "#b07d1e" }}>
                <Sprout className="h-2.5 w-2.5" /> 长期投资
              </span>
            )}
            {task.boosted && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                ⚡ 加成推荐
              </span>
            )}
            {deferred && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                已顺延
              </span>
            )}
          </div>

          {/* 第二行：标题 */}
          <p
            className={`mt-1.5 text-sm font-medium text-foreground ${
              done ? "line-through opacity-60" : ""
            }`}
          >
            {task.title}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {done && task.completedBy === "timer" && <span>番茄钟完成</span>}
            {done && task.completedBy === "check" && <span>打卡完成</span>}
          </p>
        </div>

        {/* 开始计时 */}
        {!done && !deferred && (
          <button
            type="button"
            onClick={onToggleTimer}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              timerOpen
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-secondary-foreground hover:opacity-80"
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            {timerOpen ? "计时中" : "开始计时"}
          </button>
        )}
      </div>

      {/* 番茄钟 */}
      <AnimatePresence>
        {timerOpen && !done && (
          <PomodoroTimer
            minutes={task.minutes}
            onComplete={onTimerComplete}
            onCancel={onToggleTimer}
          />
        )}
      </AnimatePresence>
    </motion.li>
  );
}
