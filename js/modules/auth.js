export const getToken = () => localStorage.getItem('authToken');
export const setToken = (token) => localStorage.setItem('authToken', token);
export const removeToken = () => localStorage.removeItem('authToken');

const parseJwt = (token) => {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT parsing error:", e);
        return null;
    }
};

/**
 * Отримує ID поточного автентифікованого користувача з токена.
 * Також перевіряє термін дії токена (exp claim) і видаляє його, якщо він прострочений.
 * @returns {number|null} ID користувача або null.
 */
export const getMyUserId = () => {
    const token = getToken();
    if (!token) return null;

    const payload = parseJwt(token);
    if (!payload) {
        removeToken();
        return null;
    }

    if (payload.exp && (payload.exp * 1000 < Date.now())) {
        console.log("JWT token expired. Removing.");
        removeToken();
        return null;
    }
    return payload.userId;
};

/**
 * Створює об'єкт заголовків для HTTP-запитів.
 * Автоматично додає заголовок Authorization з Bearer токеном, якщо він є.
 * @param {boolean} [isJson=true] - Якщо true, додає 'Content-Type: application/json'.
 * @returns {object} Об'єкт із заголовками.
 */
export const getAuthHeaders = (isJson = true) => {
    const token = getToken();
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
};

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

export const handleLogin = async () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    if (getMyUserId()) {
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
                setToken(result.token);
                alert(`Вітаємо, ${result.user.first_name}!`);
                window.location.href = 'index.html';
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

// Обробляє форми зміни Email та Пароля на сторінці login_settings.html.
export const handleLoginSettings = () => {
    const changeEmailForm = document.getElementById('changeEmailForm');
    const changePasswordForm = document.getElementById('changePasswordForm');

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб змінити налаштування.');
        window.location.href = 'login.html';
        return;
    }

    if (changeEmailForm) {
        changeEmailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(changeEmailForm);
            const data = Object.fromEntries(formData.entries());

            const submitButton = changeEmailForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Зміна...';

            try {
                const response = await fetch('http://localhost:3000/api/profile/change-email', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    alert('Email успішно оновлено!');
                    changeEmailForm.reset();
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Невідома помилка');
                }
            } catch (error) {
                alert(`Помилка: ${error.message}`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Змінити Email';
            }
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(changePasswordForm);
            const data = Object.fromEntries(formData.entries());

            if (data.new_password !== data.confirm_new_password) {
                alert('Помилка: Нові паролі не співпадають.');
                return;
            }

            const submitButton = changePasswordForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Зміна...';

            try {
                const response = await fetch('http://localhost:3000/api/profile/change-password', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        old_password: data.old_password,
                        new_password: data.new_password
                    })
                });

                if (response.ok) {
                    alert('Пароль успішно оновлено!');
                    changePasswordForm.reset();
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Невідома помилка');
                }
            } catch (error) {
                alert(`Помилка: ${error.message}`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Змінити Пароль';
            }
        });
    }
};

export const MY_USER_ID = getMyUserId();