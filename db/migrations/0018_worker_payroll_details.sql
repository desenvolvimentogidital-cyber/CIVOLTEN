-- CIVOLTEN 0018: optional real payroll inputs per worker.
-- Additive only: preserves employees and the existing monthly_employer_cost.
-- No synthetic amounts, salary default, workdays default or tax approval.
ALTER TABLE company_workers
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12,2)
    CHECK (monthly_salary >= 0 AND monthly_salary <= 1000000),
  ADD COLUMN IF NOT EXISTS monthly_additional_cost NUMERIC(12,2)
    CHECK (monthly_additional_cost >= 0 AND monthly_additional_cost <= 1000000),
  ADD COLUMN IF NOT EXISTS workdays_per_month INTEGER
    CHECK (workdays_per_month BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS hours_per_day NUMERIC(4,2)
    CHECK (hours_per_day BETWEEN 1 AND 16);
COMMENT ON COLUMN company_workers.monthly_salary IS
  'Salario mensal informado pelo responsavel. Nullable for legacy records.';
COMMENT ON COLUMN company_workers.monthly_additional_cost IS
  'Encargos/beneficios mensais explicitly informed; not inferred.';
COMMENT ON COLUMN company_workers.workdays_per_month IS
  'Dias de trabalho por mes por funcionario, explicit input.';
COMMENT ON COLUMN company_workers.hours_per_day IS
  'Jornada diaria paga por funcionario, explicit input.';
