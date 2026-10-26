import { useEffect, useRef } from "react";
import { COMFORT_MOODS, comfortReplyFor, nudgeReply } from "@/agents/config";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useEmotion } from "@/hooks/useEmotionTheme";

/**
 * 智能体主动触发逻辑（无 UI，挂在 Provider 内）
 *
 * 规则：
 * 1. 用户刚记录了负面情绪 → 陪伴者自动弹出安慰
 * 2. 长期未打卡（今天没有记录） → 督促官提醒一次（每次会话仅一次）
 */
export function AgentTriggers() {
  const { latestEntry, entries } = useEmotion();
  const { proactive } = useAgentChat();
  /** 已处理过的心情记录 id，避免重复触发 */
  const handledEntryRef = useRef<string | null>(null);
  /** 督促提醒每次会话只触发一次 */
  const nudgedRef = useRef(false);

  /* 触发一：记录负面情绪 → 陪伴者安慰弹窗 */
  useEffect(() => {
    if (!latestEntry || latestEntry.id === handledEntryRef.current) return;
    handledEntryRef.current = latestEntry.id;
    if (COMFORT_MOODS.includes(latestEntry.emotion)) {
      proactive("companion", comfortReplyFor(latestEntry.emotion));
    }
  }, [latestEntry, proactive]);

  /* 触发二：进入应用时检查打卡状态 → 督促官提醒 */
  useEffect(() => {
    if (nudgedRef.current) return;
    const last = entries[0];
    const today = new Date().toDateString();
    if (!last) {
      // 从未打卡
      nudgedRef.current = true;
      proactive(
        "supervisor",
        "嘿，新来的吧？我可是全勤监督员！从今天就养成打卡的习惯，先记录一下此刻的心情如何？"
      );
      return;
    }
    if (new Date(last.createdAt).toDateString() !== today) {
      const days = Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(last.createdAt).getTime()) / 86400000
        )
      );
      nudgedRef.current = true;
      proactive("supervisor", nudgeReply(days));
    }
  }, [entries, proactive]);

  return null;
}
