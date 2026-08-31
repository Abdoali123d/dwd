/**
 * Auth Guard - Optimistic Authentication v2.0
 * DWD Smart Campus
 * 
 * Strategy: Allow access immediately if localStorage has a valid session.
 * Verify token in background — redirect only if verification fails.
 * This eliminates the login loop and 10-second latency.
 */
(function () {
    'use strict';

    // --- 1. Quick Local Check (Instant, no network) ---
    const rawUser = localStorage.getItem('currentUser');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    let hasLocalSession = false;
    if (rawUser && rawUser !== 'null' && rawUser !== '{}') {
        try {
            const parsed = JSON.parse(rawUser);
            // Must have at least an id or email to be considered valid
            const hasIdentity = !!(parsed && (parsed.id || parsed.email || parsed.uid));

            // --- 24-Hour Session Expiry Check ---
            const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
            const loginTime = parsed?.loginTime || 0;
            const sessionAge = Date.now() - loginTime;
            const isSessionExpired = loginTime > 0 && sessionAge > SESSION_MAX_AGE_MS;

            if (isSessionExpired) {
                // Session has expired — clear all auth data silently
                localStorage.removeItem('currentUser');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('dwd_user');
                localStorage.removeItem('dwd_user_meta_cache');
                hasLocalSession = false;
            } else {
                hasLocalSession = hasIdentity;
            }
        } catch (e) {
            // Corrupted JSON — clear it
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isLoggedIn');
        }
    }

    // Also accept if isLoggedIn flag is set (even if user object is minimal)
    hasLocalSession = hasLocalSession || isLoggedIn;

    // --- 2. Determine if current page is public ---
    const path = window.location.pathname.toLowerCase();
    const isPublic =
        path.endsWith('index.html') && !path.includes('/dwd/') ||
        path === '/' ||
        path === '/dwd-it2/' ||
        path === '/dwd-it2' ||
        path.endsWith('/dwd-it2/index.html');

    // --- 3. Redirect Logic ---
    if (!hasLocalSession && !isPublic) {
        // Calculate correct redirect path based on depth
        // e.g., /DWD/schedule/professor.html → ../../index.html
        // e.g., /DWD/news/index.html → ../../index.html
        const segments = window.location.pathname.split('/').filter(Boolean);
        const fileName = segments.pop(); // Remove current file
        let loginUrl;

        // If on Vercel (dwd-edu.vercel.app), redirect to root
        if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('netlify.app')) {
            loginUrl = window.location.origin + '/index.html';
        } else {
            // Local dev: calculate relative path
            // Count how many directories deep we are from root
            const depth = segments.length;
            const prefix = depth > 0 ? '../'.repeat(depth) : './';
            loginUrl = prefix + 'index.html';
        }

        window.location.replace(loginUrl);
        return; // Stop script execution
    }

    // --- 4. Background Token Verification (Non-blocking) ---
    if (hasLocalSession && !isPublic) {
        // Schedule a lightweight background check after page has loaded
        window.addEventListener('load', function () {
            setTimeout(function () {
                try {
                    // Re-verify the session is still valid
                    const freshUser = localStorage.getItem('currentUser');
                    if (!freshUser || freshUser === 'null' || freshUser === '{}') {
                        // Session was cleared during page load (e.g., by logout)
                        return;
                    }

                    // If Firebase/SecureConnect is available, do a real check
                    if (window.SecureConnect && typeof window.SecureConnect.checkAuth === 'function') {
                        window.SecureConnect.checkAuth().then(function (user) {
                            if (!user) {
                                // Token expired or invalid — silent redirect
                                localStorage.removeItem('currentUser');
                                localStorage.removeItem('isLoggedIn');
                                window.location.replace(window.location.origin + '/index.html');
                            }
                        }).catch(function () {
                            // Network error — don't redirect, user might be offline
                        });
                    }
                } catch (e) {
                    // Silently fail — don't break the page
                }
            }, 3000); // Wait 3s after load to avoid competing with page init
        });
    }
})();
