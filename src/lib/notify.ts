/**
 * 青序 · 系统通知封装（Notification API，替代短信）
 *
 * - 登录后 requestNotifyPermission() 请求浏览器通知权限
 * - notify() 在权限允许时发送系统级通知；拒绝时静默降级（由对话面板兜底）
 */

/** 请求通知权限（页面初始化 / 登录成功后调用） */
export function requestNotifyPermission(): void {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      console.log(`[notify] 通知权限: ${permission}`);
    });
  }
}

/** 发送系统通知（无权限或未聚焦时降级为静默） */
export function notify(title: string, body: string): boolean {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }
  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "qingxu-nudge",
      silent: false,
    });
    return true;
  } catch {
    return false;
  }
}
