// زر فتح / غلق القائمة الجانبية

const toggleBtn = document.getElementById('toggleBtn');
const sidebar = document.getElementById('sidebar');
const dropdowns = document.querySelectorAll('.dropdown > a');

toggleBtn.addEventListener('click', () => {
  sidebar.classList.toggle('active');
  toggleBtn.innerHTML = sidebar.classList.contains('active')
    ? '<i class="fa-solid fa-xmark"></i>'
    : '<i class="fa-solid fa-bars"></i>';
});

// القوائم الفرعية (Products / Users)
dropdowns.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const parent = link.parentElement;
    parent.classList.toggle('active');

    // إضافة تأثيرات إضاءة أثناء الفتح
    const icon = link.querySelector('.fa-chevron-down');
    if (icon) icon.classList.toggle('rotate');

    // غلق باقي القوائم عند فتح واحدة
    dropdowns.forEach(other => {
      if (other !== link) other.parentElement.classList.remove('active');
    });
  });
});

// تأثير نيون بسيط على العناصر عند النقر
const links = document.querySelectorAll('#sidebar ul li a');
links.forEach(a => {
  a.addEventListener('click', e => {
    links.forEach(l => l.classList.remove('active'));
    a.classList.add('active');
  });
});

