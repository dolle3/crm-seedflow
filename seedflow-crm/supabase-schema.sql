-- ============================================================
-- Seedflow CRM - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles table (linked to Supabase Auth users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text check (role in ('admin', 'manager', 'sales')) default 'sales',
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'sales');
$$;

grant execute on function public.current_user_role() to authenticated;

-- Profiles policies: everyone can read, only admins can write
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Profiles editable by admins" on public.profiles;
create policy "Profiles editable by admins"
  on public.profiles for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Profiles insertable by admins" on public.profiles;
create policy "Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'sales')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Leads table
create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  company text,
  email text,
  phone text,
  location text,
  status text check (status in ('hot_lead', 'existing_client', 'nurturing', 'stale')) default 'hot_lead',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.leads enable row level security;

drop policy if exists "Leads viewable by authenticated" on public.leads;
create policy "Leads viewable by authenticated"
  on public.leads for select to authenticated using (true);
drop policy if exists "Leads insertable by authenticated" on public.leads;
drop policy if exists "Leads insertable by admins and managers" on public.leads;
create policy "Leads insertable by admins and managers"
  on public.leads for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager'));
drop policy if exists "Leads updatable by authenticated" on public.leads;
drop policy if exists "Leads updatable by admins, managers and sales" on public.leads;
drop policy if exists "Leads updatable by admins and managers" on public.leads;
create policy "Leads updatable by admins, managers and sales"
  on public.leads for update to authenticated
  using (public.current_user_role() in ('admin', 'manager', 'sales'))
  with check (public.current_user_role() in ('admin', 'manager', 'sales'));
drop policy if exists "Leads deletable by authenticated" on public.leads;
drop policy if exists "Leads deletable by admins and managers" on public.leads;
drop policy if exists "Leads deletable by admins" on public.leads;
create policy "Leads deletable by admins"
  on public.leads for delete to authenticated
  using (public.current_user_role() = 'admin');

-- 3. Deals table
create table if not exists public.deals (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  company text,
  contact_name text,
  contact_email text,
  contact_phone text,
  value numeric default 0,
  stage text check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')) default 'lead',
  probability integer default 50,
  expected_close date,
  owner_id uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.deals enable row level security;

drop policy if exists "Deals viewable by authenticated" on public.deals;
create policy "Deals viewable by authenticated"
  on public.deals for select to authenticated using (true);
drop policy if exists "Deals insertable by authenticated" on public.deals;
drop policy if exists "Deals insertable by admins" on public.deals;
drop policy if exists "Deals insertable by authenticated roles" on public.deals;
create policy "Deals insertable by authenticated roles"
  on public.deals for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager', 'sales'));
drop policy if exists "Deals updatable by authenticated" on public.deals;
drop policy if exists "Deals updatable by admins" on public.deals;
drop policy if exists "Deals updatable by authenticated roles" on public.deals;
create policy "Deals updatable by authenticated roles"
  on public.deals for update to authenticated
  using (public.current_user_role() in ('admin', 'manager', 'sales'))
  with check (public.current_user_role() in ('admin', 'manager', 'sales'));
drop policy if exists "Deals deletable by authenticated" on public.deals;
drop policy if exists "Deals deletable by admins" on public.deals;
create policy "Deals deletable by admins"
  on public.deals for delete to authenticated
  using (public.current_user_role() = 'admin');

-- 4. Deal Notes table
create table if not exists public.deal_notes (
  id uuid default gen_random_uuid() primary key,
  deal_id uuid references public.deals(id) on delete cascade not null,
  content text not null,
  author_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.deal_notes enable row level security;

drop policy if exists "Deal notes viewable by authenticated" on public.deal_notes;
create policy "Deal notes viewable by authenticated"
  on public.deal_notes for select to authenticated using (true);
drop policy if exists "Deal notes insertable by authenticated" on public.deal_notes;
drop policy if exists "Deal notes insertable by admins" on public.deal_notes;
drop policy if exists "Deal notes insertable by authenticated roles" on public.deal_notes;
create policy "Deal notes insertable by authenticated roles"
  on public.deal_notes for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager', 'sales'));
drop policy if exists "Deal notes deletable by authenticated" on public.deal_notes;
drop policy if exists "Deal notes deletable by admins" on public.deal_notes;
create policy "Deal notes deletable by admins"
  on public.deal_notes for delete to authenticated
  using (public.current_user_role() = 'admin');

-- 5. Activities table
create table if not exists public.activities (
  id uuid default gen_random_uuid() primary key,
  type text check (type in ('call', 'email', 'meeting', 'note', 'deadline')) default 'note',
  description text,
  scheduled_at timestamptz,
  lead_id uuid references public.leads(id) on delete set null,
  owner_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.activities enable row level security;

drop policy if exists "Activities viewable by authenticated" on public.activities;
create policy "Activities viewable by authenticated"
  on public.activities for select to authenticated using (true);
drop policy if exists "Activities insertable by authenticated" on public.activities;
drop policy if exists "Activities insertable by admins" on public.activities;
drop policy if exists "Activities insertable by authenticated roles" on public.activities;
create policy "Activities insertable by authenticated roles"
  on public.activities for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager', 'sales'));
drop policy if exists "Activities updatable by authenticated" on public.activities;
drop policy if exists "Activities updatable by admins" on public.activities;
drop policy if exists "Activities updatable by authenticated roles" on public.activities;
create policy "Activities updatable by authenticated roles"
  on public.activities for update to authenticated
  using (public.current_user_role() in ('admin', 'manager', 'sales'))
  with check (public.current_user_role() in ('admin', 'manager', 'sales'));
drop policy if exists "Activities deletable by authenticated" on public.activities;
drop policy if exists "Activities deletable by admins" on public.activities;
create policy "Activities deletable by admins"
  on public.activities for delete to authenticated
  using (public.current_user_role() = 'admin');

-- 6. Tasks table
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  completed boolean default false,
  due_date date,
  owner_id uuid references public.profiles(id),
  deal_id uuid references public.deals(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.tasks enable row level security;

drop policy if exists "Tasks viewable by authenticated" on public.tasks;
create policy "Tasks viewable by authenticated"
  on public.tasks for select to authenticated using (true);
drop policy if exists "Tasks insertable by authenticated" on public.tasks;
drop policy if exists "Tasks insertable by admins" on public.tasks;
drop policy if exists "Tasks insertable by authenticated roles" on public.tasks;
create policy "Tasks insertable by authenticated roles"
  on public.tasks for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager', 'sales'));
drop policy if exists "Tasks updatable by authenticated" on public.tasks;
drop policy if exists "Tasks updatable by admins" on public.tasks;
drop policy if exists "Tasks updatable by authenticated roles" on public.tasks;
create policy "Tasks updatable by authenticated roles"
  on public.tasks for update to authenticated
  using (public.current_user_role() in ('admin', 'manager', 'sales'))
  with check (public.current_user_role() in ('admin', 'manager', 'sales'));
drop policy if exists "Tasks deletable by authenticated" on public.tasks;
drop policy if exists "Tasks deletable by admins" on public.tasks;
create policy "Tasks deletable by admins"
  on public.tasks for delete to authenticated
  using (public.current_user_role() = 'admin');

-- ============================================================
-- SETUP INSTRUCTIONS:
--
-- 1. Run this entire SQL in your Supabase SQL Editor
-- 2. Go to Authentication > Settings and disable "Confirm email"
--    (for easier testing) or set up email confirmation
-- 3. Create your first admin user:
--    - Go to Authentication > Users > Add User
--    - After creating, run:
--      UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
-- 4. Copy your Supabase URL and anon key to .env in the project
-- ============================================================
