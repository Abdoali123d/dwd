import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// تهيئة Firebase Admin
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // استبدال أسطر الهروب إذا وجدت
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    } catch (e) {
        console.error("Firebase Admin initialization failed. Check ENV variables.", e);
    }
}

// تهيئة Supabase بصلاحيات الـ Service Role لتخطي الـ RLS 
// تأكد من إضافة SUPABASE_SERVICE_ROLE_KEY في إعدادات Vercel
const supabaseAdminUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SB_URL;
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SB_KEY;

const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey);

export default async function handler(req, res) {
    const allowedOrigin = process.env.BATU_ALLOWED_ORIGIN || 'https://dwd-edu.vercel.app';
    const origin = req.headers.origin || req.headers.referer || '';

    if (!origin.startsWith(allowedOrigin)) {
      return res.status(403).json({ error: 'Forbidden: Invalid origin.' });
    }

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const csrfToken = req.headers['x-csrf-token'] || req.headers['x-requested-with'];
    if (!csrfToken || csrfToken !== 'XMLHttpRequest') {
        return res.status(403).json({ error: 'Invalid CSRF token.' });
    }

    try {
        const { users, adminToken } = req.body;

        // ══════════════════════════════════════════════════════════
        // SECURITY GATE — STRICT ADMIN-ONLY RBAC
        // Step 1: Token must exist.
        // Step 2: Token must be a valid Firebase ID token.
        // Step 3: The decoded UID MUST map to a user row in Supabase
        //         where role = 'admin'. Doctors and students are
        //         rejected with 403 even if they have a valid token.
        // NEVER trust the client-submitted role claim.
        // ══════════════════════════════════════════════════════════
        if (!adminToken) {
            return res.status(401).json({ error: 'Unauthorized: Admin token required.' });
        }

        let callerUid;
        try {
            const decoded = await admin.auth().verifyIdToken(adminToken);
            callerUid = decoded.uid;
            if (!callerUid) throw new Error('Token missing uid claim.');
        } catch (tokenError) {
            return res.status(403).json({ error: 'Forbidden: Invalid or expired token. ' + tokenError.message });
        }

        // ── Database Role Check (source of truth — never trust client) ──
        const { data: callerProfile, error: lookupError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('uid', callerUid)
            .single();

        if (lookupError || !callerProfile) {
            return res.status(403).json({ error: 'Forbidden: Unable to verify caller role in database.' });
        }

        const callerRole = (callerProfile.role || '').toLowerCase();
        if (callerRole !== 'admin') {
            // Log the attempt for security audit
            console.warn(`[SECURITY] Forbidden bulk-import attempt by uid=${callerUid} role=${callerRole}`);
            return res.status(403).json({
                error: `Forbidden: Role '${callerRole}' is not authorized. Only 'admin' can import users.`
            });
        }

        if (!users || !Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ error: 'Invalid payload. Expected a non-empty array of users.' });
        }

        // Guard: max batch size to prevent abuse
        if (users.length > 500) {
            return res.status(400).json({ error: 'Batch too large. Maximum 500 users per request.' });
        }


        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const user of users) {
            try {
                // 1. إنشاء المستخدم في Firebase
                const userRecord = await admin.auth().createUser({
                    email: user.email,
                    password: user.password,
                    displayName: user.name,
                });

                // 2. إدخال البيانات في Supabase
                // No plaintext password stored in DB; password is only used for Firebase Auth creation
                const { error: sbError } = await supabaseAdmin.from('users').upsert([{
                    uid: userRecord.uid,
                    email: user.email,
                    name: user.name,
                    role: user.role || (user.email.includes('doctor') ? 'Doctor' : 'Student'),
                    academic_id: user.academic_id || (user.email.match(/\d+/) ? user.email.match(/\d+/)[0] : 'N/A')
                }], { onConflict: 'email' });

                if (sbError) {
                    // إذا فشلت سوبابيز سنحذف حساب فيرايبز للتناسق (Rollback)
                    await admin.auth().deleteUser(userRecord.uid);
                    throw new Error("Supabase insert failed: " + sbError.message);
                }

                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push({ email: user.email, error: err.message });
            }
        }

        res.status(200).json(results);

    } catch (error) {
        console.error("Bulk import critical error:", error);
        res.status(500).json({ error: error.message });
    }
}
