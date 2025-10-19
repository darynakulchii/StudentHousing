// =================================================================================
// 0. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ АВТЕНТИФІКАЦІЇ (НОВІ)
// =================================================================================

// Отримує токен з localStorage
const getToken = () => {
    return localStorage.getItem('authToken');
};

// Зберігає токен в localStorage
const setToken = (token) => {
    localStorage.setItem('authToken', token);
};

// Видаляє токен (для виходу)
const removeToken = () => {
    localStorage.removeItem('authToken');
};

// Створює заголовки для захищених запитів
const getAuthHeaders = () => {
    const token = getToken();
    if (token) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }
    return { 'Content-Type': 'application/json' };
};

// Розшифровує JWT токен (без верифікації, лише для отримання ID)
const parseJwt = (token) => {
    if (!token) { return null; }
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Помилка парсингу JWT:", e);
        return null;
    }
};

// Отримуємо ID поточного користувача з токена
const getMyUserId = () => {
    const token = getToken();
    const payload = parseJwt(token);
    return payload ? payload.userId : null;
};

// ОНОВЛЕНА ГЛОБАЛЬНА ЗМІННА
const MY_USER_ID = getMyUserId();


// =================================================================================
// 1. ГЛОБАЛЬНІ ЗМІННІ ТА ФУНКЦІЇ
// =================================================================================

let mobileMenuWindow;
let filterSidebar;
let notificationSidebar;
let overlay;
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
        if (currentNotificationCount > 0) {
            updateNotificationCount(0);
            currentNotificationCount = 0;
        }
    } else if (action === 'close') {
        notificationSidebar.classList.remove('open');
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

// ★★★ ОНОВЛЕНА ФУНКЦІЯ ★★★
// Керує посиланнями "Вхід" / "Вихід" та Аватаром
const setupNavLinks = () => {
    const isLoggedIn = !!getToken(); // Перевіряємо, чи є токен

    const navLoginLink = document.getElementById('navLoginLink');
    const navRegisterLink = document.getElementById('navRegisterLink');
    const navProfileLink = document.getElementById('navProfileLink');
    const navLogoutLink = document.getElementById('navLogoutLink');
    const userAvatar = document.querySelector('.user-avatar');

    // 1. ЗАВЖДИ ПОКАЗУВАТИ АВАТАР
    if (userAvatar) {
        userAvatar.style.display = 'block';
    }

    if (isLoggedIn) {
        // --- Користувач ЗАЛОГІНЕНИЙ ---
        if (navLoginLink) navLoginLink.style.display = 'none';
        if (navRegisterLink) navRegisterLink.style.display = 'none';
        if (navProfileLink) navProfileLink.style.display = 'block';
        if (navLogoutLink) navLogoutLink.style.display = 'block';

        if (userAvatar) {
            userAvatar.href = 'profile.html'; // 2. Посилання веде на профіль
        }

        if (navLogoutLink) {
            // Додаємо слухач, ЛИШЕ ЯКЩО ВІН ЩЕ НЕ ДОДАНИЙ (щоб уникнути дублів)
            if (!navLogoutLink.hasAttribute('data-listener-added')) {
                navLogoutLink.setAttribute('data-listener-added', 'true');
                navLogoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    removeToken(); // Видаляємо токен
                    alert('Ви вийшли з системи.');
                    window.location.href = 'index.html'; // Перенаправляємо на головну
                });
            }
        }
    } else {
        // --- Користувач НЕ ЗАЛОГІНЕНИЙ ---
        if (navLoginLink) navLoginLink.style.display = 'block';
        if (navRegisterLink) navRegisterLink.style.display = 'block';
        if (navProfileLink) navProfileLink.style.display = 'none';
        if (navLogoutLink) navLogoutLink.style.display = 'none';

        if (userAvatar) {
            userAvatar.href = 'login.html'; // 2. Посилання веде на сторінку входу
        }
    }
};

const loadNavigation = async () => {
    const placeholder = document.getElementById('navigation-placeholder');
    if (!placeholder) return;

    const pathSegments = window.location.pathname.split('/');
    const isPage = pathSegments.includes('pages');
    const navPath = isPage ? '../navigation.html' : 'navigation.html';

    try {
        const response = await fetch(navPath);
        placeholder.innerHTML = await response.text();

        highlightActiveLink(isPage);
        setupNavLinks(); // ВИКЛИК ОНОВЛЕНОЇ ФУНКЦІЇ

        // ІНІЦІАЛІЗАЦІЯ ЕЛЕМЕНТІВ
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

        notificationBadge = document.getElementById('notificationBadge');
        currentNotificationCount = 2;
        updateNotificationCount(currentNotificationCount);

        if (menuToggle && mobileMenuWindow && btnCloseMenu && overlay) {
            menuToggle.addEventListener('click', () => toggleMenu('open'));
            btnCloseMenu.addEventListener('click', () => toggleMenu('close'));
        }
        if (notificationIconContainer) {
            notificationIconContainer.addEventListener('click', () => toggleNotifications('open'));
        }
        if (btnCloseNotifications) {
            btnCloseNotifications.addEventListener('click', () => toggleNotifications('close'));
        }
        if (filterBtn && filterSidebar && btnCloseFilters) {
            filterBtn.addEventListener('click', () => toggleFilters('open'));
            btnCloseFilters.addEventListener('click', () => toggleFilters('close'));
        }
        if (overlay) {
            overlay.addEventListener('click', () => {
                if (mobileMenuWindow && mobileMenuWindow.classList.contains('open')) toggleMenu('close');
                if (filterSidebar && filterSidebar.classList.contains('open')) toggleFilters('close');
                if (notificationSidebar && notificationSidebar.classList.contains('open')) toggleNotifications('close');
            });
        }
    } catch (error) {
        console.error('Помилка завантаження навігації:', error);
    }
};

// =================================================================================
// 4. ОСНОВНИЙ БЛОК DOMContentLoaded (ОНОВЛЕНО)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {

    (async () => {
        // 0. ЗАВАНТАЖЕННЯ НАВІГАЦІЇ
        await loadNavigation();

        // Визначаємо поточну сторінку
        const path = window.location.pathname;

        // 1. ЛОГІКА ДЛЯ КОНКРЕТНИХ СТОРІНОК
        // (endsWith('/') - для кореневого шляху)
        if (path.endsWith('index.html') || path.endsWith('/')) {
            await fetchAndDisplayListings();
            setupActionButtons(); // Налаштування кнопок "Всі оголошення", "Шукаю житло"
            setupSearchAndFilters(); // Налаштування логіки фільтрів
        }

        if (path.endsWith('register.html')) {
            await handleRegistration();
        }

        // НОВА ЛОГІКА ЛОГІНУ
        if (path.endsWith('login.html')) {
            await handleLogin();
        }

        if (path.endsWith('add_listing.html')) {
            await handleListingSubmission();
        }

        if (path.endsWith('listing_detail.html')) {
            await fetchAndDisplayListingDetail();
        }

        // НОВА ЛОГІКА ЧАТУ
        if (path.endsWith('chat.html')) {
            if (!MY_USER_ID) {
                // Якщо користувач не залогінений, відправляємо на сторінку входу
                alert('Будь ласка, увійдіть, щоб переглянути повідомлення.');
                window.location.href = 'login.html';
                return;
            }
            await loadConversations();
            handleMessageSend();
            // (Логіка Socket.io буде в кінці файлу)
        }

    })(); // Кінець IIFE
});

// =================================================================================
// 5. ЛОГІКА ДОДАВАННЯ ОГОЛОШЕННЯ (ОНОВЛЕНО: +Auth)
// =================================================================================

const handleListingSubmission = async () => {
    const form = document.getElementById('addListingForm');
    if (!form) return;

    // Перевірка, чи користувач залогінений
    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб додати оголошення.');
        window.location.href = 'login.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = { characteristics: [] };
        formData.forEach((value, key) => {
            if (key === 'characteristics') data.characteristics.push(value);
            else data[key] = value;
        });

        // Відправка даних на бекенд
        try {
            const response = await fetch('http://localhost:3000/api/listings', {
                method: 'POST',
                headers: getAuthHeaders(), // ВИКОРИСТОВУЄМО ЗАГОЛОВКИ АВТЕНТИФІКАЦІЇ
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const result = await response.json();
                alert(`Успіх! ${result.message} (ID: ${result.listingId})`);
                form.reset();
                window.location.href = 'index.html'; // Перенаправлення на головну
            } else if (response.status === 401 || response.status === 403) {
                alert('Помилка автентифікації. Будь ласка, увійдіть знову.');
                window.location.href = 'login.html';
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
// 7. ЛОГІКА ЗАВАНТАЖЕННЯ ДЕТАЛЕЙ ОГОЛОШЕННЯ
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

        // НОВЕ: Перевірка, чи автор - це поточний користувач
        // (MY_USER_ID - це глобальна змінна, визначена на початку файлу)
        const contactButtonHTML = (MY_USER_ID === listing.user_id)
            ? `<a href="profile.html" class="contact-btn" style="background: #7f8c8d;">
                 <i class="fas fa-user-edit"></i> Це ваше оголошення
               </a>`
            : `<a href="chat.html?user_id=${listing.user_id}" class="contact-btn">
                 <i class="fas fa-comment-dots"></i> Зв'язатись з автором
               </a>`;

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
                        ${contactButtonHTML}
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

// =================================================================================
// 8. ЛОГІКА РЕЄСТРАЦІЇ КОРИСТУВАЧА
// =================================================================================

const handleRegistration = async () => {
    // 1. Знаходимо форму на сторінці register.html
    const form = document.getElementById('registerForm');
    if (!form) return; // Якщо форми немає, виходимо

    // 2. Додаємо слухача події "submit"
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Забороняємо стандартну відправку форми

        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        // 3. Проста валідація на фронтенді
        if (data.password !== data.confirm_password) {
            alert('Помилка: Паролі не співпадають.');
            return; // Зупиняємо виконання
        }

        // 4. Готуємо дані для відправки (без confirm_password)
        const registrationData = {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            password: data.password // Ваш бекенд очікує 'password'
        };

        // 5. Відправляємо дані на бекенд
        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(registrationData),
            });

            if (response.status === 201) {
                // Успішна реєстрація
                const result = await response.json();
                alert(`Успіх! ${result.message}. Тепер ви можете увійти.`);
                form.reset();
                window.location.href = 'login.html'; // Відправляємо на сторінку логіну
            } else {
                // Обробка помилок (наприклад, 409 - email зайнятий)
                const errorData = await response.json();
                alert(`Помилка реєстрації: ${errorData.error || 'Невідома помилка'}`);
            }

        } catch (error) {
            console.error('Помилка мережі/сервера при реєстрації:', error);
            alert('Не вдалося з’єднатися з сервером. Перевірте консоль.');
        }
    });
};

// =================================================================================
// 9. НОВА ФУНКЦІЯ: ЛОГІКА ЛОГІНУ
// =================================================================================

const handleLogin = async () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Якщо користувач вже залогінений, перенаправляємо
    if (MY_USER_ID) {
        window.location.href = 'profile.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const result = await response.json();
                setToken(result.token); // ЗБЕРІГАЄМО ТОКЕН
                alert(`Вітаємо, ${result.user.first_name}!`);
                window.location.href = 'index.html'; // Перенаправляємо на головну
            } else {
                const errorData = await response.json();
                alert(`Помилка входу: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка мережі/сервера при логіні:', error);
            alert('Не вдалося з’єднатися з сервером.');
        }
    });
};


// =================================================================================
// 10. ЛОГІКА ЧАТУ (ОНОВЛЕНО: +Auth)
// =================================================================================

// (MY_USER_ID вже визначено глобально)
let currentOpenConversationId = null;
let currentOpenReceiverId = null;

// Функція для завантаження списку розмов
const loadConversations = async () => {
    const container = document.getElementById('conversationsList');
    if (!container) return; // Ми не на сторінці чату

    try {
        const response = await fetch('http://localhost:3000/api/my-conversations', {
            headers: getAuthHeaders() // Додаємо токен
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Необхідна автентифікація для доступу до чату.');
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const conversations = await response.json();

        container.innerHTML = ''; // Очищуємо "Завантаження..."
        if (conversations.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-light);">У вас ще немає розмов.</p>';
            return;
        }

        conversations.forEach(convo => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            // Зберігаємо дані в data-атрибутах
            item.dataset.conversationId = convo.conversation_id;
            item.dataset.receiverId = convo.other_user_id;
            item.dataset.receiverName = `${convo.first_name} ${convo.last_name}`;

            item.innerHTML = `
                <span class="avatar-placeholder"><i class="fas fa-user-circle"></i></span>
                <span>${convo.first_name} ${convo.last_name}</span>
            `;
            // Додаємо обробник кліку для відкриття чату
            item.addEventListener('click', () => {
                loadMessages(convo.conversation_id, convo.other_user_id, `${convo.first_name} ${convo.last_name}`);

                // Підсвічуємо активний
                document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
            });
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Помилка завантаження розмов:', error);
        container.innerHTML = `<p style="color: red; padding: 10px;">Помилка завантаження. ${error.message}</p>`;
    }
};

// Функція для завантаження повідомлень конкретного чату
const loadMessages = async (conversationId, receiverId, receiverName) => {
    const messagesArea = document.getElementById('messagesArea');
    const chatHeader = document.getElementById('chatHeader');
    const messageForm = document.getElementById('messageForm');
    if (!messagesArea || !chatHeader || !messageForm) return;

    // Зберігаємо ID поточної розмови
    currentOpenConversationId = conversationId.toString(); // Переконуємось, що це рядок для порівняння
    currentOpenReceiverId = receiverId;

    chatHeader.textContent = receiverName; // Встановлюємо ім'я в хедері
    messageForm.style.display = 'flex'; // Показуємо форму вводу
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light; margin: auto;">Завантаження...</p>';

    try {
        const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}/messages`, {
            headers: getAuthHeaders() // Додаємо токен
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Помилка доступу до чату');
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const messages = await response.json();

        messagesArea.innerHTML = ''; // Очищуємо "Завантаження..."
        if (messages.length === 0) {
            messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light; margin: auto;">Повідомлень ще немає.</p>';
            return;
        }

        messages.forEach(msg => {
            appendMessage(msg);
        });

        // Прокручуємо до останнього повідомлення
        messagesArea.scrollTop = messagesArea.scrollHeight;

    } catch (error) {
        console.error('Помилка завантаження повідомлень:', error);
        messagesArea.innerHTML = `<p style="color: red; margin: auto;">Помилка завантаження. ${error.message}</p>`;
    }
};

// Допоміжна функція для додавання 1 повідомлення у вікно
const appendMessage = (msg) => {
    const messagesArea = document.getElementById('messagesArea');

    // Очищуємо "Повідомлень ще немає", якщо це перше повідомлення
    if(messagesArea.querySelector('p')) {
        messagesArea.innerHTML = '';
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    // Визначаємо, наше чи чуже
    if (msg.sender_id === MY_USER_ID) {
        messageEl.classList.add('sent');
    } else {
        messageEl.classList.add('received');
    }
    messageEl.textContent = msg.message_body;
    messagesArea.appendChild(messageEl);
};

// Обробка відправки нового повідомлення
const handleMessageSend = () => {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    if (!messageForm || !messageInput) return;

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageBody = messageInput.value.trim();

        // Потрібен ID отримувача, якого ми зберегли при відкритті чату
        if (messageBody === '' || !currentOpenReceiverId) return;

        try {
            const response = await fetch('http://localhost:3000/api/messages', {
                method: 'POST',
                headers: getAuthHeaders(), // Додаємо токен
                body: JSON.stringify({
                    receiver_id: currentOpenReceiverId,
                    message_body: messageBody
                })
            });

            if (response.ok) {
                //const newMessage = await response.json();
                //appendMessage(newMessage); // НЕ ДОДАЄМО ТУТ, чекаємо на socket.io
                messageInput.value = ''; // Очищуємо поле вводу

                // Прокручуємо вниз
                const messagesArea = document.getElementById('messagesArea');
                messagesArea.scrollTop = messagesArea.scrollHeight;
            } else {
                const errorData = await response.json();
                alert(`Помилка відправки: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка відправки:', error);
            alert('Помилка мережі.');
        }
    });
};

// =================================================================================
// 11. ЛОГІКА, ЯКА БУЛА В DOMContentLoaded (винесена)
// =================================================================================

// Налаштування пошуку та фільтрів (для index.html)
const setupSearchAndFilters = () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') console.log('Пошук за запитом:', searchInput.value);
        });
    }

    const filtersForm = document.querySelector('.filters-form');
    const priceInput = document.getElementById('price');
    const priceValueSpan = document.getElementById('priceValue');

    if (priceInput && priceValueSpan) {
        // Встановлюємо початкове значення
        priceValueSpan.innerText = priceInput.value;
        // Додаємо слухача
        priceInput.addEventListener('input', () => {
            priceValueSpan.innerText = priceInput.value;
        });
    }

    if (filtersForm) {
        filtersForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(filtersForm);
            const filters = {};

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
            toggleFilters('close');
        });

        const resetBtn = filtersForm.querySelector('.reset-filters-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                filtersForm.reset();
                // Скидаємо відображення ціни
                if (priceInput && priceValueSpan) {
                    priceValueSpan.innerText = priceInput.max; // Скидаємо на максимум
                }
                console.log('Фільтри скинуто');
            });
        }
    }
};

// Налаштування кнопок дій (для index.html)
const setupActionButtons = () => {
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
};


// =================================================================================
// 12. ЛОГІКА SOCKET.IO КЛІЄНТА (НОВА)
// =================================================================================

// УВАГА: Переконайтеся, що ви додали цей скрипт у <head> вашого файлу chat.html:
// <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>

document.addEventListener('DOMContentLoaded', () => {
    // Запускаємо логіку Socket.io ТІЛЬКИ на сторінці чату і ЯКЩО користувач залогінений
    if (window.location.pathname.endsWith('chat.html') && MY_USER_ID) {

        // Перевіряємо, чи бібліотека socket.io завантажилась
        if (typeof io === 'undefined') {
            console.error('Socket.io клієнт не завантажено! Додайте скрипт у chat.html');
            return;
        }

        const socket = io("http://localhost:3000");

        socket.on('connect', () => {
            console.log(`Socket.io підключено: ${socket.id}`);

            // 1. Приєднатись до всіх своїх кімнат (розмов)
            // Чекаємо, поки loadConversations() завантажить список
            // (Використовуємо MutationObserver, щоб відстежити додавання елементів)
            const list = document.getElementById('conversationsList');
            if (list) {
                const observer = new MutationObserver((mutationsList, observer) => {
                    for(const mutation of mutationsList) {
                        if (mutation.type === 'childList') {
                            const conversationItems = document.querySelectorAll('.conversation-item');
                            if (conversationItems.length > 0) {
                                console.log('Приєднуємось до кімнат socket.io...');
                                conversationItems.forEach(item => {
                                    const convoId = item.dataset.conversationId;
                                    if(convoId) {
                                        socket.emit('join_conversation', convoId);
                                    }
                                });
                                observer.disconnect(); // Зупиняємо спостереження
                            }
                        }
                    }
                });
                observer.observe(list, { childList: true, subtree: true });
            }
        });

        // 2. Слухати нові повідомлення
        socket.on('receive_message', (newMessage) => {
            console.log('Отримано нове повідомлення:', newMessage);

            // 3. Додати повідомлення, лише якщо відкритий правильний чат
            if (newMessage.conversation_id.toString() === currentOpenConversationId) {
                appendMessage(newMessage);
                const messagesArea = document.getElementById('messagesArea');
                messagesArea.scrollTop = messagesArea.scrollHeight;
            } else {
                // TODO: Показати сповіщення
                console.log("Нове повідомлення в іншому чаті!");
                currentNotificationCount++;
                updateNotificationCount(currentNotificationCount);
            }
        });

        socket.on('disconnect', () => {
            console.log('Socket.io відключено');
        });
    }
});