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

  // فتح الموديل
  startBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  // غلق الموديل عند الضغط على الزر
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // غلق عند الضغط خارج المحتوى
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // إرسال WhatsApp
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

    // مسح الحقول
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

// اظهار المشروع الأول
if (projects.length > 0) showProject(currentIndex);

// التالي
if (btnRight) btnRight.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % projects.length;
  showProject(currentIndex);
});

// السابق
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

// يغلق القائمة عند اختيار أي قسم
links.forEach(link => {
  link.addEventListener('click', () => {
    sidebar.classList.remove('active');
    toggleBtn.classList.remove('active');
  });
});
