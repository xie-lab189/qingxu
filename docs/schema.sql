-- 青序 · 云端数据库表结构（Supabase / PostgreSQL 通用）
-- 在 Supabase SQL Editor 中执行本文件即可建表

-- 1. 用户表：手机号为主键（唯一用户 ID）
create table if not exists users (
  phone       text primary key,             -- 唯一用户 ID
  name        text not null,               -- 昵称
  email       text,                        -- 选填：邮件提醒兜底
  state       jsonb not null default '{}', -- 全量业务状态（主任务/每日任务/日志/心情/成就）
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. 任务表：主任务（masterTasks）单独成表，便于检索与统计
create table if not exists tasks (
  id          text primary key,
  phone       text not null references users(phone) on delete cascade,
  name        text not null,
  total_amount integer,
  unit        text,
  total_days  integer not null,
  start_date  date not null,
  quadrant    text not null,               -- IMPORTANT_URGENT / IMPORTANT_NOT_URGENT / URGENT_NOT_IMPORTANT / NOT_IMPORTANT_NOT_URGENT
  daily_base  integer not null default 1,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tasks_phone on tasks(phone);

-- 3. 每日日志表：打卡、心情、顺延记录（心情明细仍在 users.state.moods 中）
create table if not exists daily_logs (
  date        date not null,
  phone       text not null references users(phone) on delete cascade,
  mood        text,
  done_count  integer not null default 0,
  deferred_task_ids text[] not null default '{}',
  protected   boolean not null default false,
  boosted     boolean not null default false,
  primary key (phone, date)
);

-- updated_at 自动维护
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_touch on users;
create trigger trg_users_touch before update on users
  for each row execute function touch_updated_at();

-- 行级安全（RLS）：用户只能读写自己的数据（配合 Supabase Anon Key 使用）
alter table users      enable row level security;
alter table tasks      enable row level security;
alter table daily_logs enable row level security;

create policy "own_user"      on users      for all using (phone = auth.jwt() ->> 'phone') with check (phone = auth.jwt() ->> 'phone');
create policy "own_tasks"     on tasks      for all using (phone = auth.jwt() ->> 'phone') with check (phone = auth.jwt() ->> 'phone');
create policy "own_daily_logs" on daily_logs for all using (phone = auth.jwt() ->> 'phone') with check (phone = auth.jwt() ->> 'phone');
