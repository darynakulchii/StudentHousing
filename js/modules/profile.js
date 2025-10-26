// =================================================================================
// PROFILE MODULE
// =================================================================================

import { getAuthHeaders, MY_USER_ID, removeToken } from './auth.js';
import { setupNavLinks, DEFAULT_AVATAR_URL } from './navigation.js';
import {DEFAULT_LISTING_IMAGE} from "../app.js";

/**
 * Завантажує дані профілю для форми.
 */
export const loadProfileData = async () => {
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

/**
 * Завантажує фото аватара на сервер.
 */
export const handleAvatarUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const editIcon = document.querySelector('.edit-icon');
        if (editIcon) editIcon.textContent = '⏳';

        const response = await fetch('http://localhost:3000/api/upload/avatar', {
            method: 'POST',
            headers: getAuthHeaders(false),
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося завантажити аватар');
        }

        const result = await response.json();
        alert(result.message);

        const avatarImg = document.getElementById('profileAvatarImg');
        if (avatarImg) avatarImg.src = result.avatarUrl;
        await setupNavLinks(); // Оновлюємо аватар в хедері

    } catch (error) {
        console.error('Помилка завантаження аватара:', error);
        alert(`Помилка: ${error.message}`);
    } finally {
        const editIcon = document.querySelector('.edit-icon');
        if (editIcon) editIcon.textContent = '✎';
    }
};

/**
 * Налаштовує слухачі подій для сторінки профілю (форма, кнопки).
 */
export const setupProfileEventListeners = () => {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            // Дані ТІЛЬКИ з форми
            const dataFromForm = Object.fromEntries(formData.entries());

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
            if (confirm('Ви впевнені, що хочете вийти з облікового запису?')) {
                removeToken();
                alert('Ви вийшли з системи.');
                window.location.href = 'index.html';
            }
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

/**
 * Завантажує дані для сторінки налаштувань.
 */
export const loadSettingsData = async () => {
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

/**
 * Обробляє відправку форми налаштувань.
 */
export const handleSettingsSubmission = () => {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        let profileData = {};
        try {
            const profileResponse = await fetch('http://localhost:3000/api/profile', { headers: getAuthHeaders() });
            if (!profileResponse.ok) throw new Error('Помилка отримання поточних даних профілю.');
            profileData = await profileResponse.json();
        } catch (error) {
            alert(error.message);
            return;
        }

        profileData.show_phone_publicly = !!data.show_phone_publicly; // Оновлюємо тільки поле з форми

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

// --- Логіка user_profile.html ---
export const loadPublicProfileData = async () => {
    console.log("Attempting to load public profile data...");
    const loadingIndicator = document.getElementById('loadingIndicator');
    const profileContainer = document.getElementById('profileContainer');

    // Перевірка наявності основних елементів
    if (!loadingIndicator || !profileContainer) {
        console.error("Critical Error: loadingIndicator or profileContainer element not found!");
        // Можливо, показати помилку користувачу інакше
        if(loadingIndicator) loadingIndicator.innerHTML = "<h1>Помилка сторінки</h1><p>Важливі елементи інтерфейсу не знайдено.</p>";
        return;
    }
    console.log("Elements loadingIndicator and profileContainer found.");

    // Показуємо індикатор завантаження на початку
    loadingIndicator.style.display = 'block';
    profileContainer.style.display = 'none';

    let user = null; // Оголошуємо за межами try
    let listings = []; // Оголошуємо за межами try

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('id');

        if (!userId) throw new Error('ID користувача не вказано.');
        if (MY_USER_ID && MY_USER_ID.toString() === userId) {
            console.log("Redirecting to own profile page.");
            window.location.href = 'profile.html';
            return;
        }

        console.log(`Fetching data for user ID: ${userId}`);
        const profilePromise = fetch(`http://localhost:3000/api/users/${userId}/public-profile`);
        const listingsPromise = fetch(`http://localhost:3000/api/users/${userId}/listings`);
        const [profileResponse, listingsResponse] = await Promise.all([profilePromise, listingsPromise]);
        console.log("API responses received.");

        // Перевірка відповіді профілю
        if (profileResponse.status === 404) throw new Error('Користувача не знайдено.');
        if (!profileResponse.ok) {
            const errorText = await profileResponse.text().catch(() => 'Не вдалося прочитати відповідь сервера');
            throw new Error(`Не вдалося завантажити профіль (Статус: ${profileResponse.status}). ${errorText}`);
        }
        user = await profileResponse.json(); // Присвоюємо значення змінній user
        console.log("User profile data parsed:", user);

        // Обробка відповіді оголошень
        if (!listingsResponse.ok) {
            console.warn(`Не вдалося завантажити оголошення користувача (Статус: ${listingsResponse.status}). Відображення без оголошень.`);
        } else {
            try {
                listings = await listingsResponse.json(); // Присвоюємо значення змінній listings
                console.log(`User listings data parsed: ${listings.length} items`);
            } catch (jsonError) {
                console.error('Помилка парсингу JSON оголошень:', jsonError);
                // listings залишається []
            }
        }

        // !!!!! ТЕПЕР МИ ВПЕВНЕНІ, ЩО ДАНІ ОТРИМАНО (АБО БУЛА ОБРОБЛЕНА ПОМИЛКА ОТРИМАННЯ) !!!!!
        // Ховаємо індикатор і показуємо контейнер ТУТ, ДО заповнення даними
        console.log("Hiding loader, showing container BEFORE populating data...");
        loadingIndicator.style.display = 'none';
        profileContainer.style.display = 'flex'; // Показуємо основний блок

        // --- Заповнення даними (з додатковими перевірками та логуванням помилок заповнення) ---
        console.log("Populating profile data into HTML...");
        // Використовуємо try...catch для всього блоку заповнення, щоб зловити будь-які помилки тут
        try {
            document.title = `UniHome | Профіль ${user.first_name || 'Користувач'}`;

            const safeSet = (id, property, value, defaultValue = 'Не вказано') => {
                const element = document.getElementById(id);
                if (element) {
                    element[property] = value || defaultValue;
                } else {
                    console.warn(`Element with ID '${id}' not found for property '${property}'.`);
                }
            };
            const safeSetHTML = (id, html) => {
                const element = document.getElementById(id);
                if (element) {
                    element.innerHTML = html;
                } else {
                    console.warn(`Element with ID '${id}' not found for innerHTML.`);
                }
            };

            // --- Заповнення елементів (код як у попередньому варіанті, але всередині нового try) ---
            safeSet('profileAvatarImg', 'src', user.avatar_url || DEFAULT_AVATAR_URL);
            safeSet('profileAvatarName', 'textContent', `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Користувач');

            const contactBtn = document.getElementById('btnContactUser');
            if(contactBtn) {
                if (MY_USER_ID) {
                    contactBtn.href = `chat.html?user_id=${user.user_id}`;
                    contactBtn.style.display = 'inline-block';
                } else {
                    contactBtn.style.display = 'none';
                    const sidebar = contactBtn.closest('.profile-sidebar');
                    if(sidebar && !sidebar.querySelector('.login-msg')){
                        const loginMsg = document.createElement('p');
                        loginMsg.className = 'login-msg';
                        loginMsg.innerHTML = '<small>Щоб зв\'язатися, <a href="login.html" style="text-decoration: underline; color: var(--primary-color);">увійдіть</a>.</small>';
                        loginMsg.style.textAlign = 'center';
                        loginMsg.style.marginTop = '10px';
                        sidebar.appendChild(loginMsg);
                    }
                }
            }

            const phoneContainer = document.getElementById('publicPhoneContainer');
            const phoneLink = document.getElementById('publicPhoneLink');
            if (phoneContainer && phoneLink) {
                if (user.phone_number) { // Перевірка на null/undefined/порожній рядок
                    phoneLink.href = `tel:${user.phone_number}`;
                    phoneLink.textContent = user.phone_number;
                    phoneContainer.style.display = 'flex';
                    console.log("Phone number displayed.");
                } else {
                    phoneContainer.style.display = 'none';
                    console.log("Phone number hidden (not provided or preference off).");
                }
            } else {
                console.warn("Phone container or link element not found.");
            }

            safeSet('profileCity', 'textContent', user.city);

            let ageText = 'Не вказано';
            if (user.date_of_birth) {
                try {
                    const birthDate = new Date(user.date_of_birth);
                    if (!isNaN(birthDate.getTime())) {
                        const ageDifMs = Date.now() - birthDate.getTime();
                        const ageDate = new Date(ageDifMs);
                        const age = Math.abs(ageDate.getUTCFullYear() - 1970);
                        if (age > 0) ageText = `${age} років`;
                    }
                } catch (e) { console.error("Помилка обробки дати народження:", e); }
            }
            safeSet('profileAge', 'textContent', ageText);

            safeSet('profileBio', 'textContent', user.bio || 'Користувач ще не додав біографію.');
            safeSet('listingsCount', 'textContent', listings.length);

            let listingsHTML = '';
            if (listings.length === 0) {
                listingsHTML = '<p style="color: var(--text-light); padding: 10px; text-align: center;">Користувач не має активних оголошень.</p>';
            } else {
                listings.forEach(listing => {
                    const imageUrl = listing.main_photo_url || DEFAULT_LISTING_IMAGE[listing.listing_type] || DEFAULT_LISTING_IMAGE['default'];
                    let typeTag = '';
                    if (listing.listing_type === 'rent_out') typeTag = '<span class="type-tag rent">Здають</span>';
                    else if (listing.listing_type === 'find_mate') typeTag = '<span class="type-tag mate">Шукають сусіда</span>';
                    else if (listing.listing_type === 'find_home') typeTag = '<span class="type-tag home">Шукають житло</span>';

                    listingsHTML += `
                         <a href="listing_detail.html?id=${listing.listing_id}" class="listing-card-link">
                             <div class="listing-card">
                                 <img src="${imageUrl}" alt="${listing.title || 'Оголошення'}" class="listing-image">
                                 <div class="info-overlay">
                                     <span class="price-tag">₴${listing.price || '...'} / міс</span>
                                     ${typeTag}
                                 </div>
                                 <div class="listing-content">
                                     <h3>${listing.title || 'Без назви'}</h3>
                                     <p class="details"><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто'}</p>
                                 </div>
                             </div>
                         </a>`;
                });
            }
            safeSetHTML('userListingsContainer', listingsHTML);

            console.log("Finished populating data. Showing content...");
            // ТЕПЕР ховаємо індикатор і показуємо контент
            loadingIndicator.style.display = 'none';
            profileContainer.style.display = 'flex';

        } catch (populationError) {
            // Якщо сталася помилка ПІД ЧАС ЗАПОВНЕННЯ ДАНИМИ
            console.error("Error occurred while populating profile data into HTML:", populationError);
            // Можна показати повідомлення про часткове завантаження або залишити як є,
            // оскільки основний контейнер вже видимий.
            // Наприклад, додати повідомлення в кінець контейнера:
            if(profileContainer) {
                profileContainer.innerHTML += `<p style="color: red; grid-column: 1 / -1; text-align: center;">Виникла помилка під час відображення деяких даних.</p>`;
            }
        }

    } catch (error) { // Обробка помилок ОТРИМАННЯ даних
        console.error('Критична помилка завантаження публічного профілю:', error);
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `<h1>Помилка завантаження</h1><p style="text-align: center;">${error.message}</p>`;
            loadingIndicator.style.display = 'block'; // Показуємо помилку
        }
        if (profileContainer) {
            profileContainer.style.display = 'none'; // Ховаємо контейнер
        }
    }
    // Блок finally не потрібен, оскільки ми керуємо видимістю в кінці try та в catch
};