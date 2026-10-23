-- CIVOLTEN 2026-10-23
-- O usuário autenticado acessa APENAS seus próprios dados. Nenhuma promoção
-- administrativa é necessária. Catálogo global de profissões é público para
-- usuários logados (sem diárias/preços); profissões próprias são privadas.
-- Preserva owner_id, IDs, históricos de orçamento, funcionários e caixa.
begin;
do $$
declare t text;
begin
 for t in select unnest(array[
  'cv_settings','cv_workers','cv_fixed_costs','cv_variable_costs','cv_budgets','cv_cash_entries'
 ]) loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists %I on public.%I','cv_'||t||'_select',t);
  execute format('drop policy if exists %I on public.%I','cv_'||t||'_insert',t);
  execute format('drop policy if exists %I on public.%I','cv_'||t||'_update',t);
  execute format('drop policy if exists %I on public.%I','cv_'||t||'_delete',t);
  execute format('create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))','cv_tenant_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))','cv_tenant_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))','cv_tenant_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()))','cv_tenant_delete',t);
 end loop;
end $$;
-- Regras do caixa continuam impedindo associação a orçamento alheio,
-- inclusive se o usuário alterar o identificador na requisição.
drop policy if exists cv_tenant_insert on public.cv_cash_entries;
drop policy if exists cv_tenant_update on public.cv_cash_entries;
create policy cv_tenant_insert on public.cv_cash_entries for insert to authenticated
 with check (owner_id=(select auth.uid()) and
 (budget_id is null or exists(
   select 1 from public.cv_budgets b
   where b.id=cv_cash_entries.budget_id and b.owner_id=(select auth.uid())
 )));
create policy cv_tenant_update on public.cv_cash_entries for update to authenticated
 using (owner_id=(select auth.uid()))
 with check (owner_id=(select auth.uid()) and
 (budget_id is null or exists(
   select 1 from public.cv_budgets b
   where b.id=cv_cash_entries.budget_id and b.owner_id=(select auth.uid())
 )));
drop policy if exists cv_professions_add on public.cv_professions;
drop policy if exists cv_professions_read on public.cv_professions;
create policy cv_tenant_professions_select on public.cv_professions for select to authenticated
 using (owner_id is null or owner_id=(select auth.uid()));
create policy cv_tenant_professions_insert on public.cv_professions for insert to authenticated
 with check (owner_id=(select auth.uid()));
-- Limpar aprovação e permissões administrativas obsoletas.
drop function if exists public.cv_approve_access_request(uuid);
drop function if exists cv_private.is_admin();
drop table if exists public.cv_access_requests;
drop table if exists public.admin_users;
commit;
