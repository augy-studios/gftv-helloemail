-- Users Table
create table public.hellomail_users (
  id uuid not null default gen_random_uuid (),
  username text not null,
  email text not null,
  password_hash text not null,
  created_at timestamp with time zone null default now(),
  display_name text null,
  avatar_url text null,
  constraint hellomail_users_pkey primary key (id),
  constraint hellomail_users_email_key unique (email),
  constraint hellomail_users_username_key unique (username)
) TABLESPACE pg_default;

-- Passkeys Table (For WebAuthn credentials)
create table public.hellomail_passkeys (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  credential_id text not null,
  public_key text not null,
  counter bigint not null default 0,
  created_at timestamp with time zone null default now(),
  constraint hellomail_passkeys_pkey primary key (id),
  constraint hellomail_passkeys_credential_key unique (credential_id),
  constraint hellomail_passkeys_user_fkey foreign key (user_id) references hellomail_users (id) on delete cascade
) TABLESPACE pg_default;

-- Sessions Table
create table public.hellomail_sessions (
  id uuid not null default gen_random_uuid (),
  token text not null,
  user_id uuid null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone null default now(),
  constraint hellomail_sessions_pkey primary key (id),
  constraint hellomail_sessions_token_key unique (token),
  constraint hellomail_sessions_user_id_fkey foreign key (user_id) references hellomail_users (id) on delete cascade
) TABLESPACE pg_default;

create index if not exists hellomail_sessions_token_idx on public.hellomail_sessions using btree (token) TABLESPACE pg_default;

-- Email Aliases Table
create table public.hellomail_aliases (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  alias_address text not null,
  destination_email text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone null default now(),
  constraint hellomail_aliases_pkey primary key (id),
  constraint hellomail_aliases_address_key unique (alias_address),
  constraint hellomail_aliases_user_fkey foreign key (user_id) references hellomail_users (id) on delete cascade
) TABLESPACE pg_default;