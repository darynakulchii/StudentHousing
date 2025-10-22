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

/**
 * Налаштовує посилання в навігації (avatar, login, register) залежно від стану авторизації.
 */
const setupNavLinks = () => {
    const isLoggedIn = !!MY_USER_ID;

    const navLoginLink = document.getElementById('navLoginLink');
    // УВАГА: у вашому navigation.html відсутній ID "navRegisterLink".
    // Я знаходжу його за посиланням, але краще додати ID.
    const navRegisterLink = document.querySelector('a[href="register.html"]');
    const userAvatar = document.querySelector('.user-avatar');

    if (userAvatar) {
        userAvatar.href = isLoggedIn ? 'profile.html' : 'login.html';
    }

    if (isLoggedIn) {
        // Користувач авторизований
        if (navLoginLink) navLoginLink.style.display = 'none';
        if (navRegisterLink) navRegisterLink.style.display = 'none';
    } else {
        // Користувач НЕ авторизований
        if (navLoginLink) navLoginLink.style.display = 'block';
        if (navRegisterLink) navRegisterLink.style.display = 'block';
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
        setupNavLinks(); // <--- Виклик виправленої функції

        // Приклад сповіщень
        currentNotificationCount = 2; // (Це можна замінити на fetch)
        updateNotificationCount(currentNotificationCount);

        // Налаштування слухачів подій
        document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => toggleMenu('open'));
        document.getElementById('btnCloseMenu')?.addEventListener('click', () => toggleMenu('close'));

        document.querySelector('.notification-icon-container')?.addEventListener('click', () => toggleNotifications('open'));
        document.getElementById('btnCloseNotifications')?.addEventListener('click', () => toggleNotifications('close'));

        // ОНОВЛЕНО: Слухач для кнопки фільтрів тепер тут
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
 * ОНОВЛЕНО: ЦЯ ФУНКЦІЯ КЕРУЄ ВСІЄЮ ЛОГІКОЮ ФІЛЬТРІВ ТА КНОПОК НА index.html
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
        setInputValue('habits-select', user.habits);
        setInputValue('profile_bio', user.bio);
        // setInputValue('interests-select', user.interests); // 'interests' немає в схемі 'users'

        if (user.date_of_birth) {
            setInputValue('profile_date', user.date_of_birth.split('T')[0]);
        }

        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarName = document.getElementById('profileAvatarName');

        if (avatarImg) avatarImg.src = user.avatar_url || 'https://i.pinimg.com/736x/20/8e/8f/208e8f23b4ffbab9da6212c9c33fa53b.jpg';
        if (avatarName) avatarName.textContent = `${user.first_name || ''} ${user.last_name || ''}`;

    } catch (error) {
        console.error('Помилка завантаження профілю:', error);
        alert(error.message);
        removeToken(); // Видаляємо недійсний токен
        window.location.href = 'login.html';
    }
};

const setupProfileEventListeners = () => {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            const data = Object.fromEntries(formData.entries());

            // ОНОВЛЕНО: Видаляємо лише 'interests', оскільки 'phone_number' тепер обробляється
            delete data.interests;

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

    // Інші кнопки (заглушки)
    document.getElementById('btnMyListings')?.addEventListener('click', () => {
        alert('Сторінка "Мої оголошення" в розробці.');
    });
    document.getElementById('btnLoginPassword')?.addEventListener('click', () => {
        alert('Розділ "Зміна логіну та пароля" в розробці.');
    });
    document.getElementById('btnSettings')?.addEventListener('click', () => {
        window.location.href = 'settings.html'; // Перехід на налаштування
    });
};

// --- Логіка listing_detail.html ---

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

        const mainImage = listing.photos.find(p => p.is_main) || listing.photos[0] || { image_url: 'https://picsum.photos/800/600?random=' + listing.listing_id };

        let photoGalleryHTML = '';
        if (listing.photos.length > 1) {
            photoGalleryHTML = listing.photos
                .filter(p => !p.is_main)
                .map(photo => `<img src="${photo.image_url}" alt="Фото ${listing.title}" class="gallery-thumbnail">`)
                .join('');
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
                        <img src="${mainImage.image_url}" alt="${listing.title}" id="mainDetailImage">
                    </div>
                    ${photoGalleryHTML ? `<div class="thumbnail-gallery">${photoGalleryHTML}</div>` : ''}
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
                        <div class="author-avatar"><i class="fas fa-user-circle"></i></div>
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
    if (!form) return;

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб додати оголошення.');
        window.location.href = 'login.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

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

        try {
            const response = await fetch('http://localhost:3000/api/listings', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const result = await response.json();
                alert(`Успіх! ${result.message} (ID: ${result.listingId})`);
                form.reset();
                window.location.href = 'index.html';
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
            // Перевірка авторизації відбувається всередині loadProfileData
            await loadProfileData();
            setupProfileEventListeners();
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

    })();
});