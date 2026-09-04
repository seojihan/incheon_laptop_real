-- Explicitly keep every application table unavailable before authentication.
revoke all privileges on all tables in schema public from anon;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_admin_select_all on public.profiles;
create policy profiles_select_authorized
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.current_role()) = 'admin'
);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    role = 'student'
    or role = ((select auth.jwt()) -> 'app_metadata' ->> 'role')
    or (((select auth.jwt()) -> 'app_metadata' -> 'roles') ? role)
  )
);

drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_update_all on public.profiles;
create policy profiles_update_authorized
on public.profiles for update to authenticated
using (
  ((select auth.uid()) = user_id and (select private.current_role()) = 'student')
  or (select private.current_role()) = 'admin'
)
with check (
  ((select auth.uid()) = user_id and (select private.current_role()) = 'student')
  or (select private.current_role()) = 'admin'
);

-- Client profile writes never need to alter roles or audit timestamps directly.
revoke insert, update on public.profiles from authenticated;
grant insert (user_id, role, student_id, student_name, grade, class_num, metadata)
on public.profiles to authenticated;
grant update (student_id, student_name, grade, class_num, metadata)
on public.profiles to authenticated;

create or replace function public.set_profile_role(
  p_user_id uuid,
  p_role text,
  p_class_num text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if (select auth.uid()) is null or (select private.current_role()) <> 'admin' then
    raise exception 'Only an administrator can assign roles.' using errcode = '42501';
  end if;
  if p_role not in ('student', 'teacher', 'helper', 'admin') then
    raise exception 'Invalid role.' using errcode = '22023';
  end if;

  update public.profiles
  set role = p_role,
      class_num = case
        when p_role = 'teacher' then p_class_num
        else class_num
      end,
      student_id = case when p_role = 'teacher' then null else student_id end,
      grade = case when p_role = 'teacher' then null else grade end
  where user_id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

revoke all on function public.set_profile_role(uuid, text, text) from public, anon;
grant execute on function public.set_profile_role(uuid, text, text) to authenticated;
