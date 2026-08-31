// firebase_config.js
// ملف إعدادات Firebase

// استخدام روابط CDN المتوافقة مع المتصفح مباشرة (ES Modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const getConfig = () => {
    if (typeof window !== 'undefined' && window.DWD_FIREBASE_CONFIG) {
        return window.DWD_FIREBASE_CONFIG;
    }
    if (typeof process !== 'undefined' && process.env && process.env.VITE_FIREBASE_API_KEY) {
        return {
            apiKey: process.env.VITE_FIREBASE_API_KEY,
            authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.VITE_FIREBASE_APP_ID,
            measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
        };
    }
    console.warn('Firebase configuration not found. Set VITE_FIREBASE_API_KEY and related env vars, or define window.DWD_FIREBASE_CONFIG.');
    return null;
};

const firebaseConfig = getConfig();

if (!firebaseConfig) {
    console.error('Firebase configuration is missing. The app cannot initialize Firebase without valid configuration.');
}

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = firebaseConfig ? getAuth(app) : null;

export { app, auth };
