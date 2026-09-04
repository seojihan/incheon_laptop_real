drop policy if exists internal_help_articles_select_by_role on public.internal_help_articles;
drop policy if exists internal_help_articles_admin_manage on public.internal_help_articles;

create policy internal_help_articles_select_authorized
on public.internal_help_articles for select to authenticated
using (
  (select private.current_role()) = 'admin'
  or (
    published
    and (select private.current_role()) = any(allowed_roles)
  )
);

create policy internal_help_articles_admin_insert
on public.internal_help_articles for insert to authenticated
with check ((select private.current_role()) = 'admin');

create policy internal_help_articles_admin_update
on public.internal_help_articles for update to authenticated
using ((select private.current_role()) = 'admin')
with check ((select private.current_role()) = 'admin');

create policy internal_help_articles_admin_delete
on public.internal_help_articles for delete to authenticated
using ((select private.current_role()) = 'admin');
