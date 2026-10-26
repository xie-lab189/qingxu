/**
 * 青序 · 个人中心 Profile 存储服务
 *
 * 定位：纯「新增层」，不改动任何现有业务数据结构。
 * 现有任务 / 树洞 / 打卡 / 情绪数据仍以 qingxu.* 键存储（运行时数据源不变），
 * 本服务只负责账号维度的事情：
 *   1. 账号档案：qingxu_profile_{手机号} → { name, phone, qqEmail, createdAt, updatedAt }
 *   2. 当前登录用户：qingxu_current_user → { phone, name, qqEmail }（与现有 qingxu.session 并存）
 *   3. 保存修改：支持换手机号 = 账号迁移（档案与按手机号绑定的数据全部迁到新号名下）
 *   4. 退出登录 / 登录恢复：本地档案优先；本地为空时从云端恢复该手机号的历史数据
 *
 * 邮箱去向：保存时同步调用 registerUser(name, phone, qqEmail)，服务端 upsertUser
 * 的 email 规则是「新值优先、未传保留」，因此督促官邮件（server/mailer.js 读取 u.email）
 * 拿到的永远是最新 qqEmail，无需改动邮件逻辑。
 */
import {
  getSession,
  saveSession,
  clearSession,
  registerUser,
  fetchRemoteState,
  pushRemoteState,
} from "@/lib/api";

export interface UserProfile {
  name: string;
  phone: string;
  qqEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUser {
  phone: string;
  name: string;
  qqEmail: string;
}

/** 换号冲突时的处理策略（方案 A） */
export type ConflictResolution = "keepOld" | "keepNew" | "merge";

export interface SaveProfileResult {
  phoneChanged: boolean;
  migratedKeys: string[];
  /** 仅当检测到新号已有云端数据、且用户尚未选择时出现 */
  conflict?: boolean;
  /** 新号的云端状态（供 UI 判断/调试，不强制使用） */
  remoteState?: Record<string, unknown> | null;
}

/** 账号档案键前缀：qingxu_profile_{手机号} */
export const PROFILE_KEY_PREFIX = "qingxu_profile_";
/** 当前登录用户（新增会话键，不影响现有 qingxu.session） */
export const CURRENT_USER_KEY = "qingxu_current_user";

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式等存储失败时静默降级 */
  }
}

export const profileKeyOf = (phone: string): string => `${PROFILE_KEY_PREFIX}${phone}`;

/** 读取某手机号的档案；不存在返回 null */
export function getProfile(phone: string): UserProfile | null {
  return readJSON<UserProfile>(profileKeyOf(phone));
}

export function hasProfile(phone: string): boolean {
  return getProfile(phone) !== null;
}

/** 当前登录用户：优先个人中心会话，其次回落到现有 qingxu.session */
export function getCurrentUser(): CurrentUser | null {
  const current = readJSON<CurrentUser>(CURRENT_USER_KEY);
  if (current) return current;
  const session = getSession();
  if (!session) return null;
  return { phone: session.phone, name: session.name, qqEmail: "" };
}

export function setCurrentUser(user: CurrentUser): void {
  writeJSON(CURRENT_USER_KEY, user);
}

export function clearCurrentUser(): void {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    /* noop */
  }
}

/** 列出本机所有已建立档案的手机号 */
export function listAccountPhones(): string[] {
  const phones: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PROFILE_KEY_PREFIX)) {
      phones.push(key.slice(PROFILE_KEY_PREFIX.length));
    }
  }
  return phones;
}

/** 老用户兜底：已登录但没有档案（本功能上线前注册的账号）时，按现有会话补建档案 */
export function ensureProfileForSession(): UserProfile | null {
  const session = getSession();
  if (!session) return null;
  const existing = getProfile(session.phone);
  if (existing) return existing;
  const now = new Date().toISOString();
  const profile: UserProfile = {
    name: session.name || "同学",
    phone: session.phone,
    qqEmail: "",
    createdAt: now,
    updatedAt: now,
  };
  writeJSON(profileKeyOf(session.phone), profile);
  setCurrentUser({ phone: profile.phone, name: profile.name, qqEmail: "" });
  return profile;
}

/* ---------- 本地业务数据工具（只做 清理/迁移/恢复，不改键结构） ---------- */

/** 本机是否存在任何现有业务数据（qingxu.* 键，排除会话键） */
function localHasBusinessData(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("qingxu.") && key !== "qingxu.session") return true;
  }
  return false;
}

/** 切换账号时清空当前业务数据（数据隔离，防止串号；会话与档案键不动） */
function clearLocalBusinessData(): void {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("qingxu.") && key !== "qingxu.session") doomed.push(key);
  }
  for (const key of doomed) localStorage.removeItem(key);
}

/** 全量推送本地 qingxu.* 业务数据到指定手机号（账号迁移用） */
async function pushAllStateToServer(phone: string): Promise<void> {
  const state: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("qingxu.") && key !== "qingxu.session") {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) state[key] = JSON.parse(raw);
      } catch {
        /* 忽略损坏的本地值 */
      }
    }
  }
  if (Object.keys(state).length > 0) {
    await pushRemoteState(phone, state);
  }
}

/** 本地为空且云端有该手机号的数据时，恢复到本地（新设备 / 换号登录，保持进度不变） */
async function fetchRemoteForRestore(
  phone: string
): Promise<Record<string, unknown> | null> {
  if (localHasBusinessData()) return null;
  const remote = await fetchRemoteState(phone);
  if (!remote) return null;
  const entries = Object.entries(remote).filter(([k]) => k.startsWith("qingxu."));
  if (entries.length === 0) return null;
  for (const [k, v] of entries) {
    localStorage.setItem(k, JSON.stringify(v));
  }
  return remote;
}

/** 把绑定在旧手机号下的键迁移到新手机号：账号档案 + 旧版按手机号隔离的数据键 */
function migratePhoneScopedKeys(oldPhone: string, newPhone: string): string[] {
  const migrated: string[] = [];
  // 1) 账号档案：qingxu_profile_{旧} → qingxu_profile_{新}（新号已有档案则保留新的）
  const profileKey = profileKeyOf(oldPhone);
  const raw = localStorage.getItem(profileKey);
  if (raw !== null) {
    if (!hasProfile(newPhone)) {
      try {
        const profile = JSON.parse(raw) as UserProfile;
        writeJSON(profileKeyOf(newPhone), {
          ...profile,
          phone: newPhone,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        /* 档案损坏则跳过 */
      }
    }
    localStorage.removeItem(profileKey);
    migrated.push(profileKey);
  }
  // 2) 旧版遗留数据键：qingxu_{旧手机号}_* → qingxu_{新手机号}_*
  const legacyPrefix = `qingxu_${oldPhone}_`;
  const legacyKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(legacyPrefix)) legacyKeys.push(key);
  }
  for (const key of legacyKeys) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      try {
        localStorage.setItem(`qingxu_${newPhone}_${key.slice(legacyPrefix.length)}`, value);
        localStorage.removeItem(key);
        migrated.push(key);
      } catch {
        /* noop */
      }
    }
  }
  return migrated;
}

/**
 * 合并新旧两份业务状态（方案 A - 合并）：
 * - 数组类（任务/心情/打卡/日志/成就）按 id 去重后拼接，新号项优先；
 * - 标量类（如 lastEmotion）新号有值则取新号，否则取旧号。
 */
function mergeStates(
  oldState: Record<string, unknown>,
  newState: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(oldState), ...Object.keys(newState)]);
  for (const k of keys) {
    const o = oldState[k];
    const n = newState[k];
    if (Array.isArray(o) && Array.isArray(n)) {
      const seen = new Set<unknown>();
      const merged: unknown[] = [];
      // 新号数据在前，相同 id 的新号项胜出；其余旧号项补齐
      for (const item of [...n, ...o]) {
        const id = (item as { id?: unknown })?.id;
        if (id !== undefined && id !== null) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        merged.push(item);
      }
      out[k] = merged;
    } else if (n !== undefined && n !== null) {
      out[k] = n;
    } else {
      out[k] = o;
    }
  }
  return out;
}

/* ---------- 对外主流程 ---------- */

/**
 * 登录 / 进入应用：按手机号恢复或新建账号空间
 * - 有本地档案 或 云端有数据 → 老用户：恢复姓名 / 邮箱 / 历史数据，进度不变
 * - 两者都没有 → 新用户：建立档案
 * - previousPhone 与 phone 不同 → 换号登录：先清旧业务数据（隔离），再恢复新号数据
 * 返回是否需要刷新页面（让各模块以最新数据重新初始化）。
 */
export async function loginWithPhone(input: {
  phone: string;
  name?: string;
  qqEmail?: string;
  previousPhone?: string | null;
}): Promise<{ needReload: boolean; isNewAccount: boolean }> {
  const phone = input.phone.trim();
  const existing = getProfile(phone);
  const now = new Date().toISOString();

  // 换号登录：先清空旧账号的本地业务数据（日记等也一并隔离，防串号）
  const switched = Boolean(input.previousPhone && input.previousPhone !== phone);
  if (switched) clearLocalBusinessData();

  // 本地为空 → 从云端取该手机号的数据（新设备 / 换号场景，保持进度不变）
  const remote = await fetchRemoteForRestore(phone);
  const hasRemote = remote !== null;
  const isNewAccount = !existing && !hasRemote;

  if (!existing) {
    writeJSON(profileKeyOf(phone), {
      name: (input.name ?? "").trim() || (hasRemote ? "" : "同学"),
      phone,
      qqEmail: (input.qqEmail ?? "").trim(),
      createdAt: now,
      updatedAt: now,
    });
  } else if (input.qqEmail && input.qqEmail.trim() && !existing.qqEmail) {
    // 老用户本次补填了邮箱：写入档案
    writeJSON(profileKeyOf(phone), {
      ...existing,
      qqEmail: input.qqEmail.trim(),
      updatedAt: now,
    });
  }

  const profile = getProfile(phone)!;
  setCurrentUser({ phone, name: profile.name, qqEmail: profile.qqEmail });

  // 服务端档案同步：邮箱始终以最新值为准（督促官邮件读取处）
  try {
    await registerUser(profile.name, phone, profile.qqEmail || undefined);
  } catch {
    /* 离线时静默：本地档案已生效，联网后同步引擎会补推 */
  }

  return { needReload: switched || hasRemote, isNewAccount };
}

/**
 * 保存修改（个人中心【保存修改】）
 * - 手机号未变：直接更新姓名 / 邮箱
 * - 手机号改变：账号迁移——旧号档案与按旧号绑定的数据全部迁到新号名下，
 *   并以新手机号重新登录。
 *   若「新手机号」云端已存在数据（换号冲突，方案 A），首次调用不执行迁移、
 *   返回 { conflict: true } 交还给 UI 弹窗；用户选定 resolution 后再次调用即按策略落盘：
 *     · keepOld：用当前（旧号）本地数据覆盖新号（默认行为）
 *     · keepNew：丢弃当前本地数据，改用新号云端已有数据
 *     · merge  ：两份按 id 去重合并后，本地与云端都写回合并结果
 */
export async function saveProfile(
  input: { name: string; phone: string; qqEmail: string },
  resolution?: ConflictResolution
): Promise<SaveProfileResult> {
  const session = getSession();
  const current = readJSON<CurrentUser>(CURRENT_USER_KEY);
  const oldPhone = (current?.phone || session?.phone || "").trim();
  const newPhone = input.phone.trim();
  const name = input.name.trim() || current?.name || session?.name || "同学";
  const qqEmail = input.qqEmail.trim();
  const now = new Date().toISOString();

  /* ===== 换手机号：账号迁移 ===== */
  if (newPhone && newPhone !== oldPhone) {
    // 0) 冲突检测：新号云端是否已有业务数据（仅冲突且用户尚未选择时拦截）
    let remoteState: Record<string, unknown> | null = null;
    let conflict = false;
    try {
      remoteState = await fetchRemoteState(newPhone);
      conflict =
        !!remoteState &&
        Object.keys(remoteState).some((k) => k.startsWith("qingxu."));
    } catch {
      remoteState = null;
      conflict = false;
    }
    if (conflict && !resolution) {
      // 不执行迁移，把冲突交还给 UI 让用户决定
      return { phoneChanged: false, migratedKeys: [], conflict: true, remoteState };
    }

    // 1) 固化旧号档案（老用户首次保存时），保证旧账号可找回
    if (oldPhone && !hasProfile(oldPhone)) {
      writeJSON(profileKeyOf(oldPhone), {
        name: current?.name || session?.name || "同学",
        phone: oldPhone,
        qqEmail: current?.qqEmail || "",
        createdAt: now,
        updatedAt: now,
      });
    }
    // 2) 迁移档案与旧版按手机号绑定的数据键
    const migratedKeys = migratePhoneScopedKeys(oldPhone, newPhone);
    // 3) 写入新档案（姓名 / 邮箱以表单为准）
    const base = getProfile(newPhone);
    const mergedEmail = qqEmail || base?.qqEmail || "";
    writeJSON(profileKeyOf(newPhone), {
      name,
      phone: newPhone,
      qqEmail: mergedEmail,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    });
    // 4) 以新手机号重新登录（本地会话 + 当前用户）
    saveSession({ name, phone: newPhone });
    setCurrentUser({ phone: newPhone, name, qqEmail: mergedEmail });
    try {
      await registerUser(name, newPhone, mergedEmail || undefined);
    } catch {
      /* 离线时静默 */
    }

    // 5) 按处理策略落盘业务数据
    if (resolution === "keepNew") {
      // 新号数据胜出：清空本地，载入新号云端数据（旧本地数据丢弃）
      clearLocalBusinessData();
      if (remoteState) {
        for (const [k, v] of Object.entries(remoteState)) {
          if (k.startsWith("qingxu.")) localStorage.setItem(k, JSON.stringify(v));
        }
      }
      // 服务端新号数据保持不变（仅 email 已通过 registerUser 更新）
      return { phoneChanged: true, migratedKeys };
    }

    if (resolution === "merge") {
      // 合并：本地（旧号）数据 + 新号云端数据，按 id 去重
      const localState: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("qingxu.") && key !== "qingxu.session") {
          try {
            localState[key] = JSON.parse(localStorage.getItem(key) as string);
          } catch {
            /* 忽略损坏项 */
          }
        }
      }
      const merged = mergeStates(localState, remoteState ?? {});
      clearLocalBusinessData();
      for (const [k, v] of Object.entries(merged)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
      await pushAllStateToServer(newPhone);
      return { phoneChanged: true, migratedKeys };
    }

    // 默认 / keepOld：旧号（当前本地）数据全量推到新号，覆盖新号旧数据
    await pushAllStateToServer(newPhone);
    return { phoneChanged: true, migratedKeys };
  }

  /* ===== 同号保存 ===== */
  const existing = oldPhone ? getProfile(oldPhone) : null;
  const profile: UserProfile = existing ?? {
    name,
    phone: oldPhone,
    qqEmail,
    createdAt: now,
    updatedAt: now,
  };
  profile.name = name;
  profile.qqEmail = qqEmail;
  profile.updatedAt = now;
  writeJSON(profileKeyOf(oldPhone), profile);
  saveSession({ name, phone: oldPhone });
  setCurrentUser({ phone: oldPhone, name, qqEmail });
  try {
    await registerUser(name, oldPhone, qqEmail || undefined);
  } catch {
    /* 离线时静默 */
  }
  return { phoneChanged: false, migratedKeys: [] };
}

/** 退出登录：清空会话状态（含个人中心会话），重载后回到欢迎登录弹窗 */
export function logout(): void {
  clearSession();
  clearCurrentUser();
  if (typeof window !== "undefined") window.location.reload();
}
