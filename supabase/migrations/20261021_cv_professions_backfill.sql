-- Importa somente os nomes distintos de profissões já usados pelos
-- profissionais cadastrados anteriormente. Nenhuma diária ou dado pessoal
-- é copiado ao catálogo. Operação aditiva, idempotente, por proprietário.
insert into public.cv_professions(owner_id,name)
select w.owner_id, btrim(w.profession)
from public.cv_workers w
where length(btrim(w.profession)) between 2 and 100
group by w.owner_id, btrim(w.profession)
on conflict do nothing;
