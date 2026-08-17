-- Rehome adoption database — initial schema
-- Run this in the Supabase SQL editor for a new project.

create extension if not exists pgcrypto;

create type public.species_type as enum ('dog', 'cat', 'other');
create type public.sex_type as enum ('male', 'female', 'unknown');
create type public.size_type as enum ('small', 'medium', 'large', 'unknown');
create type public.ynu_type as enum ('yes', 'no', 'unknown');
create type public.age_unit_type as enum ('months', 'years');
create type public.adoption_status_type as enum ('available', 'reserved', 'adopted', 'withdrawn');
create type public.moderation_status_type as enum ('active', 'under_review', 'hidden');
create type public.user_role_type as enum ('user', 'moderator', 'admin');
create type public.report_reason_type as enum ('duplicate', 'misleading', 'scam', 'animal_safety', 'inappropriate', 'already_adopted', 'other');
create type public.report_status_type as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  city text,
  phone text,
  organisation_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role_type not null default 'user',
  created_at timestamptz not null default now()
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  species public.species_type not null,
  other_species text,
  breed text,
  sex public.sex_type not null default 'unknown',
  age_value integer check (age_value is null or age_value between 0 and 600),
  age_unit public.age_unit_type,
  size public.size_type not null default 'unknown',
  city text not null check (char_length(city) between 1 and 120),
  state text,
  country text not null default 'India',
  description text not null check (char_length(description) between 30 and 2500),
  temperament text,
  sterilised public.ynu_type not null default 'unknown',
  vaccinated public.ynu_type not null default 'unknown',
  dewormed public.ynu_type not null default 'unknown',
  good_with_dogs public.ynu_type not null default 'unknown',
  good_with_cats public.ynu_type not null default 'unknown',
  good_with_children public.ynu_type not null default 'unknown',
  special_needs text,
  medical_notes text,
  adoption_requirements text,
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  contact_phone text not null check (char_length(contact_phone) between 5 and 40),
  whatsapp_ok boolean not null default true,
  adoption_status public.adoption_status_type not null default 'available',
  moderation_status public.moderation_status_type not null default 'active',
  is_published boolean not null default false,
  search_document tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(breed, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(city, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint other_species_required check (species <> 'other' or nullif(trim(other_species), '') is not null),
  constraint age_pair check ((age_value is null and age_unit is null) or (age_value is not null and age_unit is not null))
);

create table public.animal_photos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique,
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order <= 20),
  created_at timestamptz not null default now()
);

create table public.animal_status_history (
  id bigint generated always as identity primary key,
  animal_id uuid not null references public.animals(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  old_status public.adoption_status_type,
  new_status public.adoption_status_type not null,
  changed_at timestamptz not null default now()
);

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason public.report_reason_type not null,
  details text check (details is null or char_length(details) <= 1200),
  status public.report_status_type not null default 'open',
  moderator_notes text check (moderator_notes is null or char_length(moderator_notes) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Every animal change writes a tiny public event row. The public gallery subscribes
-- to this instead of the animals table so that an update to Adopted/Hidden still
-- causes anonymous clients to refresh even though the changed row is no longer public.
create table public.public_listing_events (
  id bigint generated always as identity primary key,
  animal_id uuid not null,
  event_type text not null check (event_type in ('insert', 'update')),
  created_at timestamptz not null default now()
);

create index animals_public_gallery_idx on public.animals (is_published, moderation_status, adoption_status, created_at desc);
create index animals_owner_idx on public.animals (owner_id, updated_at desc);
create index animals_city_idx on public.animals (lower(city));
create index animals_search_idx on public.animals using gin (search_document);
create index animal_photos_animal_idx on public.animal_photos (animal_id, sort_order);
create index reports_status_idx on public.listing_reports (status, created_at desc);
create unique index one_open_report_per_user on public.listing_reports (animal_id, reporter_id) where status in ('open', 'reviewing');
create index public_listing_events_created_idx on public.public_listing_events (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger animals_set_updated_at before update on public.animals for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  insert into public.user_roles (user_id, role)
  values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill roles/profiles if the migration is run after a test user already exists.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', '') from auth.users
on conflict (id) do nothing;
insert into public.user_roles (user_id, role)
select id, 'user' from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role in ('moderator', 'admin')
  );
$$;

create or replace function public.record_status_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.animal_status_history (animal_id, changed_by, old_status, new_status)
    values (new.id, new.owner_id, null, new.adoption_status);
  elsif new.adoption_status is distinct from old.adoption_status then
    insert into public.animal_status_history (animal_id, changed_by, old_status, new_status)
    values (new.id, auth.uid(), old.adoption_status, new.adoption_status);
  end if;
  return new;
end;
$$;

create trigger animals_status_history
after insert or update of adoption_status on public.animals
for each row execute function public.record_status_change();

create or replace function public.emit_public_listing_event()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.public_listing_events (animal_id, event_type)
  values (new.id, case when tg_op = 'INSERT' then 'insert' else 'update' end);
  return new;
end;
$$;

create trigger animals_public_event
after insert or update on public.animals
for each row execute function public.emit_public_listing_event();

-- Publishing requires at least one photo. Drafts can exist without photos.
create or replace function public.require_photo_before_publish()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.is_published = true and (old.is_published = false or old.is_published is null) then
    if not exists (select 1 from public.animal_photos where animal_id = new.id) then
      raise exception 'A listing needs at least one photo before it can be published.';
    end if;
  end if;
  return new;
end;
$$;

create trigger animals_require_photo
before update of is_published on public.animals
for each row execute function public.require_photo_before_publish();

-- Enforce the 1–5 photo rule at database level as well as in the UI.
create or replace function public.enforce_photo_limits()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  photo_count integer;
  parent_published boolean;
begin
  if tg_op = 'INSERT' then
    select count(*) into photo_count from public.animal_photos where animal_id = new.animal_id;
    if photo_count >= 5 then raise exception 'A listing can have a maximum of 5 photos.'; end if;
    return new;
  elsif tg_op = 'DELETE' then
    select count(*) into photo_count from public.animal_photos where animal_id = old.animal_id;
    select is_published into parent_published from public.animals where id = old.animal_id;
    if parent_published and photo_count <= 1 then raise exception 'A published listing must keep at least one photo.'; end if;
    return old;
  end if;
  return new;
end;
$$;

create trigger animal_photos_max_five before insert on public.animal_photos for each row execute function public.enforce_photo_limits();
create trigger animal_photos_keep_one before delete on public.animal_photos for each row execute function public.enforce_photo_limits();

-- A photo row must refer to a real object uploaded by the same signed-in user.
create or replace function public.validate_photo_object()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.storage_path not like new.uploader_id::text || '/%' then
    raise exception 'Photo path must be inside the uploader folder.';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'animal-photos'
      and name = new.storage_path
      and owner_id = new.uploader_id::text
  ) then
    raise exception 'Photo object does not exist or is not owned by this user.';
  end if;
  return new;
end;
$$;

create trigger animal_photos_validate_object before insert on public.animal_photos for each row execute function public.validate_photo_object();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.animals enable row level security;
alter table public.animal_photos enable row level security;
alter table public.animal_status_history enable row level security;
alter table public.listing_reports enable row level security;
alter table public.public_listing_events enable row level security;

-- Profiles are private to the user. Moderators do not need fosterer profile data to review reports.
create policy "Users can read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Users can inspect only their own role. Role mutation is intentionally not exposed to client roles.
create policy "Users can read own role" on public.user_roles for select to authenticated using (user_id = (select auth.uid()));

-- Anyone can browse published active animals that are Available or Reserved.
create policy "Public can browse active listings" on public.animals for select to anon, authenticated
using (is_published = true and moderation_status = 'active' and adoption_status in ('available', 'reserved'));
create policy "Owners can read own animals" on public.animals for select to authenticated using (owner_id = (select auth.uid()));
create policy "Moderators can read all animals" on public.animals for select to authenticated using ((select public.is_moderator()));

-- New listings must begin as private active drafts owned by the signed-in user.
create policy "Owners can create drafts" on public.animals for insert to authenticated
with check (owner_id = (select auth.uid()) and is_published = false and moderation_status = 'active');

-- Owners can edit only listings not frozen by moderation. This also prevents them from unhiding themselves.
create policy "Owners can update own active animals" on public.animals for update to authenticated
using (owner_id = (select auth.uid()) and moderation_status = 'active')
with check (owner_id = (select auth.uid()) and moderation_status = 'active');
create policy "Moderators can update animals" on public.animals for update to authenticated
using ((select public.is_moderator())) with check ((select public.is_moderator()));

-- No client delete policy: use Adopted/Withdrawn to preserve history.

create policy "Public can read photos for visible listings" on public.animal_photos for select to anon, authenticated
using (exists (
  select 1 from public.animals a
  where a.id = animal_id and a.is_published = true and a.moderation_status = 'active' and a.adoption_status in ('available','reserved')
));
create policy "Owners can read own photos" on public.animal_photos for select to authenticated
using (uploader_id = (select auth.uid()));
create policy "Moderators can read all photos" on public.animal_photos for select to authenticated using ((select public.is_moderator()));
create policy "Owners can add photos to own animal" on public.animal_photos for insert to authenticated
with check (
  uploader_id = (select auth.uid()) and exists (
    select 1 from public.animals a where a.id = animal_id and a.owner_id = (select auth.uid()) and a.moderation_status = 'active'
  )
);
create policy "Owners can delete own animal photos" on public.animal_photos for delete to authenticated
using (
  uploader_id = (select auth.uid()) and exists (
    select 1 from public.animals a where a.id = animal_id and a.owner_id = (select auth.uid()) and a.moderation_status = 'active'
  )
);

create policy "Owners can read own status history" on public.animal_status_history for select to authenticated
using (exists (select 1 from public.animals a where a.id = animal_id and a.owner_id = (select auth.uid())));
create policy "Moderators can read status history" on public.animal_status_history for select to authenticated using ((select public.is_moderator()));

-- Reporting requires authentication. Reporters cannot report their own animal.
create policy "Authenticated users can report listings" on public.listing_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'open' and moderator_notes is null and reviewed_at is null
  and exists (
    select 1 from public.animals a
    where a.id = animal_id and a.owner_id <> (select auth.uid()) and a.is_published = true and a.moderation_status = 'active' and a.adoption_status in ('available','reserved')
  )
);
-- Only moderators can read/update reports. This keeps reporter identity and notes private from fosterers.
create policy "Moderators can read reports" on public.listing_reports for select to authenticated using ((select public.is_moderator()));
create policy "Moderators can update reports" on public.listing_reports for update to authenticated
using ((select public.is_moderator())) with check ((select public.is_moderator()));

-- Public event rows reveal only an animal UUID and event type; they exist only to refresh the gallery.
create policy "Everyone can read recent listing events" on public.public_listing_events for select to anon, authenticated using (created_at > now() - interval '24 hours');

-- Data API privileges. RLS remains the actual authorization layer.
grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.animals to anon, authenticated;
grant insert, update on public.animals to authenticated;
grant select on public.animal_photos to anon, authenticated;
grant insert, delete on public.animal_photos to authenticated;
grant select on public.animal_status_history to authenticated;
grant select on public.listing_reports to authenticated;
grant insert (animal_id, reporter_id, reason, details) on public.listing_reports to authenticated;
grant update (status, moderator_notes, reviewed_at) on public.listing_reports to authenticated;
grant select on public.public_listing_events to anon, authenticated;

-- Storage: create a public bucket for images intended to appear in public adoption listings.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('animal-photos', 'animal-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Upload path is: USER_UUID/ANIMAL_UUID/random-file.ext
create policy "Users can upload to own photo folder" on storage.objects for insert to authenticated
with check (bucket_id = 'animal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can update own photo objects" on storage.objects for update to authenticated
using (bucket_id = 'animal-photos' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'animal-photos' and owner_id = (select auth.uid())::text);
create policy "Users can delete own photo objects" on storage.objects for delete to authenticated
using (bucket_id = 'animal-photos' and owner_id = (select auth.uid())::text);

-- Enable the tiny public event table for realtime Postgres Changes.
-- Public SELECT is limited to the most recent 24 hours; old rows are retained only for simple diagnostics.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'public_listing_events'
  ) then
    alter publication supabase_realtime add table public.public_listing_events;
  end if;
end $$;

-- Keep function privileges explicit. Only is_moderator is intended for policy/client execution.
revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.record_status_change() from public, anon, authenticated;
revoke all on function public.emit_public_listing_event() from public, anon, authenticated;
revoke all on function public.require_photo_before_publish() from public, anon, authenticated;
revoke all on function public.enforce_photo_limits() from public, anon, authenticated;
revoke all on function public.validate_photo_object() from public, anon, authenticated;

-- FIRST MODERATOR:
-- After you create your own account, copy its UUID from Authentication > Users and run:
-- insert into public.user_roles (user_id, role)
-- values ('YOUR-USER-UUID', 'admin')
-- on conflict (user_id) do update set role = excluded.role;
