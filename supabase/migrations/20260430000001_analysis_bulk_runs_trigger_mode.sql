alter table public.analysis_bulk_runs
add column if not exists trigger_mode text not null default 'bulk'
check (trigger_mode in ('single', 'bulk'));
