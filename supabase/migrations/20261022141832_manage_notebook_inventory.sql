create policy notebooks_staff_update
on public.notebooks for update to authenticated
using ((select private.current_role()) in ('teacher', 'helper', 'admin'))
with check ((select private.current_role()) in ('teacher', 'helper', 'admin'));

grant update (condition, note) on public.notebooks to authenticated;

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

  if (new.condition is distinct from old.condition
      or new.note is distinct from old.note)
    and exists (
      select 1
      from public.laptop_requests as request
      where request.notebook_number = old.number
        and request.status = 'approved'
    )
  then
    raise exception '대여 중인 장비는 반납 처리한 뒤 상태를 바꿀 수 있습니다.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger notebooks_guard_active_rental
before update of condition, note on public.notebooks
for each row execute function private.guard_notebook_inventory_update();

revoke all on function private.guard_notebook_inventory_update() from public, anon, authenticated;
