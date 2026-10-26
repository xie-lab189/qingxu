import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { buildMoodTrend } from "@/lib/stats";
import type { MoodEntry } from "@/types";

interface MoodTrendChartProps {
  entries: MoodEntry[];
}

const PRIMARY = "hsl(158, 30%, 40%)";

/** 心情趋势折线图：过去 7 天 / 30 天 */
export function MoodTrendChart({ entries }: MoodTrendChartProps) {
  const [days, setDays] = useState<7 | 30>(7);
  const data = useMemo(() => buildMoodTrend(entries, days), [entries, days]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          心情趋势
        </h2>
        {/* 7 天 / 30 天切换 */}
        <div className="flex rounded-xl bg-white/60 p-1 shadow-xs">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors duration-300 ${
                days === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              近 {d} 天
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64">
        {data.every((p) => p.score === null) ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            这段时间还没有心情记录，去树洞留下第一笔吧
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(120,140,130,0.18)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#8a968f" }}
                tickLine={false}
                axisLine={false}
                interval={days === 30 ? 4 : 0}
              />
              <YAxis
                domain={[0, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 11, fill: "#8a968f" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.92)",
                  boxShadow: "0 8px 24px -8px rgba(90,120,105,0.25)",
                  fontSize: 12,
                }}
                formatter={(value, _name, item) => [
                  typeof value === "number"
                    ? `${value} 分（${item.payload.count} 次）`
                    : "无记录",
                  "心情均值",
                ]}
                labelStyle={{ color: "#3d4a43", fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={PRIMARY}
                strokeWidth={2.5}
                fill="url(#moodFill)"
                connectNulls={false}
                dot={{ r: 3, fill: PRIMARY, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: PRIMARY, strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        1 分最低落 · 5 分最愉悦 · 同一天多次记录取平均值
      </p>
    </motion.section>
  );
}
