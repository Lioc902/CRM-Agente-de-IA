create type public.app_role as enum ('admin', 'supervisor', 'agent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create index profiles_role_created_at_idx on public.profiles (role, created_at);
