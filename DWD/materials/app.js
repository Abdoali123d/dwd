
// --- SCRIPT SECTION: All Logic Consolidated ---
document.addEventListener("DOMContentLoaded", () => {
  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeHTML(html) {
    if (html == null) return '';
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
  // DOM Elements
  const homeView = document.getElementById("home-view");
  const lectureView = document.getElementById("lecture-view");
  const quizView = document.getElementById("quiz-view");
  const subjectsGrid = document.getElementById("subjects-grid");
  const lectureTitle = document.getElementById("lecture-title");
  const lectureContentContainer =
    document.getElementById("lecture-content");
  const pdfLinkContainer = document.getElementById("pdf-link-container");
  const startQuizBtn = document.getElementById("start-quiz-btn");
  const quizContainer = document.getElementById("quiz-container");
  const themeSwitcherBtn = document.getElementById("theme-switcher-btn");
  const themeOptions = document.getElementById("theme-options");

  // --- Sidebar Logic ---
  const burgerBtn = document.getElementById("burger-btn");
  const sidebar = document.getElementById("material-sidebar");
  const closeSidebarBtn = document.getElementById("close-sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");

  function toggleSidebar() {
    // Toggle Tailwind classes directly
    if (sidebar.classList.contains("right-[-300px]")) {
      sidebar.classList.remove("right-[-300px]");
      sidebar.classList.add("right-0");
      sidebarOverlay.classList.remove("hidden");
    } else {
      sidebar.classList.add("right-[-300px]");
      sidebar.classList.remove("right-0");
      sidebarOverlay.classList.add("hidden");
    }
  }

  if (burgerBtn) burgerBtn.addEventListener("click", toggleSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", toggleSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", toggleSidebar);


  // [جديد] زر العودة للمحاضرات
  const backToLecturesBtn = document.getElementById("back-to-lectures-btn");
  if (backToLecturesBtn) {
    backToLecturesBtn.addEventListener('click', () => {
      if (currentSubject) {
        showLectureList(currentSubject);
      }
    });
  }

  // Language/Direction related elements
  const langToggleBtn = document.getElementById("lang-toggle-btn");
  const lectureLangToggleBtn = document.getElementById(
    "lecture-lang-toggle-btn"
  );
  const mainTitle = document.getElementById("main-title");
  const mainSubtitle = document.getElementById("main-subtitle");
  const backToHomeText = document.getElementById("back-to-home-text");
  const backArrowIcon = document.getElementById("back-arrow-icon");
  const quizBackText = document.getElementById("quiz-back-text");
  const backToLecturesText = document.getElementById("back-to-lectures-text");

  let currentSubject = null;
  let currentLecture = null;
  let currentLectureLanguage = "ar"; // Initial language for content inside lecture
  let quizState = {}; // To hold current quiz progress

  // --- THEME SWITCHER LOGIC ---
  themeSwitcherBtn.addEventListener("click", () => {
    themeOptions.classList.toggle("hidden");
  });

  document.querySelectorAll("#theme-options button").forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;
      document.body.className =
        theme === "default" ? "min-h-screen" : `${theme} min-h-screen`;
      themeOptions.classList.add("hidden");
    });
  });

  // --- UI LANGUAGE & DIRECTION LOGIC ---

  /** Updates static UI text and direction based on current document language */
  function updateUITexts(lang, dir) {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;

    if (lang === "ar") {
      langToggleBtn.textContent = "English Mode";
      mainTitle.textContent = "IT Learning Hub 🚀";
      // REVIEW: Potential XSS - Check this line manually
      mainSubtitle.innerHTML = "المنصة الشاملة لطلاب الفرقة الثانية - قسم تكنولوجيا المعلومات.<br> كل ما تحتاجه للنجاح والتفوق في مكان واحد.";
      quizBackText.textContent = "العودة للصفحة الرئيسية";
      if (backToLecturesText) backToLecturesText.textContent = "العودة للمحاضرات";


      // Update back button in lecture view
      backToHomeText.textContent = "العودة للصفحة الرئيسية";
      lectureView.setAttribute("dir", "rtl");
      backArrowIcon.classList.add("rtl:mr-2", "rtl:ml-0");
      backArrowIcon.classList.remove("ltr:mr-2", "ltr:ml-0");
      backArrowIcon.style.transform = "rotate(0deg)"; // RTL default
    } else {
      langToggleBtn.textContent = "الوضع العربي";
      mainTitle.textContent = "IT Learning Hub 🚀";
      // REVIEW: Potential XSS - Check this line manually
      mainSubtitle.innerHTML = "The Comprehensive Platform for Second Year IT Students.<br> Everything you need to succeed in one place.";
      quizBackText.textContent = "Back to Home";
      if (backToLecturesText) backToLecturesText.textContent = "Back to Lectures";

      // Update back button in lecture view
      backToHomeText.textContent = "Back to Home";
      lectureView.setAttribute("dir", "ltr");
      backArrowIcon.classList.remove("rtl:mr-2", "rtl:ml-0");
      backArrowIcon.classList.add("ltr:mr-2", "ltr:ml-0");
      backArrowIcon.style.transform = "rotate(180deg)"; // LTR default
    }
  }

  /** Toggles the main application language */
  window.toggleLanguage = function (currentLang) {
    const newLang = currentLang === "ar" ? "en" : "ar";
    const newDir = newLang === "ar" ? "rtl" : "ltr";
    updateUITexts(newLang, newDir);

    // [تعديل] تحديث العرض إذا كنا في صفحة قائمة المحاضرات أو صفحة المحاضرة
    if (!lectureView.classList.contains("hidden")) {
      if (currentLecture) {
        // We are on a lecture content page
        displayLectureContent(currentLecture, newLang);
      } else if (currentSubject) {
        // We are on a lecture list page
        showLectureList(currentSubject);
      }
    }
    if (!quizView.classList.contains("hidden")) {
      goHome();
    }
  };

  // --- INITIALIZATION ---
  async function init() {
    subjectsGrid.textContent = "";
    try {
      // [FIX] Use absolute path to prevent 404s on trailing slash mismatch
      const response = await fetch('/DWD/materials/subjects-manifest.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const subjectsData = await response.json();

      // 1. Create Subject Cards on the main page
      subjectsData.forEach((subject, index) => {
        const card = document.createElement("div");
        // Enhanced Card Styling
        card.className = `glass-card rounded-3xl p-8 text-center hover:!bg-[var(--primary-color)] hover:text-black group hover:-translate-y-4 transform transition-all duration-300 cursor-pointer shadow-xl border-b-4 ${subject.color} flex flex-col items-center justify-between min-h-[300px]`;
        card.style.animation = `fadeInUp ${0.5 + index * 0.1}s ease forwards`;

      // Richer Content
      card.innerHTML = `
        <div class="mb-6 transform transition-transform duration-300 group-hover:scale-125 group-hover:rotate-6">
          <span class="text-7xl drop-shadow-lg">${escapeHTML(subject.icon)}</span>
        </div>
        <div class="space-y-3">
           <h3 class="text-3xl font-extrabold tracking-tight">${escapeHTML(subject.title)}</h3>
           <p class="text-lg opacity-80 group-hover:text-black group-hover:opacity-100 transition-opacity font-medium">
             ${escapeHTML(subject.description || "استكشف محتوى المادة")}
           </p>
        </div>
        <div class="mt-6 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0 duration-300">
           <span class="bg-black text-white px-6 py-2 rounded-full font-bold shadow-lg">
              ابدأ المذاكرة <i class="fa-solid fa-arrow-left mr-2"></i>
           </span>
        </div>
      `;

        // --- [تعديل] ربط البطاقة بوظيفة عرض قائمة المحاضرات ---
        card.addEventListener("click", () => {
          currentSubject = subject; // Set the subject context
          showLectureList(subject); // Call the new list function
        });
        subjectsGrid.appendChild(card);
      });
    } catch (error) {
      console.error("Failed to load subjects manifest:", error);
      // REVIEW: Potential XSS - Ensure variable is safe
      subjectsGrid.innerHTML = `<div class="col-span-full text-center p-12 glass-card rounded-xl border border-red-500/50">
        <i class="fa-solid fa-triangle-exclamation text-6xl text-red-500 mb-4"></i>
        <h3 class="text-2xl font-bold">عفواً، حدث خطأ في تحميل المواد</h3>
        <p class="mt-2 text-lg opacity-80">يرجى المحاولة مرة أخرى لاحقاً.</p>
      </div>`;
    }
    updateUITexts(
      document.documentElement.lang,
      document.documentElement.dir
    );
  }

  // --- VIEW MANAGEMENT ---

  /** [تعديل] Switches back to the Home View and resets lecture view */
  window.goHome = function () {
    homeView.classList.remove("hidden");
    lectureView.classList.add("hidden");
    quizView.classList.add("hidden");

    // Reset lecture view state
    lectureContentContainer.textContent = ""; // Clear content
    pdfLinkContainer.textContent = "";
    startQuizBtn.style.display = 'none';
    lectureLangToggleBtn.style.display = 'none';

    if (backToLecturesBtn) backToLecturesBtn.style.display = 'none';

    quizContainer.textContent = ""; // Clear quiz
    currentSubject = null;
    currentLecture = null;

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- [جديد] دالة لعرض قائمة المحاضرات ---
  /** Displays a list of lectures for the selected subject */
  function showLectureList(subject) {
    homeView.classList.add("hidden");
    quizView.classList.add("hidden");
    lectureView.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const lang = document.documentElement.lang;
    currentLecture = null; // Clear current lecture

    if (backToLecturesBtn) backToLecturesBtn.style.display = 'none';

    // Set the main title to the subject's title
    lectureTitle.textContent = subject.title;

    // Hide elements related to a single lecture
    pdfLinkContainer.textContent = "";
    startQuizBtn.style.display = 'none';
    lectureLangToggleBtn.style.display = 'none';
    document.getElementById("lecture-actions-container").classList.add("hidden");


    // Generate the list of lectures
    const lectureListHtml = `
      <div class="space-y-4">
        ${subject.lectures.map((lecture, index) => `
          <button
            onclick="openLectureById('${escapeHTML(lecture.id)}')"
            class="lecture-list-button group"
          >
            <div class="flex items-center gap-4">
               <span class="w-12 h-12 flex items-center justify-center rounded-full bg-[var(--bg-color)] text-[var(--primary-color)] font-bold text-xl border border-[var(--border-color)]">
                 ${escapeHTML(lecture.number || (index + 1).toString())}
               </span>
               <span class="lecture-title-text text-lg">${escapeHTML(lecture.title)}</span>
            </div>
            <i class="fa-solid fa-chevron-left text-[var(--primary-color)] opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:-translate-x-2"></i>
          </button>
        `).join("")}
      </div>
    `;

    // REVIEW: Potential XSS - Ensure variable is safe
    lectureContentContainer.innerHTML = lectureListHtml;
  }
  window.showLectureList = showLectureList; // Make accessible globally

  // --- [جديد] دالة لفتح محاضرة معينة بالـ ID ---
  /** Finds a lecture by ID and displays it */
  window.openLectureById = function (lectureId) {
    const lecture = currentSubject.lectures.find(l => l.id === lectureId);
    if (lecture) {
      currentLecture = lecture;
      currentLectureLanguage = "ar"; // Default to Arabic
      displayLectureContent(lecture, "ar");
    } else {
      console.error("Lecture not found:", lectureId);
      // REVIEW: Potential XSS - Check this line manually
      lectureContentContainer.innerHTML = `<p class="text-red-400 font-bold p-4">Error: Lecture not found.</p>`;
    }
  }

  /** Helper to resolve paths relative to the project root */
  function resolveContentPath(path) {
    if (!path) return path;
    path = path.trim();

    // Handle ../../ used in JSONs (relative to json-lecture-files/subject/)
    if (path.startsWith('../../')) {
      return '/DWD/materials/' + path.substring(6); // Remove ../../ and prepend absolute
    }
    // Handle ./ used in JSONs
    if (path.startsWith('./')) {
      return '/DWD/materials/' + path.substring(2);
    }
    // Handle direct materials-lectures reference if it lacks ./
    if (path.startsWith('materials-lectures/')) {
      return '/DWD/materials/' + path;
    }

    return path;
  }

  // --- [تعديل] اسم الدالة وتعديل بسيط ---
  /** Displays the content for a specific lecture */
  async function displayLectureContent(lecture, contentLang) {
    homeView.classList.add("hidden");
    quizView.classList.add("hidden");
    lectureView.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (backToLecturesBtn) backToLecturesBtn.style.display = 'flex';

    currentLectureLanguage = contentLang;
    lectureTitle.textContent = lecture.title;

    // [UPDATED] Dynamically set direction and alignment based on language
    lectureContentContainer.setAttribute("dir", contentLang === "ar" ? "rtl" : "ltr");
    lectureContentContainer.style.textAlign = contentLang === "ar" ? "right" : "left";
    lectureTitle.setAttribute("dir", contentLang === "ar" ? "rtl" : "ltr");
    lectureTitle.style.textAlign = contentLang === "ar" ? "right" : "left";

    // Show loading state
    // REVIEW: Potential XSS - Check this line manually
    lectureContentContainer.innerHTML = `<div class="text-center p-12"><i class="fa-solid fa-spinner fa-spin text-4xl text-[var(--primary-color)]"></i></div>`;


    // Fetch detailed content from JSON file
    try {
      // [FIX] Ensure absolute path for dataFile to handle trailing slash issues
      let dataPath = lecture.dataFile;
      if (dataPath.startsWith('./')) {
        dataPath = '/DWD/materials/' + dataPath.substring(2);
      }

      console.log('Fetching lecture data from:', dataPath); // Debug log
      const response = await fetch(dataPath);
      if (!response.ok) throw new Error("Failed to load lecture details");
      const lectureDetails = await response.json();

      // Merge details with manifest info
      const fullLecture = { ...lecture, ...lectureDetails };

      // Update currentLecture with full details so toggle language works
      currentLecture = fullLecture;

      // Determine which summary to show
      const summary =
        contentLang === "ar"
          ? fullLecture.arabicSummary
          : fullLecture.englishSummary;

      // [Updated] Add prose-invert if dark mode (default) but ensure directionality classes
      lectureContentContainer.innerHTML = `
          <div class="prose prose-lg prose-invert max-w-none leading-relaxed ${contentLang === 'ar' ? 'text-right' : 'text-left'}">
             ${sanitizeHTML(summary)}
          </div>
        `;

      // Show lecture-specific buttons
      lectureLangToggleBtn.style.display = 'block';
      if (contentLang === "ar") {
        lectureLangToggleBtn.textContent = "View in English";
      } else {
        lectureLangToggleBtn.textContent = "عرض باللغة العربية";
      }

      document.getElementById("lecture-actions-container").classList.remove("hidden");

      // --- [NEW] MEDIA SECTIONS (AUDIO & VIDEO) ---

      // 1. Audio Section
      if (fullLecture.audio && fullLecture.audio.trim() !== "") {
        const audioSrc = resolveContentPath(fullLecture.audio);
        const audioTitle = contentLang === "ar" ? "ملخص صوتي للمحاضرة" : "Audio Summary";
        const audioHtml = `
          <div class="glass-card p-6 rounded-2xl mb-8 border-r-4 border-[var(--primary-color)] animation-container" dir="${contentLang === 'ar' ? 'rtl' : 'ltr'}">
            <h4 class="text-xl font-bold mb-4 flex items-center gap-3 text-[var(--primary-color)]">
              <i class="fa-solid fa-headphones-simple text-2xl"></i>
              ${escapeHTML(audioTitle)}
            </h4>
            <div class="bg-[var(--bg-color)] rounded-xl p-2 shadow-inner">
               <audio controls class="w-full custom-audio-player">
                 <source src="${escapeHTML(audioSrc)}" type="audio/mpeg">
                 Your browser does not support the audio element.
               </audio>
            </div>
          </div>
        `;
        lectureContentContainer.innerHTML += audioHtml;
      }

      // 2. Video Section
      if (fullLecture.video && fullLecture.video.trim() !== "") {
        const videoTitle = contentLang === "ar" ? "شرح فيديو" : "Video Tutorial";

        // Helper to get YouTube Embed URL
        const getYoutubeEmbed = (url) => {
          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
          const match = url.match(regExp);
          return (match && match[2].length === 11) ? match[2] : null;
        };

        const ytId = getYoutubeEmbed(fullLecture.video);
        let videoContent;

        if (ytId) {
          videoContent = `
                <div class="aspect-w-16 aspect-h-9 w-full">
                    <iframe src="https://www.youtube.com/embed/${ytId}" 
                        title="YouTube video player" frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen class="rounded-xl shadow-lg w-full h-[300px] md:h-[400px]">
                    </iframe>
                </div>`;
        } else {
          // Fallback for direct video files if any, or just link
          videoContent = `<a href="${fullLecture.video}" target="_blank" class="text-blue-500 underline break-all">${fullLecture.video}</a>`;
        }

        const videoHtml = `
          <div class="glass-card p-6 rounded-2xl mb-8 border-r-4 border-red-500 animation-container" dir="${contentLang === 'ar' ? 'rtl' : 'ltr'}">
            <h4 class="text-xl font-bold mb-4 flex items-center gap-3 text-red-500">
              <i class="fa-brands fa-youtube text-2xl"></i>
              ${escapeHTML(videoTitle)}
            </h4>
            ${videoContent}
          </div>
        `;
        lectureContentContainer.innerHTML += videoHtml;
      }

      // --- END MEDIA SECTIONS ---

      // --- DEFENSIVE CODING FOR PDF LINK ---
      const pdfText =
        contentLang === "ar"
          ? "تحميل ملف المحاضرة (PDF)"
          : "Download Lecture PDF";

      // Check if fullLecture has pdfFile and it's not empty
      if (fullLecture.pdfFile && fullLecture.pdfFile.trim() !== "") {
        const pdfSrc = resolveContentPath(fullLecture.pdfFile);
        pdfLinkContainer.innerHTML = `
                <a href="${escapeHTML(pdfSrc)}" target="_blank" class="glass-card px-8 py-4 rounded-xl flex items-center gap-4 hover:border-[var(--primary-color)] transition-all group w-full md:w-auto justify-center" dir="${contentLang === 'ar' ? 'rtl' : 'ltr'}">
                    <i class="fa-solid fa-file-pdf text-4xl text-red-500 group-hover:scale-110 transition-transform"></i> 
                    <div class="text-left">
                        <span class="block text-sm opacity-70">PDF Document</span>
                        <span class="font-bold text-[var(--primary-color)] group-hover:underline text-lg">${escapeHTML(pdfText)}</span>
                    </div>
                </a>`;
      } else {
        const missingText = contentLang === "ar" ? "قريباً..." : "Coming Soon...";
        pdfLinkContainer.innerHTML = `
                <div class="glass-card px-8 py-4 rounded-xl flex items-center gap-4 opacity-50 cursor-not-allowed w-full md:w-auto justify-center" dir="${contentLang === 'ar' ? 'rtl' : 'ltr'}">
                    <i class="fa-solid fa-file-circle-xmark text-4xl text-gray-500"></i> 
                    <div class="text-left">
                        <span class="block text-sm opacity-70">PDF Document</span>
                        <span class="font-bold text-gray-400 text-lg">${escapeHTML(missingText)}</span>
                    </div>
                </div>`;
      }

      // Quiz Button Logic
      // [FIX] Support both 'quiz' (C++) and 'questions' (Web) keys and ensure it's an array
      let quizData = fullLecture.quiz || fullLecture.questions;

      if (quizData && Array.isArray(quizData) && quizData.length > 0) {
        startQuizBtn.style.display = 'inline-flex';
        const quizBtnText =
          contentLang === "ar"
            ? "ابدأ الاختبار القصير"
            : "Start Quick Quiz";
        document.getElementById("quiz-btn-text").textContent = quizBtnText;

        // Bind quiz start
        startQuizBtn.onclick = () => startQuiz(quizData, fullLecture.title);
      } else {
        startQuizBtn.style.display = 'none';
      }

    } catch (err) {
      console.error(err);
      lectureContentContainer.innerHTML = `
            <div class="text-center p-8 border border-red-500/30 rounded-xl bg-red-500/10">
                <p class="text-red-400 font-bold mb-2">Error loading content.</p>
                <p class="text-sm opacity-70">Please verify the file path: ${escapeHTML(lecture.dataFile)}</p>
            </div>`;
    }
  };

  /** [تعديل] Toggles the content language within the Lecture View */
  window.switchLectureLanguage = function () {
    const newLang = currentLectureLanguage === "ar" ? "en" : "ar";
    // [تعديل] استدعاء الدالة الجديدة باستخدام المحاضرة الحالية
    displayLectureContent(currentLecture, newLang);
  };

  // --- QUIZ LOGIC (Rich Design Update - State Based) ---

  /** Switches to Quiz View and starts the quiz */
  window.startQuiz = function (quizData, lectureTitle) {
    if (!quizData || quizData.length === 0) {
      alert("No quiz data available.");
      return;
    }

    lectureView.classList.add("hidden");
    quizView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById("quiz-header").textContent =
      document.documentElement.lang === "ar"
        ? `اختبار: ${lectureTitle}`
        : `Quiz: ${lectureTitle}`;

    quizState = {
      data: quizData,
      answers: {}, // Stores index -> { selected: string, isCorrect: boolean }
      currentIndex: 0,
    };

    displayQuestion(0, quizData);
  };

  /** Displays a single quiz question */
  function displayQuestion(index, quizData) {
    const lang = document.documentElement.lang;

    // Calculate Score dynamically
    const answers = quizState.answers || {};
    const currentScore = Object.values(answers).filter(a => a.isCorrect).length;

    if (index >= quizData.length) {
      showResults(currentScore, quizData.length);
      return;
    }

    const q = quizData[index];
    const questionNumber = index + 1;
    const totalQuestions = quizData.length;

    // Shuffle options (ONLY if not already shuffled? For consistency, better to shuffle once. 
    // But simplicity: simple shuffle deterministically or just shuffle every render? 
    // If we re-render after answering, options might jump.
    // Fix: ideally store order. For now, random shuffle might be annoying on re-render.
    // Let's use a seeded fake shuffle or just accept it might jump on first answer (but subsequent re-visits should ideally be stable).
    // Better: Store shuffled options in q object or state.
    if (!q.shuffledOptions) {
      const opts = [...q.options];
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      q.shuffledOptions = opts;
    }
    const options = q.shuffledOptions;


    const existingAnswer = quizState.answers[index];
    const isAnswered = !!existingAnswer;

    // REVIEW: Potential XSS - Ensure variable is safe
    quizContainer.innerHTML = `
        <div class="w-full max-w-2xl animation-container p-2">
            <div class="flex justify-between items-center mb-8 text-sm font-bold tracking-wider opacity-60">
                 <span>QUESTION ${questionNumber} / ${totalQuestions}</span>
                 <span>${lang === 'ar' ? 'النتيجة' : 'SCORE'}: ${currentScore}</span>
            </div>

            <p class="text-2xl md:text-3xl font-extrabold mb-10 leading-relaxed text-center">${sanitizeHTML(q.question)}</p>
            
            <div id="options-container" class="space-y-4 mb-8">
                ${options.map((option) => {
      // Determine classes based on state
      let classes = "option-btn glass-card w-full text-left p-6 rounded-2xl text-lg font-semibold transition-all duration-200 border border-transparent flex justify-between items-center group ";
      let indicatorClass = "w-3 h-3 rounded-full bg-[var(--primary-color)] opacity-0 group-hover:opacity-100 transition-opacity";
      let disabledAttr = isAnswered ? "disabled" : "";

      if (isAnswered) {
        classes += " opacity-50 cursor-not-allowed";
        if (option === q.correctAnswer.trim()) {
          classes += " !bg-green-500/20 !border-green-500 !opacity-100";
          indicatorClass = "w-3 h-3 rounded-full bg-green-500 opacity-100";
        } else if (option === existingAnswer.selected && !existingAnswer.isCorrect) {
          classes += " !bg-red-500/20 !border-red-500 !opacity-100";
          indicatorClass = "w-3 h-3 rounded-full bg-red-500 opacity-100";
        }
      } else {
        classes += " hover:scale-[1.02] hover:shadow-xl hover:border-[var(--primary-color)]";
      }

      return `
                    <button data-answer="${escapeHTML(option)}" ${disabledAttr} class="${classes}">
                        <span>${sanitizeHTML(option)}</span>
                        <div class="w-6 h-6 rounded-full border-2 border-[var(--border-color)] group-hover:border-[var(--primary-color)] flex items-center justify-center transition-colors">
                           <div class="${indicatorClass}"></div>
                        </div>
                    </button>
                    `;
    }).join("")}
            </div>

            <!-- Feedback Area -->
            <div id="feedback-area" class="${isAnswered ? '' : 'hidden'} mt-8 p-6 rounded-2xl bg-black/30 border border-[var(--border-color)] text-center animation-container">
                <div id="hint-icon" class="text-5xl mb-4">
                    ${isAnswered ? (existingAnswer.isCorrect ? '🎉' : '❌') : ''}
                </div>
                <p id="hint-text" class="text-xl font-bold mb-2">
                     ${isAnswered ? (existingAnswer.isCorrect ?
        `<span class="text-green-400">Correct! Great job.</span>` :
        `<span class="text-red-400">Oops! Wrong answer.</span>`) : ''}
                </p>
                <p id="correct-answer-text" class="text-lg opacity-80 mb-6 ${isAnswered && !existingAnswer.isCorrect ? '' : 'hidden'}">
                    ${lang === "ar" ? "الإجابة الصحيحة" : "Correct Answer"}: ${sanitizeHTML(q.correctAnswer)}
                </p>
                
                ${(function () {
        if (isAnswered && !existingAnswer.isCorrect) {
          const hintContent = lang === "ar" ? q.hint : (q.englishHint || q.hint);
          if (hintContent) {
            return `<span class="text-sm font-normal opacity-70 mt-2 block">💡 ${sanitizeHTML(hintContent)}</span>`;
          }
        }
        return '';
      })()}

                <div class="flex gap-4 justify-center mt-6">
                    <button id="prev-question-btn" class="cta-button bg-gray-600 hover:bg-gray-500" style="display: ${index === 0 ? 'none' : 'flex'};">
                        ${lang === "ar" ? "السابق" : "Previous"}
                    </button>
                    <button id="next-question-btn" class="cta-button flex-1 justify-center">
                        ${lang === "ar" ? (index === totalQuestions - 1 ? "إنهاء الاختبار" : "السؤال التالي") : (index === totalQuestions - 1 ? "Finish Quiz" : "Next Question")}
                    </button>
                </div>
            </div>
             <!-- Navigation for Unanswered (if enabled to skip?) - For now, must answer to proceed? 
                  Or show Prev button even if not answered? 
                  Let's show Prev button always if index > 0, appended outside feedback if feedback hidden.
             -->
             ${!isAnswered && index > 0 ? `
                 <div class="flex justify-start mt-4">
                     <button id="prev-btn-standalone" class="cta-button bg-gray-600 hover:bg-gray-500 py-2 px-6 text-sm">
                         ${lang === "ar" ? "السابق" : "Previous"}
                     </button>
                 </div>
             ` : ''}
        </div>
    `;

    // event listeners
    const optionButtons = quizContainer.querySelectorAll(".option-btn");
    const nextButton = document.getElementById("next-question-btn");
    const prevButton = document.getElementById("prev-question-btn");
    const prevButtonStandalone = document.getElementById("prev-btn-standalone");

    // Handle Option Click
    optionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (quizState.answers[index]) return; // Already answered

        const selectedAnswer = btn.dataset.answer.trim();
        const correctAnswer = q.correctAnswer.trim();
        const isCorrect = selectedAnswer === correctAnswer;

        // Save State
        quizState.answers[index] = { selected: selectedAnswer, isCorrect };

        // Re-render to show feedback
        displayQuestion(index, quizData);
      });
    });

    // Next / Finish
    if (nextButton) {
      nextButton.onclick = () => {
        displayQuestion(index + 1, quizData);
      };
    }

    // Prev
    const handlePrev = () => {
      displayQuestion(index - 1, quizData);
    };

    if (prevButton) prevButton.onclick = handlePrev;
    if (prevButtonStandalone) prevButtonStandalone.onclick = handlePrev;
  }

  /** Displays the final quiz results */
  function showResults(score, total) {
    const lang = document.documentElement.lang;
    const incorrectAnswers = total - score;
    const percentage = total > 0 ? ((score / total) * 100).toFixed(0) : 0;
    const quizData = quizState.data;

    // Message Logic
    let title, message, colorClass;
    if (percentage >= 90) {
      title = "Legendary! 🏆";
      message = "You are a master of this subject!";
      colorClass = "text-[var(--primary-color)]";
    } else if (percentage >= 70) {
      title = "Great Job! 👏";
      message = "You have a solid understanding.";
      colorClass = "text-green-400";
    } else {
      title = "Keep Practicing 📚";
      message = "Review the lecture and try again.";
      colorClass = "text-yellow-400";
    }

    // REVIEW: Potential XSS - Ensure variable is safe
    quizContainer.innerHTML = `
        <div class="w-full max-w-3xl text-center animation-container">
            <div class="mb-10">
                <h3 class="text-5xl font-extrabold mb-4 ${colorClass}">${title}</h3>
                <p class="text-xl opacity-80">${message}</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div class="glass-card p-8 rounded-3xl flex flex-col items-center">
                    <span class="text-5xl font-bold text-[var(--success-color)] mb-2">${score}</span>
                    <span class="opacity-60 uppercase tracking-widest text-xs font-bold">Correct</span>
                </div>
                <div class="glass-card p-8 rounded-3xl flex flex-col items-center">
                    <span class="text-5xl font-bold text-[var(--error-color)] mb-2">${incorrectAnswers}</span>
                    <span class="opacity-60 uppercase tracking-widest text-xs font-bold">Wrong</span>
                </div>
                <div class="glass-card p-8 rounded-3xl flex flex-col items-center">
                    <span class="text-5xl font-bold text-[var(--primary-color)] mb-2">${percentage}%</span>
                    <span class="opacity-60 uppercase tracking-widest text-xs font-bold">Score</span>
                </div>
            </div>
            
            <button onclick='startQuiz(${JSON.stringify(quizData)}, "${escapeHTML(currentLecture.title)}")' 
                class="cta-button">
                <i class="fa-solid fa-rotate-right"></i>
                <span>${lang === "ar" ? "إعادة الاختبار" : "Retake Quiz"}</span>
            </button>
        </div>
    `;
  }

  // Start
  init();
});
