-- 青序 · Supabase 数据表 + 行级安全（RLS）
-- 在 Supabase 控制台 → SQL Editor 全选执行即可。
-- 表：user_data，以手机号 phone 为主键，实现跨设备同步与多用户隔离。

create table if not exists public.user_data (
  phone      text primary key,
  tasks      jsonb,   -- { masterTasks, dailyTasks }
  moods      jsonb,   -- { moods, lastEmotion, achievements }
  diary_logs jsonb,   -- 历史日记本条目数组
  checkins   jsonb,   -- { dailyLogs }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 自动维护 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_data_updated on public.user_data;
create trigger trg_user_data_updated
before update on public.user_data
for each row execute function public.set_updated_at();

-- ============ 行级安全（RLS）============
-- 开启 RLS：未授权请求一律拒绝。
alter table public.user_data enable row level security;

-- 客户端每次请求都会携带 x-phone 头（见 src/lib/storageService.ts）。
-- 下面策略限定「只能读写 phone 与请求头 x-phone 一致的那一行」。
-- 注意：本方案以手机号作为身份、未启用 Supabase Auth 登录，因此该隔离依赖「客户端如实上报 x-phone」。
-- 安全边界说明：知道他人手机号的人理论上可伪造 x-phone 读取对方数据，故仅适合非敏感演示数据。
-- 若需更强安全，请接入 Supabase Auth（手机号 OTP），并把策略改为用 auth.uid() 关联用户表。
create policy "own row select"
  on public.user_data
  for select
  using ( phone = current_setting('request.headers', true)::jsonb ->> 'x-phone' );

create policy "own row insert"
  on public.user_data
  for insert
  with check ( phone = current_setting('request.headers', true)::jsonb ->> 'x-phone' );

create policy "own row update"
  on public.user_data
  for update
  using ( phone = current_setting('request.headers', true)::jsonb ->> 'x-phone' )
  with check ( phone = current_setting('request.headers', true)::jsonb ->> 'x-phone' );
