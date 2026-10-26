/**
 * 青序 · 智能体对话状态管理
 *
 * 管理悬浮对话面板的开关、消息列表、智能体切换，
 * 并通过后端 /api/chat 代理调用真实大模型（System Prompt 见 src/agents/config.ts）。
 *
 * - 请求期间显示「对方正在输入…」Loading（typing）。
 * - 接口报错时以红色气泡提示（如 API Key 未配置 / 余额不足）。
 * - 主动弹窗（proactive）仍走本地语料，保证离线也能安抚。
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAgent, getSystemPrompt, companionGreeting, pick, type AgentId } from "@/agents/config";
import { callLLM, type LLMMessage } from "@/lib/llmClient";
import { genId } from "@/lib/storage";
import { dateKey, launchToday } from "@/lib/scheduler";
import { STORAGE_KEYS, type DailyTask, type MasterTask } from "@/types";

/** 四象限中文标签（注入规划师上下文用） */
const QUAD_LABEL: Record<string, string> = {
  IMPORTANT_URGENT: "重要且紧急",
  URGENT_NOT_IMPORTANT: "紧急不重要",
  IMPORTANT_NOT_URGENT: "重要不紧急",
  NOT_IMPORTANT_NOT_URGENT: "不重要不紧急",
};

/**
 * 实时读取用户当前真实的任务清单（masterTasks + dailyTasks），
 * 用 launchToday 算出今日任务，整理成规划师能直接用的背景文本。
 * 出错或为空时返回空串，调用方据此跳过注入。
 */
function buildPlannerTaskContext(): string {
  try {
    const masterTasks: MasterTask[] = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.masterTasks) || "[]"
    );
    const dailyTasks: DailyTask[] = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.dailyTasks) || "[]"
    );
    if (!Array.isArray(masterTasks) || !Array.isArray(dailyTasks)) return "";

    const today = dateKey();
    const { dailyTasks: computed } = launchToday(masterTasks, dailyTasks, today);
    const todays = computed.filter((t) => t.date === today);
    if (todays.length === 0) return "（用户当前没有已录入的任务清单）";

    const done = todays.filter((t) => t.status === "done");
    const todo = todays.filter((t) => t.status !== "done");
    const fmt = (t: DailyTask) =>
      `· ${t.title}${QUAD_LABEL[t.quadrant] ? ` [${QUAD_LABEL[t.quadrant]}]` : ""}` +
      `${t.status === "deferred" ? "（已顺延）" : t.overdue ? "（逾期带入）" : ""}`;

    const lines = [
      `今日任务共 ${todays.length} 项：已完成 ${done.length} 项，未完成 ${todo.length} 项。`,
      "【未完成】",
      ...(todo.length ? todo.map(fmt) : ["（无）"]),
      "【已完成】",
      ...(done.length ? done.map(fmt) : ["（无）"]),
    ];
    return lines.join("\n");
  } catch {
    return "";
  }
}

/** 携带给大模型的上下文轮数上限（最近约 8 条 = 4 轮对话） */
const MAX_CONTEXT_TURNS = 16;

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  agentId?: AgentId;
  text: string;
  createdAt: string;
  /** 是否为错误提示（红色系统气泡） */
  error?: boolean;
}

interface AgentChatContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeAgentId: AgentId;
  switchAgent: (id: AgentId) => void;
  messages: ChatMessage[];
  typing: boolean;
  /** 用户主动发消息（调用真实大模型） */
  send: (text: string) => void;
  /**
   * 主动触发：某个智能体不经用户询问直接发话（如安慰、督促），
   * 并自动弹出面板；面板关闭时累计未读数
   */
  proactive: (agentId: AgentId, text: string) => void;
  unread: number;
}

const AgentChatContext = createContext<AgentChatContextValue | null>(null);

/** 打字机每字间隔（毫秒） */
const TYPE_INTERVAL = 28;

export function AgentChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<AgentId>("companion");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  /** 每个智能体是否已在本会话打过招呼（避免切换时刷屏） */
  const greetedRef = useRef<Set<AgentId>>(new Set());
  /** 面板当前是否打开（供异步回调读取最新值） */
  const openRef = useRef(false);
  /** 请求进行中标记，防止重复发送 */
  const sendingRef = useRef(false);
  /** 打字机定时器，便于在下次发送前清理 */
  const typeTimerRef = useRef<number | null>(null);

  const setOpen = useCallback((next: boolean) => {
    openRef.current = next;
    setOpenState(next);
    if (next) setUnread(0);
  }, []);

  const clearTypeTimer = useCallback(() => {
    if (typeTimerRef.current !== null) {
      window.clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
  }, []);

  /** 延迟后以某智能体身份发出一条消息（用于主动弹窗 / 打招呼，走本地语料） */
  const agentSay = useCallback((agentId: AgentId, text: string, delay = 0) => {
    if (delay > 0) setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "agent",
          agentId,
          text,
          createdAt: new Date().toISOString(),
        },
      ]);
    }, delay);
  }, []);

  const switchAgent = useCallback(
    (id: AgentId) => {
      setActiveAgentId(id);
      if (!greetedRef.current.has(id)) {
        greetedRef.current.add(id);
        const greeting = id === "companion" ? companionGreeting() : pick(getAgent(id).corpus.greeting);
        agentSay(id, greeting, 600);
      }
    },
    [agentSay]
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return;
      if (sendingRef.current) return;

      sendingRef.current = true;
      clearTypeTimer();

      // 1) 先写入用户消息（共享会话，切换智能体仍可见历史）
      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        text: content,
        createdAt: new Date().toISOString(),
      };
      const history: ChatMessage[] = [...messages, userMsg];
      setMessages(history);

      // 2) 组装传给大模型的上下文（最近若干轮，含本次用户消息）
      const recent = history.slice(-MAX_CONTEXT_TURNS);
      const llmHistory: LLMMessage[] = recent.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      setTyping(true);
      try {
        // 规划师：注入用户当前真实任务清单作为背景，使其按实际计划拆解而非空谈
        const baseSystem = getSystemPrompt(activeAgentId);
        const systemPrompt =
          activeAgentId === "planner"
            ? `${baseSystem}\n\n【用户当前真实任务清单（实时读取，仅作背景参考，不要当成聊天内容复述）】\n${buildPlannerTaskContext()}`
            : baseSystem;

        const reply = await callLLM({
          systemPrompt,
          history: llmHistory,
        });

        // 3) 逐字打字机吐出（视觉上更自然）
        const id = genId();
        setMessages((prev) => [
          ...prev,
          {
            id,
            role: "agent",
            agentId: activeAgentId,
            text: "",
            createdAt: new Date().toISOString(),
          },
        ]);
        let i = 0;
        typeTimerRef.current = window.setInterval(() => {
          i += 1;
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, text: reply.slice(0, i) } : m))
          );
          if (i >= reply.length) {
            clearTypeTimer();
            sendingRef.current = false;
          }
        }, TYPE_INTERVAL);
      } catch (err) {
        // 4) 红色错误提示（服务端 Key 未配置 / 余额不足 / 网络断开等）
        const reason = err instanceof Error ? err.message : "未知错误";
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: "agent",
            agentId: activeAgentId,
            text: `⚠️ ${reason}`,
            createdAt: new Date().toISOString(),
            error: true,
          },
        ]);
        sendingRef.current = false;
      } finally {
        setTyping(false);
      }
    },
    [activeAgentId, messages, clearTypeTimer]
  );

  const proactive = useCallback(
    (agentId: AgentId, text: string) => {
      setActiveAgentId(agentId);
      greetedRef.current.add(agentId);
      if (!openRef.current) setUnread((n) => n + 1);
      agentSay(agentId, text, 600);
      setOpen(true);
    },
    [agentSay]
  );

  const value = useMemo(
    () => ({
      open,
      setOpen,
      activeAgentId,
      switchAgent,
      messages,
      typing,
      send,
      proactive,
      unread,
    }),
    [open, setOpen, activeAgentId, switchAgent, messages, typing, send, proactive, unread]
  );

  return (
    <AgentChatContext.Provider value={value}>
      {children}
    </AgentChatContext.Provider>
  );
}

export function useAgentChat(): AgentChatContextValue {
  const ctx = useContext(AgentChatContext);
  if (!ctx) throw new Error("useAgentChat 必须在 <AgentChatProvider> 内使用");
  return ctx;
}
