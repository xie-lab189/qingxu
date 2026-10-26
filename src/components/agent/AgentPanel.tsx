import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleHeart, SendHorizonal, X } from "lucide-react";
import { AGENTS, getAgent } from "@/agents/config";
import { useAgentChat } from "@/hooks/useAgentChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 智能体悬浮对话面板（右下角）
 * 三个智能体共用一个面板组件，切换时头部主题色与人设语料随之变化
 */
export function AgentPanel() {
  const {
    open,
    setOpen,
    activeAgentId,
    switchAgent,
    messages,
    typing,
    send,
    unread,
  } = useAgentChat();
  const agent = getAgent(activeAgentId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  /* 新消息 / 打字状态时自动滚到底部 */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(draft);
    setDraft("");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {/* 对话面板 */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="agent-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex h-[520px] w-[calc(100vw-3rem)] max-w-[380px] flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-soft-lg backdrop-blur-xl"
          >
            {/* 头部：当前智能体人设 */}
            <div
              className="border-b border-white/60 px-5 pb-4 pt-5 transition-colors duration-700"
              style={{
                background: `linear-gradient(140deg, ${agent.soft} 0%, rgba(255,255,255,0.4) 100%)`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <motion.span
                    key={agent.id}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl"
                  >
                    {agent.emoji}
                  </motion.span>
                  <div>
                    <p className="font-semibold text-foreground">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.tagline}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="收起对话"
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 智能体切换：三人共用此面板 */}
              <div className="mt-4 flex gap-1.5">
                {AGENTS.map((a) => {
                  const active = a.id === activeAgentId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => switchAgent(a.id)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-xs transition-all duration-300 ${
                        active
                          ? "border-transparent font-medium text-white shadow-xs"
                          : "border-border/70 bg-white/60 text-muted-foreground hover:text-foreground"
                      }`}
                      style={active ? { backgroundColor: a.color } : undefined}
                    >
                      <span>{a.emoji}</span>
                      <span className="hidden sm:inline">{a.name.slice(3)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 消息流 */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            >
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <span className="text-3xl">{agent.emoji}</span>
                  <p className="text-sm text-muted-foreground">
                    和{agent.name.slice(3)}说点什么吧，
                    <br />
                    {agent.traits.join("·")}的那种。
                  </p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const isError = msg.error === true;
                  const speaker = msg.agentId
                    ? getAgent(msg.agentId)
                    : agent;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : isError
                            ? "rounded-bl-md border border-red-300 bg-red-50 text-red-600 shadow-xs"
                            : "rounded-bl-md border border-white/70 bg-white/80 text-foreground shadow-xs"
                        }`}
                        style={
                          !isUser && !isError
                            ? { borderLeftColor: `${speaker.color}66` }
                            : undefined
                        }
                      >
                        {!isUser && (
                          <p
                            className="mb-1 text-[11px] font-medium"
                            style={{ color: isError ? "#dc2626" : speaker.color }}
                          >
                            {isError ? "⚠️ 系统提示" : speaker.name}
                          </p>
                        )}
                        {msg.text}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* 打字中指示 */}
              {typing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/70 bg-white/80 px-4 py-3 shadow-xs">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: agent.color }}
                        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.1,
                          delay: i * 0.18,
                        }}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground">
                      对方正在输入…
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* 输入区 */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-border/60 bg-white/60 px-3 py-3"
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`对${agent.name.slice(3)}说点什么…`}
                className="rounded-2xl border-border/70 bg-white/80"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!draft.trim()}
                className="h-10 w-10 shrink-0 rounded-2xl"
                style={{ backgroundColor: agent.color }}
              >
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 悬浮入口按钮 */}
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={open ? "收起智能体面板" : "打开智能体面板"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft-lg transition-colors duration-700"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircleHeart className="h-6 w-6" />
        )}
        {/* 未读小红点 */}
        {!open && unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </motion.span>
        )}
        {/* 未打开时的呼吸光晕，提示有智能体在 */}
        {!open && (
          <span className="absolute inset-0 -z-10 animate-breathe rounded-full bg-primary/40 blur-md" />
        )}
      </motion.button>
    </div>
  );
}
