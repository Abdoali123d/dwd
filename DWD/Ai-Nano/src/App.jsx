import React, { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Removed for security - using backend now
import { knowledgeData } from "./knowledgeData";
import {
  Brain,
  MessageSquare,
  FileText,
  CheckCircle,
  AlertCircle,
  Send,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  BarChart3,
  Cpu,
  Menu,
  X,
  Sparkles,
  Video,
  Download,
  Paperclip,
  Save,
  Globe,
  Code,
  Database,
  Layers,
  Terminal,
  Server,
  User,
  Trash2,
  History,
  ChevronDown,
  Key,
  PlusCircle,
  Palette,
  ShieldCheck,
  Mic,
  MicOff,
  File,
  FileType2,
} from "lucide-react";
import Swal from 'sweetalert2';

/**
 * منصة الدراسة المدعومة بالذكاء الاصطناعي - نانو AI 🚀
 * التحديثات:
 * - تعدد الموديلات تلقائياً: 2.0-flash → 1.5-flash-8b → 1.5-flash → 1.5-pro
 * - إزالة الاعتماد على الخادم المحلي (Serverless Architecture).
 * - الاتصال بالبيكند /api/gemini الذي يختار أفضل موديل تلقائياً.
 */

// --- Helper Functions ---
const stripHtml = (html) => {
  if (!html) return "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  🔥 NANO AI — Backend Only (مفاتيح آمنة في Vercel)            ║
// ║  gemini-2.5-flash + gemini-2.5-flash-lite (tested 2026-02-25) ║
// ╚══════════════════════════════════════════════════════════════════╝
const NANO_SYSTEM = `أنت "نانو" (NANO) — المساعد الذكي لفريق DWD في جامعة برج العرب التكنولوجية 🤖📚
أنت تتحدث مع طلاب تكنولوجيا المعلومات. تساعدهم في 6 مواد: Linux, OS, SQL, C++, Web Dev, Digital Logic.
اشرح بالعربي (لهجة مصرية)، اكتب المصطلحات التقنية بالإنجليزي.
استخدم emojis 🚀🔥💡 وbullet points وكن حماسيًا ومختصرًا.
لو سألك مين إنت: أنا نانو من فريق DWD! 🤖
لو حد بعتلك كود -> راجعه واشرح الأخطاء بوضوح.`;

// ── استدعاء Backend فقط (المفاتيح في Vercel env vars) ──
const callGemini = async (prompt, model = "gemini-2.5-flash", fileData = null) => {
  const cleanPrompt = (prompt || '').substring(0, 3000);

  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: cleanPrompt, model, fileData }), // نمرر الموديل والملف للبيكنج
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error || `خطأ ${res.status}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error); // Handle our custom graceful 200 OK errors
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
    throw new Error('رد فارغ من الـ AI');
  } catch (err) {
    console.error('[NANO]', err.message);
    throw new Error(`⚠️ نانو مشغول حالياً — جرب تاني بعد شوية 🔄`);
  }
};


// --- قاعدة بيانات الأسئلة المحددة لكل محاضرة ---
// الأسئلة دي بتظهر للمستخدم بشكل تلقائي عشان تساعده في المذاكرة
const specificQuestionsDB = {
  linux: {
    1: [
      {
        en: "What is an Operating System and what are its main layers?",
        ar: "ما هو نظام التشغيل وما هي طبقاته الرئيسية؟",
      },
      {
        en: "Explain the role of the Kernel in Linux.",
        ar: "اشرح دور النواة (Kernel) في نظام لينكس.",
      },
      {
        en: "List the main components of the Linux system.",
        ar: "عدد المكونات الرئيسية لنظام لينكس.",
      },
      {
        en: "Why is Linux considered secure and stable?",
        ar: "لماذا يعتبر لينكس نظاماً آمناً ومستقراً؟",
      },
      {
        en: "What does 'Open Source' mean in the context of Linux?",
        ar: "ماذا تعني 'مفتوح المصدر' في سياق لينكس؟",
      },
    ],
    2: [
      {
        en: "Describe the Linux desktop environment components.",
        ar: "صف مكونات بيئة سطح المكتب في لينكس.",
      },
      {
        en: "What is the difference between the Root user and a Normal user?",
        ar: "ما الفرق بين المستخدم الجذر (Root) والمستخدم العادي؟",
      },
      {
        en: "How do you switch to the root user in the terminal?",
        ar: "كيف تنتقل إلى المستخدم الجذر في الطرفية؟",
      },
      {
        en: "Explain the purpose of the 'sudo' command.",
        ar: "اشرح الغرض من الأمر 'sudo'.",
      },
      {
        en: "How can you identify the current user in the CLI?",
        ar: "كيف يمكنك معرفة المستخدم الحالي في واجهة سطر الأوامر؟",
      },
    ],
    3: [
      {
        en: "Compare GUI and CLI. What are the advantages of CLI?",
        ar: "قارن بين الواجهة الرسومية (GUI) وسطر الأوامر (CLI). ما هي مميزات CLI؟",
      },
      { en: "What is the Terminal?", ar: "ما هي الطرفية (Terminal)؟" },
      {
        en: "Explain the 'pwd' and 'ls' commands.",
        ar: "اشرح الأمرين 'pwd' و 'ls'.",
      },
      {
        en: "How do you create a new directory using the command line?",
        ar: "كيف تنشئ مجلداً جديداً باستخدام سطر الأوامر؟",
      },
      {
        en: "What is the function of the 'man' command?",
        ar: "ما هي وظيفة الأمر 'man'؟",
      },
    ],
    4: [
      {
        en: "How do you create a new empty file in Linux?",
        ar: "كيف تنشئ ملفاً فارغاً جديداً في لينكس؟",
      },
      {
        en: "Explain the difference between 'cat', 'more', and 'less'.",
        ar: "اشرح الفرق بين الأوامر 'cat' و 'more' و 'less'.",
      },
      {
        en: "How can you search for a specific text inside a file?",
        ar: "كيف يمكنك البحث عن نص معين داخل ملف؟",
      },
      {
        en: "What command is used to move or rename files?",
        ar: "ما هو الأمر المستخدم لنقل أو إعادة تسمية الملفات؟",
      },
      {
        en: "Explain the usage of 'head' and 'tail' commands.",
        ar: "اشرح استخدام الأمرين 'head' و 'tail'.",
      },
    ],
    5: [
      {
        en: "What is the command to add a new user to the system?",
        ar: "ما هو الأمر لإضافة مستخدم جديد للنظام؟",
      },
      {
        en: "How do you change a user's password?",
        ar: "كيف تقوم بتغيير كلمة مرور المستخدم؟",
      },
      {
        en: "Explain the content of the '/etc/passwd' file.",
        ar: "اشرح محتوى الملف '/etc/passwd'.",
      },
      {
        en: "How do you add a user to a specific group?",
        ar: "كيف تضيف مستخدماً إلى مجموعة معينة؟",
      },
      {
        en: "What command is used to delete a group?",
        ar: "ما هو الأمر المستخدم لحذف مجموعة؟",
      },
    ],
  },
  os: {
    1: [
      {
        en: "Define Operating System and list its three main goals.",
        ar: "عرف نظام التشغيل واذكر أهدافه الثلاثة الرئيسية.",
      },
      {
        en: "Explain the computer system structure (Four Components).",
        ar: "اشرح هيكل نظام الكمبيوتر (المكونات الأربعة).",
      },
      {
        en: "What is the difference between User Mode and Kernel Mode?",
        ar: "ما الفرق بين وضع المستخدم (User Mode) ووضع النواة (Kernel Mode)؟",
      },
      {
        en: "Explain the role of the OS as a Resource Allocator.",
        ar: "اشرح دور نظام التشغيل كمخصص للموارد.",
      },
      {
        en: "Describe the storage device hierarchy.",
        ar: "صف هرمية أجهزة التخزين.",
      },
    ],
    2: [
      {
        en: "What is the Bootstrap program and where is it stored?",
        ar: "ما هو برنامج الإقلاع (Bootstrap) وأين يتم تخزينه؟",
      },
      {
        en: "Explain the concept of Interrupts in an OS.",
        ar: "اشرح مفهوم المقاطعات (Interrupts) في نظام التشغيل.",
      },
      {
        en: "What is the difference between a Trap and an Interrupt?",
        ar: "ما الفرق بين الفخ (Trap) والمقاطعة (Interrupt)؟",
      },
      {
        en: "Describe the role of the Interrupt Vector.",
        ar: "صف دور متجه المقاطعة (Interrupt Vector).",
      },
      {
        en: "How does the CPU handle multiple I/O devices concurrently?",
        ar: "كيف تتعامل وحدة المعالجة المركزية مع أجهزة إدخال/إخراج متعددة بشكل متزامن؟",
      },
    ],
    3: [
      {
        en: "Differentiate between Synchronous and Asynchronous I/O.",
        ar: "فرق بين الإدخال/الإخراج المتزامن وغير المتزامن.",
      },
      {
        en: "What is Caching and why is it important?",
        ar: "ما هو التخزين المؤقت (Caching) ولماذا هو مهم؟",
      },
      {
        en: "Explain the concept of Direct Memory Access (DMA).",
        ar: "اشرح مفهوم الوصول المباشر للذاكرة (DMA).",
      },
      {
        en: "Compare Main Memory (RAM) and Secondary Storage.",
        ar: "قارن بين الذاكرة الرئيسية (RAM) والتخزين الثانوي.",
      },
      {
        en: "What is the device controller?",
        ar: "ما هو متحكم الجهاز (Device Controller)؟",
      },
    ],
    4: [
      {
        en: "Explain the difference between Single-processor and Multiprocessor systems.",
        ar: "اشرح الفرق بين الأنظمة أحادية المعالج ومتعددة المعالجات.",
      },
      {
        en: "What is Multiprogramming and how does it improve CPU utilization?",
        ar: "ما هي البرمجة المتعددة (Multiprogramming) وكيف تحسن استغلال المعالج؟",
      },
      {
        en: "Define Time Sharing (Multitasking).",
        ar: "عرف مشاركة الوقت (Time Sharing).",
      },
      {
        en: "What are Clustered Systems?",
        ar: "ما هي الأنظمة العنقودية (Clustered Systems)؟",
      },
      {
        en: "Explain the difference between Symmetric and Asymmetric multiprocessing.",
        ar: "اشرح الفرق بين المعالجة المتعددة المتماثلة وغير المتماثلة.",
      },
    ],
    5: [
      {
        en: "List five services provided by the Operating System to the user.",
        ar: "اذكر خمس خدمات يقدمها نظام التشغيل للمستخدم.",
      },
      {
        en: "What are System Calls?",
        ar: "ما هي استدعاءات النظام (System Calls)؟",
      },
      {
        en: "Explain the relationship between APIs and System Calls.",
        ar: "اشرح العلاقة بين واجهات برمجة التطبيقات (APIs) واستدعاءات النظام.",
      },
      {
        en: "Describe the Layered approach in OS design.",
        ar: "صف النهج الطبقي (Layered approach) في تصميم نظام التشغيل.",
      },
      {
        en: "What is a Microkernel?",
        ar: "ما هي النواة المصغرة (Microkernel)؟",
      },
    ],
  },
  database: {
    1: [
      {
        en: "What is a Database and what are its main components?",
        ar: "ما هي قاعدة البيانات وما هي مكوناتها الرئيسية؟",
      },
      {
        en: "Define DBMS and give examples.",
        ar: "عرف نظام إدارة قواعد البيانات (DBMS) واذكر أمثلة.",
      },
      {
        en: "What is a Primary Key?",
        ar: "ما هو المفتاح الأساسي (Primary Key)؟",
      },
      {
        en: "Explain the difference between Data and Information.",
        ar: "اشرح الفرق بين البيانات والمعلومات.",
      },
      {
        en: "What is a Record (Row) and a Field (Column)?",
        ar: "ما هو السجل (الصف) والحقل (العمود)؟",
      },
    ],
    2: [
      {
        en: "Compare Simple Databases and Enterprise Databases.",
        ar: "قارن بين قواعد البيانات البسيطة وقواعد بيانات المؤسسات.",
      },
      {
        en: "List the types of relationships in a database.",
        ar: "عدد أنواع العلاقات في قاعدة البيانات.",
      },
      {
        en: "What is a 1:M relationship? Give an example.",
        ar: "ما هي علاقة واحد لكثير (1:M)؟ اعط مثالاً.",
      },
      {
        en: "Explain the purpose of the Design View in MS Access.",
        ar: "اشرح الغرض من عرض التصميم (Design View) في MS Access.",
      },
      {
        en: "What is the Lookup Wizard used for?",
        ar: "فيما يستخدم معالج البحث (Lookup Wizard)؟",
      },
    ],
    3: [
      {
        en: "How do you implement a 1:M relationship between two tables?",
        ar: "كيف تنفذ علاقة 1:M بين جدولين؟",
      },
      {
        en: "What is a Foreign Key?",
        ar: "ما هو المفتاح الأجنبي (Foreign Key)؟",
      },
      {
        en: "Explain the concept of Referential Integrity.",
        ar: "اشرح مفهوم التكامل المرجعي (Referential Integrity).",
      },
      {
        en: "Give an example of a 1:1 relationship.",
        ar: "اعط مثالاً على علاقة واحد لواحد (1:1).",
      },
      {
        en: "Why is the Primary Key important in relationships?",
        ar: "لماذا يعتبر المفتاح الأساسي مهماً في العلاقات؟",
      },
    ],
    4: [
      {
        en: "How do you handle a Many-to-Many (M:N) relationship?",
        ar: "كيف تتعامل مع علاقة كثير لكثير (M:N)؟",
      },
      {
        en: "What is a Junction Table?",
        ar: "ما هو الجدول الوسيط (Junction Table)؟",
      },
      {
        en: "Explain Cascade Update and Cascade Delete.",
        ar: "اشرح التحديث المتتالي (Cascade Update) والحذف المتتالي (Cascade Delete).",
      },
      {
        en: "What is a Composite Primary Key?",
        ar: "ما هو المفتاح الأساسي المركب؟",
      },
      {
        en: "Why can't M:N relationships be implemented directly?",
        ar: "لماذا لا يمكن تنفيذ علاقات M:N بشكل مباشر؟",
      },
    ],
    5: [
      {
        en: "What is SQL and what does it stand for?",
        ar: "ما هي SQL وماذا يعني الاختصار؟",
      },
      {
        en: "Explain the difference between DDL and DML.",
        ar: "اشرح الفرق بين DDL و DML.",
      },
      {
        en: "List three SQL constraints and explain them.",
        ar: "اذكر ثلاثة قيود SQL واشرحها.",
      },
      {
        en: "What is the purpose of the SELECT statement?",
        ar: "ما هو الغرض من جملة SELECT؟",
      },
      {
        en: "Write a SQL command to create a simple table.",
        ar: "اكتب أمر SQL لإنشاء جدول بسيط.",
      },
    ],
  },
  cpp: {
    1: [
      {
        en: "Explain the basic structure of a C++ program.",
        ar: "اشرح الهيكل الأساسي لبرنامج C++.",
      },
      {
        en: "What are variables and how are they declared?",
        ar: "ما هي المتغيرات وكيف يتم تعريفها؟",
      },
      {
        en: "List basic data types in C++.",
        ar: "عدد أنواع البيانات الأساسية في C++.",
      },
      {
        en: "What is the purpose of '#include <iostream>'?",
        ar: "ما هو الغرض من '#include <iostream>'؟",
      },
      {
        en: "How do you print text to the console in C++?",
        ar: "كيف تطبع نصاً على الشاشة في C++؟",
      },
    ],
    2: [
      {
        en: "How do you take user input in C++?",
        ar: "كيف تستقبل مدخلات من المستخدم في C++؟",
      },
      {
        en: "Explain the Modulus operator (%) with an example.",
        ar: "اشرح معامل باقي القسمة (%) مع مثال.",
      },
      {
        en: "What is the difference between integer and float division?",
        ar: "ما الفرق بين القسمة الصحيحة وقسمة الأعداد العشرية؟",
      },
      {
        en: "How can you check if a number is even or odd?",
        ar: "كيف تتحقق مما إذا كان الرقم زوجياً أم فردياً؟",
      },
      {
        en: "Explain operator precedence in C++.",
        ar: "اشرح أولوية المعاملات في C++.",
      },
    ],
    3: [
      {
        en: "Differentiate between Prefix (++x) and Postfix (x++) increment.",
        ar: "فرق بين الزيادة القبلية (++x) والزيادة البعدية (x++).",
      },
      {
        en: "List the Logical Operators in C++.",
        ar: "عدد المعاملات المنطقية في C++.",
      },
      { en: "What are Comparison Operators?", ar: "ما هي معاملات المقارنة؟" },
      {
        en: "Explain the result of (True && False).",
        ar: "اشرح نتيجة (True && False).",
      },
      {
        en: "How does the NOT (!) operator work?",
        ar: "كيف يعمل معامل النفي (!)؟",
      },
    ],
    4: [
      {
        en: "Explain the syntax of the 'if...else' statement.",
        ar: "اشرح صيغة جملة 'if...else'.",
      },
      {
        en: "What is the difference between 'while' and 'do...while' loops?",
        ar: "ما الفرق بين حلقتي 'while' و 'do...while'؟",
      },
      { en: "How does a 'for' loop work?", ar: "كيف تعمل حلقة 'for'؟" },
      {
        en: "Write a loop to print numbers from 1 to 10.",
        ar: "اكتب حلقة لطباعة الأرقام من 1 إلى 10.",
      },
      { en: "What is an infinite loop?", ar: "ما هي الحلقة اللانهائية؟" },
    ],
    5: [
      {
        en: "What is an Array? How is it declared?",
        ar: "ما هي المصفوفة (Array)؟ وكيف يتم تعريفها؟",
      },
      {
        en: "Explain how to access array elements.",
        ar: "اشرح كيفية الوصول لعناصر المصفوفة.",
      },
      {
        en: "What is the difference between 'break' and 'continue'?",
        ar: "ما الفرق بين 'break' و 'continue'؟",
      },
      {
        en: "How do you iterate over an array using a loop?",
        ar: "كيف تمر على عناصر المصفوفة باستخدام حلقة؟",
      },
      {
        en: "Explain zero-based indexing.",
        ar: "اشرح الفهرسة التي تبدأ من الصفر (Zero-based indexing).",
      },
    ],
  },
  web: {
    1: [
      {
        en: "Differentiate between Front-end and Back-end development.",
        ar: "فرق بين تطوير الواجهة الأمامية (Front-end) والواجهة الخلفية (Back-end).",
      },
      {
        en: "What are the roles of HTML, CSS, and JavaScript?",
        ar: "ما هي أدوار HTML و CSS و JavaScript؟",
      },
      { en: "List some common HTML tags.", ar: "اذكر بعض وسوم HTML الشائعة." },
      {
        en: "What tools do you need for web development?",
        ar: "ما الأدوات التي تحتاجها لتطوير الويب؟",
      },
      {
        en: "Explain the basic structure of an HTML document.",
        ar: "اشرح الهيكل الأساسي لمستند HTML.",
      },
    ],
    2: [
      {
        en: "What are Semantic Elements in HTML5?",
        ar: "ما هي العناصر الدلالية (Semantic Elements) في HTML5؟",
      },
      {
        en: "Explain the difference between 'div' and 'span'.",
        ar: "اشرح الفرق بين 'div' و 'span'.",
      },
      {
        en: "What is the CSS Box Model?",
        ar: "ما هو نموذج الصندوق (Box Model) في CSS؟",
      },
      {
        en: "List three ways to include CSS in HTML.",
        ar: "اذكر ثلاث طرق لتضمين CSS في HTML.",
      },
      { en: "What are CSS Selectors?", ar: "ما هي محددات CSS (Selectors)؟" },
    ],
    3: [
      {
        en: "Explain the structure of an HTML Form.",
        ar: "اشرح هيكل نموذج HTML (Form).",
      },
      {
        en: "List different types of input fields.",
        ar: "عدد أنواع حقول الإدخال المختلفة.",
      },
      {
        en: "What is the purpose of the 'name' attribute in inputs?",
        ar: "ما هو الغرض من الخاصية 'name' في حقول الإدخال؟",
      },
      {
        en: "Explain Padding, Border, and Margin.",
        ar: "اشرح الحشو (Padding) والحدود (Border) والهامش (Margin).",
      },
      {
        en: "How do you create a dropdown list in HTML?",
        ar: "كيف تنشئ قائمة منسدلة في HTML؟",
      },
    ],
    4: [
      {
        en: "Explain the 'display' property values: block, inline, inline-block.",
        ar: "اشرح قيم الخاصية 'display': block, inline, inline-block.",
      },
      {
        en: "What is the difference between 'display: none' and 'visibility: hidden'?",
        ar: "ما الفرق بين 'display: none' و 'visibility: hidden'؟",
      },
      {
        en: "Explain CSS Combinators (Descendant, Child, Sibling).",
        ar: "اشرح محددات الدمج في CSS (Descendant, Child, Sibling).",
      },
      { en: "What is Opacity?", ar: "ما هي الشفافية (Opacity)؟" },
      {
        en: "How do you center a block element horizontally?",
        ar: "كيف تقوم بتوسيط عنصر كتلي (Block) أفقياً؟",
      },
    ],
    5: [
      {
        en: "What is a UI Framework? Give an example.",
        ar: "ما هو إطار عمل واجهة المستخدم (UI Framework)؟ اعط مثالاً.",
      },
      {
        en: "Explain the Bootstrap Grid System.",
        ar: "اشرح نظام الشبكة (Grid System) في Bootstrap.",
      },
      {
        en: "How do you include Bootstrap in your project?",
        ar: "كيف تضمن Bootstrap في مشروعك؟",
      },
      {
        en: "What are Bootstrap utility classes?",
        ar: "ما هي كلاسات الأدوات (Utility Classes) في Bootstrap؟",
      },
      {
        en: "Explain the concept of Responsive Design.",
        ar: "اشرح مفهوم التصميم المتجاوب (Responsive Design).",
      },
    ],
  },
  digital: {
    1: [
      {
        en: "Difference between Analog and Digital signals.",
        ar: "الفرق بين الإشارات التناظرية والرقمية.",
      },
      {
        en: "Convert decimal number 10 to Binary.",
        ar: "حول الرقم العشري 10 إلى ثنائي.",
      },
      { en: "List common Number Systems.", ar: "عدد أنظمة العد الشائعة." },
      {
        en: "What are Logic Levels?",
        ar: "ما هي مستويات المنطق (Logic Levels)؟",
      },
      {
        en: "Why do computers use the Binary system?",
        ar: "لماذا تستخدم أجهزة الكمبيوتر النظام الثنائي؟",
      },
    ],
    2: [
      {
        en: "Explain the operation of AND, OR, and NOT gates.",
        ar: "اشرح عمل بوابات AND و OR و NOT.",
      },
      {
        en: "What are Universal Gates?",
        ar: "ما هي البوابات الشاملة (Universal Gates)؟",
      },
      { en: "State De Morgan's Laws.", ar: "اذكر قوانين دي مورجان." },
      {
        en: "Explain the Commutative and Associative laws.",
        ar: "اشرح القوانين التبادلية والتجميعية.",
      },
      { en: "Draw the symbol for an XOR gate.", ar: "ارسم رمز بوابة XOR." },
    ],
    3: [
      { en: "What is a Truth Table?", ar: "ما هو جدول الحقيقة (Truth Table)؟" },
      {
        en: "How many rows are in a truth table for 3 inputs?",
        ar: "كم عدد الصفوف في جدول الحقيقة لـ 3 مدخلات؟",
      },
      {
        en: "Explain the concept of Duality.",
        ar: "اشرح مفهوم الازدواجية (Duality).",
      },
      {
        en: "How do you derive a boolean expression from a truth table?",
        ar: "كيف تستنتج تعبيراً بوليانياً من جدول الحقيقة؟",
      },
      {
        en: "What is Reverse Engineering in logic circuits?",
        ar: "ما هي الهندسة العكسية في الدوائر المنطقية؟",
      },
    ],
    4: [
      {
        en: "Define Minterms and Maxterms.",
        ar: "عرف الحدود الصغرى (Minterms) والحدود الكبرى (Maxterms).",
      },
      {
        en: "Explain Sum of Products (SOP).",
        ar: "اشرح مجموع المضروبات (SOP).",
      },
      {
        en: "Explain Product of Sums (POS).",
        ar: "اشرح مضروب المجموعات (POS).",
      },
      {
        en: "What is the Canonical Form?",
        ar: "ما هي الصيغة القانونية (Canonical Form)؟",
      },
      {
        en: "Convert a simple expression to SOP.",
        ar: "حول تعبيراً بسيطاً إلى SOP.",
      },
    ],
    5: [
      {
        en: "What are Karnaugh Maps (K-Maps) used for?",
        ar: "فيما تستخدم خرائط كارنوف (K-Maps)؟",
      },
      {
        en: "Explain how to group cells in a K-Map.",
        ar: "اشرح كيفية تجميع الخلايا في خريطة كارنوف.",
      },
      {
        en: "What is a 'Don't Care' condition?",
        ar: "ما هي حالة 'لا يهم' (Don't Care)؟",
      },
      {
        en: "Simplify a boolean expression using K-Map.",
        ar: "بسط تعبيراً بوليانياً باستخدام خريطة كارنوف.",
      },
      {
        en: "How does K-Map relate to Gray Code?",
        ar: "كيف ترتبط خريطة كارنوف بشفرة جراي (Gray Code)؟",
      },
    ],
  },
};

const getSpecificQuestions = (subjectId, lectureId) => {
  const generic = [
    {
      en: "Summarize the key topics discussed in this lecture.",
      ar: "لخص الموضوعات الرئيسية التي تمت مناقشتها في هذه المحاضرة.",
    },
    {
      en: "Explain the most important concept introduced in this session.",
      ar: "اشرح أهم مفهوم تم تقديمه في هذه الجلسة.",
    },
    {
      en: "How can the knowledge from this lecture be applied practically?",
      ar: "كيف يمكن تطبيق المعرفة المكتسبة من هذه المحاضرة عملياً؟",
    },
    {
      en: "Define the technical terms mentioned in the lecture content.",
      ar: "عرف المصطلحات التقنية المذكورة في محتوى المحاضرة.",
    },
    {
      en: "What are the main takeaways from this lecture?",
      ar: "ما هي النقاط الرئيسية المستفادة من هذه المحاضرة؟",
    },
  ];
  return specificQuestionsDB[subjectId]?.[lectureId] || generic;
};



// --- مكون خلفية النقاط المتحركة (Digital World - soon.html style) ---
const ParticleBackground = ({ theme, enabled = true }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let particlesArray = [];

    // ألوان بناءً على الثيم
    const isWhiteTheme = theme === 'white';
    const particleColor = isWhiteTheme ? '#1e3a8a' : '#00f2ff';
    const lineColorBase = isWhiteTheme ? '30, 58, 138' : '0, 242, 255';

    const initCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      constructor(x, y, directionX, directionY, size) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = particleColor;
        ctx.fill();
      }
      update() {
        if (this.x > canvas.width || this.x < 0)
          this.directionX = -this.directionX;
        if (this.y > canvas.height || this.y < 0)
          this.directionY = -this.directionY;
        this.x += this.directionX;
        this.y += this.directionY;
        this.draw();
      }
    }

    function init() {
      particlesArray = [];
      // كثافة النقاط من soon.html
      let numberOfParticles = (canvas.height * canvas.width) / 9000;
      for (let i = 0; i < numberOfParticles; i++) {
        let size = (Math.random() * 2) + 1;
        let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
        let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
        let directionX = (Math.random() * 2) - 1;
        let directionY = (Math.random() * 2) - 1;
        particlesArray.push(new Particle(x, y, directionX, directionY, size));
      }
    }

    function connect() {
      for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
          let distance =
            ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x)) +
            ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
          // نفس منطق الاتصال من soon.html
          if (distance < (canvas.width / 7) * (canvas.height / 7)) {
            let opacityValue = 1 - (distance / 20000);
            ctx.strokeStyle = `rgba(${lineColorBase},${opacityValue})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
            ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
            ctx.stroke();
          }
        }
      }
    }

    let animationId;
    function animate() {
      if (!enabled) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesArray.forEach((p) => p.update());
      connect();
      animationId = requestAnimationFrame(animate);
    }

    initCanvas();
    init();
    animate();
    window.addEventListener("resize", () => {
      initCanvas();
      init();
    });
    return () => cancelAnimationFrame(animationId);
  }, [theme, enabled]); // إعادة التهيئة عند تغيير الثيم أو وضع الأنميشن

  const bgColor = theme === 'white' ? 'bg-slate-100' : theme === 'black' ? 'bg-black' : 'bg-[#050505]';
  return (
    <canvas id="nano-bg" ref={canvasRef} className={`fixed inset-0 pointer-events-none ${bgColor}`} style={{ zIndex: 0 }} />
  );
};

// --- الشريط الجانبي (Sidebar) ---
const Sidebar = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  userData,
  onFeedLectures,
  subjectsData,
  focusedSubject,
  setFocusedSubject,
}) => {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setIsOpen(false)}
      />
      <div
        className={`fixed md:sticky top-0 right-0 h-screen w-72 bg-slate-950 border-l border-slate-800/80 text-white p-6 flex flex-col z-50 transition-transform duration-300 ease-in-out overflow-y-auto overflow-x-hidden ${isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
          }`}
      >
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
            <Cpu size={28} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter">Nano</h1>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
              Team DWD
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {/* --- التركيز على مادة --- */}
          <div className="px-2 pb-4">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 mr-2">التركيز على مادة 🎯</p>
            <div className="relative group/focus">
              <select
                value={focusedSubject || ""}
                onChange={(e) => setFocusedSubject(e.target.value || null)}
                className="w-full appearance-none bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-xs font-bold py-3 px-4 pr-10 rounded-xl border border-white/5 transition-all outline-none cursor-pointer"
              >
                <option value="">🚀 الوضع العام (مساعد نانو)</option>
                {subjectsData?.map(s => (
                  <option key={s.id} value={s.title}>{s.title}</option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover/focus:text-blue-400 transition-colors">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {[
            { id: "dashboard", label: "لوحة التحكم", icon: BarChart3 },
            { id: "quiz", label: "الامتحانات الذكية", icon: Brain },
            { id: "agent", label: "المساعد الشخصي", icon: MessageSquare },
            { id: "history", label: "سجل المحادثات", icon: History },
            { id: "materials", label: "المكتبة الشاملة", icon: BookOpen },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 font-bold text-sm ${activeTab === item.id
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-900/20 translate-x-[-5px]"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                }`}
            >
              <item.icon size={22} />
              <span>{item.label}</span>
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-white/5">
            <button
              onClick={() => {
                setIsOpen(false);
                onFeedLectures();
              }}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 text-slate-300 hover:bg-blue-600 hover:text-white transition-all font-bold text-sm border border-white/5"
            >
              <ShieldCheck size={22} className="text-blue-400" />
              <span>تغذية المحاضرات 🔒</span>
            </button>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800/50">
          <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-inner flex-shrink-0">
              <User size={18} className="text-white" />
            </div>
            <div className="overflow-hidden text-right">
              <p className="text-sm font-bold truncate text-white">
                {userData.name || "زائر"}
              </p>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                {userData.email || "تسجيل دخول مطلوب"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// --- قسم الامتحانات المتطور ---
const QuizSection = ({ subjectsData, userData, theme, selectedModel }) => {
  const isWhite = theme === 'white';
  const [viewState, setViewState] = useState("subjects"); // subjects -> lectures -> question -> result
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // نطق الترحيب بصوت فتاة
    const speakGreeting = () => {
      const msg = new SpeechSynthesisUtterance();
      const userName = userData.name || "";
      msg.text = userName
        ? `مرحبا يا ${userName}، انا مساعدتك نانو الذكية. انا هنا لمساعدتك في المذاكرة بطريقة تفاعلية، اسألني في اي شيء يخص مواد الجامعة.`
        : `مرحبا، انا نانو مساعدتك الذكية. انا هنا لمساعدتك في المذاكرة بطريقة تفاعلية، اسألني في اي شيء يخص مواد الجامعة.`;
      msg.lang = 'ar-SA';
      msg.rate = 0.9;

      // محاولة اختيار صوت فتاة
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('laila'));
      if (femaleVoice) msg.voice = femaleVoice;

      window.speechSynthesis.speak(msg);
    };

    // ننتظر قليلاً عشان الفويسات تحمل في بعض المتصفحات
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = speakGreeting;
    } else {
      speakGreeting();
    }
  }, []);

  const handleSubjectSelect = (sub) => {
    setSelectedSubject(sub);
    setViewState("lectures");
  };

  const handleLectureSelect = (lec) => {
    setSelectedLecture(lec);
    setCurrentQuestionIndex(0);
    setAnswer("");
    setResult(null);
    setShowTranslation(false);
    setViewState("question");
  };

  const navigateQuestion = (direction) => {
    const newIndex = currentQuestionIndex + direction;
    if (newIndex >= 0 && newIndex < selectedLecture.questions.length) {
      setCurrentQuestionIndex(newIndex);
      setAnswer("");
      setResult(null);
      setShowTranslation(false);
    }
  };

  const handleAnalyze = async () => {
    if (!answer.trim()) return;

    setIsAnalyzing(true);
    try {
      const currentQ = selectedLecture.questions[currentQuestionIndex];
      const prompt = `
قيّم إجابة الطالب التالية وردّ بصيغة JSON فقط بدون أي نص إضافي.
المادة: ${selectedSubject.title}
السؤال: ${currentQ.textEn}
إجابة الطالب: ${answer}
السياق: ${(selectedLecture.content || '').substring(0, 500)}

الصيغة المطلوبة:
{"score": رقم من 0 لـ 10, "feedback": "تقييم مفصل بالعربي", "improvements": ["نصيحة 1", "نصيحة 2"]}
      `.trim();

      const responseText = await callGemini(prompt);

      // استخراج JSON من الرد — حتى لو جواه markdown
      const cleanText = responseText.replace(/```json|```/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          setResult(JSON.parse(jsonMatch[0]));
        } catch (_) {
          // JSON موجود بس فيه syntax error — نعرض الرد كـ feedback
          setResult({ score: 5, feedback: cleanText, improvements: [] });
        }
      } else {
        // الـ AI رد بنص عادي بدون JSON — نعرضه كـ feedback
        setResult({ score: 5, feedback: responseText, improvements: [] });
      }
    } catch (e) {
      console.error(e);
      setResult({ score: 0, feedback: `⚠️ ${e.message}`, improvements: ['جرب تاني بعد شوية'] });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateAIQuestions = async () => {
    if (isGeneratingQuestions) return;
    setIsGeneratingQuestions(true);

    try {
      const prompt = `
          قم بتوليد 5 أسئلة مقالية باللغة الإنجليزية مع ترجمتها للعربية بناءً على محتوى "محاضرة ${selectedLecture.id}" في مادة "${selectedSubject.title}".
          يجب أن تكون الأسئلة متنوعة وشاملة.
          أرجع الرد **فقط** بصيغة JSON array صالحة تماماً بدون أي علامات markdown إضافية، بالشكل التالي:
          [
            { "textEn": "Question 1 in English", "textAr": "السؤال الأول بالعربية" },
            { "textEn": "Question 2 in English", "textAr": "السؤال الثاني بالعربية" }
          ]
        `;

      const responseText = await callGemini(prompt, selectedModel);

      let jsonStr = responseText.replace(/```json|```/gi, '').trim();
      const startIdx = jsonStr.indexOf('[');
      const endIdx = jsonStr.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
      }

      const newQuestions = JSON.parse(jsonStr);

      if (Array.isArray(newQuestions)) {
        setSelectedLecture(prev => ({
          ...prev,
          questions: newQuestions.map((q, idx) => ({
            id: idx + 1,
            textEn: q.textEn,
            textAr: q.textAr
          }))
        }));
        setCurrentQuestionIndex(0);
        setAnswer("");
        setResult(null);
        setShowTranslation(false);
      }

    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء التوليد: " + error.message);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // --- واجهة اختيار المواد ---
  if (viewState === "subjects") {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h2 className={`text-3xl font-black mb-8 text-right border-b border-white/10 pb-4 ${isWhite ? 'text-black' : 'text-white'}`}>
          اختر المادة للاختبار
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjectsData.map((sub) => (
            <div
              key={sub.id}
              onClick={() => handleSubjectSelect(sub)}
              className={`${isWhite ? 'bg-slate-50 border-slate-200 hover:border-blue-500' : 'bg-slate-900/60 border-white/5 hover:border-blue-500/50'} backdrop-blur-md p-8 rounded-[2.5rem] border cursor-pointer transition-all hover:-translate-y-2 group shadow-xl`}
            >
              <div
                className={`w-16 h-16 bg-${sub.color}-500/10 text-${sub.color}-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
              >
                <sub.icon size={32} />
              </div>
              <h3 className={`text-2xl font-black mb-2 ${isWhite ? 'text-black' : 'text-white'}`}>
                {sub.title}
              </h3>
              <p className={`${isWhite ? 'text-slate-600' : 'text-slate-400'} font-medium`}>{sub.desc}</p>
              <div className="mt-6 flex justify-between items-center text-xs font-bold text-slate-500">
                <span>9 محاضرات</span>
                <span>45 سؤال</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- واجهة اختيار المحاضرات (1-9) ---
  if (viewState === "lectures") {
    return (
      <div className="animate-in zoom-in-95 duration-500">
        <div className="flex items-center gap-4 mb-8 text-right">
          <button
            onClick={() => setViewState("subjects")}
            className={`p-3 rounded-xl transition-colors ${isWhite ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <ChevronRight size={24} />
          </button>
          <h2 className={`text-3xl font-black ${isWhite ? 'text-black' : 'text-white'}`}>
            محاضرات {selectedSubject.title}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedSubject.lectures.map((lec) => (
            <div
              key={lec.id}
              onClick={() => handleLectureSelect(lec)}
              className={`${isWhite ? 'bg-slate-50 hover:bg-slate-100 border-slate-200' : 'bg-slate-900/40 border-white/5 hover:bg-blue-900/20'} p-6 rounded-3xl border cursor-pointer transition-all flex items-center justify-between group`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black transition-colors ${isWhite ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-300'} group-hover:bg-blue-600 group-hover:text-white`}>
                  {lec.id}
                </div>
                <div className="text-right">
                  <h4 className={`font-bold transition-colors ${isWhite ? 'text-slate-800 group-hover:text-blue-600' : 'text-white group-hover:text-blue-300'}`}>
                    محاضرة {lec.id}
                  </h4>
                  <p className="text-xs text-slate-500">5 أسئلة مقالية</p>
                </div>
              </div>
              <ChevronLeft className="text-slate-600 group-hover:text-blue-400 transition-colors" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- واجهة السؤال والتقييم ---
  if (viewState === "question") {
    const currentQ = selectedLecture.questions[currentQuestionIndex];
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-12 duration-700">
        {/* Header Navigation */}
        <div className={`flex items-center justify-between p-4 rounded-2xl border backdrop-blur-md ${isWhite ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-white/5'}`}>
          <button
            onClick={() => setViewState("lectures")}
            className="text-slate-400 hover:text-blue-500 text-sm font-bold flex items-center gap-2"
          >
            <ChevronRight size={16} /> خروج
          </button>
          <div className={`font-bold text-sm ${isWhite ? 'text-slate-700' : 'text-white'}`}>
            محاضرة {selectedLecture.id}{" "}
            <span className="text-slate-500 mx-2">|</span> سؤال{" "}
            {currentQuestionIndex + 1} من {selectedLecture.questions.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateAIQuestions}
              disabled={isGeneratingQuestions}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 text-xs font-bold transition-all"
              title="توليد أسئلة جديدة بالذكاء الاصطناعي"
            >
              {isGeneratingQuestions ? (
                <Sparkles className="animate-spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {isGeneratingQuestions ? "جاري التوليد..." : "توليد أسئلة ذكية"}
            </button>
            <button
              onClick={() => navigateQuestion(-1)}
              disabled={currentQuestionIndex === 0}
              className={`p-2 rounded-lg disabled:opacity-30 ${isWhite ? 'bg-slate-200' : 'bg-slate-800'} text-slate-500 hover:text-blue-500`}
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => navigateQuestion(1)}
              disabled={
                currentQuestionIndex === selectedLecture.questions.length - 1
              }
              className={`p-2 rounded-lg disabled:opacity-30 ${isWhite ? 'bg-slate-200' : 'bg-slate-800'} text-slate-500 hover:text-blue-500`}
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>

        {/* Question Card */}
        <div className={`${isWhite ? 'bg-white border-slate-200 shadow-lg' : 'bg-slate-900/60 border-white/10 shadow-2xl'} p-10 rounded-[2.5rem] border relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="flex justify-between items-start mb-4">
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`text-xs px-3 py-1 rounded-full transition-colors flex items-center gap-2 ${isWhite ? 'bg-slate-100 text-blue-600 hover:bg-slate-200' : 'bg-slate-800 text-blue-400 hover:bg-slate-700'}`}
            >
              <Globe size={12} />{" "}
              {showTranslation ? "Hide Translation" : "ترجمة السؤال"}
            </button>
            <h3 className="text-blue-400 font-black uppercase text-xs tracking-widest text-right">
              ESSAY QUESTION
            </h3>
          </div>
          <p
            className={`text-2xl font-bold leading-relaxed text-left ${isWhite ? 'text-black' : 'text-white'}`}
            dir="ltr"
          >
            {currentQ.textEn}
          </p>
          {showTranslation && (
            <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in">
              <p
                className={`text-xl font-bold leading-relaxed text-right ${isWhite ? 'text-slate-700' : 'text-slate-300'}`}
                dir="rtl"
              >
                {currentQ.textAr}
              </p>
            </div>
          )}
        </div>

        {/* Answer Area */}
        <div className="relative">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="اكتب إجابتك هنا بوضوح..."
            className={`w-full h-56 p-8 rounded-[2rem] border text-lg outline-none focus:ring-2 focus:ring-blue-600 transition-all text-right shadow-inner ${isWhite ? 'bg-slate-50 border-slate-200 text-black placeholder:text-slate-400' : 'bg-slate-900/40 border-white/10 text-white placeholder:text-slate-600'}`}
            dir="rtl"
          />
          <div className="absolute bottom-6 left-6 text-xs text-slate-500 font-bold">
            {answer.length} حرف
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !answer.trim()}
          className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xl shadow-2xl shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-1"
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-3">
              <Sparkles className="animate-spin" /> جاري التحليل الذكي...
            </span>
          ) : (
            "إرسال للإجابة والتقييم"
          )}
        </button>

        {/* Result Area */}
        {result && (
          <div className={`${isWhite ? 'bg-slate-50 border-blue-200 shadow-xl' : 'bg-slate-800/90 border-blue-500/30 shadow-2xl'} p-8 rounded-[2.5rem] border animate-in zoom-in-95 space-y-6`}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="text-right">
                <p className="text-slate-400 text-sm font-bold">درجة التقييم</p>
                <div className="text-5xl font-black text-blue-400 mt-1">
                  {result.score}
                  <span className="text-2xl text-slate-500">/10</span>
                </div>
              </div>
              <div
                className={`p-4 rounded-2xl ${result.score >= 7
                  ? "bg-green-500/10 text-green-400"
                  : "bg-amber-500/10 text-amber-400"
                  }`}
              >
                {result.score >= 7 ? (
                  <CheckCircle size={32} />
                ) : (
                  <AlertCircle size={32} />
                )}
              </div>
            </div>

            <div className="text-right">
              <h4 className={`font-bold mb-2 ${isWhite ? 'text-black' : 'text-white'}`}>
                ملاحظات المساعد الذكي:
              </h4>
              <p className={`leading-relaxed p-4 rounded-xl border ${isWhite ? 'bg-white text-slate-700 border-slate-100' : 'bg-slate-900/50 text-slate-300 border-white/5'}`}>
                "{result.feedback}"
              </p>
            </div>

            <div className="text-right">
              <h4 className="text-amber-500 font-bold mb-3 flex items-center gap-2 justify-end">
                نصائح للتحسين <Sparkles size={16} />
              </h4>
              <div className="space-y-2">
                {result.improvements.map((imp, i) => (
                  <div
                    key={i}
                    className={`text-sm flex gap-3 justify-end items-start p-3 rounded-xl ${isWhite ? 'bg-white text-slate-600' : 'bg-slate-900/30 text-slate-400'}`}
                  >
                    <span>{imp}</span>
                    <div className="mt-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
};

// --- المكتبة الشاملة (مع التوجيه للمسارات) ---
const MaterialsSection = ({ subjectsData, theme }) => {
  const isWhite = theme === 'white';
  const openMaterial = (path) => {
    window.open(path, "_blank");
  };

  return (
    <div className="space-y-10 animate-in fade-in">
      <div className={`text-right border-b border-white/10 pb-6`}>
        <h2 className={`text-4xl font-black mb-2 tracking-tight ${isWhite ? 'text-black' : 'text-white'}`}>
          المكتبة الرقمية الشاملة
        </h2>
        <p className={`${isWhite ? 'text-slate-600' : 'text-slate-400'} font-medium`}>
          جميع محاضراتك ومصادرك مرتبة وجاهزة.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {subjectsData.map((sub) => (
          <div
            key={sub.id}
            className={`${isWhite ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-white/5'} backdrop-blur-md rounded-[2.5rem] border overflow-hidden group hover:border-blue-500/30 transition-all shadow-xl`}
          >
            <div className={`p-6 flex items-center gap-4 border-b ${isWhite ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/50 border-white/5'}`}>
              <div className={`p-3 bg-blue-500/10 text-blue-500 rounded-xl`}>
                <sub.icon size={24} />
              </div>
              <h4 className={`text-xl font-black ${isWhite ? 'text-black' : 'text-white'}`}>{sub.title}</h4>
            </div>
            <div className="p-6 space-y-3 h-64 overflow-y-auto custom-scrollbar">
              {sub.lectures.map((lec) => (
                <div
                  key={lec.id}
                  onClick={() => openMaterial(lec.materialPath)}
                  className={`${isWhite ? 'bg-white border-slate-100 hover:bg-slate-200' : 'bg-slate-800/20 border-white/5 hover:bg-blue-900/30'} flex items-center justify-between p-4 rounded-2xl border group/item cursor-pointer transition-all`}
                >
                  <Download size={20} className="text-slate-500 group-hover/item:text-blue-500 transition-colors" />
                  <div className="text-right">
                    <p className={`text-sm font-bold transition-colors ${isWhite ? 'text-slate-800' : 'text-white'}`}>المحاضرة {lec.id}</p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{lec.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const HistorySection = ({ setActiveTab, setActiveArchiveId }) => {
  const [archives, setArchives] = useState([]);

  useEffect(() => {
    const data = JSON.parse(
      localStorage.getItem("nano_chat_archives_v2") || "[]"
    );
    setArchives(data);
  }, []);

  const loadChat = (chat) => {
    localStorage.setItem(
      "nano_chat_history_v2",
      JSON.stringify(chat.messages)
    );
    setActiveArchiveId(chat.id); // نحدد إننا بنكمل في محادثة قديمة
    setActiveTab("agent");
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    Swal.fire({
      title: 'حذف المحادثة؟',
      text: "مش هتقدر ترجعها تاني يا بطل.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'أيوه احذفها',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        const newArchives = archives.filter((c) => c.id !== id);
        setArchives(newArchives);
        localStorage.setItem(
          "nano_chat_archives_v2",
          JSON.stringify(newArchives)
        );
        Swal.fire('اتمسحت!', 'المحادثة اتمسحت من السجل.', 'success');
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="text-right border-b border-white/10 pb-6">
        <h2 className="text-4xl font-black text-white mb-2 tracking-tight">
          سجل المحادثات
        </h2>
        <p className="text-slate-400 font-medium">
          راجع محادثاتك السابقة مع نانو.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {archives.length === 0 ? (
          <div className="text-center p-10 text-slate-500">
            لا توجد محادثات محفوظة.
          </div>
        ) : (
          archives.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadChat(chat)}
              className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 cursor-pointer transition-all flex justify-between items-center group"
            >
              <div className="text-right">
                <p className="text-xs text-blue-400 font-bold mb-1">
                  {chat.date}
                </p>
                <h4 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                  {chat.summary}
                </h4>
                <p className="text-xs text-slate-500 mt-2">
                  {chat.messages.length} رسائل
                </p>
              </div>
              <button
                onClick={(e) => deleteChat(e, chat.id)}
                className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AgentSection = ({
  userData,
  subjectsData,
  cooldown,
  setCooldown,
  focusedSubject,
  setFocusedSubject,
  activeArchiveId,
  setActiveArchiveId,
  nanoLectures,
  selectedModel,
  setSelectedModel,
  theme,
  isN8nMode,
}) => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("nano_chat_history_v2");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null); // لمنع انقطاع الصوت (Garbage Collection)

  // --- تحديد نوع الملف ---
  const getFileType = (filename) => {
    if (!filename) return 'unknown';
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'word';
    return 'unknown';
  };

  useEffect(() => {
    const syncName = () => {
      if (userData?.name) {
        setMessages((prev) => {
          if (prev.length > 0 && prev[0].sender === "bot" && prev[0].text.includes("أهلاً يا")) {
            const currentName = userData.name;
            const updatedText = `أهلاً يا ${currentName}! 👋 أنا مساعدك الشخصي نانو. اسألني في أي حاجة تخص الـ IT أو المواد بتاعتك.`;
            if (prev[0].text !== updatedText) {
              const newMsgs = [...prev];
              newMsgs[0] = { ...prev[0], text: updatedText };
              return newMsgs;
            }
          }
          return prev;
        });
      }
    };

    if (messages.length === 0 && userData) {
      setMessages([
        {
          id: 1,
          sender: "bot",
          text: `أهلاً يا ${userData.name || 'بطل'}! 👋 أنا مساعدك الشخصي نانو. اسألني في أي حاجة تخص الـ IT أو المواد بتاعتك.`,
        },
      ]);
    } else {
      syncName();
    }
  }, [userData, userData?.name]);

  useEffect(() => {
    localStorage.setItem("nano_chat_history_v2", JSON.stringify(messages));
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // --- رفع الملف مع فلترة ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['pdf', 'doc', 'docx'].includes(ext)) {
        setAttachedFile(file);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'نوع ملف غير مدعوم ❌',
          text: 'يا بطل، نانو بيقدر يقرأ ملفات PDF و Word بس حالياً.',
          confirmButtonText: 'تمام'
        });
        e.target.value = null;
      }
    }
  };

  // --- إدخال صوتي بالمايكروفون — مع طلب صريح للأذونات ---
  const toggleMic = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('[Mic Stop Error]:', e);
        }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Swal.fire({ icon: 'warning', title: 'غير مدعوم', text: 'متصفحك مش بيدعم التعرف على الصوت. جرب Chrome!', confirmButtonText: 'تمام' });
      return;
    }

    // نجبر المتصفح على فتح المايكروفون عبر mediaDevices لأنه أقل عرضة للرفض من SpeechRecognition مباشرة
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // نقفل التراك بعد ما نتأكد من الإذن
      }
    } catch (err) {
      console.error('[Mic Permission Error]:', err);
      Swal.fire({
        icon: 'error',
        title: 'مش قادر يوصل للميكروفون',
        text: 'راجع إعدادات المتصفح، الميكروفون مرفوض أو بيستخدمه برنامج تاني.',
        confirmButtonText: 'فهمت'
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-EG';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join(' ');
      setInput(prev => (prev ? prev + ' ' + transcript : transcript).trim());
    };

    recognition.onerror = (e) => {
      console.error('[Mic Recognition Error]:', e);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        Swal.fire({
          title: 'الميكروفون محظور! 🚫',
          html: `
            <div class="text-right dir-rtl space-y-4">
              <p class="font-bold text-slate-600">عشان نانو يسمعك، لازم تفعل الميكروفون:</p>
              <ol class="list-decimal list-inside text-sm text-slate-500 space-y-2">
                <li>اضغط على أيقونة القفل 🔒 بجانب رابط الموقع فوق.</li>
                <li>تأكد إن خيار <b>Microphone</b> (الميكروفون) معمول على <b>Allow</b> (السماح).</li>
                <li>لو شغال من الموبايل، اتأكد إنك عاطي صلاحية لجوجل كروم نفسه.</li>
              </ol>
            </div>
          `,
          icon: 'warning',
          confirmButtonText: 'فهمت',
          confirmButtonColor: '#2563eb'
        });
      } else if (e.error === 'network') {
        Swal.fire({ icon: 'error', title: 'خطأ في الشبكة', text: 'المتصفح محتاج إنترنت شغال عشان يتعرف على الصوت.', confirmButtonText: 'تمام' });
      }
      setIsListening(false);
    };
    recognition.onend = () => {
      console.log('[Mic] Ended');
      setIsListening(false);
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      console.log('[Mic] Started');
    } catch (err) {
      console.error('[Mic Start Error]:', err);
      setIsListening(false);
    }
  };

  const startNewChat = () => {
    const resetChat = () => {
      setMessages([
        {
          id: Date.now(),
          sender: "bot",
          text: `أهلاً يا ${userData.name || 'بطل'}! 👋 أنا مساعدك الشخصي نانو. اسألني في أي حاجة تخص الـ IT أو المواد بتاعتك.`,
        },
      ]);
      localStorage.removeItem("nano_chat_history_v2");
      setAttachedFile(null);
      setActiveArchiveId(null);
    };

    if (messages.length > 1) {
      Swal.fire({
        title: 'عايز تبدأ جديد؟',
        text: 'متقلقش، المحادثة دي هتتحفظ في السجل.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'أيوه، ابدأ جديد',
        cancelButtonText: 'إلغاء'
      }).then((result) => {
        if (result.isConfirmed) {
          const archives = JSON.parse(
            localStorage.getItem("nano_chat_archives_v2") || "[]"
          );
          const firstUserMsg = messages.find((m) => m.sender === "user");
          const summary = firstUserMsg
            ? firstUserMsg.text.substring(0, 40) +
            (firstUserMsg.text.length > 40 ? "..." : "")
            : "محادثة جديدة";
          archives.unshift({
            id: Date.now(),
            date: new Date().toLocaleString("ar-EG"),
            summary,
            messages,
          });
          localStorage.setItem("nano_chat_archives_v2", JSON.stringify(archives));
          resetChat();
        }
      });
    } else {
      resetChat();
    }
  };

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return;
    if (cooldown > 0) return; // تم منع الزر من الـ UI

    let userMessageText = input.trim();
    const fileForSend = attachedFile;

    const newUserMsg = {
      id: Date.now(),
      sender: "user",
      text: userMessageText || (fileForSend ? `📎 أرسلت ملف: ${fileForSend.name}` : ''),
      file: fileForSend ? { name: fileForSend.name, type: getFileType(fileForSend.name) } : null,
    };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInput("");
    setAttachedFile(null);
    setIsTyping(true);

    try {
      const subjectContext = focusedSubject
        ? `أنت الآن في وضع "التركيز على مادة": ${focusedSubject}. أجب كأستاذ متخصص جداً في هذه المادة.`
        : "أنت في الوضع العام، ساعد الطالب في أي مادة من ضمن الـ 6 مواد المتاحة.";

      const lecturesContext = nanoLectures.length > 0
        ? `إليك بعض المحاضرات التي غذاها الدكتور في ذاكرتك:\n${nanoLectures.map(l => `[${l.title}]: ${l.content}`).join('\n')}`
        : "";

      // --- قراءة محتوى الملف ---
      let fileDataPayload = null;
      if (fileForSend) {
        try {
          const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target.result;
              const base64 = dataUrl.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(fileForSend); // القراءة كـ Base64 لفك تشفير الـ PDF عبر Backend
          });

          let mime = 'application/pdf';
          if (fileForSend.name.endsWith('.docx')) mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (fileForSend.name.endsWith('.txt')) mime = 'text/plain';

          fileDataPayload = {
            mimeType: mime,
            data: base64Data
          };
        } catch (_) {
          console.error('[NANO] File Read Error');
        }
      }

      const prompt = `
${subjectContext}
${lecturesContext}
الطالب: ${userData.name || 'طالب'}
سؤال الطالب: ${userMessageText || `اشرح لي محتوى الملف المرفق "${fileForSend?.name}" وأخبرني بأهم ما فيه.`}
      `.trim();

      let botResponse = "";

      if (isN8nMode) {
        // Fallback to callGemini instead of failing on n8n
        botResponse = await callGemini(prompt, selectedModel, fileDataPayload);
      } else {
        // --- Gemini Direct API Call (Secure via Vercel Backend) ---
        botResponse = await callGemini(prompt, selectedModel, fileDataPayload);
      }
      setCooldown(5);

      const newBotMsg = { id: Date.now() + 1, sender: "bot", text: botResponse };
      const finalizedMessages = [...updatedMessages, newBotMsg];
      setMessages(finalizedMessages);

      if (activeArchiveId) {
        const archives = JSON.parse(localStorage.getItem("nano_chat_archives_v2") || "[]");
        const idx = archives.findIndex(a => a.id === activeArchiveId);
        if (idx !== -1) {
          archives[idx].messages = finalizedMessages;
          localStorage.setItem("nano_chat_archives_v2", JSON.stringify(archives));
        }
      }
    } catch (error) {
      console.error('[NANO] Error:', error);
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: '⚠️ حدث خطأ، جرب تاني بعد شوية.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- رسالة ترحيبية صوتية — Voice Greeting ---
  useEffect(() => {
    const speakGreeting = () => {
      if (!userData) return;
      window.speechSynthesis.cancel();

      // تحويل الاسم العربي إلى حروف إنجليزية ليتمكن الصوت الإنجليزي من قراءته
      const arabicMap = {
        'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
        'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
        'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'k', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
        'ى': 'a', 'ة': 'a', ' ': ' '
      };
      const transliterate = (arStr) => {
        if (!arStr) return "";
        let enStr = arStr
          .replace(/عبد /g, 'Abd ')
          .replace(/عبد/g, 'Abd')
          .replace(/طه/g, 'TAHA')
          .replace(/علي/g, 'ali')
          .replace(/النحاس/g, 'elnhas')
          .replace(/osama/g, 'اسامه')
          .replace(/محمد/g, 'Mohamad')
          .replace(/محمود/g, 'Mahmoud')
          .replace(/أحمد/g, 'Ahmed')
          .replace(/احمد/g, 'Ahmed')
          .replace(/مصطفى/g, 'Mostafa')
          .replace(/عمر/g, 'Omar');
        let res = '';
        for (let char of enStr) { res += arabicMap[char] || char; }
        return res;
      };

      const name = userData.name ? transliterate(userData.name) : '';

      utteranceRef.current = new SpeechSynthesisUtterance();
      const msg = utteranceRef.current;

      msg.text = name ? `Welcome ${name}! I am Nano, your smart assistant.` : `Welcome! I am Nano, your smart assistant.`;
      msg.lang = 'en-US';
      msg.rate = 1.3;   // سريع وحيوي
      msg.pitch = 1.2;  // صوت أنثوي رقيق

      const voices = window.speechSynthesis.getVoices();
      const premiumFemaleVoice =
        voices.find(v => v.name.includes('Google UK English Female')) ||
        voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.name.includes('Samantha')) ||
        voices.find(v => v.name.includes('Zira')) ||
        voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.lang.startsWith('en'));

      if (premiumFemaleVoice) msg.voice = premiumFemaleVoice;

      // لتأكيد أن الصوت مكمل ومبيقطعش
      msg.onend = () => { utteranceRef.current = null; };

      window.speechSynthesis.speak(msg);
    };

    // Try to speak, but also listen for a generic click on the document to "unlock" audio if needed
    const unlockAudio = () => {
      speakGreeting();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    const t = setTimeout(speakGreeting, 1000); // Try once after 1s
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      window.speechSynthesis.cancel();
    };
  }, [userData]); // Re-run if user data changes to personalize

  const isWhite = theme === 'white';

  return (
    <div className="flex flex-col h-full w-full">
      {/* ═══ Header ═══ */}
      <div className={`flex-shrink-0 px-6 py-4 border-b flex items-center justify-between backdrop-blur-xl ${isWhite ? 'bg-white/80 border-slate-200' : 'bg-black/40 border-white/5'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <MessageSquare size={20} className="text-white" />
          </div>
          <div className="text-right">
            <h3 className={`font-black text-base leading-tight ${isWhite ? 'text-black' : 'text-white'}`}>نانو AI</h3>
            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
              {focusedSubject ? `🎯 ${focusedSubject}` : 'متصل | Online'}
            </p>
          </div>
        </div>
        <button
          onClick={startNewChat}
          className={`p-2.5 rounded-xl transition-all ${isWhite ? 'bg-slate-100 hover:bg-slate-200 text-slate-500' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}
          title="محادثة جديدة"
        >
          <PlusCircle size={20} />
        </button>
      </div>

      {/* ═══ Messages Area ═══ */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 py-6 space-y-4"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'bot' && (
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-cyan-500/20">
                <span className="text-white text-xs font-black">N</span>
              </div>
            )}
            <div
              className={`max-w-[75%] md:max-w-[65%] px-5 py-3.5 text-right leading-relaxed font-medium text-sm md:text-base transition-opacity duration-300 ${m.sender === 'user'
                ? 'bg-blue-600 text-white rounded-3xl rounded-tr-md shadow-lg shadow-blue-500/10'
                : isWhite
                  ? 'bg-white border border-slate-200 text-slate-800 shadow-md rounded-3xl rounded-tl-md'
                  : 'bg-slate-800 border border-slate-700 text-slate-100 shadow-xl rounded-3xl rounded-tl-md'
                }`}
              style={{ opacity: 'var(--ui-opacity, 1)' }}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {/* 📎 مرفق ملف - badge ملون */}
              {m.file && (
                <div className={`mt-2 flex items-center gap-2 text-xs font-bold justify-end py-1.5 px-3 rounded-xl w-fit mr-auto ${m.file.type === 'pdf'
                  ? 'bg-red-100 text-red-600 border border-red-200'
                  : m.file.type === 'word'
                    ? 'bg-blue-100 text-blue-600 border border-blue-200'
                    : 'bg-slate-200 text-slate-600'
                  }`} dir="rtl">
                  {m.file.type === 'pdf' ? (
                    <FileText size={13} className="text-red-500" />
                  ) : m.file.type === 'word' ? (
                    <FileType2 size={13} className="text-blue-500" />
                  ) : (
                    <File size={13} />
                  )}
                  <span className="truncate max-w-[180px]">{m.file.name}</span>
                </div>
              )}
            </div>
            {m.sender === 'user' && (
              <div className="w-8 h-8 rounded-full flex-shrink-0 mt-1 bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <User size={15} className="text-white" />
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-white text-xs font-black">N</span>
            </div>
            <div
              className={`px-5 py-4 rounded-3xl rounded-tl-md ${isWhite ? 'bg-white border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}
              style={{ opacity: 'var(--ui-opacity, 1)' }}
            >
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Input Tray ═══ */}
      <div className={`flex-shrink-0 px-4 md:px-8 py-4 border-t backdrop-blur-xl ${isWhite ? 'bg-white/80 border-slate-200' : 'bg-black/40 border-white/5'}`}>
        {/* Attached file indicator - ملون حسب نوع الملف */}
        {attachedFile && (
          <div className="flex justify-between items-center text-xs mb-2 px-3 py-1.5 rounded-xl animate-in fade-in border"
            style={getFileType(attachedFile.name) === 'pdf'
              ? { background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }
              : { background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }
            }
          >
            <button onClick={() => setAttachedFile(null)} className="text-red-400 hover:text-red-300 font-black text-xs">✕ إزالة</button>
            <span className="flex items-center gap-2 font-bold" style={{
              color: getFileType(attachedFile.name) === 'pdf' ? '#f87171' : '#60a5fa'
            }}>
              {getFileType(attachedFile.name) === 'pdf'
                ? <FileText size={14} className="text-red-400" />
                : <FileType2 size={14} className="text-blue-400" />
              }
              {attachedFile.name}
            </span>
          </div>
        )}

        {/* Model Selector Tabs */}
        <div className="flex gap-2 mb-2 justify-end" dir="rtl">
          <button
            onClick={() => setSelectedModel('gemini-2.5-flash-lite')}
            className={`text-[10px] font-black px-3 py-1 rounded-full transition-all flex items-center gap-1 border ${selectedModel === 'gemini-2.5-flash-lite'
              ? 'bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-500/30'
              : isWhite ? 'bg-slate-100 text-slate-500 border-slate-200 hover:border-cyan-400' : 'bg-white/5 text-slate-400 border-white/10 hover:border-cyan-400/50'
              }`}
          >
            ⚡ السريع
          </button>
          <button
            onClick={() => setSelectedModel('gemini-2.5-flash')}
            className={`text-[10px] font-black px-3 py-1 rounded-full transition-all flex items-center gap-1 border ${selectedModel === 'gemini-2.5-flash'
              ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/30'
              : isWhite ? 'bg-slate-100 text-slate-500 border-slate-200 hover:border-indigo-400' : 'bg-white/5 text-slate-400 border-white/10 hover:border-indigo-400/50'
              }`}
          >
            🧠 المفكر
          </button>
        </div>

        {/* Input Row */}
        <div className="flex items-end gap-3" dir="rtl">
          <div className="relative flex-grow">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={focusedSubject ? `اسأل نانو في ${focusedSubject}...` : 'اسأل نانو في أي حاجة...'}
              className={`w-full p-4 pr-5 rounded-3xl border transition-all text-right outline-none font-bold placeholder:font-normal resize-none h-[60px] max-h-[160px] ${isWhite
                ? 'bg-slate-50 border-slate-200 text-black placeholder:text-slate-400 focus:border-cyan-400'
                : 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50'
                }`}
              dir="rtl"
              rows={1}
              style={{ paddingLeft: '48px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            />
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx" />
            <button
              onClick={() => fileInputRef.current.click()}
              className={`absolute bottom-3.5 left-3.5 p-1.5 rounded-full transition-colors ${isWhite ? 'text-slate-400 hover:text-cyan-600' : 'text-slate-500 hover:text-cyan-400'}`}
            >
              <Paperclip size={18} />
            </button>
          </div>
          {/* 🎤 زر المايكروفون */}
          <button
            onClick={toggleMic}
            className={`flex-shrink-0 w-12 h-12 rounded-2xl transition-all flex items-center justify-center border ${isListening
              ? 'bg-red-500 text-white border-red-500 mic-active'
              : isWhite
                ? 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-300'
                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
              }`}
            title={isListening ? 'إيقاف التسجيل' : 'تكلم مع نانو'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* 🚀 زر الإرسال */}
          <button
            onClick={handleSend}
            disabled={isTyping || (!input.trim() && !attachedFile) || cooldown > 0}
            className={`flex-shrink-0 w-12 h-12 rounded-2xl transition-all shadow-lg flex items-center justify-center ${cooldown > 0
              ? 'bg-slate-700 text-slate-400'
              : 'bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/30 hover:scale-105 disabled:opacity-50'
              }`}
            style={{ direction: 'ltr' }}
          >
            {cooldown > 0 ? (
              <span className="font-bold text-xs">{cooldown}s</span>
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardHome = ({ setActiveTab, userData, theme }) => {
  const isWhite = theme === 'white';
  const isBlack = theme === 'black';

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 text-right relative z-10">
      <div className={`${isWhite ? 'bg-slate-100 border-slate-200 text-black' : isBlack ? 'bg-slate-900 border-white/5 text-white' : 'bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-white/10 text-white'} backdrop-blur-xl p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden group border`}>
        <div className="absolute -left-20 -top-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] group-hover:bg-blue-600/20 transition-all" />
        <div className="relative z-10">
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter">
            أهلاً يا{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-400 to-indigo-400">
              {userData.name || "بطل"}
            </span>
            ! 👋
          </h2>
          <p className={`${isWhite ? 'text-slate-600' : 'text-slate-400'} text-xl max-w-2xl ml-auto font-medium leading-relaxed`}>
            أنا "نانو"، مساعدك الشخصي. جهزتلك 6 مواد دراسية، 54 محاضرة، و270 سؤال
            ذكي عشان تكسر الدنيا!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            id: "quiz",
            label: "الامتحانات",
            icon: Brain,
            color: "blue",
            desc: "54 محاضرة تفاعلية جاهزة.",
          },
          {
            id: "materials",
            label: "المكتبة",
            icon: BookOpen,
            color: "emerald",
            desc: "كل المصادر في مكان واحد.",
          },
          {
            id: "agent",
            label: "المساعد",
            icon: MessageSquare,
            color: "indigo",
            desc: "ذكاء اصطناعي 24/7.",
          },
        ].map((stat) => (
          <div
            key={stat.id}
            onClick={() => setActiveTab(stat.id)}
            className={`${isWhite ? 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white' : 'bg-slate-900/60 border-white/5 hover:border-blue-500/30'} p-10 rounded-[3rem] border cursor-pointer transition-all hover:-translate-y-2 group shadow-xl`}
          >
            <div
              className={`w-14 h-14 bg-blue-500/10 text-blue-400 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
            >
              <stat.icon size={28} />
            </div>
            <h4 className={`text-2xl font-black mb-2 ${isWhite ? 'text-black' : 'text-white'}`}>{stat.label}</h4>
            <p className={`${isWhite ? 'text-slate-500' : 'text-slate-400'} font-bold text-base`}>{stat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};



const App = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userData, setUserData] = useState({ name: "", email: "" });
  const [subjectsData, setSubjectsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cooldown, setCooldown] = useState(0); // 5s DDoS Cooldown
  const [error, setError] = useState(null);

  // --- New States for Enhancements ---
  const [focusedSubject, setFocusedSubject] = useState(null); // null = عام
  const [activeArchiveId, setActiveArchiveId] = useState(null); // لتحديد المحادثة النشطة للدمج
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash"); // الموديل النشط
  const [theme, setTheme] = useState(localStorage.getItem("nano_theme") || "slate");
  const [bgAnimation, setBgAnimation] = useState(() => {
    const saved = localStorage.getItem("nano_bg_animation");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [nanoLectures, setNanoLectures] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("nano_lectures_feed") || "[]");
    } catch (e) {
      return [];
    }
  });

  // --- N8N Mode State ---
  const [isN8nMode, setIsN8nMode] = useState(false);

  // --- New Advanced UI States ---
  const [brightness, setBrightness] = useState(() => {
    return parseInt(localStorage.getItem("nano_brightness") || "100");
  });
  const [uiOpacity, setUiOpacity] = useState(() => {
    return parseInt(localStorage.getItem("nano_opacity") || "100");
  });

  useEffect(() => {
    localStorage.setItem("nano_brightness", brightness);
  }, [brightness]);

  useEffect(() => {
    localStorage.setItem("nano_opacity", uiOpacity);
  }, [uiOpacity]);

  // Save theme to localStorage
  useEffect(() => {
    localStorage.setItem("nano_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("nano_bg_animation", JSON.stringify(bgAnimation));
  }, [bgAnimation]);

  const handleOpenSettings = () => {
    Swal.fire({
      title: '<span class="text-2xl font-black">إعدادات المظهر 🎨</span>',
      html: `
        <div class="space-y-6 text-right dir-rtl p-2">
          <!-- الثيمات -->
          <div class="space-y-3 font-sans">
            <p class="text-sm font-bold text-slate-500 mr-1">الثيم المفضل</p>
            <div class="flex gap-2" id="theme-buttons-container">
              <button onclick="window.setNanoTheme('default')" id="btn-theme-default" class="theme-btn flex-1 py-3 rounded-xl border-2 transition-all ${theme === 'default' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-slate-200 text-slate-400'} font-bold">افتراضي</button>
              <button onclick="window.setNanoTheme('black')" id="btn-theme-black" class="theme-btn flex-1 py-3 rounded-xl border-2 transition-all ${theme === 'black' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-slate-200 text-slate-400'} font-bold">أسود</button>
              <button onclick="window.setNanoTheme('white')" id="btn-theme-white" class="theme-btn flex-1 py-3 rounded-xl border-2 transition-all ${theme === 'white' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-slate-200 text-slate-400'} font-bold">أبيض</button>
            </div>
          </div>

          <!-- الأنميشن -->
          <div class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span class="font-bold text-slate-700">الرسوم المتحركة (الخلفية)</span>
            <button onclick="window.toggleNanoBg()" id="btn-toggle-bg" class="px-4 py-2 rounded-lg ${bgAnimation ? 'bg-blue-600' : 'bg-slate-400'} text-white font-black text-xs transition-all">
              ${bgAnimation ? 'مفعّلة' : 'ملغاة'}
            </button>
          </div>

          <!-- السطوع -->
          <div class="space-y-3">
            <div class="flex justify-between items-center mr-1">
              <p class="text-sm font-bold text-slate-500">السطوع</p>
              <span id="brightness-val" class="text-xs font-black text-blue-600">${brightness}%</span>
            </div>
            <input type="range" min="50" max="150" value="${brightness}" step="5" 
              class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              oninput="window.updateNanoBrightness(this.value)">
          </div>

          <!-- الشفافية -->
          <div class="space-y-3">
            <div class="flex justify-between items-center mr-1">
              <p class="text-sm font-bold text-slate-500">شفافية الواجهة</p>
              <span id="opacity-val" class="text-xs font-black text-blue-600">${uiOpacity}%</span>
            </div>
            <input type="range" min="10" max="100" value="${uiOpacity}" step="5" 
              class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              oninput="window.updateNanoOpacity(this.value)">
          </div>

          <hr class="border-slate-100">
          
          <!-- استعادة الافتراضيات -->
          <button onclick="window.resetNanoSettings()" class="w-full py-3 rounded-2xl bg-slate-100 text-slate-500 font-bold text-sm hover:bg-red-50 hover:text-red-500 transition-all border border-slate-200">
            استعادة الإعدادات الأصلية 🔄
          </button>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'إغلاق',
      confirmButtonColor: '#2563eb',
      background: '#ffffff',
      customClass: {
        popup: 'rounded-[2.5rem] shadow-2xl border-4 border-blue-50',
      },
      didOpen: () => {
        const updateThemeButtons = (activeTheme) => {
          document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('border-blue-500', 'bg-blue-500/10', 'text-blue-500');
            btn.classList.add('border-slate-200', 'text-slate-400');
          });
          const activeBtn = document.getElementById(`btn-theme-${activeTheme}`);
          if (activeBtn) {
            activeBtn.classList.remove('border-slate-200', 'text-slate-400');
            activeBtn.classList.add('border-blue-500', 'bg-blue-500/10', 'text-blue-500');
          }
        };

        window.setNanoTheme = (t) => {
          setTheme(t);
          updateThemeButtons(t);
        };

        window.toggleNanoBg = () => {
          setBgAnimation(prev => {
            const newState = !prev;
            const btn = document.getElementById('btn-toggle-bg');
            if (btn) {
              btn.className = `px-4 py-2 rounded-lg ${newState ? 'bg-blue-600' : 'bg-slate-400'} text-white font-black text-xs transition-all`;
              btn.innerText = newState ? 'مفعّلة' : 'ملغاة';
            }
            return newState;
          });
        };

        window.updateNanoBrightness = (v) => {
          setBrightness(v);
          const display = document.getElementById('brightness-val');
          if (display) display.innerText = `${v}%`;
        };

        window.updateNanoOpacity = (v) => {
          setUiOpacity(v);
          const display = document.getElementById('opacity-val');
          if (display) display.innerText = `${v}%`;
        };

        window.resetNanoSettings = () => {
          setTheme('default');
          setBgAnimation(true);
          setBrightness(100);
          setUiOpacity(100);
          Swal.close();
          setTimeout(() => {
            Swal.fire({ icon: 'success', title: 'تمت الاستعادة!', text: 'تم إرجاع الإعدادات الأصلية بنجاح.', timer: 1500, showConfirmButton: false });
          }, 300);
        };
      }
    });
  };

  const handleFeedLectures = async () => {
    const { value: password } = await Swal.fire({
      title: 'منطقة الأستاذ 🔒',
      input: 'password',
      inputLabel: 'ادخل كلمة السر لتغذية المحاضرات',
      inputPlaceholder: 'كلمة السر هنا...',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      confirmButtonText: 'دخول',
      cancelButtonText: 'إلغاء',
      showCancelButton: true
    });

    if (password === '192168') {
      const { value: formValues } = await Swal.fire({
        title: 'تغذية محاضرة جديدة',
        html:
          '<input id="swal-input1" class="swal2-input" placeholder="عنوان المحاضرة">' +
          '<textarea id="swal-input2" class="swal2-textarea" placeholder="محتوى المحاضرة..."></textarea>',
        focusConfirm: false,
        preConfirm: () => {
          return [
            document.getElementById('swal-input1').value,
            document.getElementById('swal-input2').value
          ]
        },
        confirmButtonText: 'حفظ في الذاكرة',
        cancelButtonText: 'إلغاء',
        showCancelButton: true
      });

      if (formValues && formValues[1]) {
        const newLec = {
          id: Date.now(),
          title: formValues[0] || `محاضرة ${nanoLectures.length + 1}`,
          content: formValues[1],
          date: new Date().toLocaleString("ar-EG")
        };
        setNanoLectures(prev => [...prev, newLec]);
        Swal.fire('تم بنجاح!', 'المحاضرة دي بقت في ذاكرة نانو دلوقتي.', 'success');
      }
    } else if (password) {
      Swal.fire('خطأ!', 'كلمة السر غلط يا دكتور.', 'error');
    }
  };



  useEffect(() => {
    // --- Security and User Data ---
    if (
      !localStorage.getItem("isLoggedIn") &&
      !localStorage.getItem("currentUser")
    ) {
      window.location.href = "index.html";
      return;
    }
    try {
      const storedUser = JSON.parse(localStorage.getItem("currentUser"));
      if (storedUser) setUserData(storedUser);
    } catch (e) {
      console.error("User data not found");
    }



    // --- Dynamic Data Loading ---
    const loadAllData = async () => {
      try {
        // Use Vite BASE_URL so path resolves correctly in production
        const manifestResponse = await fetch(`${import.meta.env.BASE_URL}materials/subjects-manifest.json`);
        if (!manifestResponse.ok) throw new Error(`Manifest fetch failed: ${manifestResponse.status}`);
        const manifest = await manifestResponse.json();

        const iconMap = { linux: Terminal, os: Server, database: Database, cpp: Code, web: Globe, digital: Layers };

        const processedSubjects = await Promise.all(manifest.map(async (subject) => {
          const lecturesWithDetails = await Promise.all(subject.lectures.map(async (lecture) => {
            // Encode path properly to handle spaces and special chars (like C++)
            const rawPath = lecture.dataFile.substring(2);
            const encodedPath = rawPath.split('/').map(part => encodeURIComponent(part)).join('/');
            const lectureResponse = await fetch(`${import.meta.env.BASE_URL}materials/${encodedPath}`);
            if (!lectureResponse.ok) throw new Error(`Failed to fetch ${lecture.dataFile}`);
            const details = await lectureResponse.json();

            const specificQs = getSpecificQuestions(subject.id, lecture.number);
            return {
              id: lecture.number,
              title: details.title || lecture.title,
              content: `
                Subject: ${subject.title}
                Lecture: ${details.title || lecture.title}
                [Arabic Summary]
                ${stripHtml(details.arabicSummary)}
                [English Summary]
                ${stripHtml(details.englishSummary)}
              `,
              questions: specificQs.map((q, j) => ({
                id: j + 1,
                textEn: q.en,
                textAr: q.ar,
                modelAnswer: "The answer depends on the lecture content.",
              })),
              materialPath: details.pdfFile
                ? `/DWD/materials/${details.pdfFile.replace(/^\.\.\/\.\.\//, '').split('/').map(p => encodeURIComponent(p)).join('/')}`
                : `/DWD/materials/${encodedPath}`,
            };
          }));

          return {
            id: subject.id,
            title: subject.title,
            icon: iconMap[subject.id] || BookOpen,
            color: subject.color.replace('border-[#', '').replace(']', '') || 'slate',
            desc: subject.description,
            lectures: lecturesWithDetails
          };
        }));

        setSubjectsData(processedSubjects);
      } catch (err) {
        console.error("Failed to load subject data:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllData();

    // --- Hash Routing ---
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      const validTabs = ["dashboard", "quiz", "agent", "history", "materials", "settings"];
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check

    return () => window.removeEventListener('hashchange', handleHashChange);

  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#020617] text-white flex-col">
        <Sparkles className="w-16 h-16 text-blue-500 animate-spin mb-4" />
        <p className="text-xl font-bold">جاري تحميل منصة DWD الذكية...</p>
      </div>
    );
  }

  const getThemeBg = () => {
    switch (theme) {
      case 'black': return 'bg-black text-white';
      case 'white': return 'bg-white text-black';
      case 'slate': return 'bg-[#0f172a] text-slate-200';
      default: return 'bg-[#020617] text-slate-200';
    }
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${getThemeBg()} text-white flex-col p-8 text-center`}>
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-red-400 mb-2">فشل تحميل البيانات</h2>
        <p className="text-slate-400">حدث خطأ أثناء جلب بيانات المواد. يرجى التحقق من المسارات أو تحديث الصفحة.</p>
        <p className="mt-4 text-xs bg-red-900/50 text-red-300 p-4 rounded-lg font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans selection:bg-blue-500/30 overflow-hidden ${getThemeBg()}`}
      style={{
        filter: `brightness(${brightness}%)`,
        '--ui-opacity': uiOpacity / 100
      }}
      dir="rtl"
    >
      <ParticleBackground theme={theme} enabled={bgAnimation} />
      <div className="flex relative z-10 h-screen overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          userData={userData}
          subjectsData={subjectsData}
          focusedSubject={focusedSubject}
          setFocusedSubject={setFocusedSubject}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onFeedLectures={handleFeedLectures}
        />
        <main className={`flex-1 flex flex-col w-full max-w-[1920px] mx-auto overflow-hidden h-screen`}>
          {/* --- Global Header --- */}
          <header className="flex justify-between items-center p-4 md:px-8 border-b border-white/5 backdrop-blur-md z-20">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 md:hidden bg-slate-800 rounded-xl text-slate-400"
              >
                <Menu size={24} />
              </button>
              <h2 className={`font-black tracking-widest text-xl ${theme === 'white' ? 'text-black' : 'text-white'}`}>
                Nano
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleOpenSettings}
                title="إعدادات المظهر"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${theme === 'white'
                  ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'bg-slate-800/40 border-white/5 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Palette size={20} className="text-blue-500" />
                <span className="text-xs font-black hidden md:inline">المظهر</span>
              </button>

              {/* N8N Sync Admin Toggle */}
              {userData.role === 'admin' || userData.name === 'Abdallah' || userData.name === 'Admin' || true ? (
                <button
                  onClick={() => setIsN8nMode(!isN8nMode)}
                  title={isN8nMode ? "إيقاف وضع الأداة الذكية (n8n)" : "تفعيل وضع الأداة الذكية (n8n)"}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${isN8nMode
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : theme === 'white' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-slate-800/40 border-white/5 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  <Server size={20} className={isN8nMode ? "text-white animate-pulse" : "text-slate-400"} />
                  <span className="text-xs font-black hidden md:inline">{isN8nMode ? 'n8n متصل' : 'n8n غير متصل'}</span>
                </button>
              ) : null}
            </div>
          </header>

          <div className={`flex-1 overflow-y-auto custom-scrollbar ${activeTab === 'agent' ? 'p-0' : 'p-6 md:p-12'}`}>
            {activeTab === "dashboard" && (
              <DashboardHome setActiveTab={setActiveTab} userData={userData} theme={theme} />
            )}
            {activeTab === "quiz" && <QuizSection subjectsData={subjectsData} userData={userData} theme={theme} selectedModel={selectedModel} />}
            {activeTab === "materials" && <MaterialsSection subjectsData={subjectsData} theme={theme} />}
            {activeTab === "agent" && (
              <AgentSection
                userData={userData}
                subjectsData={subjectsData}
                cooldown={cooldown}
                setCooldown={setCooldown}
                focusedSubject={focusedSubject}
                setFocusedSubject={setFocusedSubject}
                activeArchiveId={activeArchiveId}
                setActiveArchiveId={setActiveArchiveId}
                nanoLectures={nanoLectures}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                theme={theme}
                isN8nMode={isN8nMode}
              />
            )}
            {activeTab === "history" && (
              <HistorySection
                setActiveTab={setActiveTab}
                setActiveArchiveId={setActiveArchiveId}
                theme={theme}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
