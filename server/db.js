/**
 * 青序 · JSON 文件数据库（零依赖，可整体替换为 MongoDB/PostgreSQL）
 *
 * 数据结构：data/db.json
 * {
 *   users: {
 *     "<phone>": {
 *       name, phone, createdAt, updatedAt,
 *       state: { masterTasks, dailyTasks, dailyLogs, moods, achievements, lastEmotion }
 *     }
 *   }
 * }
 *
 * 手机号即主键，天然的数据隔离：所有读写均以 phone 为第一级键。
 * 若迁移到真实数据库，只需替换本文件的四个函数（语义保持不变）：
 *   findUser / upsertUser / readState / writeState
 *
 * 存储位置：优先项目内 data/（本地开发）；serverless 只读文件系统下自动回退 /tmp，
 * 再不行降级为进程内内存（保证请求永不因写盘失败而 500）。注意：/tmp 与内存均不跨
 * 实例持久化，云端仅作"前端 localStorage 本地优先"策略的备份/权威副本，前端才是真相源。
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { resolveDataDir } from "./dataDir.js";

const DATA_DIR = resolveDataDir();
const DB_FILE = join(DATA_DIR, "db.json");

function emptyDB() {
  return { users: {} };
}

function loadDB() {
  try {
    if (!existsSync(DB_FILE)) return emptyDB();
    const raw = JSON.parse(readFileSync(DB_FILE, "utf-8"));
    return { users: raw.users ?? {} };
  } catch {
    return emptyDB();
  }
}

// 文件系统只读时（serverless 且 /tmp 也不可写）作为兜底，保证进程内可正常读写
let memDB = null;

/** 原子写入：先写临时文件再重命名；写盘失败则降级到内存，绝不抛错。 */
function saveDB(db) {
  try {
    const tmp = `${DB_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
    renameSync(tmp, DB_FILE);
  } catch {
    memDB = db;
  }
}

function getDB() {
  return memDB ?? loadDB();
}

export function findUser(phone) {
  return getDB().users[phone] ?? null;
}

export function upsertUser(phone, name, email) {
  const db = getDB();
  const existing = db.users[phone];
  const now = new Date().toISOString();
  const record = existing
    ? {
        ...existing,
        name: name || existing.name,
        // email：新传值优先；未传则保留已有；两者都无则置 null
        email: email ?? existing.email ?? null,
        updatedAt: now,
      }
    : { name, phone, email: email ?? null, createdAt: now, updatedAt: now, state: {} };
  db.users[phone] = record;
  saveDB(db);
  return record;
}

export function readState(phone) {
  return findUser(phone);
}

export function writeState(phone, state) {
  const db = getDB();
  const user = db.users[phone];
  if (!user) return null;
  user.state = state;
  user.updatedAt = new Date().toISOString();
  saveDB(db);
  return user;
}

/** 全量用户列表（邮件 / 推送定时任务用） */
export function loadAll() {
  return Object.values(getDB().users);
}
