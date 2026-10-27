/**
 * 青序 · Vercel Blob 持久化封装
 *
 * Vercel 云函数的文件系统是临时且不共享的，本地 data/*.json 无法跨调用持久化。
 * 因此用户态、Web Push 的 VAPID 密钥与订阅列表统一存到 Vercel Blob（同账号、免费、免卡）。
 *
 * 仅当配置了 BLOB_READ_WRITE_TOKEN（Vercel 连上 Blob Store 后自动注入）时才启用；
 * 未配置（本地开发）时 blobAvailable=false，调用方回退到本地文件驱动。
 */
import { put, get, list, del } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
export const blobAvailable = Boolean(TOKEN);

/** 读取一个 JSON Blob；不存在/出错返回 null */
export async function readJSON(pathname) {
  if (!TOKEN) return null;
  try {
    const result = await get(pathname, { access: "private" });
    if (result && result.statusCode === 200 && result.stream) {
      const text = await result.stream.text();
      return JSON.parse(text);
    }
  } catch {
    /* 不存在或读取失败 → 视为无数据 */
  }
  return null;
}

/** 写入（覆盖）一个 JSON Blob */
export async function writeJSON(pathname, value) {
  if (!TOKEN) throw new Error("blob unavailable");
  await put(pathname, JSON.stringify(value), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

/** 列举某前缀下的所有 pathname */
export async function listPaths(prefix) {
  if (!TOKEN) return [];
  try {
    const { blobs } = await list({ prefix });
    return (blobs || []).map((b) => b.pathname);
  } catch {
    return [];
  }
}

/** 删除一个 Blob */
export async function removePath(pathname) {
  if (!TOKEN) return;
  try {
    await del(pathname);
  } catch {
    /* ignore */
  }
}
