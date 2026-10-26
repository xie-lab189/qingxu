/**
 * 青序 · 状态同步引擎（本地优先，后台推送）
 *
 * 策略：
 * - localStorage 仍是运行时数据源，前端读写保持同步、离线可用
 * - 同步键快照比对：每 10 秒对比 6 个业务键，有变更即全量推送后端
 * - 页面隐藏 / 关闭前强制推送一次
 *
 * 存储后端（按配置自动选择，无需改业务代码）：
 * - 已配置 Supabase（VITE_SUPABASE_*）：写入 Supabase `user_data` 表
 * - 未配置（默认部署）：降级写入服务端 JSON 存储（db.json），
 *   即「每晚 20:00 邮件提醒」读取的同一份数据，保证提醒有内容可发
 *
 * 启动时（关键，避免刷新循环）：
 * - 本地为空 + 远端有数据 → 水合 + 刷新一次（新设备首次同步）
 * - 本地有数据 → 以本地为准直接上传（last-writer-wins），绝不刷新
 *   ※ 曾经采用「远端覆盖本地 → 有差异就刷新」，会与调度中枢的
 *     「每日自动发布今日卡片」互相打架，导致无限刷新（画面闪烁）。
 */
import { getSession, fetchRemoteState, pushRemoteState } from "@/lib/api";
import {
  isSupabaseEnabled,
  composeRowFromLocal,
  loadUserData,
  saveUserData,
  rowToState,
} from "@/lib/storageService";

const SYNC_KEYS = [
  "qingxu.masterTasks",
  "qingxu.dailyTasks",
  "qingxu.dailyLogs",
  "qingxu.moods",
  "qingxu.achievements",
  "qingxu.lastEmotion",
] as const;

function snapshot(): string {
  const parts: string[] = [];
  for (const key of SYNC_KEYS) {
    parts.push(`${key}=${localStorage.getItem(key) ?? ""}`);
  }
  return parts.join("|");
}

function applyState(state: Record<string, unknown>) {
  for (const key of SYNC_KEYS) {
    if (key in state) {
      const v = state[key];
      localStorage.setItem(key, typeof v === "string" ? v : JSON.stringify(v));
    }
  }
}

/** 从本地 6 个业务键组装成「状态对象」（供 JSON 降级写入） */
function composeStateFromLocal(): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        state[key] = JSON.parse(raw);
      } catch {
        state[key] = raw;
      }
    }
  }
  return state;
}

/** 本地是否有任何业务数据 */
function localHasData(): boolean {
  return SYNC_KEYS.some((k) => localStorage.getItem(k) !== null);
}

/** 远端是否有业务数据（兼容 Supabase 行 与 JSON 状态对象两种形状） */
function remoteHasData(state: Record<string, unknown> | null): boolean {
  return state !== null && SYNC_KEYS.some((k) => k in state);
}

let lastSnapshot = "";
let started = false;

/** 读取远端状态（Supabase 或 JSON 降级） */
async function loadRemoteState(phone: string): Promise<Record<string, unknown> | null> {
  if (isSupabaseEnabled) {
    const row = await loadUserData(phone);
    return row ? rowToState(phone, row) : null;
  }
  return fetchRemoteState(phone);
}

function pushIfChanged(force = false) {
  const session = getSession();
  if (!session) return;
  const current = snapshot();
  if (!force && current === lastSnapshot) return;
  const phone = session.phone;
  if (isSupabaseEnabled) {
    saveUserData(phone, composeRowFromLocal(phone)).then((ok) => {
      if (ok) lastSnapshot = current;
    });
  } else {
    // 降级：直接 PUT 到服务端 JSON 存储（邮件提醒读取的同一份 db.json）
    pushRemoteState(phone, composeStateFromLocal()).then((ok) => {
      if (ok) lastSnapshot = current;
    });
  }
}

/**
 * 启动同步引擎（App 挂载时调用一次）：
 * 1. 本地为空且远端有数据 → 水合本地 + 刷新一次（换设备/清缓存场景）
 * 2. 本地有数据 → 以本地为准立即上传（不刷新，杜绝闪烁循环）
 * 3. 之后进入轮询推送（10s）+ 页面隐藏时强制推送
 */
export async function startSyncEngine(): Promise<void> {
  if (started) return;
  started = true;
  const session = getSession();
  if (!session) return;

  const remote = await loadRemoteState(session.phone);

  if (!localHasData() && remoteHasData(remote)) {
    // 全新设备：以水合云端数据为准，刷新一次让各 Provider 重新初始化
    applyState(remote!);
    lastSnapshot = snapshot();
    window.location.reload();
    return;
  }

  // 本地有数据（含调度中枢刚发布的今日卡片）：本地优先，直接上传
  lastSnapshot = snapshot();
  if (!remote) {
    pushIfChanged(true); // 远端无档案 → 立即建立
  }

  window.setInterval(() => pushIfChanged(), 10_000);
  window.addEventListener("pagehide", () => pushIfChanged(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pushIfChanged(true);
  });
}

/**
 * 登录成功后调用：
 * - 切换了手机号 → 先清空本地业务数据（数据隔离），再水合新账号云端数据
 * - 返回是否需要刷新（有新数据水合时）
 */
export async function hydrateAfterLogin(
  phone: string,
  previousPhone?: string | null
): Promise<boolean> {
  if (previousPhone && previousPhone !== phone) {
    // 换号登录：清除旧账号的本地业务数据，防止串号
    for (const key of SYNC_KEYS) localStorage.removeItem(key);
  }
  const remote = await loadRemoteState(phone);
  const before = snapshot();
  if (remoteHasData(remote)) {
    applyState(remote!);
    lastSnapshot = snapshot();
    return snapshot() !== before;
  }
  // 新用户或远端无数据：保持本地，立即推送一次建立档案
  pushIfChanged(true);
  return false;
}
