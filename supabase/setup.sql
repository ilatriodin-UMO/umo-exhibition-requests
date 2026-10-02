-- Dedicated exhibition tables/functions only. Does not modify partner_requests or employees.
-- Apply once in Supabase SQL Editor as the project administrator.
begin;
create table public.exhibition_requests (
 id uuid primary key,
 phone text not null check (phone ~ '^\+[1-9][0-9]{9,14}$'),
 name text not null check (char_length(name) between 2 and 100),
 inn text not null check (inn ~ '^([0-9]{10}|[0-9]{12})$'),
 model text not null check (char_length(model) between 1 and 150),
 quantity integer not null check (quantity between 1 and 100000),
 created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index exhibition_requests_created on public.exhibition_requests(created_at,id);
create index exhibition_requests_phone_created on public.exhibition_requests(phone,created_at);
alter table public.exhibition_requests enable row level security;
revoke all on public.exhibition_requests from public,anon,authenticated;
grant select on public.exhibition_requests to authenticated;

create table public.exhibition_owners (user_id uuid primary key references auth.users(id));
alter table public.exhibition_owners enable row level security;
revoke all on public.exhibition_owners from public,anon,authenticated;

create function public.is_exhibition_owner() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users u join public.exhibition_owners o on o.user_id=u.id where u.id=auth.uid()
 and u.email_confirmed_at is not null);
$$;
revoke all on function public.is_exhibition_owner() from public,anon,authenticated;
grant execute on function public.is_exhibition_owner() to authenticated;
create policy exhibition_owner_read on public.exhibition_requests
for select to authenticated using ((select public.is_exhibition_owner()));

create function public.exhibition_valid_inn(value text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare weights integer[]; total integer; pos integer; digit integer;
begin
 if value is null or value !~ '^([0-9]{10}|[0-9]{12})$' or value ~ '^0+$' then return false; end if;
 if length(value)=10 then
  weights:=array[2,4,10,3,5,9,4,6,8];total:=0;
  for pos in 1..9 loop total:=total+weights[pos]*substring(value,pos,1)::integer;end loop;
  return (total%11)%10=substring(value,10,1)::integer;
 end if;
 weights:=array[7,2,4,10,3,5,9,4,6,8];total:=0;
 for pos in 1..10 loop total:=total+weights[pos]*substring(value,pos,1)::integer;end loop;
 if (total%11)%10<>substring(value,11,1)::integer then return false;end if;
 weights:=array[3,7,2,4,10,3,5,9,4,6,8];total:=0;
 for pos in 1..11 loop total:=total+weights[pos]*substring(value,pos,1)::integer;end loop;
 return (total%11)%10=substring(value,12,1)::integer;
end;
$$;
revoke all on function public.exhibition_valid_inn(text) from public,anon,authenticated;

create function public.submit_exhibition_request(
 p_id uuid,p_phone text,p_name text,p_inn text,p_model text,p_quantity integer,p_website text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare normalized_phone text;normalized_name text;normalized_model text;normalized_inn text;
begin
 if p_id is null or coalesce(p_website,'')<>'' then raise exception 'validation_failed' using errcode='22023';end if;
 normalized_phone:=pg_catalog.regexp_replace(p_phone,'[[:space:]()+-]','','g');
 if length(normalized_phone)=11 and left(normalized_phone,1)='8' then normalized_phone:='7'||substring(normalized_phone,2);end if;
 normalized_phone:='+'||normalized_phone;normalized_name:=pg_catalog.btrim(p_name);normalized_model:=pg_catalog.btrim(p_model);normalized_inn:=pg_catalog.btrim(p_inn);
 if normalized_phone is null or normalized_phone !~ '^\+[1-9][0-9]{9,14}$'
 or normalized_name is null or char_length(normalized_name) not between 2 and 100 or normalized_name ~ '[[:cntrl:]<>]'
 or normalized_model is null or char_length(normalized_model) not between 1 and 150 or normalized_model ~ '[[:cntrl:]<>]'
 or not public.exhibition_valid_inn(normalized_inn)
 or p_quantity is null or p_quantity not between 1 and 100000
 then raise exception 'validation_failed' using errcode='22023';end if;
 -- Serialize quota checking and insertion, including concurrent calls from different browsers.
 perform pg_catalog.pg_advisory_xact_lock(19871991,1);
 if exists(select 1 from public.exhibition_requests where id=p_id) then return jsonb_build_object('ok',true);end if;
 if (select count(*) from public.exhibition_requests where phone=normalized_phone and created_at>pg_catalog.now()-interval '1 hour')>=10
 or (select count(*) from public.exhibition_requests where created_at>pg_catalog.now()-interval '1 hour')>=2000
 then raise exception 'rate_limit' using errcode='P0001';end if;
 insert into public.exhibition_requests(id,phone,name,inn,model,quantity)
 values(p_id,normalized_phone,normalized_name,normalized_inn,normalized_model,p_quantity);
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.submit_exhibition_request(uuid,text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.submit_exhibition_request(uuid,text,text,text,text,integer,text) to anon,authenticated;
commit;

