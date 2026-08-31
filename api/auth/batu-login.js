module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.BATU_ALLOWED_ORIGIN || 'https://dwd-edu.vercel.app';
  const origin = req.headers.origin || req.headers.referer || '';

  if (!origin.startsWith(allowedOrigin)) {
    return res.status(403).json({ error: 'Forbidden: Invalid origin.' });
  }

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const csrfToken = req.headers['x-csrf-token'] || req.headers['x-requested-with'];
  if (!csrfToken || csrfToken !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' });
  }

  const loginUrl = 'https://batechu.com/login';
  const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

  // Rate limiting: prefer Upstash Redis if configured, otherwise fallback to in-memory
  const useUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  let rateLimited = false;

  if (useUpstash) {
    try {
      const { Ratelimit } = require('@upstash/ratelimit');
      const { Redis } = require('@upstash/redis');
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '5 m'),
        prefix: 'ratelimit:batu',
      });
      const { success } = await ratelimit.limit(clientIp);
      if (!success) {
        rateLimited = true;
      }
    } catch (e) {
      console.warn('Upstash rate limit failed, falling back to in-memory:', e.message);
    }
  }

  if (!useUpstash || rateLimited) {
    const ipStore = global.__batuIpStore || (global.__batuIpStore = new Map());
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    const maxAttempts = 5;
    const record = ipStore.get(clientIp) || { count: 0, windowStart: now };

    if (now - record.windowStart > windowMs) {
      record.count = 0;
      record.windowStart = now;
    }
    record.count += 1;
    ipStore.set(clientIp, record);

    if (record.count > maxAttempts) {
      const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${retryAfter}s.`, retryAfter });
    }

    if (ipStore.size > 10000) {
      const cutoff = now - windowMs;
      for (const [key, val] of ipStore) {
        if (val.windowStart < cutoff) ipStore.delete(key);
      }
    }
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  };

  try {
    console.log(`[BATU-Auth] Starting Native Fetch authentication for: ${email}`);

    const resGet = await fetch(loginUrl, { headers });
    const textGet = await resGet.text();
    const tokenMatch = textGet.match(/<meta name="csrf-token" content="(.*?)"/);
    const csrfToken = tokenMatch ? tokenMatch[1] : null;

    if (!csrfToken) {
      console.error('[BATU-Auth] Failed to find CSRF token');
      return res.status(500).json({ error: 'فشل في الاتصال بخوادم الجامعة (CSRF Token missing)' });
    }

    let cookieString = '';
    const getSetCookies = resGet.headers.getSetCookie();
    if (getSetCookies && getSetCookies.length > 0) {
      cookieString = getSetCookies.map(c => c.split(';')[0]).join('; ');
    }

    const loginData = new URLSearchParams();
    loginData.append('_token', csrfToken);
    loginData.append('email', email);
    loginData.append('password', password);

    const resPost = await fetch(loginUrl, {
      method: 'POST',
      body: loginData.toString(),
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': loginUrl,
        'Origin': 'https://batechu.com',
        'Cookie': cookieString
      },
      redirect: 'manual'
    });

    const location = resPost.headers.get('location');

    if (!location || location.includes('login') || resPost.status !== 302) {
      console.log(`[BATU-Auth] Authentication failed for: ${email} - Invalid credentials`);
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الجامعي وكلمة المرور.' });
    }

    const postSetCookies = resPost.headers.getSetCookie();
    if (postSetCookies && postSetCookies.length > 0) {
      cookieString = postSetCookies.map(c => c.split(';')[0]).join('; ');
    }

    const profileRes = await fetch('https://batechu.com/lms/profile/students', {
      headers: {
        ...headers,
        'Cookie': cookieString
      }
    });

    const profileText = await profileRes.text();
    let studentName = 'طالب DWD';

    const match = profileText.match(/data-page="({.*?})"/);
    if(match) {
      try {
        const pageDataRaw = match[1].replace(/&quot;/g, '"');
        const pageData = JSON.parse(pageDataRaw);
        if (pageData && pageData.props && pageData.props.auth && pageData.props.auth.user) {
          const fetchedName = pageData.props.auth.user.name;
          if (fetchedName) studentName = fetchedName;
        }
      } catch(e) {
        console.error('[BATU-Auth] Error parsing Inertia data:', e.message);
      }
    } else {
      const nameMatch = profileText.match(/<h4 class="mb-0[^>]*>(.*?)<\/h4>/);
      if (nameMatch && nameMatch[1]) {
        studentName = nameMatch[1].trim();
      }
    }

    studentName = studentName.replace(/[\t\n\r]/g, '').trim();
    console.log(`[BATU-Auth] Extracted student name: ${studentName}`);

    const crypto = require('crypto');
    const secret = process.env.BATU_SSO_SECRET;
    if (!secret || secret.length < 32) {
      console.error('[BATU-Auth] BATU_SSO_SECRET is not set or too weak');
      return res.status(500).json({ error: 'Server misconfiguration.' });
    }
    const payload = Buffer.from(JSON.stringify({
      email: email,
      name: studentName,
      exp: Date.now() + (24 * 60 * 60 * 1000)
    })).toString('base64');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const batuToken = `${payload}.${signature}`;

    return res.status(200).json({
      success: true,
      user: {
        email: email,
        name: studentName,
        isBatuVerified: true
      },
      batuToken: batuToken
    });

  } catch (error) {
    console.error('[BATU-Auth] Internal Error:', error.message);

    return res.status(500).json({
      error: 'حدث خطأ أثناء محاولة الاتصال بخوادم الجامعة. يرجى المحاولة لاحقاً.'
    });
  }
};
