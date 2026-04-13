-- V6.9: allow annual / founders tier in profiles.plan_type (after V6.6 profiles table exists).

alter table public.profiles
  drop constraint if exists profiles_plan_type_check;

alter table public.profiles
  add constraint profiles_plan_type_check
  check (plan_type in ('free', 'pro', 'pro_yearly'));
