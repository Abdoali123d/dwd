// (function () {
//     // 0. قفل الدومين — للحماية من سرقة الكود وتشغيله في موقع آخر
//     const allowedDomains = ['dwd-edu.vercel.app', 'localhost', '127.0.0.1', ''];
//     const hostname = window.location.hostname;

//     // التحقق مما إذا كان الموقع يعمل على رابط غير مصرح به
//     if (!allowedDomains.includes(hostname) && window.location.protocol !== 'file:') {
//         // REVIEW: Potential XSS - Check this line manually
//         document.documentElement.innerHTML = '<h1 style="text-align:center; margin-top:100px; color:red; font-family:Cairo,sans-serif;">(دخول غير مصرح بك بل دخول)</h1>';
//         return;
//     }

//     // الوضع الصارم (Strict Mode): منع تشغيل الملف مباشرة من الجهاز (file://)
//     // إذا كنت تريد السماح للمستخدم برؤية المحتوى عند فتح الملف المحمل، قم بتغيير هذا الجزء
//     const strictAllowed = ['dwd-edu.vercel.app', 'localhost', '127.0.0.1'];
//     const isFileProtocol = window.location.protocol === 'file:';

//     if (isFileProtocol || (!strictAllowed.includes(hostname) && hostname !== '')) {
//         // مفتاح الإيقاف (Kill Switch): يمسح محتوى الصفحة تماماً ويطلب التوجه للرابط الرسمي
//         // REVIEW: Potential XSS - Ensure variable is safe
//         document.documentElement.innerHTML = `
//             <div style="
//                 display: flex; 
//                 justify-content: center; 
//                 align-items: center; 
//                 height: 100vh; 
//                 background: #000; 
//                 color: red; 
//                 font-family: 'Cairo', sans-serif; 
//                 font-size: 24px; 
//                 text-align: center;
//                 flex-direction: column;
//                 direction: rtl;
//             ">
//                 <h1>⚠️ تنبيه أمني ⚠️</h1>
//                 <p>هذا المحتوى محمي ولا يمكن تشغيله بدون إنترنت أو على نطاق غير مصرح به.</p>
//                 <p>يرجى زيارة الرابط الرسمي: <br> <a href="https://dwd-edu.vercel.app/login.html" style="color: cyan; text-decoration: none;">https://dwd-edu.vercel.app/login.html</a></p>
//             </div>
//         `;
//         throw new Error("حماية المحتوى: تشغيل غير مصرح به.");
//     }

//     // 1. حقن استايلات التنبيه المخصص (CSS)
//     const style = document.createElement('style');
//     // المحتوى ثابت وآمن
//     style.innerHTML = `
//         .dwd-protection-alert {
//             position: fixed;
//             top: 24px;
//             right: 24px;
//             background: rgba(40, 40, 40, 0.95);
//             color: #ff4757;
//             padding: 12px 24px;
//             border-radius: 8px;
//             box-shadow: 0 10px 30px rgba(0,0,0,0.5);
//             z-index: 2147483647;
//             font-family: 'Cairo', system-ui, sans-serif;
//             font-weight: 600;
//             font-size: 14px;
//             display: flex;
//             align-items: center;
//             gap: 10px;
//             transform: translateX(200%);
//             transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
//             pointer-events: none;
//             direction: rtl;
//             border-left: 4px solid #ff4757;
//             backdrop-filter: blur(5px);
//         }
        
//         .dwd-protection-alert.show {
//             transform: translateX(0);
//         }

//         .dwd-alert-icon {
//             font-size: 18px;
//         }
//     `;
//     document.head.appendChild(style);

//     // 2. إنشاء عنصر التنبيه (Alert Element)
//     const alertBox = document.createElement('div');
//     alertBox.className = 'dwd-protection-alert';
//     // المحتوى ثابت وآمن
//     alertBox.innerHTML = `
//         <span class="dwd-alert-icon">⚠️</span>
//         <span>تنبيه: المحتوى محمي ولا يمكن نسخه أو فحصه !!</span>
//     `;
//     document.body.appendChild(alertBox);

//     // 3. وظيفة لإظهار وإخفاء التنبيه
//     let timeout;
//     function showProtectionAlert() {
//         alertBox.classList.add('show');
//         if (timeout) clearTimeout(timeout);
//         timeout = setTimeout(() => {
//             alertBox.classList.remove('show');
//         }, 3000);
//     }

//     // 4. حماية لوحة المفاتيح والماوس (Aggressive Protection)

//     // التحقق من الأزرار الممنوعة (مثل F12 و Ctrl+U و Ctrl+C و Ctrl+V)
//     function isForbiddenKey(e) {
//         if (
//             e.key === 'F12' ||
//             (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
//             (e.ctrlKey && ['U', 'S', 'P', 'C', 'X', 'A', 'V'].includes(e.key.toUpperCase())) ||
//             (e.shiftKey && e.key === 'Insert')
//         ) return true;

//         if (
//             e.keyCode === 123 ||
//             (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) ||
//             (e.ctrlKey && [85, 83, 80, 67, 88, 65, 86].includes(e.keyCode)) ||
//             (e.shiftKey && e.keyCode === 45)
//         ) return true;

//         return false;
//     }

//     function handleKeyboardEvent(e) {
//         if (isForbiddenKey(e)) {
//             e.preventDefault();
//             e.stopPropagation();
//             e.stopImmediatePropagation();
//             showProtectionAlert();
//             return false;
//         }
//     }

//     // أ- حماية لوحة المفاتيح
//     window.addEventListener('keydown', handleKeyboardEvent, true);
//     window.addEventListener('keypress', handleKeyboardEvent, true);
//     window.addEventListener('keyup', handleKeyboardEvent, true);
//     window.onkeydown = handleKeyboardEvent;
//     document.onkeydown = handleKeyboardEvent;

//     // منع لصق النصوص
//     window.addEventListener('paste', function (e) {
//         e.preventDefault();
//         e.stopPropagation();
//         showProtectionAlert();
//         return false;
//     }, true);

//     // ب- حماية الماوس (تعطيل القائمة اليمنى)
//     function handleContextMenu(e) {
//         e.preventDefault();
//         e.stopPropagation();
//         showProtectionAlert();
//         return false;
//     }
//     document.addEventListener('contextmenu', handleContextMenu, true);
//     window.oncontextmenu = handleContextMenu;
//     window.oncontextmenu = handleContextMenu;

//     // ج- منع تحديد النصوص (Select) وسحب العناصر (Drag)
//     document.addEventListener('selectstart', function (e) {
//         if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
//             e.preventDefault();
//         }
//     });

//     document.addEventListener('dragstart', function (e) {
//         e.preventDefault();
//     });

//     // 5. حماية خاصة للهواتف (Mobile Protection) - جوجل بكسل وغيره
//     // منع اللمس المطول (Long Press) الذي يظهر القوائم
//     window.addEventListener("touchstart", function (e) {
//         if (e.touches.length > 1) {
//             // منع اللمس المتعدد (Multi-touch) إذا كان بيستخدم للتكبير أو النسخ
//             // e.preventDefault(); // (اختياري: قد يؤثر على التكبير)
//         }
//     }, { passive: false });

//     // حقن CSS إضافي لمنع التحديد في الموبايل
//     const mobileStyle = document.createElement('style');
//     // المحتوى ثابت وآمن
//     mobileStyle.innerHTML = `
//         * {
//             -webkit-touch-callout: none !important; /* ايفون سافاري */
//             -webkit-user-select: none !important; /* سافاري */
//             -khtml-user-select: none !important; /* كونكيرور */
//             -moz-user-select: none !important; /* Old Firefox */
//             -ms-user-select: none !important; /* Internet Explorer/Edge */
//             user-select: none !important; /* Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox */
//         }
//         input, textarea {
//             -webkit-user-select: text !important;
//             user-select: text !important;
//         }
//     `;
//     document.head.appendChild(mobileStyle);

// })();
