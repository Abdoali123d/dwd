/**
 * DWD Device Lock — Anti-Buddy Punching Module
 * Version: 1.0
 * 
 * Prevents attendance fraud by:
 * 1. Locking a browser to one student for 24 hours after attendance
 * 2. Generating a lightweight device fingerprint
 * 3. Detecting suspicious device sharing patterns
 */

const DeviceLock = (() => {
    const LOCK_KEY = 'dwd_device_lock';
    const LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Generate a lightweight browser fingerprint.
     * Not foolproof, but raises the bar significantly against casual fraud.
     * Combines: canvas hash + WebGL renderer + timezone + platform + screen + language.
     */
    function generateFingerprint() {
        const components = [];

        // 1. Canvas fingerprint
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 50;
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 200, 50);
            ctx.fillStyle = '#069';
            ctx.fillText('DWD-Fingerprint-2026', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Anti-Fraud-Layer', 4, 35);
            components.push(canvas.toDataURL());
        } catch (e) {
            components.push('canvas-unsupported');
        }

        // 2. WebGL renderer
        try {
            const gl = document.createElement('canvas').getContext('webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
                    components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
                }
            }
        } catch (e) {
            components.push('webgl-unsupported');
        }

        // 3. System signals
        components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
        components.push(navigator.platform || 'unknown');
        components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
        components.push(navigator.language);
        components.push(navigator.hardwareConcurrency || 'unknown');
        components.push(navigator.maxTouchPoints || 0);

        // Hash all components into a single fingerprint string
        return hashCode(components.join('|||'));
    }

    /**
     * Simple but fast hash function (djb2 variant).
     * Not cryptographic — just for fingerprint dedup.
     */
    function hashCode(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        return 'DWD_' + Math.abs(hash).toString(36).toUpperCase();
    }

    /**
     * Check if the current device is locked to a different student.
     * @param {string} currentStudentId - The student trying to scan now
     * @returns {{ allowed: boolean, reason?: string, lockedTo?: string }}
     */
    function checkLock(currentStudentId) {
        try {
            const raw = localStorage.getItem(LOCK_KEY);
            if (!raw) return { allowed: true };

            const lock = JSON.parse(raw);

            // Check if lock has expired
            if (Date.now() > lock.expiresAt) {
                localStorage.removeItem(LOCK_KEY);
                return { allowed: true };
            }

            // Check if same student
            if (lock.studentId === currentStudentId) {
                return { allowed: true }; // Same student, allow
            }

            // Different student on locked device → REJECT
            const remainingHours = Math.ceil((lock.expiresAt - Date.now()) / (60 * 60 * 1000));
            return {
                allowed: false,
                reason: `هذا الجهاز مُقفل على طالب آخر لمدة ${remainingHours} ساعة أخرى. لا يمكن تسجيل الحضور من جهاز مُستخدم بالفعل (Buddy Punching Protection).`,
                lockedTo: lock.studentId
            };
        } catch (e) {
            // Corrupted data — clear and allow
            localStorage.removeItem(LOCK_KEY);
            return { allowed: true };
        }
    }

    /**
     * Lock this device to the current student after successful attendance.
     * @param {string} studentId
     * @param {string} studentName
     */
    function setLock(studentId, studentName) {
        const fingerprint = generateFingerprint();
        const lockData = {
            studentId,
            studentName,
            fingerprint,
            lockedAt: Date.now(),
            expiresAt: Date.now() + LOCK_DURATION_MS
        };

        try {
            localStorage.setItem(LOCK_KEY, JSON.stringify(lockData));
        } catch (e) {
            console.warn('DeviceLock: Failed to save lock to localStorage', e);
        }

        return fingerprint;
    }

    /**
     * Get the current device fingerprint (or generate a new one).
     */
    function getFingerprint() {
        return generateFingerprint();
    }

    /**
     * Clear the device lock (admin/debug use only).
     */
    function clearLock() {
        localStorage.removeItem(LOCK_KEY);
    }

    /**
     * Get lock info for display purposes.
     */
    function getLockInfo() {
        try {
            const raw = localStorage.getItem(LOCK_KEY);
            if (!raw) return null;
            const lock = JSON.parse(raw);
            if (Date.now() > lock.expiresAt) {
                localStorage.removeItem(LOCK_KEY);
                return null;
            }
            return lock;
        } catch (e) {
            return null;
        }
    }

    // Public API
    return {
        checkLock,
        setLock,
        getFingerprint,
        clearLock,
        getLockInfo
    };
})();

// Make available globally
window.DeviceLock = DeviceLock;
