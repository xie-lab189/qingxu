import { useMemo } from "react";
import { motion } from "framer-motion";

/** 撒花纸片配色（治愈系） */
const COLORS = [
  "#f59e0b",
  "#60a5fa",
  "#a78bfa",
  "#f87171",
  "#34d399",
  "#f472b6",
  "#facc15",
  "#5b8dd9",
];

interface ConfettiProps {
  count?: number;
  /** 自定义配色（默认治愈系彩纸；金色庆典传入金色盘） */
  palette?: string[];
}

/** 轻量撒花特效：彩色纸片飘落（无需第三方库） */
export function Confetti({ count = 70, palette = COLORS }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        size: 6 + Math.random() * 8,
        color: palette[i % palette.length],
        delay: Math.random() * 0.5,
        duration: 2.6 + Math.random() * 2,
        drift: (Math.random() - 0.5) * 240,
        rotate: 180 + Math.random() * 540,
        round: Math.random() > 0.7,
      })),
    [count, palette]
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: -16,
            width: p.size,
            height: p.round ? p.size : p.size * 0.55,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : 2,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: "108vh",
            x: p.drift,
            rotate: p.rotate,
            opacity: [1, 1, 0.7, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
