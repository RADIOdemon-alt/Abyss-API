// main.js — نسخة ذكية كاملة بدون Firebase

// ===== تأثير الكتابة =====
function typeWriter(text, el, speed = 100) {
  el.textContent = "";
  let i = 0;
  function type() {
    if (i < text.length) {
      el.textContent += text[i];
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}
typeWriter("Welcome to API PAGE", document.getElementById("typewriter"), 80);

// ===== رسائل تنبيه =====
const msgBox = document.getElementById("msgBox");
function showMessage(text, type = "error") {
  msgBox.textContent = text;
  msgBox.className = `msgBox ${type}`;
  msgBox.style.display = "block";
  setTimeout(() => (msgBox.style.display = "none"), 2500);
}

// ===== مودال اختبار API =====
const apiModal = document.createElement("div");
apiModal.id = "apiModal";
apiModal.className = "api-modal";
apiModal.innerHTML = `
  <div class="api-modal-content">
    <span class="close-btn">&times;</span>
    <h2>🧪 API Tester</h2>
    <button id="showHint" class="hint-btn">💡 شرح سريع</button>
    <p class="hint">أدخل المدخل المناسب لاختبار الـ API 👇</p>
    <input type="text" id="fixedApi" readonly class="api-fixed" />
    <div class="input-group">
      <input type="text" id="userInput" placeholder="أدخل النص أو الرابط هنا..." class="api-input" />
      <button id="runTest">Get</button>
    </div>
    <div class="progress-bar"><div class="progress"></div></div>
    <pre id="apiResult"></pre>
  </div>
`;
document.body.appendChild(apiModal);

const closeBtn = apiModal.querySelector(".close-btn");
const fixedApi = apiModal.querySelector("#fixedApi");
const userInput = apiModal.querySelector("#userInput");
const runTest = apiModal.querySelector("#runTest");
const showHint = apiModal.querySelector("#showHint");
const progressBar = apiModal.querySelector(".progress");
const apiResult = apiModal.querySelector("#apiResult");
const hintParagraph = apiModal.querySelector(".hint");

let currentParam = "prompt"; // نوع البراميتر الحالي

// ===== إغلاق المودال =====
closeBtn.addEventListener("click", () => {
  apiModal.style.display = "none";
  progressBar.style.width = "0%";
  apiResult.textContent = "";
});
window.addEventListener("click", e => {
  if (e.target === apiModal) {
    apiModal.style.display = "none";
    progressBar.style.width = "0%";
    apiResult.textContent = "";
  }
});

// ===== فتح المودال عند الضغط على TEST =====
document.querySelectorAll(".test-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const baseApi = btn.dataset.link;
    fixedApi.value = baseApi;
    userInput.value = "";
    apiResult.textContent = "";
    progressBar.style.width = "0%";
    apiModal.style.display = "flex";

    // اكتشاف نوع البراميتر
    currentParam = baseApi.match(/\?(prompt|url|image|img)=/i)?.[1] || "prompt";
    updateHintText();
  });
});

// ===== الشرح الذكي =====
function updateHintText() {
  let msg = "";
  switch (currentParam) {
    case "prompt":
      msg = "✏️ هذا النوع يحتاج منك كتابة نص فقط (وليس رابطًا). مثال: 'ولد أنمي يضحك'.";
      break;
    case "url":
      msg = "🔗 هذا النوع يقبل رابط فقط. مثال: https://example.com/video.mp4";
      break;
    case "image":
    case "img":
      msg = "🖼️ هذا النوع يقبل رابط صورة فقط. مثال: https://example.com/image.jpg";
      break;
    default:
      msg = "🧠 أدخل البيانات المناسبة حسب نوع الـ API.";
  }
  hintParagraph.textContent = msg;
}

showHint.addEventListener("click", () => {
  updateHintText();
  showMessage("💡 تمت إظهار الشرح في الأعلى", "success");
});

// ===== تشغيل الاختبار =====
runTest.addEventListener("click", async () => {
  let base = fixedApi.value.trim();
  let input = userInput.value.trim();

  if (!base) return showMessage("⚠️ لا يوجد رابط API محدد.", "error");
  if (!input) return showMessage("✏️ أدخل قيمة للاختبار.", "error");

  // ✅ تحويل المسافات إلى +
  input = input.replace(/\s+/g, "+");

  // تحديد ما إذا كان الرابط يقبل URL أو نص
  const isUrlParam = ["url", "image", "img"].includes(currentParam);

  if (isUrlParam && !/^https?:\/\//.test(input))
    return showMessage("🔗 يُسمح فقط بالروابط هنا", "error");

  if (!isUrlParam && /^https?:\/\//.test(input))
    return showMessage("✏️ يُسمح فقط بالنصوص هنا", "error");

  // ✅ ذكاء التعامل مع prompt أو غيره
  let fullUrl = base;
  const urlObj = new URL(base, window.location.origin);

  // لو في prompt بالفعل → نبدله
  if (urlObj.searchParams.has(currentParam)) {
    urlObj.searchParams.set(currentParam, input);
    fullUrl = urlObj.toString();
  } else {
    // لو مافيش بارامتر prompt نضيفه بشكل مناسب
    if (base.includes("?")) {
      fullUrl = `${base}&${currentParam}=${input}`;
    } else {
      fullUrl = `${base}?${currentParam}=${input}`;
    }
  }

  // ===== عرض الرابط وزر النسخ =====
  apiResult.innerHTML = `
    <div class="api-url-box">
      <code>${fullUrl}</code>
      <button class="copy-url-btn" title="نسخ الرابط">📋</button>
    </div>
    <br>⏳ جاري اختبار الـAPI...
  `;

  // زر النسخ
  const copyBtn = apiResult.querySelector(".copy-url-btn");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      copyBtn.textContent = "✅";
      showMessage("📋 تم نسخ الاستجابة", "success");
      setTimeout(() => (copyBtn.textContent = "📋"), 1500);
    } catch {
      showMessage("❌ فشل في النسخ", "error");
    }
  });

  progressBar.style.width = "0%";
  progressBar.style.transition = "width 2s linear";
  setTimeout(() => (progressBar.style.width = "100%"), 50);

  try {
    const res = await fetch(fullUrl, { method: "GET" });
    const contentType = res.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await res.text();
      throw new Error(`❌ الاستجابة ليست JSON:\n\n${text.slice(0, 200)}...`);
    }

    const data = await res.json();
    setTimeout(() => {
      apiResult.innerHTML = `
        <div class="api-url-box">
          <code>${fullUrl}</code>
          <button class="copy-url-btn" title="نسخ الرابط">📋</button>
        </div>
        <br><pre>${JSON.stringify(data, null, 2)}</pre>
      `;

      const copyBtn2 = apiResult.querySelector(".copy-url-btn");
      copyBtn2.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(fullUrl);
          copyBtn2.textContent = "✅";
          showMessage("📋 تم نسخ الاستجابة", "success");
          setTimeout(() => (copyBtn2.textContent = "📋"), 1500);
        } catch {
          showMessage("❌ فشل في النسخ", "error");
        }
      });
    }, 2000);
  } catch (err) {
    progressBar.style.width = "100%";
    apiResult.textContent = "❌ فشل في الاتصال بالـAPI:\n" + err;
    console.error(err);
  }
});

// ===== أزرار النسخ العامة =====
document.querySelectorAll(".copy-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "✅";
      showMessage("📋 Copied successfully!", "success");
      setTimeout(() => (btn.textContent = "Copy"), 1500);
    } catch {
      showMessage("❌ Failed to copy", "error");
    }
  });
});

// ===== أزرار الكود =====
document.querySelectorAll(".code-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    window.open(btn.dataset.whatsapp, "_blank");
  });
});

// ===== القائمة الجانبية =====
const toggleBtn = document.getElementById("toggleBtn");
const sidebar = document.getElementById("sidebar");
const dropdowns = document.querySelectorAll(".dropdown > a");

toggleBtn.addEventListener("click", () => {
  sidebar.classList.toggle("active");
  toggleBtn.innerHTML = sidebar.classList.contains("active")
    ? '<i class="fa-solid fa-xmark"></i>'
    : '<i class="fa-solid fa-bars"></i>';
});

dropdowns.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const parent = link.parentElement;
    parent.classList.toggle("active");
    const icon = link.querySelector(".fa-chevron-down");
    if (icon) icon.classList.toggle("rotate");

    dropdowns.forEach(other => {
      if (other !== link) other.parentElement.classList.remove("active");
    });
  });
});

// ===== تفعيل اللمعان في الروابط =====
const links = document.querySelectorAll("#sidebar ul li a");
links.forEach(a => {
  a.addEventListener("click", () => {
    links.forEach(l => l.classList.remove("active"));
    a.classList.add("active");
  });
});
