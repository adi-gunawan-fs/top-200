update public.experiment_rows
set
  name_label = case when name_label = 'REGEX_CHANGES' then 'NO_CHANGES' else name_label end,
  description_label = case when description_label = 'REGEX_CHANGES' then 'NO_CHANGES' else description_label end,
  ingredient_label = case when ingredient_label = 'REGEX_CHANGES' then 'NO_CHANGES' else ingredient_label end,
  addons_label = case when addons_label = 'REGEX_CHANGES' then 'NO_CHANGES' else addons_label end,
  allergens_label = case when allergens_label = 'REGEX_CHANGES' then 'NO_CHANGES' else allergens_label end,
  diets_label = case when diets_label = 'REGEX_CHANGES' then 'NO_CHANGES' else diets_label end,
  label = case when label = 'REGEX_CHANGES' then 'NO_CHANGES' else label end;

