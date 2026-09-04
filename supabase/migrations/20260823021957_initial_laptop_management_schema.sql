create schema if not exists private;
revoke all on schema private from public, anon;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher', 'helper', 'admin')),
  student_id text,
  student_name text not null check (char_length(btrim(student_name)) between 2 and 40),
  grade text,
  class_num text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_student_id_format check (student_id is null or student_id ~ '^[1-3][0-9]{4}$'),
  constraint profiles_grade_format check (grade is null or grade ~ '^[1-3]$'),
  constraint profiles_class_num_format check (class_num is null or class_num ~ '^(0[1-9]|1[0-9]|20)$'),
  constraint profiles_required_fields check (
    (role in ('student', 'helper') and student_id is not null and grade is not null and class_num is not null)
    or (role = 'teacher' and student_id is null and grade is null and class_num is not null)
    or (role = 'admin')
  )
);

create unique index profiles_student_id_unique_idx
on public.profiles (student_id)
where student_id is not null;

create table public.notebooks (
  number smallint primary key check (number between 1 and 999),
  asset_tag text not null unique check (char_length(btrim(asset_tag)) between 3 and 50),
  condition text not null default 'available' check (condition in ('available', 'maintenance', 'retired')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.laptop_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete restrict,
  user_name text not null check (char_length(btrim(user_name)) between 2 and 40),
  student_id text not null check (student_id ~ '^[1-3][0-9]{4}$'),
  class_num text not null check (class_num ~ '^(0[1-9]|1[0-9]|20)$'),
  type text not null check (type in ('home', 'class')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'returned', 'cancelled')),
  start_date date not null,
  end_date date,
  slots jsonb,
  reason text check (reason is null or char_length(reason) <= 500),
  week_label text check (week_label is null or char_length(week_label) <= 40),
  rental_year smallint check (rental_year is null or rental_year between 2024 and 2100),
  rental_month smallint check (rental_month is null or rental_month between 1 and 12),
  rental_week smallint check (rental_week is null or rental_week between 1 and 5),
  notebook_number smallint references public.notebooks (number) on delete restrict,
  reviewed_by uuid references public.profiles (user_id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint laptop_requests_type_fields check (
    (
      type = 'home'
      and end_date is not null
      and end_date >= start_date
      and end_date <= start_date + 29
      and slots is null
      and rental_year is null
      and rental_month is null
      and rental_week is null
    )
    or (
      type = 'class'
      and end_date is null
      and slots is not null
      and rental_year is not null
      and rental_month is not null
      and rental_week is not null
    )
  ),
  constraint laptop_requests_assignment_state check (
    (status in ('approved', 'returned') and notebook_number is not null and reviewed_at is not null)
    or (status in ('pending', 'rejected', 'cancelled') and notebook_number is null)
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  request_id uuid references public.laptop_requests (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  message text not null check (char_length(btrim(message)) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index laptop_requests_user_created_idx on public.laptop_requests (user_id, created_at desc);
create index laptop_requests_class_status_created_idx on public.laptop_requests (class_num, status, created_at desc);
create index laptop_requests_reviewed_by_idx on public.laptop_requests (reviewed_by) where reviewed_by is not null;
create index laptop_requests_pending_idx on public.laptop_requests (created_at desc) where status = 'pending';
create unique index laptop_requests_active_home_unique_idx
on public.laptop_requests (user_id)
where type = 'home' and status in ('pending', 'approved');
create unique index laptop_requests_active_class_unique_idx
on public.laptop_requests (user_id, rental_year, rental_month, rental_week)
where type = 'class' and status in ('pending', 'approved');
create unique index laptop_requests_active_notebook_unique_idx
on public.laptop_requests (notebook_number)
where status = 'approved';
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_request_id_idx on public.notifications (request_id) where request_id is not null;

create or replace function private.valid_rental_slots(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if value is null or jsonb_typeof(value) <> 'array' then
    return false;
  end if;

  return jsonb_array_length(value) between 1 and 45
    and not exists (
      select 1
      from jsonb_array_elements(value) as slot
      where jsonb_typeof(slot) <> 'object'
        or not (slot ? 'dayIdx' and slot ? 'periodIdx')
        or (slot ->> 'dayIdx') !~ '^[0-4]$'
        or (slot ->> 'periodIdx') !~ '^[0-8]$'
    )
    and (
      select count(*) = count(distinct (slot ->> 'dayIdx', slot ->> 'periodIdx'))
      from jsonb_array_elements(value) as slot
    );
end;
$$;

alter table public.laptop_requests
add constraint laptop_requests_slots_format check (slots is null or private.valid_rental_slots(slots));

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.user_id = (select auth.uid());
$$;

create or replace function private.current_class_num()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.class_num
  from public.profiles as p
  where p.user_id = (select auth.uid());
$$;

create or replace function private.can_manage_request(target_class_num text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when (select private.current_role()) = 'admin' then true
    when (select private.current_role()) in ('teacher', 'helper')
      then (select private.current_class_num()) = target_class_num
    else false
  end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and old.role is distinct from new.role
    and coalesce((select private.current_role()), '') <> 'admin'
  then
    raise exception 'Only an administrator can change a user role.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger profiles_protect_role
before update on public.profiles
for each row execute function private.protect_profile_role();

create trigger notebooks_set_updated_at
before update on public.notebooks
for each row execute function private.set_updated_at();

create trigger laptop_requests_set_updated_at
before update on public.laptop_requests
for each row execute function private.set_updated_at();

create or replace function private.notify_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_message text;
begin
  if tg_op = 'INSERT' then
    v_title := '대여 신청이 접수되었습니다';
    v_message := case when new.type = 'home'
      then new.start_date::text || '부터 ' || new.end_date::text || '까지의 가정 대여 신청을 접수했습니다.'
      else coalesce(new.week_label, '교과 대여') || ' 신청을 접수했습니다.'
    end;
  elsif old.status is not distinct from new.status then
    return new;
  elsif new.status = 'approved' then
    v_title := '대여 신청이 승인되었습니다';
    v_message := new.notebook_number::text || '번 노트북이 배정되었습니다.';
  elsif new.status = 'rejected' then
    v_title := '대여 신청이 반려되었습니다';
    v_message := coalesce(nullif(btrim(new.review_note), ''), '신청 내용을 확인한 뒤 다시 신청해주세요.');
  elsif new.status = 'returned' then
    v_title := '노트북 반납이 완료되었습니다';
    v_message := new.notebook_number::text || '번 노트북 반납이 기록되었습니다.';
  elsif new.status = 'cancelled' then
    v_title := '대여 신청을 취소했습니다';
    v_message := '대기 중이던 대여 신청이 취소되었습니다.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, request_id, title, message)
  values (new.user_id, new.id, v_title, v_message);
  return new;
end;
$$;

create trigger laptop_requests_notify_insert
after insert on public.laptop_requests
for each row execute function private.notify_request_change();

create trigger laptop_requests_notify_status
after update of status on public.laptop_requests
for each row execute function private.notify_request_change();

create or replace function public.review_laptop_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.laptop_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.laptop_requests;
  v_notebook_number smallint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;
  if p_review_note is not null and char_length(p_review_note) > 500 then
    raise exception 'Review note is too long.' using errcode = '22023';
  end if;

  select * into v_request
  from public.laptop_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'The request does not exist or has already been processed.' using errcode = 'P0002';
  end if;
  if not (select private.can_manage_request(v_request.class_num)) then
    raise exception 'You cannot review this request.' using errcode = '42501';
  end if;

  if p_decision = 'approved' then
    select n.number into v_notebook_number
    from public.notebooks as n
    where n.condition = 'available'
      and not exists (
        select 1 from public.laptop_requests as active_request
        where active_request.notebook_number = n.number
          and active_request.status = 'approved'
      )
    order by n.number
    for update of n skip locked
    limit 1;

    if v_notebook_number is null then
      raise exception 'No notebook is currently available.' using errcode = 'P0001';
    end if;
  end if;

  update public.laptop_requests
  set status = p_decision,
      notebook_number = v_notebook_number,
      reviewed_by = (select auth.uid()),
      review_note = nullif(btrim(p_review_note), ''),
      reviewed_at = now()
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.cancel_laptop_request(p_request_id uuid)
returns public.laptop_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.laptop_requests;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_request
  from public.laptop_requests
  where id = p_request_id
    and user_id = (select auth.uid())
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'Only your own pending request can be cancelled.' using errcode = '42501';
  end if;

  update public.laptop_requests
  set status = 'cancelled'
  where id = p_request_id
  returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.return_laptop_request(p_request_id uuid)
returns public.laptop_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.laptop_requests;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_request
  from public.laptop_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'approved' then
    raise exception 'Only an approved request can be returned.' using errcode = 'P0002';
  end if;
  if not (select private.can_manage_request(v_request.class_num)) then
    raise exception 'You cannot return this request.' using errcode = '42501';
  end if;

  update public.laptop_requests
  set status = 'returned'
  where id = p_request_id
  returning * into v_request;
  return v_request;
end;
$$;

alter table public.profiles enable row level security;
alter table public.notebooks enable row level security;
alter table public.laptop_requests enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select_own
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_admin_select_all
on public.profiles for select to authenticated
using ((select private.current_role()) = 'admin');

create policy profiles_insert_own
on public.profiles for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    role = 'student'
    or role = (select auth.jwt() -> 'app_metadata' ->> 'role')
    or (select auth.jwt() -> 'app_metadata' -> 'roles') ? role
  )
);

create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy profiles_admin_update_all
on public.profiles for update to authenticated
using ((select private.current_role()) = 'admin')
with check ((select private.current_role()) = 'admin');

create policy notebooks_staff_select
on public.notebooks for select to authenticated
using ((select private.current_role()) in ('teacher', 'helper', 'admin'));

create policy laptop_requests_select_authorized
on public.laptop_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.can_manage_request(class_num))
);

create policy laptop_requests_insert_own
on public.laptop_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and notebook_number is null
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1
    from public.profiles as own_profile
    where own_profile.user_id = (select auth.uid())
      and own_profile.student_id = laptop_requests.student_id
      and own_profile.student_name = laptop_requests.user_name
      and own_profile.class_num = laptop_requests.class_num
      and own_profile.role in ('student', 'helper')
  )
);

create policy notifications_select_own
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create policy notifications_update_own
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.notebooks to authenticated;
grant select, insert on public.laptop_requests to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on function private.valid_rental_slots(jsonb) from public, anon;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.protect_profile_role() from public, anon, authenticated;
revoke all on function private.notify_request_change() from public, anon, authenticated;
revoke all on function private.current_role() from public, anon;
revoke all on function private.current_class_num() from public, anon;
revoke all on function private.can_manage_request(text) from public, anon;
grant execute on function private.current_role() to authenticated;
grant execute on function private.current_class_num() to authenticated;
grant execute on function private.can_manage_request(text) to authenticated;
grant execute on function private.valid_rental_slots(jsonb) to authenticated;

revoke all on function public.review_laptop_request(uuid, text, text) from public, anon;
revoke all on function public.cancel_laptop_request(uuid) from public, anon;
revoke all on function public.return_laptop_request(uuid) from public, anon;
grant execute on function public.review_laptop_request(uuid, text, text) to authenticated;
grant execute on function public.cancel_laptop_request(uuid) to authenticated;
grant execute on function public.return_laptop_request(uuid) to authenticated;

insert into public.notebooks (number, asset_tag)
select number, 'ICJS-NB-' || lpad(number::text, 2, '0')
from generate_series(1, 33) as number;
