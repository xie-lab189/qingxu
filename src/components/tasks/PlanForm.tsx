import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarPlus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PlanFormProps {
  /** 一键生成：系统在后台自动拆解、量化并四象限排期 */
  onGenerate: (name: string, days: number) => void;
}

/**
 * 任务输入表单（一键生成版）
 * 用户只需输入总任务 + 天数；数字识别、每日额度计算、
 * 子任务拆解与四象限归类全部由 parseTaskAndCalculate 在后台完成。
 */
export function PlanForm({ onGenerate }: PlanFormProps) {
  const [name, setName] = useState("");
  const [days, setDays] = useState("7");

  const daysNum = Math.min(Math.max(parseInt(days, 10) || 0, 1), 30);
  const valid = name.trim().length > 0 && daysNum >= 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onGenerate(name.trim(), daysNum);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      onSubmit={handleSubmit}
      className="glass-card space-y-5 p-8"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-colors duration-700">
          <CalendarPlus className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-foreground">定一个小目标</h2>
          <p className="text-xs text-muted-foreground">
            输入总任务和天数，规划师自动拆解、量化到每一天
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-name" className="text-sm text-foreground">
          总任务名称
        </Label>
        <Input
          id="plan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="带数量更好：背1000个单词 / 刷完300道题；也可以写：写一篇论文"
          className="rounded-2xl border-border/70 bg-white/80"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          识别到数字时会自动计算每日额度（如 1000 个单词 ÷ 10 天 = 每天 100 个）；
          无数值时自动拆解为「查文献 → 列大纲 → 写初稿…」等阶段任务并智能排期。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-days" className="text-sm text-foreground">
          完成天数（1–30 天）
        </Label>
        <Input
          id="plan-days"
          type="number"
          min={1}
          max={30}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="rounded-2xl border-border/70 bg-white/80"
        />
      </div>

      <Button
        type="submit"
        disabled={!valid}
        className="w-full rounded-2xl py-6 text-base"
      >
        <Wand2 className="mr-2 h-4 w-4" />
        生成我的学习计划
      </Button>
    </motion.form>
  );
}
