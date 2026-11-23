-- Applied to Supabase project on 2026-11-22 as migration
-- audit_add_missing_foreign_key_indexes_20261122.
-- Non-destructive: index-only optimization.
create index if not exists cv_field_progress_employee_fk_idx on public.cv_field_progress_v1(employee_id);
create index if not exists cv_field_progress_work_fk_idx on public.cv_field_progress_v1(work_order_id);
create index if not exists cv_mov_supplier_owner_fk_idx on public.cv_material_movements_v1(user_id,supplier_id);
create index if not exists cv_mov_work_owner_fk_idx on public.cv_material_movements_v1(user_id,work_order_id);
create index if not exists cv_measurements_work_fk_idx on public.cv_measurements_v1(work_order_id);
create index if not exists cv_proposal_invites_budget_fk_idx on public.cv_proposal_invites_v1(budget_id);
create index if not exists cv_proposal_receipt_invite_fk_idx on public.cv_proposal_receipt_reads_v1(invite_id);
create index if not exists cv_work_logs_employee_fk_idx on public.cv_work_logs_v1(employee_id);
create index if not exists cv_work_logs_order_fk_idx on public.cv_work_logs_v1(work_order_id);
create index if not exists cv_work_orders_budget_fk_idx on public.cv_work_orders_v1(budget_id);
