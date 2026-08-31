/**
 * Shared security utilities for DWD
 * Provides XSS protection helpers
 */

/**
 * Escapes HTML special characters to prevent XSS when inserting
 * user-provided or database-sourced strings into innerHTML.
 * @param {*} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Detects if the user is likely using Incognito/Private Browsing mode.
 */
async function detectIncognito() {
    return new Promise((resolve) => {
        let isIncognito = false;
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(estimate => {
                // Heuristic: Incognito mode typically severely caps storage quota (often ~120MB)
                if (estimate.quota < 200 * 1024 * 1024) {
                    isIncognito = true;
                }
                resolve(isIncognito);
            }).catch(() => resolve(false));
            return;
        }

        // Older filesystem check for older webkit
        const fs = window.RequestFileSystem || window.webkitRequestFileSystem;
        if (fs) {
            fs(window.TEMPORARY, 100, () => resolve(false), () => resolve(true));
        } else {
            resolve(false);
        }
    });
}

// Ensure global evaluation of incognito mode
window.isIncognitoMode = false;
detectIncognito().then(res => { window.isIncognitoMode = res; });

// Make available globally
window.escapeHTML = escapeHTML;
window.detectIncognito = detectIncognito;
