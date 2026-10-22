-- Catalogo de profissões: somente NOMES, sem preços tabelados ou diárias.
-- As opções compartilhadas ficam com owner_id NULL. Cada administrador pode
-- registrar funções adicionais próprias; políticas não permitem modificá-las por terceiros.
create table if not exists public.cv_professions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 100),
  created_at timestamptz not null default now()
);
create unique index if not exists cv_professions_global_name_unique
  on public.cv_professions (lower(btrim(name))) where owner_id is null;
create unique index if not exists cv_professions_owner_name_unique
  on public.cv_professions (owner_id,lower(btrim(name))) where owner_id is not null;
create index if not exists cv_professions_owner on public.cv_professions(owner_id);
alter table public.cv_professions enable row level security;
revoke all on public.cv_professions from anon,authenticated;
grant select,insert on public.cv_professions to authenticated;
drop policy if exists cv_professions_read on public.cv_professions;
create policy cv_professions_read on public.cv_professions for select to authenticated
 using ((owner_id is null or owner_id=(select auth.uid()))
 and (select cv_private.is_admin()));
drop policy if exists cv_professions_add on public.cv_professions;
create policy cv_professions_add on public.cv_professions for insert to authenticated
 with check (owner_id=(select auth.uid()) and (select cv_private.is_admin()));

-- Nao altera funcionarios nem orcamentos existentes.
insert into public.cv_professions(owner_id,name)
select null,v.name
from (values
  ('Ajudante de eletricista'),
  ('Ajudante de pedreiro'),
  ('Ajudante de encanador'),
  ('Ajudante de pintor'),
  ('Ajudante de gesseiro'),
  ('Ajudante geral'),
  ('Auxiliar de obras'),
  ('Servente de obras'),
  ('Eletricista'),
  ('Eletricista predial'),
  ('Eletricista industrial'),
  ('Eletricista de manutenção'),
  ('Técnico em eletrotécnica'),
  ('Engenheiro eletricista'),
  ('Instalador de energia solar'),
  ('Montador de painéis elétricos'),
  ('Instalador de cabeamento estruturado'),
  ('Instalador de CFTV'),
  ('Instalador de alarme'),
  ('Técnico de automação'),
  ('Instalador de interfone'),
  ('Pedreiro'),
  ('Mestre de obras'),
  ('Encarregado de obras'),
  ('Supervisor de obras'),
  ('Armador de ferragens'),
  ('Carpinteiro'),
  ('Carpinteiro de formas'),
  ('Concretista'),
  ('Apontador de obras'),
  ('Engenheiro civil'),
  ('Arquiteto'),
  ('Técnico em edificações'),
  ('Topógrafo'),
  ('Projetista'),
  ('Orçamentista'),
  ('Técnico de planejamento'),
  ('Técnico em segurança do trabalho'),
  ('Engenheiro de segurança do trabalho'),
  ('Operador de betoneira'),
  ('Operador de retroescavadeira'),
  ('Operador de escavadeira'),
  ('Operador de compactador'),
  ('Operador de máquinas'),
  ('Operador de guindaste'),
  ('Montador de andaimes'),
  ('Serralheiro'),
  ('Soldador'),
  ('Montador de estruturas metálicas'),
  ('Encanador'),
  ('Bombeiro hidráulico'),
  ('Instalador hidráulico'),
  ('Instalador de gás'),
  ('Técnico em refrigeração'),
  ('Instalador de ar-condicionado'),
  ('Técnico em climatização'),
  ('Impermeabilizador'),
  ('Aplicador de impermeabilizante'),
  ('Telhadista'),
  ('Calheiro'),
  ('Instalador de telhas'),
  ('Gesseiro'),
  ('Instalador de drywall'),
  ('Montador de forro de gesso'),
  ('Pintor'),
  ('Pintor predial'),
  ('Azulejista'),
  ('Porcelanatista'),
  ('Ladrilheiro'),
  ('Assentador de pisos'),
  ('Aplicador de revestimento'),
  ('Rejuntador'),
  ('Marmorista'),
  ('Graniteiro'),
  ('Vidraçeiro'),
  ('Instalador de esquadrias'),
  ('Marceneiro'),
  ('Montador de móveis'),
  ('Instalador de portas'),
  ('Jardineiro'),
  ('Paisagista'),
  ('Pavimentador'),
  ('Calceteiro'),
  ('Aplicador de piso epóxi'),
  ('Instalador de piso vinílico'),
  ('Instalador de piso laminado'),
  ('Auxiliar de limpeza'),
  ('Profissional de limpeza pós-obra'),
  ('Motorista de caminhão'),
  ('Transportador de materiais')
) as v(name)
on conflict do nothing;
