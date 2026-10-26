import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ListPlus, Plus, X } from "lucide-react";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useScheduler } from "@/hooks/useScheduler";
import { getCurrentUser } from "@/lib/profileService";
import { requestEmailPrompt } from "@/lib/emailGate";
import { addDays } from "@/lib/scheduler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUADRANT_META, QUADRANT_ORDER, type Quadrant } from "@/types";

/**
 * 多任务管理器（MasterTaskManager）
 * 支持并行录入多个主任务（六级备考 / 期末论文 / 健身打卡），
 * 每个任务自动解析数量、归类四象限，并每天自动发布当日卡片。
 */
export function MasterTaskManager() {
  const { masterTasks, taskProgress, addMasterTask, archiveMasterTask } =
    useScheduler();
  const { proactive } = useAgentChat();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState("7");
  /** 四象限：由用户亲自选择（AI 不擅自决定），必选 */
  const [quadrant, setQuadrant] = useState<Quadrant | "">("");

  const active = masterTasks.filter((m) => !m.archived);
  const daysNum = Math.min(Math.max(parseInt(days, 10) || 0, 1), 30);
  const valid = name.trim().length > 0 && daysNum >= 1 && quadrant !== "";

  const handleAdd = () => {
    if (!valid) return;
    // 方案 A：首次建任务且尚未填写邮箱 → 引导填写（不阻塞建任务）
    if (!getCurrentUser()?.qqEmail) requestEmailPrompt();
    const { brief } = addMasterTask(name.trim(), daysNum, quadrant);
    proactive("planner", brief);
    setName("");
    setQuadrant("");
    setOpen(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
      className="glass-card p-7"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <ListPlus className="h-4 w-4 text-muted-foreground" />
            我的目标
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            录入一次，永久保存；系统每天自动发布当日任务量
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="rounded-2xl"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {open ? "" : "添加任务"}
        </Button>
      </div>

      {/* 添加任务表单 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-white/50 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="mt-name" className="text-xs text-foreground">
                  任务名称
                </Label>
                <Input
                  id="mt-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：背1000个单词 / 写一篇论文 / 期末高数复习"
                  className="rounded-xl border-border/70 bg-white/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mt-days" className="text-xs text-foreground">
                  完成天数（1–30）
                </Label>
                <Input
                  id="mt-days"
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="rounded-xl border-border/70 bg-white/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">
                  四象限分类（由你决定，必选）
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {QUADRANT_ORDER.map((q) => {
                    const meta = QUADRANT_META[q];
                    const selected = quadrant === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuadrant(q)}
                        aria-pressed={selected}
                        className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-all duration-300 ${
                          selected
                            ? "font-semibold"
                            : "border-border/70 bg-white/70 opacity-75 hover:opacity-100"
                        }`}
                        style={
                          selected
                            ? {
                                backgroundColor: meta.soft,
                                borderColor: meta.color,
                                color: meta.color,
                                boxShadow: `0 4px 16px -6px ${meta.color}66`,
                              }
                            : undefined
                        }
                      >
                        {meta.label}
                        <span className="mt-0.5 block text-[10px] font-normal opacity-80">
                          {meta.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                type="button"
                disabled={!valid}
                onClick={handleAdd}
                className="w-full rounded-xl"
              >
                <Plus className="mr-1.5 h-4 w-4" /> 添加并生成每日计划
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主任务列表 */}
      <ul className="mt-5 space-y-3">
        <AnimatePresence initial={false}>
          {active.map((m) => {
            const p = taskProgress(m);
            const meta = QUADRANT_META[m.quadrant];
            const endDate = addDays(m.startDate, m.totalDays - 1);
            return (
              <motion.li
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="rounded-2xl border border-white/70 bg-white/80 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: meta.soft, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {m.totalAmount && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                          每日约 {m.dailyBase} 个{m.unit} · 共 {m.totalAmount} 个
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-sm font-medium text-foreground">
                      {m.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {m.startDate} ~ {endDate} · 共 {m.totalDays} 天
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => archiveMasterTask(m.id)}
                    aria-label="归档任务"
                    className="shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
                {/* 进度条 */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {m.totalAmount ? "完成量" : "完成天数"}
                    </span>
                    <span className="font-medium text-foreground">
                      {p.done} / {p.total}（{p.pct}%）
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: meta.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${p.pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>

        {active.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-white/40 p-8 text-center text-sm text-muted-foreground">
            还没有目标。点击右上角「添加任务」，比如：六级备考、期末论文、健身打卡——可以并行进行。
          </li>
        )}
      </ul>
    </motion.section>
  );
}
