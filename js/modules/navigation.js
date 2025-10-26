// =================================================================================
// NAVIGATION MODULE
// =================================================================================

import { MY_USER_ID, getAuthHeaders, removeToken } from './auth.js';

// --- Глобальні змінні модуля (UI елементи та стан) ---
export let mobileMenuWindow, filterSidebar, notificationSidebar, overlay, notificationBadge;
export let currentNotificationCount = 0; // Внутрішній лічильник непрочитаних сповіщень
export const DEFAULT_AVATAR_URL = 'https://placehold.co/120x120/EBF4FF/7F9CF5?text=User';

// --- Функції керування бічними панелями ---

// Універсальна функція для показу/приховування бічних панелей та overlay.
const toggleSidebar = (sidebar, action) => {
    if (!sidebar || !overlay) return; // Перевірка наявності елементів
    const isOpen = sidebar.classList.contains('open');

    if (action === 'open' && !isOpen) {
        sidebar.classList.add('open');
        overlay.classList.add('active'); // Показати затемнення
        document.body.style.overflow = 'hidden'; // Заборонити прокрутку сторінки
    } else if (action === 'close' && isOpen) {
        sidebar.classList.remove('open');
        // Перевіряємо, чи інші сайдбари відкриті, перед тим як ховати overlay
        const anySidebarOpen = [mobileMenuWindow, filterSidebar, notificationSidebar].some(s => s?.classList.contains('open'));
        if (!anySidebarOpen) {
            overlay.classList.remove('active'); // Сховати затемнення, якщо всі панелі закриті
            document.body.style.overflow = ''; // Дозволити прокрутку сторінки
        }
    }
};

// Експортовані функції для керування конкретними панелями
export const toggleMenu = (action) => toggleSidebar(mobileMenuWindow, action);
export const toggleFilters = (action) => toggleSidebar(filterSidebar, action);
// Обробник відкриття/закриття панелі сповіщень, включаючи позначення як прочитаних
const toggleNotifications = async (action) => {
    if (!notificationSidebar || !overlay) return;
    toggleSidebar(notificationSidebar, action);
    // Якщо панель відкривається і є непрочитані сповіщення, позначаємо їх як прочитані
    if (action === 'open' && currentNotificationCount > 0) {
        await markNotificationsAsRead(); // Надсилаємо запит на бекенд
        currentNotificationCount = 0; // Скидаємо внутрішній лічильник
        updateNotificationCount(0); // Оновлюємо UI лічильник
    }
};

// --- Функції для сповіщень ---

// Оновлює UI елемент (бейдж) лічильника непрочитаних сповіщень.
export const updateNotificationCount = (count) => {
    if (!notificationBadge) return;
    if (count > 0) {
        notificationBadge.textContent = count > 9 ? '9+' : count; // Обмеження '9+'
        notificationBadge.style.display = 'flex'; // Показуємо бейдж
    } else {
        notificationBadge.style.display = 'none'; // Ховаємо бейдж
    }
};

/**
 * Збільшує лічильник непрочитаних сповіщень на 1 та оновлює UI.
 * Використовується при отриманні нового сповіщення через WebSocket.
 */
export function incrementNotificationCount() {
    currentNotificationCount++; // Збільшуємо внутрішній лічильник
    updateNotificationCount(currentNotificationCount); // Оновлюємо відображення
}

// Створює HTML-розмітку для одного елемента сповіщення.
export const renderNotificationItem = (notification) => {
    // Визначення іконки залежно від типу сповіщення
    let iconClass = 'fa-bell';
    if (notification.message.includes('повідомлення')) iconClass = 'fa-comment-dots';
    else if (notification.message.includes('вибране')) iconClass = 'fa-heart';

    const isUnread = !notification.is_read ? 'unread' : ''; // Клас для непрочитаних
    const timeAgo = notification.created_at ? new Date(notification.created_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : 'нещодавно'; // Форматування часу
    // Використання <a> для сповіщень з посиланням, <div> для інших
    const tag = notification.link_url ? 'a' : 'div';
    const href = notification.link_url ? `href="${notification.link_url}"` : '';

    return `<${tag} ${href} class="notification-item ${isUnread}" data-id="${notification.notification_id}">
                <i class="fas ${iconClass}"></i>
                <p>${notification.message}</p>
                <span class="notification-time">${timeAgo}</span>
            </${tag}>`;
};

// Завантажує сповіщення користувача з API та відображає їх у бічній панелі.
export const fetchAndDisplayNotifications = async () => {
    const container = document.querySelector('.notification-list');
    if (!container || !MY_USER_ID) return; // Вихід, якщо немає контейнера або користувач не залогінений

    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Завантаження...</p>'; // Індикатор завантаження

    try {
        const response = await fetch('http://localhost:3000/api/my-notifications', { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Не вдалося завантажити сповіщення');
        const notifications = await response.json();
        container.innerHTML = ''; // Очищення контейнера
        let unreadCount = 0;

        if (notifications.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);">У вас немає сповіщень.</p>'; // Повідомлення про відсутність сповіщень
        } else {
            notifications.forEach(n => {
                if (!n.is_read) unreadCount++; // Підрахунок непрочитаних
                container.innerHTML += renderNotificationItem(n); // Додавання HTML елемента
            });
        }
        currentNotificationCount = unreadCount; // Оновлення внутрішнього лічильника
        updateNotificationCount(currentNotificationCount); // Оновлення UI лічильника
    } catch (error) {
        console.error('Помилка завантаження сповіщень:', error);
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--danger-color);">Помилка завантаження.</p>'; // Повідомлення про помилку
    }
};

// Додає нове сповіщення на початок списку (використовується при отриманні через WebSocket).
export const prependNotification = (notification) => {
    const container = document.querySelector('.notification-list');
    if (!container) return;
    // Видаляємо плейсхолдер "Немає сповіщень" або "Завантаження...", якщо він є
    container.querySelector('p')?.remove();
    // Додаємо HTML нового сповіщення на початок контейнера
    container.insertAdjacentHTML('afterbegin', renderNotificationItem(notification));
};

// Надсилає запит на сервер для позначення всіх непрочитаних сповіщень як прочитаних.
export const markNotificationsAsRead = async () => {
    if (!MY_USER_ID) return; // Тільки для залогінених користувачів

    // Оптимізація: Не відправляти запит, якщо внутрішній лічильник вже 0.
    // Додатково перевіряємо візуальний стан на випадок розсинхронізації.
    if (currentNotificationCount === 0) {
        const unreadItemsVisual = document.querySelectorAll('#notificationSidebar .notification-item.unread');
        if (unreadItemsVisual.length === 0) return; // Вихід, якщо візуально теж немає непрочитаних
    }

    try {
        const response = await fetch('http://localhost:3000/api/my-notifications/read', {
            method: 'PATCH', // Метод для часткового оновлення
            headers: getAuthHeaders()
        });
        if (response.ok) {
            // Оновлюємо UI: знімаємо клас 'unread' з усіх елементів у бічній панелі
            document.querySelectorAll('#notificationSidebar .notification-item.unread').forEach(item => {
                item.classList.remove('unread');
            });
            currentNotificationCount = 0; // Скидаємо внутрішній лічильник
            updateNotificationCount(0); // Скидаємо UI лічильник
            console.log('Сповіщення позначено як прочитані');
        } else {
            console.error('Не вдалося позначити сповіщення як прочитані на сервері.');
        }
    } catch (error) {
        console.error('Помилка при позначенні сповіщень як прочитаних:', error);
    }
};


// --- Функції для посилань навігації ---

// Підсвічує активне посилання в навігації (десктопній та мобільній) на основі поточного шляху URL.
export const highlightActiveLink = () => {
    let currentPath = window.location.pathname.split('/').pop() || 'index.html'; // Отримуємо ім'я файлу або index.html
    // Проста евристика для додавання .html до шляхів без розширення (для сторінок типу /profile)
    if (!['index.html', 'login.html', 'register.html', ''].includes(currentPath) && !currentPath.includes('.')) {
        currentPath += '.html';
    }

    const navLinks = document.querySelectorAll('.desktop-nav a, .mobile-nav-bar a');
    navLinks.forEach(link => {
        let linkPath = link.getAttribute('data-path'); // Шлях з data-атрибута
        // Нормалізація шляхів для порівняння (прибираємо можливі '../' або 'pages/')
        linkPath = linkPath?.startsWith('../') ? linkPath.substring(3) : linkPath;
        const normalizedCurrentPath = currentPath.startsWith('pages/') ? currentPath.substring(6) : currentPath;

        // Додаємо/видаляємо клас 'active'
        if (linkPath === normalizedCurrentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

// Налаштовує видимість посилань "Увійти"/"Зареєструватись" та відображення аватара користувача.
export const setupNavLinks = async () => {
    const isLoggedIn = !!MY_USER_ID; // Перевірка наявності ID користувача
    const navLoginLink = document.getElementById('navLoginLink'); // Посилання "Увійти"
    const navRegisterLink = document.querySelector('a[href="register.html"]'); // Посилання "Зареєструватись"
    const userAvatarElement = document.querySelector('.user-avatar'); // Елемент аватара

    if (!userAvatarElement) return; // Вихід, якщо елемент аватара не знайдено

    if (isLoggedIn) {
        // Ховаємо посилання входу/реєстрації
        if (navLoginLink) navLoginLink.style.display = 'none';
        if (navRegisterLink) navRegisterLink.style.display = 'none';
        // Завантажуємо дані профілю для аватара
        try {
            const response = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
            if (response.ok) {
                const user = await response.json();
                userAvatarElement.style.backgroundImage = `url('${user.avatar_url || DEFAULT_AVATAR_URL}')`; // Встановлюємо фон аватара
            } else {
                userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`; // Аватар за замовчуванням при помилці
            }
        } catch (error) {
            console.error("Помилка завантаження аватара для хедера:", error);
            userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`; // Аватар за замовчуванням при помилці
        }
        userAvatarElement.href = 'profile.html'; // Посилання на профіль
    } else {
        // Показуємо посилання входу/реєстрації
        if (navLoginLink) navLoginLink.style.display = 'block';
        if (navRegisterLink) navRegisterLink.style.display = 'block';
        // Встановлюємо дефолтний аватар та посилання на сторінку входу
        userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
        userAvatarElement.href = 'login.html';
    }
};

// --- Головна функція ініціалізації навігації ---

// Завантажує HTML-код навігації в плейсхолдер, ініціалізує змінні модуля та встановлює обробники подій.
export const initializeNavigation = async () => {
    const placeholder = document.getElementById('navigation-placeholder');
    if (!placeholder) {
        console.error("Плейсхолдер навігації ('navigation-placeholder') не знайдено!");
        return;
    }

    const navPath = './navigation.html'; // Шлях до файлу навігації

    try {
        // Завантажуємо HTML навігації
        const response = await fetch(navPath);
        if (!response.ok) throw new Error(`Не вдалося завантажити навігацію (${navPath}): ${response.statusText}`);
        placeholder.innerHTML = await response.text(); // Вставляємо HTML в плейсхолдер

        // Ініціалізуємо глобальні змінні модуля ТІЛЬКИ ПІСЛЯ завантаження HTML
        mobileMenuWindow = document.getElementById('mobileMenuWindow');
        filterSidebar = document.getElementById('filterSidebar');
        notificationSidebar = document.getElementById('notificationSidebar');
        overlay = document.getElementById('overlay');
        notificationBadge = document.getElementById('notificationBadge');

        // Налаштування початкового стану UI
        highlightActiveLink(); // Підсвічуємо активне посилання
        await setupNavLinks(); // Налаштовуємо аватар та посилання логіну/реєстрації

        // Завантаження сповіщень (тільки для авторизованих користувачів)
        if (MY_USER_ID) {
            await fetchAndDisplayNotifications();
        } else {
            updateNotificationCount(0); // Скидаємо лічильник для гостей
        }

        // Налаштування ВСІХ слухачів подій для навігації та бічних панелей
        document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => toggleMenu('open')); // Бургер-меню
        document.getElementById('btnCloseMenu')?.addEventListener('click', () => toggleMenu('close')); // Закриття меню
        document.querySelector('.notification-icon-container')?.addEventListener('click', () => toggleNotifications('open')); // Іконка сповіщень
        document.getElementById('btnCloseNotifications')?.addEventListener('click', () => toggleNotifications('close')); // Закриття сповіщень
        document.querySelector('.filter-btn')?.addEventListener('click', () => toggleFilters('open')); // Кнопка фільтрів (на index.html)
        document.getElementById('btnCloseFilters')?.addEventListener('click', () => toggleFilters('close')); // Закриття фільтрів
        // Клік на overlay закриває всі відкриті бічні панелі
        overlay?.addEventListener('click', () => {
            toggleMenu('close');
            toggleFilters('close');
            toggleNotifications('close');
        });

        // Кнопка виходу в мобільному меню
        const logoutMobileButton = document.querySelector('#mobileMenuWindow #btnLogout'); // Уточнений селектор
        if(logoutMobileButton) {
            logoutMobileButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Ви впевнені, що хочете вийти?')) {
                    removeToken(); // Видаляємо токен
                    alert('Ви вийшли з системи.');
                    window.location.href = 'index.html'; // Перенаправлення на головну
                }
            });
        }

        // Захист посилань, доступних тільки авторизованим користувачам (у мобільному меню)
        const protectedLinks = placeholder.querySelectorAll('#mobileMenuWindow a[href="add_listing.html"], #mobileMenuWindow a[href="my_listings.html"], #mobileMenuWindow a[href="settings.html"]');
        protectedLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (!MY_USER_ID) {
                    e.preventDefault(); // Зупиняємо перехід
                    alert('Будь ласка, увійдіть, щоб отримати доступ до цієї сторінки.');
                    window.location.href = 'login.html'; // Перенаправляємо на логін
                }
            });
        });

        console.log("Навігацію ініціалізовано.");

    } catch (error) {
        console.error('Помилка завантаження або ініціалізації навігації:', error);
        placeholder.innerHTML = '<p style="color: red; text-align: center;">Помилка завантаження навігації</p>'; // Повідомлення про помилку в UI
    }
};