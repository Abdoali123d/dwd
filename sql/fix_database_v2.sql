-- Fix V2: Handle existing policies
INSERT INTO storage.buckets (id, name, public) VALUES ('assignments', 'assignments', true), ('materials', 'materials', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access Assignments" ON storage.objects;
CREATE POLICY "Public Access Assignments" ON storage.objects FOR ALL USING (bucket_id = 'assignments') WITH CHECK (bucket_id = 'assignments');

DROP POLICY IF EXISTS "Public Access Materials" ON storage.objects;
CREATE POLICY "Public Access Materials" ON storage.objects FOR ALL USING (bucket_id = 'materials') WITH CHECK (bucket_id = 'materials');

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS name text;
UPDATE public.materials SET name = title WHERE name IS NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#00f2ff';

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS material_id integer;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'assignments_material_id_fkey') THEN
        ALTER TABLE public.assignments ADD CONSTRAINT assignments_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;
    END IF;
END $$;

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS grade numeric;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS student_id text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS file_url text;
UPDATE public.submissions SET file_url = file_path WHERE file_url IS NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS assignment_id integer;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'submissions_assignment_id_fkey') THEN
        ALTER TABLE public.submissions ADD CONSTRAINT submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
    END IF;
END $$;

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all materials" ON public.materials;
CREATE POLICY "Enable all materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all assignments" ON public.assignments;
CREATE POLICY "Enable all assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all submissions" ON public.submissions;
CREATE POLICY "Enable all submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);
