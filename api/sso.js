// sso.js - Secured with Hidden Form POST

import { auth } from "./firebase_config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export function sendSSOToken() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken(true);

      const allowedTarget = 'https://communication-1p3m.vercel.app/api/sso';

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = allowedTarget;

      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token';
      tokenInput.value = idToken;

      form.appendChild(tokenInput);
      document.body.appendChild(form);

      form.submit();

    } catch (error) {
      console.error("Failed to get ID Token:", error);
    }
  });
}