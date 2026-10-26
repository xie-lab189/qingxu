/**
 * 青序 · 情绪治愈短句（兼容桥接层）
 *
 * 数据已迁移至独立数据源 src/data/moodSentences.ts（唯一权威）。
 * 本文件仅做 re-export 与键名兼容：
 *   - 新字典使用键名 `down`（更贴合语义）；
 *   - 历史代码（如 EmotionQuote）与 EmotionType 使用键名 `low`；
 *   - 这里把 `down` 数组同时挂到 `low`，保证现有业务代码零改动。
 *
 * ⚠️ 业务方请勿在本文件直接增删短句，所有语料请维护在 src/data/moodSentences.ts。
 */
import type { EmotionType } from "@/types";
import { moodSentences } from "@/data/moodSentences";

export const MOOD_SENTENCES = {
  ...moodSentences,
  // 兼容历史键名：low === down
  low: moodSentences.down,
} as unknown as Record<EmotionType, string[]>;
