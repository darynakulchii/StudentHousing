import { MY_USER_ID, getAuthHeaders, removeToken } from './auth.js';

export let mobileMenuWindow, filterSidebar, notificationSidebar, overlay, notificationBadge;
export let currentNotificationCount = 0; //  лічильник непрочитаних сповіщень
export const DEFAULT_AVATAR_URL = 'https://placehold.co/120x120/E9E8F5/333399?text=User';

// функція для показу/приховування бічних панелей та overlay.
const toggleSidebar = (sidebar, action) => {
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.contains('open');

    if (action === 'open' && !isOpen) {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else if (action === 'close' && isOpen) {
        sidebar.classList.remove('open');
        const anySidebarOpen = [mobileMenuWindow, filterSidebar, notificationSidebar].some(s => s?.classList.contains('open'));
        if (!anySidebarOpen) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};

// функції для керування конкретними панелями
export const toggleMenu = (action) => toggleSidebar(mobileMenuWindow, action);
export const toggleFilters = (action) => toggleSidebar(filterSidebar, action);

// Обробник відкриття/закриття панелі сповіщень
const toggleNotifications = async (action) => {
    if (!notificationSidebar || !overlay) return;
    toggleSidebar(notificationSidebar, action);
    // Якщо панель відкривається і є непрочитані сповіщення, позначаємо їх як прочитані
    if (action === 'open' && currentNotificationCount > 0) {
        await markNotificationsAsRead();
        currentNotificationCount = 0;
        updateNotificationCount(0);
    }
};

// --- Функції для сповіщень ---

export const updateNotificationCount = (count) => {
    if (!notificationBadge) return;
    if (count > 0) {
        notificationBadge.textContent = count > 9 ? '9+' : count;
        notificationBadge.style.display = 'flex';
    } else {
        notificationBadge.style.display = 'none';
    }
};

/**
 * Збільшує лічильник непрочитаних сповіщень на 1 та оновлює UI.
 * Використовується при отриманні нового сповіщення через WebSocket.
 */
export function incrementNotificationCount() {
    currentNotificationCount++;
    updateNotificationCount(currentNotificationCount);
}

// Створює HTML-розмітку для одного елемента сповіщення.
export const renderNotificationItem = (notification) => {
    let iconClass = 'fa-bell';
    if (notification.message.includes('повідомлення')) iconClass = 'fa-comment-dots';
    else if (notification.message.includes('вибране')) iconClass = 'fa-heart';

    const isUnread = !notification.is_read ? 'unread' : '';
    const timeAgo = notification.created_at ? new Date(notification.created_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : 'нещодавно'; // Форматування часу
    const tag = notification.link_url ? 'a' : 'div';
    const href = notification.link_url ? `href="${notification.link_url}"` : '';

    return `<${tag} ${href} class="notification-item ${isUnread}" data-id="${notification.notification_id}">
                <i class="fas ${iconClass}"></i>
                <p>${notification.message}</p>
                <span class="notification-time">${timeAgo}</span>
            </${tag}>`;
};

export const fetchAndDisplayNotifications = async () => {
    const container = document.querySelector('.notification-list');
    if (!container || !MY_USER_ID) return;

    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Завантаження...</p>';

    try {
        const response = await fetch('http://localhost:3000/api/my-notifications', { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Не вдалося завантажити сповіщення');
        const notifications = await response.json();
        container.innerHTML = '';
        let unreadCount = 0;

        if (notifications.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);">У вас немає сповіщень.</p>';
        } else {
            notifications.forEach(n => {
                if (!n.is_read) unreadCount++;
                container.innerHTML += renderNotificationItem(n);
            });
        }
        currentNotificationCount = unreadCount;
        updateNotificationCount(currentNotificationCount);
    } catch (error) {
        console.error('Помилка завантаження сповіщень:', error);
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--danger-color);">Помилка завантаження.</p>';
    }
};

// Додає нове сповіщення на початок списку
export const prependNotification = (notification) => {
    const container = document.querySelector('.notification-list');
    if (!container) return;
    // Видаляємо плейсхолдер "Немає сповіщень" або "Завантаження...", якщо він є
    container.querySelector('p')?.remove();
    container.insertAdjacentHTML('afterbegin', renderNotificationItem(notification));
};

// Надсилає запит на сервер для позначення всіх непрочитаних сповіщень як прочитаних.
export const markNotificationsAsRead = async () => {
    if (!MY_USER_ID) return;

    if (currentNotificationCount === 0) {
        const unreadItemsVisual = document.querySelectorAll('#notificationSidebar .notification-item.unread');
        if (unreadItemsVisual.length === 0) return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/my-notifications/read', {
            method: 'PATCH',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            document.querySelectorAll('#notificationSidebar .notification-item.unread').forEach(item => {
                item.classList.remove('unread');
            });
            currentNotificationCount = 0;
            updateNotificationCount(0);
            console.log('Сповіщення позначено як прочитані');
        } else {
            console.error('Не вдалося позначити сповіщення як прочитані на сервері.');
        }
    } catch (error) {
        console.error('Помилка при позначенні сповіщень як прочитаних:', error);
    }
};


// --- Функції для посилань навігації ---

// Підсвічує активне посилання в навігації на основі поточного шляху URL.
export const highlightActiveLink = () => {
    let currentPath = window.location.pathname.split('/').pop() || 'index.html';
    if (!['index.html', 'login.html', 'register.html', ''].includes(currentPath) && !currentPath.includes('.')) {
        currentPath += '.html';
    }

    const navLinks = document.querySelectorAll('.desktop-nav a, .mobile-nav-bar a');
    navLinks.forEach(link => {
        let linkPath = link.getAttribute('data-path');
        linkPath = linkPath?.startsWith('../') ? linkPath.substring(3) : linkPath;
        const normalizedCurrentPath = currentPath.startsWith('pages/') ? currentPath.substring(6) : currentPath;

        if (linkPath === normalizedCurrentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

// Налаштовує видимість посилань "Увійти"/"Зареєструватись" та відображення аватара користувача.
export const setupNavLinks = async () => {
    const isLoggedIn = !!MY_USER_ID;
    const navLoginLink = document.getElementById('navLoginLink');
    const navRegisterLink = document.querySelector('a[href="register.html"]');
    const userAvatarElement = document.querySelector('.user-avatar');

    if (!userAvatarElement) return;

    if (isLoggedIn) {
        if (navLoginLink) navLoginLink.style.display = 'none';
        if (navRegisterLink) navRegisterLink.style.display = 'none';
        try {
            const response = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
            if (response.ok) {
                const user = await response.json();
                userAvatarElement.style.backgroundImage = `url('${user.avatar_url || DEFAULT_AVATAR_URL}')`;
            } else {
                userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
            }
        } catch (error) {
            console.error("Помилка завантаження аватара для хедера:", error);
            userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
        }
        userAvatarElement.href = 'profile.html';
    } else {
        if (navLoginLink) navLoginLink.style.display = 'block';
        if (navRegisterLink) navRegisterLink.style.display = 'block';
        userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
        userAvatarElement.href = 'login.html';
    }
};

// --- Головна функція ініціалізації навігації ---

export const initializeNavigation = async () => {
    const placeholder = document.getElementById('navigation-placeholder');
    if (!placeholder) {
        console.error("Плейсхолдер навігації ('navigation-placeholder') не знайдено!");
        return;
    }

    const navPath = './navigation.html';

    try {
        const response = await fetch(navPath);
        if (!response.ok) throw new Error(`Не вдалося завантажити навігацію (${navPath}): ${response.statusText}`);
        placeholder.innerHTML = await response.text();

        mobileMenuWindow = document.getElementById('mobileMenuWindow');
        filterSidebar = document.getElementById('filterSidebar');
        notificationSidebar = document.getElementById('notificationSidebar');
        overlay = document.getElementById('overlay');
        notificationBadge = document.getElementById('notificationBadge');

        highlightActiveLink();
        await setupNavLinks();

        if (MY_USER_ID) {
            await fetchAndDisplayNotifications();
        } else {
            updateNotificationCount(0);
        }

        document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => toggleMenu('open'));
        document.getElementById('btnCloseMenu')?.addEventListener('click', () => toggleMenu('close'));
        document.querySelector('.notification-icon-container')?.addEventListener('click', () => toggleNotifications('open'));
        document.getElementById('btnCloseNotifications')?.addEventListener('click', () => toggleNotifications('close'));
        document.querySelector('.filter-btn')?.addEventListener('click', () => toggleFilters('open'));
        document.getElementById('btnCloseFilters')?.addEventListener('click', () => toggleFilters('close'));

        overlay?.addEventListener('click', () => {
            toggleMenu('close');
            toggleFilters('close');
            toggleNotifications('close');
        });

        const logoutMobileButton = document.querySelector('#mobileMenuWindow #btnLogout');
        if(logoutMobileButton) {
            logoutMobileButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Ви впевнені, що хочете вийти?')) {
                    removeToken(); // Видаляємо токен
                    alert('Ви вийшли з системи.');
                    window.location.href = 'index.html';
                }
            });
        }

        const protectedLinks = placeholder.querySelectorAll('#mobileMenuWindow a[href="add_listing.html"], #mobileMenuWindow a[href="my_listings.html"], #mobileMenuWindow a[href="settings.html"]');
        protectedLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (!MY_USER_ID) {
                    e.preventDefault();
                    alert('Будь ласка, увійдіть, щоб отримати доступ до цієї сторінки.');
                    window.location.href = 'login.html';
                }
            });
        });

        console.log("Навігацію ініціалізовано.");

    } catch (error) {
        console.error('Помилка завантаження або ініціалізації навігації:', error);
        placeholder.innerHTML = '<p style="color: red; text-align: center;">Помилка завантаження навігації</p>';
    }
};