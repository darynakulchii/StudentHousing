// =================================================================================
// 0. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ АВТЕНТИФІКАЦІЇ
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

// Функція для відкриття/закриття фільтрів
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

// Функція для відкриття/закриття сповіщень
const toggleNotifications = (action) => {
    if (!notificationSidebar || !overlay) return;
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

// Керує посиланнями "Вхід" / "Вихід" та Аватаром
const setupNavLinks = () => {
    const isLoggedIn = !!getToken(); // Перевіряємо, чи є токен

    const navLoginLink = document.getElementById('navLoginLink');
    const navRegisterLink = document.getElementById('navRegisterLink');
    const navProfileLink = document.getElementById('navProfileLink');
    const navLogoutLink = document.getElementById('navLogoutLink');
    const userAvatar = document.querySelector('.user-avatar');

    if (userAvatar) {
        userAvatar.style.display = 'block';
        userAvatar.href = isLoggedIn ? 'profile.html' : 'login.html';
    }

    // *** ЗМІНА ТУТ ***
    // 1. Кнопка "Увійти" тепер ЗАВЖДИ видима
    if (navLoginLink) navLoginLink.style.display = 'block';

    if (isLoggedIn) {
        // --- Користувач ЗАЛОГІНЕНИЙ ---
        // (Кнопка "Увійти" вже видима)
        if (navRegisterLink) navRegisterLink.style.display = 'none';
        if (navProfileLink) navProfileLink.style.display = 'block';
        if (navLogoutLink) navLogoutLink.style.display = 'block';

        if (navLogoutLink) {
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
        // (Кнопка "Увійти" вже видима)
        if (navRegisterLink) navRegisterLink.style.display = 'block';
        if (navProfileLink) navProfileLink.style.display = 'none';
        if (navLogoutLink) navLogoutLink.style.display = 'none';
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

        // ІНІЦІАЛІЗАЦІЯ ЕЛЕМЕНТІВ (після завантаження)
        mobileMenuWindow = document.getElementById('mobileMenuWindow');
        filterSidebar = document.getElementById('filterSidebar');
        notificationSidebar = document.getElementById('notificationSidebar');
        overlay = document.getElementById('overlay');
        notificationBadge = document.getElementById('notificationBadge');

        // Налаштування посилань
        highlightActiveLink(isPage);
        setupNavLinks(); // ВИКЛИК ОНОВЛЕНОЇ ФУНКЦІЇ

        // Налаштування сповіщень
        currentNotificationCount = 2;
        updateNotificationCount(currentNotificationCount);

        // Налаштування слухачів подій
        document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => toggleMenu('open'));
        document.getElementById('btnCloseMenu')?.addEventListener('click', () => toggleMenu('close'));

        document.querySelector('.notification-icon-container')?.addEventListener('click', () => toggleNotifications('open'));
        document.getElementById('btnCloseNotifications')?.addEventListener('click', () => toggleNotifications('close'));

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
// 4. ОСНОВНИЙ БЛОК DOMContentLoaded (ЄДИНИЙ!)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        // 0. ЗАВЖДИ ЗАВАНТАЖУЄМО НАВІГАЦІЮ СПОЧАТКУ
        await loadNavigation();

        // 1. Визначаємо поточну сторінку
        const path = window.location.pathname;

        // 2. ЗАПУСКАЄМО ЛОГІКУ ДЛЯ КОНКРЕТНИХ СТОРІНОК

        if (path.endsWith('index.html') || path.endsWith('/')) {
            await fetchAndDisplayListings();
            setupActionButtons(); // Налаштування кнопок "Всі оголошення", "Шукаю житло"
            setupSearchAndFilters(); // Налаштування логіки фільтрів
        }

        if (path.endsWith('register.html')) {
            await handleRegistration();
        }

        if (path.endsWith('login.html')) {
            await handleLogin();
        }

        if (path.endsWith('add_listing.html')) {
            await handleListingSubmission();
        }

        if (path.endsWith('listing_detail.html')) {
            await fetchAndDisplayListingDetail();
        }

        // ЛОГІКА ДЛЯ PROFILE.HTML
        if (path.endsWith('profile.html')) {
            if (!MY_USER_ID) {
                alert('Будь ласка, увійдіть, щоб переглянути свій профіль.');
                window.location.href = 'login.html';
                return; // Важливо зупинити виконання
            }
            await loadProfileData();
            setupProfileEventListeners();
        }

        // ЛОГІКА ДЛЯ CHAT.HTML
        if (path.endsWith('chat.html')) {
            if (!MY_USER_ID) {
                alert('Будь ласка, увійдіть, щоб переглянути повідомлення.');
                window.location.href = 'login.html';
                return; // Важливо зупинити виконання
            }
            await loadConversations();
            handleMessageSend();

            // 3. ЗАПУСКАЄМО SOCKET.IO (тільки на сторінці чату)
            setupSocketIO();
        }

    })();
});

// =================================================================================
// 5. ЛОГІКА ДОДАВАННЯ ОГОЛОШЕННЯ
// =================================================================================

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

        // 1. Використовуємо Object.fromEntries для більшості полів
        // Це автоматично збереже пари ключ/значення для title, price, my_age тощо.
        const data = Object.fromEntries(formData.entries());

        // 2. Отримуємо ВСІ значення для обох типів характеристик
        const characteristics = formData.getAll('characteristics');
        const searchCharacteristics = formData.getAll('search_characteristics');

        // 3. Об'єднуємо їх в один масив 'characteristics', як очікує бекенд
        // (також фільтруємо "my_pet_no" та "mate_no_pet", якщо вони не потрібні в БД)
        const allCharacteristics = [...characteristics, ...searchCharacteristics].filter(key => {
            return key !== 'my_pet_no' && key !== 'mate_no_pet';
        });

        data.characteristics = allCharacteristics;

        // 4. Видаляємо 'search_characteristics', щоб не плутати бекенд
        delete data.search_characteristics;

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

// =================================================================================
// 6. ЛОГІКА ЗАВАНТАЖЕННЯ ОГОЛОШЕНЬ (ДЛЯ index.html)
// =================================================================================

const fetchAndDisplayListings = async () => {
    const container = document.querySelector('.listings-container');
    if (!container) return;

    try {
        const response = await fetch('http://localhost:3000/api/listings');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const listings = await response.json();
        container.innerHTML = '';

        if (listings.length === 0) {
            container.innerHTML = '<p style="color: var(--text-light);">Наразі активних оголошень немає.</p>';
            return;
        }

        listings.forEach(listing => {
            const imageUrl = listing.main_photo_url || 'https://picsum.photos/400/300?random=' + listing.listing_id;
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

        let characteristicsHTML = '';
        if (listing.characteristics.length > 0) {
            characteristicsHTML = listing.characteristics
                .map(char => `<span class="char-tag">${char.name_ukr}</span>`)
                .join('');
        } else {
            characteristicsHTML = '<p>Характеристики не вказані.</p>';
        }

        const contactButtonHTML = (MY_USER_ID === listing.user_id)
            ? `<a href="profile.html" class="contact-btn" style="background: #7f8c8d;">
                 <i class="fas fa-user-edit"></i> Це ваше оголошення
               </a>`
            : `<a href="chat.html?user_id=${listing.user_id}" class="contact-btn">
                 <i class="fas fa-comment-dots"></i> Зв'язатись з автором
               </a>`;

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

// =================================================================================
// 8. ЛОГІКА РЕЄСТРАЦІЇ КОРИСТУВАЧА
// =================================================================================

const handleRegistration = async () => {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });

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

// =================================================================================
// 9. ЛОГІКА ЛОГІНУ
// =================================================================================

const handleLogin = async () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Ця перевірка тепер необов'язкова, оскільки кнопка "Увійти"
    // буде видима, але якщо користувач зайде на login.html напряму,
    // його варто перенаправити в профіль.
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
                setToken(result.token);
                alert(`Вітаємо, ${result.user.first_name}!`);
                window.location.href = 'index.html';
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
// 10. ЛОГІКА ЧАТУ
// =================================================================================

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
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light; margin: auto;">Завантаження...</p>';

    try {
        const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}/messages`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) throw new Error('Помилка доступу до чату');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const messages = await response.json();
        messagesArea.innerHTML = '';

        if (messages.length === 0) {
            messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light; margin: auto;">Повідомлень ще немає.</p>';
            return;
        }

        messages.forEach(msg => appendMessage(msg));
        messagesArea.scrollTop = messagesArea.scrollHeight;

    } catch (error) {
        console.error('Помилка завантаження повідомлень:', error);
        messagesArea.innerHTML = `<p style="color: red; margin: auto;">Помилка завантаження. ${error.message}</p>`;
    }
};

const appendMessage = (msg) => {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;

    if(messagesArea.querySelector('p')) {
        messagesArea.innerHTML = '';
    }

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

// =================================================================================
// 11. ЛОГІКА СТОРІНКИ ПРОФІЛЮ
// =================================================================================

const loadProfileData = async () => {
    try {
        const response = await fetch('http://localhost:3000/api/profile', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Не вдалося завантажити дані профілю. Спробуйте увійти знову.');
        }

        const user = await response.json();

        // Допоміжна функція для безпечного встановлення значення
        const setInputValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = value || '';
            } else {
                console.warn(`Елемент з ID '${id}' не знайдено на сторінці профілю.`);
            }
        };

        // Заповнюємо поля форми
        setInputValue('profile_first_name', user.first_name);
        setInputValue('profile_last_name', user.last_name);
        setInputValue('profile_email', user.email);
        setInputValue('profile_city', user.city);

        // Форматування дати
        if (user.date_of_birth) {
            setInputValue('profile_date', user.date_of_birth.split('T')[0]);
        }

        // *** ВИПРАВЛЕННЯ ТУТ ***
        setInputValue('habits-select', user.habits); // Використовуємо 'habits-select'
        setInputValue('profile_bio', user.bio);

        // Оновлюємо аватар та ім'я в бічній панелі
        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarName = document.getElementById('profileAvatarName');

        if (avatarImg) {
            avatarImg.src = user.avatar_url || 'https://i.pinimg.com/736x/20/8e/8f/208e8f23b4ffbab9da6212c9c33fa53b.jpg';
        }
        if (avatarName) {
            avatarName.textContent = `${user.first_name || ''} ${user.last_name || ''}`;
        }

    } catch (error) {
        console.error('Помилка завантаження профілю:', error);
        alert(error.message);
        window.location.href = 'login.html'; // Повертаємо на логін, якщо помилка
    }
};

const setupProfileEventListeners = () => {
    // 1. Обробка форми "Зберегти зміни"
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            const data = Object.fromEntries(formData.entries());

            // Видаляємо поля, яких немає в БД
            delete data.phone;
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

                // Оновлюємо ім'я в бічній панелі
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

    // 2. Обробка кнопки "Вийти" (в бічному меню профілю)
    const logoutButton = document.getElementById('btnLogout');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            removeToken(); // Видаляємо токен з localStorage
            alert('Ви вийшли з системи.');
            window.location.href = 'index.html'; // Перенаправляємо на головну
        });
    }

    // 3. Обробка інших кнопок (заглушки)
    const myListingsBtn = document.getElementById('btnMyListings');
    if (myListingsBtn) {
        myListingsBtn.addEventListener('click', () => {
            alert('Сторінка "Мої оголошення" в розробці.');
            // TODO: window.location.href = 'my_listings.html';
        });
    }

    const loginPasswordBtn = document.getElementById('btnLoginPassword');
    if (loginPasswordBtn) {
        loginPasswordBtn.addEventListener('click', () => {
            alert('Розділ "Зміна логіну та пароля" в розробці.');
            // TODO: Показати модальне вікно або нову форму
        });
    }
};

// =================================================================================
// 12. ЛОГІКА ДЛЯ ІНШИХ СТОРІНОК (наприклад, index.html)
// =================================================================================

// Налаштування пошуку та фільтрів
const setupSearchAndFilters = () => {
    const searchInput = document.querySelector('.search-input');
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') console.log('Пошук за запитом:', searchInput.value);
    });

    const filtersForm = document.querySelector('.filters-form');
    if (!filtersForm) return;

    const priceInput = document.getElementById('price');
    const priceValueSpan = document.getElementById('priceValue');

    if (priceInput && priceValueSpan) {
        priceValueSpan.innerText = priceInput.value;
        priceInput.addEventListener('input', () => {
            priceValueSpan.innerText = priceInput.value;
        });
    }

    filtersForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(filtersForm);
        const filters = {};
        formData.getAll('characteristics').forEach(value => {
            filters['characteristics'] = filters['characteristics'] || [];
            filters['characteristics'].push(value);
        });
        for (const [key, value] of formData.entries()) {
            if (key !== 'characteristics') filters[key] = value;
        }
        console.log('Застосовано фільтри:', filters);
        alert('Фільтри застосовано! Результати у консолі.');
        toggleFilters('close');
    });

    filtersForm.querySelector('.reset-filters-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        filtersForm.reset();
        if (priceInput && priceValueSpan) {
            priceValueSpan.innerText = priceInput.max;
        }
        console.log('Фільтри скинуто');
    });
};

// Налаштування кнопок дій
const setupActionButtons = () => {
    const actionButtons = document.querySelectorAll('.main-actions-menu .action-btn');
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            actionButtons.forEach(btn => btn.classList.remove('active-action'));
            button.classList.add('active-action');
            const actionType = button.getAttribute('data-type');
            console.log('Обрана дія:', actionType);
        });
    });
};

// =================================================================================
// 13. ЛОГІКА SOCKET.IO КЛІЄНТА
// =================================================================================

const setupSocketIO = () => {
    // Ця функція викликається з DOMContentLoaded,
    // тому нам не потрібна перевірка pathname або MY_USER_ID тут

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

    // Слухати нові повідомлення
    socket.on('receive_message', (newMessage) => {
        console.log('Отримано нове повідомлення:', newMessage);

        if (newMessage.conversation_id.toString() === currentOpenConversationId) {
            appendMessage(newMessage);
            const messagesArea = document.getElementById('messagesArea');
            if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
        } else {
            // Показати сповіщення
            console.log("Нове повідомлення в іншому чаті!");
            currentNotificationCount++;
            updateNotificationCount(currentNotificationCount);
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket.io відключено');
    });
};