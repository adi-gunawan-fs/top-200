update public.experiment_rows
set
  name_status = case when name_status = 'NULL' then '' else coalesce(name_status, '') end,
  description_status = case when description_status = 'NULL' then '' else coalesce(description_status, '') end,
  ingredient_status = case when ingredient_status = 'NULL' then '' else coalesce(ingredient_status, '') end,
  addons_status = case when addons_status = 'NULL' then '' else coalesce(addons_status, '') end,
  allergens_status = case when allergens_status = 'NULL' then '' else coalesce(allergens_status, '') end,
  diets_status = case when diets_status = 'NULL' then '' else coalesce(diets_status, '') end;

alter table public.experiment_rows alter column name_status set default '';
alter table public.experiment_rows alter column description_status set default '';
alter table public.experiment_rows alter column ingredient_status set default '';
alter table public.experiment_rows alter column addons_status set default '';
alter table public.experiment_rows alter column allergens_status set default '';
alter table public.experiment_rows alter column diets_status set default '';

