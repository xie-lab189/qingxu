import { motion } from "framer-motion";
import { ListTodo } from "lucide-react";
import { EnergyBar } from "@/components/tasks/EnergyBar";
import { TodayTodoList } from "@/components/tasks/TodayTodoList";
import { MasterTaskManager } from "@/components/tasks/MasterTaskManager";

/**
 * 任务规划页（v3 · 多任务并行版）
 * 今日待办（每日自动发布） + 多目标管理（录入一次，每天自动生成）
 */
export default function TasksPage() {
  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card space-y-5 p-8"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-colors duration-700">
            <ListTodo className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-wide">任务规划</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              录入目标后，规划师每天自动发布当日任务量；心情变化时，今日列表会实时重排。
            </p>
          </div>
        </div>
        <EnergyBar />
      </motion.section>

      {/* 今日待办（每天自动生成） */}
      <TodayTodoList />

      {/* 多目标并行管理 */}
      <MasterTaskManager />
    </div>
  );
}
