// Цей файл відповідає за все, що пов'язано з автентифікацією: токени, вхід, реєстрація, отримання ID користувача.

// --- Функції для роботи з токеном ---
export const getToken = () => {
    return localStorage.getItem('authToken');
};

export const setToken = (token) => {
    localStorage.setItem('authToken', token);
};

export const removeToken = () => {
    localStorage.removeItem('authToken');
};

// --- Функція для отримання заголовків запиту ---
export const getAuthHeaders = (isJson = true) => {
    const token = getToken();
    const headers = {}; // Створюємо порожній об'єкт
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
};

// --- Функції для парсингу JWT та отримання ID ---
const parseJwt = (token) => {
    if (!token) { return null; }
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Помилка парсингу JWT:", e);
        return null;
    }
};

const getMyUserIdInternal = () => {
    const token = getToken();
    if (!token) {
        return null;
    }
    const payload = parseJwt(token);
    if (!payload) {
        removeToken(); // Токен пошкоджений, видаляємо
        return null;
    }
    // 'exp' (expiry) в JWT – це секунди, а Date.now() – мілісекунди
    if (payload.exp && (payload.exp * 1000 < Date.now())) {
        console.log("JWT токен протермінований. Видаляємо.");
        removeToken(); // Токен протермінований, видаляємо
        return null; // Вважаємо користувача неавторизованим
    }
    // Якщо токен валідний, повертаємо ID
    return payload.userId;
};

// ID поточного користувача (обчислюється один раз при завантаженні)
export const MY_USER_ID = getMyUserIdInternal();

// --- Логіка реєстрації ---
export const handleRegistration = async () => {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (data.password !== data.confirm_password) {
            alert('Помилка: Паролі не співпадають.');
            return;
        }

        const registrationData = {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            password: data.password
        };

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData),
            });

            if (response.status === 201) {
                const result = await response.json();
                alert(`Успіх! ${result.message}. Тепер ви можете увійти.`);
                form.reset();
                window.location.href = 'login.html';
            } else {
                const errorData = await response.json();
                alert(`Помилка реєстрації: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка мережі/сервера при реєстрації:', error);
            alert('Не вдалося з’єднатися з сервером. Перевірте консоль.');
        }
    });
};

// --- Логіка входу ---
export const handleLogin = async () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Якщо користувач вже увійшов (має дійсний токен), перекидаємо в профіль
    if (MY_USER_ID) {
        window.location.href = 'profile.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const result = await response.json();
                setToken(result.token); // Зберігаємо токен
                alert(`Вітаємо, ${result.user.first_name}!`);
                window.location.href = 'index.html'; // Перенаправляємо на головну
            } else {
                const errorData = await response.json();
                alert(`Помилка входу: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка мережі/сервера при логіні:', error);
            alert('Не вдалося з’єднатися з сервером.');
        }
    });
};