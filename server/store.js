/**
 * 青序 · 存储适配层（STORE_DRIVER 切换）
 *
 *   STORE_DRIVER=supabase → 云端 PostgreSQL（Supabase）
 *   STORE_DRIVER=json     → 本地 data/db.json（默认，零配置可跑，仅本地开发）
 *   STORE_DRIVER=blob      → Vercel Blob（部署到 Vercel 时自动启用，无需手动设置）
 *
 * 自动探测：若配置了 BLOB_READ_WRITE_TOKEN（Vercel 连上 Blob Store 后注入），
 * 即使不设 STORE_DRIVER 也会优先走 Blob，保证 Vercel 上用户态可跨函数调用持久化。
 *
 * 三个驱动实现同一组函数（语义与 server/db.js 完全一致）：
 *   findUser / upsertUser / readState / writeState / listUsers
 */
import { createClient } from "@supabase/supabase-js";
import * as jsonStore from "./db.js";
import {
  blobAvailable,
  readJSON,
  writeJSON,
  listPaths,
} from "./blobStore.js";

const DRIVER = process.env.STORE_DRIVER || "auto";
const useSupabase =
  DRIVER === "supabase" &&
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const useBlob = DRIVER === "blob" || (DRIVER !== "json" && blobAvailable);

let supabase = null;
if (useSupabase) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/* ---------------- Blob 驱动实现 ---------------- */
const userPath = (phone) => `users/${phone}.json`;

async function blobFindUser(phone) {
  return readJSON(userPath(phone));
}
async function blobUpsertUser(phone, name, email) {
  const existing = await blobFindUser(phone);
  const now = new Date().toISOString();
  const record = {
    phone,
    name: name || existing?.name || "同学",
    email: email ?? existing?.email ?? null,
    state: existing?.state ?? {},
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await writeJSON(userPath(phone), record);
  return record;
}
async function blobWriteState(phone, state) {
  const existing = await blobFindUser(phone);
  const now = new Date().toISOString();
  const record = {
    phone,
    name: existing?.name || "同学",
    email: existing?.email ?? null,
    state,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await writeJSON(userPath(phone), record);
  return record;
}
async function blobListUsers() {
  const paths = await listPaths("users/");
  const users = [];
  for (const p of paths) {
    const u = await readJSON(p);
    if (u) users.push(u);
  }
  return users;
}

/* ---------------- 统一导出 ---------------- */
export async function findUser(phone) {
  if (useSupabase) {
    const { data } = await supabase
      .from("users")
      .select("phone,name,email,state,created_at,updated_at")
      .eq("phone", phone)
      .maybeSingle();
    return data ?? null;
  }
  if (useBlob) return blobFindUser(phone);
  return jsonStore.findUser(phone);
}

export async function upsertUser(phone, name, email) {
  if (useSupabase) {
    const existing = await findUser(phone);
    const now = new Date().toISOString();
    const record = {
      phone,
      name: name || existing?.name || "同学",
      email: email ?? existing?.email ?? null,
      state: existing?.state ?? {},
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const { data, error } = await supabase
      .from("users")
      .upsert(record, { onConflict: "phone" })
      .select()
      .single();
    if (error) throw new Error(`[store] upsertUser: ${error.message}`);
    return data;
  }
  if (useBlob) return blobUpsertUser(phone, String(name ?? "").trim(), email);
  // json 驱动：把 email 一并传入 upsertUser，落库持久化（修复 email 缺失）
  return jsonStore.upsertUser(phone, String(name ?? "").trim(), email);
}

export async function readState(phone) {
  return findUser(phone);
}

export async function writeState(phone, state) {
  if (useSupabase) {
    const { data, error } = await supabase
      .from("users")
      .update({ state })
      .eq("phone", phone)
      .select()
      .single();
    if (error) throw new Error(`[store] writeState: ${error.message}`);
    return data;
  }
  if (useBlob) return blobWriteState(phone, state);
  return jsonStore.writeState(phone, state);
}

/** 全量用户列表（邮件 / 推送定时任务用） */
export async function listUsers() {
  if (useSupabase) {
    const { data } = await supabase
      .from("users")
      .select("phone,name,email,state")
      .not("email", "is", null);
    return data ?? [];
  }
  if (useBlob) return blobListUsers();
  const { loadAll } = await import("./db.js");
  return loadAll?.() ?? [];
}
