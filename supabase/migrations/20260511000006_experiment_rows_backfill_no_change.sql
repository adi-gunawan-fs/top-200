update public.experiment_rows
set
  name_status = case
    when coalesce(trim(before_name), '') <> '' and coalesce(trim(after_name), '') = '' then 'NO_CHANGE'
    else name_status
  end,
  description_status = case
    when coalesce(trim(before_description), '') <> '' and coalesce(trim(after_description), '') = '' then 'NO_CHANGE'
    else description_status
  end,
  ingredient_status = case
    when coalesce(trim(before_ingredient), '') <> '' and coalesce(trim(after_ingredient), '') = '' then 'NO_CHANGE'
    else ingredient_status
  end,
  addons_status = case
    when coalesce(trim(before_addons), '') <> '' and coalesce(trim(after_addons), '') = '' then 'NO_CHANGE'
    else addons_status
  end,
  allergens_status = case
    when coalesce(trim(before_allergens), '') <> '' and coalesce(trim(after_allergens), '') = '' then 'NO_CHANGE'
    else allergens_status
  end,
  diets_status = case
    when coalesce(trim(before_diets), '') <> '' and coalesce(trim(after_diets), '') = '' then 'NO_CHANGE'
    else diets_status
  end;

