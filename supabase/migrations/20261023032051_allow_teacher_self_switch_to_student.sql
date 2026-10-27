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

    -- A user may explicitly switch from teacher to student, which only
    -- reduces access. The profiles table constraints validate the student data.
    if old.user_id = (select auth.uid())
      and old.role = 'teacher'
      and new.role = 'student'
      and new.student_id is not null
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
