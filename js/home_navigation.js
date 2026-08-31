// --- التحكم في التوجيه بناءً على صلاحيات المستخدم (دكتور أو طالب) ---
// --- Role-Based Navigation (Secure) ---
async function handleScheduleClick(event) {
    event.preventDefault();
    let user;
    try {
        user = JSON.parse(localStorage.getItem("currentUser"));
    } catch (e) {
        user = null;
    }

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    // 1. Check Role securely via Supabase if online
    if (navigator.onLine && window.appSupabaseClient) {
        try {
            const { data: profile } = await window.appSupabaseClient
                .from('users')
                .select('role')
                .eq('email', user.email)
                .single();
            if (profile) {
                user.role = profile.role;
                localStorage.setItem("currentUser", JSON.stringify(user));
            }
        } catch (e) {
            console.warn("Failed to verify role securely before redirect", e);
        }
    }

    // Determine current path depth
    const pathStr = window.location.pathname;
    const subFolders = ['materials', 'schedule', 'downloads', 'exams', 'profile', 'about', 'communication', 'attendance', 'news', 'training-weeks', 'Ai-Nano'];
    const isSubPage = subFolders.some(folder => pathStr.toLowerCase().split('/').includes(folder));
    const prefix = isSubPage ? "../../" : "./";

    // Redirect based on resolved role
    const userRole = (user.role || '').toLowerCase();
    if (userRole === 'admin') {
        window.location.href = prefix + 'DWD/schedule/admin.html';
    } else if (userRole === 'doctor' || userRole === 'professor') {
        window.location.href = prefix + 'DWD/schedule/professor.html';
    } else {
        window.location.href = prefix + 'DWD/schedule/index.html';
    }
}

// Attach the listener when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const scheduleCard = document.getElementById('schedule-card');
    if (scheduleCard) {
        // Remove existing listeners if possible (cloning) to prevent duplicates
        const newCard = scheduleCard.cloneNode(true);
        scheduleCard.parentNode.replaceChild(newCard, scheduleCard);

        // Crucial fix: The clone operation removes the card from the IntersectionObserver tracking
        // in home.html, so we manually ensure it is visible by adding the class.
        newCard.classList.add('is-revealed');

        newCard.addEventListener('click', handleScheduleClick);
    }
});
