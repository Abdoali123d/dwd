-- Create Assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    file_url TEXT,
    material_id UUID REFERENCES public.materials(id)
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Policies for Assignments
-- 1. Professors can insert/update/delete
CREATE POLICY "Professors can do everything on assignments" ON public.assignments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Students can view
CREATE POLICY "Students can view assignments" ON public.assignments
    FOR SELECT
    USING (true);

-- Create Tutorials Table
CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    material_id UUID REFERENCES public.materials(id)
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for tutorials" ON public.tutorials FOR ALL USING (true);


-- Create Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    assignment_id UUID REFERENCES public.assignments(id),
    student_name TEXT,
    student_academic_id TEXT,
    file_url TEXT,
    notes TEXT,
    grade TEXT,
    feedback TEXT,
    status TEXT DEFAULT 'pending'
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for submissions" ON public.submissions FOR ALL USING (true);

-- Refresh Schema Cache (Not real SQL command, but saving the file usually triggers storage refresh if related)
