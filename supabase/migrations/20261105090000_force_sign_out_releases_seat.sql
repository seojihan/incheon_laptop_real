-- A sign-out by a teacher or admin now gives the seat back: the class number and
-- any helper role are released and open rentals are closed, whatever their state.
-- The person starts from profile entry on their next login, and may pick any free
-- number. Rows are archived rather than deleted. A student's own sign-out is
-- unaffected, because it never reaches this function.
create or replace function public.force_student_sign_out(p_user_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_user_ids uuid[];
  v_returned integer := 0;
  v_cancelled integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  v_role := coalesce((select private.current_role()), '');
  if v_role not in ('teacher', 'admin') then
    raise exception '담임 선생님 또는 관리자만 로그아웃 처리할 수 있습니다.' using errcode = '42501';
  end if;
  if v_role = 'teacher' and ((select private.current_grade()) is null or (select private.current_class_num()) is null) then
    raise exception '담임 반 정보를 확인할 수 없습니다.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_user_ids), 0) not between 1 and 200 then
    raise exception '로그아웃할 학생을 선택해주세요.' using errcode = '22023';
  end if;

  with targets as (
    select p.user_id
    from public.profiles as p
    where p.user_id = any(p_user_ids)
      and p.role in ('student', 'helper')
      and p.archived_at is null
      and (
        v_role = 'admin'
        or (p.grade = (select private.current_grade()) and p.class_num = (select private.current_class_num()))
      )
    for update of p
  )
  select coalesce(array_agg(targets.user_id), array[]::uuid[]) into v_user_ids from targets;

  if cardinality(v_user_ids) = 0 then
    raise exception '담당 범위에서 활성 학생 계정을 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  select
    count(*) filter (where r.status = 'approved'),
    count(*) filter (where r.status = 'pending')
  into v_returned, v_cancelled
  from public.laptop_requests as r
  where r.user_id = any(v_user_ids) and r.archived_at is null;

  -- Closing an approved request is what frees its notebook.
  update public.laptop_requests as r
  set status = case r.status when 'approved' then 'returned' when 'pending' then 'cancelled' else r.status end,
      archived_at = now()
  where r.user_id = any(v_user_ids) and r.archived_at is null;

  -- After the update above, so the notices its trigger just wrote are archived too.
  update public.notifications as n
  set archived_at = now()
  where n.user_id = any(v_user_ids) and n.archived_at is null;

  -- The unique index on student_id only covers active profiles, so this frees the number.
  update public.profiles as p
  set session_reset_at = now(),
      archived_at = now(),
      role = 'student'
  where p.user_id = any(v_user_ids);

  -- Stops token refresh on every device. The page also watches session_reset_at
  -- to sign out right away, so that remains in force if this step is refused.
  begin
    delete from auth.sessions where user_id = any(v_user_ids);
    delete from auth.refresh_tokens where user_id = any(select id::text from unnest(v_user_ids) as id);
  exception when insufficient_privilege or undefined_table then
    null;
  end;

  return jsonb_build_object('signed_out', cardinality(v_user_ids), 'returned', v_returned, 'cancelled', v_cancelled);
end;
$$;

revoke all on function public.force_student_sign_out(uuid[]) from public, anon;
grant execute on function public.force_student_sign_out(uuid[]) to authenticated;
