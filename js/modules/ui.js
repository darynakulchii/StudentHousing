// js/modules/ui.js

// Об'єкт для зберігання посилань на часто використовувані елементи DOM
export const uiElements = {
    mobileMenuWindow: null,
    filterSidebar: null,
    notificationSidebar: null,
    overlay: null,
    notificationBadge: null,
    // Додайте інші елементи за потреби (наприклад, модальне вікно)
    // modalOverlay: null,
    // modalContent: null,
    // modalTitle: null,
    // modalMessage: null,
    // modalConfirmBtn: null,
    // modalCloseBtn: null,
};

/**
 * Ініціалізує посилання на елементи DOM після завантаження навігації.
 * Цю функцію потрібно викликати один раз у головному app.js після loadNavigation.
 */
export function initializeUIElements() {
    uiElements.mobileMenuWindow = document.getElementById('mobileMenuWindow');
    uiElements.filterSidebar = document.getElementById('filterSidebar');
    uiElements.notificationSidebar = document.getElementById('notificationSidebar');
    uiElements.overlay = document.getElementById('overlay');
    uiElements.notificationBadge = document.getElementById('notificationBadge');
    // Ініціалізуйте інші елементи тут
    // uiElements.modalOverlay = document.getElementById('customModalOverlay');
    // ...
    console.log("UI Elements Initialized:", uiElements); // Для дебагу
}

/**
 * Перемикає видимість мобільного меню.
 * @param {'open' | 'close'} action - Дія (відкрити або закрити).
 */
export const toggleMenu = (action) => {
    if (!uiElements.mobileMenuWindow || !uiElements.overlay) {
        console.warn("Mobile menu or overlay not found.");
        return;
    }
    const isOpen = action === 'open';
    uiElements.mobileMenuWindow.classList.toggle('open', isOpen);
    updateOverlayAndScroll(isOpen, 'menu');
};

/**
 * Перемикає видимість бічної панелі фільтрів.
 * @param {'open' | 'close'} action - Дія (відкрити або закрити).
 */
export const toggleFilters = (action) => {
    if (!uiElements.filterSidebar || !uiElements.overlay) {
        console.warn("Filter sidebar or overlay not found.");
        return;
    }
    const isOpen = action === 'open';
    uiElements.filterSidebar.classList.toggle('open', isOpen);
    updateOverlayAndScroll(isOpen, 'filters');
};

/**
 * Перемикає видимість бічної панелі сповіщень.
 * @param {'open' | 'close'} action - Дія (відкрити або закрити).
 */
export const toggleNotifications = (action) => {
    // Потрібно імпортувати markNotificationsAsRead та currentNotificationCount з notifications.js
    // import { markNotificationsAsRead, currentNotificationCount } from './notifications.js';

    if (!uiElements.notificationSidebar || !uiElements.overlay) {
        console.warn("Notification sidebar or overlay not found.");
        return;
    }
    const isOpen = action === 'open';
    uiElements.notificationSidebar.classList.toggle('open', isOpen);
    updateOverlayAndScroll(isOpen, 'notifications');

    // Позначаємо сповіщення як прочитані при відкритті панелі
    if (isOpen && typeof markNotificationsAsRead === 'function' && currentNotificationCount > 0) {
        // Потрібно імпортувати `currentNotificationCount` з notifications.js
        markNotificationsAsRead();
    }
};

/**
 * Допоміжна функція для оновлення стану оверлею та блокування/розблокування прокрутки сторінки.
 * @param {boolean} isOpen - Чи відкривається якась панель?
 * @param {'menu' | 'filters' | 'notifications'} openedPanelType - Тип панелі, що відкривається/закривається.
 */
function updateOverlayAndScroll(isOpen, openedPanelType) {
    if (!uiElements.overlay) return;

    if (isOpen) {
        uiElements.overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Блокуємо скрол
    } else {
        // Перевіряємо, чи НЕ відкриті інші панелі, перш ніж ховати оверлей і розблоковувати скрол
        const isMenuOpen = uiElements.mobileMenuWindow?.classList.contains('open') && openedPanelType !== 'menu';
        const isFilterOpen = uiElements.filterSidebar?.classList.contains('open') && openedPanelType !== 'filters';
        const isNotificationOpen = uiElements.notificationSidebar?.classList.contains('open') && openedPanelType !== 'notifications';

        if (!isMenuOpen && !isFilterOpen && !isNotificationOpen) {
            uiElements.overlay.classList.remove('active');
            document.body.style.overflow = ''; // Розблоковуємо скрол
        }
    }
}

/**
 * Закриває всі відкриті бічні панелі. Викликається при кліку на оверлей.
 */
export function closeAllSidebars() {
    toggleMenu('close');
    toggleFilters('close');
    toggleNotifications('close');
}

// --- Логіка для модального вікна (якщо потрібно) ---
// export function showModal(type = 'info', title, message, buttonText = 'Зрозуміло') {
//     if (!uiElements.modalOverlay || !uiElements.modalContent || !uiElements.modalTitle || !uiElements.modalMessage || !uiElements.modalConfirmBtn) return;
//
//     // Встановлюємо іконку та колір кнопки
//     const iconDiv = uiElements.modalContent.querySelector('.modal-icon');
//     iconDiv.innerHTML = ''; // Очищуємо іконку
//     uiElements.modalConfirmBtn.className = 'modal-confirm-btn'; // Скидаємо клас кнопки
//
//     if (type === 'success') {
//         iconDiv.innerHTML = '<i class="fas fa-check-circle success"></i>';
//         uiElements.modalConfirmBtn.classList.add('default'); // Або 'success', якщо є такий стиль
//     } else if (type === 'error') {
//         iconDiv.innerHTML = '<i class="fas fa-times-circle error"></i>';
//         uiElements.modalConfirmBtn.classList.add('error');
//     } else { // info or default
//         iconDiv.innerHTML = '<i class="fas fa-info-circle info"></i>';
//         uiElements.modalConfirmBtn.classList.add('default');
//     }
//
//     // Встановлюємо текст
//     uiElements.modalTitle.textContent = title;
//     uiElements.modalMessage.textContent = message;
//     uiElements.modalConfirmBtn.textContent = buttonText;
//
//     // Показуємо вікно
//     uiElements.modalOverlay.classList.add('active');
// }
//
// export function hideModal() {
//      if (uiElements.modalOverlay) {
//          uiElements.modalOverlay.classList.remove('active');
//      }
// }

// Додати слухачі для закриття модального вікна в initializeUIElements або в головному app.js
// uiElements.modalCloseBtn?.addEventListener('click', hideModal);
// uiElements.modalConfirmBtn?.addEventListener('click', hideModal);
// uiElements.modalOverlay?.addEventListener('click', (e) => {
//     if (e.target === uiElements.modalOverlay) { // Закривати тільки при кліку на фон
//         hideModal();
//     }
// });