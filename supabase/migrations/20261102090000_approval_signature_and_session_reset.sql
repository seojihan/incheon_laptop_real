-- 1) Teacher/admin approvals carry a hand-drawn signature. One signature row can
--    cover many requests, so a bulk approval stores the image only once.
-- 2) Rejections require a reason.
-- 3) A teacher/admin can end a student's sessions without blocking the account.

create table public.approval_signatures (
  id uuid primary key default gen_random_uuid(),
  signed_by uuid references public.profiles (user_id) on delete set null,
  signer_name text not null check (char_length(btrim(signer_name)) between 1 and 40),
  signature_data text not null check (
    signature_data ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
    and char_length(signature_data) <= 200000
  ),
  created_at timestamptz not null default now()
);

create index approval_signatures_signed_by_idx
on public.approval_signatures (signed_by)
where signed_by is not null;

alter table public.laptop_requests
  add column approval_signature_id uuid references public.approval_signatures (id) on delete set null;

create index laptop_requests_approval_signature_idx
on public.laptop_requests (approval_signature_id)
where approval_signature_id is not null;

alter table public.approval_signatures enable row level security;

revoke all on public.approval_signatures from anon, authenticated;
grant select on public.approval_signatures to authenticated;

-- Students and helpers never read a teacher's signature image.
create policy approval_signatures_read_authorized
on public.approval_signatures for select to authenticated
using (
  (select private.current_role()) = 'admin'
  or (
    (select private.current_role()) = 'teacher'
    and (
      signed_by = (select auth.uid())
      or exists (
        select 1 from public.laptop_requests as request
        where request.approval_signature_id = approval_signatures.id
      )
    )
  )
);

-- Clients keep a table-level INSERT grant, so a new request must not be able to
-- attach a signature to itself.
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
  and approval_signature_id is null
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

create or replace function private.review_one_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text,
  p_signature_id uuid
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
  select * into v_request
  from public.laptop_requests
  where id = p_request_id and archived_at is null
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception '이미 처리되었거나 존재하지 않는 신청입니다.' using errcode = 'P0002';
  end if;
  if not (select private.can_manage_request(v_request.grade, v_request.class_num, v_request.user_id)) then
    raise exception '이 신청을 처리할 권한이 없습니다.' using errcode = '42501';
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
      raise exception '현재 대여 가능한 노트북이 없습니다.' using errcode = 'P0001';
    end if;
  end if;

  update public.laptop_requests
  set status = p_decision,
      notebook_number = v_notebook_number,
      reviewed_by = (select auth.uid()),
      review_note = nullif(btrim(p_review_note), ''),
      reviewed_at = now(),
      approval_signature_id = case when p_decision = 'approved' then p_signature_id else null end
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function private.review_one_request(uuid, text, text, uuid) from public, anon, authenticated;

-- Each request succeeds or fails on its own, so one request taken by another
-- reviewer does not undo the rest of a bulk action.
create or replace function public.review_laptop_requests(
  p_request_ids uuid[],
  p_decision text,
  p_review_note text default null,
  p_signature text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
  v_signature_id uuid;
  v_id uuid;
  v_processed jsonb := '[]'::jsonb;
  v_failed jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  v_role := coalesce((select private.current_role()), '');
  if v_role not in ('teacher', 'helper', 'admin') then
    raise exception '이 신청을 처리할 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception '처리 방식이 올바르지 않습니다.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_request_ids), 0) not between 1 and 100 then
    raise exception '한 번에 1건 이상 100건 이하로 처리할 수 있습니다.' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception '사유는 500자 이내로 입력해주세요.' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and v_note is null then
    raise exception '반려 사유를 입력해주세요.' using errcode = '22023';
  end if;

  if p_decision = 'approved' and v_role in ('teacher', 'admin') then
    if p_signature is null
      or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
      or char_length(p_signature) > 200000
    then
      raise exception '승인 서명을 다시 입력해주세요.' using errcode = '22023';
    end if;

    insert into public.approval_signatures (signed_by, signer_name, signature_data)
    select p.user_id, left(p.student_name, 40), p_signature
    from public.profiles as p
    where p.user_id = (select auth.uid())
    returning id into v_signature_id;
  end if;

  for v_id in select distinct unnest(p_request_ids) loop
    begin
      perform private.review_one_request(v_id, p_decision, v_note, v_signature_id);
      v_processed := v_processed || to_jsonb(v_id);
    exception when others then
      v_failed := v_failed || jsonb_build_object(
        'id', v_id,
        'message', case
          when sqlstate in ('P0001', 'P0002', '42501') then sqlerrm
          else '처리 중 오류가 발생했습니다.'
        end
      );
    end;
  end loop;

  -- No request kept this signature, so do not retain the image.
  if v_signature_id is not null and jsonb_array_length(v_processed) = 0 then
    delete from public.approval_signatures where id = v_signature_id;
  end if;

  return jsonb_build_object('processed', v_processed, 'failed', v_failed);
end;
$$;

revoke all on function public.review_laptop_requests(uuid[], text, text, text) from public, anon;
grant execute on function public.review_laptop_requests(uuid[], text, text, text) to authenticated;

-- The single-request RPC stays for tabs still running the previous page, but it
-- can no longer skip the signature or the rejection reason.
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
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;
  if p_review_note is not null and char_length(p_review_note) > 500 then
    raise exception '사유는 500자 이내로 입력해주세요.' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and nullif(btrim(coalesce(p_review_note, '')), '') is null then
    raise exception '반려 사유를 입력해주세요.' using errcode = '22023';
  end if;
  if p_decision = 'approved' and coalesce((select private.current_role()), '') in ('teacher', 'admin') then
    raise exception '승인에는 서명이 필요합니다. 페이지를 새로고침한 뒤 다시 시도해주세요.' using errcode = '22023';
  end if;

  return private.review_one_request(p_request_id, p_decision, p_review_note, null);
end;
$$;

-- Forced sign-out. session_reset_at is readable but not client-writable: profile
-- UPDATE is granted per column and this column is not among them.
alter table public.profiles
  add column session_reset_at timestamptz;

grant select (session_reset_at) on public.profiles to authenticated;

create or replace function public.force_student_sign_out(p_user_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_user_ids uuid[];
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

  with updated as (
    update public.profiles as p
    set session_reset_at = now()
    where p.user_id = any(p_user_ids)
      and p.role in ('student', 'helper')
      and p.archived_at is null
      and (
        v_role = 'admin'
        or (p.grade = (select private.current_grade()) and p.class_num = (select private.current_class_num()))
      )
    returning p.user_id
  )
  select coalesce(array_agg(updated.user_id), array[]::uuid[]) into v_user_ids from updated;

  if cardinality(v_user_ids) = 0 then
    raise exception '담당 범위에서 활성 학생 계정을 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  -- Stops token refresh on every device. The page also watches session_reset_at
  -- to sign out right away, so that remains in force if this step is refused.
  begin
    delete from auth.sessions where user_id = any(v_user_ids);
    delete from auth.refresh_tokens where user_id = any(select id::text from unnest(v_user_ids) as id);
  exception when insufficient_privilege or undefined_table then
    null;
  end;

  return jsonb_build_object('signed_out', cardinality(v_user_ids));
end;
$$;

revoke all on function public.force_student_sign_out(uuid[]) from public, anon;
grant execute on function public.force_student_sign_out(uuid[]) to authenticated;

create or replace function public.list_manageable_students()
returns table (
  user_id uuid,
  role text,
  student_id text,
  student_name text,
  grade text,
  class_num text,
  last_sign_in_at timestamptz,
  session_reset_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := coalesce((select private.current_role()), '');
  if (select auth.uid()) is null or v_role not in ('teacher', 'admin') then
    raise exception '학생 정보를 조회할 권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  select p.user_id, p.role, p.student_id, p.student_name, p.grade, p.class_num, u.last_sign_in_at, p.session_reset_at
  from public.profiles as p
  left join auth.users as u on u.id = p.user_id
  where p.archived_at is null
    and p.role in ('student', 'helper')
    and (
      v_role = 'admin'
      or (p.grade = (select private.current_grade()) and p.class_num = (select private.current_class_num()))
    )
  order by p.student_id, p.student_name;
end;
$$;

revoke all on function public.list_manageable_students() from public, anon;
grant execute on function public.list_manageable_students() to authenticated;
