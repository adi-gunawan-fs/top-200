alter table public.analysis_jobs
add column if not exists trigger_mode text not null default 'single'
check (trigger_mode in ('single', 'bulk'));
