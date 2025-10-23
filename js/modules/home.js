// js/modules/home.js

// Імпортуємо необхідні функції з інших модулів
import { fetchAndDisplayListings } from './listings.js'; // Для завантаження оголошень
import { toggleFilters } from './ui.js'; // Для закриття бічної панелі фільтрів

/**
 * Налаштовує всю логіку взаємодії на головній сторінці:
 * - Кнопки вибору типу оголошень ("Всі", "Шукаю житло" тощо).
 * - Рядок пошуку та іконка пошуку.
 * - Форма фільтрів у бічній панелі (відправка, скидання).
 * - Динамічна видимість секцій у формі фільтрів.
 */
export const setupHomepageLogic = () => {
    // Знаходимо основні елементи керування
    const filtersForm = document.getElementById('filtersForm');
    const actionButtons = document.querySelectorAll('.main-actions-menu .action-btn');
    const searchInput = document.querySelector('.search-input');
    const searchIcon = document.querySelector('.search-icon');

    // Перевіряємо наявність елементів, щоб уникнути помилок
    if (!filtersForm || actionButtons.length === 0 || !searchInput || !searchIcon) {
        console.warn("Не всі елементи керування для головної сторінки знайдені.");
        return; // Виходимо, якщо основних елементів немає
    }

    /**
     * Збирає дані з пошуку та форми фільтрів і викликає оновлення списку оголошень.
     */
    const triggerSearchAndFilter = () => {
        const formData = new FormData(filtersForm);
        const params = new URLSearchParams();

        // 1. Додаємо пошуковий запит
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            params.append('search', searchTerm);
        }

        // 2. Збираємо вибрані характеристики (чекбокси)
        const characteristics = [];
        filtersForm.querySelectorAll('input[name="characteristics"]:checked').forEach(checkbox => {
            characteristics.push(checkbox.value);
        });
        if (characteristics.length > 0) {
            params.append('characteristics', characteristics.join(','));
        }

        // 3. Додаємо всі інші поля форми (крім characteristics), якщо вони мають значення
        formData.forEach((value, key) => {
            if (key !== 'characteristics' && value) {
                params.append(key, value);
            }
        });

        const filterQuery = params.toString();
        console.log('Застосування пошуку/фільтрів:', filterQuery);

        // 4. Викликаємо функцію завантаження оголошень з listings.js
        fetchAndDisplayListings('.listings-container', '/api/listings', filterQuery); // Використовуємо селектор контейнера
    };

    /**
     * Оновлює видимість секцій у формі фільтрів залежно від обраного типу оголошення.
     */
    const updateFilterVisibility = () => {
        // Знаходимо секції всередині filtersForm
        const housingFilters = filtersForm.querySelector('#housingFilters');
        const listingDetails = filtersForm.querySelector('#listingDetails');
        const aboutMe = filtersForm.querySelector('#aboutMe');
        const roommatePrefs = filtersForm.querySelector('#roommatePreferences');

        // Отримуємо обраний тип (радіокнопка)
        const selectedType = filtersForm.querySelector('input[name="listing_type"]:checked')?.value;

        // Спочатку ховаємо всі динамічні секції
        [housingFilters, listingDetails, aboutMe, roommatePrefs].forEach(section => {
            if (section) section.style.display = 'none';
        });

        // Показуємо потрібні секції залежно від типу
        if (selectedType === 'find_home') { // Шукаю житло
            if (housingFilters) housingFilters.style.display = 'block';
            if (aboutMe) aboutMe.style.display = 'block';
            if (roommatePrefs) roommatePrefs.style.display = 'block';
        } else if (selectedType === 'rent_out') { // Хочу здати
            if (listingDetails) listingDetails.style.display = 'block';
        } else if (selectedType === 'find_mate') { // Шукаю сусіда
            if (listingDetails) listingDetails.style.display = 'block';
            if (aboutMe) aboutMe.style.display = 'block';
            if (roommatePrefs) roommatePrefs.style.display = 'block';
        } else { // "Всі" типи (selectedType === '')
            // Показуємо всі можливі фільтри
            if (housingFilters) housingFilters.style.display = 'block';
            if (listingDetails) listingDetails.style.display = 'block';
            if (aboutMe) aboutMe.style.display = 'block';
            if (roommatePrefs) roommatePrefs.style.display = 'block';
        }
    };

    // --- Налаштування слухачів подій ---

    // 1. Головні кнопки вибору типу
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Оновлюємо активну кнопку
            actionButtons.forEach(btn => btn.classList.remove('active-action'));
            button.classList.add('active-action');

            const actionType = button.getAttribute('data-type');
            const typeValue = (actionType === 'all_listings') ? '' : actionType;

            // Скидаємо форму фільтрів та рядок пошуку
            filtersForm.reset();
            searchInput.value = '';

            // Встановлюємо відповідну радіокнопку у формі фільтрів
            const radioInForm = filtersForm.querySelector(`input[name="listing_type"][value="${typeValue}"]`);
            if (radioInForm) {
                radioInForm.checked = true;
            }

            // Оновлюємо видимість секцій у фільтрах
            updateFilterVisibility();

            // Запускаємо завантаження оголошень тільки за обраним типом
            // (Використовуємо 'listing_type!=find_home' для "Всіх", щоб виключити пошук житла за замовчуванням)
            const query = typeValue ? `listing_type=${typeValue}` : 'listing_type!=find_home';
            fetchAndDisplayListings('.listings-container', '/api/listings', query);
        });
    });

    // 2. Радіокнопки типу УСЕРЕДИНІ форми фільтрів
    filtersForm.querySelectorAll('input[name="listing_type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateFilterVisibility(); // Оновлюємо видимість секцій

            // Синхронізуємо головні кнопки вгорі сторінки
            const typeValue = radio.value || 'all_listings';
            actionButtons.forEach(btn => btn.classList.remove('active-action'));
            const matchingButton = document.querySelector(`.main-actions-menu .action-btn[data-type="${typeValue}"]`);
            if (matchingButton) {
                matchingButton.classList.add('active-action');
            }
        });
    });

    // 3. Відправка форми фільтрів (кнопка "Застосувати")
    filtersForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Запобігаємо стандартній відправці
        triggerSearchAndFilter(); // Запускаємо пошук/фільтрацію
        toggleFilters('close'); // Закриваємо бічну панель (функція з ui.js)
    });

    // 4. Кнопка "Скинути" у формі фільтрів
    filtersForm.querySelector('.reset-filters-btn')?.addEventListener('click', (e) => {
        e.preventDefault(); // Запобігаємо скиданню за замовчуванням (щоб виконати свою логіку)
        filtersForm.reset(); // Очищуємо поля форми
        searchInput.value = ''; // Очищуємо рядок пошуку

        // Активуємо кнопку "Всі оголошення"
        actionButtons.forEach(btn => btn.classList.remove('active-action'));
        document.querySelector('.main-actions-menu .action-btn[data-type="all_listings"]')?.classList.add('active-action');

        // Оновлюємо видимість секцій (покажуться всі)
        updateFilterVisibility();

        // Завантажуємо оголошення за замовчуванням
        fetchAndDisplayListings('.listings-container', '/api/listings', 'listing_type!=find_home');

        console.log('Фільтри скинуто');
    });

    // 5. Пошук при натисканні Enter у рядку пошуку
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Запобігаємо стандартній відправці форми (якщо вона є)
            triggerSearchAndFilter(); // Запускаємо пошук/фільтрацію
        }
    });

    // 6. Пошук при кліку на іконку лупи
    searchIcon.addEventListener('click', () => {
        triggerSearchAndFilter(); // Запускаємо пошук/фільтрацію
    });
    searchIcon.style.cursor = 'pointer'; // Робимо іконку візуально клікабельною

    // --- Перший виклик для налаштування видимості фільтрів при завантаженні ---
    updateFilterVisibility();
};