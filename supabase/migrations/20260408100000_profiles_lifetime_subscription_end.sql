-- V6.9 Stripe: lifetime tier + subscription period end.

alter table public.profiles
  add column if not exists subscription_end timestamptz;

alter table public.profiles
  drop constraint if exists profiles_plan_type_check;

alter table public.profiles
  add constraint profiles_plan_type_check
  check (plan_type in ('free', 'pro', 'pro_yearly', 'lifetime'));
