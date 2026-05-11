update public.experiment_rows
set
  name_status = case when name_status = 'NO_CHANGE' then 'EXACT_MATCH' else name_status end,
  description_status = case when description_status = 'NO_CHANGE' then 'EXACT_MATCH' else description_status end,
  ingredient_status = case when ingredient_status = 'NO_CHANGE' then 'EXACT_MATCH' else ingredient_status end,
  addons_status = case when addons_status = 'NO_CHANGE' then 'EXACT_MATCH' else addons_status end,
  allergens_status = case when allergens_status = 'NO_CHANGE' then 'EXACT_MATCH' else allergens_status end,
  diets_status = case when diets_status = 'NO_CHANGE' then 'EXACT_MATCH' else diets_status end;

