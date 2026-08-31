-- إصلاح جدول الواجبات (Fix Assignments Table)
-- هذا الملف يضيف الأعمدة الناقصة ليتوافق مع كود الموقع

-- 1. إضافة عمود material_id و deadline
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

-- 2. (اختياري) يمكنك حذف الأعمدة القديمة إذا لم تعد بحاجة إليها
-- ALTER TABLE assignments DROP COLUMN course_name;

-- 3. تحديث جدول التسليمات ليضمن وجود الأعمدة الصحيحة
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
