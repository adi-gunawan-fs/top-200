# Supabase Setup

Steps to wire up a new Supabase project to this app.

---

## 1. Create a Supabase project

Go to https://supabase.com, create a new project, and wait for it to provision.

---

## 2. Set environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in your Supabase dashboard → **Project Settings → API**.

---

## 3. Create the database table

In the Supabase dashboard go to **SQL Editor** and run:

```sql
create table public.csv_uploads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  file_path   text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

-- All authenticated users can read all uploads (shared workspace)
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

---

## 4. Create the Storage bucket

In the Supabase dashboard go to **Storage** and create a new bucket:

- **Name:** `csv-uploads`
- **Public:** No (private)

Then go to **Storage → Policies** and add these policies for the `csv-uploads` bucket:

```sql
-- Allow authenticated users to upload files
create policy "Authenticated users can upload CSV files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'csv-uploads');

-- Allow authenticated users to download any file
create policy "Authenticated users can download CSV files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'csv-uploads');

-- Allow authenticated users to delete any file
create policy "Authenticated users can delete CSV files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'csv-uploads');
```

---

## 5. Create user accounts

This app does not have self-signup. Create accounts manually in the Supabase dashboard:

**Authentication → Users → Add user**

Enter the email and password for each team member.

---

## 6. Run the app

```bash
npm run dev
```

Navigate to `http://localhost:5173`, sign in with a created account, and upload a CSV.
