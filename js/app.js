// =================================================================================
// 0. ІМПОРТИ ТА ГЛОБАЛЬНІ ДАНІ
// =================================================================================

// ВИКОРИСТОВУЄМО ДАНІ З МОДУЛЯ
import { universitiesData } from './modules/universities.js';

// --- ФОТО: Додаємо URL за замовчуванням ---
const DEFAULT_AVATAR_URL = 'https://placehold.co/120x120/EBF4FF/7F9CF5?text=User'; // Схожий на іконку
const DEFAULT_LISTING_IMAGE = {
    'rent_out': 'https://via.placeholder.com/400x300.png?text=Rent+Out',
    'find_mate': 'https://via.placeholder.com/400x300.png?text=Find+Mate',
    'find_home': 'https://via.placeholder.com/400x300.png?text=Find+Home',
    'default': 'https://picsum.photos/400/300' // Загальний
};


// =================================================================================
// 0.1. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ АВТЕНТИФІКАЦІЇ
// =================================================================================

const getToken = () => localStorage.getItem('authToken');
const setToken = (token) => localStorage.setItem('authToken', token);
const removeToken = () => localStorage.removeItem('authToken');

const getAuthHeaders = (isJson = true) => {
    const token = getToken();
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
};

const parseJwt = (token) => {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT parsing error:", e);
        return null;
    }
};

const getMyUserId = () => {
    const token = getToken();
    if (!token) return null;
    const payload = parseJwt(token);
    if (!payload) {
        removeToken();
        return null;
    }
    if (payload.exp && (payload.exp * 1000 < Date.now())) {
        console.log("JWT token expired. Removing.");
        removeToken();
        return null;
    }
    return payload.userId;
};

const MY_USER_ID = getMyUserId(); // Глобальна константа

// =================================================================================
// 1. ГЛОБАЛЬНІ ЗМІННІ ТА ФУНКЦІЇ ІНТЕРФЕЙСУ (Навігація, Сповіщення)
// =================================================================================

let socket;
let mobileMenuWindow, filterSidebar, notificationSidebar, overlay, notificationBadge;
let currentNotificationCount = 0;
let currentUserFavoriteIds = new Set(); // Зберігає ID обраних оголошень

const updateNotificationCount = (count) => {
    if (!notificationBadge) return;
    if (count > 0) {
        notificationBadge.textContent = count > 9 ? '9+' : count;
        notificationBadge.style.display = 'flex';
    } else {
        notificationBadge.style.display = 'none';
    }
};

const toggleSidebar = (sidebar, action) => {
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.contains('open');
    if (action === 'open' && !isOpen) {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else if (action === 'close' && isOpen) {
        sidebar.classList.remove('open');
        // Перевіряємо, чи інші сайдбари відкриті, перед тим як ховати overlay
        const anySidebarOpen = [mobileMenuWindow, filterSidebar, notificationSidebar].some(s => s?.classList.contains('open'));
        if (!anySidebarOpen) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};

const toggleMenu = (action) => toggleSidebar(mobileMenuWindow, action);
const toggleFilters = (action) => toggleSidebar(filterSidebar, action);

const toggleNotifications = async (action) => {
    if (!notificationSidebar || !overlay) return;
    toggleSidebar(notificationSidebar, action);
    if (action === 'open' && currentNotificationCount > 0) {
        await markNotificationsAsRead();
        currentNotificationCount = 0;
        updateNotificationCount(0);
    }
};

const fetchFavoriteIds = async () => {
    if (!MY_USER_ID) return;
    try {
        const response = await fetch('http://localhost:3000/api/my-favorites/ids', { headers: getAuthHeaders() });
        if (response.ok) {
            const ids = await response.json();
            currentUserFavoriteIds = new Set(ids);
            console.log('Favorite IDs loaded:', currentUserFavoriteIds);
        } else {
            console.error('Failed to load favorite IDs');
        }
    } catch (error) {
        console.error('Error fetching favorite IDs:', error);
    }
};

const renderNotificationItem = (notification) => {
    let iconClass = 'fa-bell';
    if (notification.message.includes('повідомлення')) iconClass = 'fa-comment-dots';
    else if (notification.message.includes('вибране')) iconClass = 'fa-heart';

    const isUnread = !notification.is_read ? 'unread' : '';
    const timeAgo = notification.created_at ? new Date(notification.created_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : 'нещодавно';
    const tag = notification.link_url ? 'a' : 'div';
    const href = notification.link_url ? `href="${notification.link_url}"` : '';

    return `<${tag} ${href} class="notification-item ${isUnread}" data-id="${notification.notification_id}">
                <i class="fas ${iconClass}"></i>
                <p>${notification.message}</p>
                <span class="notification-time">${timeAgo}</span>
            </${tag}>`;
};

const fetchAndDisplayNotifications = async () => {
    const container = document.querySelector('.notification-list');
    if (!container || !MY_USER_ID) return;
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Завантаження...</p>';
    try {
        const response = await fetch('http://localhost:3000/api/my-notifications', { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to load notifications');
        const notifications = await response.json();
        container.innerHTML = '';
        let unreadCount = 0;
        if (notifications.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);">У вас немає сповіщень.</p>';
        } else {
            notifications.forEach(n => {
                if (!n.is_read) unreadCount++;
                container.innerHTML += renderNotificationItem(n);
            });
        }
        currentNotificationCount = unreadCount;
        updateNotificationCount(currentNotificationCount);
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--danger-color);">Помилка завантаження.</p>';
    }
};

const prependNotification = (notification) => {
    const container = document.querySelector('.notification-list');
    if (!container) return;
    container.querySelector('p')?.remove(); // Remove placeholder if exists
    container.insertAdjacentHTML('afterbegin', renderNotificationItem(notification));
};

const markNotificationsAsRead = async () => {
    if (!MY_USER_ID) return; // Added check
    // Optimization: check if there are unread items visually first
    const unreadItems = document.querySelectorAll('.notification-item.unread');
    if (unreadItems.length === 0) return;

    try {
        await fetch('http://localhost:3000/api/my-notifications/read', { method: 'PATCH', headers: getAuthHeaders() });
        unreadItems.forEach(item => item.classList.remove('unread'));
        console.log('Notifications marked as read');
    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
};

// =================================================================================
// 2. ЛОГІКА ЗАВАНТАЖЕННЯ НАВІГАЦІЇ
// =================================================================================

const highlightActiveLink = () => {
    let currentPath = window.location.pathname.split('/').pop() || 'index.html'; // Default to index.html if path is '/'
    // Simple check if it's likely a subpage (adjust if needed)
    if (!['index.html', 'login.html', 'register.html', ''].includes(currentPath) && !currentPath.includes('.')) {
        currentPath += '.html'; // Assume .html if just a name
    }
    const isPage = !['index.html', ''].includes(currentPath); // More robust check

    const navLinks = document.querySelectorAll('.desktop-nav a, .mobile-nav-bar a');
    navLinks.forEach(link => {
        let linkPath = link.getAttribute('data-path');
        // Normalize paths for comparison (handle potential leading slashes or differences)
        linkPath = linkPath.startsWith('../') ? linkPath.substring(3) : linkPath;
        currentPath = currentPath.startsWith('pages/') ? currentPath.substring(6) : currentPath;

        if (linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};


const setupNavLinks = async () => {
    const isLoggedIn = !!MY_USER_ID;
    const navLoginLink = document.getElementById('navLoginLink');
    const navRegisterLink = document.querySelector('a[href="register.html"]'); // Assuming only one register link
    const userAvatarElement = document.querySelector('.user-avatar');

    if (!userAvatarElement) return; // Exit if avatar element not found

    if (isLoggedIn) {
        if (navLoginLink) navLoginLink.style.display = 'none';
        if (navRegisterLink) navRegisterLink.style.display = 'none';
        try {
            const response = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
            if (response.ok) {
                const user = await response.json();
                userAvatarElement.style.backgroundImage = `url('${user.avatar_url || DEFAULT_AVATAR_URL}')`;
                userAvatarElement.href = 'profile.html';
            } else {
                userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
                userAvatarElement.href = 'profile.html'; // Still link to profile even if avatar fails
            }
        } catch (error) {
            console.error("Error loading avatar for header:", error);
            userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
            userAvatarElement.href = 'profile.html';
        }
    } else {
        if (navLoginLink) navLoginLink.style.display = 'block';
        if (navRegisterLink) navRegisterLink.style.display = 'block';
        userAvatarElement.style.backgroundImage = `url('${DEFAULT_AVATAR_URL}')`;
        userAvatarElement.href = 'login.html';
    }
};

const loadNavigation = async () => {
    const placeholder = document.getElementById('navigation-placeholder');
    if (!placeholder) return;
    // Determine path based on current location (root or subfolder)
    const navPath = window.location.pathname.includes('/pages/') ? '../navigation.html' : 'navigation.html';

    try {
        const response = await fetch(navPath);
        if (!response.ok) throw new Error(`Failed to fetch navigation: ${response.statusText}`);
        placeholder.innerHTML = await response.text();

        // Initialize elements *after* loading HTML
        mobileMenuWindow = document.getElementById('mobileMenuWindow');
        filterSidebar = document.getElementById('filterSidebar');
        notificationSidebar = document.getElementById('notificationSidebar');
        overlay = document.getElementById('overlay');
        notificationBadge = document.getElementById('notificationBadge');

        highlightActiveLink(); // Highlight based on current page
        await setupNavLinks(); // Show/hide login/register/avatar

        if (MY_USER_ID) {
            await fetchAndDisplayNotifications();
        } else {
            updateNotificationCount(0);
        }

        // Setup event listeners
        document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => toggleMenu('open'));
        document.getElementById('btnCloseMenu')?.addEventListener('click', () => toggleMenu('close'));
        document.querySelector('.notification-icon-container')?.addEventListener('click', () => toggleNotifications('open'));
        document.getElementById('btnCloseNotifications')?.addEventListener('click', () => toggleNotifications('close'));
        document.querySelector('.filter-btn')?.addEventListener('click', () => toggleFilters('open')); // Listener for filter button
        document.getElementById('btnCloseFilters')?.addEventListener('click', () => toggleFilters('close'));
        overlay?.addEventListener('click', () => { // Close all sidebars on overlay click
            toggleMenu('close');
            toggleFilters('close');
            toggleNotifications('close');
        });

    } catch (error) {
        console.error('Error loading navigation:', error);
        placeholder.innerHTML = '<p style="color: red; text-align: center;">Помилка завантаження навігації</p>';
    }
};

// =================================================================================
// 3. ЛОГІКА КОНКРЕТНИХ СТОРІНОК
// =================================================================================

// --- Логіка index.html (Головна сторінка, Фільтри) ---

const fetchAndDisplayListings = async (filterQuery = '') => {
    const container = document.querySelector('.listings-container');
    if (!container) return;
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Завантаження оголошень...</p>';
    try {
        const defaultQuery = 'listing_type!=find_home'; // Default filter if none provided
        const finalQuery = filterQuery || defaultQuery;
        const response = await fetch(`http://localhost:3000/api/listings?${finalQuery}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const listings = await response.json();
        container.innerHTML = '';
        if (listings.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">За вашими фільтрами оголошень не знайдено.</p>';
            return;
        }
        listings.forEach(listing => {
            const imageUrl = listing.main_photo_url || DEFAULT_LISTING_IMAGE[listing.listing_type] || DEFAULT_LISTING_IMAGE['default'];
            let typeTag = '';
            if (listing.listing_type === 'rent_out') typeTag = '<span class="type-tag rent">Здають</span>';
            else if (listing.listing_type === 'find_mate') typeTag = '<span class="type-tag mate">Шукають сусіда</span>';
            else if (listing.listing_type === 'find_home') typeTag = '<span class="type-tag home">Шукають житло</span>';

            container.innerHTML += `
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
                </a>`;
        });
    } catch (error) {
        console.error('Failed to load listings:', error);
        container.innerHTML = '<p style="color: #e74c3c; font-weight: 600; text-align: center; padding: 20px;">Помилка: Не вдалося з’єднатися з сервером.</p>';
    }
};

const setupHomepageLogic = () => {
    const filtersForm = document.getElementById('filtersForm');
    const actionButtons = document.querySelectorAll('.main-actions-menu .action-btn');
    const searchInput = document.querySelector('.search-input');
    const searchIcon = document.querySelector('.search-icon');
    if (!filtersForm || !actionButtons.length || !searchInput || !searchIcon) return;

    const triggerSearchAndFilter = () => {
        const formData = new FormData(filtersForm);
        const params = new URLSearchParams();
        const searchTerm = searchInput.value.trim();
        if (searchTerm) params.append('search', searchTerm);
        const characteristics = [];
        filtersForm.querySelectorAll('input[name="characteristics"]:checked').forEach(cb => characteristics.push(cb.value));
        formData.forEach((value, key) => {
            if (key !== 'characteristics' && value) params.append(key, value);
        });
        if (characteristics.length > 0) params.append('characteristics', characteristics.join(','));
        const filterQuery = params.toString();
        console.log('Applying search/filters:', filterQuery);
        fetchAndDisplayListings(filterQuery);
    };

    const updateFilterVisibility = () => {
        const form = filtersForm;
        const housingFilters = form.querySelector('#housingFilters');
        const listingDetails = form.querySelector('#listingDetails');
        const aboutMe = form.querySelector('#aboutMe');
        const roommatePrefs = form.querySelector('#roommatePreferences');
        const selectedType = form.querySelector('input[name="listing_type"]:checked')?.value;

        [housingFilters, listingDetails, aboutMe, roommatePrefs].forEach(el => { if(el) el.style.display = 'none'; });

        if (selectedType === 'find_home') [housingFilters, aboutMe, roommatePrefs].forEach(el => { if(el) el.style.display = 'block'; });
        else if (selectedType === 'rent_out') [listingDetails].forEach(el => { if(el) el.style.display = 'block'; });
        else if (selectedType === 'find_mate') [listingDetails, aboutMe, roommatePrefs].forEach(el => { if(el) el.style.display = 'block'; });
        else [housingFilters, listingDetails, aboutMe, roommatePrefs].forEach(el => { if(el) el.style.display = 'block'; }); // Show all for 'all'
    };

    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            actionButtons.forEach(btn => btn.classList.remove('active-action'));
            button.classList.add('active-action');
            const actionType = button.getAttribute('data-type');
            const typeValue = (actionType === 'all_listings') ? '' : actionType;
            filtersForm.reset();
            searchInput.value = '';
            const radioInForm = filtersForm.querySelector(`input[name="listing_type"][value="${typeValue}"]`);
            if (radioInForm) radioInForm.checked = true;
            updateFilterVisibility();
            const query = typeValue ? `listing_type=${typeValue}` : 'listing_type!=find_home'; // Default query
            fetchAndDisplayListings(query);
        });
    });

    filtersForm.querySelectorAll('input[name="listing_type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateFilterVisibility();
            const typeValue = radio.value || 'all_listings'; // Use 'all_listings' if value is empty
            actionButtons.forEach(btn => btn.classList.remove('active-action'));
            document.querySelector(`.action-btn[data-type="${typeValue}"]`)?.classList.add('active-action');
        });
    });

    filtersForm.addEventListener('submit', (e) => {
        e.preventDefault();
        triggerSearchAndFilter();
        toggleFilters('close');
    });

    filtersForm.querySelector('.reset-filters-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        filtersForm.reset();
        searchInput.value = '';
        actionButtons.forEach(btn => btn.classList.remove('active-action'));
        document.querySelector('.action-btn[data-type="all_listings"]')?.classList.add('active-action');
        updateFilterVisibility();
        fetchAndDisplayListings('listing_type!=find_home'); // Reset to default view
        console.log('Filters reset');
    });

    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); triggerSearchAndFilter(); } });
    searchIcon.addEventListener('click', triggerSearchAndFilter);
    searchIcon.style.cursor = 'pointer';

    updateFilterVisibility(); // Initial setup
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

const setupProfileEventListeners = () => {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            // Дані ТІЛЬКИ з форми
            const dataFromForm = Object.fromEntries(formData.entries());
            // Видаляємо непотрібні поля з даних форми (якщо вони там є)
            //delete dataFromForm.interests;
            //delete dataFromForm.habits;

            // === Отримуємо поточні дані ===
            let currentProfileData = {};
            try {
                const profileResponse = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
                if (!profileResponse.ok) throw new Error('Помилка отримання поточних даних профілю.');
                currentProfileData = await profileResponse.json();
            } catch (error) {
                alert(`Помилка: ${error.message}`);
                return; // Не продовжуємо, якщо не вдалося отримати дані
            }

            // Об'єднуємо поточні дані з даними форми
            // Дані з форми мають пріоритет
            const updatedProfileData = { ...currentProfileData, ...dataFromForm };

            try {
                const response = await fetch('http://localhost:3000/api/profile', {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(updatedProfileData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Не вдалося оновити профіль');
                }

                const result = await response.json();
                alert(result.message);

                // Оновлюємо ім'я в сайдбарі, якщо воно змінилося
                const avatarName = document.getElementById('profileAvatarName');
                if (avatarName && (result.user.first_name !== currentProfileData.first_name || result.user.last_name !== currentProfileData.last_name)) {
                    avatarName.textContent = `${result.user.first_name || ''} ${result.user.last_name || ''}`;
                    // Також оновлюємо аватар у хедері (на випадок зміни імені там)
                    await setupNavLinks();
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

    // Слухач для завантаження аватара
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
        window.location.href = 'login_settings.html';
    });
    document.getElementById('btnSettings')?.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });
};

// --- Логіка settings.html ---
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

// --- Логіка login_settings.html ---
const handleLoginSettings = () => {
    const changeEmailForm = document.getElementById('changeEmailForm');
    const changePasswordForm = document.getElementById('changePasswordForm');

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб змінити налаштування.');
        window.location.href = 'login.html';
        return;
    }

    // Обробник форми зміни Email
    if (changeEmailForm) {
        changeEmailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(changeEmailForm);
            const data = Object.fromEntries(formData.entries());

            const submitButton = changeEmailForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Зміна...';

            try {
                const response = await fetch('http://localhost:3000/api/profile/change-email', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    alert('Email успішно оновлено!');
                    changeEmailForm.reset();
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Невідома помилка');
                }
            } catch (error) {
                alert(`Помилка: ${error.message}`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Змінити Email';
            }
        });
    }

    // Обробник форми зміни Паролю
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(changePasswordForm);
            const data = Object.fromEntries(formData.entries());

            if (data.new_password !== data.confirm_new_password) {
                alert('Помилка: Нові паролі не співпадають.');
                return;
            }

            const submitButton = changePasswordForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Зміна...';

            try {
                const response = await fetch('http://localhost:3000/api/profile/change-password', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        old_password: data.old_password,
                        new_password: data.new_password
                    })
                });

                if (response.ok) {
                    alert('Пароль успішно оновлено!');
                    changePasswordForm.reset();
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Невідома помилка');
                }
            } catch (error) {
                alert(`Помилка: ${error.message}`);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Змінити Пароль';
            }
        });
    }
};

// --- Логіка listing_detail.html ---
const fetchAndDisplayListingDetail = async () => {
    const container = document.getElementById('listingDetailContainer');
    if (!container) return;

    // Show loading placeholder
    container.innerHTML = `
        <div class="loading-placeholder">
            <h1>Завантаження деталей...</h1>
            <p style="text-align: center; color: var(--text-light);">
                <i class="fas fa-spinner fa-spin"></i>
            </p>
        </div>`;

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
        document.title = `UniHome | ${listing.title}`; // Set page title

        // --- Photo display logic with defaults ---
        let mainImage = listing.photos?.find(p => p.is_main); // Use optional chaining
        let mainImageUrl = mainImage?.image_url
            || listing.main_photo_url
            || DEFAULT_LISTING_IMAGE[listing.listing_type]
            || DEFAULT_LISTING_IMAGE['default'];

        let photoGalleryHTML = '';
        if (listing.photos && listing.photos.length > 0) {
            const sortedPhotos = mainImage
                ? [mainImage, ...listing.photos.filter(p => !p.is_main)]
                : listing.photos;
            photoGalleryHTML = sortedPhotos
                .map((photo, index) => `<img src="${photo.image_url}" alt="Фото ${index + 1}" class="gallery-thumbnail ${index === 0 ? 'active' : ''}">`)
                .join('');
        } else {
            photoGalleryHTML = `<img src="${mainImageUrl}" alt="${listing.title}" class="gallery-thumbnail inactive">`;
        }

        // === Characteristic Grouping Logic ===

        // 1. Corrected dictionary for category names (matched with another-branch schema.sql)
        const categoryNames = {
            'tech': 'Побутова техніка',
            'media': 'Мультимедіа',
            'comfort': 'Комфорт',
            'pets_allowed_detail': 'Домашні улюбленці (Дозволено)', // Corrected key based on schema
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
            // University categories (e.g., 'university_kyiv') exist in schema but are not explicitly handled here for section titles.
            // Characteristics with these categories will still be fetched if present in the listing.
        };

        // 2. Group characteristics from backend
        const characteristicsByCategory = {};
        if (listing.characteristics) {
            listing.characteristics.forEach(char => {
                const category = char.category;
                if (!characteristicsByCategory[category]) {
                    characteristicsByCategory[category] = [];
                }
                characteristicsByCategory[category].push(`<span class="char-tag">${char.name_ukr}</span>`);
            });
        }

        // 3. Helper function to build HTML sections for characteristics
        const buildCharSection = (categoriesToShow) => {
            let html = '';
            for (const category of categoriesToShow) {
                // Use categoryNames[category] for the title if available, otherwise use the category key itself
                const sectionTitle = categoryNames[category] || category.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()); // Fallback title
                if (characteristicsByCategory[category] && characteristicsByCategory[category].length > 0) { // Only show if characteristics exist for category
                    html += `
                        <div class="char-category-group">
                            <h3>${sectionTitle}</h3>
                            <div class="characteristics-list">
                                ${characteristicsByCategory[category].join('')}
                            </div>
                        </div>
                    `;
                }
            }
            return html;
        };

        // 4. Generate HTML blocks for each section
        let aboutAuthorHTML = '';
        let roommatePrefsHTML = '';
        let housingCharsHTML = '';

        // -- "About Author" & "Roommate Preferences" (ONLY for find_home & find_mate)
        if (listing.listing_type === 'find_home' || listing.listing_type === 'find_mate') {
            const myCategories = ['my_personality', 'my_lifestyle', 'my_interests', 'my_pets'];
            const myCharsHTML = buildCharSection(myCategories);

            if (listing.my_age || listing.my_gender || listing.my_smoking || listing.my_drinking || listing.my_guests || myCharsHTML) { // Added checks for smoking/drinking/guests
                aboutAuthorHTML = `
                    <div class="detail-section">
                        <h2>Про автора</h2>
                        <div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">
                            ${listing.my_age ? `<span class="char-tag">Вік: ${listing.my_age}</span>` : ''}
                            ${listing.my_gender === 'female' ? `<span class="char-tag">Стать: Жіноча</span>` : ''}
                            ${listing.my_gender === 'male' ? `<span class="char-tag">Стать: Чоловіча</span>` : ''}
                            ${listing.my_gender === 'other' ? `<span class="char-tag">Стать: Інша</span>` : ''}
                            ${listing.my_smoking ? `<span class="char-tag">Паління: ${listing.my_smoking === 'no' ? 'Не палю' : (listing.my_smoking === 'yes' ? 'Палю' : 'Палю (лише на вулиці)')}</span>` : ''}
                            ${listing.my_drinking ? `<span class="char-tag">Алкоголь: ${listing.my_drinking === 'no' ? 'Не вживаю' : (listing.my_drinking === 'rarely' ? 'Рідко' : 'Вживаю')}</span>` : ''}
                            ${listing.my_guests ? `<span class="char-tag">Гості: ${listing.my_guests === 'no' ? 'Без гостей' : (listing.my_guests === 'rarely' ? 'Рідко' : (listing.my_guests === 'sometimes' ? 'Іноді' : 'Часто'))}</span>` : ''}
                        </div>
                        ${myCharsHTML}
                        ${listing.about_me_description ? `<div class="char-category-group"><h3>Додатково про себе</h3><p>${listing.about_me_description.replace(/\n/g, '<br>')}</p></div>` : ''}
                    </div>
                `;
            }

            const mateCategories = ['mate_personality', 'mate_lifestyle', 'mate_interests', 'mate_pets'];
            const mateCharsHTML = buildCharSection(mateCategories);

            if (listing.roommate_gender || listing.roommate_age_min || listing.roommate_smoking || listing.roommate_drinking || listing.roommate_guests || mateCharsHTML) { // Added checks
                roommatePrefsHTML = `
                    <div class="detail-section">
                        <h2>Вимоги до сусіда</h2>
                        <div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">
                            ${listing.roommate_gender && listing.roommate_gender !== 'any' ? `<span class="char-tag">Стать: ${listing.roommate_gender === 'female' ? 'Жіноча' : (listing.roommate_gender === 'male' ? 'Чоловіча' : 'Інша')}</span>` : ''}
                            ${listing.roommate_age_min && listing.roommate_age_max ? `<span class="char-tag">Вік: ${listing.roommate_age_min} - ${listing.roommate_age_max}</span>` : ''}
                            ${listing.roommate_smoking && listing.roommate_smoking !== 'any' ? `<span class="char-tag">Паління (сусід): ${listing.roommate_smoking === 'no' ? 'Не палить' : (listing.roommate_smoking === 'yes' ? 'Палить' : 'Палить (лише на вулиці)')}</span>` : ''}
                            ${listing.roommate_drinking && listing.roommate_drinking !== 'any' ? `<span class="char-tag">Алкоголь (сусід): ${listing.roommate_drinking === 'no' ? 'Не вживає' : (listing.roommate_drinking === 'rarely' ? 'Рідко' : 'Вживає')}</span>` : ''}
                            ${listing.roommate_guests && listing.roommate_guests !== 'any' ? `<span class="char-tag">Гості (сусід): ${listing.roommate_guests === 'no' ? 'Без гостей' : (listing.roommate_guests === 'rarely' ? 'Рідко' : (listing.roommate_guests === 'sometimes' ? 'Іноді' : 'Часто'))}</span>` : ''}
                         </div>
                        ${mateCharsHTML}
                        ${listing.roommate_description ? `<div class="char-category-group"><h3>Додаткові побажання</h3><p>${listing.roommate_description.replace(/\n/g, '<br>')}</p></div>` : ''}
                    </div>
                `;
            }
        }

        // -- "Housing Characteristics" (for all types, different titles)
        // Include pets_allowed_detail for specific pet types if pet_policy is 'yes'
        const apartmentCategories = [
            'tech', 'media', 'comfort', ...(listing.pet_policy === 'yes' ? ['pets_allowed_detail'] : []),
            'blackout', 'rules', 'communications', 'infra', 'inclusive'
        ];
        // Separately get university characteristics if they exist
        const universityChars = listing.characteristics?.filter(c => c.category.startsWith('university_'))
            .map(c => `<span class="char-tag">${c.name_ukr}</span>`).join('') || '';

        const apartmentCharsHTML = buildCharSection(apartmentCategories);

        // Add optional fields like study conditions and owner rules
        let optionalFieldsHTML = '';
        if (listing.study_conditions) {
            optionalFieldsHTML += `<div class="char-category-group"><h3>Умови для навчання</h3><p>${listing.study_conditions.replace(/\n/g, '<br>')}</p></div>`;
        }
        if (listing.owner_rules && listing.listing_type === 'rent_out') { // Only for rent_out
            optionalFieldsHTML += `<div class="char-category-group"><h3>Правила від власника</h3><p>${listing.owner_rules.replace(/\n/g, '<br>')}</p></div>`;
        }
        // Add Nearby Universities section if characteristics exist
        let nearbyUniversitiesHTML = '';
        if (universityChars && (listing.listing_type === 'rent_out' || listing.listing_type === 'find_mate')) {
            nearbyUniversitiesHTML = `
                <div class="char-category-group">
                    <h3>Університети поруч</h3>
                    <div class="characteristics-list">
                        ${universityChars}
                    </div>
                </div>`;
        }


        // Combine characteristics, optional fields, and universities
        const combinedHousingCharsHTML = apartmentCharsHTML + nearbyUniversitiesHTML + optionalFieldsHTML;

        if (listing.listing_type === 'find_home') {
            housingCharsHTML = `
                <div class="detail-section">
                    <h2>Бажані характеристики житла</h2>
                    ${combinedHousingCharsHTML || '<p>Автор не вказав бажаних характеристик.</p>'}
                </div>
            `;
        } else if (listing.listing_type === 'rent_out' || listing.listing_type === 'find_mate') {
            housingCharsHTML = `
                <div class="detail-section">
                    <h2>Характеристики житла</h2>
                     ${combinedHousingCharsHTML || '<p>Характеристики не вказані.</p>'}
                 </div>
            `;
        }

        // === Author Avatar HTML ===
        const authorAvatarHTML = `
             <a href="user_profile.html?id=${listing.user_id}" class="author-name-link">
                 <div class="author-avatar">
                     <img src="${listing.avatar_url || DEFAULT_AVATAR_URL}" alt="Аватар автора">
                 </div>
            </a>
        `;

        // === Contact Button HTML ===
        const contactButtonHTML = (MY_USER_ID === listing.user_id)
            ? `<a href="profile.html" class="contact-btn" style="background: #7f8c8d;">
                 <i class="fas fa-user-edit"></i> Це ваше оголошення
               </a>`
            : (MY_USER_ID ? `<a href="chat.html?user_id=${listing.user_id}" class="contact-btn">
                 <i class="fas fa-comment-dots"></i> Зв'язатись з автором
               </a>` : `<a href="login.html" class="contact-btn">
                 <i class="fas fa-sign-in-alt"></i> Увійдіть, щоб зв'язатись
               </a>`); // Show login button if not logged in


        // === Final HTML Assembly ===
        const detailHTML = `
            <div class="listing-detail-layout">
                <div class="listing-detail-gallery">
                    <div class="main-image-container">
                        <img src="${mainImageUrl}" alt="${listing.title}" id="mainDetailImage">
                    </div>
                    <div class="thumbnail-gallery">${photoGalleryHTML}</div>
                </div>

                <div class="listing-detail-info">
                    <div class="listing-title-header">
                        <h1>${listing.title}</h1>
                        <button class="favorite-btn" id="favoriteBtn" title="Додати у вибране" data-listing-id="${listingId}">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                    <span class="detail-price">₴${listing.price || 0} / міс</span>

                    <div class="detail-meta">
                        <p><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто не вказано'} ${listing.address ? `, ${listing.address}` : ''}</p>
                        ${listing.target_university && listing.listing_type === 'find_home' ? `<p><i class="fas fa-university"></i> Шукає біля: ${listing.target_university}</p>` : ''}
                        ${listing.rooms ? `<p><i class="fas fa-door-open"></i> Кімнат: ${listing.rooms}</p>` : ''}
                        ${listing.total_area ? `<p><i class="fas fa-ruler-combined"></i> Площа: ${listing.total_area} м²</p>` : ''}
                        ${listing.kitchen_area ? `<p><i class="fas fa-utensils"></i> Кухня: ${listing.kitchen_area} м²</p>` : ''}
                        ${listing.floor && listing.total_floors ? `<p><i class="fas fa-building"></i> Поверх: ${listing.floor} / ${listing.total_floors}</p>` : ''}
                    </div>

                    <div class="detail-section">
                        <h2>Опис</h2>
                        <p>${listing.description ? listing.description.replace(/\n/g, '<br>') : 'Опис відсутній.'}</p>
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

        // --- Setup Thumbnail Click Listeners ---
        const thumbnails = container.querySelectorAll('.gallery-thumbnail:not(.inactive)');
        const mainImageElement = container.querySelector('#mainDetailImage');
        if (mainImageElement && thumbnails.length > 0) {
            thumbnails.forEach(thumb => {
                thumb.addEventListener('click', () => {
                    mainImageElement.src = thumb.src; // Change main image src
                    thumbnails.forEach(t => t.classList.remove('active')); // Remove active class from all
                    thumb.classList.add('active'); // Add active class to clicked thumbnail
                });
            });
        }

        // --- Setup Favorite Button ---
        setupFavoriteButton(listingId, listing.user_id);

    } catch (error) {
        console.error('Error loading listing details:', error);
        container.innerHTML = '<h1 style="text-align: center;">Помилка завантаження</h1><p style="text-align: center;">Не вдалося отримати деталі. Перевірте консоль.</p>';
    }
};

const setupFavoriteButton = (listingId, authorId) => {
    const favButton = document.getElementById('favoriteBtn');
    if (!favButton) return;

    // 1. Перевіряємо, чи залогінений користувач і чи це НЕ його оголошення
    if (!MY_USER_ID || MY_USER_ID === authorId) {
        favButton.style.display = 'none'; // Ховаємо кнопку, якщо не залогінений або це власник
        return;
    }

    // 2. Показуємо кнопку
    favButton.style.display = 'flex'; // 'flex' бо ми центруємо іконку

    // 3. Встановлюємо початковий стан (зафарбоване чи ні)
    if (currentUserFavoriteIds.has(parseInt(listingId))) {
        favButton.classList.add('favorited');
        favButton.querySelector('i').className = 'fas fa-heart'; // 'fas' - суцільне
        favButton.title = 'Видалити з обраного';
    } else {
        favButton.classList.remove('favorited');
        favButton.querySelector('i').className = 'far fa-heart'; // 'far' - контур
        favButton.title = 'Додати у вибране';
    }

    // 4. Додаємо обробник кліка
    favButton.addEventListener('click', async () => {
        const isFavorited = favButton.classList.contains('favorited');
        const url = `http://localhost:3000/api/favorites/${listingId}`;
        const method = isFavorited ? 'DELETE' : 'POST';

        try {
            favButton.disabled = true; // Блокуємо кнопку на час запиту

            const response = await fetch(url, {
                method: method,
                headers: getAuthHeaders()
            });

            if (response.ok) {
                // Успіх! Оновлюємо UI
                if (isFavorited) {
                    favButton.classList.remove('favorited');
                    favButton.querySelector('i').className = 'far fa-heart';
                    favButton.title = 'Додати у вибране';
                    currentUserFavoriteIds.delete(parseInt(listingId));
                } else {
                    favButton.classList.add('favorited');
                    favButton.querySelector('i').className = 'fas fa-heart';
                    favButton.title = 'Видалити з обраного';
                    currentUserFavoriteIds.add(parseInt(listingId));
                }
            } else if (response.status === 401 || response.status === 403) {
                alert('Будь ласка, увійдіть, щоб додати оголошення в обране.');
                window.location.href = 'login.html';
            } else {
                const errorData = await response.json();
                alert(`Помилка: ${errorData.error || 'Не вдалося виконати дію'}`);
            }

        } catch (error) {
            console.error('Помилка при оновленні обраного:', error);
            alert('Помилка мережі. Спробуйте пізніше.');
        } finally {
            favButton.disabled = false; // Розблоковуємо кнопку
        }
    });
};
// --- Логіка favorites.html ---
const fetchAndDisplayFavorites = async () => {
    const container = document.getElementById('favoritesContainer');
    if (!container) return;

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб переглянути обрані оголошення.');
        container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">Будь ласка, <a href="../login.html">увійдіть</a>, щоб побачити цей розділ.</p>';
        window.location.href = 'login.html';
        return;
    }

    // Показуємо спіннер
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Завантаження обраних...</p>';


    try {
        const response = await fetch('http://localhost:3000/api/my-favorites', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP помилка! статус: ${response.status}`);
        }

        const listings = await response.json();
        container.innerHTML = ''; // Очищуємо спіннер

        if (listings.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">Ви ще не додали жодного оголошення до вибраного.</p>';
            return;
        }

        // Рендеримо картки (використовуємо той самий шаблон, що й на index.html)
        listings.forEach(listing => {
            const imageUrl = listing.main_photo_url
                || DEFAULT_LISTING_IMAGE[listing.listing_type]
                || DEFAULT_LISTING_IMAGE['default'];

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
                    <div class="listing-card"> <img src="${imageUrl}" alt="${listing.title}" class="listing-image">
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
        console.error('Помилка завантаження обраних:', error);
        container.innerHTML = `<p style="color: red; padding: 10px;">Помилка завантаження. ${error.message}</p>`;
    }
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

    // Показуємо індикатор завантаження
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Завантаження ваших оголошень...</p>';


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
            const imageUrl = listing.main_photo_url || DEFAULT_LISTING_IMAGE[listing.listing_type] || DEFAULT_LISTING_IMAGE['default'];


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
                     <button class="action-btn edit" title="Редагувати"><i class="fas fa-pencil-alt"></i></button>
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

            // === ОНОВЛЕНО СЛУХАЧ РЕДАГУВАННЯ ===
            listingCard.querySelector('.edit').addEventListener('click', () => {
                window.location.href = `edit_listing.html?id=${listing.listing_id}`; // НОВИЙ КОД
            });
            // === КІНЕЦЬ ОНОВЛЕННЯ ===

            container.appendChild(listingCard);
        });

    } catch (error) {
        console.error('Помилка завантаження моїх оголошень:', error);
        container.innerHTML = `<p style="color: red; padding: 10px;">Помилка завантаження. ${error.message}</p>`;
        if (error.message === 'Необхідна автентифікація.') {
            // Затримка перед перенаправленням, щоб користувач встиг побачити повідомлення
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        }
    }
};

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

    // Додано індикатор завантаження
    container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Завантаження розмов...</p>';

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
            // Якщо розмов немає, показуємо заглушку у вікні повідомлень
            const messagesArea = document.getElementById('messagesArea');
            const chatHeader = document.getElementById('chatHeader');
            const messageForm = document.getElementById('messageForm');
            if(messagesArea) messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Оберіть або почніть нову розмову.</p>';
            if(chatHeader) chatHeader.textContent = 'Оберіть розмову';
            if(messageForm) messageForm.style.display = 'none';

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
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;"><i class="fas fa-spinner fa-spin"></i> Завантаження повідомлень...</p>';


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
            // Прокрутка до останнього повідомлення
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

    // Видаляємо заглушку "Повідомлень ще немає" або спіннер
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
    const sendButton = messageForm?.querySelector('button[type="submit"]'); // Додано для блокування
    if (!messageForm || !messageInput || !sendButton) return;

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageBody = messageInput.value.trim();

        // Перевіряємо, чи є текст і чи обрано отримувача (важливо для нових розмов)
        if (messageBody === '' || !currentOpenReceiverId) return;

        // Блокуємо кнопку на час відправки
        sendButton.disabled = true;

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
                const newMessage = await response.json(); // Отримуємо повідомлення
                messageInput.value = ''; // Очищуємо поле вводу
                messageInput.focus(); // Повертаємо фокус для наступного повідомлення

                // Додаємо візуально, НЕ чекаючи socket.io (щоб уникнути подвоєння, якщо socket прийде)
                appendMessage(newMessage);
                messagesArea.scrollTop = messagesArea.scrollHeight; // Прокручуємо вниз


                // Якщо це була нова розмова (ми відправили, не маючи ID розмови)
                // currentOpenConversationId буде null
                if (currentOpenConversationId === null && newMessage.conversation_id) {
                    console.log('Створено нову розмову, ID:', newMessage.conversation_id);
                    // 1. Оновлюємо поточні ID
                    currentOpenConversationId = newMessage.conversation_id.toString();

                    // 2. Приєднуємось до нової socket.io кімнати
                    if (socket) { // Перевіряємо, чи socket ініціалізовано
                        socket.emit('join_conversation', currentOpenConversationId);
                    }
                    // 3. Оновлюємо список розмов зліва
                    await loadConversations();
                    // 4. "Клікаємо" на щойно створену розмову, щоб вона стала активною
                    const newItem = document.querySelector(`.conversation-item[data-conversation-id="${currentOpenConversationId}"]`);
                    if (newItem) newItem.classList.add('active');
                }
            }else {
                const errorData = await response.json();
                alert(`Помилка відправки: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка відправки:', error);
            alert('Помилка мережі.');
        } finally {
            // Розблоковуємо кнопку
            sendButton.disabled = false;
        }
    });
};

// --- Логіка Socket.IO (для chat.html та навігації) ---

const setupSocketIO = () => {
    // Перевіряємо наявність io та MY_USER_ID
    if (typeof io === 'undefined') {
        console.warn('Socket.io client library not found.');
        return;
    }
    if (!MY_USER_ID) {
        console.log("Користувач не авторизований, Socket.IO не підключається.");
        return; // Не підключаємо, якщо не залогінений
    }


    // Підключаємось, тільки якщо ще не підключені
    if (socket && socket.connected) {
        console.log("Socket.IO вже підключено.");
        return; // Вже підключено
    }

    // Встановлюємо з'єднання
    console.log("Підключення до Socket.IO...");
    socket = io("http://localhost:3000");

    socket.on('connect', () => {
        console.log(`Socket.io підключено: ${socket.id}`);

        // 1. Приєднуємось до особистої кімнати для сповіщень
        socket.emit('join_user_room', MY_USER_ID);

        // 2. Приєднуємось до кімнат існуючих розмов (ЯКЩО ми на сторінці чату)
        if (window.location.pathname.endsWith('chat.html')) {
            console.log('Приєднуємось до кімнат чатів socket.io...');
            const conversationItems = document.querySelectorAll('.conversation-item');
            conversationItems.forEach(item => {
                const convoId = item.dataset.conversationId;
                if (convoId) {
                    socket.emit('join_conversation', convoId);
                }
            });
        }
    });

    // Слухаємо нові ПОВІДОМЛЕННЯ (для оновлення чату)
    socket.on('receive_message', (newMessage) => {
        console.log('Отримано нове повідомлення:', newMessage);

        // Перевіряємо, чи ми на сторінці чату
        const messagesArea = document.getElementById('messagesArea');
        if (!messagesArea) return; // Ми не на сторінці чату

        // Якщо чат з цією людиною відкритий, додаємо повідомлення
        // Перевіряємо, чи ID співпадають (і чи currentOpenConversationId не null)
        if (currentOpenConversationId && newMessage.conversation_id.toString() === currentOpenConversationId) {
            // Перевіряємо, чи це не наше власне повідомлення (щоб уникнути дублювання)
            if (newMessage.sender_id !== MY_USER_ID) {
                appendMessage(newMessage);
                messagesArea.scrollTop = messagesArea.scrollHeight; // Прокручуємо вниз
            }
        } else {
            console.log("Повідомлення для іншої розмови, оновлюємо список розмов...");
            // Якщо чат не відкритий, можна оновити список розмов (показати непрочитане)
            // Або просто покластися на сповіщення
            loadConversations(); // Оновлюємо список, щоб побачити нову розмову або порядок
        }
    });

    // (НОВЕ) Слухаємо всі СПОВІЩЕННЯ
    socket.on('new_notification', (notification) => {
        console.log('Отримано нове сповіщення:', notification);

        // Додаємо на початок списку в сайдбарі
        prependNotification(notification);

        // Збільшуємо лічильник (якщо сайдбар закритий)
        const isSidebarOpen = notificationSidebar?.classList.contains('open'); // Додано перевірку
        if (!isSidebarOpen) {
            currentNotificationCount++;
            updateNotificationCount(currentNotificationCount);
        } else {
            // Якщо сайдбар відкритий, одразу позначаємо його як прочитане
            markNotificationsAsRead();
        }
    });

    socket.on('connect_error', (err) => {
        console.error("Помилка підключення Socket.IO:", err.message);
        // Можна спробувати перепідключитися або показати повідомлення користувачу
    });


    socket.on('disconnect', (reason) => {
        console.log(`Socket.io відключено: ${reason}`);
        // socket = null; // Не скидаємо, бібліотека сама спробує перепідключитися
    });
};

const handleChatUrlParams = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userIdToOpen = urlParams.get('user_id');

    // Очищуємо URL одразу, щоб він не заважав при перезавантаженні або навігації
    window.history.replaceState({}, document.title, window.location.pathname);


    // Немає параметра, або користувач клікнув "зв'язатись" сам із собою
    if (!userIdToOpen || (MY_USER_ID && userIdToOpen === MY_USER_ID.toString())) {
        console.log("Параметр user_id відсутній або вказує на поточного користувача.");
        return;
    }

    // Чекаємо, поки список розмов завантажиться (необхідно для пошуку)
    // Простий варіант - невелика затримка. Кращий - чекати на подію або обіцянку від loadConversations.
    // await new Promise(resolve => setTimeout(resolve, 500)); // Затримка 0.5с - простий варіант

    // Перевіряємо, чи список вже завантажено (чи немає спіннера)
    const conversationList = document.getElementById('conversationsList');
    if (!conversationList || conversationList.querySelector('.fa-spinner')) {
        console.log("Список розмов ще завантажується, чекаємо...");
        // Можна додати більш надійний механізм очікування
        await new Promise(resolve => setTimeout(resolve, 1000)); // Чекаємо 1 секунду
    }


    // 1. Шукаємо, чи такий чат ВЖЕ Є у списку
    const conversationItems = document.querySelectorAll('.conversation-item');
    let foundItem = null;
    conversationItems.forEach(item => {
        if (item.dataset.receiverId === userIdToOpen) {
            foundItem = item;
        }
    });

    if (foundItem) {
        // 2. Якщо чат знайдено, просто клікаємо на нього
        console.log('Знайдено існуючу розмову, відкриваємо...');
        foundItem.click(); // Симулюємо клік, щоб викликати loadMessages та оновити UI
        return;
    }

    // 3. Якщо чат НЕ знайдено (це нова розмова)
    console.log('Це нова розмова, готуємо вікно чату...');

    const chatHeader = document.getElementById('chatHeader');
    const messageForm = document.getElementById('messageForm');
    const messagesArea = document.getElementById('messagesArea');
    if (!chatHeader || !messageForm || !messagesArea) return;

    // Встановлюємо ID для відправки
    currentOpenConversationId = null; // Немає ID розмови, бо вона нова
    currentOpenReceiverId = userIdToOpen; // ID отримувача

    // Показуємо форму вводу
    messageForm.style.display = 'flex';
    // Показуємо пусту область
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Почніть розмову, щоб надіслати перше повідомлення.</p>';
    // Знімаємо 'active' з усіх інших
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));

    // 4. Завантажуємо ім'я користувача для заголовка
    chatHeader.textContent = 'Завантаження імені...';
    try {
        // Використовуємо той самий ендпоінт, що й на сторінці публічного профілю
        const response = await fetch(`http://localhost:3000/api/users/${userIdToOpen}/public-profile`);
        if (!response.ok) throw new Error('Не вдалося отримати дані користувача');

        const user = await response.json();
        chatHeader.textContent = `${user.first_name} ${user.last_name}`; // Встановлюємо ім'я

    } catch (err) {
        console.error(err);
        chatHeader.textContent = 'Нова розмова'; // Запасний варіант
    }
};

// --- Логіка user_profile.html ---
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
        if (profileResponse.status === 404) {
            throw new Error('Користувача не знайдено.');
        }
        if (!profileResponse.ok) {
            throw new Error('Не вдалося завантажити профіль.');
        }
        const user = await profileResponse.json();

        // 2. Обробка оголошень
        if (!listingsResponse.ok) {
            // Не критична помилка, просто виводимо в консоль
            console.error('Не вдалося завантажити оголошення користувача.');
            // throw new Error('Не вдалося завантажити оголошення користувача.');
        }
        const listings = listingsResponse.ok ? await listingsResponse.json() : []; // Якщо помилка, вважаємо список порожнім


        // --- Заповнення даними ---

        // Встановлення заголовку сторінки
        document.title = `UniHome | Профіль ${user.first_name}`;

        // Сайдбар
        document.getElementById('profileAvatarImg').src = user.avatar_url || DEFAULT_AVATAR_URL;
        document.getElementById('profileAvatarName').textContent = `${user.first_name} ${user.last_name}`;

        // Кнопка "Зв'язатись"
        const contactBtn = document.getElementById('btnContactUser');
        if(contactBtn) { // Додано перевірку
            if (MY_USER_ID) {
                contactBtn.href = `chat.html?user_id=${user.user_id}`;
                contactBtn.style.display = 'inline-block'; // Показуємо кнопку
            } else {
                // Якщо поточний користувач не залогінений, ховаємо кнопку
                contactBtn.style.display = 'none';
                // Можна додати повідомлення про необхідність логіну
                const sidebar = contactBtn.closest('.profile-sidebar');
                if(sidebar){
                    const loginMsg = document.createElement('p');
                    loginMsg.innerHTML = '<small>Щоб зв\'язатися, <a href="login.html">увійдіть</a>.</small>';
                    loginMsg.style.textAlign = 'center';
                    loginMsg.style.marginTop = '10px';
                    sidebar.appendChild(loginMsg);
                }
            }
        }


        // Показ телефону
        const phoneContainer = document.getElementById('publicPhoneContainer');
        if (phoneContainer && user.phone_number) { // `phone_number` буде null, якщо показ приховано
            const phoneLink = document.getElementById('publicPhoneLink');
            if(phoneLink){
                phoneLink.href = `tel:${user.phone_number}`;
                phoneLink.textContent = user.phone_number;
                phoneContainer.style.display = 'flex';
            }
        } else if (phoneContainer) {
            phoneContainer.style.display = 'none'; // Ховаємо, якщо номера немає або приховано
        }


        // Основна інформація
        const profileCityEl = document.getElementById('profileCity');
        if(profileCityEl) profileCityEl.textContent = user.city || 'Не вказано';


        // Розрахунок віку
        const ageSpan = document.getElementById('profileAge');
        if(ageSpan){
            if (user.date_of_birth) {
                try { // Додано try-catch для обробки невалідних дат
                    const birthDate = new Date(user.date_of_birth);
                    // Перевірка, чи дата валідна
                    if (!isNaN(birthDate.getTime())) {
                        const ageDifMs = Date.now() - birthDate.getTime();
                        const ageDate = new Date(ageDifMs);
                        const age = Math.abs(ageDate.getUTCFullYear() - 1970);
                        ageSpan.textContent = `${age} років`;
                    } else {
                        ageSpan.textContent = 'Не вказано';
                    }
                } catch (e) {
                    console.error("Помилка обробки дати народження:", e);
                    ageSpan.textContent = 'Не вказано';
                }
            } else {
                ageSpan.textContent = 'Не вказано';
            }
        }


        const profileBioEl = document.getElementById('profileBio');
        if(profileBioEl) profileBioEl.textContent = user.bio || 'Користувач ще не додав біографію.';

        // Оголошення
        const listingsCountEl = document.getElementById('listingsCount');
        if(listingsCountEl) listingsCountEl.textContent = listings.length;

        const listingsContainer = document.getElementById('userListingsContainer');
        if(listingsContainer) {
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
// 4. ЛОГІКА ФОРМ СТВОРЕННЯ/РЕДАГУВАННЯ ОГОЛОШЕННЯ (ВИПРАВЛЕНО)
// =================================================================================

/**
 * Універсальна функція оновлення стану форми (видимість, required).
 * Приймає посилання на DOM елемент форми.
 */
const updateFormState = (formElement) => {
    if (!formElement) return;

    // --- Отримуємо елементи В МЕЖАХ КОНКРЕТНОЇ ФОРМИ ---
    const roommatePrefs = formElement.querySelector('#roommatePreferences');
    const housingFilters = formElement.querySelector('#housingFilters');
    const listingDetails = formElement.querySelector('#listingDetails');
    const aboutMe = formElement.querySelector('#aboutMe');
    const priceGroup = formElement.querySelector('#priceGroup');
    const addressGroup = formElement.querySelector('#addressGroup');
    const photoGroup = formElement.querySelector('#photoGroup'); // Може бути відсутнім у edit
    const studyConditionsGroup = formElement.querySelector('#studyConditionsGroup');
    const ownerRulesGroup = formElement.querySelector('.ownerRulesGroup');
    const nearbyUniversitiesGroup = formElement.querySelector('.nearbyUniversitiesGroup');
    const studentParams = formElement.querySelector('#studentParams');
    const isStudentGroup = formElement.querySelector('.isStudentGroup'); // Назва класу має бути унікальна або використовувати ID
    const maxOccupantsGroup = formElement.querySelector('#maxOccupantsGroup');
    const findMateGroups = formElement.querySelector('#findMateGroups');
    const myGroupSizeGroup = formElement.querySelector('#myGroupSizeGroup');
    const myGroupCountSelect = formElement.querySelector('#my_group_count');
    const targetRoommatesTotalGroup = formElement.querySelector('#targetRoommatesTotalGroup');
    const petDetailsDiv = formElement.querySelector('#pet_details'); // Для політики щодо тварин
    const photoRequiredIndicator = formElement.querySelector('#photoRequiredIndicator');
    const citySelect = formElement.querySelector('#city'); // Потрібен для університетів

    // Поля, що можуть бути required
    const priceInput = formElement.querySelector('#price');
    const targetPriceMaxInput = formElement.querySelector('#target_price_max');
    const myGenderRadios = formElement.querySelectorAll('input[name="my_gender"]');
    const myAgeInput = formElement.querySelector('#my_age');
    const maxOccupantsSelect = formElement.querySelector('#max_occupants');
    const currentOccupantsSelect = formElement.querySelector('#current_occupants');
    const seekingRoommatesSelect = formElement.querySelector('#seeking_roommates');
    const roomsSelect = formElement.querySelector('#rooms');
    const floorInput = formElement.querySelector('#floor');
    const totalFloorsInput = formElement.querySelector('#total_floors');
    const totalAreaInput = formElement.querySelector('#total_area');
    const kitchenAreaInput = formElement.querySelector('#kitchen_area');
    const furnishingRadios = formElement.querySelectorAll('input[name="furnishing"]');
    // Базові поля (завжди required, крім типу)
    const titleInput = formElement.querySelector('#title');
    const descriptionInput = formElement.querySelector('#description');
    // Тип оголошення (різний спосіб отримання для add/edit)
    let selectedType;
    if (formElement.id === 'addListingForm') {
        selectedType = formElement.querySelector('input[name="listing_type"]:checked')?.value;
    } else if (formElement.id === 'editListingForm') {
        // У редагуванні тип беремо з прихованого поля, бо радіокнопок немає
        selectedType = formElement.querySelector('input[name="listing_type"]')?.value;
    }

    const selectedCity = citySelect?.value;

    // --- Допоміжні функції ---
    const setRequired = (element, isRequired) => {
        if (!element) return;
        if (element instanceof NodeList) element.forEach(el => el.required = isRequired);
        else element.required = isRequired;
    };
    const setVisible = (element, isVisible) => {
        if (element) element.style.display = isVisible ? 'block' : 'none';
    };

    // --- Логіка Університетів (якщо елементи існують у формі) ---
    const universitiesCheckboxesContainer = formElement.querySelector('#nearbyUniversitiesCheckboxes');
    const targetUniversitySelect = formElement.querySelector('#target_university'); // Припускаємо select

    const populateUniversities = (city) => {
        const unis = universitiesData[city] || [];
        if (universitiesCheckboxesContainer) universitiesCheckboxesContainer.innerHTML = '';
        if (targetUniversitySelect) targetUniversitySelect.innerHTML = '<option value="" selected>Будь-який</option><option value="other">Інший (вказати)</option>';

        if (unis.length === 0) {
            if (universitiesCheckboxesContainer) universitiesCheckboxesContainer.innerHTML = '<p style="color: var(--text-light)">Університети для цього міста не вказані.</p>';
            return;
        }

        unis.forEach(uni => {
            if (universitiesCheckboxesContainer) {
                const div = document.createElement('div');
                div.className = 'checkbox-option-item';
                div.innerHTML = `<input type="checkbox" id="uni_${formElement.id}_${uni.value}" name="characteristics" value="${uni.value}"><label for="uni_${formElement.id}_${uni.value}">${uni.text}</label>`;
                universitiesCheckboxesContainer.appendChild(div);
            }
            if (targetUniversitySelect) {
                const option = document.createElement('option');
                option.value = uni.value;
                option.textContent = uni.text;
                targetUniversitySelect.appendChild(option);
            }
        });
        if (targetUniversitySelect) { // Move 'Other' to end
            targetUniversitySelect.appendChild(targetUniversitySelect.querySelector('option[value="other"]'));
        }
    };


    // === Основна логіка ===

    // 1. Скидаємо 'required' для всіх потенційно обов'язкових полів
    [priceInput, targetPriceMaxInput, myAgeInput, maxOccupantsSelect, currentOccupantsSelect,
        seekingRoommatesSelect, roomsSelect, floorInput, totalFloorsInput, totalAreaInput, kitchenAreaInput,
        myGenderRadios, furnishingRadios].forEach(el => setRequired(el, false));

    // 2. Встановлюємо 'required' для базових (крім типу, бо він різний)
    setRequired(titleInput, true);
    setRequired(descriptionInput, true);
    setRequired(citySelect, true);

    // 3. Скидаємо видимість для всіх динамічних блоків
    [roommatePrefs, housingFilters, listingDetails, aboutMe, priceGroup, addressGroup, photoGroup,
        studyConditionsGroup, ownerRulesGroup, nearbyUniversitiesGroup, studentParams, isStudentGroup,
        maxOccupantsGroup, findMateGroups, myGroupSizeGroup, myGroupCountSelect, targetRoommatesTotalGroup]
        .filter(el => el).forEach(el => setVisible(el, false));

    // 4. Налаштування видимості та required залежно від типу
    const isRentOut = selectedType === 'rent_out';
    const isFindMate = selectedType === 'find_mate';
    const isFindHome = selectedType === 'find_home';

    setVisible(photoGroup, true); // Завжди показуємо секцію фото (якщо вона є)
    setVisible(studyConditionsGroup, true); // Завжди показуємо умови навчання

    if (isRentOut || isFindMate) {
        setVisible(priceGroup, true);
        setRequired(priceInput, true);
        setVisible(addressGroup, true); // Адреса для rent_out/find_mate
        setVisible(listingDetails, true);
        setVisible(nearbyUniversitiesGroup, true); // Університети поруч
        if (citySelect) populateUniversities(selectedCity); // Заповнюємо університети
        // Required для rent_out/find_mate (базові + ціна)
        // setRequired(roomsSelect, true); // Зробимо необов'язковими для гнучкості
        // setRequired(floorInput, true);
        // setRequired(totalFloorsInput, true);
        // setRequired(totalAreaInput, true);
        // setRequired(kitchenAreaInput, true); // Може бути 0 для кімнати
        // setRequired(furnishingRadios, true);
    }

    if (isRentOut) {
        setVisible(maxOccupantsGroup, true);
        setVisible(ownerRulesGroup, true); // Правила власника
        // setRequired(maxOccupantsSelect, true); // Необов'язково
    }

    if (isFindMate) {
        setVisible(findMateGroups, true);
        setVisible(aboutMe, true);
        setVisible(roommatePrefs, true);
        setVisible(isStudentGroup, true); // "Чи студент?"
        const isStudent = formElement.querySelector('input[name="is_student"]:checked')?.value;
        setVisible(studentParams, isStudent === 'yes');
        // setRequired(currentOccupantsSelect, true); // Необов'язково
        // setRequired(seekingRoommatesSelect, true); // Необов'язково
        // setRequired(myGenderRadios, true); // Обов'язково
        // setRequired(myAgeInput, true); // Обов'язково
    }

    if (isFindHome) {
        setVisible(housingFilters, true);
        setVisible(aboutMe, true);
        // Вимоги до сусіда показуємо, якщо ready_to_share не 'no'
        const isSharing = formElement.querySelector('input[name="ready_to_share"]:checked')?.value;
        setVisible(roommatePrefs, isSharing !== 'no');
        setVisible(isStudentGroup, true); // "Чи студент?"
        const isStudent = formElement.querySelector('input[name="is_student"]:checked')?.value;
        setVisible(studentParams, isStudent === 'yes');
        setVisible(myGroupSizeGroup, true); // "Скільки людей шукає?"
        const myGroupSize = formElement.querySelector('input[name="my_group_size"]:checked')?.value;
        setVisible(myGroupCountSelect, myGroupSize === 'more');
        setVisible(targetRoommatesTotalGroup, true); // "Бажана к-ть людей у квартирі"
        // Required для find_home (тільки базові)
        // setRequired(targetPriceMaxInput, true); // Необов'язково
        // setRequired(myGenderRadios, true); // Обов'язково
        // setRequired(myAgeInput, true); // Обов'язково
        if (citySelect) populateUniversities(selectedCity); // Заповнюємо університети (для target_university)
    }

    // Оновлення індикатора required для фото (тільки якщо елемент існує)
    if (photoRequiredIndicator) {
        const photoIsRequired = isRentOut || isFindMate;
        photoRequiredIndicator.textContent = photoIsRequired ? '*' : '';
    }
};

/**
 * Налаштовує логіку форми СТВОРЕННЯ оголошення.
 */
const setupAddListingFormLogic = () => {
    const form = document.getElementById('addListingForm');
    if (!form) return;

    // Отримуємо елементи, на які вішаємо слухачі
    const listingTypeRadios = form.querySelectorAll('input[name="listing_type"]');
    const citySelect = form.querySelector('#city');
    const otherOptionSelects = form.querySelectorAll('.other-option-select');
    const petPolicyRadios = form.querySelectorAll('input[name="pet_policy"]');
    const myPetCheckboxes = form.querySelectorAll('#aboutMe input[name="characteristics"][value^="my_pet_"]');
    const myPetNoCheckbox = form.querySelector('#my_pet_no_check');
    const matePetCheckboxes = form.querySelectorAll('#roommatePreferences input[name="characteristics"][value^="mate_"]');
    const matePetNoCheckbox = form.querySelector('#mate_no_pet_check');
    const readyToShareRadios = form.querySelectorAll('input[name="ready_to_share"]');
    const isStudentRadios = form.querySelectorAll('input[name="is_student"]');
    const myGroupSizeRadios = form.querySelectorAll('input[name="my_group_size"]');
    const petDetailsDiv = form.querySelector('#pet_details');

    // --- Логіка подій (викликає зовнішню updateFormState) ---
    const updateHandler = () => updateFormState(form); // Функція-обгортка

    listingTypeRadios.forEach(radio => radio.addEventListener('change', updateHandler));
    citySelect?.addEventListener('change', updateHandler);
    readyToShareRadios?.forEach(radio => radio.addEventListener('change', updateHandler));
    isStudentRadios?.forEach(radio => radio.addEventListener('change', updateHandler));
    myGroupSizeRadios?.forEach(radio => radio.addEventListener('change', updateHandler));

    // Логіка для "Інше" (залишається специфічною для форми)
    otherOptionSelects.forEach(select => {
        select.addEventListener('change', (e) => {
            const otherInput = e.target.nextElementSibling;
            if (otherInput && otherInput.classList.contains('hidden-other-input')) {
                otherInput.style.display = e.target.value === 'other' ? 'block' : 'none';
                if (e.target.value !== 'other') otherInput.value = '';
            }
        });
        // Initial state
        const otherInputInitial = select.nextElementSibling;
        if (otherInputInitial?.classList.contains('hidden-other-input')) {
            otherInputInitial.style.display = select.value === 'other' ? 'block' : 'none';
        }
    });

    // Логіка для Тварин (policy)
    petPolicyRadios?.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (petDetailsDiv) {
                petDetailsDiv.style.display = e.target.value === 'yes' ? 'flex' : 'none';
                if (e.target.value === 'no') {
                    petDetailsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                }
            }
        });
    });
    // Initial state for pet policy
    const initialPetPolicy = form.querySelector('input[name="pet_policy"]:checked');
    if (petDetailsDiv && initialPetPolicy) {
        petDetailsDiv.style.display = initialPetPolicy.value === 'yes' ? 'flex' : 'none';
    }


    // Логіка для чекбоксів "Мої тварини"
    myPetCheckboxes?.forEach(cb => {
        cb.addEventListener('change', () => {
            if (!myPetNoCheckbox) return; // Exit if "No pets" checkbox doesn't exist
            if (cb === myPetNoCheckbox && cb.checked) {
                myPetCheckboxes.forEach(otherCb => { if (otherCb !== myPetNoCheckbox) otherCb.checked = false; });
            } else if (cb !== myPetNoCheckbox && cb.checked && myPetNoCheckbox.checked) {
                myPetNoCheckbox.checked = false;
            }
        });
    });

    // Логіка для чекбоксів "Тварини сусіда"
    matePetCheckboxes?.forEach(cb => {
        cb.addEventListener('change', () => {
            if (!matePetNoCheckbox) return;
            const isPetCheckbox = cb.value.includes('pet'); // Check if it's related to pets
            if (!isPetCheckbox && cb !== matePetNoCheckbox) return; // Ignore non-pet checkboxes (except the 'no pets' one)

            if (cb === matePetNoCheckbox && cb.checked) {
                matePetCheckboxes.forEach(otherCb => {
                    // Uncheck only other pet-related checkboxes
                    if (otherCb !== matePetNoCheckbox && otherCb.value.includes('pet')) otherCb.checked = false;
                });
            } else if (isPetCheckbox && cb.checked && matePetNoCheckbox.checked) {
                // If a specific pet is checked and 'no pets' was checked, uncheck 'no pets'
                matePetNoCheckbox.checked = false;
            }
        });
    });

    // --- Ініціалізація стану форми при завантаженні ---
    updateFormState(form);
    // Ініціалізація карти (заглушка)
    initializeMap(); // Припускаємо, що ця функція теж винесена або доступна
};

/**
 * Налаштовує логіку форми РЕДАГУВАННЯ оголошення.
 */
const setupEditListingFormLogic = () => {
    const form = document.getElementById('editListingForm');
    if (!form) return;

    // Отримуємо елементи, на які вішаємо слухачі (аналогічно add, але без listingTypeRadios)
    const citySelect = form.querySelector('#city');
    const otherOptionSelects = form.querySelectorAll('.other-option-select');
    const petPolicyRadios = form.querySelectorAll('input[name="pet_policy"]');
    const myPetCheckboxes = form.querySelectorAll('#aboutMe input[name="characteristics"][value^="my_pet_"]');
    const myPetNoCheckbox = form.querySelector('#my_pet_no_check');
    const matePetCheckboxes = form.querySelectorAll('#roommatePreferences input[name="characteristics"][value^="mate_"]');
    const matePetNoCheckbox = form.querySelector('#mate_no_pet_check');
    const readyToShareRadios = form.querySelectorAll('input[name="ready_to_share"]');
    const isStudentRadios = form.querySelectorAll('input[name="is_student"]');
    const myGroupSizeRadios = form.querySelectorAll('input[name="my_group_size"]');
    const petDetailsDiv = form.querySelector('#pet_details');

    // --- Логіка подій (викликає зовнішню updateFormState) ---
    const updateHandler = () => updateFormState(form); // Обгортка

    // НЕМАЄ слухача на listingType, бо він не змінюється
    citySelect?.addEventListener('change', updateHandler);
    readyToShareRadios?.forEach(radio => radio.addEventListener('change', updateHandler));
    isStudentRadios?.forEach(radio => radio.addEventListener('change', updateHandler));
    myGroupSizeRadios?.forEach(radio => radio.addEventListener('change', updateHandler));

    // Логіка для "Інше" (копія з add)
    otherOptionSelects.forEach(select => {
        select.addEventListener('change', (e) => {
            const otherInput = e.target.nextElementSibling;
            if (otherInput && otherInput.classList.contains('hidden-other-input')) {
                otherInput.style.display = e.target.value === 'other' ? 'block' : 'none';
                if (e.target.value !== 'other') otherInput.value = '';
            }
        });
        // Initial state
        const otherInputInitial = select.nextElementSibling;
        if (otherInputInitial?.classList.contains('hidden-other-input')) {
            otherInputInitial.style.display = select.value === 'other' ? 'block' : 'none';
        }
    });

    // Логіка для Тварин (policy) (копія з add)
    petPolicyRadios?.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (petDetailsDiv) {
                petDetailsDiv.style.display = e.target.value === 'yes' ? 'flex' : 'none';
                if (e.target.value === 'no') {
                    petDetailsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                }
            }
        });
    });
    // Initial state for pet policy (викликається ПІСЛЯ завантаження даних)
    const initialPetPolicy = form.querySelector('input[name="pet_policy"]:checked');
    if (petDetailsDiv && initialPetPolicy) {
        petDetailsDiv.style.display = initialPetPolicy.value === 'yes' ? 'flex' : 'none';
    }

    // Логіка для чекбоксів "Мої тварини" (копія з add)
    myPetCheckboxes?.forEach(cb => {
        cb.addEventListener('change', () => {
            if (!myPetNoCheckbox) return;
            if (cb === myPetNoCheckbox && cb.checked) {
                myPetCheckboxes.forEach(otherCb => { if (otherCb !== myPetNoCheckbox) otherCb.checked = false; });
            } else if (cb !== myPetNoCheckbox && cb.checked && myPetNoCheckbox.checked) {
                myPetNoCheckbox.checked = false;
            }
        });
    });

    // Логіка для чекбоксів "Тварини сусіда" (копія з add)
    matePetCheckboxes?.forEach(cb => {
        cb.addEventListener('change', () => {
            if (!matePetNoCheckbox) return;
            const isPetCheckbox = cb.value.includes('pet');
            if (!isPetCheckbox && cb !== matePetNoCheckbox) return;

            if (cb === matePetNoCheckbox && cb.checked) {
                matePetCheckboxes.forEach(otherCb => {
                    if (otherCb !== matePetNoCheckbox && otherCb.value.includes('pet')) otherCb.checked = false;
                });
            } else if (isPetCheckbox && cb.checked && matePetNoCheckbox.checked) {
                matePetNoCheckbox.checked = false;
            }
        });
    });

    // --- Ініціалізація стану форми ВИКЛИКАЄТЬСЯ в loadListingDataForEdit ПІСЛЯ заповнення ---
    // updateFormState(form); // НЕ ТУТ
    // Ініціалізація карти (заглушка)
    initializeMap();
};


// --- Заглушка для ініціалізації карти ---
const initializeMap = () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;
    console.log("Map initialization placeholder.");
    mapElement.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-light);">Карта буде тут</p>';
    // Тут має бути реальна логіка карти (Leaflet тощо)
};

// --- Обробка відправки форми СТВОРЕННЯ ---
const handleListingSubmission = async () => {
    const form = document.getElementById('addListingForm');
    const photoInput = document.getElementById('listingPhotosInput');
    const previewContainer = document.getElementById('photoPreviewContainer');
    const submitButton = form?.querySelector('.submit-listing-btn');
    const photoErrorHint = form?.querySelector('#photoErrorHint');
    const listingTypeHint = form?.querySelector('#listingTypeHint'); // Hint for listing type

    if (!form || !photoInput || !previewContainer || !submitButton || !photoErrorHint || !listingTypeHint) {
        console.error("One or more elements for add listing form not found.");
        return;
    }

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб додати оголошення.');
        window.location.href = 'login.html';
        return;
    }

    let selectedFiles = []; // Масив файлів
    const MAX_PHOTOS = 8;

    // --- Функції для керування фото (винесені) ---
    const updatePhotoDisplay = () => {
        if (!previewContainer) return;
        previewContainer.innerHTML = ''; // Очищуємо контейнер
        for (let i = 0; i < MAX_PHOTOS; i++) {
            const div = document.createElement('div');
            div.className = 'photo-upload-placeholder';
            div.dataset.index = i;

            if (i < selectedFiles.length) {
                // Показуємо прев'ю
                const file = selectedFiles[i];
                const reader = new FileReader();
                reader.onload = (e) => {
                    div.classList.add('preview');
                    div.style.backgroundImage = `url('${e.target.result}')`;
                    // Кнопка видалення
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'photo-delete-btn';
                    deleteBtn.innerHTML = '&times;';
                    deleteBtn.title = 'Видалити фото';
                    deleteBtn.type = 'button';
                    deleteBtn.onclick = (event) => { event.stopPropagation(); removeFile(i); };
                    div.appendChild(deleteBtn);
                    // Мітка "Головне"
                    if (i === 0) {
                        const mainLabel = document.createElement('span');
                        mainLabel.className = 'photo-main-label';
                        mainLabel.textContent = 'Головне';
                        div.appendChild(mainLabel);
                        div.title = 'Головне фото';
                    }
                }
                reader.readAsDataURL(file);
            } else if (i === selectedFiles.length) {
                // Кнопка "Додати"
                div.classList.add('add-photo-btn');
                div.innerHTML = '+ Додати фото';
                div.onclick = triggerFileInput;
            } else {
                // Порожній слот
            }
            previewContainer.appendChild(div);
        }
    };

    const removeFile = (indexToRemove) => {
        selectedFiles.splice(indexToRemove, 1);
        photoInput.value = null; // Reset input to allow re-selection
        updatePhotoDisplay();
    };

    window.triggerFileInput = () => photoInput.click(); // Make global

    photoInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (!files) return;
        const currentCount = selectedFiles.length;
        const availableSlots = MAX_PHOTOS - currentCount;
        const filesToAddCount = Math.min(files.length, availableSlots);

        if (files.length > availableSlots && availableSlots > 0) alert(`Ви можете додати ще ${availableSlots} фото.`);
        else if (availableSlots <= 0) alert(`Ви вже додали максимальну кількість фото (${MAX_PHOTOS}).`);

        for (let i = 0; i < filesToAddCount; i++) selectedFiles.push(files[i]);
        photoInput.value = null; // Reset input
        updatePhotoDisplay();
    });

    // --- Обробник відправки ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        listingTypeHint.style.display = 'none'; // Сховати підказку типу

        // --- Валідація ---
        const selectedTypeRadio = form.querySelector('input[name="listing_type"]:checked');
        if (!selectedTypeRadio) {
            listingTypeHint.style.display = 'block';
            listingTypeHint.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return; // Зупинити, якщо тип не вибрано
        }
        const selectedType = selectedTypeRadio.value;
        const photoIsRequired = selectedType === 'rent_out' || selectedType === 'find_mate';
        let isPhotoValid = true;
        photoErrorHint.style.display = 'none';
        if (photoIsRequired && selectedFiles.length === 0) {
            photoErrorHint.style.display = 'block';
            photoGroup?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            isPhotoValid = false;
        }
        if (!form.checkValidity() || !isPhotoValid) {
            alert('Будь ласка, заповніть усі обов\'язкові поля (*), відмічені червоним, та додайте фото, якщо потрібно.');
            const firstInvalid = form.querySelector(':invalid:not(fieldset)'); // Avoid focusing fieldset
            firstInvalid?.focus();
            firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        // --- Кінець валідації ---

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        delete data.photos; // Видаляємо поле файлів з текстових даних

        // Збір характеристик (з обох груп)
        const characteristics = formData.getAll('characteristics');
        const searchCharacteristics = formData.getAll('search_characteristics');
        const allCharacteristics = [...characteristics, ...searchCharacteristics].filter(key => key && !key.includes('_no')); // Фільтр "no" ключів
        data.characteristics = [...new Set(allCharacteristics)]; // Унікальні
        delete data.search_characteristics;

        // Обробка полів "Інше"
        form.querySelectorAll('.other-option-select').forEach(select => {
            const baseName = select.name;
            const otherInputName = `${baseName}_other`;
            if (data[baseName] !== 'other') data[otherInputName] = null; // Очистити, якщо не "Інше"
        });

        submitButton.disabled = true;
        submitButton.textContent = 'Публікація...';
        let listingId; // Оголошуємо тут

        try {
            // 1. Створюємо оголошення (текстові дані)
            const listingResponse = await fetch('http://localhost:3000/api/listings', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            });

            if (!listingResponse.ok) {
                // Обробка помилок створення оголошення
                if (listingResponse.status === 401 || listingResponse.status === 403) throw new Error('AuthError');
                const errorData = await listingResponse.json();
                throw new Error(errorData.error || 'Не вдалося створити оголошення');
            }

            const listingResult = await listingResponse.json();
            listingId = listingResult.listingId; // Отримуємо ID
            console.log(`Listing created, ID: ${listingId}`);

            // 2. Завантажуємо фото (ЯКЩО вони є і ID отримано)
            if (selectedFiles.length > 0 && listingId) {
                console.log(`Uploading ${selectedFiles.length} photos for listing ${listingId}...`);
                const photoFormData = new FormData();
                selectedFiles.forEach(file => photoFormData.append('photos', file));

                const photoResponse = await fetch(`http://localhost:3000/api/upload/listing-photos/${listingId}`, {
                    method: 'POST',
                    headers: getAuthHeaders(false), // isJson = false
                    body: photoFormData,
                });

                if (!photoResponse.ok) {
                    const errorData = await photoResponse.json();
                    // Повідомляємо користувача, але не перериваємо процес, бо оголошення вже створено
                    alert(`Оголошення створено, але сталася помилка при завантаженні фото: ${errorData.error || 'Невідома помилка'}. Ви можете додати фото пізніше, відредагувавши оголошення.`);
                    console.error('Photo upload error:', errorData);
                    // НЕ кидаємо помилку тут, щоб перейти до успішного завершення
                } else {
                    const photoResult = await photoResponse.json();
                    console.log(photoResult.message);
                }
            }

            // 3. Успішне завершення
            alert(`Успіх! ${listingResult.message} (ID: ${listingId})`);
            form.reset();
            selectedFiles = [];
            updatePhotoDisplay();
            updateFormState(form); // Оновити стан форми після reset
            window.location.href = `listing_detail.html?id=${listingId}`; // Перехід на сторінку оголошення

        } catch (error) {
            console.error('Submission error:', error);
            if (error.message === 'AuthError') {
                alert('Помилка автентифікації. Будь ласка, увійдіть знову.');
                window.location.href = 'login.html';
            } else {
                alert(`Помилка: ${error.message}`);
            }
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Опублікувати оголошення';
        }
    });

    // Ініціалізація фото та стану форми
    updatePhotoDisplay();
    updateFormState(form);
};

// --- Обробка відправки форми РЕДАГУВАННЯ ---
const handleListingUpdateSubmission = async () => {
    const form = document.getElementById('editListingForm');
    const submitButton = form?.querySelector('.submit-listing-btn');
    const photoInput = document.getElementById('listingPhotosInput'); // Для завантаження нових фото
    const previewContainer = document.getElementById('photoPreviewContainer'); // Для відображення

    if (!form || !submitButton) return;
    if (!MY_USER_ID) { /* ... перевірка логіну ... */ return; }

    let currentPhotos = []; // { photo_id, image_url, is_main }
    let photosToDelete = new Set(); // photo_id для видалення
    let newFilesToUpload = []; // File об'єкти нових фото
    const MAX_PHOTOS = 8;

    // --- Функції для керування фото в редагуванні (винесені) ---
    const updateEditPhotoDisplay = () => {
        if (!previewContainer) return;
        previewContainer.innerHTML = '';
        const totalSlots = currentPhotos.length + newFilesToUpload.length;

        // Відображення існуючих фото (крім видалених)
        currentPhotos.forEach((photo, index) => {
            if (photosToDelete.has(photo.photo_id)) return; // Пропустити видалені

            const div = document.createElement('div');
            div.className = 'photo-upload-placeholder preview';
            div.style.backgroundImage = `url('${photo.image_url}')`;
            div.dataset.index = index; // Зберігаємо індекс поточного фото

            // Кнопка видалення для ІСНУЮЧИХ
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'photo-delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Видалити фото';
            deleteBtn.type = 'button';
            deleteBtn.onclick = (event) => { event.stopPropagation(); removeExistingPhoto(photo.photo_id, div); };
            div.appendChild(deleteBtn);

            // Мітка "Головне" (якщо потрібно)
            if (photo.is_main || (!currentPhotos.some(p => p.is_main) && index === 0 && newFilesToUpload.length === 0)) { // Логіка головного фото
                const mainLabel = document.createElement('span');
                mainLabel.className = 'photo-main-label';
                mainLabel.textContent = 'Головне';
                div.appendChild(mainLabel);
                div.title = 'Головне фото';
            }
            previewContainer.appendChild(div);
        });

        // Відображення НОВИХ фото
        newFilesToUpload.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'photo-upload-placeholder preview';
            div.dataset.newIndex = index; // Зберігаємо індекс нового файлу

            const reader = new FileReader();
            reader.onload = (e) => div.style.backgroundImage = `url('${e.target.result}')`;
            reader.readAsDataURL(file);

            // Кнопка видалення для НОВИХ
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'photo-delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Скасувати завантаження';
            deleteBtn.type = 'button';
            deleteBtn.onclick = (event) => { event.stopPropagation(); removeNewFile(index); };
            div.appendChild(deleteBtn);

            // Мітка "Головне", якщо це перше фото взагалі
            if (currentPhotos.filter(p => !photosToDelete.has(p.photo_id)).length === 0 && index === 0) {
                const mainLabel = document.createElement('span');
                mainLabel.className = 'photo-main-label';
                mainLabel.textContent = 'Головне';
                div.appendChild(mainLabel);
            }
            previewContainer.appendChild(div);
        });

        // Кнопка "Додати фото", якщо є місце
        if (totalSlots < MAX_PHOTOS) {
            const addButton = document.createElement('div');
            addButton.className = 'photo-upload-placeholder add-photo-btn';
            addButton.innerHTML = '+ Додати фото';
            addButton.onclick = triggerEditFileInput;
            previewContainer.appendChild(addButton);
        }

        // Заповнюємо решту слотів порожніми плейсхолдерами, якщо потрібно
        for (let i = totalSlots + (totalSlots < MAX_PHOTOS ? 1 : 0); i < MAX_PHOTOS; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'photo-upload-placeholder';
            previewContainer.appendChild(emptyDiv);
        }
    };

    const removeExistingPhoto = (photoId, element) => {
        photosToDelete.add(photoId);
        element.style.display = 'none'; // Просто ховаємо елемент
        updateEditPhotoDisplay(); // Перемальовуємо, щоб з'явилась кнопка "+"
    };

    const removeNewFile = (indexToRemove) => {
        newFilesToUpload.splice(indexToRemove, 1);
        if (photoInput) photoInput.value = null;
        updateEditPhotoDisplay();
    };

    window.triggerEditFileInput = () => { if (photoInput) photoInput.click(); }; // Глобальна

    if (photoInput) {
        photoInput.addEventListener('change', (event) => {
            const files = event.target.files;
            if (!files) return;

            const currentVisibleCount = currentPhotos.length - photosToDelete.size + newFilesToUpload.length;
            const availableSlots = MAX_PHOTOS - currentVisibleCount;
            const filesToAddCount = Math.min(files.length, availableSlots);

            if (files.length > availableSlots && availableSlots > 0) alert(`Ви можете додати ще ${availableSlots} фото.`);
            else if (availableSlots <= 0) alert(`Ви вже додали максимальну кількість фото (${MAX_PHOTOS}).`);

            for (let i = 0; i < filesToAddCount; i++) newFilesToUpload.push(files[i]);
            photoInput.value = null;
            updateEditPhotoDisplay();
        });
    }

    // --- Обробник відправки ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const listingId = document.getElementById('listingIdField')?.value;
        if (!listingId) { /* ... обробка помилки ID ... */ return; }

        // Валідація (включаючи HTML5 required)
        if (!form.checkValidity()) {
            alert('Будь ласка, заповніть усі обов\'язкові поля (*), відмічені червоним.');
            const firstInvalid = form.querySelector(':invalid:not(fieldset)');
            firstInvalid?.focus();
            firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        delete data.photos;
        delete data.listing_id;

        // Збір характеристик
        const characteristics = formData.getAll('characteristics');
        const searchCharacteristics = formData.getAll('search_characteristics');
        const allCharacteristics = [...characteristics, ...searchCharacteristics].filter(key => key && !key.includes('_no'));
        data.characteristics = [...new Set(allCharacteristics)];
        delete data.search_characteristics;

        // Обробка полів "Інше"
        form.querySelectorAll('.other-option-select').forEach(select => {
            const baseName = select.name;
            const otherInputName = `${baseName}_other`;
            if (data[baseName] !== 'other') data[otherInputName] = null;
        });

        submitButton.disabled = true;
        submitButton.textContent = 'Збереження...';

        try {
            // 1. Оновлюємо текстові дані
            const listingResponse = await fetch(`http://localhost:3000/api/listings/${listingId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            });

            if (!listingResponse.ok) {
                if (listingResponse.status === 401 || listingResponse.status === 403) throw new Error('AuthError');
                const errorData = await listingResponse.json();
                throw new Error(errorData.error || 'Не вдалося оновити дані оголошення');
            }
            console.log('Listing data updated successfully.');

            // --- ОБРОБКА ФОТО ---
            // 2. Видаляємо позначені фото
            if (photosToDelete.size > 0) {
                console.log(`Deleting ${photosToDelete.size} photos...`);
                // ПОТРІБЕН БЕКЕНД ЕНДПОІНТ для видалення фото (наприклад, DELETE /api/listings/:id/photos з масивом ID в тілі)
                // Приклад запиту (потрібно реалізувати на бекенді):
                /*
                const deleteResponse = await fetch(`http://localhost:3000/api/listings/${listingId}/photos`, {
                    method: 'DELETE',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ photoIds: Array.from(photosToDelete) })
                });
                if (!deleteResponse.ok) console.error("Failed to delete photos on backend.");
                else photosToDelete.clear(); // Очистити сет після успішного видалення
                */
                console.warn("Backend endpoint for photo deletion is not implemented yet."); // Заглушка
            }

            // 3. Завантажуємо нові фото
            if (newFilesToUpload.length > 0) {
                console.log(`Uploading ${newFilesToUpload.length} new photos...`);
                const photoFormData = new FormData();
                newFilesToUpload.forEach(file => photoFormData.append('photos', file));

                const photoResponse = await fetch(`http://localhost:3000/api/upload/listing-photos/${listingId}`, {
                    method: 'POST',
                    headers: getAuthHeaders(false),
                    body: photoFormData,
                });

                if (!photoResponse.ok) {
                    const errorData = await photoResponse.json();
                    alert(`Дані оголошення оновлено, але виникла помилка при завантаженні нових фото: ${errorData.error || 'Невідома помилка'}`);
                    console.error('New photo upload error:', errorData);
                    // Не перериваємо, бо текстові дані збережено
                } else {
                    console.log("New photos uploaded successfully.");
                    newFilesToUpload = []; // Очистити масив після успішного завантаження
                }
            }
            // --- КІНЕЦЬ ОБРОБКИ ФОТО ---

            alert('Успіх! Оголошення оновлено.');
            window.location.href = `listing_detail.html?id=${listingId}`; // Перехід на сторінку деталей

        } catch (error) {
            console.error('Update error:', error);
            if (error.message === 'AuthError') {
                alert('Помилка автентифікації або доступу. Будь ласка, увійдіть знову.');
                window.location.href = 'login.html';
            } else {
                alert(`Помилка: ${error.message}`);
            }
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Зберегти зміни';
        }
    });

    // Повертаємо функцію для завантаження початкових фото
    return {
        loadInitialPhotos: (photos) => {
            currentPhotos = photos || [];
            updateEditPhotoDisplay();
        }
    };
};

// =================================================================================
// 5. ГОЛОВНИЙ ВИКОНАВЧИЙ БЛОК (РОУТЕР)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        await loadNavigation(); // Завантажуємо навігацію
        await fetchFavoriteIds(); // Завантажуємо ID обраних
        setupSocketIO(); // Ініціалізуємо сокети

        const path = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('id'); // ID для detail та edit

        // Головна сторінка
        if (path.endsWith('/') || path.endsWith('index.html')) {
            fetchAndDisplayListings('listing_type!=find_home'); // Default view
            setupHomepageLogic();
        }
        // Реєстрація
        else if (path.endsWith('register.html')) { handleRegistration(); }
        // Вхід
        else if (path.endsWith('login.html')) { handleLogin(); }
        // Створення оголошення
        else if (path.endsWith('add_listing.html')) {
            setupAddListingFormLogic();
            handleListingSubmission();
        }
        // Редагування оголошення
        else if (path.endsWith('edit_listing.html')) {
            if (!listingId) { /* ... обробка помилки ID ... */ window.location.href = 'my_listings.html'; }
            else if (!MY_USER_ID) { /* ... обробка неавторизованого ... */ window.location.href = 'login.html'; }
            else {
                const editFormHandler = await handleListingUpdateSubmission(); // Отримуємо об'єкт з функцією
                // Спочатку завантажуємо дані, а потім викликаємо loadInitialPhotos
                await loadListingDataForEdit('editListingForm', listingId, editFormHandler.loadInitialPhotos);
                // loadInitialPhotos буде викликано всередині loadListingDataForEdit, коли дані будуть готові
            }
        }
        // Деталі оголошення
        else if (path.endsWith('listing_detail.html')) { await fetchAndDisplayListingDetail(); }
        // Мій профіль
        else if (path.endsWith('profile.html')) {
            await loadProfileData();
            setupProfileEventListeners();
        }
        // Мої оголошення
        else if (path.endsWith('my_listings.html')) { await fetchAndDisplayMyListings(); }
        // Чат
        else if (path.endsWith('chat.html')) {
            if (!MY_USER_ID) { /* ... обробка неавторизованого ... */ window.location.href = 'login.html'; }
            else {
                await loadConversations();
                handleMessageSend();
                await handleChatUrlParams(); // Перевірка URL параметрів
            }
        }
        // Налаштування
        else if (path.endsWith('settings.html')) {
            await loadSettingsData();
            handleSettingsSubmission();
            // Обробник видалення акаунту
            document.getElementById('btnDeleteAccount')?.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!confirm('Ви *справді* хочете видалити свій акаунт? Цю дію неможливо скасувати.')) return;
                const userPassword = prompt('Будь ласка, введіть ваш поточний пароль для підтвердження:');
                if (!userPassword) { alert('Видалення скасовано.'); return; }
                const deleteButton = e.target;
                deleteButton.disabled = true;
                deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Видалення...';
                try {
                    const response = await fetch('http://localhost:3000/api/profile', {
                        method: 'DELETE',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ password: userPassword })
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Невідома помилка');
                    }
                    alert('Ваш акаунт було успішно видалено.');
                    removeToken();
                    window.location.href = 'index.html';
                } catch (error) {
                    alert(`Помилка видалення: ${error.message}`);
                    deleteButton.disabled = false;
                    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> Видалити мій акаунт';
                }
            });
        }
        // Налаштування логіну/паролю
        else if (path.endsWith('login_settings.html')) { handleLoginSettings(); }
        // Публічний профіль
        else if (path.endsWith('user_profile.html')) { await loadPublicProfileData(); }
        // Обране
        else if (path.endsWith('favorites.html')) { await fetchAndDisplayFavorites(); }

    })(); // Само_викликаюча асинхронна функція
});
