do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'experiment_rows'
      and policyname = 'Users can delete own experiment rows'
  ) then
    create policy "Users can delete own experiment rows"
      on public.experiment_rows for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

