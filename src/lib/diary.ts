/**
 * 青序 · 历史日记本
 * - 本地优先 + 云端上云：写入即随 qingxu.* 全量状态推送（读-改-写，不覆盖任务等其它数据）
 * - 打开时 syncDiaryFromCloud() 从云端合并（换设备 / 清缓存也不丢）
 * - 统一键 qingxu.diary（纳入 qingxu.* 云端同步体系）；旧版「手机号前缀」键首次读取时自动迁移
 * - 每条：{ id, date: "YYYY-MM-DD HH:mm", content }
 */
import { getSession, fetchRemoteState, pushRemoteState } from "@/lib/api";

export interface DiaryEntry {
  id: string;
  /** YYYY-MM-DD HH:mm（本地时间） */
  date: string;
  content: string;
}

/** 日记存储键（统一纳入 qingxu.* 云端同步体系） */
const DIARY_KEY = "qingxu.diary";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 当前用户的日记存储键 */
export function diaryKey(): string {
  return DIARY_KEY;
}

/** 读取全部日记（倒序：最新在最上）+ 旧键兼容迁移 */
export function readDiary(): DiaryEntry[] {
  try {
    let raw = localStorage.getItem(DIARY_KEY);
    if (raw === null) {
      // 兼容旧版「手机号前缀」键：迁移到统一键后删除旧键
      const session = getSession();
      if (session) {
        const legacy = localStorage.getItem(`qingxu_${session.phone}_diary`);
        if (legacy !== null) {
          localStorage.setItem(DIARY_KEY, legacy);
          localStorage.removeItem(`qingxu_${session.phone}_diary`);
          raw = legacy;
        }
      }
    }
    const list = raw ? (JSON.parse(raw) as DiaryEntry[]) : [];
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/** 推送日记到云端：先读远端全量 state，仅替换 qingxu.diary 键，避免覆盖任务等其它数据 */
async function syncDiaryToCloud(list: DiaryEntry[]): Promise<void> {
  const session = getSession();
  if (!session) return;
  try {
    const remote = await fetchRemoteState(session.phone);
    const merged = { ...(remote ?? {}), [DIARY_KEY]: list };
    await pushRemoteState(session.phone, merged);
  } catch {
    /* 静默：本地已写入，联网后下次打开会自动合并 */
  }
}

/** 追加一条日记并持久化，同时上云；返回新记录 */
export function appendDiary(content: string): DiaryEntry {
  const now = new Date();
  const entry: DiaryEntry = {
    id: `d_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`,
    content,
  };
  const list = readDiary();
  const next = [entry, ...list];
  localStorage.setItem(DIARY_KEY, JSON.stringify(next));
  void syncDiaryToCloud(next);
  return entry;
}

/** 打开日记本时调用：从云端拉取并与本地合并（按 id 去重），返回合并后的倒序列表 */
export async function syncDiaryFromCloud(): Promise<DiaryEntry[]> {
  const local = readDiary();
  const session = getSession();
  if (!session) return local;
  try {
    const remote = await fetchRemoteState(session.phone);
    const remoteList =
      remote && Array.isArray(remote[DIARY_KEY]) ? (remote[DIARY_KEY] as DiaryEntry[]) : [];
    if (remoteList.length === 0) return local;
    const seen = new Set(local.map((e) => e.id));
    const merged = [...local, ...remoteList.filter((e) => !seen.has(e.id))].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    localStorage.setItem(DIARY_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return local;
  }
}

/** 按天分组（组内倒序），供日记本展示 */
export function groupDiaryByDay(entries: DiaryEntry[]): { day: string; items: DiaryEntry[] }[] {
  const groups = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const day = e.date.slice(0, 10);
    const arr = groups.get(day) ?? [];
    arr.push(e);
    groups.set(day, arr);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({ day, items }));
}

/** "2026-10-17" → "2026年10月17日" */
export function formatDayLabel(day: string): string {
  const [y, m, d] = day.split("-");
  return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}
