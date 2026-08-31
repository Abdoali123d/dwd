// Imports removed for offline support (loaded via script tags in HTML)
// const Swup = window.Swup;
// const SwupScriptsPlugin = window.SwupScriptsPlugin;
const swup = new Swup({
    containers: ['#swup-main'], // الحاوية اللي محتواها هيتغير في كل مرة
    plugins: [
        new SwupScriptsPlugin({
            head: true,
            body: true,
            optin: false
        })
    ],
    cache: false // إيقاف التخزين المؤقت حالياً لضمان رؤية التغييرات فوراً
});

// الخطافات (Hooks): وظائف بتشتغل تلقائياً بعد كل عملية تنقل ناجحة
swup.hooks.on('page:view', () => {
    // console.log('🚀 تم التنقل السريع بنجاح');  [Security Fix]

    // إعادة تشغيل حامي الصفحات للتأكد إن المستخدم لسه مسجل دخول
    if (window.authGuardCheck) window.authGuardCheck();

    // ======= THEME PERSISTENCE ENGINE =======
    try {
        const savedTheme = localStorage.getItem('dwd-theme') || 'theme-sky';
        document.body.classList.remove('theme-white', 'theme-sky', 'theme-black', 'theme-petrol', 'theme-university', 'theme-academic', 'theme-academic-dark');
        if (savedTheme) {
            document.body.classList.add(savedTheme);
        }

        const isLightMode = localStorage.getItem('dwd-light-mode');
        if (isLightMode === 'true') {
            document.body.classList.add('light-mode');
        }

        const savedCardColor = localStorage.getItem('dwd-card-bg');
        if (savedCardColor) {
            document.body.style.setProperty('--card-bg', savedCardColor);
        }
    } catch (e) {
        console.error("Theme Restoration Error during SPA transition:", e);
    }
    // ========================================

    // هنا نقدر نضيف أي كود محتاج يشتغل تاني بعد تغيير الصفحة
});

// console.log('✅ SPA Navigation Initialized');  [Security Fix]
