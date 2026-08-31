-- ملف إنشاء الجداول (Tables Creation)
-- يرجى تشغيل هذا الملف في Supabase SQL Editor لضمان وجود الجداول المطلوبة

-- 1. جدول الواجبات (Assignments)
CREATE TABLE IF NOT EXISTS assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    course_name TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    professor_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول التسليمات (Submissions)
CREATE TABLE IF NOT EXISTS submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_academic_id TEXT NOT NULL,
    file_url TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. تفعيل التخزين (Storage) - اختياري إذا لم يكن مفعلاً
-- يفضل إنشاء Bucket باسم 'assignments' من لوحة التحكم (Storage > New Bucket)
-- وتفعيله كـ Public للسهولة في البداية
