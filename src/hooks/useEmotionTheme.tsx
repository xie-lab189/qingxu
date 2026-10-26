/**
 * 青序 · 情绪主题状态管理
 *
 * 职责：
 * 1. 维护「当前情绪」全局状态，并把情绪色彩注入 CSS 变量，驱动全站主题平滑过渡
 * 2. 选择情绪时写入 localStorage（moods 记录 + lastEmotion 主题恢复）
 * 3. 提供最近心情记录列表（供树洞页、工作台展示）
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createItem, readAll, updateItem } from "@/lib/storage";
import { REPLAN_EVENT } from "@/lib/scheduler";
import {
  EMOTIONS,
  STORAGE_KEYS,
  getEmotion,
  type EmotionMeta,
  type EmotionType,
  type MoodEntry,
} from "@/types";

/** 过滤掉情绪字段非法的历史记录（如旧版本数据结构），保证读取安全 */
function sanitizeEntries(): MoodEntry[] {
  const valid = new Set<string>(EMOTIONS.map((e) => e.id));
  return readAll<MoodEntry>(STORAGE_KEYS.moods).filter(
    (e) => e && valid.has(e.emotion as string)
  );
}

/* ---------- CSS 变量注入 ---------- */

/** 把情绪色彩写入 :root，配合 index.css 中的 transition 实现平滑换色 */
function applyThemeVars(emotion: EmotionMeta | null) {
  const root = document.documentElement;
  if (!emotion) {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-foreground");
    root.style.removeProperty("--mood-accent");
    root.style.removeProperty("--mood-soft");
    return;
  }
  root.style.setProperty("--accent", emotion.accentHsl);
  root.style.setProperty("--accent-foreground", emotion.accentFgHsl);
  root.style.setProperty("--mood-accent", emotion.color);
  root.style.setProperty("--mood-soft", emotion.soft);
}

/* ---------- Context 定义 ---------- */

interface EmotionContextValue {
  /** 当前生效的情绪（null = 默认治愈绿主题） */
  current: EmotionMeta | null;
  /** 最近一次选择产生的记录（驱动治愈短句展示，切换/关闭后可能为 null） */
  latestEntry: MoodEntry | null;
  /** 全部心情记录（新→旧） */
  entries: MoodEntry[];
  /** 选择一种心情：记一笔 + 切换主题 + 返回该条记录 */
  selectEmotion: (id: EmotionType) => MoodEntry;
  /** 收起治愈短句（保留主题色） */
  dismissQuote: () => void;
  /** 深夜倾诉：把正文挂到最近一条心情记录上（无记录则新建） */
  addVent: (content: string) => MoodEntry;
}

const EmotionContext = createContext<EmotionContextValue | null>(null);

export function EmotionProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<EmotionMeta | null>(null);
  const [latestEntry, setLatestEntry] = useState<MoodEntry | null>(null);
  const [entries, setEntries] = useState<MoodEntry[]>(sanitizeEntries);

  /* 挂载时恢复上次主题（不产生新记录） */
  useEffect(() => {
    const last = localStorage.getItem(STORAGE_KEYS.lastEmotion);
    if (last) {
      try {
        const meta = getEmotion(JSON.parse(last) as EmotionType);
        setCurrent(meta);
      } catch {
        localStorage.removeItem(STORAGE_KEYS.lastEmotion);
      }
    }
  }, []);

  /* 情绪变化 → 注入 CSS 变量 */
  useEffect(() => {
    applyThemeVars(current);
  }, [current]);

  const selectEmotion = useCallback((id: EmotionType) => {
    const meta = getEmotion(id);
    const entry = createItem<MoodEntry>(STORAGE_KEYS.moods, {
      emotion: id,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEYS.lastEmotion, JSON.stringify(id));
    setCurrent(meta);
    setLatestEntry(entry);
    // 情绪点击 → 立刻触发今日任务重排（保护模式 / 能量加成）
    window.dispatchEvent(
      new CustomEvent(REPLAN_EVENT, { detail: { mood: id } })
    );
    setEntries((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const dismissQuote = useCallback(() => setLatestEntry(null), []);

  /** 深夜倾诉：正文挂到最近一条记录；还没有记录则以当前情绪新建一笔 */
  const addVent = useCallback(
    (content: string): MoodEntry => {
      const trimmed = content.trim();
      const latest = readAll<MoodEntry>(STORAGE_KEYS.moods)[0];
      let entry: MoodEntry;
      if (latest) {
        entry = updateItem<MoodEntry>(STORAGE_KEYS.moods, latest.id, {
          content: trimmed,
        }) ?? { ...latest, content: trimmed };
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? entry : e))
        );
      } else {
        entry = createItem<MoodEntry>(STORAGE_KEYS.moods, {
          emotion: current?.id ?? "calm",
          content: trimmed,
          createdAt: new Date().toISOString(),
        });
        setEntries((prev) => [entry, ...prev]);
      }
      return entry;
    },
    [current]
  );

  const value = useMemo(
    () => ({
      current,
      latestEntry,
      entries,
      selectEmotion,
      dismissQuote,
      addVent,
    }),
    [current, latestEntry, entries, selectEmotion, dismissQuote, addVent]
  );

  return (
    <EmotionContext.Provider value={value}>{children}</EmotionContext.Provider>
  );
}

export function useEmotion(): EmotionContextValue {
  const ctx = useContext(EmotionContext);
  if (!ctx) throw new Error("useEmotion 必须在 <EmotionProvider> 内使用");
  return ctx;
}
