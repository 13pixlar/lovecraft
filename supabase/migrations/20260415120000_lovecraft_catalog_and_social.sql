-- Lovecraft: catalog + ratings + comments (prefix lovecraft_*)
-- Apply in shared Supabase project via dashboard SQL or CLI.

create extension if not exists pgcrypto;

-- Catalog
create table if not exists public.lovecraft_works (
  slug text primary key,
  title_sv text not null,
  original_title_en text,
  description_sv text not null,
  sort_order integer not null,
  cover_filename text,
  created_at timestamptz not null default now()
);

create table if not exists public.lovecraft_tracks (
  id bigint generated always as identity primary key,
  work_slug text not null references public.lovecraft_works (slug) on delete cascade,
  sort_order integer not null,
  filename text not null,
  title_sv text not null,
  unique (work_slug, sort_order),
  unique (work_slug, filename)
);
create index if not exists lovecraft_tracks_work_slug_idx on public.lovecraft_tracks (work_slug);

alter table public.lovecraft_works enable row level security;
alter table public.lovecraft_tracks enable row level security;

drop policy if exists lovecraft_works_select on public.lovecraft_works;
create policy lovecraft_works_select on public.lovecraft_works
for select to anon, authenticated using (true);

drop policy if exists lovecraft_tracks_select on public.lovecraft_tracks;
create policy lovecraft_tracks_select on public.lovecraft_tracks
for select to anon, authenticated using (true);

-- Ratings
create table if not exists public.lovecraft_work_ratings (
  id bigint generated always as identity primary key,
  work_slug text not null references public.lovecraft_works (slug) on delete cascade,
  client_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_slug, client_id)
);
create index if not exists lovecraft_work_ratings_work_slug_idx
  on public.lovecraft_work_ratings (work_slug);

create or replace function public.lovecraft_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lovecraft_work_ratings_set_updated_at on public.lovecraft_work_ratings;
create trigger lovecraft_work_ratings_set_updated_at
before update on public.lovecraft_work_ratings
for each row execute function public.lovecraft_set_updated_at();

create or replace view public.lovecraft_work_rating_stats as
select
  work_slug,
  round(avg(rating)::numeric, 2) as avg_rating,
  count(*)::bigint as rating_count
from public.lovecraft_work_ratings
group by work_slug;

-- Comments
create table if not exists public.lovecraft_work_comments (
  id uuid primary key default gen_random_uuid(),
  work_slug text not null references public.lovecraft_works (slug) on delete cascade,
  client_id uuid not null,
  author_display_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint lovecraft_work_comments_author_len check (char_length(author_display_name) between 1 and 64),
  constraint lovecraft_work_comments_body_len check (char_length(body) between 1 and 4000)
);
create index if not exists lovecraft_work_comments_work_slug_created_at_idx
  on public.lovecraft_work_comments (work_slug, created_at);

create or replace function public.lovecraft_comment_cooldown()
returns trigger language plpgsql as $$
declare
  last_ts timestamptz;
begin
  select max(created_at) into last_ts
  from public.lovecraft_work_comments
  where work_slug = new.work_slug and client_id = new.client_id;

  if last_ts is not null and last_ts > now() - interval '30 seconds' then
    raise exception 'Cooldown: wait before posting again';
  end if;

  return new;
end;
$$;

drop trigger if exists lovecraft_work_comments_cooldown on public.lovecraft_work_comments;
create trigger lovecraft_work_comments_cooldown
before insert on public.lovecraft_work_comments
for each row execute function public.lovecraft_comment_cooldown();

-- RLS social
alter table public.lovecraft_work_ratings enable row level security;
alter table public.lovecraft_work_comments enable row level security;

drop policy if exists lovecraft_ratings_select on public.lovecraft_work_ratings;
create policy lovecraft_ratings_select on public.lovecraft_work_ratings
for select to anon, authenticated
using (true);

drop policy if exists lovecraft_comments_select on public.lovecraft_work_comments;
create policy lovecraft_comments_select on public.lovecraft_work_comments
for select to anon, authenticated
using (true);

drop policy if exists lovecraft_ratings_insert on public.lovecraft_work_ratings;
create policy lovecraft_ratings_insert on public.lovecraft_work_ratings
for insert to anon
with check (client_id is not null);

create or replace function public.lovecraft_ratings_immutable_ids()
returns trigger language plpgsql as $$
begin
  if new.client_id is distinct from old.client_id or new.work_slug is distinct from old.work_slug then
    raise exception 'Cannot change client_id or work_slug';
  end if;
  return new;
end;
$$;

drop trigger if exists lovecraft_work_ratings_immutable_ids on public.lovecraft_work_ratings;
create trigger lovecraft_work_ratings_immutable_ids
before update on public.lovecraft_work_ratings
for each row execute function public.lovecraft_ratings_immutable_ids();

drop policy if exists lovecraft_ratings_update on public.lovecraft_work_ratings;
create policy lovecraft_ratings_update on public.lovecraft_work_ratings
for update to anon
using (client_id is not null)
with check (client_id is not null);

drop policy if exists lovecraft_comments_insert on public.lovecraft_work_comments;
create policy lovecraft_comments_insert on public.lovecraft_work_comments
for insert to anon
with check (
  client_id is not null
  and char_length(author_display_name) between 1 and 64
  and char_length(body) between 1 and 4000
);

-- Stats view: read for anon (views need grants in some setups)
grant select on public.lovecraft_work_rating_stats to anon, authenticated;
