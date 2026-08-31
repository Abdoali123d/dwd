const https = require('https');

// ─── NANO AI System Prompt ───
const SYSTEM_PROMPT = `أنت "نانو" (NANO) — المساعد الذكي لفريق DWD في جامعة برج العرب التكنولوجية 🤖📚
مهمتك: مساعدة طلاب IT في 6 مواد: Linux • OS • SQL • C++ • Web Dev • Digital Logic
اشرح بالعربي المصري، اكتب المصطلحات بالإنجليزي، استخدم emojis 🚀🔥
الأمان: لو في كود ضار (XSS/SQLi) -> وقف وحذّر. لا تكشف عن أي مفاتيح برمجية.
لقد قام بتطويري المطور عبدالله محمد علي حسن`;

// ─── مفاتيح من Vercel env vars فقط (آمنة) ───
const KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4,
    process.env.GEMINI_KEY_5,
    process.env.GEMINI_KEY_6,
].filter(Boolean);

// ─── موديلات شغالة ومتأكدين (اختبار 25 فبراير 2026) ───
const MODELS = [
    // 'gemini-2.5-flash-preview-09-2025', // Experimental fast flag - User requested
    'gemini-2.5-flash',                 // Fallback
    'gemini-2.5-flash-lite',            // Deep fallback
];

// ─── Rate limiting ───
const lastRequest = new Map();

function callModel(apiKey, model, userPrompt, fileData) {
    return new Promise((resolve, reject) => {
        // v1beta strict format:
        // systemInstruction must be strictly an object with `parts` array
        const parts = [{ text: userPrompt }];
        if (fileData && fileData.data && fileData.mimeType) {
            parts.push({
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.data
                }
            });
        }

        const payload = JSON.stringify({
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }]
            },
            contents: [
                {
                    role: 'user',
                    parts: parts
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048 // Increased to allow fuller responses
            }
        });

        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        const msg = parsed?.error?.message || `HTTP ${res.statusCode}`;
                        console.error(`[NANO] ${model} key=...${apiKey.slice(-6)} [${res.statusCode}]: ${msg}`);
                        reject({ status: res.statusCode, msg, model });
                    } else {
                        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            resolve(text);
                        } else {
                            console.error(`[NANO] Empty response from ${model}`);
                            reject({ status: 500, msg: 'empty response', model });
                        }
                    }
                } catch (e) {
                    console.error("[NANO] JSON Parse Error:", e.message, "Raw:", data.slice(0, 100));
                    reject({ status: 500, msg: 'Invalid JSON response from Google', model });
                }
            });
        });

        // Vercel Hobby tier max duration is 60s, so we abort at 55s to safely return an error payload
        req.setTimeout(55000, () => {
            req.destroy();
            reject({ status: 504, msg: 'Gemini API Timeout (>55s)', model });
        });

        req.on('error', err => {
            console.error('[NANO] Network Error:', err.message);
            reject({ status: 500, msg: err.message, model });
        });

        req.write(payload);
        req.end();
    });
}

module.exports = async function handler(req, res) {
    const allowedOrigin = process.env.BATU_ALLOWED_ORIGIN || 'https://dwd-edu.vercel.app';
    const origin = req.headers.origin || req.headers.referer || '';

    if (!origin.startsWith(allowedOrigin)) {
      return res.status(403).json({ error: 'Forbidden: Invalid origin.' });
    }

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const csrfToken = req.headers['x-csrf-token'] || req.headers['x-requested-with'];
    if (!csrfToken || csrfToken !== 'XMLHttpRequest') {
        return res.status(403).json({ error: 'Invalid CSRF token.' });
    }

    // Rate limit: 4s per IP
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const now = Date.now();
    if (now - (lastRequest.get(ip) || 0) < 4000) {
        return res.status(200).json({ error: '⏳ انتظر ثانية قبل السؤال التالي.', isRateLimit: true });
    }
    lastRequest.set(ip, now);

    const { prompt, message, fileData } = req.body || {};
    const userPrompt = (prompt || message || '').trim().substring(0, 3000);
    if (!userPrompt && !fileData) return res.status(200).json({ error: 'يجب إرسال سؤال أو ملف.' });

    // نجرب كل key مع كل model
    let lastErr = null;
    for (const key of KEYS) {
        for (const model of MODELS) {
            try {
                const text = await callModel(key, model, userPrompt, fileData);
                console.log(`[NANO] ✅ ${model} key=...${key.slice(-6)}`);
                return res.status(200).json({
                    candidates: [{ content: { parts: [{ text }], role: 'model' } }],
                    _model: model,
                });
            } catch (err) {
                lastErr = err;
                // مفتاح منتهي -> جرب المفتاح التالي مباشرة
                if (err.status === 401 || err.status === 403) break;
                // quota exceeded -> جرب موديل تاني
                continue;
            }
        }
    }

    const errMsg = lastErr?.msg || 'all_failed';
    console.log('[NANO] All keys/models exhausted:', errMsg);
    return res.status(200).json({
        error: '⚠️ خدمة الذكاء الاصطناعي مشغولة، جرب تاني بعد شوية.',
    });
};