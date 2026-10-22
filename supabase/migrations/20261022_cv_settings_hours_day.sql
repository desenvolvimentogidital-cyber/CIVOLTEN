-- Jornada media efetiva por dia faturavel (para indicador de custo/hora).
-- O valor inicial de 8h/dia e configuravel por administrador.
-- A coluna nao modifica orcamentos nem custos registrados anteriormente.
alter table public.cv_settings
 add column if not exists hours_day numeric(5,2) not null default 8
 check (hours_day > 0 and hours_day <= 24);
