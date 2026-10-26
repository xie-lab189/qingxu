import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarCheck } from "lucide-react";
import { buildHeatmap } from "@/lib/stats";
import type { MoodEntry } from "@/types";

interface HeatmapCalendarProps {
  entries: MoodEntry[];
  weeks?: number;
}

const WEEKDAY_LABELS = ["一", "三", "五", "日"];

/** 打卡热力日历（GitHub 贡献图风格）：最近 N 周 */
export function HeatmapCalendar({ entries, weeks = 16 }: HeatmapCalendarProps) {
  const cells = useMemo(() => buildHeatmap(entries, weeks), [entries, weeks]);

  /** 按周切列 */
  const columns = useMemo(() => {
    const cols: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
    return cols;
  }, [cells]);

  const total = cells.length;
  const active = cells.filter((c) => c.count > 0).length;

  function intensity(count: number): string {
    if (count === 0) return "rgba(255,255,255,0.65)";
    if (count === 1) return "rgba(76, 130, 107, 0.32)";
    if (count === 2) return "rgba(76, 130, 107, 0.52)";
    if (count === 3) return "rgba(76, 130, 107, 0.72)";
    return "rgba(76, 130, 107, 0.95)";
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
      className="glass-card p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          打卡日历
        </h2>
        <span className="text-xs text-muted-foreground">
          最近 {total} 天打卡 {active} 天
        </span>
      </div>

      <div className="mt-5 flex gap-[5px] overflow-x-auto pb-1">
        {/* 星期标签列 */}
        <div className="flex flex-col gap-[5px] pr-1">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className="flex h-3.5 items-center text-[9px] leading-none text-muted-foreground"
              style={{ height: 14 }}
            >
              {WEEKDAY_LABELS.includes(
                ["一", "二", "三", "四", "五", "六", "日"][i]
              )
                ? ["一", "二", "三", "四", "五", "六", "日"][i]
                : ""}
            </span>
          ))}
        </div>
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[5px]">
            {Array.from({ length: 7 }, (_, wi) => {
              const cell = col[wi];
              if (!cell) return <span key={wi} style={{ width: 14, height: 14 }} />;
              return (
                <span
                  key={wi}
                  title={`${cell.date} · ${cell.count} 次记录`}
                  className="rounded-[4px] transition-transform hover:scale-125"
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: intensity(cell.count),
                    border: "1px solid rgba(255,255,255,0.7)",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div className="mt-4 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        少
        {[0, 1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: intensity(n) }}
          />
        ))}
        多
      </div>
    </motion.section>
  );
}
