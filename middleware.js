/**
 * middleware.js — Vercel Edge Middleware
 * DWD Smart Campus — BATU University
 *
 * Real Edge-level protection that runs BEFORE any page or API handler:
 *  1. IP-based sliding-window rate limiter (in Edge memory — per isolate)
 *  2. Bot/scraper detection via User-Agent heuristics
 *  3. API endpoints get a tighter separate limit
 *  4. Blocked IPs are told to wait via Retry-After header
 *
 * NOTE: Edge middleware uses the Web API (no Node.js built-ins).
 */

export const config = {
    // Run on every request (pages + API).
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|css|map)).*)'],
};

// ─── In-memory store (per Edge isolate, resets on cold start) ───
// Map<ip, { count: number, windowStart: number }>
const ipStore = new Map();

// ─── Configuration ───
const WINDOW_MS      = 60_000;  // 1-minute window
const GLOBAL_LIMIT   = 120;     // General pages: 120 req / min per IP
const API_LIMIT      = 30;      // /api/* endpoints: 30 req / min per IP

// Suspicious UAs that must be blocked
const BOT_UA_PATTERNS = [
    'scrapy', 'wget', 'libwww', 'python-requests', 'go-http-client',
    'masscan', 'nikto', 'nmap', 'sqlmap', 'dirbuster', 'zgrab',
    'nuclei', 'curl/7',     // curl with version suffix (automated)
];

/**
 * getClientIp — reads the real IP from Vercel injected header.
 */
function getClientIp(request) {
    return (
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        '0.0.0.0'
    );
}

/**
 * checkRateLimit — sliding-window counter per IP.
 * Returns { limited: boolean, remaining: number, retryAfter: number }
 */
function checkRateLimit(ip, limit) {
    const now    = Date.now();
    const record = ipStore.get(ip) || { count: 0, windowStart: now };

    // Reset window if expired
    if (now - record.windowStart > WINDOW_MS) {
        record.count       = 0;
        record.windowStart = now;
    }

    record.count += 1;
    ipStore.set(ip, record);

    const remaining  = Math.max(0, limit - record.count);
    const retryAfter = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);

    // Prune store if it grows too large (prevent memory leak in long-lived isolates)
    if (ipStore.size > 10_000) {
        const cutoff = now - WINDOW_MS;
        for (const [key, val] of ipStore) {
            if (val.windowStart < cutoff) ipStore.delete(key);
        }
    }

    return { limited: record.count > limit, remaining, retryAfter };
}

/**
 * isSuspiciousBot — heuristic UA check.
 */
function isSuspiciousBot(request) {
    const ua = (request.headers.get('user-agent') || '').toLowerCase();
    if (!ua) return true; // No UA → treat as bot
    return BOT_UA_PATTERNS.some(pattern => ua.includes(pattern));
}

export default function middleware(request) {
    const { pathname } = new URL(request.url);
    const ip           = getClientIp(request);

    // ── Bot Protection ──
    if (isSuspiciousBot(request)) {
        return new Response('403 Forbidden — Automated access not allowed.', {
            status: 403,
            headers: { 'Content-Type': 'text/plain' },
        });
    }

    // ── Edge-Level Auth Guard ──
    // Protect specific routes at the edge.
    // Note: Client-side cookies alone are not tamper-proof.
    // This is a first layer; application logic MUST re-verify auth server-side.
    const protectedRoutes = [
        '/home.html',
        '/home',
        '/profile.html',
        '/profile',
        '/DWD/schedule/student-view.html',
        '/DWD/schedule/student-view',
        '/DWD/schedule/index.html',
        '/DWD/schedule/index',
        '/DWD/materials/index.html',
        '/DWD/materials/index',
        '/professor.html',
        '/professor',
        '/DWD/schedule/professor.html',
        '/DWD/schedule/professor',
        '/DWD/schedule/admin-dashboard.html',
        '/DWD/schedule/admin-dashboard',
        '/DWD/schedule/grading.html',
        '/DWD/schedule/grading',
        '/DWD/schedule/grades-dashboard.html',
        '/DWD/schedule/grades-dashboard',
        '/DWD/downloads/index.html',
        '/DWD/downloads/index',
        '/DWD/attendance/index.html',
        '/DWD/attendance/index',
        '/DWD/news/index.html',
        '/DWD/news/index',
        '/DWD/training-weeks/index.html',
        '/DWD/training-weeks/index',
        '/DWD/Ai-Nano/exams/index.html',
        '/DWD/Ai-Nano/exams/index',
        '/DWD/about/index.html',
        '/DWD/about/index'
    ];
    const isProtected = protectedRoutes.some(route => pathname.toLowerCase() === route.toLowerCase());

    if (isProtected) {
        const cookies = request.headers.get('cookie') || '';
        if (!cookies.includes('dwd_session=')) {
            const loginUrl = new URL('/login.html', request.url);
            return Response.redirect(loginUrl, 302);
        }
    }

    // ── Rate Limiting ──
    const isApiRoute = pathname.startsWith('/api/');
    const limit      = isApiRoute ? API_LIMIT : GLOBAL_LIMIT;
    const { limited, remaining, retryAfter } = checkRateLimit(ip, limit);

    if (limited) {
        return new Response(
            JSON.stringify({ error: 'Too Many Requests', retryAfter }),
            {
                status: 429,
                headers: {
                    'Content-Type':     'application/json',
                    'Retry-After':      String(retryAfter),
                    'X-RateLimit-Remaining': '0',
                },
            }
        );
    }

    // ── Pass through (add remaining count header for debugging) ──
    // NextResponse.next() equiv for plain Edge middleware
    const response = Response.next ? Response.next() : new Response(null, { status: 200 });
    // In Vercel Edge we just return undefined to pass through — next() is global
    return undefined; // pass through
}
