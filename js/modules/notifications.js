// js/modules/notifications.js

import { MY_USER_ID, getAuthHeaders } from './auth.js';
import { uiElements } from './ui.js'; // Припускаємо, що ви створите ui.js для елементів DOM

// Глобальна змінна для лічильника сповіщень
export let currentNotificationCount = 0;

/**
 * Оновлює відображення лічильника сповіщень у хедері.
 * @param {number} count - Нова кількість непрочитаних сповіщень.
 */
export const updateNotificationCount = (count) => {
    // Використовуємо uiElements для доступу до елементів DOM
    if (uiElements.notificationBadge) {
        if (count > 0) {
            uiElements.notificationBadge.textContent = count > 9 ? '9+' : count;
            uiElements.notificationBadge.style.display = 'flex';
            currentNotificationCount = count; // Оновлюємо глобальний лічильник
        } else {
            uiElements.notificationBadge.style.display = 'none';
            currentNotificationCount = 0; // Скидаємо глобальний лічильник
        }
    }
};

/**
 * Генерує HTML для одного елемента сповіщення.
 * @param {object} notification - Об'єкт сповіщення з БД.
 * @returns {string} - HTML-рядок.
 */
export const renderNotificationItem = (notification) => {
    let iconClass = 'fa-bell';
    if (notification.message.includes('повідомлення')) {
        iconClass = 'fa-comment-dots';
    } else if (notification.message.includes('вибране')) {
        iconClass = 'fa-heart';
    }

    const isUnread = !notification.is_read ? 'unread' : '';
    // Проста версія часу, для "time ago" потрібна бібліотека або складніша логіка
    const timeDisplay = notification.created_at
        ? new Date(notification.created_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
        : 'нещодавно';

    const tag = notification.link_url ? 'a' : 'div';
    const href = notification.link_url ? `href="${notification.link_url}"` : '';

    return `
        <${tag} ${href} class="notification-item ${isUnread}" data-id="${notification.notification_id}">
            <i class="fas ${iconClass}"></i>
            <p>${notification.message}</p>
            <span class="notification-time">${timeDisplay}</span>
        </${tag}>
    `;
};

/**
 * Завантажує сповіщення з сервера та відображає їх у бічній панелі.
 */
export const fetchAndDisplayNotifications = async () => {
    const container = document.querySelector('.notification-list');
    if (!container || !MY_USER_ID) return;

    // Показуємо спіннер під час завантаження
    container.innerHTML = `<p style="padding: 20px; text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Завантаження...</p>`;

    try {
        const response = await fetch('http://localhost:3000/api/my-notifications', {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Не вдалося завантажити сповіщення');

        const notifications = await response.json();
        container.innerHTML = ''; // Очищуємо спіннер

        let unreadCount = 0;
        if (notifications.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);">У вас немає сповіщень.</p>';
        } else {
            notifications.forEach(n => {
                if (!n.is_read) unreadCount++;
                container.innerHTML += renderNotificationItem(n);
            });
        }

        updateNotificationCount(unreadCount); // Оновлюємо лічильник у хедері

    } catch (error) {
        console.error('Помилка завантаження сповіщень:', error);
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--danger-color);">Помилка завантаження.</p>';
    }
};

/**
 * Додає нове сповіщення (отримане по socket) на початок списку.
 * @param {object} notification - Об'єкт сповіщення.
 */
export const prependNotification = (notification) => {
    const container = document.querySelector('.notification-list');
    if (!container) return;

    // Видаляємо заглушку "немає сповіщень"
    const placeholder = container.querySelector('p');
    if (placeholder && placeholder.textContent.includes('немає сповіщень')) {
        placeholder.remove();
    }

    const itemHTML = renderNotificationItem(notification);
    container.insertAdjacentHTML('afterbegin', itemHTML); // Додаємо на початок
};

/**
 * Відправляє запит на сервер, щоб позначити всі непрочитані сповіщення як прочитані.
 */
export const markNotificationsAsRead = async () => {
    if (currentNotificationCount === 0) return; // Нема чого оновлювати

    try {
        const response = await fetch('http://localhost:3000/api/my-notifications/read', {
            method: 'PATCH',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            console.error('Сервер повернув помилку при оновленні статусу сповіщень.');
            return; // Не оновлюємо UI, якщо сервер не підтвердив
        }

        // Візуально прибираємо клас 'unread' з усіх елементів
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
        });
        updateNotificationCount(0); // Скидаємо лічильник візуально
        console.log('Сповіщення позначено як прочитані (на фронтенді)');

    } catch (error) {
        console.error('Помилка мережі при оновленні статусу сповіщень:', error);
    }
};