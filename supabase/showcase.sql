-- Showcase site database. Paste this whole file into Supabase > SQL Editor > New query, then Run.
-- Safe to run more than once. It only adds new tables, so your other apps (like Luminara) are untouched.

create table if not exists public.showcase_admins (
  email text primary key
);

create table if not exists public.showcase_apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  name text not null check (char_length(name) between 2 and 60),
  tagline text not null default '' check (char_length(tagline) <= 100),
  description text not null default '' check (char_length(description) <= 2000),
  app_url text not null check (app_url like 'https://%'),
  icon_url text,
  screenshots text[] not null default '{}',
  needs_account boolean not null default false,
  pricing text not null default 'Free' check (char_length(pricing) <= 60),
  contact text not null default '' check (char_length(contact) <= 120),
  privacy_note text not null default '' check (char_length(privacy_note) <= 300),
  version text not null default '' check (char_length(version) <= 20),
  released_at date,
  published boolean not null default true,
  sort integer not null default 0 check (sort between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists showcase_apps_order on public.showcase_apps (published, sort, created_at desc);

create table if not exists public.showcase_updates (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.showcase_apps(id) on delete cascade,
  version text not null check (char_length(version) between 1 and 20),
  notes text not null check (char_length(notes) between 1 and 600),
  released_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists showcase_updates_app on public.showcase_updates (app_id, released_at desc, created_at desc);

create or replace function public.showcase_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists showcase_apps_touch on public.showcase_apps;
create trigger showcase_apps_touch before update on public.showcase_apps
  for each row execute function public.showcase_touch();

-- Is the signed-in person one of the admins listed above? Everything below relies on this.
create or replace function public.is_showcase_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.showcase_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_showcase_admin() from public;
grant execute on function public.is_showcase_admin() to anon, authenticated;

alter table public.showcase_admins enable row level security;
alter table public.showcase_apps enable row level security;
alter table public.showcase_updates enable row level security;

drop policy if exists admins_read on public.showcase_admins;
create policy admins_read on public.showcase_admins for select using (public.is_showcase_admin());

-- Everyone can read published apps and their updates. Only admins can read drafts or change anything.
drop policy if exists apps_read on public.showcase_apps;
create policy apps_read on public.showcase_apps for select using (published or public.is_showcase_admin());
drop policy if exists apps_insert on public.showcase_apps;
create policy apps_insert on public.showcase_apps for insert with check (public.is_showcase_admin());
drop policy if exists apps_update on public.showcase_apps;
create policy apps_update on public.showcase_apps for update using (public.is_showcase_admin()) with check (public.is_showcase_admin());
drop policy if exists apps_delete on public.showcase_apps;
create policy apps_delete on public.showcase_apps for delete using (public.is_showcase_admin());

drop policy if exists updates_read on public.showcase_updates;
create policy updates_read on public.showcase_updates for select using (
  public.is_showcase_admin()
  or exists (select 1 from public.showcase_apps a where a.id = app_id and a.published)
);
drop policy if exists updates_insert on public.showcase_updates;
create policy updates_insert on public.showcase_updates for insert with check (public.is_showcase_admin());
drop policy if exists updates_update on public.showcase_updates;
create policy updates_update on public.showcase_updates for update using (public.is_showcase_admin()) with check (public.is_showcase_admin());
drop policy if exists updates_delete on public.showcase_updates;
create policy updates_delete on public.showcase_updates for delete using (public.is_showcase_admin());

-- Pictures (app icons and screenshots) live in a public bucket. Only admins can add or remove them.
insert into storage.buckets (id, name, public) values ('showcase', 'showcase', true)
on conflict (id) do nothing;

drop policy if exists showcase_files_read on storage.objects;
create policy showcase_files_read on storage.objects for select using (bucket_id = 'showcase');
drop policy if exists showcase_files_insert on storage.objects;
create policy showcase_files_insert on storage.objects for insert with check (bucket_id = 'showcase' and public.is_showcase_admin());
drop policy if exists showcase_files_update on storage.objects;
create policy showcase_files_update on storage.objects for update using (bucket_id = 'showcase' and public.is_showcase_admin());
drop policy if exists showcase_files_delete on storage.objects;
create policy showcase_files_delete on storage.objects for delete using (bucket_id = 'showcase' and public.is_showcase_admin());

-- Makes this email the admin of the showcase site. It must be the email you sign in with.
insert into public.showcase_admins (email) values ('noiradevale@gmail.com')
on conflict (email) do nothing;
