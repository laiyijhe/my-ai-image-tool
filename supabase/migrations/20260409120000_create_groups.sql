-- Named contact groups for portal + PDF protect (per authenticated user).
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_user_name_unique unique (user_id, name)
);

create index if not exists groups_user_id_idx on public.groups (user_id);

alter table public.groups enable row level security;

create policy "groups_select_own" on public.groups for select using (auth.uid() = user_id);
create policy "groups_insert_own" on public.groups for insert with check (auth.uid() = user_id);
create policy "groups_update_own" on public.groups for update using (auth.uid() = user_id);
create policy "groups_delete_own" on public.groups for delete using (auth.uid() = user_id);
