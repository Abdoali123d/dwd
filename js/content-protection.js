(function () {
    const allowedDomains = ['dwd-edu.vercel.app', 'localhost', '127.0.0.1', ''];
    const hostname = window.location.hostname;

    // Allow Vercel preview/production deployments for this project
    const isVercelDomain = hostname.endsWith('.vercel.app');
    const isAllowedDomain = allowedDomains.includes(hostname) || isVercelDomain;

    if (!isAllowedDomain && window.location.protocol !== 'file:') {
        const msg = document.createElement('h1');
        msg.style.cssText = 'text-align:center; margin-top:100px; color:red; font-family:Cairo,sans-serif;';
        msg.textContent = '(دخول غير مصرح بك بل دخول)';
        document.documentElement.appendChild(msg);
        return;
    }

    const strictAllowed = ['dwd-edu.vercel.app', 'localhost', '127.0.0.1'];
    const isFileProtocol = window.location.protocol === 'file:';
    const isDevProtocol = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    const isAllowedStrict = strictAllowed.includes(hostname) || isVercelDomain;

    if (!isFileProtocol && isDevProtocol && !isAllowedStrict && hostname !== '') {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex;justify-content:center;align-items:center;height:100vh;background:#000;color:red;font-family:Cairo,sans-serif;font-size:24px;text-align:center;flex-direction:column;direction:rtl;';
        const h1 = document.createElement('h1');
        h1.textContent = '⚠️ تنبيه أمني ⚠️';
        const p1 = document.createElement('p');
        p1.textContent = 'هذا المحتوى محمي ولا يمكن تشغيله بدون إنترنت أو على نطاق غير مصرح به.';
        const p2 = document.createElement('p');
        const link = document.createElement('a');
        link.href = 'https://dwd-edu.vercel.app/';
        link.style.cssText = 'color:cyan;text-decoration:none;';
        link.textContent = 'https://dwd-edu.vercel.app/';
        p2.appendChild(document.createTextNode('يرجى زيارة الرابط الرسمي: '));
        p2.appendChild(document.createElement('br'));
        p2.appendChild(link);
        container.appendChild(h1);
        container.appendChild(p1);
        container.appendChild(p2);
        document.documentElement.appendChild(container);
        return;
    }

    const style = document.createElement('style');
    style.textContent = `
        .dwd-protection-alert {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(9, 9, 11, 0.9);
            color: #fee2e2;
            padding: 10px 20px;
            border-radius: 0.5rem;
            border: 1px solid rgba(239, 68, 68, 0.2);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
            z-index: 2147483647;
            font-family: 'Cairo', system-ui, sans-serif;
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
            pointer-events: none;
            direction: rtl;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }
        .dwd-protection-alert.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        .dwd-alert-icon {
            color: #ef4444;
            display: flex;
            align-items: center;
        }
    `;
    document.head.appendChild(style);

    const alertBox = document.createElement('div');
    alertBox.className = 'dwd-protection-alert';
    alertBox.innerHTML = `
        <span class="dwd-alert-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-alert"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        </span>
        <span>المحتوى محمي ولا يمكن نسخه أو فحصه أمنياً</span>
    `;
    document.body.appendChild(alertBox);

    let timeout;
    function showProtectionAlert() {
        alertBox.classList.add('show');
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            alertBox.classList.remove('show');
        }, 3000);
    }

    function isForbiddenKey(e) {
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
            (e.ctrlKey && ['U', 'S', 'P', 'C', 'X', 'A', 'V'].includes(e.key.toUpperCase())) ||
            (e.shiftKey && e.key === 'Insert')
        ) return true;

        if (
            e.keyCode === 123 ||
            (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) ||
            (e.ctrlKey && [85, 83, 80, 67, 88, 65, 86].includes(e.keyCode)) ||
            (e.shiftKey && e.keyCode === 45)
        ) return true;

        return false;
    }

    function handleKeyboardEvent(e) {
        if (isForbiddenKey(e)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showProtectionAlert();
            return false;
        }
    }

    window.addEventListener('keydown', handleKeyboardEvent, true);
    window.addEventListener('keypress', handleKeyboardEvent, true);
    window.addEventListener('keyup', handleKeyboardEvent, true);
    window.onkeydown = handleKeyboardEvent;
    document.onkeydown = handleKeyboardEvent;

    window.addEventListener('paste', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showProtectionAlert();
        return false;
    }, true);

    const contextMenuStyle = document.createElement('style');
    contextMenuStyle.textContent = `
        .dwd-context-menu {
            position: fixed;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(34, 211, 238, 0.3);
            border-radius: 12px;
            padding: 8px 0;
            min-width: 180px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(34, 211, 238, 0.1);
            z-index: 2147483647;
            display: none;
            flex-direction: column;
            direction: rtl;
            font-family: 'Cairo', sans-serif;
            transform-origin: top right;
            animation: contextScale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes contextScale {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
        }
        .dwd-context-item {
            padding: 10px 20px;
            color: #e2e8f0;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s ease;
        }
        .dwd-context-item:hover {
            background: rgba(34, 211, 238, 0.15);
            color: #22d3ee;
        }
        .dwd-context-item i {
            font-size: 16px;
            width: 20px;
            text-align: center;
        }
    `;
    document.head.appendChild(contextMenuStyle);

    const customContextMenu = document.createElement('div');
    customContextMenu.className = 'dwd-context-menu';
    customContextMenu.innerHTML = `
        <div class="dwd-context-item" id="ctx-refresh">
            <i class="fas fa-sync-alt"></i> تحديث الصفحة
        </div>
        <div class="dwd-context-item" id="ctx-zoom-in">
            <i class="fas fa-search-plus"></i> تكبير الشاشة
        </div>
        <div class="dwd-context-item" id="ctx-zoom-out">
            <i class="fas fa-search-minus"></i> تصغير الشاشة
        </div>
    `;
    document.body.appendChild(customContextMenu);

    let currentZoom = 1;

    document.getElementById('ctx-refresh').addEventListener('click', () => {
        window.location.reload();
    });
    document.getElementById('ctx-zoom-in').addEventListener('click', () => {
        currentZoom += 0.1;
        document.body.style.transform = `scale(${currentZoom})`;
        document.body.style.transformOrigin = 'top center';
        customContextMenu.style.display = 'none';
    });
    document.getElementById('ctx-zoom-out').addEventListener('click', () => {
        currentZoom = Math.max(0.5, currentZoom - 0.1);
        document.body.style.transform = `scale(${currentZoom})`;
        document.body.style.transformOrigin = 'top center';
        customContextMenu.style.display = 'none';
    });

    document.addEventListener('click', () => {
        customContextMenu.style.display = 'none';
    });

    function handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        let x = e.clientX;
        let y = e.clientY;
        const menuWidth = 180;
        const menuHeight = 130;
        if (x + menuWidth > window.innerWidth) x -= menuWidth;
        if (y + menuHeight > window.innerHeight) y -= menuHeight;
        customContextMenu.style.left = `${x}px`;
        customContextMenu.style.top = `${y}px`;
        customContextMenu.style.display = 'flex';
        return false;
    }
    document.addEventListener('contextmenu', handleContextMenu, true);
    window.oncontextmenu = handleContextMenu;

    document.addEventListener('selectstart', function (e) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });

    document.addEventListener('dragstart', function (e) {
        e.preventDefault();
    });

    window.addEventListener("touchstart", function (e) {
        if (e.touches.length > 1) {
            // e.preventDefault();
        }
    }, { passive: false });

    const mobileStyle = document.createElement('style');
    mobileStyle.textContent = `
        * {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            -khtml-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
        }
        input, textarea {
            -webkit-user-select: text !important;
            user-select: text !important;
        }
    `;
    document.head.appendChild(mobileStyle);
})();
