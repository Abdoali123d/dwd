/*
    ملف إعدادات Supabase Database
    هذا الملف مسؤول فقط عن تهيئة الاتصال بقاعدة البيانات لجلب الجداول
    بينما عملية تسجيل الدخول تتم الآن عبر Firebase.
*/

// دالة ذكية تجلب المفاتيح من البيئة لو موجودة، أو تستخدم الاحتياطي لو احنا Local
const getEnv = (key, fallback) => {
    try {
        // لو شغالين Node/Vercel
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
        // لو شغالين Live Server (المتصفح لا يعرف process)
        return fallback;
    } catch (e) {
        return fallback;
    }
};

// مفاتيح الـ Fallback removed for security.
// App requires explicit configuration via environment or window.appSupabaseConfig.
const SB_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL", "");
const SB_KEY = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

// إنشاء نسخة من العميل
let supabaseClient = null;

const initializeClient = () => {
    if (!SB_URL || !SB_KEY) {
        console.warn("Supabase URL/Key not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        return;
    }
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
        window.appSupabaseClient = supabaseClient;
        window.appSupabaseConfig = { url: SB_URL, anonKey: SB_KEY };
    } else if (typeof createClient === 'function') {
        supabaseClient = createClient(SB_URL, SB_KEY);
        window.appSupabaseClient = supabaseClient;
        window.appSupabaseConfig = { url: SB_URL, anonKey: SB_KEY };
    }
};

const setupSupabase = () => {
    try {
        initializeClient();

        // If not initialized yet, wait a bit for CDN
        if (!supabaseClient) {
            // console.log("⏳ Waiting for Supabase CDN...");  [Security Fix]
            let attempts = 0;
            const interval = setInterval(() => {
                initializeClient();
                if (supabaseClient || attempts > 20) {
                    clearInterval(interval);
                    if (!supabaseClient) console.error("❌ Failed to initialize Supabase after timeout");
                }
                attempts++;
            }, 500);
        }
    } catch (e) {
        console.error("❌ Error initializing Supabase:", e);
    }
};

// تهيئة فورية
setupSupabase();

// إتاحة العميل عالمياً لاستخدامه في باقي الملفات
window.appSupabaseClient = supabaseClient;

// حماية إضافية: إذا كان window.supabase غير موجود، لا نحاول تعيينه لـ client
// لأن CDN هو الذي يملأ window.supabase
if (typeof window.supabase === 'undefined' && supabaseClient) {
    window.supabase = supabaseClient;
}

// تصدير دالة جلب المستخدم الحالي (يعتمد على البيانات المحفوظة محلياً من تسجيل دخول Firebase)
// هذا لضمان توافق الكود القديم الذي يستدعي getCurrentUser
window.getCurrentUser = function () {
    return JSON.parse(localStorage.getItem('currentUser'));
};
