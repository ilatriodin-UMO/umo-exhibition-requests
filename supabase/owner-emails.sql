-- Apply after setup.sql. Add approved emails privately in SQL Editor, never in the public repository.
begin;
create table public.exhibition_owner_emails(email text primary key check(email=lower(email)));
alter table public.exhibition_owner_emails enable row level security;
revoke all on public.exhibition_owner_emails from public,anon,authenticated;
create or replace function public.is_exhibition_owner() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid()
 and u.email_confirmed_at is not null and (
 exists(select 1 from public.exhibition_owners o where o.user_id=u.id)
 or exists(select 1 from public.exhibition_owner_emails e where e.email=lower(u.email))));
$$;
commit;
