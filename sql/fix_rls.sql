-- ==========================================
-- تأمين جدول users وتخطي RLS لعمليات Firebase
-- ==========================================

-- 1. تفعيل RLS على الجدول
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. إيقاف جميع صلاحيات القراءة الافتراضية للكل لمنع التسريب
-- سنعتمد على الدوال (RPC) التي تعمل كـ SECURITY DEFINER للتحكم 

-- دالة للسماح للمستخدم بقراءة بياناته الخاصة وتخطي RLS بدون الحاجة لحساب Supabase 
CREATE OR REPLACE FUNCTION get_my_metadata_by_uid(p_uid text)
RETURNS TABLE (name text, academic_id text, role text, email text)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT u.name, u.academic_id, u.role, u.email 
  FROM public.users u 
  WHERE u.uid = p_uid;
END;
$$ LANGUAGE plpgsql;

-- دالة للسماح للمشرفين والدكاترة بقراءة كل الطلبة بصلاحيات كاملة
CREATE OR REPLACE FUNCTION get_students_for_admin(p_admin_uid text)
RETURNS TABLE (id uuid, full_name text, name text, academic_id text)
SECURITY DEFINER
AS $$
BEGIN
  -- التحقق من صلاحية المستخدم (الدكتور أو الأدمن) بناءً على الـ UID الآتي من Firebase 
  IF EXISTS (SELECT 1 FROM public.users WHERE uid = p_admin_uid AND role IN ('Admin', 'Doctor', 'admin', 'doctor', 'ADMIN', 'DOCTOR')) THEN
    RETURN QUERY 
    SELECT u.id, u.full_name, u.name, u.academic_id 
    FROM public.users u 
    WHERE u.academic_id IS NOT NULL OR u.role IN ('Student', 'student')
    ORDER BY u.academic_id ASC;
  ELSE
    RAISE EXCEPTION 'غير مصرح لك بالوصول لبيانات الطلاب.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. سياسات RLS الاعتيادية الاحتياطية (إذا تم تسجيل الدخول بـ Supabase مستقبلاً)
CREATE POLICY "Users can Read Their Own Data"
ON public.users
FOR SELECT
USING (auth.uid()::text = uid);

CREATE POLICY "Users can Update Their Own Data"
ON public.users
FOR UPDATE
USING (auth.uid()::text = uid);

-- يمكن للـ Backend (Vercel) استخدام جميع الصلاحيات لأنه يتخطي RLS كالتالي:
-- (Supabase Service Role Key bypasses RLS directly)
