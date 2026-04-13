-- V6.6: plan tier + usage_stats (member row counts per user).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan_type text not null default 'free' check (plan_type in ('free', 'pro')),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  members_created int not null default 0 check (members_created >= 0),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.usage_stats enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "usage_stats_select_own" on public.usage_stats;
drop policy if exists "usage_stats_insert_own" on public.usage_stats;
drop policy if exists "usage_stats_update_own" on public.usage_stats;

create policy "usage_stats_select_own" on public.usage_stats
  for select using (auth.uid() = user_id);
create policy "usage_stats_insert_own" on public.usage_stats
  for insert with check (auth.uid() = user_id);
create policy "usage_stats_update_own" on public.usage_stats
  for update using (auth.uid() = user_id);

create or replace function public.apply_usage_stats_on_members_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.usage_stats (user_id, members_created, updated_at)
    values (new.user_id, 1, now())
    on conflict (user_id) do update set
      members_created = public.usage_stats.members_created + 1,
      updated_at = now();
    return new;
  elsif tg_op = 'DELETE' then
    update public.usage_stats set
      members_created = greatest(0, members_created - 1),
      updated_at = now()
    where user_id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_members_usage_stats on public.members;
create trigger trg_members_usage_stats
  after insert or delete on public.members
  for each row execute function public.apply_usage_stats_on_members_change();
