import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, MoonStar, X } from "lucide-react";
import {
  formatDayLabel,
  groupDiaryByDay,
  type DiaryEntry,
} from "@/lib/diary";

interface DiaryModalProps {
  open: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
}

/**
 * 历史日记本 · 沉浸式模态框
 * - 时间倒序 + 按天分组（醒目标题）+ 虚线分隔 + 充足留白
 * - 呼吸感：条目错落淡入；优雅关闭按钮；绝不下载、绝不跳转
 */
export function DiaryModal({ open, onClose, entries }: DiaryModalProps) {
  const groups = groupDiaryByDay(entries);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[75] flex items-end justify-center bg-foreground/25 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card flex h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl sm:h-[70vh] sm:rounded-3xl"
          >
            {/* 头部 */}
            <div className="relative flex items-center gap-3 border-b border-border/50 px-7 pb-5 pt-6">
              <motion.span
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 3.6, ease: "easeInOut" }}
              >
                <BookOpen className="h-5 w-5" />
              </motion.span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">历史日记</h2>
                <p className="text-xs text-muted-foreground">
                  {entries.length > 0
                    ? `共 ${entries.length} 篇心事，按天翻阅`
                    : "你的深夜树洞"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭日记本"
                className="absolute right-5 top-5 rounded-full bg-white/70 p-2 text-muted-foreground shadow-xs transition-all hover:scale-105 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 日记正文（可滚动） */}
            <div className="flex-1 overflow-y-auto px-7 py-6">
              {groups.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex h-full flex-col items-center justify-center gap-3 text-center"
                >
                  <MoonStar className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    还没有写下过心事，今天想对我说些什么吗？
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-8">
                  {groups.map((group, gi) => (
                    <section key={group.day}>
                      {/* 日期大标题 */}
                      <motion.h3
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: gi * 0.06 }}
                        className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground"
                      >
                        <span className="h-px w-4 bg-primary/50" />
                        {formatDayLabel(group.day)}
                      </motion.h3>

                      <div className="mt-3 space-y-1">
                        {group.items.map((item, ii) => (
                          <motion.blockquote
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: gi * 0.06 + ii * 0.05 }}
                            className={`px-2 py-4 ${
                              ii > 0 ? "border-t border-dashed border-border/70" : ""
                            }`}
                          >
                            <p className="text-sm leading-loose text-foreground/85">
                              「{item.content}」
                            </p>
                            <footer className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                              {item.date.slice(11)}
                            </footer>
                          </motion.blockquote>
                        ))}
                      </div>
                    </section>
                  ))}
                  <p className="pb-4 pt-2 text-center text-[11px] text-muted-foreground">
                    · 这些心事只保存在你的应用里，随时可以回来看 ·
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
