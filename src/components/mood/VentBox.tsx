import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Feather, SendHorizonal } from "lucide-react";
import { getAgentReply } from "@/agents/config";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useEmotion } from "@/hooks/useEmotionTheme";
import { DiaryModal } from "@/components/mood/DiaryModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { appendDiary, readDiary, syncDiaryFromCloud, type DiaryEntry } from "@/lib/diary";

/**
 * 深夜倾诉树洞：无评判的文字输入区
 * 提交后：正文挂到最近心情记录 + 写入历史日记本（手机号隔离）+ 陪伴者温柔回应；
 * 「翻阅历史日记」一键打开沉浸式日记本（数据只留在应用内部，绝不下载）。
 */
export function VentBox() {
  const { addVent, entries, current } = useEmotion();
  const { proactive } = useAgentChat();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  /** 历史日记本 */
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);

  // 最近几条带倾诉正文的记录，展示「已安放的心事」
  const vents = entries.filter((e) => e.content).slice(0, 3);

  const openDiary = () => {
    setDiary(readDiary()); // 立即用本地渲染，保证无延迟
    void syncDiaryFromCloud().then(setDiary); // 再从云端合并（换设备/清缓存也能看到）
    setDiaryOpen(true);
  };

  const handleSubmit = () => {
    const content = text.trim();
    if (!content) return;
    addVent(content);
    // 实时写入历史日记本（手机号隔离，刷新后依然在）
    appendDiary(content);
    setDiary(readDiary());
    setText("");
    setSent(true);
    window.setTimeout(() => setSent(false), 4000);
    // 陪伴者温柔回应（关键词匹配语料库模拟，接模型后替换 getAgentReply 内部）
    const reply = getAgentReply("companion", {
      userText: content,
      mood: current?.id ?? null,
    });
    proactive("companion", reply);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="glass-card space-y-5 p-8"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground transition-colors duration-700">
          <Feather className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-foreground">深夜倾诉</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            把烦恼倒在这里，没有人会评判你。陪伴者会轻轻回应。
          </p>
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="今晚心里装着什么事？写下来的瞬间，它就轻了一点……"
        rows={4}
        className="resize-none rounded-2xl border-border/70 bg-white/80 leading-relaxed"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {sent ? "已安放好，陪伴者在回应你 🌙" : "只有你自己能看到这些内容"}
        </span>
        <div className="flex items-center gap-2">
          {/* 翻阅历史日记：一键打开，绝不下载 */}
          <Button
            type="button"
            variant="outline"
            onClick={openDiary}
            className="rounded-2xl border-primary/30 bg-white/70 text-primary hover:bg-accent"
          >
            <BookOpen className="mr-1.5 h-4 w-4" />
            翻阅历史日记
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="rounded-2xl"
          >
            <SendHorizonal className="mr-1.5 h-4 w-4" />
            放进树洞
          </Button>
        </div>
      </div>

      {/* 已安放的心事 */}
      {vents.length > 0 && (
        <div className="space-y-2 border-t border-border/50 pt-5">
          <p className="text-xs text-muted-foreground">最近安放的心事</p>
          {vents.map((v) => (
            <blockquote
              key={v.id}
              className="rounded-2xl bg-white/60 px-4 py-3 text-sm leading-relaxed text-foreground/85"
            >
              「{v.content}」
            </blockquote>
          ))}
        </div>
      )}

      {/* 历史日记本（沉浸式模态框） */}
      <DiaryModal
        open={diaryOpen}
        onClose={() => setDiaryOpen(false)}
        entries={diary}
      />
    </motion.section>
  );
}
