// =================================================================================
// 0. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ АВТЕНТИФІКАЦІЇ
// =================================================================================

const getToken = () => {
    return localStorage.getItem('authToken');
};

const setToken = (token) => {
    localStorage.setItem('authToken', token);
};

const removeToken = () => {
    localStorage.removeItem('authToken');
};

// === ВИПРАВЛЕНО 1: Функція getAuthHeaders ===
// Тепер приймає аргумент isJson. Якщо false, 'Content-Type' не додається,
// дозволяючи браузеру самому встановити 'multipart/form-data' для файлів.
const getAuthHeaders = (isJson = true) => {
    const token = getToken();
    const headers = {}; // Створюємо порожній об'єкт

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
};

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

/**
 * Отримує ID користувача з токена, ЯКЩО токен існує І ВІН ДІЙСНИЙ.
 * Якщо токен протермінований, він видаляється.
 */
const getMyUserId = () => {
    const token = getToken();
    if (!token) {
        return null;
    }
    const payload = parseJwt(token);
    if (!payload) {
        removeToken(); // Токен пошкоджений, видаляємо
        return null;
    }
    // 'exp' (expiry) в JWT – це секунди, а Date.now() – мілісекунди
    if (payload.exp && (payload.exp * 1000 < Date.now())) {
        console.log("JWT токен протермінований. Видаляємо.");
        removeToken(); // Токен протермінований, видаляємо
        return null; // Вважаємо користувача неавторизованим
    }
    // Якщо токен валідний, повертаємо ID
    return payload.userId;
};

// Глобальна константа, що визначає стан авторизації
const MY_USER_ID = getMyUserId();

// =================================================================================
// 1. ГЛОБАЛЬНІ ЗМІННІ ТА ФУНКЦІЇ ІНТЕРФЕЙСУ
// =================================================================================

let mobileMenuWindow;
let filterSidebar;
let notificationSidebar;
let overlay;
let notificationBadge;
let currentNotificationCount = 0; // Приклад

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

const toggleMenu = (action) => {
    if (!mobileMenuWindow || !overlay) return;
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

const toggleFilters = (action) => {
    if (!filterSidebar || !overlay) return;
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

const toggleNotifications = (action) => {
    if (!notificationSidebar || !overlay) return;
    if (action === 'open') {
        notificationSidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        // Приклад скидання лічильника при відкритті
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

// --- ФОТО: Додаємо URL за замовчуванням ---
// === ОНОВЛЕНО: Новий URL для аватара за замовчуванням ===
const DEFAULT_AVATAR_URL = 'https://placehold.co/120x120/EBF4FF/7F9CF5?text=User'; // Схожий на іконку
const DEFAULT_LISTING_IMAGE = {
    'rent_out': 'https://via.placeholder.com/400x300.png?text=Rent+Out',
    'find_mate': 'https://via.placeholder.com/400x300.png?text=Find+Mate',
    'find_home': 'https://via.placeholder.com/400x300.png?text=Find+Home',
    'default': 'https://picsum.photos/400/300' // Загальний
};

// =================================================================================
// 2. ЛОГІКА ЗАВАНТАЖЕННЯ НАВІГАЦІЇ
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

const setupNavLinks = async () => { // --- ФОТО: Зроблено async ---
    const isLoggedIn = !!MY_USER_ID;
    const navLoginLink = document.getElementById('navLoginLink');
    const navRegisterLink = document.querySelector('a[href="register.html"]');
    const userAvatarElement = document.querySelector('.user-avatar'); // --- ФОТО: Змінено на елемент ---

    if (isLoggedIn) {
        if (navLoginLink) navLoginLink.style.display = 'none';
        if (navRegisterLink) navRegisterLink.style.display = 'none';

        // --- ФОТО: Завантажуємо дані профілю для аватара в хедері ---
        try {
            const response = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
            if (response.ok) {
                const user = await response.json();
                if (userAvatarElement) {
                    userAvatarElement.style.backgroundImage = `url('${user.avatar_url || DEFAULT_AVATAR_URL}')`;
                    userAvatarElement.href = 'profile.html'; // Посилання веде на профіль
                }
            } else {
                if (userAvatarElement) userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
            }
        } catch (error) {
            console.error("Помилка завантаження аватара для хедера:", error);
            if (userAvatarElement) userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
        }
        // -----------------------------------------------------------------

    } else {
        if (navLoginLink) navLoginLink.style.display = 'block';
        if (navRegisterLink) navRegisterLink.style.display = 'block';
        // --- ФОТО: Встановлюємо дефолтний аватар і посилання на логін ---
        if (userAvatarElement) {
            userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
            userAvatarElement.href = 'login.html'; // Посилання веде на логін
        }
        // --------------------------------------------------------------
    }
};

/**
 * Асинхронно завантажує navigation.html у placeholder
 */
const loadNavigation = async () => {
    const placeholder = document.getElementById('navigation-placeholder');
    if (!placeholder) return;

    const pathSegments = window.location.pathname.split('/');
    const isPage = pathSegments.includes('pages'); // Перевірка, чи ми не в корені
    const navPath = isPage ? '../navigation.html' : 'navigation.html';

    try {
        const response = await fetch(navPath);
        placeholder.innerHTML = await response.text();

        // Ініціалізація глобальних змінних (після завантаження)
        mobileMenuWindow = document.getElementById('mobileMenuWindow');
        filterSidebar = document.getElementById('filterSidebar');
        notificationSidebar = document.getElementById('notificationSidebar');
        overlay = document.getElementById('overlay');
        notificationBadge = document.getElementById('notificationBadge');

        // Налаштування посилань
        highlightActiveLink(isPage);
        await setupNavLinks();

        // Приклад сповіщень
        currentNotificationCount = 2; // (Це можна замінити на fetch)
        updateNotificationCount(currentNotificationCount);

        // Налаштування слухачів подій
        document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => toggleMenu('open'));
        document.getElementById('btnCloseMenu')?.addEventListener('click', () => toggleMenu('close'));

        document.querySelector('.notification-icon-container')?.addEventListener('click', () => toggleNotifications('open'));
        document.getElementById('btnCloseNotifications')?.addEventListener('click', () => toggleNotifications('close'));

        // Слухач для кнопки фільтрів тепер тут
        document.querySelector('.filter-btn')?.addEventListener('click', () => toggleFilters('open'));
        document.getElementById('btnCloseFilters')?.addEventListener('click', () => toggleFilters('close'));

        overlay?.addEventListener('click', () => {
            toggleMenu('close');
            toggleFilters('close');
            toggleNotifications('close');
        });

    } catch (error) {
        console.error('Помилка завантаження навігації:', error);
    }
};

// =================================================================================
// 3. ЛОГІКА КОНКРЕТНИХ СТОРІНОК
// =================================================================================

// --- Логіка index.html ---

// ОНОВЛЕНО: Функція тепер приймає query string для фільтрації
const fetchAndDisplayListings = async (filterQuery = '') => {
    const container = document.querySelector('.listings-container');
    if (!container) return;

    // Показуємо індикатор завантаження
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Завантаження оголошень...</p>';

    try {
        // ОНОВЛЕНО: Додаємо query string до запиту
        // За замовчуванням (якщо filterQuery порожній) не показуємо "шукаю житло"
        const defaultQuery = 'listing_type!=find_home';
        const finalQuery = filterQuery || defaultQuery;

        const response = await fetch(`http://localhost:3000/api/listings?${finalQuery}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const listings = await response.json();
        container.innerHTML = '';

        if (listings.length === 0) {
            // ОНОВЛЕНО: Повідомлення про відсутність результатів
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">За вашими фільтрами оголошень не знайдено.</p>';
            return;
        }

        listings.forEach(listing => {
            const imageUrl = listing.main_photo_url
                || DEFAULT_LISTING_IMAGE[listing.listing_type]
                || DEFAULT_LISTING_IMAGE['default'];

            // Визначення типу оголошення для тегу
            let typeTag = '';
            if(listing.listing_type === 'rent_out') {
                typeTag = '<span class="type-tag rent">Здають</span>';
            } else if (listing.listing_type === 'find_mate') {
                typeTag = '<span class="type-tag mate">Шукають сусіда</span>';
            } else if (listing.listing_type === 'find_home') {
                typeTag = '<span class="type-tag home">Шукають житло</span>';
            }

            const listingCard = `
                <a href="listing_detail.html?id=${listing.listing_id}" class="listing-card-link">
                    <div class="listing-card large-card">
                        <img src="${imageUrl}" alt="${listing.title}" class="listing-image">
                        <div class="info-overlay">
                            <span class="price-tag">₴${listing.price || '...'} / міс</span>
                            ${typeTag} 
                        </div>
                        <div class="listing-content">
                            <h3>${listing.title}</h3>
                            <p class="details"><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто не вказано'}</p>
                        </div>
                    </div>
                </a>
            `;
            container.innerHTML += listingCard;
        });

    } catch (error) {
        console.error('Не вдалося завантажити оголошення:', error);
        container.innerHTML = '<p style="color: #e74c3c; font-weight: 600; text-align: center; padding: 20px;">Помилка: Не вдалося з’єднатися з сервером для завантаження оголошень.</p>';
    }
};

/**
 * =======================================================================
 * ЦЯ ФУНКЦІЯ КЕРУЄ ВСІЄЮ ЛОГІКОЮ ФІЛЬТРІВ ТА КНОПОК НА index.html
 * =======================================================================
 */
const setupHomepageLogic = () => {
    const filtersForm = document.getElementById('filtersForm');
    const actionButtons = document.querySelectorAll('.main-actions-menu .action-btn');
    const searchInput = document.querySelector('.search-input');
    const searchIcon = document.querySelector('.search-icon'); // НОВЕ

    if (!filtersForm || !actionButtons.length || !searchInput || !searchIcon) return;

    // --- 1. Центральна функція для пошуку та фільтрації ---
    const triggerSearchAndFilter = () => {
        const formData = new FormData(filtersForm);
        const params = new URLSearchParams();

        // 1. Додаємо пошуковий запит
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            params.append('search', searchTerm);
        }

        // 2. Збираємо всі прапорці "characteristics"
        const characteristics = [];
        filtersForm.querySelectorAll('input[name="characteristics"]:checked').forEach(checkbox => {
            characteristics.push(checkbox.value);
        });

        // 3. Додаємо всі інші поля (city, price_min, rooms...)
        formData.forEach((value, key) => {
            // Додаємо, ТІЛЬКИ ЯКЩО поле не 'characteristics' і має значення
            if (key !== 'characteristics' && value) {
                params.append(key, value);
            }
        });

        // 4. Додаємо характеристики як рядок, розділений комою
        if (characteristics.length > 0) {
            params.append('characteristics', characteristics.join(','));
        }

        const filterQuery = params.toString();

        console.log('Застосування пошуку/фільтрів:', filterQuery);

        // 5. Викликаємо оновлену функцію завантаження
        fetchAndDisplayListings(filterQuery);
    };

    // --- 2. Логіка динамічної видимості фільтрів (адаптовано з add_listing) ---
    const updateFilterVisibility = () => {
        const form = filtersForm; // Просто для коротшого імені

        // Знаходимо всі динамічні секції
        const housingFilters = form.querySelector('#housingFilters');
        const listingDetails = form.querySelector('#listingDetails');
        const aboutMe = form.querySelector('#aboutMe');
        const roommatePrefs = form.querySelector('#roommatePreferences');

        // Отримуємо обраний тип
        const selectedType = form.querySelector('input[name="listing_type"]:checked')?.value;

        // 1. Все ховаємо
        housingFilters.style.display = 'none';
        listingDetails.style.display = 'none';
        aboutMe.style.display = 'none';
        roommatePrefs.style.display = 'none';

        // 2. Показуємо потрібні секції
        if (selectedType === 'find_home') {
            housingFilters.style.display = 'block';
            aboutMe.style.display = 'block';
            roommatePrefs.style.display = 'block';
        } else if (selectedType === 'rent_out') {
            listingDetails.style.display = 'block';
        } else if (selectedType === 'find_mate') {
            listingDetails.style.display = 'block';
            aboutMe.style.display = 'block';
            roommatePrefs.style.display = 'block';
        } else {
            // "Всі" (selectedType === '') - показуємо всі можливі блоки
            housingFilters.style.display = 'block';
            listingDetails.style.display = 'block';
            aboutMe.style.display = 'block';
            roommatePrefs.style.display = 'block';
        }
    };

    // --- 3. Логіка головних кнопок ---
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            actionButtons.forEach(btn => btn.classList.remove('active-action'));
            button.classList.add('active-action');

            const actionType = button.getAttribute('data-type');
            console.log('Обрана дія:', actionType);

            const typeValue = (actionType === 'all_listings') ? '' : actionType;

            // Скидаємо форму І пошук
            filtersForm.reset();
            searchInput.value = '';

            // Встановлюємо потрібний тип у сайдбарі
            const radioInForm = filtersForm.querySelector(`input[name="listing_type"][value="${typeValue}"]`);
            if (radioInForm) {
                radioInForm.checked = true;
            }

            // Оновлюємо видимість фільтрів у сайдбарі
            updateFilterVisibility();

            // Викликаємо завантаження (пошук) лише з одним цим фільтром
            const query = typeValue ? `listing_type=${typeValue}` : 'listing_type!=find_home';
            fetchAndDisplayListings(query);
        });
    });

    // --- 4. Логіка радіо-кнопок УСЕРЕДИНІ сайдбару ---
    filtersForm.querySelectorAll('input[name="listing_type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateFilterVisibility();

            // Синхронізуємо головні кнопки
            const typeValue = radio.value || 'all_listings';
            actionButtons.forEach(btn => btn.classList.remove('active-action'));
            const matchingButton = document.querySelector(`.action-btn[data-type="${typeValue}"]`);
            if (matchingButton) {
                matchingButton.classList.add('active-action');
            }
        });
    });

    // --- 5. Логіка відправки форми (кнопка "Застосувати") ---
    filtersForm.addEventListener('submit', (e) => {
        e.preventDefault();
        triggerSearchAndFilter(); // Викликаємо центральну функцію
        toggleFilters('close'); // Ховаємо сайдбар
    });

    // --- 6. Логіка кнопки "Скинути" ---
    filtersForm.querySelector('.reset-filters-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        filtersForm.reset();
        searchInput.value = ''; // Також чистимо пошук

        actionButtons.forEach(btn => btn.classList.remove('active-action'));
        document.querySelector('.action-btn[data-type="all_listings"]')?.classList.add('active-action');

        updateFilterVisibility();

        fetchAndDisplayListings('listing_type!=find_home');

        console.log('Фільтри скинуто');
    });

    // --- 7. Логіка Пошукового рядка (Enter) ---
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Запобігаємо стандартній відправці форми
            triggerSearchAndFilter(); // Викликаємо центральну функцію
        }
    });

    // --- 8. Логіка Пошукової іконки (Click) ---
    searchIcon.addEventListener('click', () => {
        triggerSearchAndFilter(); // Викликаємо центральну функцію
    });
    // Додамо стиль, щоб іконка виглядала клікабельною
    searchIcon.style.cursor = 'pointer';


    // --- 9. Перший запуск для налаштування видимості ---
    updateFilterVisibility();
};


// --- Логіка register.html ---

const handleRegistration = async () => {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (data.password !== data.confirm_password) {
            alert('Помилка: Паролі не співпадають.');
            return;
        }

        const registrationData = {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            password: data.password
        };

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData),
            });

            if (response.status === 201) {
                const result = await response.json();
                alert(`Успіх! ${result.message}. Тепер ви можете увійти.`);
                form.reset();
                window.location.href = 'login.html';
            } else {
                const errorData = await response.json();
                alert(`Помилка реєстрації: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка мережі/сервера при реєстрації:', error);
            alert('Не вдалося з’єднатися з сервером. Перевірте консоль.');
        }
    });
};

// --- Логіка login.html ---

const handleLogin = async () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Якщо користувач вже увійшов (має дійсний токен), перекидаємо в профіль
    if (MY_USER_ID) {
        window.location.href = 'profile.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const result = await response.json();
                setToken(result.token); // Зберігаємо токен
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

// --- Логіка profile.html ---

const loadProfileData = async () => {
    // Перевірка MY_USER_ID вже є в роутері, але ми можемо перевірити ще раз
    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб переглянути свій профіль.');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/profile', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            // Це спрацює, якщо токен недійсний (наприклад, видалений на сервері)
            throw new Error('Не вдалося завантажити дані профілю. Спробуйте увійти знову.');
        }

        const user = await response.json();

        const setInputValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        setInputValue('profile_first_name', user.first_name);
        setInputValue('profile_last_name', user.last_name);
        setInputValue('profile_email', user.email);
        setInputValue('profile_city', user.city);
        setInputValue('profile_phone', user.phone_number); // ОНОВЛЕНО
        setInputValue('profile_bio', user.bio);
        // setInputValue('interests-select', user.interests); // 'interests' немає в схемі 'users'

        if (user.date_of_birth) {
            setInputValue('profile_date', user.date_of_birth.split('T')[0]);
        }

        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarName = document.getElementById('profileAvatarName');

        if (avatarImg) avatarImg.src = user.avatar_url || DEFAULT_AVATAR_URL;
        if (avatarName) avatarName.textContent = `${user.first_name || ''} ${user.last_name || ''}`;

    } catch (error) {
        console.error('Помилка завантаження профілю:', error);
        alert(error.message);
        removeToken(); // Видаляємо недійсний токен
        window.location.href = 'login.html';
    }
};

// --- ФОТО: Нова функція для завантаження аватара ---
const handleAvatarUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file); // 'avatar' - name інпута

    try {
        // Показуємо спіннер або змінюємо іконку
        const editIcon = document.querySelector('.edit-icon');
        if (editIcon) editIcon.textContent = '⏳'; // Замінюємо на годинник

        const response = await fetch('http://localhost:3000/api/upload/avatar', {
            method: 'POST',
            headers: getAuthHeaders(false), // НЕ надсилаємо Content-Type: application/json
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося завантажити аватар');
        }

        const result = await response.json();
        alert(result.message);

        // Оновлюємо зображення на сторінці
        const avatarImg = document.getElementById('profileAvatarImg');
        if (avatarImg) avatarImg.src = result.avatarUrl;
        // Оновлюємо аватар в хедері (викликаємо функцію, яка це робить)
        await setupNavLinks();

    } catch (error) {
        console.error('Помилка завантаження аватара:', error);
        alert(`Помилка: ${error.message}`);
    } finally {
        // Повертаємо іконку олівця
        const editIcon = document.querySelector('.edit-icon');
        if (editIcon) editIcon.textContent = '✎';
    }
};

// --- Логіка settings.html (НОВА) ---
const loadSettingsData = async () => {
    if (!MY_USER_ID) {
        window.location.href = 'login.html';
        return;
    }
    try {
        const response = await fetch('http://localhost:3000/api/profile', {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Не вдалося завантажити налаштування');
        const user = await response.json();

        const showPhoneCheckbox = document.getElementById('show_phone_publicly');
        if (showPhoneCheckbox) {
            showPhoneCheckbox.checked = !!user.show_phone_publicly;
        }
    } catch (error) {
        console.error('Помилка завантаження налаштувань:', error);
        alert(error.message);
    }
};

const handleSettingsSubmission = () => {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Отримуємо поточні дані профілю, щоб не перезаписати їх
        let profileData = {};
        try {
            const profileResponse = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
            if (!profileResponse.ok) throw new Error('Помилка отримання поточних даних профілю.');
            profileData = await profileResponse.json();
        } catch (error) {
            alert(error.message);
            return;
        }

        // Оновлюємо лише ті поля, які є у формі
        // !!data.show_phone_publicly перетворить 'true' на true, а undefined на false
        profileData.show_phone_publicly = !!data.show_phone_publicly;

        // Відправляємо повний об'єкт profileData
        try {
            const response = await fetch('http://localhost:3000/api/profile', {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Не вдалося оновити налаштування');
            }

            await response.json();
            alert('Налаштування успішно збережено!');

        } catch (error) {
            console.error('Помилка збереження налаштувань:', error);
            alert(`Помилка: ${error.message}`);
        }
    });
};

const setupProfileEventListeners = () => {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            const data = Object.fromEntries(formData.entries());

            // ОНОВЛЕНО: Видаляємо 'interests' та 'habits'
            delete data.interests;
            delete data.habits;

            try {
                const response = await fetch('http://localhost:3000/api/profile', {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Не вдалося оновити профіль');
                }

                const result = await response.json();
                alert(result.message);

                const avatarName = document.getElementById('profileAvatarName');
                if (avatarName) {
                    avatarName.textContent = `${result.user.first_name || ''} ${result.user.last_name || ''}`;
                }

            } catch (error) {
                console.error('Помилка оновлення профілю:', error);
                alert(`Помилка: ${error.message}`);
            }
        });
    }

    // Кнопка "Вийти" на сторінці профілю
    const logoutButton = document.getElementById('btnLogout');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            removeToken();
            alert('Ви вийшли з системи.');
            window.location.href = 'index.html';
        });
    }

    // --- ФОТО: Додаємо слухача для завантаження аватара ---
    const avatarInput = document.getElementById('avatar-upload');
    if (avatarInput) {
        avatarInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                handleAvatarUpload(file);
            }
        });
    }

    // Інші кнопки
    document.getElementById('btnMyListings')?.addEventListener('click', () => {
        window.location.href = 'my_listings.html';
    });
    document.getElementById('btnLoginPassword')?.addEventListener('click', () => {
        alert('Розділ "Зміна логіну та пароля" в розробці.');
    });
    document.getElementById('btnSettings')?.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });
};

// --- Логіка listing_detail.html ---

const fetchAndDisplayListingDetail = async () => {
    const container = document.getElementById('listingDetailContainer');
    if (!container) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('id');

        if (!listingId) {
            container.innerHTML = '<h1 style="text-align: center;">Помилка: ID оголошення не вказано.</h1>';
            return;
        }

        const response = await fetch(`http://localhost:3000/api/listings/${listingId}`);
        if (response.status === 404) {
            container.innerHTML = '<h1 style="text-align: center;">Помилка 404: Оголошення не знайдено.</h1>';
            return;
        }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const listing = await response.json();
        document.title = `UniHome | ${listing.title}`;

        // --- ФОТО: Логіка відображення фото з дефолтами ---
        let mainImage = listing.photos.find(p => p.is_main);
        let mainImageUrl = mainImage?.image_url
            || listing.main_photo_url // Про всяк випадок, якщо is_main не встиг оновитись
            || DEFAULT_LISTING_IMAGE[listing.listing_type]
            || DEFAULT_LISTING_IMAGE['default'];

        let photoGalleryHTML = '';
        if (listing.photos && listing.photos.length > 0) {
            // Показуємо головне першим, якщо воно є в масиві
            const sortedPhotos = mainImage
                ? [mainImage, ...listing.photos.filter(p => !p.is_main)]
                : listing.photos;

            photoGalleryHTML = sortedPhotos
                .map((photo, index) => `<img src="${photo.image_url}" alt="Фото ${index + 1}" class="gallery-thumbnail ${index === 0 ? 'active' : ''}">`) // Додаємо клас active першому
                .join('');
        } else {
            // Якщо фото немає зовсім, можна показати дефолтне головне
            photoGalleryHTML = `<img src="${mainImageUrl}" alt="${listing.title}" class="gallery-thumbnail inactive">`; // Додамо клас inactive
        }

        // === ПОЧАТОК НОВОЇ ЛОГІКИ ГРУПУВАННЯ ХАРАКТЕРИСТИК ===

        // 1. Словник для "красивих" назв категорій (з schema.sql)
        const categoryNames = {
            'tech': 'Побутова техніка',
            'media': 'Мультимедіа',
            'comfort': 'Комфорт',
            'pets_allowed': 'Домашні улюбленці (Дозволено)',
            'blackout': 'Автономність при блекауті',
            'rules': 'Правила',
            'communications': 'Комунікації',
            'infra': 'Інфраструктура (до 500 метрів)',
            'inclusive': 'Інклюзивність',
            'my_personality': 'Особистість',
            'my_lifestyle': 'Спосіб життя',
            'my_interests': 'Інтереси',
            'my_pets': 'Мої тварини',
            'mate_personality': 'Бажана особистість',
            'mate_lifestyle': 'Бажаний спосіб життя',
            'mate_interests': 'Бажані інтереси',
            'mate_pets': 'Тварини у сусіда'
        };

        // 2. Групуємо всі характеристики, які прийшли з бекенду
        const characteristicsByCategory = {};
        if (listing.characteristics) {
            listing.characteristics.forEach(char => {
                const category = char.category;
                if (!characteristicsByCategory[category]) {
                    characteristicsByCategory[category] = [];
                }
                // Додаємо HTML-тег
                characteristicsByCategory[category].push(`<span class="char-tag">${char.name_ukr}</span>`);
            });
        }

        // 3. Допоміжна функція для побудови HTML-секції
        const buildCharSection = (categoriesToShow) => {
            let html = '';
            for (const category of categoriesToShow) {
                if (characteristicsByCategory[category]) {
                    html += `
                        <div class="char-category-group">
                            <h3>${categoryNames[category] || category}</h3>
                            <div class="characteristics-list">
                                ${characteristicsByCategory[category].join('')}
                            </div>
                        </div>
                    `;
                }
            }
            return html;
        };

        // 4. Генеруємо HTML-блоки для кожної секції
        let aboutAuthorHTML = '';
        let roommatePrefsHTML = '';
        let housingCharsHTML = '';

        // -- "Про автора" та "Вимоги до сусіда" (ТІЛЬКИ для find_home та find_mate)
        if (listing.listing_type === 'find_home' || listing.listing_type === 'find_mate') {
            const myCategories = ['my_personality', 'my_lifestyle', 'my_interests', 'my_pets'];
            const myCharsHTML = buildCharSection(myCategories);

            if (listing.my_age || listing.my_gender || myCharsHTML) {
                aboutAuthorHTML = `
                    <div class="detail-section">
                        <h2>Про автора</h2>
                        <div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">
                            ${listing.my_age ? `<span class="char-tag">Вік: ${listing.my_age}</span>` : ''}
                            ${listing.my_gender === 'female' ? `<span class="char-tag">Стать: Жіноча</span>` : ''}
                            ${listing.my_gender === 'male' ? `<span class="char-tag">Стать: Чоловіча</span>` : ''}
                            ${listing.my_smoking ? `<span class="char-tag">Паління: ${listing.my_smoking}</span>` : ''}
                            ${listing.my_drinking ? `<span class="char-tag">Алкоголь: ${listing.my_drinking}</span>` : ''}
                        </div>
                        ${myCharsHTML}
                    </div>
                `;
            }

            const mateCategories = ['mate_personality', 'mate_lifestyle', 'mate_interests', 'mate_pets'];
            const mateCharsHTML = buildCharSection(mateCategories);

            if (listing.roommate_gender || listing.roommate_age_min || mateCharsHTML) {
                roommatePrefsHTML = `
                    <div class="detail-section">
                        <h2>Вимоги до сусіда</h2>
                        <div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">
                            ${listing.roommate_gender && listing.roommate_gender !== 'any' ? `<span class="char-tag">Стать: ${listing.roommate_gender}</span>` : ''}
                            ${listing.roommate_age_min && listing.roommate_age_max ? `<span class="char-tag">Вік: ${listing.roommate_age_min} - ${listing.roommate_age_max}</span>` : ''}
                            ${listing.roommate_smoking && listing.roommate_smoking !== 'any' ? `<span class="char-tag">Паління (сусід): ${listing.roommate_smoking}</span>` : ''}
                        </div>
                        ${mateCharsHTML}
                    </div>
                `;
            }
        }

        // -- "Характеристики житла" (для всіх типів, але з різними заголовками)
        const apartmentCategories = [
            'tech', 'media', 'comfort', 'pets_allowed', 'blackout',
            'rules', 'communications', 'infra', 'inclusive'
        ];
        const apartmentCharsHTML = buildCharSection(apartmentCategories);

        if (listing.listing_type === 'find_home') {
            // "find_home" шукає житло, тому це "Бажані"
            housingCharsHTML = `
                <div class="detail-section">
                    <h2>Бажані характеристики житла</h2>
                    ${apartmentCharsHTML || '<p>Автор не вказав бажаних характеристик.</p>'}
                </div>
            `;
        } else if (listing.listing_type === 'rent_out' || listing.listing_type === 'find_mate') {
            // "rent_out" та "find_mate" описують житло, яке ВЖЕ Є
            housingCharsHTML = `
                <div class="detail-section">
                    <h2>Характеристики житла</h2>
                    ${apartmentCharsHTML || '<p>Характеристики не вказані.</p>'}
                </div>
            `;
        }

        // === КІНЕЦЬ НОВОЇ ЛОГІКИ ГРУПУВАННЯ ===

        // === ОНОВЛЕНО: HTML для аватара автора ===
        const authorAvatarHTML = `
             <a href="user_profile.html?id=${listing.user_id}" class="author-name-link">
                 <div class="author-avatar">
                     <img src="${listing.avatar_url || DEFAULT_AVATAR_URL}" alt="Аватар автора">
                 </div>
            </a>
        `;

        const contactButtonHTML = (MY_USER_ID === listing.user_id)
            ? `<a href="profile.html" class="contact-btn" style="background: #7f8c8d;">
                 <i class="fas fa-user-edit"></i> Це ваше оголошення
               </a>`
            : `<a href="chat.html?user_id=${listing.user_id}" class="contact-btn">
                 <i class="fas fa-comment-dots"></i> Зв'язатись з автором
               </a>`;

        // Збираємо фінальний HTML з умовними блоками
        const detailHTML = `
            <div class="listing-detail-layout">
                <div class="listing-detail-gallery">
                    <div class="main-image-container">
                        <img src="${mainImageUrl}" alt="${listing.title}" id="mainDetailImage">
                    </div>
                    <div class="thumbnail-gallery">${photoGalleryHTML}</div>
                </div>

                <div class="listing-detail-info">
                    <h1>${listing.title}</h1>
                    <span class="detail-price">₴${listing.price || 0} / міс</span>
                    
                    <div class="detail-meta">
                        <p><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто не вказано'}</p>
                        ${listing.target_university ? `<p><i class="fas fa-university"></i> ${listing.target_university}</p>` : ''}
                        ${listing.rooms ? `<p><i class="fas fa-door-open"></i> Кімнат: ${listing.rooms}</p>` : ''}
                        ${listing.total_area ? `<p><i class="fas fa-ruler-combined"></i> ${listing.total_area} м² (Загальна)</p>` : ''}
                        ${listing.kitchen_area ? `<p><i class="fas fa-utensils"></i> ${listing.kitchen_area} м² (Кухня)</p>` : ''}
                        ${listing.floor && listing.total_floors ? `<p><i class="fas fa-building"></i> ${listing.floor} / ${listing.total_floors} поверх</p>` : ''}
                    </div>

                    <div class="detail-section">
                        <h2>Опис</h2>
                        <p>${listing.description ? listing.description.replace(/\\n/g, '<br>') : 'Опис відсутній.'}</p>
                    </div>

                    ${aboutAuthorHTML}
                    ${roommatePrefsHTML}
                    ${housingCharsHTML}
                    </div>

                <aside class="listing-detail-author">
                    <h3>Автор оголошення</h3>
                    <div class="author-card">
                        ${authorAvatarHTML}
                        <a href="user_profile.html?id=${listing.user_id}" class="author-name-link">
                            <p class="author-name">${listing.first_name} ${listing.last_name}</p>
                        </a>
                        ${contactButtonHTML}
                    </div>
                </aside>
            </div>
        `;
        container.innerHTML = detailHTML;

        // === ОНОВЛЕНО: Додаємо слухачі для мініатюр після рендеру ===
        const thumbnails = container.querySelectorAll('.gallery-thumbnail:not(.inactive)');
        const mainImageElement = container.querySelector('#mainDetailImage');

        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', () => {
                // Міняємо головне зображення
                if (mainImageElement) {
                    mainImageElement.src = thumb.src;
                }
                // Оновлюємо активний клас
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });


    } catch (error) {
        console.error('Помилка завантаження деталей оголошення:', error);
        container.innerHTML = '<h1 style="text-align: center;">Помилка завантаження</h1><p style="text-align: center;">Не вдалося отримати деталі. Перевірте консоль та чи запущено бекенд.</p>';
    }
};

// --- Логіка add_listing.html ---

/**
 * Динамічно керує видимістю полів ТА атрибутами 'required'
 */
const setupAddListingFormLogic = () => {
    const form = document.getElementById('addListingForm');
    if (!form) return;

    // Секції
    const roommatePrefs = document.getElementById('roommatePreferences');
    const housingFilters = document.getElementById('housingFilters');
    const listingDetails = document.getElementById('listingDetails');
    const aboutMe = document.getElementById('aboutMe');
    const priceGroup = document.getElementById('priceGroup');
    const photoGroup = document.getElementById('photoGroup');
    const maxOccupantsGroup = document.getElementById('maxOccupantsGroup');
    const findMateGroups = document.getElementById('findMateGroups');
    const myGroupSizeGroup = document.getElementById('myGroupSizeGroup');
    const myGroupCount = document.getElementById('my_group_count');
    const targetRoommatesTotalGroup = document.getElementById('targetRoommatesTotalGroup');
    const studentParams = document.getElementById('studentParams');

    // Поля, що валідуються
    const priceInput = document.getElementById('price'); // ОНОВЛЕНО
    const targetPriceMaxInput = document.getElementById('target_price_max');
    const myGenderRadios = document.querySelectorAll('input[name="my_gender"]');
    const myAgeInput = document.getElementById('my_age');
    const maxOccupantsSelect = document.getElementById('max_occupants');
    const currentOccupantsSelect = document.getElementById('current_occupants');
    const seekingRoommatesSelect = document.getElementById('seeking_roommates');
    const roomsSelect = document.getElementById('rooms');
    const floorInput = document.getElementById('floor');
    const totalFloorsInput = document.getElementById('total_floors');
    const totalAreaInput = document.getElementById('total_area');
    const kitchenAreaInput = document.getElementById('kitchen_area');
    const furnishingRadios = document.querySelectorAll('input[name="furnishing"]');

    // Слухачі
    const listingTypeRadios = document.querySelectorAll('input[name="listing_type"]');
    const readyToShareRadios = document.querySelectorAll('input[name="ready_to_share"]');
    const isStudentRadios = document.querySelectorAll('input[name="is_student"]');
    const myGroupSizeRadios = document.querySelectorAll('input[name="my_group_size"]');

    function updateVisibility() {
        const selectedType = document.querySelector('input[name="listing_type"]:checked')?.value;
        const isSharing = document.querySelector('input[name="ready_to_share"]:checked')?.value;

        // 1. Скидаємо видимість
        roommatePrefs.style.display = 'none';
        housingFilters.style.display = 'none';
        listingDetails.style.display = 'none';
        aboutMe.style.display = 'none';
        photoGroup.style.display = 'none';
        priceGroup.style.display = 'none';
        maxOccupantsGroup.style.display = 'none';
        findMateGroups.style.display = 'none';
        myGroupSizeGroup.style.display = 'none';
        targetRoommatesTotalGroup.style.display = 'none';

        // 2. Скидаємо 'required' АБСОЛЮТНО ДЛЯ ВСІХ
        priceInput.required = false; // ОНОВЛЕНО
        targetPriceMaxInput.required = false;
        myAgeInput.required = false;
        myGenderRadios.forEach(radio => radio.required = false);
        maxOccupantsSelect.required = false;
        currentOccupantsSelect.required = false;
        seekingRoommatesSelect.required = false;
        roomsSelect.required = false;
        floorInput.required = false;
        totalFloorsInput.required = false;
        totalAreaInput.required = false;
        kitchenAreaInput.required = false;
        furnishingRadios.forEach(radio => radio.required = false);

        // 3. Налаштовуємо видимість і 'required' на основі типу
        if (selectedType === 'find_home') {
            housingFilters.style.display = 'block';
            aboutMe.style.display = 'block';
            myGroupSizeGroup.style.display = 'block';
            targetRoommatesTotalGroup.style.display = 'block';

            // Встановлюємо required
            targetPriceMaxInput.required = true;
            myAgeInput.required = true;
            myGenderRadios.forEach(radio => radio.required = true);

            if (isSharing !== 'no') {
                roommatePrefs.style.display = 'block';
            }

        } else if (selectedType === 'rent_out') {
            listingDetails.style.display = 'block';
            photoGroup.style.display = 'block';
            priceGroup.style.display = 'block';
            maxOccupantsGroup.style.display = 'block';

            // Встановлюємо required
            priceInput.required = true; // ОНОВЛЕНО
            maxOccupantsSelect.required = true;
            roomsSelect.required = true;
            floorInput.required = true;
            totalFloorsInput.required = true;
            totalAreaInput.required = true;
            kitchenAreaInput.required = true;
            furnishingRadios.forEach(radio => radio.required = true);

        } else if (selectedType === 'find_mate') {
            listingDetails.style.display = 'block';
            roommatePrefs.style.display = 'block';
            aboutMe.style.display = 'block';
            photoGroup.style.display = 'block';
            priceGroup.style.display = 'block';
            findMateGroups.style.display = 'block';

            // Встановлюємо required
            priceInput.required = true; // ОНОВЛЕНО
            myAgeInput.required = true;
            myGenderRadios.forEach(radio => radio.required = true);
            currentOccupantsSelect.required = true;
            seekingRoommatesSelect.required = true;
            roomsSelect.required = true;
            floorInput.required = true;
            totalFloorsInput.required = true;
            totalAreaInput.required = true;
            kitchenAreaInput.required = true;
            furnishingRadios.forEach(radio => radio.required = true);
        }

        const isStudent = document.querySelector('input[name="is_student"]:checked')?.value;
        studentParams.style.display = (isStudent === 'yes' && selectedType === 'find_home') ? 'block' : 'none';
    }

    // --- ЛОГІКА ПОДІЙ ---
    listingTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('listingTypeHint').style.display = 'none';
            updateVisibility();
        });
    });

    readyToShareRadios.forEach(radio => radio.addEventListener('change', updateVisibility));
    isStudentRadios.forEach(radio => radio.addEventListener('change', updateVisibility));

    form.addEventListener('submit', function(event) {
        const selectedType = document.querySelector('input[name="listing_type"]:checked');
        if (!selectedType) {
            event.preventDefault();
            const listingTypeHint = document.getElementById('listingTypeHint');
            listingTypeHint.style.display = 'block';
            listingTypeHint.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    myGroupSizeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById('my_group_count').style.display = (this.value === 'more') ? 'block' : 'none';
        });
    });

    updateVisibility();
};


const handleListingSubmission = async () => {
    const form = document.getElementById('addListingForm');
    const photoInput = document.getElementById('listingPhotosInput');
    const previewContainer = document.getElementById('photoPreviewContainer');
    const submitButton = form.querySelector('.submit-listing-btn');
    if (!form || !photoInput || !previewContainer || !submitButton) return;

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб додати оголошення.');
        window.location.href = 'login.html';
        return;
    }

    let selectedFiles = []; // Масив для зберігання вибраних файлів (File об'єктів)
    let listingId; // Зберігатимемо ID для завантаження фото
    const MAX_PHOTOS = 8;

    // --- Функція для оновлення відображення прев'ю та кнопок ---
    const updatePhotoDisplay = () => {
        const placeholders = previewContainer.querySelectorAll('.photo-upload-placeholder');

        placeholders.forEach((div, index) => {
            // Очищуємо попередній вміст та стилі
            div.innerHTML = '';
            div.style.backgroundImage = '';
            div.className = 'photo-upload-placeholder'; // Скидаємо класи
            div.onclick = null; // Скидаємо обробник кліка
            div.title = '';

            if (index < selectedFiles.length) {
                // Якщо є файл для цього слота - показуємо прев'ю
                const file = selectedFiles[index];
                const reader = new FileReader();

                reader.onload = (e) => {
                    div.classList.add('preview');
                    div.style.backgroundImage = `url('${e.target.result}')`;
                    div.style.backgroundSize = 'cover';
                    div.style.backgroundPosition = 'center';
                    div.style.borderStyle = 'solid';

                    // Додаємо кнопку видалення
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'photo-delete-btn';
                    deleteBtn.innerHTML = '&times;'; // Символ "хрестик"
                    deleteBtn.title = 'Видалити фото';
                    deleteBtn.type = 'button'; // Важливо, щоб не відправляти форму
                    deleteBtn.onclick = (event) => {
                        event.stopPropagation(); // Зупиняємо спливання, щоб не спрацював клік на div
                        removeFile(index);
                    };
                    div.appendChild(deleteBtn);

                    // Позначаємо головне фото
                    if (index === 0) {
                        const mainLabel = document.createElement('span');
                        mainLabel.className = 'photo-main-label';
                        mainLabel.textContent = 'Головне';
                        div.appendChild(mainLabel);
                        div.title = 'Головне фото';
                    }
                }
                reader.readAsDataURL(file);

            } else if (index === selectedFiles.length && selectedFiles.length < MAX_PHOTOS) {
                // Наступний порожній слот стає кнопкою "Додати"
                div.classList.add('add-photo-btn');
                div.innerHTML = '+ Додати фото';
                div.onclick = triggerFileInput; // Клік відкриває вибір файлу
                div.style.borderStyle = 'dashed';
            } else {
                // Решта слотів - просто порожні (візуально)
                div.style.borderStyle = 'dashed';
                // Можна додати ::before { content: '+' } через CSS для візуального плюсика
            }
        });
    };

    // --- Функція для видалення файлу зі списку та оновлення відображення ---
    const removeFile = (indexToRemove) => {
        selectedFiles.splice(indexToRemove, 1); // Видаляємо файл з масиву
        // Важливо скинути значення input, інакше не можна буде вибрати той самий файл знову
        photoInput.value = null;
        updatePhotoDisplay(); // Оновлюємо відображення
    };

    // --- Функція, яка викликається при кліку на кнопку "Додати фото" ---
    window.triggerFileInput = () => { // Робимо функцію глобальною, щоб HTML її бачив
        photoInput.click();
    };

    // --- Слухач змін в input type="file" ---
    photoInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (!files) return;

        const currentCount = selectedFiles.length;
        const availableSlots = MAX_PHOTOS - currentCount;
        const filesToAddCount = Math.min(files.length, availableSlots);

        if (files.length > availableSlots && availableSlots > 0) {
            alert(`Ви можете додати ще ${availableSlots} фото.`);
        } else if (availableSlots <= 0) {
            alert(`Ви вже додали максимальну кількість фото (${MAX_PHOTOS}).`);
            photoInput.value = null; // Скидаємо вибір
            return;
        }

        // Додаємо тільки дозволену кількість нових файлів
        for (let i = 0; i < filesToAddCount; i++) {
            selectedFiles.push(files[i]);
        }

        // Важливо скинути значення input після обробки,
        // щоб подія 'change' спрацювала, якщо користувач вибере ті самі файли знову
        photoInput.value = null;

        updatePhotoDisplay(); // Оновлюємо відображення
    });

    // === ВИПРАВЛЕНО 2: Повністю перебудована логіка відправки ===
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Перевіряємо, чи є хоча б одне фото для типів, де воно потрібне
        const selectedType = form.querySelector('input[name="listing_type"]:checked')?.value;
        const requiresPhoto = selectedType === 'rent_out' || selectedType === 'find_mate';
        if (requiresPhoto && selectedFiles.length === 0) {
            alert('Будь ласка, додайте хоча б одну фотографію для цього типу оголошення.');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        delete data.photos; // Видаляємо поле з текстових даних

        // ОНОВЛЕНО: Збираємо характеристики з обох секцій
        const characteristics = formData.getAll('characteristics');
        const searchCharacteristics = formData.getAll('search_characteristics');

        // Видаляємо "заглушки" і об'єднуємо
        const allCharacteristics = [...characteristics, ...searchCharacteristics].filter(key => {
            // 'my_pet_no' та 'mate_no_pet' - це не характеристики, а їх відсутність
            return key && key !== 'my_pet_no' && key !== 'mate_no_pet';
        });

        data.characteristics = [...new Set(allCharacteristics)]; // Зберігаємо тільки унікальні
        delete data.search_characteristics; // Видаляємо старе поле

        submitButton.disabled = true;
        submitButton.textContent = 'Публікація...';

        try {
            // 1. Створюємо оголошення (текстові дані)
            const listingResponse = await fetch('http://localhost:3000/api/listings', {
                method: 'POST',
                headers: getAuthHeaders(), // Використовуємо getAuthHeaders() (isJson = true)
                body: JSON.stringify(data),
            });

            if (listingResponse.ok) {
                const listingResult = await listingResponse.json(); // Отримуємо результат (з listingId)
                listingId = listingResult.listingId; // Зберігаємо ID
                console.log(`Оголошення створено, ID: ${listingId}`);

                // 2. Завантажуємо фото (ЯКЩО вони є і ID отримано)
                if (selectedFiles.length > 0 && listingId) {
                    console.log(`Завантаження ${selectedFiles.length} фото для оголошення ${listingId}...`);
                    const photoFormData = new FormData();
                    selectedFiles.forEach(file => {
                        photoFormData.append('photos', file);
                    });

                    // Надсилаємо фото на окремий ендпоінт
                    const photoResponse = await fetch(`http://localhost:3000/api/upload/listing-photos/${listingId}`, {
                        method: 'POST',
                        headers: getAuthHeaders(false), // (isJson = false)
                        body: photoFormData,
                    });

                    if (!photoResponse.ok) {
                        const errorData = await photoResponse.json();
                        // Помилка фото, але оголошення вже створено.
                        alert(`Оголошення створено, але сталася помилка при завантаженні фото: ${errorData.error || 'Невідома помилка'}.`);
                        console.error('Помилка завантаження фото:', errorData);
                    } else {
                        const photoResult = await photoResponse.json();
                        console.log(photoResult.message);
                    }
                }

                // 3. Успішне завершення (після фото)
                alert(`Успіх! ${listingResult.message} (ID: ${listingId})`);
                form.reset();
                selectedFiles = []; // Очищуємо масив файлів
                updatePhotoDisplay(); // Оновлюємо відображення (показуємо пусті слоти)
                window.location.href = 'index.html'; // <-- ПЕРЕМІЩЕНО В КІНЕЦЬ

            } else if (listingResponse.status === 401 || listingResponse.status === 403) {
                alert('Помилка автентифікації. Будь ласка, увійдіть знову.');
                window.location.href = 'login.html';
            } else {
                const errorData = await listingResponse.json();
                alert(`Помилка публікації: ${errorData.error || 'Невідома помилка'}`);
            }

        } catch (error) {
            console.error('Помилка мережі/сервера:', error);
            alert('Не вдалося з’єднатися з сервером. Перевірте, чи запущено бекенд (http://localhost:3000).');
        }
        finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Опублікувати оголошення';
        }
    });

    // Ініціалізуємо відображення фото при завантаженні сторінки
    updatePhotoDisplay();
};

// --- Логіка my_listings.html ---

const fetchAndDisplayMyListings = async () => {
    const container = document.getElementById('myListingsContainer');
    if (!container) return;

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб переглянути свої оголошення.');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/my-listings', {
            headers: getAuthHeaders()
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Необхідна автентифікація.');
        }
        if (!response.ok) {
            throw new Error(`HTTP помилка! статус: ${response.status}`);
        }

        const listings = await response.json();
        container.innerHTML = ''; // Очищуємо індикатор завантаження

        if (listings.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">У вас ще немає створених оголошень.</p>';
            return;
        }

        listings.forEach(listing => {
            const imageUrl = listing.main_photo_url || 'https://picsum.photos/400/300?random=' + listing.listing_id;

            // Визначення типу оголошення для тегу
            let typeTag = '';
            if(listing.listing_type === 'rent_out') {
                typeTag = '<span class="type-tag rent">Здають</span>';
            } else if (listing.listing_type === 'find_mate') {
                typeTag = '<span class="type-tag mate">Шукають сусіда</span>';
            } else if (listing.listing_type === 'find_home') {
                typeTag = '<span class="type-tag home">Шукають житло</span>';
            }

            const listingCard = document.createElement('div');
            listingCard.className = `my-listing-card ${!listing.is_active ? 'inactive' : ''}`;
            listingCard.dataset.listingId = listing.listing_id; // Зберігаємо ID

            listingCard.innerHTML = `
                <a href="listing_detail.html?id=${listing.listing_id}" class="my-listing-link">
                    <img src="${imageUrl}" alt="${listing.title}" class="my-listing-image">
                    <div class="my-listing-info">
                         <h3>${listing.title}</h3>
                         <p><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто'}</p>
                         <p class="my-listing-status">
                             Статус: ${listing.is_active ? '🟢 Активне' : '🔴 Неактивне'}
                         </p>
                         ${typeTag}
                    </div>
                </a>
                <div class="my-listing-actions">
                    <button class="action-btn edit" title="Редагувати (в розробці)"><i class="fas fa-pencil-alt"></i></button>
                    <button class="action-btn toggle-status" title="${listing.is_active ? 'Зробити неактивним' : 'Активувати'}">
                        ${listing.is_active ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'}
                    </button>
                    <button class="action-btn delete" title="Видалити"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;

            // Додаємо обробники подій для кнопок
            listingCard.querySelector('.toggle-status').addEventListener('click', () => {
                handleToggleListingStatus(listing.listing_id, !listing.is_active); // Передаємо НОВИЙ бажаний статус
            });
            listingCard.querySelector('.delete').addEventListener('click', () => {
                handleDeleteListing(listing.listing_id);
            });
            listingCard.querySelector('.edit').addEventListener('click', () => {
                alert('Функція редагування оголошення знаходиться в розробці.');
            });

            container.appendChild(listingCard);
        });

    } catch (error) {
        console.error('Помилка завантаження моїх оголошень:', error);
        container.innerHTML = `<p style="color: red; padding: 10px;">Помилка завантаження. ${error.message}</p>`;
        if (error.message === 'Необхідна автентифікація.') {
            window.location.href = 'login.html';
        }
    }
};

// Функція для зміни статусу оголошення
const handleToggleListingStatus = async (listingId, newStatus) => {
    if (!confirm(`Ви впевнені, що хочете ${newStatus ? 'активувати' : 'деактивувати'} це оголошення?`)) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/listings/${listingId}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ is_active: newStatus }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося змінити статус');
        }

        const result = await response.json();
        alert(result.message);

        // Оновлюємо вигляд картки без перезавантаження сторінки
        const card = document.querySelector(`.my-listing-card[data-listing-id="${listingId}"]`);
        if (card) {
            const statusText = card.querySelector('.my-listing-status');
            const toggleButton = card.querySelector('.toggle-status');
            if (newStatus) {
                card.classList.remove('inactive');
                statusText.innerHTML = 'Статус: 🟢 Активне';
                toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>';
                toggleButton.title = 'Зробити неактивним';
            } else {
                card.classList.add('inactive');
                statusText.innerHTML = 'Статус: 🔴 Неактивне';
                toggleButton.innerHTML = '<i class="fas fa-eye"></i>';
                toggleButton.title = 'Активувати';
            }
        }

    } catch (error) {
        console.error('Помилка зміни статусу:', error);
        alert(`Помилка: ${error.message}`);
    }
};

// Функція для видалення оголошення
const handleDeleteListing = async (listingId) => {
    if (!confirm('Ви впевнені, що хочете ВИДАЛИТИ це оголошення? Цю дію неможливо скасувати.')) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/listings/${listingId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося видалити оголошення');
        }

        const result = await response.json();
        alert(result.message);

        // Видаляємо картку зі сторінки
        const card = document.querySelector(`.my-listing-card[data-listing-id="${listingId}"]`);
        if (card) {
            card.remove();
        }
        // Перевіряємо, чи залишились ще оголошення
        const container = document.getElementById('myListingsContainer');
        if (container && container.children.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">У вас більше немає створених оголошень.</p>';
        }


    } catch (error) {
        console.error('Помилка видалення:', error);
        alert(`Помилка: ${error.message}`);
    }
};

// --- Логіка chat.html ---

let currentOpenConversationId = null;
let currentOpenReceiverId = null;

const loadConversations = async () => {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    try {
        const response = await fetch('http://localhost:3000/api/my-conversations', {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) throw new Error('Необхідна автентифікація для доступу до чату.');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const conversations = await response.json();
        container.innerHTML = '';

        if (conversations.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-light);">У вас ще немає розмов.</p>';
            return;
        }

        conversations.forEach(convo => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.dataset.conversationId = convo.conversation_id;
            item.dataset.receiverId = convo.other_user_id;
            item.dataset.receiverName = `${convo.first_name} ${convo.last_name}`;
            item.innerHTML = `
                <span class="avatar-placeholder"><i class="fas fa-user-circle"></i></span>
                <span>${convo.first_name} ${convo.last_name}</span>
            `;
            item.addEventListener('click', () => {
                loadMessages(convo.conversation_id, convo.other_user_id, `${convo.first_name} ${convo.last_name}`);
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

const loadMessages = async (conversationId, receiverId, receiverName) => {
    const messagesArea = document.getElementById('messagesArea');
    const chatHeader = document.getElementById('chatHeader');
    const messageForm = document.getElementById('messageForm');
    if (!messagesArea || !chatHeader || !messageForm) return;

    currentOpenConversationId = conversationId.toString();
    currentOpenReceiverId = receiverId;

    chatHeader.textContent = receiverName;
    messageForm.style.display = 'flex';
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Завантаження...</p>';

    try {
        const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}/messages`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) throw new Error('Помилка доступу до чату');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const messages = await response.json();
        messagesArea.innerHTML = '';

        if (messages.length === 0) {
            messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Повідомлень ще немає.</p>';
        } else {
            messages.forEach(msg => appendMessage(msg));
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

    } catch (error) {
        console.error('Помилка завантаження повідомлень:', error);
        messagesArea.innerHTML = `<p style="color: red; margin: auto;">Помилка завантаження. ${error.message}</p>`;
    }
};

const appendMessage = (msg) => {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;

    // Видаляємо заглушку "Повідомлень ще немає"
    const placeholder = messagesArea.querySelector('p');
    if (placeholder) placeholder.remove();

    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.classList.add(msg.sender_id === MY_USER_ID ? 'sent' : 'received');
    messageEl.textContent = msg.message_body;
    messagesArea.appendChild(messageEl);
};

const handleMessageSend = () => {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    if (!messageForm || !messageInput) return;

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageBody = messageInput.value.trim();

        if (messageBody === '' || !currentOpenReceiverId) return;

        try {
            // Оптимістична відправка (поки не чекаємо відповіді socket.io)
            const response = await fetch('http://localhost:3000/api/messages', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    receiver_id: currentOpenReceiverId,
                    message_body: messageBody
                })
            });

            if (response.ok) {
                messageInput.value = ''; // Очищуємо поле вводу
                const messagesArea = document.getElementById('messagesArea');
                if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
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

// --- Логіка Socket.IO (для chat.html) ---

const setupSocketIO = () => {
    if (typeof io === 'undefined') {
        console.error('Socket.io клієнт не завантажено! Додайте скрипт у chat.html');
        return;
    }

    const socket = io("http://localhost:3000");

    socket.on('connect', () => {
        console.log(`Socket.io підключено: ${socket.id}`);

        // Приєднатись до кімнат (розмов)
        const list = document.getElementById('conversationsList');
        if (list) {
            // Використовуємо MutationObserver, щоб дочекатись завантаження розмов
            const observer = new MutationObserver(() => {
                const conversationItems = document.querySelectorAll('.conversation-item');
                if (conversationItems.length > 0) {
                    console.log('Приєднуємось до кімнат socket.io...');
                    conversationItems.forEach(item => {
                        const convoId = item.dataset.conversationId;
                        if (convoId) {
                            socket.emit('join_conversation', convoId);
                        }
                    });
                    observer.disconnect(); // Зупиняємо спостереження
                }
            });
            observer.observe(list, { childList: true, subtree: true });
        }
    });

    socket.on('receive_message', (newMessage) => {
        console.log('Отримано нове повідомлення:', newMessage);

        if (newMessage.conversation_id.toString() === currentOpenConversationId) {
            // Якщо чат відкритий, додаємо повідомлення
            appendMessage(newMessage);
            const messagesArea = document.getElementById('messagesArea');
            if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
        } else {
            // Якщо чат закритий, показуємо сповіщення
            console.log("Нове повідомлення в іншому чаті!");
            currentNotificationCount++;
            updateNotificationCount(currentNotificationCount);
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket.io відключено');
    });
};

// --- Логіка user_profile.html (НОВА ФУНКЦІЯ) ---

const loadPublicProfileData = async () => {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const profileContainer = document.getElementById('profileContainer'); // Головний контейнер сторінки
    if (!loadingIndicator || !profileContainer) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('id');

        if (!userId) {
            loadingIndicator.innerHTML = '<h1>Помилка: ID користувача не вказано.</h1>';
            return;
        }

        // Якщо користувач дивиться свій власний профіль, перенаправляємо
        if (MY_USER_ID && MY_USER_ID.toString() === userId) {
            window.location.href = 'profile.html';
            return;
        }

        // Запускаємо обидва запити одночасно
        const profilePromise = fetch(`http://localhost:3000/api/users/${userId}/public-profile`);
        const listingsPromise = fetch(`http://localhost:3000/api/users/${userId}/listings`);

        const [profileResponse, listingsResponse] = await Promise.all([profilePromise, listingsPromise]);

        // 1. Обробка профілю
        if (!profileResponse.ok) {
            throw new Error('Не вдалося завантажити профіль. Можливо, користувача не існує.');
        }
        const user = await profileResponse.json();

        // 2. Обробка оголошень
        if (!listingsResponse.ok) {
            throw new Error('Не вдалося завантажити оголошення користувача.');
        }
        const listings = await listingsResponse.json();

        // --- Заповнення даними ---

        // Встановлення заголовку сторінки
        document.title = `UniHome | Профіль ${user.first_name}`;

        // Сайдбар
        document.getElementById('profileAvatarImg').src = user.avatar_url || DEFAULT_AVATAR_URL;
        document.getElementById('profileAvatarName').textContent = `${user.first_name} ${user.last_name}`;

        // Кнопка "Зв'язатись"
        const contactBtn = document.getElementById('btnContactUser');
        if (MY_USER_ID) {
            contactBtn.href = `chat.html?user_id=${user.user_id}`;
        } else {
            // Якщо поточний користувач не залогінений, відправляємо на сторінку логіну
            contactBtn.href = 'login.html';
            contactBtn.onclick = (e) => {
                e.preventDefault();
                alert('Будь ласка, увійдіть, щоб зв\'язатися з користувачем.');
                window.location.href = 'login.html';
            };
        }

        // Показ телефону
        const phoneContainer = document.getElementById('publicPhoneContainer');
        if (user.phone_number) { // `phone_number` буде null, якщо показ приховано
            const phoneLink = document.getElementById('publicPhoneLink');
            phoneLink.href = `tel:${user.phone_number}`;
            phoneLink.textContent = user.phone_number;
            phoneContainer.style.display = 'flex';
        }

        // Основна інформація
        document.getElementById('profileCity').textContent = user.city || 'Не вказано';

        // Розрахунок віку
        const ageSpan = document.getElementById('profileAge');
        if (user.date_of_birth) {
            const birthDate = new Date(user.date_of_birth);
            const age = new Date(Date.now() - birthDate.getTime()).getUTCFullYear() - 1970;
            ageSpan.textContent = `${age} років`;
        } else {
            ageSpan.textContent = 'Не вказано';
        }

        document.getElementById('profileBio').textContent = user.bio || 'Користувач ще не додав біографію.';

        // Оголошення
        document.getElementById('listingsCount').textContent = listings.length;
        const listingsContainer = document.getElementById('userListingsContainer');
        listingsContainer.innerHTML = ''; // Очищуємо

        if (listings.length === 0) {
            listingsContainer.innerHTML = '<p style="color: var(--text-light); padding: 10px;">Користувач не має активних оголошень.</p>';
        } else {
            // Використовуємо той самий шаблон картки, що й на index.html
            listings.forEach(listing => {
                const imageUrl = listing.main_photo_url || DEFAULT_LISTING_IMAGE[listing.listing_type] || DEFAULT_LISTING_IMAGE['default'];

                let typeTag = '';
                if (listing.listing_type === 'rent_out') typeTag = '<span class="type-tag rent">Здають</span>';
                else if (listing.listing_type === 'find_mate') typeTag = '<span class="type-tag mate">Шукають сусіда</span>';
                else if (listing.listing_type === 'find_home') typeTag = '<span class="type-tag home">Шукають житло</span>';

                listingsContainer.innerHTML += `
                    <a href="listing_detail.html?id=${listing.listing_id}" class="listing-card-link">
                        <div class="listing-card">
                            <img src="${imageUrl}" alt="${listing.title}" class="listing-image">
                            <div class="info-overlay">
                                <span class="price-tag">₴${listing.price || '...'} / міс</span>
                                ${typeTag} 
                            </div>
                            <div class="listing-content">
                                <h3>${listing.title}</h3>
                                <p class="details"><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто'}</p>
                            </div>
                        </div>
                    </a>
                `;
            });
        }

        // Показуємо контент
        loadingIndicator.style.display = 'none';
        profileContainer.style.display = 'flex'; // 'flex', оскільки .public-profile-container - це flex-контейнер

    } catch (error) {
        console.error('Помилка завантаження публічного профілю:', error);
        loadingIndicator.innerHTML = `<h1>Помилка завантаження</h1><p style="text-align: center;">${error.message}</p>`;
    }
};


// =================================================================================
// 4. ГОЛОВНИЙ ВИКОНАВЧИЙ БЛОК (РОУТЕР)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        // 1. ЗАВЖДИ ЗАВАНТАЖУЄМО НАВІГАЦІЮ СПОЧАТКУ
        await loadNavigation();

        // 2. Визначаємо поточну сторінку
        const path = window.location.pathname;

        // 3. ЗАПУСКАЄМО ЛОГІКУ ДЛЯ КОНКРЕТНИХ СТОРІНОК
        if (path.endsWith('index.html') || path.endsWith('/')) {
            // Запускаємо завантаження (за замовчуванням покаже "Всі", крім 'find_home')
            fetchAndDisplayListings('listing_type!=find_home');
            // Запускаємо всю логіку кнопок та фільтрів
            setupHomepageLogic();
        }

        if (path.endsWith('register.html')) {
            await handleRegistration();
        }

        if (path.endsWith('login.html')) {
            await handleLogin();
        }

        if (path.endsWith('add_listing.html')) {
            setupAddListingFormLogic();
            await handleListingSubmission();
        }

        if (path.endsWith('listing_detail.html')) {
            await fetchAndDisplayListingDetail();
        }

        if (path.endsWith('profile.html')) {
            await loadProfileData();
            setupProfileEventListeners();
        }

        if (path.endsWith('my_listings.html')) {
            await fetchAndDisplayMyListings();
        }

        if (path.endsWith('chat.html')) {
            if (!MY_USER_ID) {
                alert('Будь ласка, увійдіть, щоб переглянути повідомлення.');
                window.location.href = 'login.html';
            } else {
                await loadConversations();
                handleMessageSend();
                setupSocketIO(); // Запускаємо сокети
            }
        }

        if (path.endsWith('settings.html')) {
            await loadSettingsData();
            handleSettingsSubmission();

            // Тут може бути логіка для "Видалити акаунт", якщо вона є
            document.getElementById('btnDeleteAccount')?.addEventListener('click', () => {
                alert('Функція видалення акаунту в розробці.');
            });
        }

        if (path.endsWith('user_profile.html')) {
            await loadPublicProfileData();
        }

    })();
});