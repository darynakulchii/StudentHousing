// =================================================================================
// NAVIGATION MODULE
// =================================================================================

import { MY_USER_ID, getAuthHeaders } from './auth.js';

// --- Глобальні змінні модуля (UI елементи та стан) ---
export let mobileMenuWindow, filterSidebar, notificationSidebar, overlay, notificationBadge;
export let currentNotificationCount = 0;
export const DEFAULT_AVATAR_URL = 'https://placehold.co/120x120/EBF4FF/7F9CF5?text=User';

// --- Функції керування бічними панелями ---

/**
 * Універсальна функція для показу/приховування бічних панелей та overlay.
 */
const toggleSidebar = (sidebar, action) => {
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.contains('open');
    if (action === 'open' && !isOpen) {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else if (action === 'close' && isOpen) {
        sidebar.classList.remove('open');
        // Перевіряємо, чи інші сайдбари відкриті, перед тим як ховати overlay
        const anySidebarOpen = [mobileMenuWindow, filterSidebar, notificationSidebar].some(s => s?.classList.contains('open'));
        if (!anySidebarOpen) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};

// Експортовані функції для керування конкретними панелями
export const toggleMenu = (action) => toggleSidebar(mobileMenuWindow, action);
export const toggleFilters = (action) => toggleSidebar(filterSidebar, action);
const toggleNotifications = async (action) => {
    if (!notificationSidebar || !overlay) return;
    toggleSidebar(notificationSidebar, action);
    if (action === 'open' && currentNotificationCount > 0) {
        await markNotificationsAsRead();
        currentNotificationCount = 0;
        updateNotificationCount(0);
    }
};

// --- Функції для сповіщень ---

/**
 * Оновлює лічильник непрочитаних сповіщень в UI.
 */
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
 * Збільшує лічильник сповіщень на 1.
 */
export function incrementNotificationCount() {
    updateNotificationCount(currentNotificationCount + 1);
}

/**
 * Створює HTML-розмітку для одного елемента сповіщення.
 */
export const renderNotificationItem = (notification) => {
    let iconClass = 'fa-bell';
    if (notification.message.includes('повідомлення')) iconClass = 'fa-comment-dots';
    else if (notification.message.includes('вибране')) iconClass = 'fa-heart';

    const isUnread = !notification.is_read ? 'unread' : '';
    const timeAgo = notification.created_at ? new Date(notification.created_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : 'нещодавно';
    const tag = notification.link_url ? 'a' : 'div';
    const href = notification.link_url ? `href="${notification.link_url}"` : '';

    return `<${tag} ${href} class="notification-item ${isUnread}" data-id="${notification.notification_id}">
                <i class="fas ${iconClass}"></i>
                <p>${notification.message}</p>
                <span class="notification-time">${timeAgo}</span>
            </${tag}>`;
};

/**
 * Завантажує та відображає сповіщення користувача.
 */
export const fetchAndDisplayNotifications = async () => {
    const container = document.querySelector('.notification-list');
    if (!container || !MY_USER_ID) return;
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Завантаження...</p>';
    try {
        const response = await fetch('http://localhost:3000/api/my-notifications', { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to load notifications');
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
        console.error(error);
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--danger-color);">Помилка завантаження.</p>';
    }
};

/**
 * Додає нове сповіщення на початок списку.
 */
export const prependNotification = (notification) => {
    const container = document.querySelector('.notification-list');
    if (!container) return;
    container.querySelector('p')?.remove(); // Remove placeholder if exists
    container.insertAdjacentHTML('afterbegin', renderNotificationItem(notification));
};

/**
 * Відправляє запит на сервер, щоб позначити всі сповіщення як прочитані.
 *
 * export const markNotificationsAsRead = async () => {
 *     if (!MY_USER_ID) return;
 *     const unreadItems = document.querySelectorAll('.notification-item.unread');
 *     if (unreadItems.length === 0) return;
 *
 *     try {
 *         await fetch('http://localhost:3000/api/my-notifications/read', { method: 'PATCH', headers: getAuthHeaders() });
 *         unreadItems.forEach(item => item.classList.remove('unread'));
 *         console.log('Notifications marked as read');
 *     } catch (error) {
 *         console.error('Error marking notifications as read:', error);
 *     }
 * };
 *
 */
export const markNotificationsAsRead = async () => {
    if (!MY_USER_ID) return;
    // Оптимізація: Не відправляти запит, якщо лічильник вже 0
    if (currentNotificationCount === 0) {
        // Додатково перевіримо візуально, може бути розсинхрон
        const unreadItemsVisual = document.querySelectorAll('#notificationSidebar .notification-item.unread');
        if (unreadItemsVisual.length === 0) return;
    }


    try {
        const response = await fetch('http://localhost:3000/api/my-notifications/read', {
            method: 'PATCH',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            // Оновлюємо UI: знімаємо клас 'unread' та скидаємо лічильник
            document.querySelectorAll('#notificationSidebar .notification-item.unread').forEach(item => {
                item.classList.remove('unread');
            });
            updateNotificationCount(0); // Скидаємо лічильник
            console.log('Notifications marked as read');
        } else {
            console.error('Failed to mark notifications as read on server.');
        }
    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
};


// --- Функції для посилань навігації ---

/**
 * Підсвічує активне посилання в навігації.
 */
export const highlightActiveLink = () => {
    let currentPath = window.location.pathname.split('/').pop() || 'index.html'; // Default to index.html if path is '/'
    // Simple check if it's likely a subpage (adjust if needed)
    if (!['index.html', 'login.html', 'register.html', ''].includes(currentPath) && !currentPath.includes('.')) {
        currentPath += '.html'; // Assume .html if just a name
    }
    const isPage = !['index.html', ''].includes(currentPath); // More robust check

    const navLinks = document.querySelectorAll('.desktop-nav a, .mobile-nav-bar a');
    navLinks.forEach(link => {
        let linkPath = link.getAttribute('data-path');
        // Normalize paths for comparison (handle potential leading slashes or differences)
        linkPath = linkPath.startsWith('../') ? linkPath.substring(3) : linkPath;
        currentPath = currentPath.startsWith('pages/') ? currentPath.substring(6) : currentPath;

        if (linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

/**
 * Налаштовує вигляд посилань (логін/реєстрація) та аватара користувача залежно від статусу входу.
 */
export const setupNavLinks = async () => {
    const isLoggedIn = !!MY_USER_ID;
    const navLoginLink = document.getElementById('navLoginLink');
    const navRegisterLink = document.querySelector('a[href="register.html"]'); // Assuming only one register link
    const userAvatarElement = document.querySelector('.user-avatar');

    if (!userAvatarElement) return; // Exit if avatar element not found

    if (isLoggedIn) {
        if (navLoginLink) navLoginLink.style.display = 'none';
        if (navRegisterLink) navRegisterLink.style.display = 'none';
        try {
            const response = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
            if (response.ok) {
                const user = await response.json();
                userAvatarElement.style.backgroundImage = `url('${user.avatar_url || DEFAULT_AVATAR_URL}')`;
                userAvatarElement.href = 'profile.html';
            } else {
                userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
                userAvatarElement.href = 'profile.html'; // Still link to profile even if avatar fails
            }
        } catch (error) {
            console.error("Error loading avatar for header:", error);
            userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
            userAvatarElement.href = 'profile.html';
        }
    } else {
        if (navLoginLink) navLoginLink.style.display = 'block';
        if (navRegisterLink) navRegisterLink.style.display = 'block';
        userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
        userAvatarElement.href = 'login.html';
    }
};

// --- Головна функція ініціалізації навігації ---

/**
 * Завантажує HTML навігації, ініціалізує змінні та налаштовує слухачі подій.
 */
export const initializeNavigation = async () => {
    const placeholder = document.getElementById('navigation-placeholder');
    if (!placeholder) {
        console.error("Navigation placeholder not found!");
        return;
    }

    // Визначаємо шлях до navigation.html (припускаємо, що він в корені)
    const navPath = './navigation.html';

    try {
        const response = await fetch(navPath);
        if (!response.ok) throw new Error(`Failed to fetch navigation (${navPath}): ${response.statusText}`);
        placeholder.innerHTML = await response.text();

        // Ініціалізуємо глобальні змінні модуля ПІСЛЯ завантаження HTML
        mobileMenuWindow = document.getElementById('mobileMenuWindow');
        filterSidebar = document.getElementById('filterSidebar');
        notificationSidebar = document.getElementById('notificationSidebar');
        overlay = document.getElementById('overlay');
        notificationBadge = document.getElementById('notificationBadge');

        // Базове налаштування UI
        highlightActiveLink();
        await setupNavLinks(); // Налаштовує аватар та посилання логіну/реєстрації

        // Завантаження сповіщень (тільки якщо користувач залогінений)
        if (MY_USER_ID) {
            await fetchAndDisplayNotifications();
        } else {
            updateNotificationCount(0); // Скидаємо лічильник для гостей
        }

        // Налаштування ВСІХ слухачів подій для навігації та панелей
        // Кнопка бургер-меню
        document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => toggleMenu('open'));
        // Кнопка закриття бургер-меню
        document.getElementById('btnCloseMenu')?.addEventListener('click', () => toggleMenu('close'));
        // Іконка сповіщень
        document.querySelector('.notification-icon-container')?.addEventListener('click', () => toggleNotifications('open'));
        // Кнопка закриття сповіщень
        document.getElementById('btnCloseNotifications')?.addEventListener('click', () => toggleNotifications('close'));
        // Кнопка фільтрів (на головній сторінці)
        document.querySelector('.filter-btn')?.addEventListener('click', () => toggleFilters('open'));
        // Кнопка закриття фільтрів
        document.getElementById('btnCloseFilters')?.addEventListener('click', () => toggleFilters('close'));
        // Overlay для закриття всіх панелей
        overlay?.addEventListener('click', () => {
            toggleMenu('close');
            toggleFilters('close');
            toggleNotifications('close');
        });

        // Кнопка виходу в мобільному меню (якщо існує)
        const logoutMobileButton = document.querySelector('.sidebar-nav #btnLogout');
        if(logoutMobileButton) {
            logoutMobileButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Ви впевнені, що хочете вийти?')) {
                    removeToken(); // Використовуємо функцію з auth.js
                    alert('Ви вийшли з системи.');
                    window.location.href = 'index.html'; // Перезавантажуємо або переходимо на головну
                }
            });
        }


        // Перевірка авторизації для деяких посилань в мобільному меню
        const protectedLinks = placeholder.querySelectorAll('.sidebar-nav a[href="add_listing.html"], .sidebar-nav a[href="my_listings.html"], .sidebar-nav a[href="settings.html"]');
        protectedLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (!MY_USER_ID) {
                    e.preventDefault();
                    alert('Будь ласка, увійдіть, щоб отримати доступ до цієї сторінки.');
                    window.location.href = 'login.html';
                }
            });
        });

        console.log("Navigation initialized.");

    } catch (error) {
        console.error('Error loading or initializing navigation:', error);
        placeholder.innerHTML = '<p style="color: red; text-align: center;">Помилка завантаження навігації</p>';
    }
};