/**
 * 青序 · 「次日待办」站内提醒（邮件兜底方案）
 *
 * 作用：当用户隔天（或更久）再次打开青序时，若历史有未完成的每日任务，
 * 从底部滑出一张温和的提醒卡片，告知「还有 N 条待办没做完，今天继续」。
 * 不依赖任何邮件 / 外部账号，作为每晚 20:00 邮件提醒的站内兜底。
 *
 * - 每天最多提示一次（按本地日期去重，且可手动关闭）；
 * - 同一天内反复刷新不会重复打扰；
 * - 首次打开（无历史访问记录）不提示。
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { readAll } from "@/lib/storage";
import { STORAGE_KEYS, type DailyTask } from "@/types";

/** 最近一次访问日期（本地 YYYY-MM-DD） */
const LAST_VISIT_KEY = "qingxu.lastVisitDate";
/** 按天记录的「已关闭」标记，避免同一天反复弹出 */
const DISMISS_KEY_PREFIX = "qingxu.ndr.dismiss.";

/** 取本地日期字符串（避免 toISOString 的 UTC 偏移问题） */
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 计算与上次访问相差的天数，返回友好的中文描述 */
function gapText(last: string, today: string): string {
  const a = new Date(`${last}T00:00:00`);
  const b = new Date(`${today}T00:00:00`);
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (diff <= 1) return "昨天";
  if (diff <= 2) return "前天";
  return `${diff} 天前`;
}

export function NextDayReminder({ onGoTasks }: { onGoTasks?: () => void }) {
  const [unfinished, setUnfinished] = useState<number | null>(null);
  const [gap, setGap] = useState<string>("");

  useEffect(() => {
    try {
      const today = todayStr();
      const last = localStorage.getItem(LAST_VISIT_KEY) || "";

      // 仅当存在「早于今天」的上一次访问记录时才考虑提示
      if (last && last < today) {
        const tasks = readAll<DailyTask>(STORAGE_KEYS.dailyTasks);
        const left = tasks.filter(
          (t) => t.status !== "done" && t.date < today
        ).length;
        const dismissed = localStorage.getItem(DISMISS_KEY_PREFIX + today);
        if (left > 0 && !dismissed) {
          setUnfinished(left);
          setGap(gapText(last, today));
        }
      }

      // 无论是否提示，都刷新「最近访问日期」为今天
      localStorage.setItem(LAST_VISIT_KEY, today);
    } catch {
      /* 读取失败则静默跳过，绝不影响主流程 */
    }
  }, []);

  const close = () => {
    if (unfinished !== null) {
      localStorage.setItem(DISMISS_KEY_PREFIX + todayStr(), "1");
    }
    setUnfinished(null);
  };

  return (
    <AnimatePresence>
      {unfinished !== null && (
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="fixed bottom-24 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2"
        >
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-xl shadow-amber-900/5">
            <button
              onClick={close}
              aria-label="关闭提醒"
              className="absolute right-3 top-3 rounded-full p-1 text-amber-500/70 transition hover:bg-amber-100 hover:text-amber-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  你 {gap} 还有 {unfinished} 条待办没完成
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700/90">
                  新的一天，慢慢来。先把保底的「重要且紧急」做完就是胜利，其余的我们接着排。
                </p>
                <button
                  onClick={() => {
                    onGoTasks?.();
                    close();
                  }}
                  className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-amber-600"
                >
                  去处理待办
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
