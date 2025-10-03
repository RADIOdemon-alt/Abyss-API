// العناصر
const loginCard = document.getElementById("loginCard");
const registerCard = document.getElementById("registerCard");
const toRegister = document.getElementById("toRegister");
const toLogin = document.getElementById("toLogin");

// عند البداية يظهر كارد تسجيل الدخول
loginCard.style.transform = "rotateY(0deg)";
loginCard.style.opacity = "1";
registerCard.style.transform = "rotateY(15deg)";
registerCard.style.opacity = "0";

// دالة تبديل الكارد مع دوران خفيف
function showCard(cardToShow, cardToHide) {
    cardToHide.style.transform = "rotateY(-15deg)";
    cardToHide.style.opacity = "0";
    cardToShow.style.transform = "rotateY(0deg)";
    cardToShow.style.opacity = "1";
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
    const data = { phone: form.phone.value, password: form.password.value };

    try {
        const res = await fetch("/api/auth/login", {
            method:"POST",
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(data)
        });
        const text = await res.text();
        alert(text);
    } catch(err) {
        alert("❌ حدث خطأ أثناء تسجيل الدخول");
        console.error(err);
    }
};

// تسجيل جديد
document.getElementById("registerForm").onsubmit = async e => {
    e.preventDefault();
    const form = e.target;

    if(!form.terms.checked){
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
            method:"POST",
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(data)
        });
        const text = await res.text();
        alert(text);
    } catch(err) {
        alert("❌ حدث خطأ أثناء إنشاء الحساب");
        console.error(err);
    }
};
