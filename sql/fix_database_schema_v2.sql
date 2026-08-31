-- إصلاح خطأ نوع البيانات (Fix Data Type Mismatch)
-- المشكلة: جدول materials يستخدم معرف رقمي (Integer) بينما حاولنا استخدام UUID
-- الحل: تغيير نوع العمود ليكون BIGINT ليطابق جدول materials

-- 1. إضافة عمود material_id بنوع BIGINT (بدلاً من UUID)
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS material_id BIGINT REFERENCES materials(id) ON DELETE CASCADE;

-- 2. إضافة عمود deadline
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

-- 3. تحديث جدول submissions
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();

-- ملاحظة: إذا ظهر خطأ أن العمود موجود مسبقاً بنوع خطأ، يرجى تشغيل هذا السطر أولاً:
-- ALTER TABLE assignments DROP COLUMN IF EXISTS material_id;
