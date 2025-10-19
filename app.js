// =================================================================================
// 1. ГЛОБАЛЬНІ ЗМІННІ ТА ФУНКЦІЇ
// =================================================================================

// ГЛОБАЛЬНІ ЗМІННІ ДЛЯ ДОСТУПУ ДО САЙДБАРІВ
// Будуть ініціалізовані пізніше у loadNavigation()
let mobileMenuWindow;
let filterSidebar;
let notificationSidebar;
let overlay;

// ЛОГІКА СПОВІЩЕНЬ
let notificationBadge;
let currentNotificationCount = 0;


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

// Функція для відкриття/закриття меню
const toggleMenu = (action) => {
    if (action === 'open') {
        mobileMenuWindow.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else if (action === 'close') {
        mobileMenuWindow.classList.remove('open');

        // --- ВИПРАВЛЕНА ЛОГІКА: Перевірка, чи відкритий ФІЛЬТР або СПОВІЩЕННЯ ---
        const isFilterOpen = filterSidebar?.classList.contains('open');
        const isNotificationOpen = notificationSidebar?.classList.contains('open');

        if (!isFilterOpen && !isNotificationOpen) {
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

        // --- ВИПРАВЛЕНА ЛОГІКА: Перевірка, чи відкритий МЕНЮ або СПОВІЩЕННЯ ---
        const isMenuOpen = mobileMenuWindow?.classList.contains('open');
        const isNotificationOpen = notificationSidebar?.classList.contains('open');

        if (!isMenuOpen && !isNotificationOpen) {
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

        // --- Перевірка, чи відкритий МЕНЮ або ФІЛЬТР ---
        const isMenuOpen = mobileMenuWindow?.classList.contains('open');
        const isFilterOpen = filterSidebar?.classList.contains('open');

        if (!isMenuOpen && !isFilterOpen) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};


// =================================================================================
// 2. ФУНКЦІЇ ДЛЯ ДИНАМІЧНОГО ЗАВАНТАЖЕННЯ НАВІГАЦІЇ
// =================================================================================

const highlightActiveLink = (isPage) => {
    let currentPath = window.location.pathname.split('/').pop();
    if (isPage && currentPath !== 'index.html') {
        currentPath = 'pages/' + currentPath;
    }
    if (currentPath === '' || currentPath === 'pages/') {
        currentPath = 'index.html';
    }

    const navLinks = document.querySelectorAll('.desktop-nav a, .mobile-nav-bar a');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('data-path');
        if (linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

const loadNavigation = async () => {
    const placeholder = document.getElementById('navigation-placeholder');
    if (!placeholder) return;

    const pathSegments = window.location.pathname.split('/');
    const isPage = pathSegments.includes('pages');
    const navPath = isPage ? '../navigation.html' : 'navigation.html';

    console.log('Поточний шлях сторінки:', window.location.pathname);
    console.log('Спроба завантажити навігацію за шляхом:', navPath);

    try {
        const response = await fetch(navPath);
        placeholder.innerHTML = await response.text();

        highlightActiveLink(isPage);

        // ***************************************************************
        // 3. ІНІЦІАЛІЗАЦІЯ ЕЛЕМЕНТІВ (ПІСЛЯ ВСТАВКИ HTML)
        // ***************************************************************

        // Переприсвоюємо глобальні змінні
        mobileMenuWindow = document.getElementById('mobileMenuWindow');
        filterSidebar = document.getElementById('filterSidebar');
        notificationSidebar = document.getElementById('notificationSidebar');
        overlay = document.getElementById('overlay');

        const menuToggle = document.querySelector('.mobile-menu-toggle');
        const btnCloseMenu = document.getElementById('btnCloseMenu');
        const notificationIconContainer = document.querySelector('.notification-icon-container');
        const btnCloseNotifications = document.getElementById('btnCloseNotifications');
        const filterBtn = document.querySelector('.filter-btn');
        const btnCloseFilters = document.getElementById('btnCloseFilters');

        // Ініціалізація бейджів та лічильника
        notificationBadge = document.getElementById('notificationBadge');
        currentNotificationCount = 2; // Приклад (тут має бути виклик API)
        updateNotificationCount(currentNotificationCount);


        // Логіка для меню-бургера
        if (menuToggle && mobileMenuWindow && btnCloseMenu && overlay) {
            menuToggle.addEventListener('click', () => toggleMenu('open'));
            btnCloseMenu.addEventListener('click', () => toggleMenu('close'));
        }

        // Логіка для кнопки сповіщень
        if (notificationIconContainer) {
            notificationIconContainer.addEventListener('click', () => {
                toggleNotifications('open');
            });
        }
        // Обробник для кнопки закриття сповіщень
        if (btnCloseNotifications) {
            btnCloseNotifications.addEventListener('click', () => toggleNotifications('close'));
        }

        // Логіка для кнопки фільтрів - ПЕРЕНЕСЕНО З ДРУГОГО БЛОКУ
        if (filterBtn && filterSidebar && btnCloseFilters) {
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
                if (notificationSidebar && notificationSidebar.classList.contains('open')) {
                    toggleNotifications('close');
                }
            });
        }
    } catch (error) {
        console.error('Помилка завантаження навігації:', error);
    }
};

// =================================================================================
// 4. ОСНОВНИЙ БЛОК DOMContentLoaded (ОБ'ЄДНАНО)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {

    // ВІДКРИТТЯ АСИНХРОННОЇ IIFE
    (async () => {

        // 0. ЗАВАНТАЖЕННЯ НАВІГАЦІЇ (ЧЕКАЄМО ЇЇ ВСТАВКИ)
        await loadNavigation();

        // ------------------------------------------------------------------
        // --- ЗМІНА: Запускаємо ОБИДВІ функції. ---
        // Вони самі перевірять, чи на потрібній вони сторінці.
        // ------------------------------------------------------------------

        // Завантажує список для головної
        await fetchAndDisplayListings();

        // Завантажує деталі для сторінки оголошення
        await fetchAndDisplayListingDetail();
        // ------------------------------------------------------------------


        // 1. ВИКЛИК НОВОЇ ФУНКЦІЇ ЛОГІКИ ФОРМИ
        if (window.location.pathname.endsWith('add_listing.html') || window.location.pathname.endsWith('add_listing')) {
            await handleListingSubmission();
        }

        // 2. ПОШУК (заглушка)
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('Пошук за запитом:', searchInput.value);
                }
            });
        }

        // 3. Логіка застосування/скидання фільтрів - ПЕРЕНЕСЕНО З ДРУГОГО БЛОКУ
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
                toggleFilters('close'); // Викликаємо функцію, яка тепер глобальна
            });

            // Обробник для кнопки "Скинути"
            filtersForm.querySelector('.reset-filters-btn').addEventListener('click', (e) => {
                e.preventDefault();
                filtersForm.reset();

                // Скидаємо відображення ціни
                const currentPriceInput = document.getElementById('price');
                const currentPriceValueSpan = document.getElementById('priceValue');

                if (currentPriceInput && currentPriceValueSpan) {
                    currentPriceValueSpan.innerText = currentPriceInput.max;
                }
                console.log('Фільтри скинуто');
            });
        }


        // 4. ЛОГІКА КНОПОК ДІЙ
        const actionButtons = document.querySelectorAll('.main-actions-menu .action-btn');

        if (actionButtons.length > 0) {
            actionButtons.forEach(button => {
                button.addEventListener('click', () => {
                    actionButtons.forEach(btn => btn.classList.remove('active-action'));
                    button.classList.add('active-action');
                    const actionType = button.getAttribute('data-type');
                    console.log('Обрана дія:', actionType);
                });
            });
        }
    })();
});

// =================================================================================
// 5. ЛОГІКА ДОДАВАННЯ ОГОЛОШЕННЯ
// =================================================================================

const handleListingSubmission = async () => {
    const form = document.getElementById('addListingForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = {
            characteristics: [],
        };

        // Збір даних з форми
        formData.forEach((value, key) => {
            // Характеристики збираємо як масив
            if (key === 'characteristics') {
                data.characteristics.push(value);
            } else {
                data[key] = value;
            }
        });

        // Відправка даних на бекенд
        try {
            const response = await fetch('http://localhost:3000/api/listings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const result = await response.json();
                alert(`Успіх! ${result.message} (ID: ${result.listingId})`);
                form.reset();
                window.location.href = 'index.html'; // Перенаправлення на головну
            } else {
                const errorData = await response.json();
                alert(`Помилка публікації: ${errorData.error || 'Невідома помилка'}`);
            }

        } catch (error) {
            console.error('Помилка мережі/сервера:', error);
            alert('Не вдалося з’єднатися з сервером. Перевірте, чи запущено бекенд (http://localhost:3000).');
        }
    });
};

// =================================================================================
// 6. ЛОГІКА ЗАВАНТАЖЕННЯ ОГОЛОШЕНЬ (ДЛЯ index.html)
// =================================================================================

const fetchAndDisplayListings = async () => {
    // 1. Знаходимо контейнер на сторінці
    const container = document.querySelector('.listings-container');

    // Якщо контейнера на поточній сторінці немає, нічого не робимо
    if (!container) return;

    try {
        // 2. Робимо запит до вашого локального сервера
        const response = await fetch('http://localhost:3000/api/listings');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const listings = await response.json();

        // 3. Очищуємо контейнер (про всяк випадок)
        container.innerHTML = '';

        // 4. Перевіряємо, чи є оголошення
        if (listings.length === 0) {
            container.innerHTML = '<p style="color: var(--text-light);">Наразі активних оголошень немає.</p>';
            return;
        }

        // 5. Створюємо HTML для кожного оголошення
        listings.forEach(listing => {
            // Встановлюємо фото-заглушку, якщо URL не вказано
            const imageUrl = listing.main_photo_url || 'https://picsum.photos/400/300?random=' + listing.listing_id;

            // --- ЗМІНА: Вся картка тепер є посиланням ---
            const listingCard = `
                <a href="listing_detail.html?id=${listing.listing_id}" class="listing-card-link">
                    <div class="listing-card large-card">
                        <img src="${imageUrl}" alt="${listing.title}" class="listing-image">
                        <div class="info-overlay">
                            <span class="price-tag">₴${listing.price} / міс</span>
                        </div>
                        <div class="listing-content">
                            <h3>${listing.title}</h3>
                            <p class="details"><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто не вказано'}</p>
                        </div>
                    </div>
                </a>
            `;
            // Додаємо картку в контейнер
            container.innerHTML += listingCard;
        });

    } catch (error) {
        console.error('Не вдалося завантажити оголошення:', error);
        container.innerHTML = '<p style="color: #e74c3c; font-weight: 600;">Помилка: Не вдалося з’єднатися з сервером для завантаження оголошень.</p>';
    }
};


// =================================================================================
// 7. --- НОВА ФУНКЦІЯ: ЛОГІКА ЗАВАНТАЖЕННЯ ДЕТАЛЕЙ ОГОЛОШЕННЯ ---
// =================================================================================

const fetchAndDisplayListingDetail = async () => {
    // Шукаємо контейнер зі сторінки listing_detail.html
    const container = document.getElementById('listingDetailContainer');

    // Якщо контейнера немає (ми не на тій сторінці), виходимо
    if (!container) return;

    try {
        // 1. Отримуємо ID оголошення з URL (?id=...)
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('id');

        if (!listingId) {
            container.innerHTML = '<h1 style="text-align: center;">Помилка: ID оголошення не вказано.</h1>';
            return;
        }

        // 2. Робимо запит до нашого нового API endpoint
        const response = await fetch(`http://localhost:3000/api/listings/${listingId}`);

        if (response.status === 404) {
            container.innerHTML = '<h1 style="text-align: center;">Помилка 404: Оголошення не знайдено.</h1>';
            return;
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const listing = await response.json(); // Отримуємо об'єкт з (listing, photos, characteristics)

        // 3. Встановлюємо заголовок сторінки у браузері
        document.title = `UniHome | ${listing.title}`;

        // 4. Генеруємо HTML

        // Визначаємо головне фото
        const mainImage = listing.photos.find(p => p.is_main) || listing.photos[0] || { image_url: 'https://picsum.photos/800/600?random=' + listing.listing_id };

        // Створюємо HTML для галереї (якщо є інші фото)
        let photoGalleryHTML = '';
        if (listing.photos.length > 1) {
            photoGalleryHTML = listing.photos
                .filter(p => !p.is_main) // Беремо всі, окрім головного
                .map(photo => `<img src="${photo.image_url}" alt="Фото ${listing.title}" class="gallery-thumbnail">`)
                .join('');
        }

        // Створюємо HTML для списку характеристик
        let characteristicsHTML = '';
        if (listing.characteristics.length > 0) {
            characteristicsHTML = listing.characteristics
                .map(char => `<span class="char-tag">${char.name_ukr}</span>`)
                .join('');
        } else {
            characteristicsHTML = '<p>Характеристики не вказані.</p>';
        }

        // 5. Збираємо все до купи і вставляємо на сторінку
        const detailHTML = `
            <div class="listing-detail-layout">
                <div class="listing-detail-gallery">
                    <div class="main-image-container">
                        <img src="${mainImage.image_url}" alt="${listing.title}" id="mainDetailImage">
                    </div>
                    ${photoGalleryHTML ? `
                    <div class="thumbnail-gallery">
                        ${photoGalleryHTML}
                    </div>
                    ` : ''}
                </div>

                <div class="listing-detail-info">
                    <h1>${listing.title}</h1>
                    <span class="detail-price">₴${listing.price} / міс</span>
                    
                    <div class="detail-meta">
                        <p><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто не вказано'}</p>
                        <p><i class="fas fa-university"></i> ${listing.university || 'Університет не вказано'}</p>
                    </div>

                    <div class="detail-section">
                        <h2>Опис</h2>
                        <p>${listing.description.replace(/\\n/g, '<br>')}</p>
                    </div>

                    <div class="detail-section">
                        <h2>Характеристики</h2>
                        <div class="characteristics-list">
                            ${characteristicsHTML}
                        </div>
                    </div>
                </div>

                <aside class="listing-detail-author">
                    <h3>Автор оголошення</h3>
                    <div class="author-card">
                        <div class="author-avatar">
                             <i class="fas fa-user-circle"></i>
                        </div>
                        <p class="author-name">${listing.first_name} ${listing.last_name}</p>
                        <a href="chat.html?user_id=${listing.user_id}" class="contact-btn">
                            <i class="fas fa-comment-dots"></i> Зв'язатись з автором
                        </a>
                    </div>
                </aside>
            </div>
        `;

        container.innerHTML = detailHTML;

    } catch (error) {
        console.error('Помилка завантаження деталей оголошення:', error);
        container.innerHTML = '<h1 style="text-align: center;">Помилка завантаження</h1><p style="text-align: center;">Не вдалося отримати деталі. Перевірте консоль та чи запущено бекенд.</p>';
    }
};