import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

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

// ✅ التحقق من تسجيل الدخول
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "https://abyss-api-ecru.vercel.app/";
  }
});

// ================= الكود بتاعك =================

// العناصر الرئيسية
const startBtn = document.getElementById('startProjectBtn');
const modal = document.getElementById('projectForm');
const closeBtn = document.getElementById('closeForm');
const sendBtn = document.getElementById('sendBtn');

const projects = document.querySelectorAll('.project-card');
let currentIndex = 0;
const btnLeft = document.querySelector('.slider-btn-left');
const btnRight = document.querySelector('.slider-btn-right');

// ======== فتح وغلق الموديل ========
if (startBtn && modal && closeBtn && sendBtn) {
  startBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  sendBtn.addEventListener('click', () => {
    const name = document.getElementById('nameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();
    const request = document.getElementById('requestInput').value.trim();

    if (!name || !email || !request) {
      alert('من فضلك املأ جميع الحقول');
      return;
    }

    const message = `مرحبًا، أنا ${name}\nالبريد الإلكتروني: ${email}\nطلبي: ${request}`;
    const waLink = `https://wa.me/201500564191?text=${encodeURIComponent(message)}`;
    const win = window.open(waLink, '_blank');
    if (!win) alert('تعذر فتح WhatsApp. تحقق من إعدادات منع النوافذ المنبثقة.');

    document.getElementById('nameInput').value = '';
    document.getElementById('emailInput').value = '';
    document.getElementById('requestInput').value = '';

    modal.style.display = 'none';
  });
}

// ======== Projects Slider ========
function showProject(index) {
  projects.forEach((p, i) => {
    p.classList.remove('active');
    if (i === index) p.classList.add('active');
  });
}
if (projects.length > 0) showProject(currentIndex);

if (btnRight) btnRight.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % projects.length;
  showProject(currentIndex);
});

if (btnLeft) btnLeft.addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + projects.length) % projects.length;
  showProject(currentIndex);
});

// ======== Clients Slider Scroll ========
let clientSlider = document.querySelector('.clients-slider');
if (clientSlider) {
  clientSlider.addEventListener('wheel', e => {
    e.preventDefault();
    clientSlider.scrollLeft += e.deltaY;
  });
}

const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggleBtn');
const links = document.querySelectorAll('#sidebar a');

toggleBtn.addEventListener('click', () => {
  sidebar.classList.toggle('active');
  toggleBtn.classList.toggle('active');
});

links.forEach(link => {
  link.addEventListener('click', () => {
    sidebar.classList.remove('active');
    toggleBtn.classList.remove('active');
  });
});
