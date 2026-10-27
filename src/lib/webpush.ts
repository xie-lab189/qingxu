/**
 * 青序 · Web Push 前端接入
 *
 * 登录后调用 setupWebPush(phone)：注册 Service Worker → 申请通知权限 → 订阅 Push → 上报服务端。
 * 这样即使网站当天没打开，每晚 20:00 也能收到系统级推送提醒，覆盖"用户好几天不登录网站"的场景，
 * 且不需要任何邮件 / 外部账号。浏览器不支持或处于非安全上下文（如 http 开发环境）时静默跳过。
 */
const VAPID_ENDPOINT = "/api/push/vapid-public-key";

/** 将 VAPID 公钥（base64url）转为 PushManager 所需的 Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function setupWebPush(phone?: string): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!window.isSecureContext) return; // 推送要求 HTTPS（Render 默认满足；本地 http 跳过）

  try {
    // 注册 Service Worker（public/sw.js 经 Vite 拷贝到 dist 根，作用域为 /）
    const reg = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`
    );
    await navigator.serviceWorker.ready;

    // 申请通知权限（用户只需点一次"允许"）
    let permission: NotificationPermission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    // 取 VAPID 公钥并订阅
    const { publicKey } = await fetch(VAPID_ENDPOINT).then((r) => r.json());
    if (!publicKey) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    // 上报订阅到服务端（关联手机号用于个性化文案）
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), phone }),
    });
  } catch (e) {
    console.warn("[webpush] 设置失败（不影响主流程）", e);
  }
}
