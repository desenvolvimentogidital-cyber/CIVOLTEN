-- Applied to CIVOLTEN Supabase. Do not re-run manually in the active project.
alter table public.cv_workers add column if not exists days_month numeric(6,2) not null default 22 check (days_month between 0 and 31);
