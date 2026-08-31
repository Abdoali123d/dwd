-- 1. إصلاح مخازن الملفات (Storage Buckets) لحل مشكلة Bucket not found
insert into storage.buckets (id, name, public)
values ('assignments', 'assignments', true), ('materials', 'materials', true)
on conflict (id) do nothing;

-- سياسات التخزين (للسماح بالرفع والقراءة)
create policy "Public Access Assignments" on storage.objects for all using ( bucket_id = 'assignments' ) with check ( bucket_id = 'assignments' );
create policy "Public Access Materials" on storage.objects for all using ( bucket_id = 'materials' ) with check ( bucket_id = 'materials' );


-- 2. تحديث جدول المواد (materials) ليطابق الكود
-- الكود يحتاج أعمدة: name, accent_color
alter table public.materials add column if not exists name text;
update public.materials set name = title where name is null; -- نقل البيانات القديمة
alter table public.materials add column if not exists accent_color text default '#00f2ff';


-- 3. ربط المحاضرات (lectures) بالمواد
-- الكود يحتاج: material_id, url
alter table public.lectures add column if not exists material_id integer references public.materials(id) on delete cascade;
alter table public.lectures add column if not exists url text;
update public.lectures set url = video_url where url is null;


-- 4. ربط الدروس التعليمية (tutorials) بالمواد
-- الكود يحتاج: material_id, url
alter table public.tutorials add column if not exists material_id integer references public.materials(id) on delete cascade;
alter table public.tutorials add column if not exists url text;
update public.tutorials set url = file_url where url is null;


-- 5. تحديث جدول الواجبات (assignments)
-- الكود يحتاج: material_id, deadline, file_url
-- الجدول لديك يحتوي بالفعل على material_id ولكن سنتأكد من الربط الصحيح
alter table public.assignments drop constraint if exists assignments_material_id_fkey;
alter table public.assignments add constraint assignments_material_id_fkey foreign key (material_id) references public.materials(id) on delete cascade;


-- 6. تحديث جدول التسليمات (submissions) للطلاب
-- الكود يحتاج: grade, feedback, status, student_id, file_url
alter table public.submissions add column if not exists grade numeric;
alter table public.submissions add column if not exists feedback text;
alter table public.submissions add column if not exists status text default 'pending';
alter table public.submissions add column if not exists student_id text;
alter table public.submissions add column if not exists file_url text;
update public.submissions set file_url = file_path where file_url is null;
alter table public.submissions drop constraint if exists submissions_assignment_id_fkey;
alter table public.submissions add constraint submissions_assignment_id_fkey foreign key (assignment_id) references public.assignments(id) on delete cascade;

-- 7. تفعيل الحماية (اختياري) ولكن مفيد لضمان عمل السياسات
alter table public.materials enable row level security;
alter table public.assignments enable row level security;
alter table public.lectures enable row level security;
alter table public.tutorials enable row level security;
alter table public.submissions enable row level security;

-- السماح للجميع بالقراءة والكتابة (للتسهيل في مرحلة التطوير)
create policy "Enable all access materials" on public.materials for all using (true) with check (true);
create policy "Enable all access assignments" on public.assignments for all using (true) with check (true);
create policy "Enable all access lectures" on public.lectures for all using (true) with check (true);
create policy "Enable all access tutorials" on public.tutorials for all using (true) with check (true);
create policy "Enable all access submissions" on public.submissions for all using (true) with check (true);
