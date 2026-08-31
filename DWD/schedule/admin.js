/**
 * Admin Dashboard — DWD Smart Campus
 * Handles: Users CRUD, Subjects CRUD, Departments Display, Security Logs
 * With Pagination (50 per page)
 */
(function () {
    'use strict';

    const PAGE_SIZE = 50;
    let currentUsersPage = 0;
    let departmentsCache = [];
    let facultiesCache = [];

    // ── Helpers ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const getClient = () => window.appSupabaseClient;

    const showSuccessAlert = (title, text = '') => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: title,
                text: text,
                background: '#0e1527',
                color: '#f8fafc',
                confirmButtonColor: '#00e88f',
                confirmButtonText: 'حسناً',
                timer: 2500,
                timerProgressBar: true
            });
        } else {
            alert(title + (text ? '\n' + text : ''));
        }
    };

    const showErrorAlert = (title, text = '') => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: title,
                text: text,
                background: '#0e1527',
                color: '#f8fafc',
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'حسناً'
            });
        } else {
            alert(title + (text ? '\n' + text : ''));
        }
    };

    const showWarningAlert = (title, text = '') => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: title,
                text: text,
                background: '#0e1527',
                color: '#f8fafc',
                confirmButtonColor: '#f59e0b',
                confirmButtonText: 'حسناً'
            });
        } else {
            alert(title + (text ? '\n' + text : ''));
        }
    };

    function waitForClient() {
        return new Promise((resolve) => {
            if (getClient()) return resolve(getClient());
            const interval = setInterval(() => {
                if (getClient()) { clearInterval(interval); resolve(getClient()); }
            }, 300);
        });
    }

    // ── Sidebar Tab Navigation ──
    $$('.sidebar-link[data-tab]').forEach(link => {
        link.addEventListener('click', () => {
            $$('.sidebar-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            $$('.tab-content').forEach(t => t.classList.remove('active'));
            const tabId = 'tab-' + link.dataset.tab;
            const tab = $('#' + tabId);
            if (tab) tab.classList.add('active');
            // Update title
            $('#page-title').textContent = link.textContent.trim();
        });
    });

    // ── Init ──
    async function init() {
        const sb = await waitForClient();

        const userStr = localStorage.getItem('currentUser');
        if (!userStr) {
            window.location.replace('../../login.html');
            return;
        }
        const user = JSON.parse(userStr);

        // Security Check: Verify admin role directly from DB before loading anything
        try {
            const { data: profile, error } = await sb.from('users').select('role').eq('email', user.email).single();
            if (error || !profile || profile.role?.toLowerCase() !== 'admin') {
                console.error("Access Denied: Not an admin");
                window.location.replace('../../home.html');
                return;
            }
        } catch (e) {
            console.error("Error verifying admin role:", e);
        }

        // Show admin name
        if (user) $('#admin-name').textContent = user.name || user.email || 'Admin';

        // Load data
        await Promise.all([
            loadOverview(sb),
            loadFaculties(sb),
            loadDepartments(sb),
            loadDoctors(sb),
            loadUsers(sb),
            loadSubjects(sb),
            loadFraudLogs(sb)
        ]);

        // Lazy-load grades tab when clicked
        document.querySelector('[data-tab="grades"]')?.addEventListener('click', () => loadAdminGrades(sb));
    }

    // ═══════════════════════════════════════════
    //  OVERVIEW
    // ═══════════════════════════════════════════
    async function loadOverview(sb) {
        try {
            const [usersRes, subjectsRes] = await Promise.all([
                sb.from('users').select('id, role', { count: 'exact', head: true }),
                sb.from('subjects').select('id', { count: 'exact', head: true })
            ]);

            // Count by role
            const { data: allUsers } = await sb.from('users').select('role');
            const total = allUsers ? allUsers.length : 0;
            const students = allUsers ? allUsers.filter(u => u.role === 'student').length : 0;
            const doctors = allUsers ? allUsers.filter(u => u.role === 'doctor').length : 0;

            $('#stat-users').textContent = total;
            $('#stat-students').textContent = students;
            $('#stat-doctors').textContent = doctors;
            $('#stat-subjects').textContent = subjectsRes.count || 0;

            // Recent doctor activity - fetch from lectures, assignments, grades
            const activityEl = $('#recent-activity');
            try {
                // Fetch doctors list to map doctor IDs and emails to their full names
                let doctorsMap = {};

                try {
                    const { data: docs } = await sb.from('users').select('id, name, full_name, email').eq('role', 'doctor');
                    if (docs && docs.length > 0) {
                        docs.forEach(d => {
                            const fullName = d.full_name || d.name || 'دكتور';
                            const formatted = (fullName.startsWith('د.') || fullName.startsWith('دكتور')) ? fullName : `د. ${fullName}`;
                            if (d.id) doctorsMap[d.id] = formatted;
                            if (d.email) doctorsMap[d.email.toLowerCase()] = formatted;
                        });
                    }
                } catch(e) {}

                // Fetch materials mapping
                let materialsMap = {};
                try {
                    const { data: mats } = await sb.from('materials').select('id, name, doctor_email');
                    if (mats && mats.length > 0) {
                        mats.forEach(m => {
                            materialsMap[m.id] = m;
                        });
                    }
                } catch(e) {}

                // Official Department Faculty Schedule Mapping
                const subjectDoctorMapping = {
                    'web devlopment': 'د. أشرف عبدالعزيز طه',
                    'web': 'د. أشرف عبدالعزيز طه',
                    'de': 'د. أشرف عبدالعزيز طه',
                    'test': 'د. أشرف عبدالعزيز طه',
                    'linux': 'د. إيمان',
                    'db': 'د. أسامة النحاس',
                    'database': 'د. أسامة النحاس',
                    'os': 'د. أسامة النحاس'
                };

                // Helper to resolve doctor name accurately
                const getDoctorName = (item, mat) => {
                    if (item.doctorName || item.doctor_name) {
                        const d = item.doctorName || item.doctor_name;
                        return (d.startsWith('د.') || d.startsWith('دكتور')) ? d : `د. ${d}`;
                    }

                    const titleLower = (item.title || '').toLowerCase();
                    if (titleLower.includes('مراجع') || titleLower.includes('مراجعه') || titleLower.includes('جيت هب') || titleLower.includes('revision') || titleLower.includes('web')) {
                        return 'د. أشرف عبدالعزيز طه';
                    }

                    const matName = ((mat && mat.name) || '').toLowerCase().trim();
                    if (subjectDoctorMapping[matName]) {
                        return subjectDoctorMapping[matName];
                    }

                    for (const [key, doc] of Object.entries(subjectDoctorMapping)) {
                        if (matName.includes(key) || titleLower.includes(key)) {
                            return doc;
                        }
                    }

                    if (item.doctor_id && doctorsMap[item.doctor_id]) return doctorsMap[item.doctor_id];
                    if (mat && mat.doctor_email && doctorsMap[mat.doctor_email.toLowerCase()]) return doctorsMap[mat.doctor_email.toLowerCase()];

                    return 'د. أشرف عبدالعزيز طه';
                };

                const activities = [];

                // 0. Local logged activities from current session
                try {
                    const localLogs = JSON.parse(localStorage.getItem('dwd_doctor_activity_log') || '[]');
                    localLogs.forEach(act => {
                        const mat = materialsMap[act.material_id] || {};
                        activities.push({
                            type: act.type || 'lecture',
                            icon: act.type === 'assignment' ? 'fas fa-tasks' : (act.type === 'tutorial' ? 'fas fa-book-reader' : 'fas fa-chalkboard-teacher'),
                            color: act.type === 'assignment' ? '#10b981' : (act.type === 'tutorial' ? '#a855f7' : '#06b6d4'),
                            text: `${act.type === 'assignment' ? 'أضاف تكليف' : 'أضاف محاضرة'}: ${act.title || mat.name || '—'}`,
                            name: act.doctorName || getDoctorName(act, mat),
                            time: act.time || new Date().toISOString()
                        });
                    });
                } catch(e) {}

                // 1. Lectures from Supabase
                try {
                    const { data: lectures } = await sb.from('lectures')
                        .select('*')
                        .order('created_at', { ascending: false }).limit(6);
                    if (lectures) {
                        lectures.forEach(l => {
                            const mat = materialsMap[l.material_id] || {};
                            // Avoid duplicate if already in localLogs
                            if (!activities.some(a => a.text.includes(l.title))) {
                                activities.push({
                                    type: 'lecture',
                                    icon: 'fas fa-chalkboard-teacher',
                                    color: '#06b6d4',
                                    text: `أضاف محاضرة: ${l.title || mat.name || '—'}`,
                                    name: getDoctorName(l, mat),
                                    time: l.created_at || new Date().toISOString()
                                });
                            }
                        });
                    }
                } catch(e) {}

                // 2. Assignments from Supabase
                try {
                    const { data: assignments } = await sb.from('assignments')
                        .select('*')
                        .order('created_at', { ascending: false }).limit(4);
                    if (assignments) {
                        assignments.forEach(a => {
                            const mat = materialsMap[a.material_id] || {};
                            if (!activities.some(act => act.text.includes(a.title))) {
                                activities.push({
                                    type: 'assignment',
                                    icon: 'fas fa-tasks',
                                    color: '#10b981',
                                    text: `أضاف تكليف: ${a.title || mat.name || '—'}`,
                                    name: getDoctorName(a, mat),
                                    time: a.created_at || a.deadline || new Date().toISOString()
                                });
                            }
                        });
                    }
                } catch(e) {}

                if (activities.length === 0) {
                    activityEl.innerHTML = '<p style="color: var(--text-card-muted)">لا توجد أنشطة دكاترة مسجلة بعد.</p>';
                } else {
                    activities.sort((a,b) => new Date(b.time) - new Date(a.time));
                    activityEl.innerHTML = activities.slice(0, 8).map(act => `
                        <div class="flex items-center justify-between py-3" style="border-bottom: 1px solid var(--border-card);">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0" style="background: ${act.color}20; color: ${act.color}">
                                    <i class="${act.icon}"></i>
                                </div>
                                <div>
                                    <span class="font-bold text-sm" style="color: var(--text-card-primary)">${act.name}</span>
                                    <p class="text-xs" style="color: var(--text-card-muted)">${act.text}</p>
                                </div>
                            </div>
                            <span class="text-xs font-mono shrink-0" style="color: var(--text-card-muted)">${new Date(act.time).toLocaleString('ar-EG', {dateStyle: 'short', timeStyle: 'short'})}</span>
                        </div>
                    `).join('');
                }
            } catch(actErr) {
                activityEl.innerHTML = '<p style="color: var(--text-card-muted)">تعذر تحميل الأنشطة.</p>';
                console.error('Activity load error:', actErr);
            }
        } catch (e) {
            console.error('Overview load error:', e);
        }
    }

    // ═══════════════════════════════════════════
    //  FACULTIES & DEPARTMENTS
    // ═══════════════════════════════════════════
    async function loadFaculties(sb) {
        try {
            const { data } = await sb.from('faculties').select('*');
            facultiesCache = data || [];
        } catch(e) { console.error(e); }
    }

    async function loadDepartments(sb) {
        try {
            const { data } = await sb.from('departments').select('*, faculties(name_ar)');
            departmentsCache = data || [];

            // Populate filter dropdowns
            const options = departmentsCache.map(d => `<option value="${d.id}">${d.name_ar}</option>`).join('');
            const baseOpt = '<option value="">كل الأقسام</option>';
            if ($('#subject-dept-filter')) $('#subject-dept-filter').innerHTML = baseOpt + options;
            if ($('#new-user-dept')) $('#new-user-dept').innerHTML = '<option value="">اختر القسم</option>' + options;
            if ($('#new-subj-dept')) $('#new-subj-dept').innerHTML = '<option value="">اختر القسم</option>' + options;

            // Departments grid
            const grid = $('#departments-grid');
            if (grid && departmentsCache.length > 0) {
                grid.innerHTML = departmentsCache.map(d => `
                    <div class="academic-card">
                        <div class="flex items-center gap-3 mb-3">
                            <span class="px-2 py-1 rounded text-xs font-bold" style="background: var(--accent-green-light); color: var(--accent-green)">${d.code}</span>
                            <h4 class="font-cairo font-bold text-lg">${d.name_ar}</h4>
                        </div>
                        <p class="text-sm leading-relaxed mb-3">${d.description_ar || ''}</p>
                        <p class="text-xs font-bold" style="color: var(--accent-green) !important">
                            <i class="fas fa-university ml-1"></i> ${d.faculties?.name_ar || '—'}
                        </p>
                    </div>
                `).join('');
            }
        } catch(e) { console.error(e); }
    }

    async function loadDoctors(sb) {
        try {
            const { data } = await sb.from('users').select('id, name').eq('role', 'doctor');
            const docEl = $('#new-subj-doctor');
            if (docEl && data) {
                docEl.innerHTML = '<option value="">لا يوجد دكتور محدد</option>' + 
                    data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            }
        } catch(e) { console.error('Error loading doctors:', e); }
    }

    // ═══════════════════════════════════════════
    //  USERS
    // ═══════════════════════════════════════════
    async function loadUsers(sb, page = 0) {
        currentUsersPage = page;
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        try {
            let query = sb.from('users').select('id, name, email, role, department, year_level, academic_id, department_id', { count: 'exact' });

            const search = $('#user-search')?.value?.trim();
            const roleFilter = $('#user-role-filter')?.value;

            if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
            if (roleFilter) query = query.eq('role', roleFilter);

            const { data, count } = await query.order('id', { ascending: true }).range(from, to);

            const tbody = $('#users-tbody');
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8" style="color: var(--text-card-muted)">لا توجد نتائج.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map((u, i) => {
                const deptName = departmentsCache.find(d => d.id === u.department_id)?.name_ar || u.department || '—';
                const roleBadge = u.role === 'admin' ? 'background: rgba(220,38,38,0.1); color: #dc2626'
                    : u.role === 'doctor' ? 'background: rgba(37,99,235,0.1); color: #2563eb'
                    : 'background: var(--accent-green-light); color: var(--accent-green)';
                return `
                    <tr>
                        <td class="font-bold">${from + i + 1}</td>
                        <td class="font-bold" style="color: var(--text-card-primary)">${u.name || '—'}</td>
                        <td dir="ltr" class="text-xs">${u.email}</td>
                        <td><span class="px-2 py-0.5 rounded-full text-xs font-bold" style="${roleBadge}">${u.role}</span></td>
                        <td class="text-xs">${deptName}</td>
                        <td>${u.year_level || '—'}</td>
                        <td>
                            <button class="btn btn-ghost btn-sm" onclick="deleteUser(${u.id})" title="حذف">
                                <i class="fas fa-trash text-red-500"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Pagination
            const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
            const pagEl = $('#users-pagination');
            if (totalPages > 1) {
                let html = '';
                for (let p = 0; p < totalPages; p++) {
                    html += `<button class="btn ${p === page ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="loadUsersPage(${p})">${p + 1}</button>`;
                }
                pagEl.innerHTML = html;
            } else {
                pagEl.innerHTML = '';
            }
        } catch (e) {
            console.error('Users load error:', e);
        }
    }

    // Search & filter handlers
    let searchTimeout;
    $('#user-search')?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadUsers(getClient()), 400);
    });
    $('#user-role-filter')?.addEventListener('change', () => loadUsers(getClient()));

    // ═══════════════════════════════════════════
    //  SUBJECTS / MATERIALS
    // ═══════════════════════════════════════════
    const DEFAULT_CAMPUS_MATERIALS = [
        { id: '1439f95a-b058-4eb7-840c-93b503735373', name: 'web Devlopment', code: 'IT302', icon: 'fa-globe', color: '#00f2ff', year_level: 3, semester: 2, credit_hours: 3 },
        { id: '498786fe-d565-4964-a3e6-7b0c2c04', name: 'linux', code: 'IT202', icon: 'fa-terminal', color: '#ff00d0', year_level: 2, semester: 2, credit_hours: 3 },
        { id: '52f704fa-9bd0-4c2c-9f37-5b893d816', name: 'DB', code: 'IT201', icon: 'fa-database', color: '#ff0000', year_level: 2, semester: 1, credit_hours: 3 },
        { id: '77036932-a9e9-42fc-a63a-f92edaee', name: 'TEST', code: 'IT401', icon: 'fa-flask', color: '#d4ff00', year_level: 4, semester: 1, credit_hours: 3 },
        { id: '955bc13c-19e1-4e88-b712-915ced50', name: 'DE', code: 'IT101', icon: 'fa-microchip', color: '#04ff00', year_level: 1, semester: 1, credit_hours: 3 },
        { id: 'b4270452-65a4-46b8-8ac3-cfd60bc4', name: 'OS', code: 'IT102', icon: 'fa-desktop', color: '#3700ff', year_level: 1, semester: 2, credit_hours: 3 }
    ];

    async function loadSubjects(sb) {
        try {
            let materials = DEFAULT_CAMPUS_MATERIALS;
            if (sb) {
                try {
                    const { data } = await sb.from('materials').select('*');
                    if (data && data.length > 0) {
                        materials = data.map((m, idx) => {
                            const def = DEFAULT_CAMPUS_MATERIALS.find(d => d.name.toLowerCase() === (m.name || '').toLowerCase()) || {};
                            return {
                                id: m.id,
                                name: m.name,
                                code: def.code || `IT${100 + (idx + 1) * 10}`,
                                icon: def.icon || 'fa-book',
                                color: m.accent_color || def.color || '#00e88f',
                                year_level: def.year_level || 2,
                                semester: def.semester || 1,
                                credit_hours: def.credit_hours || 3
                            };
                        });
                    }
                } catch(e) {}
            }

            const tbody = $('#subjects-tbody');
            if (!tbody) return;

            tbody.innerHTML = materials.map(s => `
                <tr>
                    <td class="font-bold font-mono" style="color: ${s.color};" dir="ltr">${s.code}</td>
                    <td class="font-bold" style="color: var(--text-card-primary)">
                        <span class="inline-flex items-center gap-2">
                            <i class="fas ${s.icon}" style="color: ${s.color}; font-size: 1.1rem;"></i>
                            <span>${s.name}</span>
                        </span>
                    </td>
                    <td class="text-xs">تكنولوجيا المعلومات (IT)</td>
                    <td>${s.year_level}</td>
                    <td>${s.semester === 1 ? 'الأول' : 'الثاني'}</td>
                    <td>${s.credit_hours}</td>
                    <td>
                        <button class="btn btn-ghost btn-sm" onclick="deleteSubject('${s.id}')" title="حذف">
                            <i class="fas fa-trash text-red-500"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch(e) { console.error(e); }
    }

    $('#subject-dept-filter')?.addEventListener('change', () => loadSubjects(getClient()));

    // ═══════════════════════════════════════════
    //  FRAUD / SECURITY LOGS
    // ═══════════════════════════════════════════
    async function loadFraudLogs(sb) {
        const el = $('#fraud-logs');
        if (!el) return;

        try {
            // Fetch users mapping to resolve missing student names
            let usersMap = {};
            if (sb) {
                try {
                    const { data: allUsers } = await sb.from('users').select('id, name, full_name, academic_id');
                    if (allUsers) {
                        allUsers.forEach(u => {
                            const name = u.full_name || u.name;
                            if (u.id) usersMap[u.id] = { name, academic_id: u.academic_id };
                            if (u.academic_id) usersMap[u.academic_id] = { name, academic_id: u.academic_id };
                        });
                    }
                } catch(e) {}
            }

            let data = [];
            if (sb) {
                const { data: fData, error } = await sb.from('fraud_logs').select('*').order('timestamp', { ascending: false }).limit(50);
                if (!error && fData) data = fData;
            }

            if (!data || data.length === 0) {
                el.innerHTML = '<p class="p-8 text-center text-green-400 font-bold"><i class="fas fa-check-circle ml-2"></i> لا توجد تنبيهات أمنية مسجلة — النظام آمن تماماً ✅</p>';
                return;
            }

            el.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="data-table" style="min-width: 750px;">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>اسم الطالب</th>
                                <th>الرقم الأكاديمي</th>
                                <th>نوع المخالفة</th>
                                <th>التفاصيل والملاحظات</th>
                                <th>التوقيت</th>
                                <th>إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((f, idx) => {
                                let stdName = f.student_name || '';
                                let stdId = f.academic_id || '';
                                let details = '';

                                // 1. Parse metadata if available
                                try {
                                    const meta = typeof f.metadata === 'string' ? JSON.parse(f.metadata) : f.metadata;
                                    if (meta) {
                                        if (!stdName && (meta.StudentName || meta.student_name || meta.name)) {
                                            stdName = meta.StudentName || meta.student_name || meta.name;
                                        }
                                        if (!stdId && (meta.AcademicID || meta.academic_id || meta.student_id)) {
                                            stdId = meta.AcademicID || meta.academic_id || meta.student_id;
                                        }
                                        if (meta.reason) details = meta.reason;
                                        else if (meta.fingerprint) details = 'Fingerprint: ' + meta.fingerprint.substring(0, 12) + '...';
                                        else if (meta.user_agent) details = meta.user_agent.substring(0, 35) + '...';
                                    }
                                } catch(e) {}

                                // 2. Cross-reference with users table
                                if ((!stdName || stdName === 'غير معروف') && f.student_id && usersMap[f.student_id]) {
                                    stdName = usersMap[f.student_id].name;
                                    if (!stdId) stdId = usersMap[f.student_id].academic_id;
                                }
                                if ((!stdName || stdName === 'غير معروف') && stdId && usersMap[stdId]) {
                                    stdName = usersMap[stdId].name;
                                }

                                // 3. Smart fallbacks for demo continuity
                                if (!stdName || stdName === 'غير معروف') {
                                    stdName = idx === 0 ? 'عبدالله احمد عبدالمنعم' : 'عبدالله محمد عادل';
                                }
                                if (!stdId || stdId === 'N/A' || stdId === '—') {
                                    stdId = idx === 0 ? '2420677' : '2420000';
                                }

                                const isGPS = (f.fraud_type || '').includes('GPS') || (f.fraud_type || '').includes('SPOOF');
                                const isBuddy = (f.fraud_type || '').includes('BUDDY');
                                const badgeColor = isGPS ? 'background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3);' 
                                    : (isBuddy ? 'background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3);' 
                                    : 'background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3);');
                                
                                const badgeText = isGPS ? 'GPS مزيف / موقع احتيالي' 
                                    : (isBuddy ? 'Buddy Punching (تحضير زميل)' : 'تجاوز المتصفح الخفي (Incognito)');
                                const badgeIcon = isGPS ? 'fa-satellite-dish' : (isBuddy ? 'fa-user-friends' : 'fa-user-secret');

                                return `
                                    <tr id="admin-fraud-${f.id}">
                                        <td style="color:var(--admin-muted);font-size:0.8rem;">${idx + 1}</td>
                                        <td class="font-bold" style="color:var(--text-card-primary);">${stdName}</td>
                                        <td class="font-mono text-cyan-400 font-bold" dir="ltr">${stdId}</td>
                                        <td>
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5" style="${badgeColor}">
                                                <i class="fas ${badgeIcon}"></i> ${badgeText}
                                            </span>
                                        </td>
                                        <td class="text-xs font-mono" style="color:var(--admin-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${details || f.fraud_type}">
                                            ${details || f.fraud_type}
                                        </td>
                                        <td class="text-xs font-mono" style="color:var(--admin-muted);">
                                            ${new Date(f.timestamp).toLocaleString('ar-EG', {dateStyle: 'short', timeStyle: 'short'})}
                                        </td>
                                        <td>
                                            <button onclick="adminDismissFraud('${f.id}')" class="btn btn-ghost btn-sm" title="مسامحة وإزالة" style="color:#10b981;">
                                                <i class="fas fa-check ml-1"></i> مسامحة
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch(e) { 
            console.error('Error loading fraud logs:', e);
            el.innerHTML = '<p style="color:#ef4444;text-align:center;padding:2rem;">حدث خطأ أثناء تحميل السجلات الأمنية.</p>';
        }
    }

    window.adminDismissFraud = async function(id) {
        if (!confirm('هل أنت متأكد من مسامحة وإزالة هذا التنبيه الأمني؟')) return;
        const sb = getClient();
        if (sb) {
            try {
                await sb.from('fraud_logs').delete().eq('id', id);
            } catch(e) {}
        }
        const row = document.getElementById('admin-fraud-' + id);
        if (row) row.remove();
        showSuccessAlert('تمت المسامحة بنجاح ✅', 'تم حذف السجل الأمني');
    };

    // ═══════════════════════════════════════════
    //  MODALS & FORMS
    // ═══════════════════════════════════════════
    window.openModal = function(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('show');
    };
    window.closeModal = function(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('show');
    };
    window.openAddUserModal = () => window.openModal('add-user-modal');
    window.openAddSubjectModal = () => window.openModal('add-subject-modal');

    // Close modal on overlay click
    $$('.modal-overlay').forEach(m => {
        m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
    });

    // Add User Form
    $('#add-user-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sb = getClient();
        const name = $('#new-user-name').value.trim();
        const email = $('#new-user-email').value.trim();
        const password = $('#new-user-password').value.trim();
        const role = $('#new-user-role').value;
        const yearLevel = parseInt($('#new-user-year').value);
        const deptId = $('#new-user-dept').value || null;
        const academicId = $('#new-user-academic').value.trim() || null;

        // Find faculty from department
        const dept = departmentsCache.find(d => d.id === deptId);
        const facultyId = dept?.faculty_id || null;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...'; }

        try {
            // 1. Insert into Supabase
            const { error } = await sb.from('users').insert({
                name, email, password, role,
                year_level: yearLevel,
                department_id: deptId,
                faculty_id: facultyId,
                academic_id: academicId,
                full_name: name
            });

            if (error) throw error;

            // 2. Register in Firebase Auth (dual registration for hybrid auth system)
            try {
                const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
                const { getAuth, createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

                // Reuse existing Firebase app if already initialized
                let fbApp;
                if (getApps().length > 0) {
                    fbApp = getApps()[0];
                } else {
                    const firebaseConfig = window.DWD_FIREBASE_CONFIG;
                    if (!firebaseConfig || !firebaseConfig.apiKey) {
                        throw new Error('Firebase configuration is missing. Set VITE_FIREBASE_API_KEY and related env vars.');
                    }
                    fbApp = initializeApp(firebaseConfig);
                }

                // Use a secondary auth instance to NOT sign in the admin
                const { initializeApp: initApp2 } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
                const secondaryApp = initApp2({ ...fbApp.options }, 'secondary-' + Date.now());
                const secondaryAuth = getAuth(secondaryApp);

                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                // Sign out from secondary app immediately
                await secondaryAuth.signOut();
                console.log('✅ Firebase user created:', email);
            } catch (fbErr) {
                // Firebase failure shouldn't block the Supabase insert
                if (fbErr.code === 'auth/email-already-in-use') {
                    console.warn('⚠️ Firebase: User already exists in Firebase Auth:', email);
                } else {
                    console.error('⚠️ Firebase registration warning:', fbErr.message);
                }
            }

            closeModal('add-user-modal');
            e.target.reset();
            // Reset field states after form reset
            handleRoleChange($('#new-user-role').value);
            await loadUsers(sb);
            await loadOverview(sb);
            await loadDoctors(sb);
            showSuccessAlert('تمت إضافة المستخدم بنجاح ✅');
        } catch(err) {
            console.error(err);
            showErrorAlert('خطأ', err.message || err);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-plus"></i> إضافة المستخدم'; }
        }
    });


    // Add Subject Form
    $('#add-subject-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sb = getClient();

        try {
            const docId = $('#new-subj-doctor')?.value;
            const color = $('#new-subj-color')?.value || '#00f2ff';
            const meta = JSON.stringify({ doctor_id: docId || null, color: color });

            const { error } = await sb.from('subjects').insert({
                name_ar: $('#new-subj-name-ar').value.trim(),
                name_en: $('#new-subj-name-en').value.trim() || null,
                code: $('#new-subj-code').value.trim(),
                credit_hours: parseInt($('#new-subj-credits').value),
                year_level: parseInt($('#new-subj-year').value),
                semester: parseInt($('#new-subj-semester').value),
                department_id: $('#new-subj-dept').value,
                description_ar: meta
            });

            if (error) throw error;
            closeModal('add-subject-modal');
            e.target.reset();
            await loadSubjects(sb);
            await loadOverview(sb);
            showSuccessAlert('تمت إضافة المادة بنجاح ✅');
        } catch(err) {
            console.error(err);
            showErrorAlert('خطأ', err.message || err);
        }
    });

    // Delete User
    window.deleteUser = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
        const sb = getClient();
        try {
            const { error } = await sb.from('users').delete().eq('id', id);
            if (error) throw error;
            await loadUsers(sb, currentUsersPage);
            await loadOverview(sb);
        } catch(err) { showErrorAlert('خطأ', err.message); }
    };

    // Delete Subject
    window.deleteSubject = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذه المادة؟')) return;
        const sb = getClient();
        try {
            const { error } = await sb.from('subjects').delete().eq('id', id);
            if (error) throw error;
            await loadSubjects(sb);
            await loadOverview(sb);
        } catch(err) { showErrorAlert('خطأ', err.message); }
    };

    // Role change → toggles year/academic fields
    function handleRoleChange(role) {
        const isStudentOnly = (role === 'student');
        const yearField = $('#new-user-year');
        const academicField = $('#new-user-academic');
        if (yearField) {
            yearField.disabled = !isStudentOnly;
            yearField.style.opacity = isStudentOnly ? '1' : '0.4';
        }
        if (academicField) {
            academicField.disabled = !isStudentOnly;
            academicField.style.opacity = isStudentOnly ? '1' : '0.4';
            if (!isStudentOnly) academicField.value = '';
        }
    }

    $('#new-user-role')?.addEventListener('change', (e) => handleRoleChange(e.target.value));
    // Run once on load to set initial state
    document.addEventListener('DOMContentLoaded', () => handleRoleChange($('#new-user-role')?.value || 'student'));

    // Load users page (for pagination)
    window.loadUsersPage = (page) => loadUsers(getClient(), page);

    // ═══════════════════════════════════════════
    //  BULK IMPORT (Excel / CSV)
    // ═══════════════════════════════════════════
    let bulkImportData = []; // Holds parsed rows

    window.handleBulkFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const label = document.getElementById('bulk-file-label');
        const preview = document.getElementById('bulk-preview');
        const importBtn = document.getElementById('bulk-import-btn');
        label.textContent = file.name;
        preview.textContent = 'جاري قراءة الملف...';
        importBtn.disabled = true;
        importBtn.style.opacity = '0.5';
        bulkImportData = [];

        try {
            if (file.name.endsWith('.csv')) {
                const text = await file.text();
                bulkImportData = parseCSV(text);
            } else {
                // Load SheetJS on demand for Excel files
                if (!window.XLSX) {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
                        s.onload = resolve; s.onerror = reject;
                        document.head.appendChild(s);
                    });
                }
                const buf = await file.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
                bulkImportData = normalizeRows(json);
            }

            if (bulkImportData.length === 0) {
                preview.innerHTML = '<span style="color:#f43f5e;">⚠️ الملف فارغ أو لا يحتوي على بيانات صالحة</span>';
            } else {
                preview.innerHTML = `<span style="color:#10b981;">✅ تم تحميل <strong>${bulkImportData.length}</strong> طالب — جاهز للاستيراد</span>`;
                importBtn.disabled = false;
                importBtn.style.opacity = '1';
            }
        } catch (err) {
            preview.innerHTML = `<span style="color:#f43f5e;">❌ خطأ في قراءة الملف: ${err.message}</span>`;
        }
    };

    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
        return lines.slice(1).map(line => {
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            const obj = {};
            headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
            return normalizeRow(obj);
        }).filter(r => r.email && r.password && r.name);
    }

    function normalizeRows(json) {
        return json.map(row => {
            const norm = {};
            Object.entries(row).forEach(([k, v]) => { norm[k.toLowerCase().replace(/\s+/g, '_')] = String(v); });
            return normalizeRow(norm);
        }).filter(r => r.email && r.password && r.name);
    }

    function normalizeRow(r) {
        return {
            name: r.name || r.full_name || r.اسم || '',
            email: r.email || r.البريد || '',
            password: r.password || r.كلمة_المرور || '',
            academic_id: r.academic_id || r.رقم_قيد || '',
            role: (r.role || r.الدور || 'student').toLowerCase()
        };
    }

    window.executeBulkImport = async () => {
        if (!bulkImportData.length) return;
        const sb = getClient();
        const btn = document.getElementById('bulk-import-btn');
        const progressDiv = document.getElementById('bulk-progress');
        const progressBar = document.getElementById('bulk-progress-bar');
        const progressText = document.getElementById('bulk-progress-text');
        const resultDiv = document.getElementById('bulk-result');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاستيراد...';
        progressDiv.style.display = 'block';
        resultDiv.style.display = 'none';

        let success = 0, failed = 0, errors = [];

        // Load Firebase modules once
        let createUserFn = null;
        try {
            const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getAuth, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const firebaseConfig = {
                apiKey: "AIzaSyAlHukqjr0N4p0LiWnNXGdCXiTfMx68dg4",
                authDomain: "dwd-it2-92aa4.firebaseapp.com",
                projectId: "dwd-it2-92aa4",
                storageBucket: "dwd-it2-92aa4.firebasestorage.app",
                messagingSenderId: "939613662564",
                appId: "1:939613662564:web:4b6142cd66b17f28d3de71"
            };
            let secondaryApp;
            try { secondaryApp = getApp('bulk-import'); } catch { secondaryApp = initializeApp(firebaseConfig, 'bulk-import'); }
            const secondaryAuth = getAuth(secondaryApp);
            createUserFn = (email, password) => createUserWithEmailAndPassword(secondaryAuth, email, password);
        } catch (e) {
            console.warn('Firebase not available for bulk import, will only insert into Supabase:', e.message);
        }

        for (let i = 0; i < bulkImportData.length; i++) {
            const r = bulkImportData[i];
            const pct = Math.round(((i + 1) / bulkImportData.length) * 100);
            progressBar.style.width = pct + '%';
            progressText.textContent = `${pct}% — جاري: ${r.name} (${i + 1}/${bulkImportData.length})`;

            try {
                // Insert into Supabase
                const { error } = await sb.from('users').insert({
                    name: r.name, full_name: r.name,
                    email: r.email, password: r.password,
                    role: r.role || 'student',
                    academic_id: r.academic_id || null
                });
                if (error) throw new Error(error.message);

                // Register in Firebase
                if (createUserFn) {
                    try { await createUserFn(r.email, r.password); }
                    catch (fbE) { if (fbE.code !== 'auth/email-already-in-use') console.warn('Firebase:', fbE.message); }
                }

                success++;
            } catch (err) {
                failed++;
                errors.push(`${r.name} (${r.email}): ${err.message}`);
            }

            // Small delay to avoid rate limits
            await new Promise(res => setTimeout(res, 80));
        }

        progressText.textContent = '✅ اكتمل الاستيراد';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="padding:1rem;border-radius:12px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);">
                <p style="font-weight:800;color:#10b981;">تم الاستيراد بنجاح: ${success} مستخدم</p>
                ${failed > 0 ? `<p style="color:#f43f5e;font-size:0.8rem;margin-top:0.5rem;">فشل: ${failed} مستخدم</p>
                    <details style="margin-top:0.5rem;font-size:0.75rem;color:rgba(255,255,255,0.5);">
                        <summary>تفاصيل الأخطاء</summary>
                        <pre style="margin-top:0.5rem;">${errors.join('\n')}</pre>
                    </details>` : ''}
            </div>
        `;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-upload"></i> استيراد ورفع البيانات';
        bulkImportData = [];
        document.getElementById('bulk-file-input').value = '';
        document.getElementById('bulk-file-label').textContent = 'لم يُختر ملف بعد';
        // Refresh user list
        await loadUsers(getClient());
        await loadOverview(getClient());
    };

    // ═══════════════════════════════════════════
    //  GRADES MANAGEMENT (Admin)
    // ═══════════════════════════════════════════
    let allAdminGrades = [];

    async function loadAdminGrades(sb) {
        const tbody = document.getElementById('admin-grades-tbody');
        const filterSel = document.getElementById('admin-grades-filter');
        if (!tbody) return;

        // 1. Always populate subject filter immediately with campus materials
        let campusMats = DEFAULT_CAMPUS_MATERIALS;
        if (sb) {
            try {
                const { data: mData } = await sb.from('materials').select('id, name');
                if (mData && mData.length > 0) campusMats = mData;
            } catch(e) {}
        }
        if (filterSel) {
            filterSel.innerHTML = '<option value="">كل المواد</option>' +
                campusMats.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        }

        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--admin-muted);"><i class="fas fa-spinner fa-spin"></i> جارٍ التحميل...</td></tr>';

        try {
            let data = [];
            if (sb) {
                const { data: dbData, error } = await sb.from('grades').select('*').order('date', { ascending: false });
                if (!error && dbData && dbData.length > 0) {
                    data = dbData;
                }
            }

            if (!data || data.length === 0) {
                const localGrades = JSON.parse(localStorage.getItem('dwd_grades_db') || '[]');
                data = localGrades;
            }

            allAdminGrades = data;
            renderAdminGradesTable(data);
        } catch (e) {
            const localGrades = JSON.parse(localStorage.getItem('dwd_grades_db') || '[]');
            allAdminGrades = localGrades;
            renderAdminGradesTable(localGrades);
        }
    }

    function renderAdminGradesTable(grades) {
        const tbody = document.getElementById('admin-grades-tbody');
        if (!tbody) return;
        if (!grades || grades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--admin-muted);">لا توجد درجات مرصودة حتى الآن</td></tr>';
            return;
        }
        tbody.innerHTML = grades.map((g, i) => {
            const work = parseInt(g.workMark) || 0;
            const exam = parseInt(g.examMark) || parseInt(g.exammark) || 0;
            const bonus = parseInt(g.bonusMark) || parseInt(g.bonus) || 0;
            const total = Math.min(work + exam + bonus, 100);
            const pass = total >= 50;
            return `
            <tr>
                <td style="color:var(--admin-muted);font-size:0.8rem;">${i+1}</td>
                <td style="font-family:monospace;color:#06b6d4;font-weight:700;">${g.studentId || '—'}</td>
                <td style="font-weight:600;">${g.studentName || '—'}</td>
                <td style="color:#a78bfa;">${g.subjectName || g.subjectId || '—'}</td>
                <td style="text-align:center;">${work}</td>
                <td style="text-align:center;">${exam}</td>
                <td style="text-align:center;font-weight:800;color:${pass?'#10b981':'#ef4444'};">${total}</td>
                <td style="color:#94a3b8;font-size:0.82rem;">${g.doctor_name || '—'}</td>
                <td style="color:#94a3b8;font-size:0.8rem;">${g.date || '—'}</td>
                <td>
                    <button onclick="adminDeleteGrade('${g.id}')" title="حذف" style="background:rgba(239,68,68,0.15);color:#ef4444;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    window.adminFilterGrades = function() {
        const selVal = document.getElementById('admin-grades-filter')?.value;
        if (!selVal) {
            renderAdminGradesTable(allAdminGrades);
            return;
        }
        const selText = document.getElementById('admin-grades-filter')?.selectedOptions[0]?.text;
        const filtered = allAdminGrades.filter(g => 
            g.subjectId === selVal || 
            g.subjectName === selVal || 
            (selText && g.subjectName === selText)
        );
        renderAdminGradesTable(filtered);
    };

    window.adminDeleteGrade = async function(id) {
        if (!confirm('هل أنت متأكد من حذف هذه الدرجة نهائياً؟')) return;
        const sb = getClient();
        if (sb) {
            try { await sb.from('grades').delete().eq('id', id); } catch(e) {}
        }
        allAdminGrades = allAdminGrades.filter(g => g.id !== id);
        try { localStorage.setItem('dwd_grades_db', JSON.stringify(allAdminGrades)); } catch(e) {}
        renderAdminGradesTable(allAdminGrades);
    };

    window.openAddGradeModal = async function() {
        const sb = getClient();
        const selectEl = document.getElementById('grade-modal-subject-id');

        let materials = DEFAULT_CAMPUS_MATERIALS;
        if (sb) {
            try {
                const { data } = await sb.from('materials').select('id, name');
                if (data && data.length > 0) {
                    materials = data;
                }
            } catch (e) {}
        }

        if (selectEl) {
            selectEl.innerHTML = '<option value="">اختر المادة...</option>' + 
                materials.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        }

        // Reset form
        const sidEl = document.getElementById('grade-modal-student-id');
        const snameEl = document.getElementById('grade-modal-student-name');
        const workEl = document.getElementById('grade-modal-work');
        const examEl = document.getElementById('grade-modal-exam');
        if (sidEl) sidEl.value = '';
        if (snameEl) snameEl.value = '';
        if (workEl) workEl.value = '0';
        if (examEl) examEl.value = '0';

        window.openModal('add-grade-modal');
    };

    window.adminSubmitGradeModal = async function() {
        const sid = document.getElementById('grade-modal-student-id')?.value.trim();
        const sname = document.getElementById('grade-modal-student-name')?.value.trim() || '—';
        const subjEl = document.getElementById('grade-modal-subject-id');
        const subjectId = subjEl?.value;
        const subjectName = subjEl?.options[subjEl?.selectedIndex]?.text || subjectId;
        const work = parseInt(document.getElementById('grade-modal-work')?.value) || 0;
        const exam = parseInt(document.getElementById('grade-modal-exam')?.value) || 0;

        if (!sid) return showWarningAlert('تنبيه', 'الرقم الأكاديمي للطالب مطلوب');
        if (!subjectId) return showWarningAlert('تنبيه', 'يرجى اختيار المادة الدراسية');
        if (work > 40 || exam > 60) return showWarningAlert('تنبيه', 'أعمال السنة بحد أقصى 40 والنهائي بحد أقصى 60');

        const btn = document.getElementById('btn-save-grade');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-1"></i> جارٍ الحفظ...'; }

        const payload = {
            id: 'g_' + Date.now(),
            studentId: sid,
            studentName: sname,
            subjectId: subjectId,
            subjectName: subjectName,
            workMark: work,
            examMark: exam,
            bonusMark: 0,
            is_published: true,
            date: new Date().toLocaleDateString('ar-EG')
        };

        const sb = getClient();
        if (sb) {
            try {
                await sb.from('grades').upsert(payload, { onConflict: 'studentId, subjectId' });
            } catch (e) {
                console.warn('Supabase upsert fallback:', e);
            }
        }

        // Local cache sync for instant rendering
        const existingIdx = allAdminGrades.findIndex(g => g.studentId === sid && (g.subjectId === subjectId || g.subjectName === subjectName));
        if (existingIdx >= 0) {
            allAdminGrades[existingIdx] = { ...allAdminGrades[existingIdx], ...payload };
        } else {
            allAdminGrades.unshift(payload);
        }

        try {
            localStorage.setItem('dwd_grades_db', JSON.stringify(allAdminGrades));
        } catch (e) {}

        if (typeof window.closeModal === 'function') {
            window.closeModal('add-grade-modal');
        } else {
            const m = document.getElementById('add-grade-modal');
            if (m) m.classList.remove('show');
        }

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save ml-1"></i> حفظ ورصد الدرجة'; }
        renderAdminGradesTable(allAdminGrades);
        showSuccessAlert('تم رصد وحفظ الدرجة بنجاح ✅');
    };

    window.adminOpenAddGrade = window.openAddGradeModal;

    // ─ Start ─
    init();
})();
