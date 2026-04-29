# Supabase Setup

Steps to wire this app to Supabase, including durable server-side analysis jobs.

## 1. Create a Supabase project

Create a new project in Supabase and wait for provisioning to finish.

## 2. Frontend environment variables

Copy `.env.example` to `.env.local` and fill in the frontend values:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_BRAINTRUST_MODEL1_NAME=Gemini
VITE_BRAINTRUST_PROMPT_SLUG_1=your-model-1-prompt-slug
VITE_BRAINTRUST_MODEL2_NAME=GPT-4o
VITE_BRAINTRUST_PROMPT_SLUG_2=your-model-2-prompt-slug
VITE_BRAINTRUST_MODEL3_NAME=Claude
VITE_BRAINTRUST_PROMPT_SLUG_3=your-model-3-prompt-slug
```

The frontend only needs the model display names and prompt slugs.

## 3. Run the SQL migration

Run [supabase/migrations/20260429_analysis_jobs.sql](/abs/e:/03_Work/Foodstyles/Apps/top-200/supabase/migrations/20260429_analysis_jobs.sql:1) in the Supabase SQL editor.

That migration creates:

- `csv_uploads` support is still expected separately if you use uploads
- `analysis_results` for per-model output
- `analysis_jobs` for durable queue state

If you have not created `csv_uploads` yet, also run:

```sql
create table if not exists public.csv_uploads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

alter table public.csv_uploads enable row level security;

create policy "Authenticated users can read all uploads"
  on public.csv_uploads for select
  to authenticated
  using (true);

create policy "Authenticated users can insert uploads"
  on public.csv_uploads for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

create policy "Authenticated users can delete any upload"
  on public.csv_uploads for delete
  to authenticated
  using (true);
```

## 4. Create the Storage bucket

Create a private bucket named `csv-uploads`.

Then add storage policies:

```sql
create policy "Authenticated users can upload CSV files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'csv-uploads');

create policy "Authenticated users can download CSV files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'csv-uploads');

create policy "Authenticated users can delete CSV files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'csv-uploads');
```

## 5. Deploy the Edge Function

Deploy [supabase/functions/analysis-jobs/index.ts](/abs/e:/03_Work/Foodstyles/Apps/top-200/supabase/functions/analysis-jobs/index.ts:1).

With Supabase CLI:

```bash
supabase functions deploy analysis-jobs
```

## 6. Set Supabase function secrets

Set these secrets for the deployed function:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BRAINTRUST_API_KEY=your-braintrust-api-key
BRAINTRUST_PROJECT_ID=your-braintrust-project-uuid
BRAINTRUST_MODEL1_NAME=Gemini
BRAINTRUST_PROMPT_SLUG_1=your-model-1-prompt-slug
BRAINTRUST_MODEL2_NAME=GPT-4o
BRAINTRUST_PROMPT_SLUG_2=your-model-2-prompt-slug
BRAINTRUST_MODEL3_NAME=Claude
BRAINTRUST_PROMPT_SLUG_3=your-model-3-prompt-slug
```

With Supabase CLI:

```bash
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=... \
  BRAINTRUST_API_KEY=... \
  BRAINTRUST_PROJECT_ID=... \
  BRAINTRUST_MODEL1_NAME=... \
  BRAINTRUST_PROMPT_SLUG_1=... \
  BRAINTRUST_MODEL2_NAME=... \
  BRAINTRUST_PROMPT_SLUG_2=... \
  BRAINTRUST_MODEL3_NAME=... \
  BRAINTRUST_PROMPT_SLUG_3=...
```

The Braintrust API key is now server-side only. Do not keep using `VITE_BRAINTRUST_API_KEY` in the frontend.

## 7. Create user accounts

This app still expects authenticated Supabase users. Create them manually in Supabase Auth if you are not using self-signup.

## 8. Run the app

```bash
npm run dev
```

Once jobs are queued, analysis continues server-side even if the browser tab closes.
