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
  left join public.laptop_requests as home_request
    on home_request.notebook_number = notebook.number
    and home_request.type = 'home'
    and home_request.status in ('approved', 'returned')
  group by notebook.number, active_request.type, active_request.start_date, active_request.end_date
  order by notebook.number;
end;
$$;

revoke all on function public.get_notebook_inventory_summary() from public, anon;
grant execute on function public.get_notebook_inventory_summary() to authenticated;

create or replace function private.guard_notebook_inventory_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if new.condition is distinct from old.condition
    and exists (
      select 1
      from public.laptop_requests as request
      where request.notebook_number = old.number
        and request.status = 'approved'
    )
  then
    raise exception '대여 중인 장비의 상태는 반납 처리한 뒤 변경할 수 있습니다.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_notebook_inventory_update() from public, anon, authenticated;
