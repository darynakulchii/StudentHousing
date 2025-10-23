// js/modules/profile.js

import { MY_USER_ID, getAuthHeaders, removeToken } from './auth.js';
import { setupNavLinks } from './navigation.js'; // Припускаємо, що створите navigation.js

// === Новий URL для аватара за замовчуванням ===
const DEFAULT_AVATAR_URL = 'https://placehold.co/120x120/EBF4FF/7F9CF5?text=User';

/**
 * Завантажує дані поточного користувача та заповнює форму профілю.
 */
export const loadProfileData = async () => {
    // Перевірка авторизації
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
            if (response.status === 401 || response.status === 403) {
                throw new Error('Сесія недійсна. Будь ласка, увійдіть знову.');
            }
            throw new Error(`Помилка сервера: ${response.status}`);
        }

        const user = await response.json();

        // Функція для заповнення полів форми
        const setInputValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        // Заповнюємо поля
        setInputValue('profile_first_name', user.first_name);
        setInputValue('profile_last_name', user.last_name);
        setInputValue('profile_email', user.email);
        setInputValue('profile_city', user.city);
        setInputValue('profile_phone', user.phone_number);
        setInputValue('profile_bio', user.bio);
        if (user.date_of_birth) {
            // Форматуємо дату для input type="date"
            setInputValue('profile_date', user.date_of_birth.split('T')[0]);
        }

        // Оновлюємо аватар та ім'я в сайдбарі
        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarName = document.getElementById('profileAvatarName');
        if (avatarImg) avatarImg.src = user.avatar_url || DEFAULT_AVATAR_URL;
        if (avatarName) avatarName.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Користувач';


        // --- Логіка кнопки верифікації телефону (приклад) ---
        const phoneInput = document.getElementById('profile_phone');
        const verifyStatusDiv = document.getElementById('phone_verify_status');
        const verifyBtn = document.getElementById('btnVerifyPhone');
        const statusIcon = verifyStatusDiv?.querySelector('.status-icon');

        // Припускаємо, що з бекенду приходить поле is_phone_verified (треба додати в schema.sql та /api/profile)
        const isVerified = user.is_phone_verified || false; // За замовчуванням false

        if (verifyStatusDiv && statusIcon && verifyBtn) {
            statusIcon.dataset.verified = isVerified;
            verifyBtn.style.display = isVerified ? 'none' : 'block'; // Ховаємо, якщо верифіковано

            // Ховаємо кнопку, якщо номер не введено
            const phoneEmpty = !phoneInput?.value;
            verifyStatusDiv.dataset.phoneEmpty = phoneEmpty;
            if (phoneEmpty) {
                verifyBtn.style.display = 'none';
            }

            // Додати логіку для phoneInput.oninput, щоб показувати/ховати кнопку при вводі
            if(phoneInput) {
                phoneInput.addEventListener('input', () => {
                    const isEmpty = !phoneInput.value;
                    verifyStatusDiv.dataset.phoneEmpty = isEmpty;
                    verifyBtn.style.display = (isVerified || isEmpty) ? 'none' : 'block';
                });
            }

            // Додати слухач на verifyBtn для запуску процесу верифікації
            verifyBtn.addEventListener('click', () => {
                alert('Функціонал верифікації телефону в розробці.');
                // Тут буде логіка відправки запиту на бекенд для SMS-коду
            });
        }


    } catch (error) {
        console.error('Помилка завантаження профілю:', error);
        alert(`Помилка: ${error.message}`);
        removeToken(); // Видаляємо недійсний токен
        window.location.href = 'login.html';
    }
};

/**
 * Обробляє завантаження нового файлу аватара на сервер.
 * @param {File} file - Об'єкт файлу зображення.
 */
export const handleAvatarUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file); // 'avatar' - name інпута

    const editIcon = document.querySelector('.edit-icon'); // Іконка олівця

    try {
        // Показуємо індикатор завантаження
        if (editIcon) editIcon.textContent = '⏳'; // Годинник

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

        // Оновлюємо зображення на сторінці профілю
        const avatarImg = document.getElementById('profileAvatarImg');
        if (avatarImg) avatarImg.src = result.avatarUrl;

        // Оновлюємо аватар в хедері (викликаємо функцію з модуля навігації)
        if (typeof setupNavLinks === 'function') {
            await setupNavLinks(); // Оновлює аватар в хедері
        } else {
            console.warn('Функція setupNavLinks не знайдена/не імпортована.');
        }

    } catch (error) {
        console.error('Помилка завантаження аватара:', error);
        alert(`Помилка: ${error.message}`);
    } finally {
        // Повертаємо іконку олівця
        if (editIcon) editIcon.textContent = '✎';
    }
};

/**
 * Завантажує поточні налаштування користувача (наприклад, показ телефону).
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
        alert(`Помилка: ${error.message}`);
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
        const settingsData = {
            // Перетворюємо значення чекбоксу на boolean
            show_phone_publicly: !!formData.get('show_phone_publicly')
        };

        const submitButton = form.querySelector('button[type="submit"]');
        if(submitButton) submitButton.disabled = true;


        try {
            // Використовуємо PUT /api/profile, оскільки налаштування є частиною профілю
            const response = await fetch('http://localhost:3000/api/profile', {
                method: 'PUT',
                headers: getAuthHeaders(),
                // Надсилаємо ТІЛЬКИ ті поля, які змінюємо в налаштуваннях
                body: JSON.stringify(settingsData)
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
        } finally {
            if(submitButton) submitButton.disabled = false;
        }
    });
};

/**
 * Налаштовує слухачі подій для сторінки профілю (збереження, вихід, завантаження аватара).
 */
export const setupProfileEventListeners = () => {
    // Форма оновлення профілю
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            // Створюємо об'єкт тільки з тими даними, які є у формі профілю
            const dataToUpdate = {
                first_name: formData.get('first_name'),
                last_name: formData.get('last_name'),
                email: formData.get('email'),
                city: formData.get('city'),
                date_of_birth: formData.get('date_of_birth') || null, // null якщо не вибрано
                bio: formData.get('bio'),
                phone_number: formData.get('phone_number')
                // avatar_url оновлюється через handleAvatarUpload
                // show_phone_publicly оновлюється в handleSettingsSubmission
            };

            const submitButton = profileForm.querySelector('button[type="submit"]');
            if(submitButton) submitButton.disabled = true;


            try {
                const response = await fetch('http://localhost:3000/api/profile', {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(dataToUpdate) // Надсилаємо тільки дані з форми
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Не вдалося оновити профіль');
                }

                const result = await response.json();
                alert(result.message);

                // Оновлюємо ім'я в сайдбарі профілю
                const avatarName = document.getElementById('profileAvatarName');
                if (avatarName) {
                    avatarName.textContent = `${result.user.first_name || ''} ${result.user.last_name || ''}`.trim() || 'Користувач';
                }
                // Оновлюємо також хедер
                if (typeof setupNavLinks === 'function') {
                    await setupNavLinks();
                }

            } catch (error) {
                console.error('Помилка оновлення профілю:', error);
                alert(`Помилка: ${error.message}`);
            } finally {
                if(submitButton) submitButton.disabled = false;
            }
        });
    }

    // Кнопка "Вийти"
    const logoutButton = document.getElementById('btnLogout');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Ви впевнені, що хочете вийти?')) {
                removeToken(); // Видаляємо токен з auth.js
                alert('Ви вийшли з системи.');
                window.location.href = 'index.html'; // Перенаправляємо на головну
            }
        });
    }

    // Завантаження аватара
    const avatarInput = document.getElementById('avatar-upload');
    const avatarLabel = document.querySelector('.edit-icon'); // Label, що стилізований під іконку

    // Клік на іконку/label відкриває вибір файлу
    if(avatarLabel && avatarInput) {
        avatarLabel.addEventListener('click', (e) => {
            // Запобігаємо стандартній дії label (подвійне відкриття вікна)
            e.preventDefault();
            avatarInput.click();
        });

        avatarInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                handleAvatarUpload(file);
            }
            // Скидаємо значення інпуту, щоб можна було завантажити той самий файл знову
            event.target.value = null;
        });
    }

    // Навігація по меню профілю (приклад, якщо потрібна логіка зміни вмісту без перезавантаження)
    const profileMenuItems = document.querySelectorAll('.profile-menu li');
    profileMenuItems.forEach(item => {
        item.addEventListener('click', () => {
            // Знімаємо клас active з усіх
            profileMenuItems.forEach(i => i.classList.remove('active'));
            // Додаємо active до клікнутого
            item.classList.add('active');

            // --- Перенаправлення на відповідні сторінки ---
            const id = item.id;
            if (id === 'btnInfo') {
                // Вже на сторінці профілю, нічого не робимо
                // або можна показати/сховати секції, якщо все на одній сторінці
            } else if (id === 'btnMyListings') {
                window.location.href = 'my_listings.html';
            } else if (id === 'btnLoginPassword') {
                alert('Розділ "Зміна логіну та пароля" в розробці.');
                // Можливо, перехід на settings.html або окрему сторінку
            } else if (id === 'btnSettings') {
                window.location.href = 'settings.html';
            } else if (id === 'btnLogout') {
                // Клік на кнопку Вийти обробляється окремим слухачем вище
            }
        });
    });

    // Встановлюємо активний пункт меню для поточної сторінки
    const currentPage = window.location.pathname.split('/').pop();
    let activeItemId = 'btnInfo'; // За замовчуванням
    if (currentPage === 'settings.html') {
        activeItemId = 'btnSettings';
    } else if (currentPage === 'my_listings.html') {
        activeItemId = 'btnMyListings';
    } // Додати інші сторінки за потреби

    profileMenuItems.forEach(item => {
        item.classList.toggle('active', item.id === activeItemId);
    });

};

/**
 * Завантажує публічні дані профілю іншого користувача.
 */
export const loadPublicProfileData = async () => {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const profileContainer = document.getElementById('profileContainer'); // Головний контейнер сторінки
    if (!loadingIndicator || !profileContainer) return;

    // Показуємо індикатор, ховаємо контент
    loadingIndicator.style.display = 'block';
    profileContainer.style.display = 'none';

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('id');

        if (!userId) {
            throw new Error('ID користувача не вказано в URL.');
        }

        // Забороняємо перегляд власного публічного профілю
        if (MY_USER_ID && MY_USER_ID.toString() === userId) {
            window.location.href = 'profile.html'; // Перенаправляємо на приватний
            return;
        }

        // Запускаємо запити паралельно
        const profilePromise = fetch(`http://localhost:3000/api/users/${userId}/public-profile`);
        const listingsPromise = fetch(`http://localhost:3000/api/users/${userId}/listings`); // Отримуємо лише активні

        const [profileResponse, listingsResponse] = await Promise.all([profilePromise, listingsPromise]);

        // Обробка профілю
        if (profileResponse.status === 404) throw new Error('Користувача не знайдено.');
        if (!profileResponse.ok) throw new Error('Не вдалося завантажити профіль.');
        const user = await profileResponse.json();

        // Обробка оголошень (не критично, якщо не завантажаться)
        let listings = [];
        if (listingsResponse.ok) {
            listings = await listingsResponse.json();
        } else {
            console.warn('Не вдалося завантажити оголошення користувача.');
        }

        // --- Заповнення сторінки даними ---
        document.title = `UniHome | Профіль ${user.first_name}`;

        // Сайдбар
        const avatarImg = document.getElementById('profileAvatarImg');
        const avatarName = document.getElementById('profileAvatarName');
        if(avatarImg) avatarImg.src = user.avatar_url || DEFAULT_AVATAR_URL;
        if(avatarName) avatarName.textContent = `${user.first_name} ${user.last_name}`;

        // Кнопка "Зв'язатись"
        const contactBtn = document.getElementById('btnContactUser');
        const sidebar = contactBtn?.closest('.profile-sidebar');
        if(contactBtn && sidebar) {
            if (MY_USER_ID) { // Показуємо, тільки якщо поточний користувач залогінений
                contactBtn.href = `chat.html?user_id=${user.user_id}`;
                contactBtn.style.display = 'inline-block';
            } else {
                contactBtn.style.display = 'none'; // Ховаємо кнопку
                // Додаємо повідомлення про логін (якщо його ще немає)
                if (!sidebar.querySelector('.login-prompt')) {
                    const loginMsg = document.createElement('p');
                    loginMsg.className = 'login-prompt'; // Клас для ідентифікації
                    loginMsg.innerHTML = '<small>Щоб зв\'язатися, <a href="login.html" style="text-decoration: underline; color: var(--primary-color);">увійдіть</a>.</small>';
                    loginMsg.style.textAlign = 'center';
                    loginMsg.style.marginTop = '15px';
                    sidebar.appendChild(loginMsg);
                }
            }
        }

        // Показ телефону
        const phoneContainer = document.getElementById('publicPhoneContainer');
        const phoneLink = document.getElementById('publicPhoneLink');
        if (phoneContainer && phoneLink && user.phone_number) { // phone_number буде null, якщо приховано
            phoneLink.href = `tel:${user.phone_number}`;
            phoneLink.textContent = user.phone_number;
            phoneContainer.style.display = 'flex'; // Показуємо блок
        } else if (phoneContainer) {
            phoneContainer.style.display = 'none'; // Ховаємо, якщо номера немає або приховано
        }

        // Основна інформація
        const profileCityEl = document.getElementById('profileCity');
        if(profileCityEl) profileCityEl.textContent = user.city || 'Не вказано';

        // Вік
        const ageSpan = document.getElementById('profileAge');
        if(ageSpan){
            if (user.date_of_birth) {
                try {
                    const birthDate = new Date(user.date_of_birth);
                    if (!isNaN(birthDate.getTime())) {
                        const ageDifMs = Date.now() - birthDate.getTime();
                        const ageDate = new Date(ageDifMs);
                        ageSpan.textContent = `${Math.abs(ageDate.getUTCFullYear() - 1970)} років`;
                    } else ageSpan.textContent = 'Не вказано';
                } catch (e) { ageSpan.textContent = 'Не вказано'; }
            } else ageSpan.textContent = 'Не вказано';
        }

        // Біо
        const profileBioEl = document.getElementById('profileBio');
        if(profileBioEl) profileBioEl.textContent = user.bio || 'Користувач не додав біографію.';

        // Оголошення
        const listingsCountEl = document.getElementById('listingsCount');
        if(listingsCountEl) listingsCountEl.textContent = listings.length;

        const listingsContainer = document.getElementById('userListingsContainer');
        if(listingsContainer) {
            listingsContainer.innerHTML = ''; // Очищуємо
            if (listings.length === 0) {
                listingsContainer.innerHTML = '<p style="color: var(--text-light); padding: 10px; text-align: center;">Користувач не має активних оголошень.</p>';
            } else {
                // Використовуємо той самий код рендерингу картки, що й на index.html/favorites.html
                // Потрібно буде імпортувати DEFAULT_LISTING_IMAGE або визначити тут
                const DEFAULT_LISTING_IMAGE = { /* ... */ }; // Додайте визначення
                listings.forEach(listing => renderListingCard(listingsContainer, listing, DEFAULT_LISTING_IMAGE));
            }
        }

        // Показуємо контент, ховаємо індикатор
        loadingIndicator.style.display = 'none';
        profileContainer.style.display = 'flex'; // Або 'block', залежно від стилів

    } catch (error) {
        console.error('Помилка завантаження публічного профілю:', error);
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `<h1>Помилка завантаження</h1><p style="text-align: center;">${error.message}</p>`;
        }
        // Ховаємо основний контейнер, якщо він був показаний
        if (profileContainer) profileContainer.style.display = 'none';
    }
};

// Допоміжна функція для рендерингу картки оголошення (винести в окремий модуль listings.js?)
function renderListingCard(container, listing, defaultImages) {
    const imageUrl = listing.main_photo_url
        || defaultImages[listing.listing_type]
        || defaultImages['default'];

    let typeTag = '';
    if (listing.listing_type === 'rent_out') typeTag = '<span class="type-tag rent">Здають</span>';
    else if (listing.listing_type === 'find_mate') typeTag = '<span class="type-tag mate">Шукають сусіда</span>';
    else if (listing.listing_type === 'find_home') typeTag = '<span class="type-tag home">Шукають житло</span>';

    container.innerHTML += `
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
}