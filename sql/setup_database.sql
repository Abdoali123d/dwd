-- 1. Create Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    material_id TEXT, 
    file_url TEXT 
);

-- 2. Create Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    student_name TEXT,
    student_email TEXT,
    student_academic_id TEXT,
    file_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, reviewed, graded
    grade TEXT,
    feedback TEXT
);

-- 3. Enable RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Permissive for this project scope)
CREATE POLICY "Public Read Assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "Public Insert Assignments" ON assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Assignments" ON assignments FOR DELETE USING (true);

CREATE POLICY "Public Read Submissions" ON submissions FOR SELECT USING (true);
CREATE POLICY "Public Insert Submissions" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Submissions" ON submissions FOR UPDATE USING (true);

-- 5. Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access Materials" ON storage.objects FOR SELECT USING (bucket_id = 'materials');
CREATE POLICY "Public Upload Materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materials');
CREATE POLICY "Public Update Materials" ON storage.objects FOR UPDATE USING (bucket_id = 'materials');

-- 6. Insert Dummy Data (Optional - to verify connection)
INSERT INTO assignments (title, description, deadline, user_id) 
VALUES ('واجب تجريبي 1', 'قم برفع ملف PDF يحتوي على حل المسائل.', NOW() + INTERVAL '7 days', 'system-test')
ON CONFLICT DO NOTHING;
