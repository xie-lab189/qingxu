/**
 * 青序 · 情绪定义
 * 9 种情绪对象：每种情绪包含展示色、主题变量与专属治愈短句
 */

export type EmotionType =
  | "energized"
  | "calm"
  | "expectant"
  | "tired"
  | "anxious"
  | "stressed"
  | "low"
  | "lonely"
  | "irritable";

export interface EmotionMeta {
  id: EmotionType;
  /** 情绪名称 */
  label: string;
  /** emoji 图标 */
  emoji: string;
  /** 主色（hex），用于图标底色、强调元素 */
  color: string;
  /** 浅色调（hex），用于背景渐变、卡片 tint */
  soft: string;
  /**
   * shadcn 变量用 HSL 分量字符串（如 "32 95% 52%"），
   * 用于注入 --accent / --accent-foreground，实现全站主题平滑过渡
   */
  accentHsl: string;
  accentFgHsl: string;
  /** 专属治愈短句 */
  quote: string;
}

export const EMOTIONS: readonly EmotionMeta[] = [
  {
    id: "energized",
    label: "活力满满",
    emoji: "😄",
    color: "#f59e0b",
    soft: "#fef3e2",
    accentHsl: "32 95% 93%",
    accentFgHsl: "28 85% 38%",
    quote: "真好呀，把这份元气存进口袋，累了的时候可以偷偷取出来用。",
  },
  {
    id: "calm",
    label: "平静",
    emoji: "😌",
    color: "#60a5fa",
    soft: "#e8f1fe",
    accentHsl: "214 90% 94%",
    accentFgHsl: "214 80% 42%",
    quote: "此刻的风很轻，你也刚刚好。什么都不用赶，按自己的节奏来。",
  },
  {
    id: "expectant",
    label: "期待",
    emoji: "🤩",
    color: "#a78bfa",
    soft: "#f1ecfe",
    accentHsl: "258 85% 95%",
    accentFgHsl: "258 60% 48%",
    quote: "期待是心里亮起的一盏小灯，照亮前面的路。慢慢走，灯一直都在。",
  },
  {
    id: "tired",
    label: "疲惫",
    emoji: "🥱",
    color: "#9ca3af",
    soft: "#f1f2f4",
    accentHsl: "220 10% 93%",
    accentFgHsl: "220 8% 40%",
    quote: "辛苦啦。疲惫不是软弱，是身体在轻声提醒你：该歇一歇了。",
  },
  {
    id: "anxious",
    label: "焦虑",
    emoji: "😰",
    color: "#eab308",
    soft: "#fef9e0",
    accentHsl: "50 90% 94%",
    accentFgHsl: "42 85% 35%",
    quote: "深呼吸，慢慢来。担心的事十件里有九件不会发生，先照顾好此刻的自己。",
  },
  {
    id: "stressed",
    label: "压力大",
    emoji: "🤯",
    color: "#ef4444",
    soft: "#feeaea",
    accentHsl: "0 85% 95%",
    accentFgHsl: "0 70% 45%",
    quote: "压力太大的时候，把任务拆成小小的一步就好，你不需要一次扛起所有。",
  },
  {
    id: "low",
    label: "低落",
    emoji: "😔",
    color: "#3b62b5",
    soft: "#e6ecf7",
    accentHsl: "220 50% 94%",
    accentFgHsl: "220 50% 40%",
    quote: "情绪低落的时候，允许自己慢下来。阴天也会过去，你不会一直如此。",
  },
  {
    id: "lonely",
    label: "孤独",
    emoji: "🫠",
    color: "#cbd5e1",
    soft: "#f4f6f8",
    accentHsl: "214 25% 94%",
    accentFgHsl: "214 15% 45%",
    quote: "孤独的时候，记得树洞一直都在。你说话，我们就听着，不评判。",
  },
  {
    id: "irritable",
    label: "烦躁",
    emoji: "😫",
    color: "#b08968",
    soft: "#f3ebe3",
    accentHsl: "28 40% 93%",
    accentFgHsl: "25 40% 38%",
    quote: "心里毛躁的话，先喝口水、深呼吸三次。情绪像天气，来了也会走的。",
  },
] as const;

/** 按 id 查找情绪元数据 */
export function getEmotion(id: EmotionType): EmotionMeta {
  const found = EMOTIONS.find((e) => e.id === id);
  if (!found) throw new Error(`[emotions] 未知情绪: ${id}`);
  return found;
}
