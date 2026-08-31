-- 1. Create Storage Buckets
-- For Assignments
insert into storage.buckets (id, name, public)
values ('assignments', 'assignments', true)
on conflict (id) do nothing;

-- For Materials (Lectures/Tutorials) if not exists
insert into storage.buckets (id, name, public)
values ('materials', 'materials', true)
on conflict (id) do nothing;

-- 2. Storage Policies (Restrict write to authenticated users; public read for simplicity)
-- WARNING: In production, restrict 'read' to authenticated users as well.

-- Policy for 'assignments' bucket
create policy "Public Read Assignments"
  on storage.objects for select
  using ( bucket_id = 'assignments' );

create policy "Auth Write Assignments"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'assignments' );

create policy "Auth Update Assignments"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'assignments' );

create policy "Auth Delete Assignments"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'assignments' );

-- Policy for 'materials' bucket
create policy "Public Read Materials"
  on storage.objects for select
  using ( bucket_id = 'materials' );

create policy "Auth Write Materials"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'materials' );

create policy "Auth Update Materials"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'materials' );

create policy "Auth Delete Materials"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'materials' );

-- 3. Database Tables Setup

-- Materials Table
create table if not exists public.materials (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  accent_color text default '#00f2ff'
);

-- Assignments Table
create table if not exists public.assignments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  material_id uuid references public.materials(id) on delete cascade,
  title text not null,
  description text,
  deadline timestamp with time zone,
  file_url text
);

-- Submissions Table (for students uploading solutions)
create table if not exists public.submissions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  assignment_id uuid references public.assignments(id) on delete cascade,
  student_name text,
  student_id text,
  file_url text,
  grade numeric,
  feedback text,
  status text default 'pending' -- pending, graded
);

-- Tutorials Table
create table if not exists public.tutorials (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    material_id uuid references public.materials(id) on delete cascade,
    title text not null,
    url text
);

-- Lectures Table
create table if not exists public.lectures (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    material_id uuid references public.materials(id) on delete cascade,
    title text not null,
    url text
);

-- 4. Enable RLS (Optional but recommended, here we just enable it)
alter table public.materials enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.tutorials enable row level security;
alter table public.lectures enable row level security;

-- 5. Open Access Policies (For development - adjust for production)
create policy "Enable read access for all users" on public.materials for select using (true);
create policy "Enable insert for all users" on public.materials for insert with check (true);

create policy "Enable read access for all users" on public.assignments for select using (true);
create policy "Enable insert for all users" on public.assignments for insert with check (true);
create policy "Enable delete for all users" on public.assignments for delete using (true);

create policy "Enable read access for all users" on public.submissions for select using (true);
create policy "Enable insert for all users" on public.submissions for insert with check (true);
create policy "Enable update for all users" on public.submissions for update using (true);

create policy "Enable read access for all users" on public.tutorials for select using (true);
create policy "Enable insert for all users" on public.tutorials for insert with check (true);
create policy "Enable delete for all users" on public.tutorials for delete using (true);

create policy "Enable read access for all users" on public.lectures for select using (true);
create policy "Enable insert for all users" on public.lectures for insert with check (true);
create policy "Enable delete for all users" on public.lectures for delete using (true);
