import { getAuthHeaders, MY_USER_ID, removeToken } from './auth.js';
import { setupNavLinks, DEFAULT_AVATAR_URL } from './navigation.js';
import {DEFAULT_LISTING_IMAGE, API_BASE_URL} from "../app.js";


export const loadProfileData = async () => {
    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб переглянути свій профіль.');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch('${API_BASE_URL}/api/profile', {
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
        setInputValue('profile_phone', user.phone_number);
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
        removeToken();
        window.location.href = 'login.html';
    }
};

//Завантажує фото аватара на сервер.
export const handleAvatarUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const editIcon = document.querySelector('.edit-icon');
        if (editIcon) editIcon.textContent = '⏳';

        const response = await fetch('${API_BASE_URL}/api/upload/avatar', {
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
        await setupNavLinks();

    } catch (error) {
        console.error('Помилка завантаження аватара:', error);
        alert(`Помилка: ${error.message}`);
    } finally {
        const editIcon = document.querySelector('.edit-icon');
        if (editIcon) editIcon.textContent = '✎';
    }
};

export const setupProfileEventListeners = () => {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            const dataFromForm = Object.fromEntries(formData.entries());

            let currentProfileData = {};
            try {
                const profileResponse = await fetch('\${API_BASE_URL}/api/profile', { headers: getAuthHeaders() });
                if (!profileResponse.ok) throw new Error('Помилка отримання поточних даних профілю.');
                currentProfileData = await profileResponse.json();
            } catch (error) {
                alert(`Помилка: ${error.message}`);
                return;
            }
            const updatedProfileData = { ...currentProfileData, ...dataFromForm };

            try {
                const response = await fetch('\${API_BASE_URL}/api/profile', {
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

                const avatarName = document.getElementById('profileAvatarName');
                if (avatarName && (result.user.first_name !== currentProfileData.first_name || result.user.last_name !== currentProfileData.last_name)) {
                    avatarName.textContent = `${result.user.first_name || ''} ${result.user.last_name || ''}`;
                    await setupNavLinks();
                }

            } catch (error) {
                console.error('Помилка оновлення профілю:', error);
                alert(`Помилка: ${error.message}`);
            }
        });
    }

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

    const avatarInput = document.getElementById('avatar-upload');
    if (avatarInput) {
        avatarInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                handleAvatarUpload(file);
            }
        });
    }

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


export const loadSettingsData = async () => {
    if (!MY_USER_ID) {
        window.location.href = 'login.html';
        return;
    }
    try {
        const response = await fetch('\${API_BASE_URL}/api/profile', {
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

//Обробляє відправку форми налаштувань.
export const handleSettingsSubmission = () => {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        let profileData = {};
        try {
            const profileResponse = await fetch('\${API_BASE_URL}/api/profile', { headers: getAuthHeaders() });
            if (!profileResponse.ok) throw new Error('Помилка отримання поточних даних профілю.');
            profileData = await profileResponse.json();
        } catch (error) {
            alert(error.message);
            return;
        }

        profileData.show_phone_publicly = !!data.show_phone_publicly;

        try {
            const response = await fetch('\${API_BASE_URL}/api/profile', {
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
    console.log(">>> loadPublicProfileData function started...");
    console.log("Attempting to load public profile data...");
    const loadingIndicator = document.getElementById('loadingIndicator');
    const profileContainer = document.getElementById('profileContainer');

    if (!loadingIndicator || !profileContainer) {
        console.error("Critical Error: loadingIndicator or profileContainer element not found!");
        if(loadingIndicator) loadingIndicator.innerHTML = "<h1>Помилка сторінки</h1><p>Важливі елементи інтерфейсу не знайдено.</p>";
        return;
    }
    console.log("Elements loadingIndicator and profileContainer found.");

    loadingIndicator.style.display = 'block';
    profileContainer.style.display = 'none';

    let user = null;
    let listings = [];

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('id');
        const currentUserId = MY_USER_ID;

        console.log('[DEBUG] Перевірка перенаправлення:');
        console.log('[DEBUG] currentUserId (з MY_USER_ID):', currentUserId, typeof currentUserId);
        console.log('[DEBUG] userId (з URL):', userId, typeof userId);
        console.log('[DEBUG] Результат порівняння (currentUserId.toString() === userId):', currentUserId !== null && currentUserId !== undefined && currentUserId.toString() === userId);

        if (!userId) throw new Error('ID користувача не вказано.');
        console.log('Checking redirection: currentUserId =', currentUserId, ' | page userId =', userId);
        if (currentUserId !== null && currentUserId !== undefined && currentUserId.toString() === userId) {
            console.log("Redirecting to own profile page.");
            window.location.href = 'profile.html';
            return;
        }
        console.log("Not redirecting. Proceeding to fetch data...");

        console.log(`Fetching data for user ID: ${userId}`);
        const profilePromise = fetch(`\${API_BASE_URL}/api/users/${userId}/public-profile`);
        const listingsPromise = fetch(`\${API_BASE_URL}/api/users/${userId}/listings`);
        const [profileResponse, listingsResponse] = await Promise.all([profilePromise, listingsPromise]);
        console.log("API responses received.");

        if (profileResponse.status === 404) throw new Error('Користувача не знайдено.');
        if (!profileResponse.ok) {
            const errorText = await profileResponse.text().catch(() => 'Не вдалося прочитати відповідь сервера');
            throw new Error(`Не вдалося завантажити профіль (Статус: ${profileResponse.status}). ${errorText}`);
        }
        user = await profileResponse.json();
        console.log("User profile data parsed:", user);

        if (!listingsResponse.ok) {
            console.warn(`Не вдалося завантажити оголошення користувача (Статус: ${listingsResponse.status}). Відображення без оголошень.`);
        } else {
            try {
                listings = await listingsResponse.json();
                console.log(`User listings data parsed: ${listings.length} items`);
            } catch (jsonError) {
                console.error('Помилка парсингу JSON оголошень:', jsonError);
            }
        }

        console.log("Hiding loader, showing container BEFORE populating data...");
        loadingIndicator.style.display = 'none';
        profileContainer.style.display = 'flex';

        console.log("Populating profile data into HTML...");
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
                if (user.phone_number) {
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
            loadingIndicator.style.display = 'none';
            profileContainer.style.display = 'flex';

        } catch (populationError) {
            console.error("Error occurred while populating profile data into HTML:", populationError);
            if(profileContainer) {
                profileContainer.innerHTML += `<p style="color: red; grid-column: 1 / -1; text-align: center;">Виникла помилка під час відображення деяких даних.</p>`;
            }
        }

    } catch (error) {
        console.error('Критична помилка завантаження публічного профілю:', error);
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `<h1>Помилка завантаження</h1><p style="text-align: center;">${error.message}</p>`;
            loadingIndicator.style.display = 'block';
        }
        if (profileContainer) {
            profileContainer.style.display = 'none';
        }
    }
};