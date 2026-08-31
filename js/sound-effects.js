// --- مدير المؤثرات الصوتية ---
// بيستخدم Web Audio API لتشغيل أصوات تفاعلية بدون تحميل ملفات
// بيتفعل تلقائياً عند أول تفاعل من المستخدم (ضغطة أو لمسة)

if (!window.SoundManager) {
    window.SoundManager = {
        audioCtx: null,
        enabled: false, // تم إيقاف الأصوات مؤقتاً بناءً على الطلب

        // دالة تهيئة مدير الصوت — بتنشئ AudioContext وتربط أحداث الصفحة
        init() {
            if (!this.enabled) return;
            if (!this.audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContext();
            }
            // لو المتصفح أوقف الصوت، بنرجعه
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            this.attachListeners();
        },

        // دالة ربط أحداث التفاعل — بتسمع لكل الأزرار والروابط والكروت
        attachListeners() {
            if (!this.enabled) return;
            const interactables = 'button, a, input, select, textarea, .clickable, .glass-card, .nav-link, .subject-tab, .task-card, .btn, .btn-neon, .btn-primary, .card, .profile-card';

            // إزالة تأخير الصوت — بنفعّل AudioContext عند أي ضغطة أو لمسة
            ['click', 'touchstart'].forEach(eventType => {
                document.addEventListener(eventType, (e) => {
                    if (this.audioCtx && this.audioCtx.state === 'suspended') {
                        this.audioCtx.resume();
                    }
                }, true);
            });

            // صوت التحريك (hover) — بيشتغل لما الماوس يمر على عنصر تفاعلي
            document.addEventListener('mouseenter', (e) => {
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                if (e.target && e.target.closest && e.target.closest(interactables)) {
                    this.play('hover');
                }
            }, true);

            // صوت اللمس على الموبايل — بيحاكي الـ hover
            document.addEventListener('touchstart', (e) => {
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                if (e.target && e.target.closest && e.target.closest(interactables)) {
                    this.play('hover');
                }
            }, { passive: true });

            // صوت الضغط — بيشتغل عند أي كليك على عنصر تفاعلي
            document.addEventListener('click', (e) => {
                if (e.target && e.target.closest && e.target.closest(interactables)) {
                    this.play('click');
                    this.vibrate(10); // اهتزاز خفيف
                }
            }, true);

            // صوت الكليك اليمين — بيعمل صوت خطأ واهتزاز مختلف
            document.addEventListener('contextmenu', (e) => {
                this.play('error');
                this.vibrate([30, 50, 30]); // نمط اهتزاز مميز
            }, true);
        },

        // دالة الاهتزاز — بتشغّل اهتزاز الجهاز (للموبايل)
        vibrate(pattern) {
            if (navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        },

        // دالة تشغيل الأصوات — بتختار نوع الصوت وتشغله
        play(type) {
            if (!this.enabled) return;
            try {
                if (!this.audioCtx) this.init();
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }

                const osc = this.audioCtx.createOscillator();
                const gainNode = this.audioCtx.createGain();

                osc.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);

                const now = this.audioCtx.currentTime;

                switch (type) {
                    case 'hover':
                        // صوت هادي وممتع للـ Hover (Pop خفيف جداً)
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(600, now);
                        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
                        gainNode.gain.setValueAtTime(0.04, now);
                        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                        osc.start(now);
                        osc.stop(now + 0.05);
                        break;

                    case 'click':
                        // صوت كليك انيق (Water Drop / Soft Tap)
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(450, now);
                        osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
                        gainNode.gain.setValueAtTime(0.12, now);
                        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                        osc.start(now);
                        osc.stop(now + 0.08);
                        break;

                    case 'success':
                        // صوت نجاح — نغمة مستقبلية مبهجة (Chord)
                        this.playTone(523.25, 'sine', now, 0.15, 0.1);      // C5
                        this.playTone(659.25, 'sine', now + 0.08, 0.15, 0.1); // E5
                        this.playTone(783.99, 'sine', now + 0.16, 0.3, 0.12); // G5 (أطول شوية)
                        this.vibrate([50, 50, 50]);
                        break;

                    case 'error':
                        // صوت خطأ — نغمة منخفضة هادية وغير مزعجة (Soft Buzz)
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(250, now);
                        osc.frequency.linearRampToValueAtTime(100, now + 0.25);
                        gainNode.gain.setValueAtTime(0.15, now);
                        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.25);
                        osc.start(now);
                        osc.stop(now + 0.25);
                        this.vibrate(200);
                        break;
                }
            } catch (err) {
                // منع ظهور AbortError في الكونسول إذا المتصفح منع التشغيل
                console.warn('Audio Context blocked or interrupted:', err);
            }
        },

        // دالة مساعدة — بتشغل نغمة واحدة بتردد ومدة محددة
        playTone(freq, type, startTime, duration, customGain = 0.15) {
            try {
                const osc = this.audioCtx.createOscillator();
                const gainNode = this.audioCtx.createGain();
                osc.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);

                osc.type = type;
                osc.frequency.value = freq;
                gainNode.gain.setValueAtTime(customGain, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                osc.start(startTime);
                osc.stop(startTime + duration);
            } catch (err) { }
        }
    };

    // --- تفعيل تلقائي عند أول تفاعل (ضغطة أو لمسة) عشان المتصفح يسمح بالصوت ---
    ['click', 'touchstart'].forEach(eventType => {
        document.addEventListener(eventType, () => {
            window.SoundManager.init();
        }, { once: true });
    });
}
