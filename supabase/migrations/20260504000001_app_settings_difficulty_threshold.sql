alter table public.app_settings
  add column if not exists difficulty_threshold numeric;
