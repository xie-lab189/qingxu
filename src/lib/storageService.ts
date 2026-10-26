/**
 * 青序 · 云端数据层（Supabase 适配器）
 *
 * 职责：把前端的「6 个业务键 + 日记」映射成 Supabase `user_data` 表的 4 个 jsonb 列，
 * 并以手机号（phone）作为唯一标识，实现跨设备同步与多用户隔离。
 *
 * 设计要点：
 * - 本地 localStorage 仍是运行时高速缓存（Provider 同步读取，离线可用），本文件只替换「云端镜像」传输层。
 * - 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 时 isSupabaseEnabled=false，
 *   同步引擎自动降级为纯本地，不影响任何现有功能。
 * - 通过请求头 x-phone 配合 RLS，限制每个客户端只能读写自己的那一行。
 *
 * 本文件不改动任何 UI / Provider / 任务 / 树洞 / 打卡逻辑，只替换 API 调用层。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** 是否已配置 Supabase（未配置则整条同步链路自动降级为纯本地） */
export const isSupabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON);

let _client: SupabaseClient | null = null;

/** 获取（懒加载）Supabase 客户端 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseEnabled) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/** user_data 表的一行结构 */
export interface UserDataRow {
  phone: string;
  /** 任务相关数据：masterTasks / dailyTasks */
  tasks: Record<string, unknown> | null;
  /** 情绪相关数据：moods / lastEmotion / achievements */
  moods: Record<string, unknown> | null;
  /** 历史日记本（按天分组的全部条目） */
  diary_logs: unknown[] | null;
  /** 打卡 / 每日日志：dailyLogs */
  checkins: Record<string, unknown> | null;
  updated_at?: string;
}

/** 安全读取 localStorage 的 JSON 值 */
function readJSON<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * 从本地 6 个业务键 + 日记，组装成 user_data 的一行。
 * 列映射：
 *   tasks      ← { masterTasks, dailyTasks }
 *   checkins   ← { dailyLogs }
 *   moods      ← { moods, lastEmotion, achievements }
 *   diary_logs ← qingxu_<phone>_diary
 */
export function composeRowFromLocal(phone: string): UserDataRow {
  return {
    phone,
    tasks: {
      masterTasks: readJSON("qingxu.masterTasks") ?? [],
      dailyTasks: readJSON("qingxu.dailyTasks") ?? [],
    },
    checkins: {
      dailyLogs: readJSON("qingxu.dailyLogs") ?? [],
    },
    moods: {
      moods: readJSON("qingxu.moods") ?? [],
      lastEmotion: readJSON("qingxu.lastEmotion"),
      achievements: readJSON("qingxu.achievements") ?? [],
    },
    diary_logs: readJSON(`qingxu_${phone}_diary`) ?? [],
  };
}

/**
 * 把 user_data 的一行还原成「原始业务键 → 值」的扁平 map（供 sync.ts 的 applyState 写回本地）。
 * 注意：日记在此处直接写回本地（因其键名含手机号，不走固定 SYNC_KEYS）。
 */
export function rowToState(phone: string, row: UserDataRow): Record<string, unknown> {
  const tasks = row.tasks ?? {};
  const checkins = row.checkins ?? {};
  const moods = row.moods ?? {};
  const state: Record<string, unknown> = {};

  if (tasks.masterTasks !== undefined) state["qingxu.masterTasks"] = tasks.masterTasks;
  if (tasks.dailyTasks !== undefined) state["qingxu.dailyTasks"] = tasks.dailyTasks;
  if (checkins.dailyLogs !== undefined) state["qingxu.dailyLogs"] = checkins.dailyLogs;
  if (moods.moods !== undefined) state["qingxu.moods"] = moods.moods;
  if (moods.lastEmotion !== undefined) state["qingxu.lastEmotion"] = moods.lastEmotion;
  if (moods.achievements !== undefined) state["qingxu.achievements"] = moods.achievements;

  if (row.diary_logs !== undefined && Array.isArray(row.diary_logs)) {
    localStorage.setItem(`qingxu_${phone}_diary`, JSON.stringify(row.diary_logs));
  }
  return state;
}

/** 写入/更新某用户的云端数据（upsert，按 phone 冲突合并） */
export async function saveUserData(phone: string, row: UserDataRow): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  const { error } = await (sb.from("user_data") as any)
    .upsert(row, { onConflict: "phone" })
    .headers({ "x-phone": phone });
  if (error) {
    console.error("[supabase] 写入 user_data 失败:", error.message);
    return false;
  }
  return true;
}

/** 读取某用户的云端数据（不存在返回 null） */
export async function loadUserData(phone: string): Promise<UserDataRow | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await (sb.from("user_data") as any)
    .select("*")
    .eq("phone", phone)
    .maybeSingle()
    .headers({ "x-phone": phone });
  if (error) {
    console.error("[supabase] 读取 user_data 失败:", error.message);
    return null;
  }
  return (data as UserDataRow) ?? null;
}
