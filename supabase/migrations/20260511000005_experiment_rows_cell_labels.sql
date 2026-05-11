alter table public.experiment_rows
add column if not exists name_label text not null default '',
add column if not exists description_label text not null default '',
add column if not exists ingredient_label text not null default '',
add column if not exists addons_label text not null default '',
add column if not exists allergens_label text not null default '',
add column if not exists diets_label text not null default '';

