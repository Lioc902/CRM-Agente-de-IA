create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(), provider text not null check (provider in ('meta', 'evolution')),
  provider_message_id text not null unique, remote_jid text not null, phone text not null, contact_name text,
  direction text not null check (direction in ('inbound', 'outbound')), message_type text not null default 'text', body text,
  media_id text, media_mime_type text, provider_timestamp timestamptz not null default now(), raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_provider_jid_time_idx on public.whatsapp_messages (provider, remote_jid, provider_timestamp);
create index if not exists whatsapp_messages_provider_phone_time_idx on public.whatsapp_messages (provider, phone, provider_timestamp desc);
alter table public.whatsapp_messages enable row level security;
revoke all on table public.whatsapp_messages from anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_messages to service_role;
