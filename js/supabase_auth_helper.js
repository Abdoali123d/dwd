/*
    ملف إدارة تسجيل الدخول (Supabase Auth) - نسخة محسنة وشاملة
    ========================================
*/

// --- 1. إعدادات مكتبة Supabase ---
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

// إنشاء نسخة من العميل للتعامل مع قاعدة البيانات
let supabaseClient = null;

const setupSupabase = () => {
    try {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
            // console.log("✅ Supabase Client Initialized");  [Security Fix]
        } else if (typeof createClient === 'function') {
            supabaseClient = createClient(SB_URL, SB_KEY);
            // console.log("✅ Supabase Client Initialized (createClient)");  [Security Fix]
        }
    } catch (e) {
        console.error("❌ Error initializing Supabase:", e);
    }
};

// Initialize
setupSupabase();

// Initialize
setupSupabase();

// Make the client accessible globally with a distinct name
window.appSupabaseClient = supabaseClient;

// IMPORTANT: Do NOT overwrite window.supabase if it contains the library (has createClient).
// Only set it if it's undefined, to avoid breaking other scripts that need to call createClient.
if (typeof window.supabase === 'undefined') {
    window.supabase = supabaseClient;
}

// --- 2. Auth Functions ---

/**
 * دالة تسجيل الدخول الموحدة
 */



async function login(email, password) {
    if (!supabaseClient) setupSupabase();

    try {
        // محاولة الدخول باستخدام البريد وكلمة السر عبر Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        // لو نجح الدخول، بنحفظ الجلسة ونحول المستخدم للصفحة الرئيسية
        if (!authError && authData.user) {
            saveSession(authData.user);
            await handlePostLogin(authData.user.email);
            return;
        }

        // لو فشل الدخول عبر السيرفر، بنروح لمرحلة الـ Fallback (المحلي)
        throw new Error(authError?.message || "Supabase login failed");

    } catch (error) {
        // --- نظام الدخول الاحتياطي (المحلي) ---
        // ده بيشتغل لو مفيش إنترنت أو لو اليوزر لسه متسجلش في قاعدة البيانات الأونلاين
        const localUsers = JSON.parse(localStorage.getItem("dwd_users_db")) || [];
        const user = localUsers.find(
            u => u.email.toLowerCase() === email.toLowerCase() && String(u.password) === String(password)
        );

        if (user) {
            // محاكاة كائن المستخدم عشان الدوال التانية تفهمه
            const mockUser = {
                id: user.uid || 'local-' + Date.now(),
                email: user.email,
                academic_id: user.academic_id || 'N/A',
                user_metadata: {
                    full_name: user.name,
                    academic_id: user.academic_id
                }
            };
            saveSession(mockUser);
            await handlePostLogin(user.email);
            return;
        }

        // If both fail
        throw new Error("بيانات الدخول غير صحيحة. يرجى التأكد من البريد وكلمة المرور.");
    }
}

// حفظ بيانات الجلسة الحالية في المتصفح عشان تفضل مسجل دخول
function saveSession(user) {
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    const academicId = user.academic_id || user.user_metadata?.academic_id || 'N/A';

    const userData = {
        id: user.id,
        email: user.email,
        name: name,
        full_name: name,
        academic_id: academicId,
        role: user.role || 'student',
        displayed_id: (academicId !== 'N/A') ? academicId : (user.email.match(/\d+/) ? user.email.match(/\d+/)[0] : 'N/A')
    };
    localStorage.setItem("currentUser", JSON.stringify(userData));
    localStorage.setItem("dwd_user", JSON.stringify(userData));
    localStorage.setItem("isLoggedIn", "true");
}

// وظيفة لتحديث بيانات المستخدم (الباسورد والاسم) في 3 أماكن: السيرفر، قاعدة البيانات، والتخزين المحلي
window.updateUserInStorage = async function (updatedUser) {
    let successCount = 0;
    try {
        // console.log("🔄 Updating user data...");  [Security Fix]

        // 1. Update Server.js File (Node API)
        if (updatedUser.password) {
            try {
                await fetch('/api/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: updatedUser.email, newPassword: updatedUser.password })
                });
                // console.log("✅ Server File updated.");  [Security Fix]
                successCount++;
            } catch (err) { console.error("Server update failed:", err); }

            // 2. Update Supabase
            try {
                // 'users' table
                await supabaseClient.from('users').update({ password: updatedUser.password }).eq('email', updatedUser.email);
                // Auth User
                await supabaseClient.auth.updateUser({ password: updatedUser.password });
                // console.log("✅ Supabase updated.");  [Security Fix]
                successCount++;
            } catch (err) { console.error("Supabase update failed:", err); }
        }

        // 3. Update LocalStorage (Always)
        // Find in local DB and update
        let usersFromStorage = JSON.parse(localStorage.getItem("dwd_users_db")) || [];
        const idx = usersFromStorage.findIndex(u => u.email === updatedUser.email);
        if (idx !== -1) {
            const { password, ...rest } = updatedUser;
            usersFromStorage[idx] = { ...usersFromStorage[idx], ...rest };
            localStorage.setItem("dwd_users_db", JSON.stringify(usersFromStorage));
        }

        // Update Session
        const { password: pw, ...sessionUpdate } = updatedUser;
        saveSession(sessionUpdate);
        // console.log("✅ LocalStorage updated.");  [Security Fix]

        if (successCount === 0 && updatedUser.password) {
            // Only alert if EVERYTHING network-related failed, but we still updated local storage.
            console.warn("Updated locally only.");
        }

    } catch (e) {
        console.error("Update Failed:", e);
        throw e;
    }
};

async function logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    localStorage.clear();

    // Smart redirect based on current depth
    const pathStr = window.location.pathname;
    const subFolders = ['materials', 'schedule', 'downloads', 'exams', 'profile', 'about', 'communication', 'attendance', 'news', 'training-weeks', 'Ai-Nano'];
    const isSubPage = subFolders.some(folder => pathStr.toLowerCase().split('/').includes(folder));
    const prefix = isSubPage ? "../../" : "./";

    window.location.href = prefix + "login.html";
}

async function handlePostLogin(email) {
    try {
        email = email.toLowerCase();
        // console.log(`Checking role for: ${email}`);  [Security Fix]

        let backendRole = 'student';



        // 2. Fetch User Profile from Supabase
        let { data: profile } = await supabaseClient
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        // 3. Sync/Upsert User in DB
        if (!profile) {
            // console.log("Creating new user profile in DB...");  [Security Fix]
            const name = email.split('@')[0];
            const newUser = {
                uid: (await supabaseClient.auth.getUser()).data.user?.id || 'anon',
                email: email,
                name: name,
                role: backendRole,
                academic_id: email.match(/\d+/) ? email.match(/\d+/)[0] : null
            };

            await supabaseClient.from('users').insert([newUser]);
        } else if (profile.role !== backendRole) {
            // Force update if backend says otherwise (CRITICAL FIX for existing users)
            // console.log(`Updating role from ${profile.role} to ${backendRole}`);  [Security Fix]
            await supabaseClient.from('users').update({ role: backendRole }).eq('email', email);
            profile.role = backendRole; // Update local reference
        }

        // 4. Update Local Session
        const currentUser = JSON.parse(localStorage.getItem("currentUser")) || {};
        currentUser.role = backendRole; // Trust backend
        currentUser.academic_id = profile?.academic_id || currentUser.academic_id;
        currentUser.name = profile?.name || currentUser.name;

        localStorage.setItem("currentUser", JSON.stringify(currentUser));

        // 5. Intelligent Redirection
        const pathStr = window.location.pathname;
        const subFolders = ['materials', 'schedule', 'downloads', 'exams', 'profile', 'about', 'communication', 'attendance', 'news', 'training-weeks', 'Ai-Nano'];
        const isSubPage = subFolders.some(folder => pathStr.toLowerCase().split('/').includes(folder));
        const prefix = isSubPage ? "../../" : "./";

        window.location.href = prefix + "home.html";

    } catch (e) {
        console.error("Redirect Error:", e);
        window.location.href = "home.html";
    }
}

// Global Export
window.login = login;
window.logout = logout;
window.handlePostLogin = handlePostLogin; // Main function
window.checkUserRole = handlePostLogin;     // Alias for backward compatibility
window.getCurrentUser = async () => {
    if (!supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session?.user || JSON.parse(localStorage.getItem("currentUser"));
};