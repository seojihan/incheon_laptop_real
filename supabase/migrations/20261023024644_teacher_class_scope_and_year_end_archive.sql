alter table public.profiles
  add column if not exists archived_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_required_fields;
alter table public.profiles
  add constraint profiles_required_fields check (
    (role in ('student', 'helper') and student_id is not null and grade is not null and class_num is not null)
    or (role = 'teacher' and student_id is null and grade is not null and class_num is not null)
    or role = 'admin'
  ) not valid;

alter table public.laptop_requests
  add column if not exists grade text,
  add column if not exists archived_at timestamptz;

update public.laptop_requests
set grade = left(student_id, 1)
where grade is null;

alter table public.laptop_requests
  alter column grade set not null;

alter table public.laptop_requests
  add constraint laptop_requests_grade_format check (grade ~ '^[1-3]$');

alter table public.notifications
  add column if not exists archived_at timestamptz;

drop index if exists public.profiles_student_id_unique_idx;
create unique index profiles_student_id_unique_idx
on public.profiles (student_id)
where student_id is not null and archived_at is null;

create index if not exists laptop_requests_grade_class_status_idx
on public.laptop_requests (grade, class_num, status, created_at desc)
where archived_at is null;

create table public.class_archive_runs (
  id uuid primary key default gen_random_uuid(),
  grade text not null check (grade ~ '^[1-3]$'),
  class_num text not null check (class_num ~ '^(0[1-9]|1[0-9]|20)$'),
  archived_by uuid not null references public.profiles (user_id) on delete restrict,
  archived_profiles_count integer not null default 0,
  archived_requests_count integer not null default 0,
  archived_notifications_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.class_archive_runs enable row level security;

revoke all on public.class_archive_runs from anon, authenticated;
grant select on public.class_archive_runs to authenticated;

create policy class_archive_runs_read_authorized
on public.class_archive_runs for select to authenticated
using (archived_by = (select auth.uid()) or (select private.current_role()) = 'admin');

create or replace function private.current_grade()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.grade
  from public.profiles as p
  where p.user_id = (select auth.uid())
    and p.archived_at is null;
$$;

create or replace function private.can_manage_request(target_grade text, target_class_num text)
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
      then (select private.current_grade()) = target_grade
        and (select private.current_class_num()) = target_class_num
    else false
  end;
$$;

create or replace function private.can_manage_request(target_grade text, target_class_num text, target_student_user_id uuid)
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
      then (select private.current_grade()) = target_grade
        and (select private.current_class_num()) = target_class_num
        and exists (
          select 1 from public.profiles as student_profile
          where student_profile.user_id = target_student_user_id
            and student_profile.role in ('student', 'helper')
            and student_profile.archived_at is null
            and student_profile.grade = target_grade
            and student_profile.class_num = target_class_num
        )
    else false
  end;
$$;

revoke all on function private.current_grade() from public, anon;
revoke all on function private.can_manage_request(text, text) from public, anon;
revoke all on function private.can_manage_request(text, text, uuid) from public, anon;
grant execute on function private.current_grade() to authenticated;
grant execute on function private.can_manage_request(text, text) to authenticated;
grant execute on function private.can_manage_request(text, text, uuid) to authenticated;

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.current_role()) = 'admin'
  or (
    (select private.current_role()) = 'teacher'
    and role in ('student', 'helper')
    and archived_at is null
    and grade = (select private.current_grade())
    and class_num = (select private.current_class_num())
  )
);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and role in ('student', 'teacher')
  and archived_at is null
);

drop policy if exists profiles_update_authorized on public.profiles;
create policy profiles_update_authorized
on public.profiles for update to authenticated
using (
  ((select auth.uid()) = user_id and (select private.current_role()) in ('student', 'helper', 'teacher'))
  or (select private.current_role()) = 'admin'
)
with check (
  ((select auth.uid()) = user_id and (select private.current_role()) in ('student', 'helper', 'teacher'))
  or (select private.current_role()) = 'admin'
);

revoke select on public.profiles from authenticated;
grant select (user_id, role, student_id, student_name, grade, class_num, created_at, updated_at, archived_at)
on public.profiles to authenticated;

drop policy if exists laptop_requests_select_authorized on public.laptop_requests;
create policy laptop_requests_select_authorized
on public.laptop_requests for select to authenticated
using (
  archived_at is null
  and (user_id = (select auth.uid()) or (select private.can_manage_request(grade, class_num, user_id)))
);

drop policy if exists laptop_requests_insert_own on public.laptop_requests;
create policy laptop_requests_insert_own
on public.laptop_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and archived_at is null
  and status = 'pending'
  and notebook_number is null
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1
    from public.profiles as own_profile
    where own_profile.user_id = (select auth.uid())
      and own_profile.archived_at is null
      and own_profile.student_id = laptop_requests.student_id
      and own_profile.student_name = laptop_requests.user_name
      and own_profile.grade = laptop_requests.grade
      and own_profile.class_num = laptop_requests.class_num
      and own_profile.role in ('student', 'helper')
  )
);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications for select to authenticated
using (user_id = (select auth.uid()) and archived_at is null);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications for update to authenticated
using (user_id = (select auth.uid()) and archived_at is null)
with check (user_id = (select auth.uid()) and archived_at is null);

create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and old.role is distinct from new.role then
    if coalesce((select private.current_role()), '') = 'admin' then
      return new;
    end if;

    if coalesce((select private.current_role()), '') = 'teacher'
      and old.role in ('student', 'helper')
      and new.role in ('student', 'helper')
      and old.grade = (select private.current_grade())
      and old.class_num = (select private.current_class_num())
      and new.grade = old.grade
      and new.class_num = old.class_num
    then
      return new;
    end if;

    if old.user_id = (select auth.uid())
      and old.role in ('student', 'helper')
      and new.role = 'student'
      and old.grade = new.grade
      and old.class_num = new.class_num
    then
      return new;
    end if;

    if old.user_id = (select auth.uid())
      and old.role in ('student', 'helper')
      and new.role = 'teacher'
      and new.student_id is null
      and new.grade is not null
      and new.class_num is not null
    then
      return new;
    end if;

    raise exception 'Only an administrator can change this user role.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.list_teacher_class_members()
returns table (user_id uuid, role text, student_id text, student_name text, grade text, class_num text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or coalesce((select private.current_role()), '') <> 'teacher'
    or (select private.current_grade()) is null or (select private.current_class_num()) is null
  then
    raise exception '담임 반 정보를 확인할 수 없습니다.' using errcode = '42501';
  end if;

  return query
  select p.user_id, p.role, p.student_id, p.student_name, p.grade, p.class_num
  from public.profiles as p
  where p.archived_at is null
    and p.role in ('student', 'helper')
    and p.grade = (select private.current_grade())
    and p.class_num = (select private.current_class_num())
  order by p.student_id, p.student_name;
end;
$$;

create or replace function public.set_class_notebook_helper(p_user_id uuid, p_is_helper boolean)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if (select auth.uid()) is null or coalesce((select private.current_role()), '') <> 'teacher'
    or (select private.current_grade()) is null or (select private.current_class_num()) is null
  then
    raise exception '담임 선생님만 도우미를 지정할 수 있습니다.' using errcode = '42501';
  end if;

  update public.profiles as p
  set role = case when p_is_helper then 'helper' else 'student' end
  where p.user_id = p_user_id
    and p.role in ('student', 'helper')
    and p.archived_at is null
    and p.grade = (select private.current_grade())
    and p.class_num = (select private.current_class_num())
  returning p.* into v_profile;

  if not found then
    raise exception '담임 반에서 활성 학생 계정을 찾지 못했습니다.' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

create or replace function public.archive_teacher_class_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grade text;
  v_class_num text;
  v_user_ids uuid[];
  v_profile_count integer := 0;
  v_request_count integer := 0;
  v_notification_count integer := 0;
  v_run_id uuid;
begin
  if (select auth.uid()) is null or coalesce((select private.current_role()), '') <> 'teacher'
    or (select private.current_grade()) is null or (select private.current_class_num()) is null
  then
    raise exception '담임 선생님만 담당 반을 보관 처리할 수 있습니다.' using errcode = '42501';
  end if;

  v_grade := (select private.current_grade());
  v_class_num := (select private.current_class_num());
  select coalesce(array_agg(p.user_id), array[]::uuid[])
  into v_user_ids
  from public.profiles as p
  where p.archived_at is null and p.role in ('student', 'helper')
    and p.grade = v_grade and p.class_num = v_class_num;

  if exists (
    select 1 from public.laptop_requests as r
    where r.archived_at is null and r.user_id = any(v_user_ids)
      and r.grade = v_grade and r.class_num = v_class_num
      and r.status = 'approved'
  ) then
    raise exception '반납 확인이 끝나지 않은 대여가 있습니다. 모든 노트북을 반납 처리한 뒤 다시 실행해주세요.' using errcode = 'P0001';
  end if;

  update public.laptop_requests as r
  set status = case when r.status = 'pending' then 'cancelled' else r.status end,
      archived_at = now()
  where r.archived_at is null and r.user_id = any(v_user_ids)
    and r.grade = v_grade and r.class_num = v_class_num;
  get diagnostics v_request_count = row_count;

  update public.notifications as n
  set archived_at = now()
  where n.archived_at is null
    and (n.user_id = any(v_user_ids) or n.request_id in (
      select r.id from public.laptop_requests as r
      where r.archived_at is not null and r.user_id = any(v_user_ids)
        and r.grade = v_grade and r.class_num = v_class_num
    ));
  get diagnostics v_notification_count = row_count;

  update public.profiles as p
  set archived_at = now()
  where p.user_id = any(v_user_ids) and p.archived_at is null;
  get diagnostics v_profile_count = row_count;

  insert into public.class_archive_runs (
    grade, class_num, archived_by, archived_profiles_count, archived_requests_count, archived_notifications_count
  ) values (
    v_grade, v_class_num, (select auth.uid()), v_profile_count, v_request_count, v_notification_count
  ) returning id into v_run_id;

  return jsonb_build_object(
    'archive_id', v_run_id,
    'grade', v_grade,
    'class_num', v_class_num,
    'profiles', v_profile_count,
    'requests', v_request_count,
    'notifications', v_notification_count
  );
end;
$$;

create or replace function public.reactivate_archived_student(
  p_student_name text,
  p_student_id text,
  p_grade text,
  p_class_num text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception '로그인 후 다시 등록할 수 있습니다.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_student_name, ''))) not between 2 and 40
    or p_grade !~ '^[1-3]$'
    or p_class_num !~ '^(0[1-9]|1[0-9]|20)$'
    or p_student_id !~ '^[1-3][0-9]{4}$'
    or left(p_student_id, 1) <> p_grade
    or substring(p_student_id from 2 for 2) <> p_class_num
  then
    raise exception '이름, 학번, 학년, 반을 확인해주세요.' using errcode = '22023';
  end if;

  update public.profiles as p
  set role = 'student',
      student_name = btrim(p_student_name),
      student_id = p_student_id,
      grade = p_grade,
      class_num = p_class_num,
      archived_at = null,
      updated_at = now()
  where p.user_id = (select auth.uid())
    and p.archived_at is not null
    and p.role in ('student', 'helper')
  returning p.* into v_profile;

  if not found then
    raise exception '보관된 학생 계정을 찾지 못했습니다.' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

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

  select * into v_request from public.laptop_requests where id = p_request_id and archived_at is null for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'The request does not exist or has already been processed.' using errcode = 'P0002';
  end if;
  if not (select private.can_manage_request(v_request.grade, v_request.class_num, v_request.user_id)) then
    raise exception 'You cannot review this request.' using errcode = '42501';
  end if;

  if p_decision = 'approved' then
    select n.number into v_notebook_number
    from public.notebooks as n
    where n.condition = 'available'
      and not exists (select 1 from public.laptop_requests as active_request where active_request.notebook_number = n.number and active_request.status = 'approved')
    order by n.number for update of n skip locked limit 1;
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
  where id = p_request_id returning * into v_request;
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
  select * into v_request from public.laptop_requests where id = p_request_id and archived_at is null for update;
  if not found or v_request.status <> 'approved' then
    raise exception 'Only an approved request can be returned.' using errcode = 'P0002';
  end if;
  if not (select private.can_manage_request(v_request.grade, v_request.class_num, v_request.user_id)) then
    raise exception 'You cannot return this request.' using errcode = '42501';
  end if;
  update public.laptop_requests set status = 'returned' where id = p_request_id returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.get_notebook_inventory_summary()
returns table (
  notebook_number smallint,
  active_request_type text,
  active_start_date date,
  active_end_date date,
  home_rental_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or coalesce((select private.current_role()), '') not in ('teacher', 'helper', 'admin')
  then
    raise exception '장비 현황을 조회할 권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  select
    notebook.number,
    active_request.type,
    active_request.start_date,
    active_request.end_date,
    count(home_request.id)::bigint
  from public.notebooks as notebook
  left join public.laptop_requests as active_request
    on active_request.notebook_number = notebook.number
    and active_request.status = 'approved'
    and active_request.archived_at is null
  left join public.laptop_requests as home_request
    on home_request.notebook_number = notebook.number
    and home_request.type = 'home'
    and home_request.status in ('approved', 'returned')
    and home_request.archived_at is null
  group by notebook.number, active_request.type, active_request.start_date, active_request.end_date
  order by notebook.number;
end;
$$;

revoke all on function public.get_notebook_inventory_summary() from public, anon;
grant execute on function public.get_notebook_inventory_summary() to authenticated;

revoke all on function public.list_teacher_class_members() from public, anon;
revoke all on function public.set_class_notebook_helper(uuid, boolean) from public, anon;
revoke all on function public.archive_teacher_class_data() from public, anon;
revoke all on function public.reactivate_archived_student(text, text, text, text) from public, anon;
revoke all on function public.review_laptop_request(uuid, text, text) from public, anon;
revoke all on function public.return_laptop_request(uuid) from public, anon;

grant execute on function public.list_teacher_class_members() to authenticated;
grant execute on function public.set_class_notebook_helper(uuid, boolean) to authenticated;
grant execute on function public.archive_teacher_class_data() to authenticated;
grant execute on function public.reactivate_archived_student(text, text, text, text) to authenticated;
grant execute on function public.review_laptop_request(uuid, text, text) to authenticated;
grant execute on function public.return_laptop_request(uuid) to authenticated;
