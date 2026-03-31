-- ============================================================
-- Seedflow CRM - Migration v4: Softer manager/sales permissions
-- Admin: full CRUD and role management
-- Manager: create/edit leads, create activities, no delete
-- Sales: edit leads, create activities, no delete
-- ============================================================

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

-- Profiles stay admin-only for writes so admins can change roles
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Profiles editable by admins" on public.profiles;
create policy "Profiles editable by admins"
  on public.profiles for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Profiles insertable by admins" on public.profiles;
create policy "Profiles insertable by admins"
  on public.profiles for insert to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admins can delete profiles" on public.profiles;
drop policy if exists "Profiles deletable by admins" on public.profiles;
create policy "Profiles deletable by admins"
  on public.profiles for delete to authenticated
  using (public.current_user_role() = 'admin');

-- Leads: managers create/edit, sales edit, delete admin only
drop policy if exists "Leads insertable by authenticated" on public.leads;
drop policy if exists "Leads insertable by admins and managers" on public.leads;
create policy "Leads insertable by admins and managers"
  on public.leads for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager'));

drop policy if exists "Leads updatable by authenticated" on public.leads;
drop policy if exists "Leads updatable by admins and managers" on public.leads;
drop policy if exists "Leads updatable by admins, managers and sales" on public.leads;
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

-- Deals: everyone authenticated can create/update, delete admin only
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

-- Deal notes: everyone authenticated can add, delete admin only
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

-- Activities: everyone authenticated can create/update, delete admin only
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

-- Tasks: everyone authenticated can create/update, delete admin only
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
