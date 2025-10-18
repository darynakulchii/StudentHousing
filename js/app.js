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

    // 2.1. УПРАВЛІННЯ СПОВІЩЕННЯМИ (Side-Notifications)
    const notificationIconContainer = document.querySelector('.notification-icon-container');
    const notificationSidebar = document.getElementById('notificationSidebar');
    const btnCloseNotifications = document.getElementById('btnCloseNotifications');


    // Функція для відкриття/закриття меню
    const toggleMenu = (action) => {
        if (action === 'open') {
            mobileMenuWindow.classList.add('open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else if (action === 'close') {
            mobileMenuWindow.classList.remove('open');
            // Перевіряємо, чи інші сайдбари не відкриті, перш ніж приховати оверлей
            if (!filterSidebar.classList.contains('open') && !notificationSidebar.classList.contains('open')) {
                overlay.classList.remove('active');
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
            // Перевіряємо, чи інші сайдбари не відкриті
            if (!mobileMenuWindow.classList.contains('open') && !notificationSidebar.classList.contains('open')) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    };

    // Функція для відкриття/закриття сповіщень
    const toggleNotifications = (action) => {
        if (action === 'open') {
            notificationSidebar.classList.add('open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Скидаємо лічильник при відкритті
            if (currentNotificationCount > 0) {
                updateNotificationCount(0);
                currentNotificationCount = 0;
            }
        } else if (action === 'close') {
            notificationSidebar.classList.remove('open');
            // Перевіряємо, чи інші сайдбари не відкриті
            if (!mobileMenuWindow.classList.contains('open') && !filterSidebar.classList.contains('open')) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    };


    // ЛОГІКА СПОВІЩЕНЬ
    const notificationBadge = document.getElementById('notificationBadge');

    const updateNotificationCount = (count) => {
        if (notificationBadge) {
            if (count > 0) {
                notificationBadge.textContent = count > 9 ? '9+' : count;
                notificationBadge.style.display = 'flex';
            } else {
                notificationBadge.style.display = 'none';
            }
        }
    };

    let currentNotificationCount = 2; // Приклад
    updateNotificationCount(currentNotificationCount);

    if (notificationIconContainer) {
        notificationIconContainer.addEventListener('click', () => {
            toggleNotifications('open');
        });
    }

    // Обробник для кнопки закриття сповіщень
    if (btnCloseNotifications) {
        btnCloseNotifications.addEventListener('click', () => toggleNotifications('close'));
    }

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

    // Закриття всіх сайдбарів при кліку на оверлей
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (mobileMenuWindow && mobileMenuWindow.classList.contains('open')) {
                toggleMenu('close');
            }
            if (filterSidebar && filterSidebar.classList.contains('open')) {
                toggleFilters('close');
            }
            // НОВИЙ КОД: Закриття сайдбара сповіщень
            if (notificationSidebar && notificationSidebar.classList.contains('open')) {
                toggleNotifications('close');
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
    const priceInput = document.getElementById('price');
    const priceValueSpan = document.getElementById('priceValue');

    // Для оновлення ціни
    if (priceInput && priceValueSpan) {
        priceInput.addEventListener('input', () => {
            priceValueSpan.innerText = priceInput.value;
        });
    }

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

            // Обробник для кнопки "Скинути"
            filtersForm.querySelector('.reset-filters-btn').addEventListener('click', (e) => {
                e.preventDefault();
                filtersForm.reset();

                // Скидаємо відображення ціни
                if (priceInput && priceValueSpan) {
                    priceValueSpan.innerText = priceInput.max;
                }
                console.log('Фільтри скинуто');
                // *Тут має бути функція для завантаження всіх оголошень без фільтрів*
            });
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

    // 4.1. ЛОГІКА КНОПОК ДІЙ
    const actionButtons = document.querySelectorAll('.main-actions-menu .action-btn');

    if (actionButtons.length > 0) {
        actionButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 1. Видаляємо клас 'active-action' з усіх кнопок
                actionButtons.forEach(btn => btn.classList.remove('active-action'));

                // 2. Додаємо клас 'active-action' до поточної кнопки
                button.classList.add('active-action');

                // 3. (Заглушка) Виводимо в консоль обрану дію
                const actionType = button.getAttribute('data-type');
                console.log('Обрана дія:', actionType);
                // Тут має бути логіка для фільтрування оголошень за типом
            });
        });
    }

});