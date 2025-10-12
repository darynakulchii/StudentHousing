document.addEventListener('DOMContentLoaded', () => {

    // 1. УПРАВЛІННЯ МОБІЛЬНИМ МЕНЮ (Side-Menu)
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenuWindow = document.getElementById('mobileMenuWindow');
    const btnCloseMenu = document.getElementById('btnCloseMenu');
    const overlay = document.getElementById('overlay');

    // 2. УПРАВЛІННЯ ФІЛЬТРАМИ (Side-Filters)
    const filterBtn = document.querySelector('.filter-btn');
    const filterSidebar = document.getElementById('filterSidebar');
    const btnCloseFilters = document.getElementById('btnCloseFilters');

    // Функція для відкриття/закриття меню
    const toggleMenu = (action) => {
        if (action === 'open') {
            mobileMenuWindow.classList.add('open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else if (action === 'close') {
            mobileMenuWindow.classList.remove('open');
            overlay.classList.remove('active');
            // Відновлення прокручування, тільки якщо фільтри теж закриті
            if (filterSidebar && !filterSidebar.classList.contains('open')) {
                document.body.style.overflow = '';
            }
        }
    };

    // Функція для відкриття/закриття фільтрів
    const toggleFilters = (action) => {
        if (action === 'open') {
            filterSidebar.classList.add('open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else if (action === 'close') {
            filterSidebar.classList.remove('open');
            overlay.classList.remove('active');
            // Відновлення прокручування, тільки якщо меню теж закрите
            if (mobileMenuWindow && !mobileMenuWindow.classList.contains('open')) {
                document.body.style.overflow = '';
            }
        }
    };


    // ====================================
    // 5. ЛОГІКА СПОВІЩЕНЬ
    // ====================================
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationIconContainer = document.querySelector('.notification-icon-container');

    /**
     * Оновлює лічильник сповіщень.
     * @param {number} count - Кількість нових повідомлень.
     */
    const updateNotificationCount = (count) => {
        if (notificationBadge) {
            if (count > 0) {
                // Відображаємо кількість
                notificationBadge.textContent = count > 9 ? '9+' : count;
                notificationBadge.style.display = 'flex';
            } else {
                // Приховуємо, якщо немає сповіщень
                notificationBadge.style.display = 'none';
            }
        }
    };

    // ЦЕЙ БЛОК ТРЕБА ПЕРЕПИСАТИ
    //
    // (це поки тільки чернетка як це мало б працювати)
    // Ініціалізуємо лічильник (наприклад, 3 нових сповіщення)
    let currentNotificationCount =0;
    updateNotificationCount(currentNotificationCount);

    // Додаємо обробник кліку на іконку
    if (notificationIconContainer) {
        notificationIconContainer.addEventListener('click', () => {
            alert(`Ви відкрили сповіщення. Було ${currentNotificationCount} нових повідомлень.`);

            // Скидаємо лічильник після "перегляду"
            currentNotificationCount = 0;
            updateNotificationCount(currentNotificationCount);

            // Тут може бути логіка для переходу на сторінку сповіщень
        });
    }
    //

    // Логіка для меню-бургера
    if (menuToggle && mobileMenuWindow && btnCloseMenu && overlay) {
        menuToggle.addEventListener('click', () => toggleMenu('open'));
        btnCloseMenu.addEventListener('click', () => toggleMenu('close'));
    }

    // Логіка для кнопки фільтрів
    if (filterBtn && filterSidebar && btnCloseFilters && overlay) {
        filterBtn.addEventListener('click', () => toggleFilters('open'));
        btnCloseFilters.addEventListener('click', () => toggleFilters('close'));
    }

    // Закриття обох при кліку на оверлей
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (mobileMenuWindow && mobileMenuWindow.classList.contains('open')) {
                toggleMenu('close');
            }
            if (filterSidebar && filterSidebar.classList.contains('open')) {
                toggleFilters('close');
            }
        });
    }


    // 3. ПОШУК (заглушка)
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Пошук за запитом:', searchInput.value);
            }
        });
    }

    // 4. Логіка застосування/скидання фільтрів
    const filtersForm = document.querySelector('.filters-form');
    if (filtersForm) {
        filtersForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(filtersForm);
            const filters = {};

            // Збираємо дані форми
            formData.getAll('characteristics').forEach(value => {
                filters['characteristics'] = filters['characteristics'] || [];
                filters['characteristics'].push(value);
            });
            for (const [key, value] of formData.entries()) {
                if (key !== 'characteristics') {
                    filters[key] = value;
                }
            }

            console.log('Застосовано фільтри:', filters);
            alert('Фільтри застосовано! Результати у консолі.');
            toggleFilters('close'); // Закриваємо сайдбар

            // *Тут має бути логіка відправки запиту на API для фільтрування*
        });

        // Обробник для кнопки "Скинути"
        filtersForm.querySelector('.reset-filters-btn').addEventListener('click', (e) => {
            e.preventDefault();
            filtersForm.reset();
            // Скидаємо відображення ціни
            const priceInput = document.getElementById('price');
            document.getElementById('priceValue').innerText = priceInput.max;
            console.log('Фільтри скинуто');
            // *Тут має бути функція для завантаження всіх оголошень без фільтрів*
        });
    }
});