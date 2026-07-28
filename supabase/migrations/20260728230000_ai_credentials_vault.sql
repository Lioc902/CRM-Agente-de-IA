create table if not exists public.ai_credentials (
  id text primary key,
  name text not null,
  provider text not null check (provider in ('gemini', 'openai', 'custom')),
  base_url text,
  model text,
  encrypted_key text not null,
  iv text not null,
  tag text not null,
  key_suffix text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_credentials enable row level security;
revoke all on table public.ai_credentials from anon, authenticated;
grant select, insert, update, delete on table public.ai_credentials to service_role;
