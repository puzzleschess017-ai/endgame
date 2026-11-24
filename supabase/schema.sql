-- Chess Tactics Guide: tables for sign-in. Paste all of this into Supabase, SQL Editor, and press Run.
-- It is safe to run more than once.

-- One row per account: the name shown and the plan ('free' or 'premium').
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  tier text not null default 'free' check (tier in ('free', 'premium')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in person can read their own row and change their own name. Nobody can change a plan from the
-- website: that is done by hand in the Supabase Table Editor (or later by the payment provider).
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "change own name" on public.profiles;
create policy "change own name" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;

-- When an account is created, make its profile with the name typed on the sign-up form.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), ''), 32))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts made before this script ran get a profile too.
insert into public.profiles (id, name)
select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), ''), 32)
from auth.users u
on conflict (id) do nothing;
