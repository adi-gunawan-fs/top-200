create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weights jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute procedure public.set_updated_at();

alter table public.app_settings enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'app_settings'
      and policyname = 'Users can read own settings'
  ) then
    create policy "Users can read own settings"
      on public.app_settings for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'app_settings'
      and policyname = 'Users can upsert own settings'
  ) then
    create policy "Users can upsert own settings"
      on public.app_settings for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'app_settings'
      and policyname = 'Users can update own settings'
  ) then
    create policy "Users can update own settings"
      on public.app_settings for update
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
