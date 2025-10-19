document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "https://dark-api-x.vercel.app/api/firebase";
  const API_KEY = "drk_iARHZmYf0ODK8m3WuDmKl0K9nHSMQZ35Zkwa";

  // ===== الرسائل =====
  function showMessage(msg, type="error") {
    const messageBox = document.getElementById("message-box");
    const loginBox = document.getElementById("login-box");
    const registerBox = document.getElementById("register-box");
    messageBox.textContent = msg;
    messageBox.className = type==="error" ? "message-box error" : "message-box success";
    messageBox.style.display = "block";

    loginBox.style.visibility = "hidden";
    registerBox.style.visibility = "hidden";

    setTimeout(()=>{
      messageBox.style.display = "none";
      loginBox.style.visibility = "visible";
      registerBox.style.visibility = "visible";
    }, 3000);
  }

  // ===== التبديل بين النماذج =====
  function toggleForms() {
    const loginBox = document.getElementById("login-box");
    const registerBox = document.getElementById("register-box");
    loginBox.classList.toggle("hidden");
    registerBox.classList.toggle("hidden");
  }

  // ===== قائمة الدول =====
  const countriesList = [
    { "name": "مصر", "code": "20", "flag": "🇪🇬" },
    { "name": "السعودية", "code": "966", "flag": "🇸🇦" },
    { "name": "الإمارات", "code": "971", "flag": "🇦🇪" },
    { "name": "الكويت", "code": "965", "flag": "🇰🇼" },
    { "name": "قطر", "code": "974", "flag": "🇶🇦" },
    { "name": "البحرين", "code": "973", "flag": "🇧🇭" },
    { "name": "عمان", "code": "968", "flag": "🇴🇲" },
    { "name": "اليمن", "code": "967", "flag": "🇾🇪" },
    { "name": "العراق", "code": "964", "flag": "🇮🇶" },
    { "name": "الأردن", "code": "962", "flag": "🇯🇴" },
    { "name": "لبنان", "code": "961", "flag": "🇱🇧" },
    { "name": "سوريا", "code": "963", "flag": "🇸🇾" },
    { "name": "فلسطين", "code": "970", "flag": "🇵🇸" },
    { "name": "ليبيا", "code": "218", "flag": "🇱🇾" },
    { "name": "تونس", "code": "216", "flag": "🇹🇳" },
    { "name": "الجزائر", "code": "213", "flag": "🇩🇿" },
    { "name": "المغرب", "code": "212", "flag": "🇲🇦" },
    { "name": "موريتانيا", "code": "222", "flag": "🇲🇷" },
    { "name": "السودان", "code": "249", "flag": "🇸🇩" },
    { "name": "جيبوتي", "code": "253", "flag": "🇩🇯" },
    { "name": "الصومال", "code": "252", "flag": "🇸🇴" },
    { "name": "جزر القمر", "code": "269", "flag": "🇰🇲" }
  ];

  const countrySelect = document.getElementById("country-select");
  const selectedDiv = countrySelect.querySelector(".selected");
  const optionsList = document.getElementById("country-options");
  const phoneInput = document.getElementById("reg-phone");

  function populateCountries() {
    countriesList.sort((a,b)=>a.name.localeCompare(b.name));
    optionsList.innerHTML = "";
    countriesList.forEach(c => {
      const li = document.createElement("li");
      li.dataset.name = c.name;
      li.dataset.code = c.code;
      li.dataset.flag = c.flag;
      li.textContent = `${c.flag} ${c.name} (+${c.code})`;
      li.addEventListener("click", () => {
        selectedDiv.textContent = `${c.flag} ${c.name}`;
        phoneInput.value = `+${c.code}`;
        phoneInput.dataset.name = c.name;
        phoneInput.dataset.code = c.code;
        phoneInput.dataset.flag = c.flag;
        optionsList.classList.add("hidden");
      });
      optionsList.appendChild(li);
    });

    if(countriesList.length > 0){
      const first = countriesList[0];
      selectedDiv.textContent = `${first.flag} ${first.name}`;
      phoneInput.value = `+${first.code}`;
      phoneInput.dataset.name = first.name;
      phoneInput.dataset.code = first.code;
      phoneInput.dataset.flag = first.flag;
    }
  }

  populateCountries();
  selectedDiv.addEventListener("click", () => optionsList.classList.toggle("hidden"));
  document.addEventListener("click", (e) => { if(!countrySelect.contains(e.target)) optionsList.classList.add("hidden"); });

  // ===== تسجيل جديد =====
  async function register() {
    const name = document.getElementById("reg-name").value.trim();
    const phone = phoneInput.value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value.trim();
    const country = {
      name: phoneInput.dataset.name || "",
      code: phoneInput.dataset.code || "",
      flag: phoneInput.dataset.flag || ""
    };

    if (!name || !phone || !email || !password) {
      showMessage("❌ الرجاء تعبئة جميع الحقول", "error");
      return;
    }

    const payload = { name, phone, email, password, country };

    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showPopup(`Welcome ${name}!\nOn the dark API platform`, [
          { title: "𝐑𝐀𝐃𝐈𝐎 𝐃𝐄𝐌𝐎𝐍", subtitle: "Developer" },
          { title: "IZANA", subtitle: "Co-Developer" }
        ]);
        toggleForms();
      } else {
        showMessage(data.message, "error");
      }
    } catch (err) {
      console.error(err);
      showMessage("❌ حدث خطأ أثناء التسجيل", "error");
    }
  }

  // ===== تسجيل دخول =====
  async function login() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
      showMessage("❌ الرجاء إدخال البريد الإلكتروني وكلمة المرور", "error");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        showPopup(`Welcome ${data.userName || "User"}!\nOn the dark API platform`, [
          { title: "𝐑𝐀𝐃𝐈𝐎 𝐃𝐄𝐌𝐎𝐍", subtitle: "Developer" },
          { title: "IZANA", subtitle: "Co-Developer" }
        ]);
      } else {
        showMessage(data.message || "❌ البريد أو كلمة المرور غير صحيحة", "error");
      }
    } catch (err) {
      console.error(err);
      showMessage("❌ حدث خطأ أثناء تسجيل الدخول", "error");
    }
  }

  // ===== البوب أب =====
  function showPopup(message, cards=[]) {
    const loginBox = document.getElementById("login-box");
    const registerBox = document.getElementById("register-box");
    loginBox.classList.add("hide");
    registerBox.classList.add("hide");

    const popup = document.createElement("div");
    popup.className = "popup-box";
    popup.style.fontFamily = "'Cairo', sans-serif";
    popup.innerHTML = `
      <div class="popup-message">${message.replace(/\n/g,"<br>")}</div>
      <div class="popup-cards">
        ${cards.map(c => `<div class="card"><h3>${c.title}</h3><p>${c.subtitle}</p></div>`).join("")}
      </div>
    `;
    document.body.appendChild(popup);
    popup.style.animation = "fadeIn 0.5s ease";

    setTimeout(() => {
      popup.remove();
      window.location.href = "https://dark-api-x.vercel.app/home/";
    }, 5000);
  }

  // ربط الدوال بالـ window
  window.toggleForms = toggleForms;
  window.register = register;
  window.login = login;
});
