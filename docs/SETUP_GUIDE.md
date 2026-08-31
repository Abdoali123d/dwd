# 🚀 DWD Smart Campus - Complete Setup Guide

## Prerequisites
- Node.js 18+ installed
- Vercel CLI installed: `npm i -g vercel`
- Vercel account

---

## Step 1: Environment Variables

### Option A: Interactive Setup (Recommended)
```bash
node scripts/vercel-setup.js
```

This will:
- Create `.env` file locally
- Generate secure `BATU_SSO_SECRET`
- Prompt for missing values

### Option B: Manual Setup

Create `.env` file in project root:
```env
VITE_FIREBASE_API_KEY=AIzaSyBi81M4Q4Mc0FyNWh1NZGz43mY778itznw
VITE_FIREBASE_AUTH_DOMAIN=dwd-it2-92aa4.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dwd-it2-92aa4
VITE_FIREBASE_STORAGE_BUCKET=dwd-it2-92aa4.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=939613662564
VITE_FIREBASE_APP_ID=1:939613662564:web:4b6142cd66b17f28d3de71
VITE_FIREBASE_MEASUREMENT_ID=G-YSH146MSCB
VITE_SUPABASE_URL=https://suziirfasrahhaqffymz.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
BATU_SSO_SECRET=generate_a_secure_32_char_secret
BATU_ALLOWED_ORIGIN=https://dwd-edu.vercel.app
GEMINI_API_KEY=your_gemini_api_key
```

### Option C: Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Settings → Environment Variables
4. Add each variable from the table above

---

## Step 2: Deploy to Vercel

### First Time Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Subsequent Deployments
```bash
vercel --prod
```

---

## Step 3: Security Hardening

### A. Generate SRI Hashes
```bash
# Generate hashes and update HTML files
npm run generate:sri:update
```

This will:
- Fetch CDN scripts
- Generate SHA-384 hashes
- Update `index.html` and `login.html` with `integrity` attributes

### B. Set Up Upstash Redis (Rate Limiting)

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Add to Vercel environment variables:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token
   ```
5. Redeploy

### C. Firebase Console Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Authentication → Settings → Authorized domains
4. Add: `dwd-edu.vercel.app`
5. Remove any localhost/127.0.0.1 if not needed

### D. Supabase Security

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Your project → Authentication → URL Configuration
3. Add `https://dwd-edu.vercel.app` to Site URL
4. Run `sql/supabase_security.sql` in SQL Editor

---

## Step 4: Verify Deployment

### Checklist
- [ ] All pages load correctly
- [ ] Login works (Firebase + BATU)
- [ ] Dashboard loads with data
- [ ] No console errors
- [ ] Service Worker caches correctly
- [ ] Offline mode works for cached pages

### Test Security Headers
```bash
curl -I https://dwd-edu.vercel.app
```

Look for:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: ...
```

---

## Step 5: Git Setup

### Ensure .env is ignored
```bash
# Verify .env is in .gitignore
cat .gitignore | grep "^\.env$"

# If not, add it
echo ".env" >> .gitignore
```

### Commit security fixes
```bash
git add .
git commit -m "security: remove hardcoded secrets, add XSS protection, fix CORS"
git push origin main
```

---

## Troubleshooting

### Issue: "Firebase configuration is missing"
**Solution:** Make sure all `VITE_FIREBASE_*` variables are set in Vercel.

### Issue: "Supabase client not initializing"
**Solution:** Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct.

### Issue: "BATU login failing"
**Solution:** 
1. Verify `BATU_SSO_SECRET` is set (32+ chars)
2. Check `BATU_ALLOWED_ORIGIN` matches your domain
3. Ensure CSRF token is being sent from frontend

### Issue: Rate limiting not working across instances
**Solution:** Set up Upstash Redis as described in Step 3B.

---

## Security Best Practices

1. **Never commit `.env`** to Git
2. **Rotate secrets regularly** (BATU_SSO_SECRET, API keys)
3. **Monitor Vercel logs** for suspicious activity
4. **Enable Vercel Firewall** for additional protection
5. **Use preview deployments** for testing before production

---

## Support

For issues:
1. Check Vercel logs: `vercel logs`
2. Check browser console for client-side errors
3. Verify environment variables in Vercel Dashboard
