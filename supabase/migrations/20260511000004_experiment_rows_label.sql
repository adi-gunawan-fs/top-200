alter table public.experiment_rows
add column if not exists label text not null default '';

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'experiment_rows'
      and policyname = 'Users can update own experiment rows'
  ) then
    create policy "Users can update own experiment rows"
      on public.experiment_rows for update
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

