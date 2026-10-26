/**
 * 青序 · 随机抽取工具（拒绝复读机）
 *
 * pickSmart：随机抽取 + 去重机制——
 * 每个去重键（如 mood-quote:stressed、agent:companion）的上一次抽取
 * 结果持久化在 localStorage，本次绝不与上一次相同（池子 >1 时）。
 */

const STORAGE_KEY = "qingxu.pickState";

function loadState(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function pickSmart<T>(pool: readonly T[], dedupeKey: string): T {
  if (pool.length === 0) throw new Error("[random] 空语料池");
  let idx = Math.floor(Math.random() * pool.length);
  const state = loadState();
  // 去重：不与上一次相同
  if (pool.length > 1 && state[dedupeKey] === idx) {
    idx = (idx + 1) % pool.length;
  }
  state[dedupeKey] = idx;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 忽略持久化失败 */
  }
  return pool[idx];
}
