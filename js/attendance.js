
// --- Configuration ---
// DYNAMIC SESSION SYSTEM (No hardcoded coordinates)
const ATTENDANCE_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown between scans

// --- State ---
let map, userMarker, circle, sessionCircle;
let isMapInitialized = false;
let isSubmitting = false; // Prevents double-click spam
let activeSession = null; // Stores the currently active session object

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Wait for Supabase
    await waitForSupabase();

    // 1. Initialize Authentication Display
    const user = await window.SecureConnect.checkAuth();
    if (user) {
        document.getElementById('current-user-name').textContent = user.name || user.email;
        document.getElementById('current-user-id').textContent = `ID: ${user.academic_id || 'N/A'}`;
    }

    // 2. Initialize Map (Leaflet)
    initMap();

    // 3. Check for Active Sessions immediately
    checkActiveSession();
    // Poll for sessions every 30 seconds
    setInterval(checkActiveSession, 30000);

    // 4. Attach Event Listeners
    const btnScan = document.getElementById('btn-scan');
    if (btnScan) {
        btnScan.replaceWith(btnScan.cloneNode(true));
        const newBtn = document.getElementById('btn-scan');
        newBtn.addEventListener('click', handleAttendanceRequest);
        // Initially disable until session found
        disableScanButton("جاري البحث عن محاضرة نشطة...");
    }

    // 5. Show Device Lock status if locked
    if (window.DeviceLock) {
        const lockInfo = DeviceLock.getLockInfo();
        if (lockInfo) {
            const remaining = Math.ceil((lockInfo.expiresAt - Date.now()) / (60 * 60 * 1000));
            console.log(`🔒 Device locked to: ${lockInfo.studentName} (${remaining}h remaining)`);
        }
    }
});

// Helper to wait for Supabase client and auth sync
async function waitForSupabase() {
    return new Promise(resolve => {
        let attempts = 0;
        const check = setInterval(async () => {
            attempts++;
            const sb = window.appSupabaseClient || window.supabase;
            const hasSync = !!(window.SecureConnect && window.SecureConnect.syncSupabaseAuth);
            
            if (sb && hasSync) {
                clearInterval(check);
                console.log("[Attendance] Client and Sync ready. Performing final sync...");
                await window.SecureConnect.syncSupabaseAuth();
                resolve();
            } else if (attempts > 50) {
                clearInterval(check);
                console.warn("[Attendance] Timeout waiting for Supabase/Sync.");
                resolve();
            }
        }, 200);
    });
}

async function checkActiveSession() {
    const supabase = window.appSupabaseClient || window.supabase;
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('is_active', true)
            .gt('end_time', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            activeSession = data[0];
            // console.log("Active Session Found:", activeSession);
            // console.log("Target Coords:", activeSession.latitude, activeSession.longitude);
            enableScanButton(activeSession);
            updateMapForSession(activeSession);
        } else {
            // console.log("No active sessions found.");
            activeSession = null;
            disableScanButton("لا توجد محاضرة نشطة حالياً");
            if (sessionCircle) map.removeLayer(sessionCircle);
        }
    } catch (err) {
        console.error("Failed to fetch sessions:", err);
    }
}

let watchId = null;

function enableScanButton(session) {
    const btn = document.getElementById('btn-scan');
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed', 'grayscale');
    btn.innerHTML = `
        <div class="relative flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-900/40 px-6 py-6 transition-all group-hover:bg-transparent">
            <i class="fas fa-fingerprint text-4xl text-green-400 group-hover:scale-110 transition-transform mb-2 animate-pulse"></i>
            <span class="text-lg font-bold text-white">تسجيل الحضور</span>
            <span class="text-[10px] text-green-300 opacity-100 font-bold">${escapeHTML(session.subject_name)} (${escapeHTML(session.room_name || 'Room')})</span>
        </div>
    `;
    updateStatus('info', `محاضرة نشطة: ${session.subject_name}`, 'text-green-400', 'fa-broadcast-tower');

    // Start watching position for real-time distance update
    if (navigator.geolocation) {
        if (watchId) navigator.geolocation.clearWatch(watchId);
        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy, altitude, speed } = pos.coords;
                const dist = calculateDistance(latitude, longitude, session.latitude, session.longitude);

                // Update UI Real-time
                document.getElementById('stat-distance').textContent = `${dist.toFixed(1)} م`;
                document.getElementById('stat-accuracy').textContent = `${accuracy.toFixed(1)} م`;

                // Update Mobile Stats
                const mDist = document.getElementById('stat-distance-m');
                const mAcc = document.getElementById('stat-accuracy-m');
                if (mDist) mDist.textContent = `${dist.toFixed(0)}m`;
                if (mAcc) mAcc.textContent = `${accuracy.toFixed(0)}m`;

                // Update Security UI
                updateSecurityUI(pos.coords);

                // Update Time limit strictly from the session setting
                if (session.end_time) {
                    const endTime = new Date(session.end_time).getTime();
                    const now = Date.now();
                    const timeLeft = Math.max(Math.floor((endTime - now) / 1000), 0);

                    const timeContainer = document.getElementById('stat-time-remaining');
                    const timeContainerM = document.getElementById('stat-time-remaining-m');
                    if (timeContainer || timeContainerM) {
                        const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                        const secs = (timeLeft % 60).toString().padStart(2, '0');
                        const displayTxt = `${mins}:${secs}`;

                        if (timeContainer) {
                            timeContainer.textContent = displayTxt;
                            if (timeLeft <= 60) timeContainer.classList.add('text-red-500', 'animate-pulse');
                        }
                        if (timeContainerM) {
                            timeContainerM.textContent = displayTxt;
                            if (timeLeft <= 60) timeContainerM.classList.add('text-red-500', 'animate-pulse');
                        }
                    }

                    if (timeLeft <= 0) {
                        disableScanButton("انتهى وقت تسجيل الحضور لهذه المحاضرة");
                        activeSession = null;
                        if (sessionCircle) map.removeLayer(sessionCircle);
                    }
                }

                // Optional: Live map update
                if (userMarker) userMarker.setLatLng([latitude, longitude]);
            },
            (err) => console.warn("WatchPosition Error:", err),
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    }
}

function disableScanButton(reason) {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    const btn = document.getElementById('btn-scan');
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed', 'grayscale');
    btn.innerHTML = `
        <div class="relative flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-900/40 px-6 py-6 transition-all">
            <i class="fas fa-ban text-4xl text-slate-500 mb-2"></i>
            <span class="text-lg font-bold text-slate-400">التسجيل مغلق</span>
            <span class="text-[10px] text-slate-500">${escapeHTML(reason)}</span>
        </div>
    `;
    updateStatus('loading', reason, 'text-slate-400', 'fa-search');
}

function initMap() {
    if (isMapInitialized) return;

    // Default view (will be updated when session found)
    map = L.map('map', { attributionControl: false }).setView([30.858467, 29.571205], 13); // Default to Borg El Arab

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM / CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    isMapInitialized = true;
}

function updateMapForSession(session) {
    if (!map || !session) return;

    // Remove old circle
    if (sessionCircle) map.removeLayer(sessionCircle);

    const lat = session.latitude;
    const lng = session.longitude;
    // Force 120 meters max
    const radius = Math.min(session.radius_meters || 120, 120);

    // Add new circle
    sessionCircle = L.circle([lat, lng], {
        color: '#22c55e', // Green
        fillColor: '#22c55e',
        fillOpacity: 0.15,
        radius: radius,
        dashArray: '5, 10',
        className: 'animate-pulse'
    }).addTo(map);

    // Center map on session
    map.flyTo([lat, lng], 17, { duration: 1.5 });
}

async function handleAttendanceRequest() {
    // --- Guard: Prevent double-click ---
    if (isSubmitting) return;
    isSubmitting = true;

    // Refresh session check to ensure it's still valid
    await checkActiveSession();
    if (!activeSession) {
        isSubmitting = false;
        return; // UI will update to disabled
    }

    const btn = document.getElementById('btn-scan');
    const supabase = window.appSupabaseClient || window.supabase;

    // UI: Loading State
    btn.disabled = true;
    updateStatus('loading', 'جاري الاتصال بالأقمار الصناعية...', 'text-blue-400', 'fa-satellite-dish fa-spin');

    if (window.SoundManager) window.SoundManager.play('click');

    // --- Check 1: Auth ---
    const user = await window.SecureConnect.checkAuth();
    if (!user) {
        updateStatus('error', 'يجب تسجيل الدخول أولاً', 'text-red-400', 'fa-sign-in-alt');
        resetBtn(btn);
        isSubmitting = false;
        return;
    }

    // --- Check 2: Device Lock ---
    if (window.DeviceLock) {
        const lockCheck = DeviceLock.checkLock(user.academic_id || user.id);
        if (!lockCheck.allowed) {
            updateStatus('error', lockCheck.reason, 'text-red-500', 'fa-lock');
            playSound('error');
            Swal.fire({
                icon: 'error',
                title: '⛔ جهاز مُقفل',
                text: lockCheck.reason,
                background: '#1e293b', color: '#fff'
            });
            logSuspiciousAttempt(user, 'BUDDY_PUNCH_ATTEMPT');
            resetBtn(btn);
            isSubmitting = false;
            return;
        }
    }

    // --- Check 2.5: Punitive Ban Check ---
    const banUntil = localStorage.getItem('dwd_punitive_ban');
    if (banUntil && Date.now() < parseInt(banUntil)) {
        const remainingHours = Math.ceil((parseInt(banUntil) - Date.now()) / (60 * 60 * 1000));
        updateStatus('error', 'محظور من التسجيل', 'text-red-500', 'fa-ban');
        playSound('error');
        Swal.fire({
            icon: 'error',
            title: '⛔ حساب محظور مؤقتاً',
            text: `تم حرمانك من تسجيل الحضور لمدة ${remainingHours} ساعة بسبب اكتشاف استخدامك لبرامج تزييف الموقع مسبقاً.`,
            background: '#1e293b', color: '#fff'
        });
        resetBtn(btn);
        isSubmitting = false;
        return;
    }

    // --- Check 3: Cooldown ---
    const lastScan = localStorage.getItem(`dwd_last_scan_${activeSession.id}`);
    if (lastScan) {
        updateStatus('success', 'تم تسجيل حضورك لهذه المحاضرة مسبقاً', 'text-green-400', 'fa-check-circle');
        btn.innerHTML = `<span class="text-green-400 font-bold">تم التسجيل ✅</span>`;
        isSubmitting = false;
        return;
    }

    // --- Check 4: Geolocation ---
    if (!navigator.geolocation) {
        updateStatus('error', 'المتصفح لا يدعم تحديد الموقع', 'text-red-400', 'fa-times-circle');
        resetBtn(btn);
        isSubmitting = false;
        return;
    }

    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude, accuracy, altitude, speed } = position.coords;
            updateUserLocationOnMap(latitude, longitude, accuracy);

            // Calculate Distance to Active Session
            const distance = calculateDistance(latitude, longitude, activeSession.latitude, activeSession.longitude);
            // Strict 120m boundary
            const ALLOWED_RADIUS = Math.min(activeSession.radius_meters || 120, 120);

            document.getElementById('stat-distance').textContent = `${distance.toFixed(1)} م`;
            document.getElementById('stat-accuracy').textContent = `${accuracy.toFixed(1)} م`;

            // --- Check 5: Security (Spoofing) ---
            const securityCheck = performSecurityChecks(position.coords);
            if (!securityCheck.passed) {
                // Log the fraud
                logSuspiciousAttempt(user, 'GPS_SPOOF_DETECTED', { accuracy, altitude, reason: securityCheck.reason });

                updateStatus('error', `أداة غش موقع: ${securityCheck.reason}`, 'text-red-500', 'fa-user-secret');
                playSound('error');

                // 24 Hour Ban
                const banDuration = 24 * 60 * 60 * 1000;
                localStorage.setItem('dwd_punitive_ban', (Date.now() + banDuration).toString());

                // SweetAlert Warning
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: '🚨 تحذير أمني خطير!',
                        text: 'لقد خنت شرف الجامعة باستخدامك برامج الموقع الوهمي (Fake GPS). سيتم حرمانك من تسجيل الدخول لمدة 24 ساعة، وسوف يتم رصد اسمك ورقمك وعرضه في صفحة الدكتور.',
                        confirmButtonText: 'حسناً',
                        confirmButtonColor: '#ef4444',
                        background: '#1e293b',
                        color: '#fff',
                        allowOutsideClick: false
                    }).then(() => {
                        window.location.href = '../index.html'; // Kick them out
                    });
                } else {
                    alert('تحذير أمني: لقد خنت شرف الجامعة باستخدامك موقع وهمي. تم حظرك 24 ساعة.');
                    window.location.href = '../index.html';
                }

                resetBtn(btn);
                isSubmitting = false;
                return;
            }

            // --- Check 6: Geofence ---
            if (distance <= ALLOWED_RADIUS) {
                updateStatus('loading', 'الموقع صحيح! جاري تسجيل الحضور...', 'text-blue-400', 'fa-spinner fa-spin');
                try {
                    await submitAttendance(user, latitude, longitude, distance, activeSession);
                    // Success is handled inside submitAttendance
                } catch (e) {
                    console.error(e);
                }
            } else {
                const msg = `أنت بعيد عن القاعة بنحو ${Math.round(distance)} متر (المسموح ${ALLOWED_RADIUS} متر)`;
                updateStatus('error', msg, 'text-orange-400', 'fa-map-marker-alt');
                playSound('error');

                Swal.fire({
                    icon: 'warning',
                    title: 'بعيد جداً',
                    text: msg,
                    confirmButtonText: 'حسناً',
                    background: '#1e293b',
                    color: '#fff'
                });

                resetBtn(btn);
                isSubmitting = false;
            }
        },
        (error) => {
            let msg = 'تعذر تحديد الموقع';
            if (error.code === 1) msg = 'يرجى إعطاء صلاحية تحديد الموقع (GPS)';

            // If it's a timeout (3) or position unavailable (2), treat as suspected Fake GPS
            if (error.code === 2 || error.code === 3) {
                logSuspiciousAttempt(user, 'GPS_CONNECTION_FAILED_SPOOF_SUSPECTED', { error_code: error.code, reason: 'GPS Timeout or Unavailable (Fake GPS blocker expected)' });

                const banDuration = 24 * 60 * 60 * 1000;
                localStorage.setItem('dwd_punitive_ban', (Date.now() + banDuration).toString());

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: '🚨 تحذير أمني خطير!',
                        text: 'لقد خنت شرف الجامعة باستخدامك برامج الموقع الوهمي (Fake GPS) أو منع الاتصال الحقيقي. سيتم حرمانك من تسجيل الدخول لمدة 24 ساعة، وسوف يتم رصد اسمك ورقمك وعرضه في صفحة الدكتور.',
                        confirmButtonText: 'حسناً',
                        confirmButtonColor: '#ef4444',
                        background: '#1e293b',
                        color: '#fff',
                        allowOutsideClick: false
                    }).then(() => {
                        window.location.href = '../index.html';
                    });
                } else {
                    alert('تحذير أمني: لقد خنت شرف الجامعة باستخدامك موقع وهمي. تم حظرك 24 ساعة.');
                    window.location.href = '../index.html';
                }

                resetBtn(btn);
                isSubmitting = false;
                return;
            }

            updateStatus('error', msg, 'text-red-400', 'fa-exclamation-triangle');
            resetBtn(btn);
            isSubmitting = false;
        },
        options
    );
}

// Advanced Spoofing Checks (Anti-Fake GPS)
function performSecurityChecks(coords) {
    const flags = [];
    const isAndroid = /Android/i.test(navigator.userAgent);

    // 1. Unnatural Perfection (Fake GPS apps often return EXACT round numbers)
    if (coords.accuracy !== null && (coords.accuracy === 0 || coords.accuracy % 1 === 0 && coords.accuracy <= 10)) {
        flags.push('دقة غير طبيعية (مُصطنعة)');
    }

    // 2. Android specific hardcoded fake accuracy
    if (coords.accuracy !== null && coords.accuracy <= 5 && isAndroid) {
        flags.push('دقة مشبوهة لأجهزة Android');
    }

    // 3. No altitude from a high accuracy reading (Many fake GPS apps don't simulate altitude API properly)
    if ((coords.altitude === null || coords.altitude === 0) && coords.accuracy !== null && coords.accuracy < 15) {
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            flags.push('لا يوجد ارتفاع موثوق (Fake GPS)');
        }
    }

    // 4. Fake GPS App Signatures on Android
    if (isAndroid) {
        // App pattern: Mock provides an exact whole number accuracy (often 10, 20) and exactly 0 altitude
        if (coords.altitude === 0 && coords.accuracy % 1 === 0 && coords.accuracy <= 50) {
            flags.push('تطابق مع بصمة برامج الموقع الوهمي (Fake GPS App)');
        }

        // High accuracy with no altitude at all (real high-accuracy GPS on Android provides altitude)
        if (coords.altitude === null && coords.accuracy <= 12 && coords.accuracy % 1 === 0) {
            flags.push('تطابق مع أداة تزييف الموقع (دقة مرتفعة بدون ارتفاع)');
        }
    }

    // 5. Incognito Mode Check (Linked to GPS Spoofing Risk)
    if (window.isIncognitoMode && coords.accuracy !== null && coords.accuracy <= 20) {
        flags.push('استخدام المتصفح الخفي (Incognito) مع دقة اتصال مريبة');
    }

    // If any strong flags trigger, fail the check immediately.
    if (flags.length >= 1) return { passed: false, reason: flags[0], flags };

    return { passed: true, flags };
}

async function submitAttendance(user, lat, lng, dist, session) {
    const btn = document.getElementById('btn-scan');
    const supabase = window.appSupabaseClient || window.supabase;

    // console.log("🚀 Starting Submission Logic...");
    // console.log("User:", user);
    // console.log("Session:", session);

    try {
        if (!supabase) throw new Error("فشل الاتصال بقاعدة البيانات (Supabase Client Missing)");

        const nonce = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
        const fingerprint = window.DeviceLock ? DeviceLock.getFingerprint() : 'unavailable';

        // Advanced Anti-Buddy Punching Check
        if (fingerprint !== 'unavailable' && !fingerprint.includes('canvas-unsupported')) {
            const { data: recentLogs } = await supabase
                .from('attendance_logs')
                .select('student_id')
                .eq('device_fingerprint', fingerprint)
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            if (recentLogs && recentLogs.length > 0) {
                const differentStudents = recentLogs.filter(log => log.student_id !== (user.id || 'unknown'));
                if (differentStudents.length > 0) {
                    logSuspiciousAttempt(user, 'BUDDY_PUNCH_ATTEMPT', { fingerprint });
                    throw new Error("هذا الجهاز مسجل به طالب آخر اليوم. (مكافحة حضور النيابة Buddy Punching)");
                }
            }
        }

        const payload = {
            session_id: session.id,
            student_id: user.id || 'unknown',
            student_name: user.name || 'Student',
            academic_id: user.academic_id || 'N/A',
            lecture_title: session.subject_name,
            latitude: lat,
            longitude: lng,
            distance_meters: Math.round(dist),
            status: 'present',
            device_info: navigator.userAgent,
            device_fingerprint: fingerprint,
            scan_timestamp: new Date().toISOString()
        };

        // console.log("📦 Sending Payload:", payload);

        const { data, error } = await supabase.from('attendance_logs').insert(payload).select();

        // console.log("📡 Supabase Response:", { data, error });

        if (error) {
            console.error("❌ DB Insert Error:", error);
            if (error.code === '23505') throw new Error("تم تسجيل حضورك مسبقاً (Duplicate)");
            if (error.code === '42501') throw new Error("رُفض الإذن (Permission Denied) - تأكد من تشغيل كود SQL في لوحة التحكم");
            throw error;
        }

        // console.log("✅ Insert Success!");

        // Lock device
        if (window.DeviceLock) DeviceLock.setLock(user.academic_id || user.id, user.name);

        // Save session specific cooldown
        localStorage.setItem(`dwd_last_scan_${session.id}`, Date.now().toString());

        updateStatus('success', 'تم تسجيل الحضور بنجاح ✅', 'text-green-400', 'fa-check-double');
        playSound('success');

        // Robust Alert (Try Swal, fallback to native)
        const successMsg = `تم تسجيل الحضور بنجاح!\nالمادة: ${session.subject_name}`;
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'تم بنجاح!',
                text: successMsg,
                timer: 4000,
                showConfirmButton: true,
                background: '#1e293b',
                color: '#fff'
            });
        } else {
            alert(successMsg);
        }

        btn.innerHTML = `<i class="fas fa-check-circle text-5xl text-green-400"></i><span class="text-lg font-bold text-green-400 mt-2">تم التسجيل</span>`;

    } catch (err) {
        // console.error("🔥 Catch Block Error:", err);
        let msg = 'فشل التسجيل: ' + (err.message || "خطأ غير معروف");

        if (err.message.includes("مسبقاً")) msg = "أنت مسجل بالفعل في هذه المحاضرة.";

        updateStatus('error', msg, 'text-red-400', 'fa-database');
        resetBtn(btn);
        isSubmitting = false;

        // Robust Error Alert
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'خطأ في التسجيل',
                text: msg,
                footer: 'راجع الـ Console للمزيد من التفاصيل',
                background: '#1e293b',
                color: '#fff'
            });
        } else {
            alert("خطأ:\n" + msg);
        }
    }
}

function logSuspiciousAttempt(user, type, metadata = {}) {
    const supabase = window.appSupabaseClient || window.supabase;
    if (!supabase) return;

    // Ensure we send name and academic ID so it doesn't appear as "Unknown" in Professor Hub
    const identifier = user?.academic_id || 'N/A';
    const name = user?.name || user?.full_name || 'غير معروف';

    // Merge into metadata so professor hub can parse it easily
    const finalMetadata = {
        ...metadata,
        UserAgent: navigator.userAgent,
        StudentName: name,
        AcademicID: identifier
    };

    supabase.from('fraud_logs').insert({
        student_id: user?.id || 'anonymous',
        fraud_type: type,
        metadata: JSON.stringify(finalMetadata),
        timestamp: new Date().toISOString()
    }).then(() => { }).catch(e => console.error("Fraud log failed", e));
}

function updateUserLocationOnMap(lat, lng, acc) {
    if (!map) return;
    if (userMarker) userMarker.setLatLng([lat, lng]);
    else userMarker = L.marker([lat, lng]).addTo(map);

    // Fit bounds to show both user and session
    if (sessionCircle) {
        const group = new L.featureGroup([userMarker, sessionCircle]);
        map.fitBounds(group.getBounds().pad(0.2));
    } else {
        map.setView([lat, lng], 16);
    }
}

function updateStatus(type, msg, colorClass, iconClass) {
    const container = document.getElementById('status-container');
    const txt = document.getElementById('status-msg');
    const icon = document.getElementById('status-icon');
    container.classList.remove('hidden');
    txt.textContent = msg;
    txt.className = `text-sm font-medium ${colorClass}`;
    icon.className = `text-xl mb-1 block ${colorClass} fas ${iconClass}`;
}

function resetBtn(btn) {
    // Only reset if active session exists
    if (activeSession) {
        enableScanButton(activeSession);
    }
    isSubmitting = false;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function playSound(type) {
    if (window.SoundManager && window.SoundManager.play) window.SoundManager.play(type);
}

function updateSecurityUI(coords) {
    const el = document.getElementById('stat-security');
    if (!el) return;

    const check = performSecurityChecks(coords);
    if (check.passed) {
        el.textContent = 'آمن ✅';
        el.className = 'font-bold text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30';
    } else {
        el.textContent = 'غير آمن ⚠️';
        el.className = 'font-bold text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse';
    }
}
