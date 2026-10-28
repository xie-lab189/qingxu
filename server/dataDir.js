/**
 * 青序 · 数据目录解析
 *
 * 默认使用项目内 data/ 目录（本地开发可读写）。
 * 在 serverless（EdgeOne / Vercel 等）环境，根文件系统只读，
 * 默认目录无法创建，此时自动回退到系统临时目录（如 /tmp/qingxu-data），
 * 避免 mkdir 抛错导致整条请求 500。
 *
 * 也可用环境变量 DATA_DIR 强制指定可写目录。
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = join(__dirname, "..", "data");

export function resolveDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  // 默认目录可写 → 直接用它（本地开发 / 自托管场景）
  try {
    mkdirSync(DEFAULT_DATA_DIR, { recursive: true });
    return DEFAULT_DATA_DIR;
  } catch {
    // serverless 只读文件系统 → 回退到系统临时目录（可读写、随实例生命周期）
    const fallback = join(tmpdir(), "qingxu-data");
    try {
      mkdirSync(fallback, { recursive: true });
    } catch {
      /* 连 /tmp 都不可写则由调用方降级到内存（见 db.js） */
    }
    return fallback;
  }
}
