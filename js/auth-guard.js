/**
 * Auth Guard - Hybrid Optimistic Architecture (Fast UI + JWT Security)
 * DWD Smart Campus
 * تم دمج سرعة النظام القديم (Optimistic UI) مع الحماية القاتلة في الخلفية (Background Database Verification)
 */
(function () {
    'use strict';

    // 1. تحديد مسار الصفحة الحالية
    const path = window.location.pathname.toLowerCase();

    // إعفاء الصفحات العامة التي لا تحتاج حماية
    const isPublic = path.endsWith('index.html') && !path.includes('/dwd/') ||
        path === '/' ||
        path === '/dwd-it/' ||
        path === '/dwd-it2' ||
        path.endsWith('/dwd-it/index.html') ||
        path.endsWith('/dwd-edu/index.html') ||
        path.endsWith('/dwd-it2/index.html') ||
        path.includes('/login');

    if (isPublic) return;

    // حساب الـ Prefix الصحيح للتوجيه بناءً على عمق المجلدات لتجنب أخطاء المسار
    const pathStr = window.location.pathname;
    const subFolders = ['materials', 'schedule', 'downloads', 'exams', 'profile', 'about', 'communication', 'attendance', 'news', 'training-weeks', 'ai-nano', 'admin', 'grades'];
    // ← FIX: includes('/folder/') fails with trailingSlash:false — use split('/') instead
    const isSubPage = subFolders.some(folder => pathStr.toLowerCase().split('/').includes(folder));
    const prefix = isSubPage ? "../../" : "./";

    // دالة الطرد (تُنظف بيانات المتصفح وتوجه لصفحة الدخول)
    const enforceRedirect = (reason) => {
        console.warn("[Auth Guard] Security Kick out:", reason);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('dwd_user');
        localStorage.removeItem('isLoggedIn');
        document.cookie = "dwd_session=; path=/; max-age=0";
        window.location.replace(prefix + 'login.html');
    };

    // ==========================================
    // PWA OFFLINE BYPASS — لا تطرد المستخدم إذا كان أوفلاين
    // BUT require a cached session; offline does NOT mean anonymous access.
    // ==========================================
    const isOffline = !navigator.onLine;

    let localUserStr = localStorage.getItem('currentUser') || localStorage.getItem('dwd_user');
    if (!localUserStr) {
        if (isOffline) {
            console.warn('[Auth Guard] Offline with no cached session — denying access');
        }
        return enforceRedirect("لا يوجد مستخدم مسجل في المتصفح");
    }

    let localUser;
    try {
        localUser = JSON.parse(localUserStr);
    } catch {
        return enforceRedirect("بيانات المستخدم تالفة");
    }

    if (!localUser || !localUser.email) {
        return enforceRedirect("بيانات المستخدم ناقصة (بدون إيميل)");
    }

    const localRole = (localUser.role || 'student').toLowerCase();
    const isProf = (localRole === 'doctor' || localRole === 'professor');

    // التوجيه الفوري السريع
    const isProfessorPage = path.includes('professor.html');
    const isStudentSchedulePage = path.includes('schedule/index.html');
    const isAdminPage = path.includes('admin-dashboard.html') || path.includes('admin.html') || path.includes('/admin/');

    // منع غير الأدمن من الوصول لصفحات الأدمن
    if (isAdminPage && localRole !== 'admin') {
        window.location.replace(prefix + 'home.html');
        return;
    }

    // منع الدكتور من دخول جدول الطالب والعكس (Admins are exempt)
    if (localRole !== 'admin') {
        if (isProf && isStudentSchedulePage) {
            window.location.replace(prefix + 'DWD/schedule/professor.html');
            return;
        }
        if (!isProf && isProfessorPage) {
            window.location.replace(prefix + 'DWD/schedule/index.html');
            return;
        }
    }

    // ==========================================
    // UI Hydration — Instant display from localStorage (Phase 0)
    // This runs synchronously BEFORE background checks and BEFORE any network calls.
    // It does NOT affect any auth, redirect, or security logic.
    // ==========================================
    const _hydrate = () => {
        // Call global syncUserDisplay if already loaded (from secure_connect.js)
        if (typeof window.syncUserDisplay === 'function') {
            window.syncUserDisplay();
        }
        // Instant doctor portal label (no network needed)
        if (isProf) {
            const portalTitle = document.getElementById('portal-title');
            if (portalTitle) {
                const name = localUser.name || localUser.user_metadata?.full_name || 'الأستاذ';
                portalTitle.textContent = 'Professor Portal — ' + name;
            }
            // Add professor-portal class to body for CSS targeting
            document.body.classList.add('is-professor-portal');
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _hydrate);
    } else {
        _hydrate();
    }

    // ==========================================
    // المرحلة الثانية: لمسة الأمان (Background Verification)
    // ==========================================
    // المرحلة الثانية: لمسة الأمان (Background Verification)
    // ==========================================
    const backgroundSecurityCheck = async () => {
        if (!navigator.onLine) {
            console.info('[Auth Guard] Offline — skipping background DB check');
            return;
        }

        try {
            let attempts = 0;
            let supabase = window.appSupabaseClient;

            while (!supabase && attempts < 50) {
                if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
                    const sbUrl = window.appSupabaseConfig?.url;
                    const sbKey = window.appSupabaseConfig?.anonKey;
                    if (sbUrl && sbKey) {
                        supabase = window.supabase.createClient(sbUrl, sbKey);
                        window.appSupabaseClient = supabase;
                    }
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                supabase = window.appSupabaseClient;
                attempts++;
            }

            if (!supabase) return;

            if (window.SecureConnect && typeof window.SecureConnect.syncSupabaseAuth === 'function') {
                await window.SecureConnect.syncSupabaseAuth();
            }

            let query = supabase.from('users').select('role');
            if (localUser.academic_id && localUser.academic_id !== 'N/A') {
                query = query.or(`email.ilike.${localUser.email},academic_id.eq.${localUser.academic_id}`);
            } else {
                query = query.ilike('email', localUser.email);
            }
            const { data: profile, error } = await query.maybeSingle();

            if (error || !profile) {
                if (!navigator.onLine) return;
                console.warn("[Auth Guard Background] إما أن الإيميل انحذف من قاعدة البيانات أو هناك خطأ.");
                return enforceRedirect("المستخدم غير موجود بقاعدة البيانات الفعلية!");
            }

            const realRole = (profile.role || 'student').toLowerCase();

            if (localRole !== realRole) {
                console.error("⚠️ [Security Alert] تم اكتشاف تلاعب في الصلاحيات!");

                localUser.role = realRole;
                localStorage.setItem('currentUser', JSON.stringify(localUser));

                const trueIsProf = (realRole === 'doctor' || realRole === 'professor');
                const trueIsAdmin = (realRole === 'admin');

                if (isAdminPage && !trueIsAdmin) {
                    window.location.replace(prefix + 'home.html');
                } else if (!trueIsProf && isProfessorPage) {
                    window.location.replace(prefix + 'DWD/schedule/index.html');
                } else if (trueIsProf && isStudentSchedulePage) {
                    window.location.replace(prefix + 'DWD/schedule/professor.html');
                } else if (trueIsAdmin && isStudentSchedulePage) {
                    window.location.replace(prefix + 'DWD/schedule/admin.html');
                } else {
                    window.location.replace(prefix + 'login.html');
                }
            }

        } catch (err) {
            if (!navigator.onLine) return;
            console.error("[Auth Guard Background] Error:", err);
        }
    };

    // تشغيل فحص الأمان في الخلفية بمجرد استعداد المتصفح
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', backgroundSecurityCheck);
    } else {
        backgroundSecurityCheck();
    }
})();