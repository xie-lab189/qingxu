/**
 * 青序 · 存储适配层（STORE_DRIVER 切换）
 *
 *   STORE_DRIVER=json     → 本地 data/db.json（默认，零配置可跑）
 *   STORE_DRIVER=supabase → 云端 PostgreSQL（Supabase）
 *                            需环境变量 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *
 * 两个驱动实现同一组函数（语义与 server/db.js 完全一致）：
 *   findUser / upsertUser / readState / writeState
 */
import { createClient } from "@supabase/supabase-js";
import * as jsonStore from "./db.js";

const DRIVER = process.env.STORE_DRIVER || "json";

let supabase = null;
if (DRIVER === "supabase") {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[store] 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，回退到 json 驱动");
  } else {
    supabase = createClient(url, key);
  }
}

export async function findUser(phone) {
  if (supabase) {
    const { data } = await supabase
      .from("users")
      .select("phone,name,email,state,created_at,updated_at")
      .eq("phone", phone)
      .maybeSingle();
    return data ?? null;
  }
  return jsonStore.findUser(phone);
}

export async function upsertUser(phone, name, email) {
  if (supabase) {
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
  // json 驱动：把 email 一并传入 upsertUser，落库持久化（修复 email 缺失）
  return jsonStore.upsertUser(phone, String(name ?? "").trim(), email);
}

export async function readState(phone) {
  return findUser(phone);
}

export async function writeState(phone, state) {
  if (supabase) {
    const { data, error } = await supabase
      .from("users")
      .update({ state })
      .eq("phone", phone)
      .select()
      .single();
    if (error) throw new Error(`[store] writeState: ${error.message}`);
    return data;
  }
  return jsonStore.writeState(phone, state);
}

/** 全量用户列表（邮件定时任务用；Supabase 下仅取有邮箱的用户） */
export async function listUsers() {
  if (supabase) {
    const { data } = await supabase
      .from("users")
      .select("phone,name,email,state")
      .not("email", "is", null);
    return data ?? [];
  }
  const { loadAll } = await import("./db.js");
  return loadAll?.() ?? [];
}
