// العناصر
const loginCard = document.getElementById("loginCard");
const registerCard = document.getElementById("registerCard");
const toRegister = document.getElementById("toRegister");
const toLogin = document.getElementById("toLogin");

// عند البداية يظهر كارد تسجيل الدخول
loginCard.classList.add("active");
registerCard.classList.remove("active");

// دالة تبديل الكارد
function showCard(cardToShow, cardToHide) {
    cardToHide.classList.remove("active");
    cardToShow.classList.add("active");
}

// التحويل لتسجيل جديد
toRegister.onclick = () => {
    showCard(registerCard, loginCard);
};

// العودة لتسجيل الدخول
toLogin.onclick = () => {
    showCard(loginCard, registerCard);
};

// تسجيل الدخول
document.getElementById("loginForm").onsubmit = async e => {
    e.preventDefault();
    const form = e.target;
    const data = {
        phone: form.phone.value,
        password: form.password.value
    };

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const text = await res.text();
        alert(text);
    } catch (err) {
        alert("❌ حدث خطأ أثناء تسجيل الدخول");
        console.error(err);
    }
};

// تسجيل جديد
document.getElementById("registerForm").onsubmit = async e => {
    e.preventDefault();
    const form = e.target;

    // التحقق من الشروط والأحكام
    if (!form.terms.checked) {
        alert("❌ يجب الموافقة على الشروط والأحكام");
        return;
    }

    const data = {
        name: form.name.value,
        phone: form.phone.value,
        email: form.email.value,
        password: form.password.value,
        confirmPassword: form.confirmPassword.value
    };

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const text = await res.text();
        alert(text);
    } catch (err) {
        alert("❌ حدث خطأ أثناء إنشاء الحساب");
        console.error(err);
    }
};
