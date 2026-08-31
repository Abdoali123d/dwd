// ============================================================
//  DWD Smart Campus — Service Worker  v22.0.0
//
//  REAL OFFLINE MODE:
//  Every HTML page and its JS/CSS dependencies are cached
//  using their ACTUAL Vercel paths. The cacheFullSite function
//  downloads each page individually and reports its name back
//  to the client so the UI can show real progress.
// ============================================================
const CACHE_VERSION = 'v35';
const CACHE_NAME = `dwd-cache-${CACHE_VERSION}`;

// ============================================================
//  ALL PAGES & ASSETS TO CACHE
//  These are the actual URLs as served by Vercel (clean URLs).
//  Each entry has a human-readable label for the download UI.
// ============================================================
const OFFLINE_PAGES = [
    { url: '/index.html', label: 'الصفحة الرئيسية للجامعة' },
    { url: '/login.html', label: 'صفحة تسجيل الدخول' },
    { url: '/home.html', label: 'لوحة التحكم' },
    { url: '/DWD/schedule/professor', label: 'صفحة الدكتور' },
    { url: '/DWD/schedule', label: 'الجدول الدراسي' },
    { url: '/DWD/materials', label: 'المواد الدراسية' },
    { url: '/DWD/attendance', label: 'تسجيل الحضور والغياب' },
    { url: '/DWD/profile/index', label: 'الملف الشخصي' },
    { url: '/DWD/downloads/index', label: 'التكليفات والواجبات' },
    { url: '/DWD/news', label: 'آخر الأخبار' },
    { url: '/DWD/training-weeks', label: 'أسابيع التدريب' },
    { url: '/DWD/schedule/student-view', label: 'عرض الطالب للجدول' },
    { url: '/DWD/schedule/grading', label: 'التقديرات' },
    { url: '/DWD/schedule/grades-dashboard', label: 'لوحة النتائج' },
    { url: '/DWD/Ai-Nano/exams', label: 'صفحة الامتحانات' },
    { url: '/DWD/about/index', label: 'عن المنصة' },
    { url: '/DWD/Ai-Nano/index', label: 'الذكاء الاصطناعي' },
    { url: '/sso-success', label: 'تأكيد تسجيل الدخول' },
    { url: '/DWD/schedule/admin-dashboard', label: 'لوحة تحكم الأدمن' },
    { url: '/DWD/schedule/grades', label: 'الدرجات' },
];

const OFFLINE_ASSETS = [
    '/manifest.json', '/favicon.ico', '/app_icon.png',
    '/css/spa-transitions.css',
    '/css/academic-design.css',
    '/assets/css/local-fonts.css',
    '/assets/css/fontawesome-all.min.css',
    '/assets/css/sweetalert2-dark.css',
    '/assets/js/swup.js',
    '/assets/js/swup-scripts-plugin.js',
    '/assets/js/sweetalert2.js',
    '/assets/js/tailwind.js',
    '/assets/js/supabase.js',
    '/assets/js/chart.js',
    '/js/spa-navigation.js',
    '/js/supabase_client.js',
    '/js/auth-guard.js',
    '/js/secure_connect.js',
    '/js/content-protection.js',
    '/js/sound-effects.js',
    '/js/home_navigation.js',
    '/js/firebase_config.js',
    '/js/attendance.js',
    '/js/device-lock.js',
    '/js/security-utils.js',
    '/js/supabase_auth_helper.js',
    '/DWD/materials/app.js',
    '/DWD/materials/style.css',
    '/DWD/downloads/script.js',
    '/DWD/schedule/Chart.js',
    '/DWD/schedule/admin.js',
    
    // -- Webfonts (FontAwesome) --
    '/assets/webfonts/fa-solid-900.woff2',
    '/assets/webfonts/fa-solid-900.ttf',
    '/assets/webfonts/fa-regular-400.woff2',
    '/assets/webfonts/fa-regular-400.ttf',
    '/assets/webfonts/fa-brands-400.woff2',
    '/assets/webfonts/fa-brands-400.ttf',
    
    // -- Cairo & IBM Plex Arabic local fonts --
    '/assets/fonts/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscQyyS4J0.woff2',
    '/assets/fonts/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscRiyS.woff2',
    '/assets/fonts/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscSCyS4J0.woff2',
    '/assets/fonts/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6Ys43PWrfQ.woff2',
    '/assets/fonts/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6Ys93PU.woff2',
    '/assets/fonts/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6Ysw3PWrfQ.woff2',
    '/assets/fonts/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6Ysz3PWrfQ.woff2',
    '/assets/fonts/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-eCRXMR5Kw.woff2',
    '/assets/fonts/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-eCUXMQ.woff2',
    '/assets/fonts/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-eCZXMR5Kw.woff2',
    '/assets/fonts/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-eCaXMR5Kw.woff2'
];

// Minimal shell cached on install (just login + home)
const APP_SHELL_URLS = ['/index.html', '/login.html', '/home.html'];

// ============================================================
//  HELPERS
// ============================================================
function shouldBypass(url, request) {
    if (request.method !== 'GET') return true;
    if (!url.protocol.startsWith('http')) return true;
    if (url.origin !== self.location.origin) return true;
    if (url.pathname.startsWith('/api/')) return true;
    if (url.pathname.startsWith('/_vercel/')) return true;
    return false;
}

function isCacheable(response) {
    if (!response || response.type === 'error' || response.type === 'opaque' || !response.ok) return false;
    return true;
}

function isStaticAsset(pathname) {
    const ext = pathname.split('.').pop().toLowerCase();
    return ['css', 'js', 'woff2', 'woff', 'ttf', 'ico', 'png',
        'jpg', 'jpeg', 'gif', 'webp', 'svg', 'json',
        'mp3', 'wav', 'ogg'].includes(ext);
}

// Fetch with double-fetch pattern to strip redirected flag
async function cleanFetch(urlString) {
    let response = await fetch(urlString, { redirect: 'follow', credentials: 'same-origin' });
    if (response.redirected) {
        response = await fetch(response.url, { redirect: 'error', credentials: 'same-origin' });
    }
    return response;
}

// ============================================================
//  INSTALL & ACTIVATE
// ============================================================
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const path of APP_SHELL_URLS) {
                try {
                    const res = await cleanFetch(path);
                    if (isCacheable(res)) await cache.put(path, res.clone());
                } catch (e) { }
            }
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// ============================================================
//  FETCH
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (url.origin.startsWith('chrome-extension') || url.origin.startsWith('moz-extension')) return;
    if (shouldBypass(url, request)) return;

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(request.url, url.pathname));
        return;
    }
    if (isStaticAsset(url.pathname)) {
        event.respondWith(handleStaticAsset(request, url));
        return;
    }
    event.respondWith(handleGeneric(request));
});

// ============================================================
//  NAVIGATION HANDLER
// ============================================================

// Vercel rewrite aliases → actual cache paths
const REWRITE_MAP = {
    '/': '/index.html',
    '/login': '/login.html',
    '/home': '/home.html',
    '/professor': '/DWD/schedule/professor',
    '/attendance': '/DWD/attendance',
    '/profile': '/DWD/profile/index',
    '/downloads': '/DWD/downloads/index',
    '/news': '/DWD/news',
    '/training': '/DWD/training-weeks',
    '/privacy-policy': '/DWD/attendance/privacy-policy',
};

// Reverse map: actual cache path → alias (for cacheFullSite to also store under alias)
const REVERSE_REWRITE = {};
for (const [alias, real] of Object.entries(REWRITE_MAP)) {
    REVERSE_REWRITE[real] = alias;
}

async function handleNavigation(urlString, pathname) {
    // Normalize: remove trailing slash for consistency (except root)
    const norm = (pathname !== '/' && pathname.endsWith('/')) ? pathname.slice(0, -1) : pathname;

    try {
        const response = await cleanFetch(urlString);
        if (isCacheable(response)) {
            const cache = await caches.open(CACHE_NAME);
            // Store under EVERY possible key the browser might request
            const keysToStore = new Set([
                norm,
                norm + '/',
                norm.replace(/\.html$/, ''),
                pathname,
            ]);
            // Also store under rewrite-mapped path
            const realPath = REWRITE_MAP[norm] || REWRITE_MAP[pathname];
            if (realPath) {
                keysToStore.add(realPath);
                keysToStore.add(realPath + '/');
            }
            for (const k of keysToStore) {
                if (k) cache.put(k, response.clone());
            }
        }
        return response;
    } catch {
        // OFFLINE — try multiple lookup strategies
        const lookups = [
            norm,
            norm + '/',
            pathname,
            norm.replace(/\.html$/, ''),
            REWRITE_MAP[norm],
            REWRITE_MAP[pathname],
            norm + '/index',
            norm + '/index.html',
        ].filter(Boolean);

        for (const key of lookups) {
            const hit = await caches.match(key);
            if (hit) return hit;
        }

        return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
}

// ============================================================
//  ASSET HANDLERS
// ============================================================
async function handleStaticAsset(request, url) {
    // NETWORK-FIRST: Always try fresh version, fallback to cache offline
    try {
        const response = await fetch(request);
        if (isCacheable(response)) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Offline — use cached version
        const cached = await caches.match(request);
        if (cached) return cached;
        const ext = url.pathname.split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
            return new Response(
                new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 255, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 0, 59]),
                { status: 200, headers: { 'Content-Type': 'image/gif' } }
            );
        }
        return new Response('', { status: 404 });
    }
}

async function handleGeneric(request) {
    try {
        const response = await fetch(request);
        if (isCacheable(response)) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 503 });
    }
}

// ============================================================
//  MESSAGE — REAL FULL SITE DOWNLOAD
// ============================================================
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'CACHE_FULL_SITE') event.waitUntil(cacheFullSite(event));
    if (event.data?.type === 'LOGOUT') {
        event.waitUntil(
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        );
    }
});

async function cacheFullSite(event) {
    const cache = await caches.open(CACHE_NAME);
    const port = event.ports?.[0];

    // Combine pages + assets into one list
    const allItems = [
        ...OFFLINE_PAGES.map(p => ({ url: p.url, label: p.label, type: 'page' })),
        ...OFFLINE_ASSETS.map(a => ({ url: a, label: a.split('/').pop(), type: 'asset' })),
    ];

    const total = allItems.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i++) {
        const item = allItems[i];

        // Send progress — only show page labels to user (null for assets)
        if (port) {
            port.postMessage({
                type: 'CACHE_PROGRESS',
                label: item.type === 'page' ? item.label : null,
                itemType: item.type,
                current: i + 1,
                total: total,
                percent: Math.round(((i) / total) * 100),
            });
        }

        try {
            const response = await cleanFetch(item.url);
            if (isCacheable(response)) {
                // Store under MULTIPLE keys for maximum offline compatibility
                const keys = new Set([item.url, item.url + '/']);
                // If the response URL differs (Vercel redirect), store under that too
                const respPath = new URL(response.url).pathname;
                if (respPath !== item.url) {
                    keys.add(respPath);
                    keys.add(respPath.replace(/\/$/, ''));
                }
                // Also store under the rewrite ALIAS (e.g. /professor for /DWD/schedule/professor)
                const alias = REVERSE_REWRITE[item.url];
                if (alias) {
                    keys.add(alias);
                    keys.add(alias + '/');
                }
                for (const k of keys) {
                    await cache.put(k, response.clone());
                }
                successCount++;
            } else {
                failCount++;
                console.warn(`[SW] Cache failed (${response.status}): ${item.url}`);
                if (port) {
                    port.postMessage({
                        type: 'CACHE_FILE_ERROR',
                        filePath: item.url,
                        label: item.type === 'page' ? item.label : item.url,
                    });
                }
            }
        } catch (err) {
            failCount++;
            console.warn(`[SW] Fetch error: ${item.url}`, err);
            if (port) {
                port.postMessage({
                    type: 'CACHE_FILE_ERROR',
                    filePath: item.url,
                    label: item.type === 'page' ? item.label : item.url,
                });
            }
        }
    }

    if (port) {
        port.postMessage({
            type: successCount > 0 ? 'CACHE_FULL_SITE_COMPLETE' : 'CACHE_FULL_SITE_ERROR',
            successCount,
            failCount,
            total,
        });
    }
}

// ============================================================
//  OFFLINE PAGE
// ============================================================
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#1a1a2e">
    <title>غير متصل | DWD</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: radial-gradient(ellipse at top, #0d1b3e 0%, #050810 70%);
            color: #fff; font-family: 'Cairo', system-ui, sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100dvh; padding: 20px;
        }
        .card {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(56,189,248,0.25);
            border-radius: 28px; padding: 48px 36px;
            max-width: 440px; width: 100%; text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            backdrop-filter: blur(16px);
        }
        .icon { font-size: 3.5rem; margin-bottom: 24px; animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.1); } }
        h1 { font-size: 1.6rem; font-weight: 800; margin-bottom: 14px;
            background: linear-gradient(135deg, #38bdf8, #818cf8);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p { color: rgba(255,255,255,0.6); font-size: 0.95rem; line-height: 1.75; margin-bottom: 6px; }
        .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 28px; }
        .btn { padding: 13px 26px; border: none; border-radius: 50px; cursor: pointer;
               font-weight: 700; font-size: 0.95rem; font-family: inherit; transition: transform 0.2s; }
        .btn:hover { transform: translateY(-2px); }
        .btn-primary { background: linear-gradient(135deg, #00d2ff, #0078ff); color: #fff; }
        .btn-ghost { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.15); }
        .version { margin-top: 20px; font-size: 0.75rem; color: rgba(255,255,255,0.25); }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">⚡</div>
        <h1>أنت غير متصل بالإنترنت</h1>
        <p>هذه الصفحة لم يتم تحميلها مسبقاً للتصفح أوفلاين.</p>
        <p>عُد للصفحة الرئيسية أو استخدم زر "التصفح أوفلاين" لتحميل جميع الصفحات.</p>
        <div class="btns">
            <button class="btn btn-primary" onclick="window.history.back()">← العودة</button>
            <button class="btn btn-ghost" onclick="window.location.reload()">↻ إعادة المحاولة</button>
        </div>
        <p class="version">DWD Smart Campus • SW ${CACHE_VERSION}</p>
    </div>
</body>
</html>`;
