/* 
   ملف حماية قواعد البيانات (Supabase Security & RLS)
  ====================================================
  تعليمات الاستخدام:
  1. افتح لوحة تحكم Supabase.
  2. اذهب إلى SQL Editor.
  3. انسخ هذا الكود بالكامل والصقه هناك.
  4. اضغط Run.

  تنبيه هام جداً:
  هذه السياسات تعتمد على أن المستخدم "مسجل دخول" (Authenticated) لكي يتمكن من التعديل.
  وبما أن كود الموقع الحالي يستخدم LocalStorage فقط (وليس Supabase Auth)،
  فإن تفعيل هذه الاكواد سيمنع "الجميع" (حتى المشرف) من الكتابة حتى يتم ربط تسجيل الدخول بـ Supabase.
*/

-- 1. تفعيل الحماية على جميع الجداول (Enable RLS)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- 2. سياسات القراءة العامة (Public Read Access)
-- السماح للجميع بقراءة المحتوى التعليمي
CREATE POLICY "Public Read Materials" ON materials FOR SELECT USING (true);
CREATE POLICY "Public Read Lectures" ON lectures FOR SELECT USING (true);
CREATE POLICY "Public Read Schedule" ON schedule FOR SELECT USING (true);
CREATE POLICY "Public Read Tutorials" ON tutorials FOR SELECT USING (true);
CREATE POLICY "Public Read Assignments" ON assignments FOR SELECT USING (true);

-- 3. سياسات الكتابة (Restricted Write Access)
-- السماح فقط للمستخدمين المسجلين (Authenticated) بالإضافة والتعديل والحذف
-- ملاحظة: هذا يتطلب استخدام supabase.auth.signInWithPassword في صفحة الدخول
CREATE POLICY "Auth Users Insert Materials" ON materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Update Materials" ON materials FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth Users Delete Materials" ON materials FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth Users Insert Lectures" ON lectures FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Delete Lectures" ON lectures FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth Users Insert Schedule" ON schedule FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Delete Schedule" ON schedule FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth Users Insert Tutorials" ON tutorials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Delete Tutorials" ON tutorials FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth Users Insert Assignments" ON assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Delete Assignments" ON assignments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth Users Manage Students" ON students FOR ALL TO authenticated USING (true);

-- 4. حماية خاصة لجدول التسليمات (Submissions)
-- الطالب يمكنه فقط رؤية تسليماته (بناءً على الـ ID أو الاسم إذا كان مسجلاً)
-- حالياً نسمح للجميع بالإضافة (لأن الطالب يرفع الواجب)، ولكن القراءة للمشرف فقط.
CREATE POLICY "Anyone can upload submission" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Only Auth can view submissions" ON submissions FOR SELECT TO authenticated USING (true);
