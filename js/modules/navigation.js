// js/modules/navigation.js

import { MY_USER_ID, getAuthHeaders } from './auth.js';
import { fetchAndDisplayNotifications } from './notifications.js';
import { initializeUIElements, uiElements, toggleMenu, toggleFilters, toggleNotifications, closeAllSidebars } from './ui.js';

// === Аватар за замовчуванням ===
const DEFAULT_AVATAR_URL = 'https://placehold.co/120x120/EBF4FF/7F9CF5?text=User';

/**
 * Підсвічує активне посилання в навігації (десктоп та мобайл).
 * @param {boolean} isPage - Чи знаходимося ми в папці /pages/?
 */
export const highlightActiveLink = (isPage) => {
    let currentPath = window.location.pathname.split('/').pop();

    // Нормалізуємо шлях для порівняння
    if (currentPath === '' || currentPath === 'StudentHousing-d229248ae41ce68ce49f49f62d8e7276f6fe911d') { // Порівнюємо з назвою проекту
        currentPath = 'index.html'; // Корінь проекту вважаємо index.html
    } else if (isPage && currentPath !== 'index.html') {
        // Якщо ми в /pages/, але це не index.html, додаємо префікс
        // (Примітка: цей префікс має бути в data-path у navigation.html)
        currentPath = 'pages/' + currentPath;
    }
    // Якщо це index.html всередині pages, шлях має бути 'pages/index.html'
    // Переконайтесь, що data-path="pages/index.html" існує, якщо така сторінка є

    // Вибираємо всі навігаційні посилання
    const navLinks = document.querySelectorAll('.desktop-nav a, .mobile-nav-bar a.nav-item, .sidebar-nav a');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('data-path'); // Використовуємо data-path для порівняння
        if (linkPath === currentPath) {
            link.classList.add('active');
            // Якщо це мобільна кнопка, додаємо клас active і їй
            if(link.classList.contains('nav-item')) {
                link.classList.add('active');
            }
            // Якщо це пункт бічного меню, додаємо active
            if(link.closest('.sidebar-nav')) {
                // Стилі для .active в .sidebar-nav мають бути визначені в CSS
                link.classList.add('active'); // Або додаємо до li, якщо структура інша
            }
        } else {
            link.classList.remove('active');
            if(link.classList.contains('nav-item')) {
                link.classList.remove('active');
            }
            if(link.closest('.sidebar-nav')) {
                link.classList.remove('active');
            }
        }
    });
};

/**
 * Налаштовує видимість посилань "Увійти"/"Зареєструватись" та аватар користувача
 * залежно від стану авторизації.
 */
export const setupNavLinks = async () => {
    const isLoggedIn = !!MY_USER_ID;

    // Знаходимо елементи навігації
    const navLoginLink = document.getElementById('navLoginLink'); // Посилання "Увійти" в бічному меню
    const navRegisterLink = document.querySelector('.sidebar-nav a[href="register.html"]'); // "Зареєструватись"
    const userAvatarLink = document.querySelector('.user-avatar'); // Елемент аватара в хедері (це <a>)
    const addListingLink = document.querySelector('.sidebar-nav a[href="add_listing.html"]');
    const myListingsLink = document.querySelector('.sidebar-nav a[href="my_listings.html"]');
    const settingsLink = document.querySelector('.sidebar-nav a[href="settings.html"]');
    // Посилання на чат/вибране в десктоп/мобайл барі (вони видимі завжди, але можна додати логіку)
    const chatLinks = document.querySelectorAll('a[href="chat.html"]');
    const favoritesLinks = document.querySelectorAll('a[href="favorites.html"]');


    if (isLoggedIn) {
        // --- Авторизований користувач ---
        if (navLoginLink) navLoginLink.style.display = 'none';
        if (navRegisterLink) navRegisterLink.style.display = 'none';

        // Показуємо посилання для залогінених
        if (addListingLink) addListingLink.style.display = 'block';
        if (myListingsLink) myListingsLink.style.display = 'block';
        if (settingsLink) settingsLink.style.display = 'block';

        // Налаштовуємо аватар
        if (userAvatarLink) {
            userAvatarLink.href = 'profile.html'; // Посилання веде на профіль
            // Завантажуємо URL аватара користувача
            try {
                const response = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
                if (response.ok) {
                    const user = await response.json();
                    userAvatarLink.style.backgroundImage = `url('${user.avatar_url || DEFAULT_AVATAR_URL}')`;
                } else {
                    // Якщо помилка завантаження профілю, ставимо дефолтний
                    userAvatarLink.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
                }
            } catch (error) {
                console.error("Помилка завантаження аватара для хедера:", error);
                userAvatarLink.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
            }
        }

    } else {
        // --- Неавторизований користувач ---
        if (navLoginLink) navLoginLink.style.display = 'block';
        if (navRegisterLink) navRegisterLink.style.display = 'block';

        // Ховаємо посилання для залогінених
        if (addListingLink) addListingLink.style.display = 'none';
        if (myListingsLink) myListingsLink.style.display = 'none';
        if (settingsLink) settingsLink.style.display = 'none';

        // Налаштовуємо "аватар" (веде на логін)
        if (userAvatarLink) {
            userAvatarLink.href = 'login.html'; // Посилання веде на логін
            userAvatarLink.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`; // Дефолтний вигляд
        }
    }
};

/**
 * Асинхронно завантажує HTML-код навігації у placeholder '#navigation-placeholder',
 * ініціалізує елементи UI та налаштовує обробники подій.
 */
export const loadNavigation = async () => {
    const placeholder = document.getElementById('navigation-placeholder');
    if (!placeholder) {
        console.error("Placeholder '#navigation-placeholder' not found.");
        return;
    }

    // Визначаємо шлях до navigation.html (корінь чи папка /pages/)
    const pathSegments = window.location.pathname.split('/');
    // Перевіряємо, чи є 'pages' серед сегментів шляху
    const isPage = pathSegments.some(segment => segment === 'pages');
    const navPath = isPage ? '../navigation.html' : 'navigation.html';

    try {
        const response = await fetch(navPath);
        if (!response.ok) throw new Error(`Failed to fetch navigation: ${response.statusText}`);
        placeholder.innerHTML = await response.text();

        // --- Ініціалізація та налаштування ПІСЛЯ завантаження HTML ---

        // 1. Ініціалізуємо елементи UI (з ui.js)
        initializeUIElements();

        // 2. Визначаємо поточний шлях і підсвічуємо активне посилання
        highlightActiveLink(isPage);

        // 3. Налаштовуємо видимість посилань та аватар (з цього модуля)
        await setupNavLinks();

        // 4. Завантажуємо сповіщення, якщо користувач авторизований
        if (MY_USER_ID) {
            // Потрібно імпортувати fetchAndDisplayNotifications з notifications.js
            if (typeof fetchAndDisplayNotifications === 'function') {
                await fetchAndDisplayNotifications();
            } else {
                console.warn("fetchAndDisplayNotifications function not available.");
            }
        } else {
            // Якщо не авторизований, просто ховаємо лічильник (з notifications.js)
            // Потрібно імпортувати updateNotificationCount
            if (typeof updateNotificationCount === 'function') {
                updateNotificationCount(0);
            }
        }

        // 5. Налаштовуємо слухачі подій для меню, фільтрів, сповіщень (з ui.js)
        document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => toggleMenu('open'));
        document.getElementById('btnCloseMenu')?.addEventListener('click', () => toggleMenu('close'));

        document.querySelector('.notification-icon-container')?.addEventListener('click', () => toggleNotifications('open'));
        document.getElementById('btnCloseNotifications')?.addEventListener('click', () => toggleNotifications('close'));

        // Кнопка фільтрів є тільки на index.html, але слухач закриття є завжди
        document.querySelector('.filter-btn')?.addEventListener('click', () => toggleFilters('open'));
        document.getElementById('btnCloseFilters')?.addEventListener('click', () => toggleFilters('close'));

        // Слухач для оверлею (з ui.js)
        uiElements.overlay?.addEventListener('click', closeAllSidebars);

        console.log("Navigation loaded and configured.");

    } catch (error) {
        console.error('Помилка завантаження або налаштування навігації:', error);
        placeholder.innerHTML = '<p style="color: red; text-align: center;">Помилка завантаження навігації.</p>';
    }
};