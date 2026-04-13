-- Creator Guard portal members — per-user rows (Google / Supabase Auth).
-- Requires signed-in user; RLS enforces auth.uid() = user_id.
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_id text not null,
  source text not null default '',
  group_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint members_user_identity_unique unique (user_id, identity_id)
);

create index if not exists members_user_id_idx on public.members (user_id);

alter table public.members enable row level security;

create policy "members_select_own" on public.members for select using (auth.uid() = user_id);
create policy "members_insert_own" on public.members for insert with check (auth.uid() = user_id);
create policy "members_update_own" on public.members for update using (auth.uid() = user_id);
create policy "members_delete_own" on public.members for delete using (auth.uid() = user_id);
