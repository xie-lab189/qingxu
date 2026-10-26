/**
 * 青序 · 数据持久化层
 *
 * 当前实现：localStorage。
 * 后续接入后端 / 多智能体服务时，只需保持这些函数的签名不变，
 * 把内部实现替换为 fetch 调用即可，页面层无需改动。
 */
import type { StorageKey } from "@/types";

/** 生成唯一 ID */
export function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 读取某个 key 下的全部数据 */
export function readAll<T>(key: StorageKey): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    console.error(`[storage] 读取 ${key} 失败:`, err);
    return [];
  }
}

/** 全量写入（内部使用） */
function writeAll<T>(key: StorageKey, items: T[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch (err) {
    console.error(`[storage] 写入 ${key} 失败:`, err);
    return false;
  }
}

/** 新增一条记录，返回带 id 的完整对象 */
export function createItem<T extends { id: string }>(
  key: StorageKey,
  item: Omit<T, "id"> & { id?: string }
): T {
  const items = readAll<T>(key);
  const record = { ...item, id: item.id ?? genId() } as T;
  writeAll(key, [...items, record]);
  return record;
}

/** 按 id 更新记录，返回更新后的对象；不存在则返回 null */
export function updateItem<T extends { id: string }>(
  key: StorageKey,
  id: string,
  patch: Partial<T>
): T | null {
  const items = readAll<T>(key);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const updated = { ...items[index], ...patch };
  items[index] = updated;
  writeAll(key, items);
  return updated;
}

/** 按 id 删除记录，返回是否删除成功 */
export function deleteItem<T extends { id: string }>(
  key: StorageKey,
  id: string
): boolean {
  const items = readAll<T>(key);
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  return writeAll(key, next);
}

/** 读取单条配置类数据（如用户资料），无则返回 null */
export function readOne<T>(key: StorageKey): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.error(`[storage] 读取 ${key} 失败:`, err);
    return null;
  }
}

/** 写入单条配置类数据 */
export function writeOne<T>(key: StorageKey, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[storage] 写入 ${key} 失败:`, err);
    return false;
  }
}
