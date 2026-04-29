create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  before_record_id text not null,
  after_record_id text not null,
  item_id text not null,
  item_type text not null,
  model_slug text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (before_record_id, after_record_id, item_id, item_type, model_slug)
);

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  before_record_id text not null,
  after_record_id text not null,
  item_id text not null,
  item_type text not null,
  export_item jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  queued_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (before_record_id, after_record_id, item_id, item_type)
);

create index if not exists analysis_jobs_lookup_idx
  on public.analysis_jobs (before_record_id, after_record_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_analysis_jobs_updated_at on public.analysis_jobs;
create trigger set_analysis_jobs_updated_at
before update on public.analysis_jobs
for each row
execute procedure public.set_updated_at();

alter table public.analysis_results enable row level security;
alter table public.analysis_jobs enable row level security;

create policy "Authenticated users can read analysis results"
  on public.analysis_results for select
  to authenticated
  using (true);

create policy "Authenticated users can read analysis jobs"
  on public.analysis_jobs for select
  to authenticated
  using (true);
