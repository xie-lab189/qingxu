/**
 * 青序 · 会话与后端 API 客户端
 *
 * 手机号 = 唯一用户 ID：
 * - 登录后保存在 localStorage 作为 Session（qingxu.session），下次打开自动识别
 * - 所有请求通过 X-User-Id 头携带手机号，后端据此刻离数据
 */

export interface Session {
  name: string;
  phone: string;
}

const SESSION_KEY = "qingxu.session";

/** API 基础地址：默认同源（Express 托管前端时）；独立部署时设置 VITE_API_URL */
export const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/** 统一请求：自动携带 X-User-Id（手机号） */
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const session = getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (session) headers["X-User-Id"] = session.phone;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

/** 注册 / 登录（幂等：老用户直接返回）；email 选填，用于邮件提醒兜底 */
export async function registerUser(
  name: string,
  phone: string,
  email?: string
): Promise<Session> {
  const res = await apiFetch("/api/register", {
    method: "POST",
    body: JSON.stringify({ name, phone, email: email || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "注册失败，请稍后再试");
  }
  const data = (await res.json()) as { user: Session };
  return data.user;
}

/** 拉取远端全量状态（换设备同步） */
export async function fetchRemoteState(phone: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/api/state/${phone}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { state: Record<string, unknown> };
    return data.state ?? null;
  } catch {
    return null;
  }
}

/** 推送全量状态到后端 */
export async function pushRemoteState(
  phone: string,
  state: Record<string, unknown>
): Promise<boolean> {
  const put = () =>
    fetch(`${API_BASE}/api/state/${phone}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
  try {
    let res = await put();
    // 服务端没有该账号（如发布时云端数据被重置）：用本地会话信息自动重建后重试，
    // 避免老用户因账号丢失而永远同步不上（收不到邮件、换设备看不到数据）
    if (res.status === 404) {
      const session = getSession();
      if (session && session.phone === phone) {
        try {
          await registerUser(
            session.name,
            phone,
            (session as { email?: string }).email
          );
          res = await put();
        } catch {
          /* 重建失败则按普通失败处理 */
        }
      }
    }
    return res.ok;
  } catch {
    return false;
  }
}
