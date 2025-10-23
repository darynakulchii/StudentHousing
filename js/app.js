// js/app.js - Головний файл програми

// --- 1. Імпорти з модулів ---
import { MY_USER_ID, handleLogin, handleRegistration } from './modules/auth.js';
import { loadNavigation } from './modules/navigation.js';
// initializeUIElements тепер викликається всередині loadNavigation
// import { initializeUIElements } from './modules/ui.js';
import {
    fetchFavoriteIds,
    fetchAndDisplayListings,
    fetchAndDisplayListingDetail,
    fetchAndDisplayMyListings
} from './modules/listings.js';
import { setupSocketIO, loadConversations, handleMessageSend, handleChatUrlParams } from './modules/chat.js';
import {
    setupDynamicFormLogic,
    handleListingSubmission,
    loadListingDataForEdit,
    handleListingUpdateSubmission
} from './modules/forms.js';
import {
    loadProfileData,
    setupProfileEventListeners,
    loadSettingsData,
    handleSettingsSubmission,
    loadPublicProfileData
} from './modules/profile.js';
import { setupHomepageLogic } from './modules/home.js'; // Потрібно створити цей модуль

// --- 2. Глобальні налаштування (якщо є) ---
// (Наразі глобальні змінні перенесені до відповідних модулів)

// --- 3. Головний виконавчий блок (Роутер) ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Loaded. Initializing App...");

    // --- 3.1 Завжди виконується при завантаженні ---
    try {
        await loadNavigation();     // Завантажує HTML навігації, ініціалізує UI елементи, налаштовує посилання та сповіщення
        await fetchFavoriteIds();   // Завантажує ID обраних для кнопки серця
        setupSocketIO();            // Налаштовує з'єднання Socket.IO для сповіщень та чату
    } catch (error) {
        console.error("Помилка під час початкової ініціалізації:", error);
        // Можна показати повідомлення користувачу про помилку завантаження
    }

    // --- 3.2 Роутинг на основі поточної сторінки ---
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search); // Для отримання ID тощо

    console.log("Current Path:", path); // Для дебагу

    try {
        // --- Головна сторінка ---
        // Перевіряємо різні варіанти шляху до головної сторінки
        if (path.endsWith('index.html') || path === '/' || path.endsWith('/StudentHousing-d229248ae41ce68ce49f49f62d8e7276f6fe911d/')) {
            console.log("Initializing Index Page Logic...");
            // Завантажуємо оголошення (за замовчуванням - всі, крім "шукаю житло")
            await fetchAndDisplayListings('.listings-container', '/api/listings', 'listing_type!=find_home');
            // Налаштовуємо логіку кнопок фільтрації та пошуку
            setupHomepageLogic();
        }

        // --- Сторінка реєстрації ---
        else if (path.endsWith('register.html')) {
            console.log("Initializing Registration Logic...");
            await handleRegistration(); // Функція з auth.js
        }

        // --- Сторінка входу ---
        else if (path.endsWith('login.html')) {
            console.log("Initializing Login Logic...");
            await handleLogin(); // Функція з auth.js
        }

        // --- Сторінка додавання оголошення ---
        else if (path.endsWith('add_listing.html')) {
            console.log("Initializing Add Listing Logic...");
            setupDynamicFormLogic('addListingForm'); // Налаштовує динаміку полів форми (з forms.js)
            await handleListingSubmission(); // Налаштовує відправку форми та завантаження фото (з forms.js)
        }

        // --- Сторінка редагування оголошення ---
        else if (path.endsWith('edit_listing.html')) {
            console.log("Initializing Edit Listing Logic...");
            const listingId = urlParams.get('id');
            if (listingId && MY_USER_ID) { // Перевіряємо ID та авторизацію
                await loadListingDataForEdit('editListingForm', listingId); // Завантажує дані, заповнює форму (з forms.js)
                await handleListingUpdateSubmission(); // Налаштовує відправку оновлених даних (з forms.js)
            } else if (!MY_USER_ID) {
                alert('Будь ласка, увійдіть, щоб редагувати оголошення.');
                window.location.href = 'login.html';
            } else {
                alert('Помилка: ID оголошення для редагування не вказано.');
                window.location.href = 'my_listings.html';
            }
        }

        // --- Сторінка деталей оголошення ---
        else if (path.endsWith('listing_detail.html')) {
            console.log("Initializing Listing Detail Logic...");
            await fetchAndDisplayListingDetail(); // Завантажує та відображає деталі (з listings.js)
        }

        // --- Сторінка профілю користувача ---
        else if (path.endsWith('profile.html')) {
            console.log("Initializing Profile Page Logic...");
            await loadProfileData(); // Завантажує дані поточного користувача (з profile.js)
            setupProfileEventListeners(); // Налаштовує слухачі для форми, кнопки виходу, аватара (з profile.js)
        }

        // --- Сторінка налаштувань ---
        else if (path.endsWith('settings.html')) {
            console.log("Initializing Settings Page Logic...");
            await loadSettingsData(); // Завантажує поточні налаштування (з profile.js)
            handleSettingsSubmission(); // Налаштовує відправку форми налаштувань (з profile.js)
            // Слухач для кнопки видалення акаунту
            document.getElementById('btnDeleteAccount')?.addEventListener('click', () => {
                alert('Функція видалення акаунту в розробці.'); // Заглушка
            });
        }

        // --- Сторінка "Мої оголошення" ---
        else if (path.endsWith('my_listings.html')) {
            console.log("Initializing My Listings Logic...");
            await fetchAndDisplayMyListings(); // Завантажує та відображає оголошення користувача (з listings.js)
        }

        // --- Сторінка "Обране" ---
        else if (path.endsWith('favorites.html')) {
            console.log("Initializing Favorites Logic...");
            // Використовуємо загальну функцію fetchAndDisplayListings з відповідним ендпоінтом
            await fetchAndDisplayListings('#favoritesContainer', '/api/my-favorites', '', true); // requiresAuth = true
        }

        // --- Сторінка чату ---
        else if (path.endsWith('chat.html')) {
            console.log("Initializing Chat Logic...");
            if (!MY_USER_ID) {
                alert('Будь ласка, увійдіть, щоб переглянути повідомлення.');
                window.location.href = 'login.html';
            } else {
                await loadConversations(); // Завантажує список розмов (з chat.js)
                handleMessageSend();       // Налаштовує форму відправки (з chat.js)
                await handleChatUrlParams(); // Обробляє параметр user_id в URL (з chat.js)
            }
        }

        // --- Сторінка публічного профілю іншого користувача ---
        else if (path.endsWith('user_profile.html')) {
            console.log("Initializing User Profile Logic...");
            await loadPublicProfileData(); // Завантажує та відображає публічний профіль (з profile.js)
        }

        // --- Інші сторінки (наприклад, report_bug.html) ---
        // Можна додати логіку за потреби або залишити порожнім

    } catch (pageError) {
        console.error(`Помилка під час ініціалізації сторінки ${path}:`, pageError);
        // Можна показати загальне повідомлення про помилку користувачу
        // alert(`Сталася помилка при завантаженні сторінки: ${pageError.message}`);
    }

});

// --- Глобальні обробники (якщо потрібні, наприклад, для незапійманих помилок) ---
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled Promise Rejection:', event.reason);
});
