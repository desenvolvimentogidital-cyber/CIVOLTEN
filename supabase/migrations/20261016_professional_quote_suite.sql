-- CIVOLTEN: etapa profissional, apenas objetos novos (sem apagar pedidos existentes).
create table if not exists public.commercial_quotes (
 request_id uuid primary key references public.quote_requests(id) on delete cascade,
 revision integer not null default 1 check(revision between 1 and 10000),
 items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array'),
 terms jsonb not null default '{}'::jsonb check(jsonb_typeof(terms)='object'),
 total numeric(14,2) not null check(total>0 and total<=100000000),
 token_hash text unique,
 token_expires_at timestamptz,
 decision text not null default 'draft' check(decision in ('draft','pending','approved','rejected','changes_requested')),
 decision_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists commercial_quotes_decision_idx on public.commercial_quotes(decision,updated_at desc);
create table if not exists public.commercial_quote_history(
 id bigint generated always as identity primary key,
 request_id uuid not null references public.quote_requests(id) on delete cascade,
 revision integer not null,
 action text not null check(action in ('edited','sent','approved','rejected','changes_requested')),
 actor_user_id uuid,
 snapshot jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists commercial_history_request_idx on public.commercial_quote_history(request_id,created_at desc);
create table if not exists public.civolten_branding(
 id smallint primary key default 1 check(id=1),
 company_name text not null default 'CIVOLTEN',
 logo_data_url text,
 color_primary text not null default '#08182B',
 color_accent text not null default '#DCA629',
 updated_at timestamptz not null default now(),
 check(length(company_name) between 2 and 80),
 check(logo_data_url is null or length(logo_data_url)<=300000),
 check(color_primary ~ '^#[0-9A-Fa-f]{6}$'),
 check(color_accent ~ '^#[0-9A-Fa-f]{6}$')
);
insert into public.civolten_branding(id) values(1) on conflict(id) do nothing;
alter table public.commercial_quotes enable row level security;
alter table public.commercial_quote_history enable row level security;
alter table public.civolten_branding enable row level security;
revoke all on public.commercial_quotes,public.commercial_quote_history,public.civolten_branding from public,anon,authenticated;
grant select,insert,update,delete on public.commercial_quotes,public.commercial_quote_history,public.civolten_branding to service_role;
