alter table public.analysis_jobs
  drop constraint if exists analysis_jobs_status_check,
  add constraint analysis_jobs_status_check
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled'));

alter table public.analysis_bulk_runs
  drop constraint if exists analysis_bulk_runs_status_check,
  add constraint analysis_bulk_runs_status_check
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled'));

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'analysis_jobs'
      and policyname = 'Authenticated users can update analysis jobs'
  ) then
    create policy "Authenticated users can update analysis jobs"
      on public.analysis_jobs for update
      to authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'analysis_bulk_runs'
      and policyname = 'Authenticated users can update analysis bulk runs'
  ) then
    create policy "Authenticated users can update analysis bulk runs"
      on public.analysis_bulk_runs for update
      to authenticated
      using (true);
  end if;
end $$;
