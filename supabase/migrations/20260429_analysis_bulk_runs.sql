create table if not exists public.analysis_bulk_runs (
  id uuid primary key default gen_random_uuid(),
  before_record_id text not null,
  after_record_id text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  total_items integer not null default 0,
  queued_count integer not null default 0,
  processing_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  queued_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analysis_jobs
add column if not exists batch_id uuid references public.analysis_bulk_runs(id) on delete set null;

create index if not exists analysis_bulk_runs_lookup_idx
  on public.analysis_bulk_runs (before_record_id, after_record_id, started_at desc);

create index if not exists analysis_jobs_batch_lookup_idx
  on public.analysis_jobs (batch_id, status);

drop trigger if exists set_analysis_bulk_runs_updated_at on public.analysis_bulk_runs;
create trigger set_analysis_bulk_runs_updated_at
before update on public.analysis_bulk_runs
for each row
execute procedure public.set_updated_at();

alter table public.analysis_bulk_runs enable row level security;

create policy "Authenticated users can read analysis bulk runs"
  on public.analysis_bulk_runs for select
  to authenticated
  using (true);
