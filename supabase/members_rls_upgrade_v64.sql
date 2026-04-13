-- =============================================================================
-- V6.4 SQL REFERENCE — upgrade `public.members` from anon policies to Auth RLS
-- Run in Supabase → SQL Editor if you already had the old "anon all" policies.
-- New projects: use only `migrations/20260405180000_create_members.sql`.
-- =============================================================================
-- Prerequisite: add `user_id uuid` and backfill or delete orphan rows, then:
--   ALTER TABLE public.members ALTER COLUMN user_id SET NOT NULL;
-- Enable Google: Authentication → Providers → Google (Client ID + Secret in dashboard).

-- Drop permissive anon policies
DROP POLICY IF EXISTS "members_select_anon" ON public.members;
DROP POLICY IF EXISTS "members_insert_anon" ON public.members;
DROP POLICY IF EXISTS "members_update_anon" ON public.members;
DROP POLICY IF EXISTS "members_delete_anon" ON public.members;

-- Owner column (run backfill before NOT NULL)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;

-- Remove global unique on identity_id (multi-tenant uses composite below)
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_identity_id_key;

-- One row per user per identity
CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_identity_id_key
  ON public.members (user_id, identity_id);

CREATE INDEX IF NOT EXISTS members_user_id_idx ON public.members (user_id);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_own" ON public.members;
DROP POLICY IF EXISTS "members_insert_own" ON public.members;
DROP POLICY IF EXISTS "members_update_own" ON public.members;
DROP POLICY IF EXISTS "members_delete_own" ON public.members;

CREATE POLICY "members_select_own" ON public.members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "members_insert_own" ON public.members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_update_own" ON public.members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "members_delete_own" ON public.members
  FOR DELETE USING (auth.uid() = user_id);
