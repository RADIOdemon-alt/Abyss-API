import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCBTPlQVGgqL1MmDuZRSJMlS244AtAzZ6E",
  authDomain: "web-zone-c95aa.firebaseapp.com",
  projectId: "web-zone-c95aa",
  storageBucket: "web-zone-c95aa.firebasestorage.app",
  messagingSenderId: "776469157795",
  appId: "1:776469157795:web:d69518695895cff22e2c16",
  measurementId: "G-9NLEWJYZ6J"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// توليد ID عشوائي
function generateId() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// الرسائل
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

// الترحيب
function showWelcome(msg) {
  const welcomeBox = document.getElementById("welcome-box");
  welcomeBox.textContent = msg;
  welcomeBox.style.display = "block";
}

// التبديل بين الكاردين
window.toggleForms = function() {
  const loginBox = document.getElementById("login-box");
  const registerBox = document.getElementById("register-box");
  loginBox.classList.toggle("hidden");
  registerBox.classList.toggle("hidden");
};

// تسجيل جديد
window.register = async function() {
  const name = document.getElementById("reg-name").value;
  const phone = document.getElementById("reg-phone").value;
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;

  // الدول
  const selected = document.getElementById("reg-phone");
  const countryName = selected.dataset.name;
  const countryCode = selected.dataset.code;
  const countryFlag = selected.dataset.flag;

  if(!name || !phone || !email || !password || !countryName){
    showMessage("❌ الرجاء تعبئة جميع الحقول واختيار الدولة", "error");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      id: generateId(),
      name: name,
      country: countryName,
      countryCode: countryCode,
      countryFlag: countryFlag,
      phone: phone,
      email: email,
      role: "user"
    });

    showMessage("✅ تم التسجيل بنجاح!", "success");
    toggleForms();

  } catch (error) {
    let msg = "❌ خطأ غير معروف";
    if(error.code==="auth/email-already-in-use") msg="❌ البريد الإلكتروني مستخدم مسبقًا";
    else if(error.code==="auth/invalid-email") msg="❌ البريد الإلكتروني غير صالح";
    else if(error.code==="auth/weak-password") msg="❌ كلمة المرور ضعيفة";
    showMessage(msg, "error");
    console.error(error);
  }
};

// تسجيل دخول
window.login = async function() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if(!email || !password){
    showMessage("❌ الرجاء إدخال البريد الإلكتروني وكلمة المرور", "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showWelcome(`🎉 مرحبًا بك!`);
    setTimeout(()=>{
      window.location.href = "pages/home/index.html";
    }, 1500);
  } catch(error) {
    let msg = "❌ البريد أو كلمة المرور غير صحيحة";
    showMessage(msg, "error");
    console.error(error);
  }
};

// ======= Discord style اختيار الدول =======
const countrySelect = document.getElementById("country-select");
const selectedDiv = countrySelect.querySelector(".selected");
const optionsList = document.getElementById("country-options");
const phoneInput = document.getElementById("reg-phone");

let countriesList = [];

async function loadCountries() {
  try {
    const res = await fetch("assets/Settings/countries.json");
    const countries = await res.json();
    countries.sort((a,b)=>a.name.localeCompare(b.name));
    countriesList = countries;

    // ملء قائمة options
    optionsList.innerHTML = "";
    countries.forEach(c => {
      const li = document.createElement("li");
      li.className = "option-item";
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

    // قيمة افتراضية
    if(countries.length > 0){
      const first = countries[0];
      selectedDiv.textContent = `${first.flag} ${first.name}`;
      phoneInput.value = `+${first.code}`;
      phoneInput.dataset.name = first.name;
      phoneInput.dataset.code = first.code;
      phoneInput.dataset.flag = first.flag;
    }

  } catch(err) {
    console.error("فشل تحميل الدول", err);
  }
}

loadCountries();

// فتح/إغلاق القائمة عند الضغط على selected
selectedDiv.addEventListener("click", () => {
  optionsList.classList.toggle("hidden");
});

// إغلاق القائمة عند الضغط خارجها
document.addEventListener("click", (e) => {
  if(!countrySelect.contains(e.target)){
    optionsList.classList.add("hidden");
  }
});
