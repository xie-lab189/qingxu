/**
 * 青序 · 邮箱引导事件总线
 *
 * 解耦「需要邮箱」的触发点（App 首次进入 / 首次建任务）
 * 与「弹窗」呈现（App 顶层统一挂载），避免层层透传 props。
 */
const EVT = "qingxu:request-email";

/** 请求弹出邮箱引导弹窗（任意位置调用） */
export function requestEmailPrompt(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT));
  }
}

/** 订阅邮箱引导请求；返回取消订阅函数 */
export function onEmailPromptRequested(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
