-- Run in the Supabase SQL editor as the project administrator.
-- Only authenticated owners can read saves; all writes go through version/lease checks.
begin;
create table public.at_worlds (
  owner uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  payload jsonb not null,
  device uuid not null,
  request_id uuid not null,
  updated_at timestamptz not null default now()
);
create table public.at_versions (
  owner uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  updated_at timestamptz not null,
  primary key (owner, revision)
);
create table public.at_leases (
  owner uuid primary key references auth.users(id) on delete cascade,
  device uuid not null,
  label text not null,
  expires_at timestamptz not null
);
alter table public.at_worlds enable row level security;
alter table public.at_versions enable row level security;
alter table public.at_leases enable row level security;
revoke all on public.at_worlds, public.at_versions, public.at_leases from anon, authenticated;
grant select on public.at_worlds, public.at_versions, public.at_leases to authenticated;
create policy owner_reads on public.at_worlds for select to authenticated using (owner = (select auth.uid()));
create policy owner_reads on public.at_versions for select to authenticated using (owner = (select auth.uid()));
create policy owner_reads on public.at_leases for select to authenticated using (owner = (select auth.uid()));

create function public.at_claim(p_account uuid, p_device uuid, p_label text, p_takeover boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); item public.at_leases;
begin
  if u is null or p_account is distinct from u then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_device is null or p_takeover is null or p_label is null or length(p_label) not between 1 and 60 then
    raise exception 'invalid_device' using errcode = '22023';
  end if;
  insert into public.at_leases as lease (owner, device, label, expires_at)
    values (u, p_device, p_label, clock_timestamp() + interval '150 seconds')
    on conflict (owner) do update set device = excluded.device, label = excluded.label, expires_at = excluded.expires_at
    where lease.device = p_device or lease.expires_at <= clock_timestamp() or p_takeover
    returning * into item;
  if item.owner is null then
    select * into item from public.at_leases where owner = u;
    return jsonb_build_object('ok', false, 'label', item.label, 'expiresAt', item.expires_at);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.at_push(p_account uuid, p_device uuid, p_expected bigint, p_request uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); lease public.at_leases; current public.at_worlds; next_revision bigint;
begin
  if u is null or p_account is distinct from u then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expected is null or p_expected < 0 or p_request is null or p_device is null or p_payload is null
    or octet_length(p_payload::text) > 16777216
    or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload->>'version' is distinct from '1'
    or jsonb_typeof(p_payload->'character') is distinct from 'object'
    or jsonb_typeof(p_payload->'lastReal') is distinct from 'number'
  then raise exception 'invalid_save' using errcode = '22023'; end if;
  -- Lock the per-account lease even when no save exists, serializing first creation too.
  select * into lease from public.at_leases where owner = u for update;
  if p_device is null or lease.owner is null or lease.device <> p_device or lease.expires_at <= clock_timestamp() then
    return jsonb_build_object('ok', false, 'reason', 'lease');
  end if;
  select * into current from public.at_worlds where owner = u for update;
  if current.request_id = p_request then
    return jsonb_build_object('ok', true, 'revision', current.revision);
  end if;
  if coalesce(current.revision, 0) <> p_expected then
    return jsonb_build_object('ok', false, 'reason', 'conflict');
  end if;
  next_revision := coalesce(current.revision, 0) + 1;
  insert into public.at_worlds (owner, revision, payload, device, request_id, updated_at)
    values (u, next_revision, p_payload, p_device, p_request, clock_timestamp())
    on conflict (owner) do update set revision = excluded.revision, payload = excluded.payload,
      device = excluded.device, request_id = excluded.request_id, updated_at = excluded.updated_at;
  insert into public.at_versions (owner, revision, payload, updated_at)
    select owner, revision, payload, updated_at from public.at_worlds where owner = u;
  delete from public.at_versions where owner = u and revision <= next_revision - 5;
  update public.at_leases set expires_at = clock_timestamp() + interval '150 seconds' where owner = u;
  return jsonb_build_object('ok', true, 'revision', next_revision);
end $$;

create function public.at_release(p_account uuid, p_device uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_account is distinct from auth.uid() then raise exception 'authentication_required' using errcode = '42501'; end if;
  delete from public.at_leases where owner = auth.uid() and device = p_device;
end $$;

create function public.at_delete(p_account uuid, p_device uuid, p_expected bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); lease public.at_leases; revision bigint;
begin
  if u is null or p_account is distinct from u then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into lease from public.at_leases where owner = u for update;
  if p_device is null or lease.owner is null or lease.device <> p_device or lease.expires_at <= clock_timestamp() then return false; end if;
  select w.revision into revision from public.at_worlds w where owner = u for update;
  if p_expected is null or coalesce(revision, 0) <> p_expected then return false; end if;
  delete from public.at_versions where owner = u;
  delete from public.at_worlds where owner = u;
  delete from public.at_leases where owner = u;
  return true;
end $$;
revoke all on function public.at_claim(uuid,uuid,text,boolean), public.at_push(uuid,uuid,bigint,uuid,jsonb), public.at_release(uuid,uuid), public.at_delete(uuid,uuid,bigint) from public, anon;
grant execute on function public.at_claim(uuid,uuid,text,boolean), public.at_push(uuid,uuid,bigint,uuid,jsonb), public.at_release(uuid,uuid), public.at_delete(uuid,uuid,bigint) to authenticated;
commit;
