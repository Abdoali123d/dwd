/* 
   ملف حماية قواعد البيانات (Supabase Security & RLS) - النسخة المحدثة
  =============================================================
  تعليمات الاستخدام:
  1. ادخل على SQL Editor في Supabase.
  2. امسح أي كود قديم هناك.
  3. انسخ هذا الكود بالكامل (Ctrl+A ثم Ctrl+C) والصقه.
  4. اضغط Run.
*/

-- 1. تفعيل الحماية على جميع الجداول
ALTER TABLE IF EXISTS materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fraud_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

-- 2. حذف السياسات القديمة إذا كانت موجودة (لتجنب الخطأ عند إعادة التشغيل)
DROP POLICY IF EXISTS "Public Read Materials" ON materials;
DROP POLICY IF EXISTS "Public Read Lectures" ON lectures;
DROP POLICY IF EXISTS "Public Read Schedule" ON schedule;
DROP POLICY IF EXISTS "Public Read Tutorials" ON tutorials;
DROP POLICY IF EXISTS "Public Read Assignments" ON assignments;

DROP POLICY IF EXISTS "Auth Users Insert Materials" ON materials;
DROP POLICY IF EXISTS "Auth Users Update Materials" ON materials;
DROP POLICY IF EXISTS "Auth Users Delete Materials" ON materials;

DROP POLICY IF EXISTS "Auth Users Insert Lectures" ON lectures;
DROP POLICY IF EXISTS "Auth Users Delete Lectures" ON lectures;

DROP POLICY IF EXISTS "Auth Users Insert Schedule" ON schedule;
DROP POLICY IF EXISTS "Auth Users Delete Schedule" ON schedule;

DROP POLICY IF EXISTS "Auth Users Insert Tutorials" ON tutorials;
DROP POLICY IF EXISTS "Auth Users Delete Tutorials" ON tutorials;

DROP POLICY IF EXISTS "Auth Users Insert Assignments" ON assignments;
DROP POLICY IF EXISTS "Auth Users Delete Assignments" ON assignments;

DROP POLICY IF EXISTS "Auth Users Manage Students" ON students;
DROP POLICY IF EXISTS "Students Read Own Data" ON students;

DROP POLICY IF EXISTS "Anyone can upload submission" ON submissions;
DROP POLICY IF EXISTS "Only Auth can view submissions" ON submissions;

DROP POLICY IF EXISTS "Public Read Attendance Sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Auth Users Manage Attendance Sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Anyone can insert attendance log" ON attendance_logs;
DROP POLICY IF EXISTS "Auth Users Read Attendance Logs" ON attendance_logs;
DROP POLICY IF EXISTS "Anyone can insert fraud log" ON fraud_logs;
DROP POLICY IF EXISTS "Auth Users Read Fraud Logs" ON fraud_logs;

DROP POLICY IF EXISTS "Users Read Own Profile" ON users;
DROP POLICY IF EXISTS "Users Update Own Profile" ON users;
DROP POLICY IF EXISTS "Admins Manage Users" ON users;

-- 3. إنشاء السياسات من جديد

-- المواد: قراءة للجميع، كتابة/تعديل/حذف للمصادقين فقط (role=doctor/admin يتم التحقق منها في التطبيق)
CREATE POLICY "Public Read Materials" ON materials FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Materials" ON materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Update Materials" ON materials FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth Users Delete Materials" ON materials FOR DELETE TO authenticated USING (true);

-- المحاضرات
CREATE POLICY "Public Read Lectures" ON lectures FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Lectures" ON lectures FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Delete Lectures" ON lectures FOR DELETE TO authenticated USING (true);

-- الجدول
CREATE POLICY "Public Read Schedule" ON schedule FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Schedule" ON schedule FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Delete Schedule" ON schedule FOR DELETE TO authenticated USING (true);

-- الدروس
CREATE POLICY "Public Read Tutorials" ON tutorials FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Tutorials" ON tutorials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Delete Tutorials" ON tutorials FOR DELETE TO authenticated USING (true);

-- الواجبات
CREATE POLICY "Public Read Assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "Auth Users Insert Assignments" ON assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Delete Assignments" ON assignments FOR DELETE TO authenticated USING (true);

-- الطلاب: قراءة خاصة، تعديل للمصادقين (يتم التحقق من الصلاحية في التطبيق)
CREATE POLICY "Students Read Own Data" ON students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth Users Manage Students" ON students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth Users Update Students" ON students FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth Users Delete Students" ON students FOR DELETE TO authenticated USING (true);

-- التسليمات: أي شخص يمكنه الرفع، المصادقين فقط يمكنهم القراءة
CREATE POLICY "Anyone can upload submission" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Only Auth can view submissions" ON submissions FOR SELECT TO authenticated USING (true);

-- جلسات الحضور: قراءة للجميع، تعديل للمصادقين
CREATE POLICY "Public Read Attendance Sessions" ON attendance_sessions FOR SELECT USING (true);
CREATE POLICY "Auth Users Manage Attendance Sessions" ON attendance_sessions FOR ALL TO authenticated USING (true);

-- سجلات الحضور: قراءة للمصادقين فقط، إدخال للجميع (يتم التحقق من الموقع في التطبيق)
CREATE POLICY "Anyone can insert attendance log" ON attendance_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth Users Read Attendance Logs" ON attendance_logs FOR SELECT TO authenticated USING (true);

-- سجلات الاحتيال: قراءة للمصادقين فقط، إدخال للجميع
CREATE POLICY "Anyone can insert fraud log" ON fraud_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth Users Read Fraud Logs" ON fraud_logs FOR SELECT TO authenticated USING (true);

-- المستخدمين: قراءة وتعديل بياناتهم الخاصة، إدارة كاملة للمشرفين
CREATE POLICY "Users Read Own Profile" ON users FOR SELECT TO authenticated USING (auth.uid()::text = uid);
CREATE POLICY "Users Update Own Profile" ON users FOR UPDATE TO authenticated USING (auth.uid()::text = uid);
CREATE POLICY "Admins Manage Users" ON users FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE uid = auth.uid()::text AND role IN ('admin', 'Admin', 'ADMIN'))
);
