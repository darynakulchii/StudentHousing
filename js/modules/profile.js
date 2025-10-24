// =================================================================================
// PROFILE MODULE
// =================================================================================

import { getAuthHeaders, MY_USER_ID, removeToken } from './auth.js';
import { setupNavLinks, DEFAULT_AVATAR_URL } from './navigation.js';
import {DEFAULT_LISTING_IMAGE} from "../app";

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