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
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
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

/** 原子写入：先写临时文件再重命名，避免并发写坏数据库 */
function saveDB(db) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
  renameSync(tmp, DB_FILE);
}

export function findUser(phone) {
  return loadDB().users[phone] ?? null;
}

export function upsertUser(phone, name, email) {
  const db = loadDB();
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
  const db = loadDB();
  const user = db.users[phone];
  if (!user) return null;
  user.state = state;
  user.updatedAt = new Date().toISOString();
  saveDB(db);
  return user;
}

/** 全量用户列表（邮件定时任务用） */
export function loadAll() {
  return Object.values(loadDB().users);
}
