/*
    DWD Secure Connect v3.0 — Login Optimization
    Firebase-First Strategy with Supabase Fallback & Local Caching
*/

import { auth } from "./firebase_config.js";
import { signInWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- User Metadata Cache (avoids redundant Supabase queries) ---
const CACHE_KEY = 'dwd_user_meta_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachedMetadata(email) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
        const entry = cache[email.toLowerCase()];
        if (entry && (Date.now() - entry.ts) < CACHE_TTL_MS) {
            return entry.data;
        }
    } catch (e) { /* corrupted cache, ignore */ }
    return null;
}

function setCachedMetadata(email, data) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
        cache[email.toLowerCase()] = { data, ts: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) { /* storage full, ignore */ }
}

// --- Lazy Supabase Loader (only loads when needed for fallback) ---
async function getSupabase() {
    if (window.appSupabaseClient) return window.appSupabaseClient;

    // Dynamically load Supabase if not already loaded
    try {
        await new Promise((resolve, reject) => {
            if (document.querySelector('script[src*="supabase"]')) {
                // Already loading, wait for it
                const check = setInterval(() => {
                    if (window.appSupabaseClient) { clearInterval(check); resolve(); }
                }, 100);
                setTimeout(() => { clearInterval(check); reject('timeout'); }, 5000);
            } else {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                s.onload = () => {
                    const s2 = document.createElement('script');
                    s2.src = '/js/supabase_client.js';
                    s2.onload = () => resolve();
                    document.head.appendChild(s2);
                };
                s.onerror = reject;
                document.head.appendChild(s);
            }
        });
    } catch (e) {
        console.warn('Failed to load Supabase:', e);
    }
    return window.appSupabaseClient || null;
}

// --- Fetch User Metadata (with caching) ---
async function fetchUserMetadata(email) {
    // 1. Check Cache First (instant, no network)
    const cached = getCachedMetadata(email);
    if (cached) return cached;

    // 2. Check Local Users DB (legacy offline list)
    try {
        const localUsers = JSON.parse(localStorage.getItem("dwd_users_db")) || [];
        const matchedUser = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (matchedUser) {
            const meta = buildMetadata(matchedUser, email);
            setCachedMetadata(email, meta);
            return meta;
        }
    } catch (e) { /* parse error, continue */ }

    // 3. Query Supabase (only if nothing local found)
    try {
        const supabase = await getSupabase();
        if (supabase) {
            // First try the new secure RPC method if uid is provided
            if (window._currentFirebaseUid) {
                const { data, error } = await supabase.rpc('get_my_metadata_by_uid', { p_uid: window._currentFirebaseUid });
                if (data && data.length > 0 && !error) {
                    const meta = buildMetadata(data[0], email);
                    setCachedMetadata(email, meta);
                    return meta;
                }
            }

            // Fallback to normal query (might be blocked by RLS for students, but works for Admins/Doctors)
            const { data, error } = await supabase
                .from('users')
                .select('name, academic_id, role, email')
                .eq('email', email)
                .single();

            if (data && !error) {
                const meta = buildMetadata(data, email);
                setCachedMetadata(email, meta);
                return meta;
            }
        }
    } catch (e) {
        console.warn('Supabase metadata query failed or blocked by RLS:', e.message);
    }

    // 4. Fallback: extract from email
    return buildMetadata({}, email);
}

function buildMetadata(user, email) {
    return {
        full_name: user.name || 'مستخدم جديد',
        academic_id: user.academic_id || (email.match(/\d+/) ? email.match(/\d+/)[0] : 'N/A'),
        role: user.role || (email.includes('doctor') || email.includes('admin@batechu.com') ? 'Doctor' : 'Student')
    };
}

// --- Login (Firebase-First, Supabase Fallback) ---
window.login = async function (email, password) {
    try {
        console.log("🔒 Attempting Secure Login...");

        // === Firebase Auth (Primary) ===
        // Pre-flight check: If App Check is throttling, we might fail here.
        // We attempt login.
        try {
            var userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (initialError) {
            // Handle App Check 403 specifically - fail fast, don't hang
            const isAppCheckError =
                initialError.code === 'auth/network-request-failed' ||
                initialError.message?.includes('requests from this device are blocked') ||
                initialError.message?.includes('AppCheck') ||
                initialError.message?.includes('reCAPTCHA');

            if (isAppCheckError) {
                console.warn("⚠️ App Check issue detected. Jumping to Supabase fallback immediately...");
                // Re-throw a specific error to skip Firebase re-attempt and go directly to Supabase
                throw { code: 'auth/appcheck-failed', message: 'AppCheck bypass — using Supabase.' };
            }
            throw initialError;
        }

        const firebaseUser = userCredential.user;

        window._currentFirebaseUid = firebaseUser.uid; // للتعرف المؤقت لتخطي الـ RLS

        // Fetch metadata (cached → local → Supabase, non-blocking)
        const meta = await fetchUserMetadata(email);

        const sessionUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            academic_id: meta.academic_id,
            role: meta.role,
            user_metadata: {
                full_name: (meta.full_name === 'مستخدم جديد' && firebaseUser.displayName) ? firebaseUser.displayName : meta.full_name,
                academic_id: meta.academic_id
            },
            name: (meta.full_name === 'مستخدم جديد' && firebaseUser.displayName) ? firebaseUser.displayName : meta.full_name,
            provider: 'firebase'
        };

        saveSession(sessionUser);
        
        // === Auth Sync (Supabase) ===
        // Ensure Supabase client is authenticated with Firebase JWT before redirecting
        try {
            await window.SecureConnect.syncSupabaseAuth();
        } catch (syncError) {
            console.warn("⚠️ Supabase Auth Sync failed, but login proceeding:", syncError);
        }

        await handlePostLogin(firebaseUser.email);

    } catch (firebaseError) {
        console.warn("⚠️ Firebase Login Failed:", firebaseError.code, firebaseError.message);

        // === Supabase Auth (Fallback for legacy users or App Check failures) ===
        // If Firebase blocked us due to App Check, Supabase might still work if not tied to the same restriction.
        console.log("🔄 Attempting Supabase Fallback...");

        const supabase = await getSupabase();
        if (supabase) {
            try {
                const { data: supabaseUser, error: supabaseError } = await supabase.auth.signInWithPassword({
                    email, password
                });

                if (supabaseError) throw supabaseError;

                // Fetch metadata
                const meta = await fetchUserMetadata(email);

                const sessionUser = {
                    id: supabaseUser.user.id,
                    email: supabaseUser.user.email,
                    academic_id: meta.academic_id,
                    role: meta.role,
                    user_metadata: {
                        full_name: meta.full_name,
                        academic_id: meta.academic_id
                    },
                    name: meta.full_name,
                    provider: 'supabase'
                };

                saveSession(sessionUser);
                
                // === Auth Sync (Supabase) ===
                // Already technically logged into Supabase here, but call sync to be consistent
                try {
                    await window.SecureConnect.syncSupabaseAuth();
                } catch (syncError) {
                    console.warn("⚠️ Supabase local sync failed:", syncError);
                }

                await handlePostLogin(email);
                return;
            } catch (supabaseError) {
                console.error("❌ Supabase Login Also Failed:", supabaseError);
            }
        }

        // Both Failed
        let msg = "فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.";
        if (firebaseError.code === 'auth/invalid-email') msg = "البريد الإلكتروني غير صالح.";
        if (firebaseError.code === 'auth/user-not-found') msg = "هذا المستخدم غير موجود.";
        if (firebaseError.code === 'auth/wrong-password') msg = "كلمة المرور غير صحيحة.";
        if (firebaseError.code === 'auth/too-many-requests') msg = "تم حظر الدخول مؤقتاً بسبب تكرار المحاولة. حاول لاحقاً.";
        if (firebaseError.message.includes('Throttled')) msg = "تم حظر الجهاز أمنياً (App Check). يرجى مسح بيانات المتصفح والمحاولة.";

        throw new Error(msg);
    }
};

// Note: Full logout is defined below as the canonical version.

// --- Session Management ---
function saveSession(user) {
    const sessionData = {
        ...user,
        loginTime: Date.now() // Track session start for 24-hour expiry
    };
    localStorage.setItem('currentUser', JSON.stringify(sessionData));
    localStorage.setItem('dwd_user', JSON.stringify(sessionData));
    localStorage.setItem('isLoggedIn', 'true');
    document.cookie = "dwd_session=active; path=/; max-age=2592000; SameSite=Lax";
}

// --- Change Password ---
window.changeUserPassword = async function (oldPassword, newPassword) {
    const user = auth.currentUser || await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(u => {
            unsubscribe();
            resolve(u);
        });
    });

    if (!user || !user.email) {
        throw new Error("لا يوجد مستخدم مسجل حالياً. يرجى تحديث الصفحة.");
    }

    if (!oldPassword || oldPassword.length < 1) {
        throw new Error("الرجاء إدخال كلمة المرور الحالية.");
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, oldPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        return { success: true };
    } catch (error) {
        console.error("Error updating password:", error);
        if (error.code === 'auth/wrong-password') {
            throw new Error("كلمة المرور الحالية غير صحيحة.");
        }
        if (error.code === 'auth/requires-recent-login') {
            throw new Error("يجب إعادة تسجيل الدخول لتغيير كلمة المرور لأسباب أمنية.");
        }
        throw new Error(error.message);
    }
};

// --- Post-Login Redirect & Unban Sync ---
async function handlePostLogin(email) {
    try {
        // Sync Unbanning: Check if professor removed fraud logs
        const supabase = await getSupabase();
        if (supabase) {
            const storedUserStr = localStorage.getItem('dwd_user') || localStorage.getItem('currentUser');
            if (storedUserStr) {
                const user = JSON.parse(storedUserStr);
                const hasBan = localStorage.getItem('dwd_punitive_ban');
                const hasLock = localStorage.getItem('dwd_device_lock');

                if (hasBan || hasLock) {
                    // Check if this student still has active fraud logs
                    const { data, error } = await supabase
                        .from('fraud_logs')
                        .select('id')
                        .or(`student_id.eq.${user.id},academic_id.eq.${user.academic_id}`)
                        .limit(1);

                    // If no error, and NO logs found -> Professor deleted them! Clear local bans.
                    if (!error && (!data || data.length === 0)) {
                        console.log("✅ No active fraud logs found on server. Clearing local bans.");
                        localStorage.removeItem('dwd_punitive_ban');

                        if (hasLock && window.DeviceLock) {
                            const lockData = JSON.parse(hasLock);
                            if (lockData.studentId === user.id || lockData.studentId === user.academic_id) {
                                window.DeviceLock.clearLock();
                            }
                        } else if (hasLock) {
                            localStorage.removeItem('dwd_device_lock'); // Fallback clear
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn("⚠️ Error checking unban status:", e);
    }

    window.location.href = "home.html";
}

// --- SecureConnect API (for Attendance and other modules) ---
window.SecureConnect = {
    checkAuth: async () => {
        try {
            const storedUser = localStorage.getItem('dwd_user');
            if (storedUser) {
                return JSON.parse(storedUser);
            }
            return null;
        } catch (e) {
            console.error("Auth Check Error:", e);
            return null;
        }
    },

    getToken: async () => {
        try {
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
            const auth = getAuth();
            
            // Wait for auth state to initialize if currentUser is null
            let user = auth.currentUser;
            if (!user) {
                user = await new Promise(resolve => {
                    const unsubscribe = onAuthStateChanged(auth, (u) => {
                        unsubscribe();
                        resolve(u);
                    });
                });
            }
            
            if (user) return await user.getIdToken();
        } catch (e) { console.warn('[SecureConnect] Could not get real JWT:', e); }
        return null;
    },

    /**
     * syncSupabaseAuth - Synchronizes Firebase Token with Supabase Client
     * This is critical for RLS policies in Supabase using Firebase as Auth Provider
     */
    syncSupabaseAuth: async function() {
        try {
            const token = await this.getToken();
            if (!token) return false;

            const supabase = await getSupabase();
            if (supabase) {
                const { error } = await supabase.auth.setSession({
                    access_token: token,
                    refresh_token: token
                });

                if (error) {
                    return false;
                }
                
                return true;
            }
        } catch (e) {
            // Ignored silently
        }
        return false;
    }
};
// --- Global Logout Function ---
window.logout = async function () {
    try {
        await signOut(auth);
        const supabase = await getSupabase();
        if (supabase) await supabase.auth.signOut();
    } catch (e) { console.error("Logout error:", e); }

    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "dwd_session=; path=/; max-age=0";

    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active) {
            registration.active.postMessage({ type: 'LOGOUT' });
        }
    }

    window.location.href = '/login.html';
};

// --- UI Hydration (syncUserDisplay) ---
// Reads the ALREADY EXISTING dwd_user from localStorage and injects
// user info into standard HTML elements BEFORE any network calls.
// This is non-destructive and does NOT modify any auth logic.
window.syncUserDisplay = function () {
    try {
        const raw = localStorage.getItem('dwd_user') || localStorage.getItem('currentUser');
        if (!raw) return;
        const user = JSON.parse(raw);
        if (!user) return;

        const name = user.name || user.user_metadata?.full_name || user.email || 'مستخدم';
        const role = user.role || 'student';
        const academicId = user.academic_id || user.user_metadata?.academic_id || '';
        const dept = user.department || '';

        // Role label mapping (Arabic)
        const roleLabels = {
            doctor: 'عضو هيئة تدريس',
            admin: 'مسؤول النظام',
            student: 'طالب'
        };
        const roleLabel = roleLabels[role.toLowerCase()] || role;

        // Inject into standard named elements (if they exist on the page)
        const byId = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        byId('user-name-display', name);
        byId('user-role-badge', roleLabel);
        byId('user-dept-display', dept);
        byId('user-academic-id', academicId);

        // Also update any [data-user-name], [data-user-role] attributes for broader compatibility
        document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = name);
        document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = roleLabel);

        // Portal title: if doctor, update portal title label
        const isDoctor = role.toLowerCase() === 'doctor';
        const portalTitle = document.getElementById('portal-title');
        if (portalTitle) {
            portalTitle.textContent = isDoctor ? 'Professor Portal — ' + name : 'Student Portal — ' + name;
        }
    } catch (e) {
        console.warn('[DWD] syncUserDisplay failed:', e);
    }
};

// Auto-sync on DOMContentLoaded (best-effort, non-blocking)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.syncUserDisplay());
} else {
    window.syncUserDisplay();
}

// --- Single Sign-On (SSO) for Node.js Platform ---
window.generateSecureSSOLink = async function() {
    try {
        const allowedRedirectBase = 'https://node-backend-nu-opal.vercel.app';
        const loginMethod = localStorage.getItem("loginMethod");

        if (loginMethod === "batu") {
            const batuToken = localStorage.getItem("batuToken");
            if (!batuToken) throw new Error("No active BATU token found");
            const redirectPath = encodeURIComponent('/store/ds');
            return `${allowedRedirectBase}/sso?batu_token=${batuToken}&redirect=${redirectPath}`;
        } else {
            const idToken = await window.SecureConnect.getToken();
            if (!idToken) throw new Error("No active Firebase token found");
            const redirectPath = encodeURIComponent('/store/ds');
            return `${allowedRedirectBase}/sso?token=${idToken}&redirect=${redirectPath}`;
        }
    } catch (error) {
        console.error("SSO Error:", error);
        alert("حدث خطأ أثناء الاتصال بالمنصة الجديدة. الرجاء تسجيل الدخول مجدداً.");
        return null;
    }
};

window.goNodejsProfile = async function() {
    const ssoUrl = await window.generateSecureSSOLink();
    if (ssoUrl) {
        window.location.href = ssoUrl;
    }
};
