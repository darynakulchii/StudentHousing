// =================================================================================
// AUTHENTICATION MODULE
// =================================================================================

// Отримує токен автентифікації з localStorage.
export const getToken = () => localStorage.getItem('authToken');

// Зберігає токен автентифікації в localStorage.
export const setToken = (token) => localStorage.setItem('authToken', token);

// Видаляє токен автентифікації з localStorage.
export const removeToken = () => localStorage.removeItem('authToken');

// Розбирає JWT токен для отримання payload (даних користувача).
const parseJwt = (token) => {
    if (!token) return null;
    try {
        // Стандартний процес декодування Base64Url
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT parsing error:", e);
        return null; // Повертаємо null при помилці розбору
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
        removeToken(); // Видаляємо невалідний токен
        return null;
    }

    // Перевірка терміну дії токена (exp в секундах -> порівнюємо з мс)
    if (payload.exp && (payload.exp * 1000 < Date.now())) {
        console.log("JWT token expired. Removing.");
        removeToken(); // Видаляємо прострочений токен
        return null;
    }

    return payload.userId; // Повертаємо ID користувача з payload
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
        headers['Authorization'] = `Bearer ${token}`; // Стандартний формат для JWT
    }
    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
};

// Обробляє відправку форми реєстрації.
export const handleRegistration = async () => {
    const form = document.getElementById('registerForm');
    if (!form) return; // Виходимо, якщо форма не знайдена

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Запобігаємо стандартній відправці
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Перевірка співпадіння паролів
        if (data.password !== data.confirm_password) {
            alert('Помилка: Паролі не співпадають.');
            return;
        }

        // Формуємо дані тільки для API реєстрації
        const registrationData = {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            password: data.password
        };

        try {
            // Відправляємо запит на сервер
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData),
            });

            if (response.status === 201) { // Успішна реєстрація (Created)
                const result = await response.json();
                alert(`Успіх! ${result.message}. Тепер ви можете увійти.`);
                form.reset(); // Очищуємо форму
                window.location.href = 'login.html'; // Перенаправляємо на сторінку входу
            } else {
                // Обробка помилок сервера (напр., email вже існує)
                const errorData = await response.json();
                alert(`Помилка реєстрації: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            // Обробка мережевих помилок
            console.error('Помилка мережі/сервера при реєстрації:', error);
            alert('Не вдалося з’єднатися з сервером. Перевірте консоль.');
        }
    });
};

// Обробляє відправку форми входу.
export const handleLogin = async () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Якщо користувач вже авторизований, перенаправляємо його в профіль
    if (getMyUserId()) {
        window.location.href = 'profile.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            // Відправляємо запит на сервер
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (response.ok) { // Успішний вхід
                const result = await response.json();
                setToken(result.token); // Зберігаємо отриманий токен
                alert(`Вітаємо, ${result.user.first_name}!`);
                window.location.href = 'index.html'; // Перенаправляємо на головну сторінку
            } else {
                // Обробка помилок сервера (напр., неправильний пароль)
                const errorData = await response.json();
                alert(`Помилка входу: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            // Обробка мережевих помилок
            console.error('Помилка мережі/сервера при логіні:', error);
            alert('Не вдалося з’єднатися з сервером.');
        }
    });
};

// Обробляє форми зміни Email та Пароля на сторінці login_settings.html.
export const handleLoginSettings = () => {
    const changeEmailForm = document.getElementById('changeEmailForm');
    const changePasswordForm = document.getElementById('changePasswordForm');

    // Перевірка авторизації
    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб змінити налаштування.');
        window.location.href = 'login.html';
        return;
    }

    // Обробник форми зміни Email
    if (changeEmailForm) {
        changeEmailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(changeEmailForm);
            const data = Object.fromEntries(formData.entries());

            const submitButton = changeEmailForm.querySelector('button[type="submit"]');
            submitButton.disabled = true; // Блокуємо кнопку на час запиту
            submitButton.textContent = 'Зміна...';

            try {
                // Відправляємо запит на зміну email
                const response = await fetch('http://localhost:3000/api/profile/change-email', {
                    method: 'POST',
                    headers: getAuthHeaders(), // Додаємо токен
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    alert('Email успішно оновлено!');
                    changeEmailForm.reset(); // Очищуємо форму
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Невідома помилка');
                }
            } catch (error) {
                alert(`Помилка: ${error.message}`);
            } finally {
                submitButton.disabled = false; // Розблоковуємо кнопку
                submitButton.textContent = 'Змінити Email';
            }
        });
    }

    // Обробник форми зміни Паролю
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(changePasswordForm);
            const data = Object.fromEntries(formData.entries());

            // Перевірка співпадіння нових паролів
            if (data.new_password !== data.confirm_new_password) {
                alert('Помилка: Нові паролі не співпадають.');
                return;
            }
            // TODO: Додати валідацію складності нового пароля

            const submitButton = changePasswordForm.querySelector('button[type="submit"]');
            submitButton.disabled = true; // Блокуємо кнопку
            submitButton.textContent = 'Зміна...';

            try {
                // Відправляємо запит на зміну пароля
                const response = await fetch('http://localhost:3000/api/profile/change-password', {
                    method: 'POST',
                    headers: getAuthHeaders(), // Додаємо токен
                    body: JSON.stringify({
                        old_password: data.old_password,
                        new_password: data.new_password // Надсилаємо тільки потрібні поля
                    })
                });

                if (response.ok) {
                    alert('Пароль успішно оновлено!');
                    changePasswordForm.reset(); // Очищуємо форму
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Невідома помилка');
                }
            } catch (error) {
                alert(`Помилка: ${error.message}`);
            } finally {
                submitButton.disabled = false; // Розблоковуємо кнопку
                submitButton.textContent = 'Змінити Пароль';
            }
        });
    }
};

// Глобальна константа з ID поточного користувача (або null)
export const MY_USER_ID = getMyUserId();