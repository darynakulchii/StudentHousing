// js/modules/listings.js

import { MY_USER_ID, getAuthHeaders } from './auth.js';
// Потрібно імпортувати currentUserFavoriteIds, якщо логіка Обраного тут
// import { currentUserFavoriteIds, fetchFavoriteIds } from './favorites.js'; // Або звідки вона буде

// Зображення за замовчуванням
export const DEFAULT_LISTING_IMAGE = {
    'rent_out': 'https://via.placeholder.com/400x300.png?text=Rent+Out',
    'find_mate': 'https://via.placeholder.com/400x300.png?text=Find+Mate',
    'find_home': 'https://via.placeholder.com/400x300.png?text=Find+Home',
    'default': 'https://picsum.photos/400/300' // Загальний
};

// Аватар за замовчуванням (використовується в деталях)
const DEFAULT_AVATAR_URL = 'https://placehold.co/120x120/EBF4FF/7F9CF5?text=User';


// --- Функції для рендерингу ---

/**
 * Рендерить одну картку оголошення і додає її в контейнер.
 * @param {HTMLElement} container - DOM-елемент контейнера для карток.
 * @param {object} listing - Об'єкт оголошення з даними.
 */
export function renderListingCard(container, listing) {
    if (!container || !listing) return;

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
        // find_home зазвичай не показуються в загальному списку, але про всяк випадок
        typeTag = '<span class="type-tag home">Шукають житло</span>';
    }

    const cardHTML = `
        <a href="listing_detail.html?id=${listing.listing_id}" class="listing-card-link">
            <div class="listing-card">
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
    container.insertAdjacentHTML('beforeend', cardHTML);
}

// --- Функції для завантаження даних ---

/**
 * Завантажує та відображає список оголошень (для index.html, favorites.html).
 * @param {string} containerSelector - Селектор DOM-контейнера для оголошень.
 * @param {string} apiEndpoint - URL API для завантаження (напр., '/api/listings', '/api/my-favorites').
 * @param {string} [filterQuery=''] - Рядок запиту для фільтрації (напр., 'city=Київ&price_max=10000').
 * @param {boolean} [requiresAuth=false] - Чи потрібна автентифікація для цього ендпоінта?
 */
export const fetchAndDisplayListings = async (containerSelector, apiEndpoint, filterQuery = '', requiresAuth = false) => {
    const container = document.querySelector(containerSelector);
    if (!container) {
        console.error(`Container "${containerSelector}" not found.`);
        return;
    }

    // Перевірка авторизації, якщо потрібно
    if (requiresAuth && !MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб переглянути цей розділ.');
        container.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 20px;">Будь ласка, <a href="login.html" style="text-decoration: underline; color: var(--primary-color);">увійдіть</a>.</p>`;
        return;
    }

    // Показуємо індикатор завантаження
    container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Завантаження оголошень...</p>';

    try {
        const headers = requiresAuth ? getAuthHeaders() : {};
        const url = `http://localhost:3000${apiEndpoint}?${filterQuery}`;

        const response = await fetch(url, { headers });

        if (!response.ok) {
            // Обробка специфічних помилок
            if (response.status === 401 || response.status === 403) {
                throw new Error('Помилка доступу. Можливо, потрібно увійти.');
            }
            throw new Error(`HTTP помилка! Статус: ${response.status}`);
        }

        const listings = await response.json();
        container.innerHTML = ''; // Очищуємо індикатор

        if (listings.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">Оголошень за вашими критеріями не знайдено.</p>';
            // Специфічне повідомлення для обраного
            if (apiEndpoint.includes('favorites')) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">Ви ще не додали жодного оголошення до вибраного.</p>';
            }
            return;
        }

        listings.forEach(listing => {
            renderListingCard(container, listing); // Використовуємо функцію рендерингу
        });

    } catch (error) {
        console.error(`Помилка завантаження оголошень з ${apiEndpoint}:`, error);
        container.innerHTML = `<p style="color: var(--danger-color); font-weight: 600; text-align: center; padding: 20px;">Помилка завантаження. ${error.message}</p>`;
        // Перенаправлення на логін при помилці доступу
        if (error.message.includes('Помилка доступу')) {
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        }
    }
};

/**
 * Завантажує та відображає деталі одного оголошення.
 */
export const fetchAndDisplayListingDetail = async () => {
    const container = document.getElementById('listingDetailContainer');
    if (!container) return;

    // Показуємо індикатор завантаження
    container.innerHTML = `<div class="loading-placeholder"><h1>Завантаження деталей...</h1><p style="text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i></p></div>`;


    try {
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('id');

        if (!listingId) throw new Error('ID оголошення не вказано в URL.');

        const response = await fetch(`http://localhost:3000/api/listings/${listingId}`);
        if (response.status === 404) throw new Error('Оголошення не знайдено (404).');
        if (!response.ok) throw new Error(`HTTP помилка! Статус: ${response.status}`);

        const listing = await response.json();
        document.title = `UniHome | ${listing.title}`; // Встановлюємо заголовок сторінки

        // --- Рендеринг деталей ---
        const detailHTML = generateListingDetailHTML(listing); // Виносимо генерацію HTML в окрему функцію
        container.innerHTML = detailHTML;

        // --- Налаштування інтерактивності ПІСЛЯ рендерингу ---
        setupImageGallery(container); // Налаштовуємо кліки по мініатюрах
        setupFavoriteButton(listingId, listing.user_id); // Налаштовуємо кнопку "Обране"

    } catch (error) {
        console.error('Помилка завантаження деталей оголошення:', error);
        container.innerHTML = `<h1 style="text-align: center; color: var(--danger-color);">Помилка завантаження</h1><p style="text-align: center;">${error.message}</p>`;
    }
};

/**
 * Генерує HTML-розмітку для сторінки деталей оголошення.
 * @param {object} listing - Об'єкт оголошення з усіма даними.
 * @returns {string} - Готовий HTML-рядок.
 */
function generateListingDetailHTML(listing) {
    // --- Фотогалерея ---
    let mainImage = listing.photos.find(p => p.is_main);
    let mainImageUrl = mainImage?.image_url
        || listing.main_photo_url // Fallback
        || DEFAULT_LISTING_IMAGE[listing.listing_type]
        || DEFAULT_LISTING_IMAGE['default'];

    let photoGalleryHTML = '';
    if (listing.photos && listing.photos.length > 0) {
        const sortedPhotos = mainImage
            ? [mainImage, ...listing.photos.filter(p => !p.is_main)]
            : listing.photos;
        photoGalleryHTML = sortedPhotos
            .map((photo, index) => `<img src="${photo.image_url}" alt="Фото ${index + 1}" class="gallery-thumbnail ${index === 0 ? 'active' : ''}" data-src="${photo.image_url}">`)
            .join('');
    } else {
        photoGalleryHTML = `<img src="${mainImageUrl}" alt="${listing.title}" class="gallery-thumbnail inactive">`;
    }

    // --- Характеристики (з групуванням) ---
    const { aboutAuthorHTML, roommatePrefsHTML, housingCharsHTML } = generateCharacteristicsHTML(listing);

    // --- Інформація про автора та кнопка контакту ---
    const authorAvatarHTML = `
         <a href="user_profile.html?id=${listing.user_id}" class="author-name-link">
             <div class="author-avatar">
                 <img src="${listing.avatar_url || DEFAULT_AVATAR_URL}" alt="Аватар ${listing.first_name}">
             </div>
        </a>
    `;
    const contactButtonHTML = (MY_USER_ID === listing.user_id)
        ? `<a href="my_listings.html" class="contact-btn" style="background: var(--text-light); cursor: default;">
             <i class="fas fa-user-edit"></i> Це ваше оголошення
           </a>`
        : (MY_USER_ID // Показуємо кнопку, тільки якщо користувач залогінений
                ? `<a href="chat.html?user_id=${listing.user_id}" class="contact-btn">
                   <i class="fas fa-comment-dots"></i> Зв'язатись з автором
                 </a>`
                : `<a href="login.html" class="contact-btn" style="background: var(--accent-color-blue);">
                 <i class="fas fa-sign-in-alt"></i> Увійдіть, щоб зв'язатись
               </a>`
        );


    // --- Збираємо фінальний HTML ---
    return `
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
                    <button class="favorite-btn" id="favoriteBtn" title="Додати у вибране" data-listing-id="${listing.listing_id}" style="display: none;">
                        <i class="far fa-heart"></i>
                    </button>
                </div>
                <span class="detail-price">₴${listing.price || 0} / міс</span>

                <div class="detail-meta">
                    <p><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто не вказано'}</p>
                    ${listing.target_university ? `<p><i class="fas fa-university"></i> ${listing.target_university}</p>` : ''}
                    ${listing.rooms ? `<p><i class="fas fa-door-open"></i> Кімнат: ${listing.rooms}</p>` : ''}
                    ${listing.total_area ? `<p><i class="fas fa-ruler-combined"></i> ${listing.total_area} м²</p>` : ''}
                    ${listing.floor && listing.total_floors ? `<p><i class="fas fa-building"></i> ${listing.floor} / ${listing.total_floors} поверх</p>` : ''}
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
}

/**
 * Генерує HTML для секцій характеристик (Про автора, Вимоги, Характеристики житла).
 * @param {object} listing - Об'єкт оголошення.
 * @returns {object} - Об'єкт з HTML-рядками { aboutAuthorHTML, roommatePrefsHTML, housingCharsHTML }.
 */
function generateCharacteristicsHTML(listing) {
    const categoryNames = { /* ... (скопіюйте з app.js або винесіть в окремий конфіг) ... */ };
    // --- Скопійовано з app.js ---
    categoryNames = {
        'tech': 'Побутова техніка', 'media': 'Мультимедіа', 'comfort': 'Комфорт',
        'pets_allowed': 'Домашні улюбленці (Дозволено)', 'blackout': 'Автономність при блекауті',
        'rules': 'Правила', 'communications': 'Комунікації', 'infra': 'Інфраструктура (до 500 метрів)',
        'inclusive': 'Інклюзивність', 'my_personality': 'Особистість', 'my_lifestyle': 'Спосіб життя',
        'my_interests': 'Інтереси', 'my_pets': 'Мої тварини', 'mate_personality': 'Бажана особистість',
        'mate_lifestyle': 'Бажаний спосіб життя', 'mate_interests': 'Бажані інтереси', 'mate_pets': 'Тварини у сусіда'
    };
    // --- Кінець копіювання ---


    const characteristicsByCategory = {};
    if (listing.characteristics) {
        listing.characteristics.forEach(char => {
            const category = char.category;
            if (!characteristicsByCategory[category]) characteristicsByCategory[category] = [];
            characteristicsByCategory[category].push(`<span class="char-tag">${char.name_ukr}</span>`);
        });
    }

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
                    </div>`;
            }
        }
        return html;
    };

    let aboutAuthorHTML = '', roommatePrefsHTML = '', housingCharsHTML = '';

    if (listing.listing_type === 'find_home' || listing.listing_type === 'find_mate') {
        const myCharsHTML = buildCharSection(['my_personality', 'my_lifestyle', 'my_interests', 'my_pets']);
        if (listing.my_age || listing.my_gender || myCharsHTML) {
            aboutAuthorHTML = `
                <div class="detail-section">
                    <h2>Про автора</h2>
                    <div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">
                        ${listing.my_age ? `<span class="char-tag">Вік: ${listing.my_age}</span>` : ''}
                        ${listing.my_gender === 'female' ? `<span class="char-tag">Стать: Жіноча</span>` : ''}
                        ${listing.my_gender === 'male' ? `<span class="char-tag">Стать: Чоловіча</span>` : ''}
                        ${/* Додайте інші поля як my_smoking, my_drinking, якщо вони є в listing */''}
                    </div>
                    ${myCharsHTML}
                </div>`;
        }

        const mateCharsHTML = buildCharSection(['mate_personality', 'mate_lifestyle', 'mate_interests', 'mate_pets']);
        if (listing.roommate_gender || listing.roommate_age_min || mateCharsHTML) {
            roommatePrefsHTML = `
                <div class="detail-section">
                    <h2>Вимоги до сусіда</h2>
                    <div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">
                        ${listing.roommate_gender && listing.roommate_gender !== 'any' ? `<span class="char-tag">Стать: ${listing.roommate_gender === 'female' ? 'Жіноча' : 'Чоловіча'}</span>` : ''}
                        ${listing.roommate_age_min && listing.roommate_age_max ? `<span class="char-tag">Вік: ${listing.roommate_age_min} - ${listing.roommate_age_max}</span>` : ''}
                         ${/* Додайте roommate_smoking і т.д. */''}
                    </div>
                    ${mateCharsHTML}
                </div>`;
        }
    }

    const apartmentCategories = ['tech', 'media', 'comfort', 'pets_allowed', 'blackout', 'rules', 'communications', 'infra', 'inclusive'];
    const apartmentCharsHTML = buildCharSection(apartmentCategories);

    if (listing.listing_type === 'find_home') {
        housingCharsHTML = `<div class="detail-section"><h2>Бажані характеристики житла</h2>${apartmentCharsHTML || '<p>Автор не вказав бажаних характеристик.</p>'}</div>`;
    } else if (listing.listing_type === 'rent_out' || listing.listing_type === 'find_mate') {
        housingCharsHTML = `<div class="detail-section"><h2>Характеристики житла</h2>${apartmentCharsHTML || '<p>Характеристики не вказані.</p>'}</div>`;
    }

    return { aboutAuthorHTML, roommatePrefsHTML, housingCharsHTML };
}


/**
 * Налаштовує обробники кліків для мініатюр галереї.
 * @param {HTMLElement} container - Батьківський контейнер сторінки деталей.
 */
function setupImageGallery(container) {
    const thumbnails = container.querySelectorAll('.gallery-thumbnail:not(.inactive)');
    const mainImageElement = container.querySelector('#mainDetailImage');

    if (!mainImageElement || thumbnails.length === 0) return;

    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', () => {
            const newSrc = thumb.dataset.src || thumb.src; // Використовуємо data-src, якщо є
            if (mainImageElement.src !== newSrc) {
                mainImageElement.src = newSrc; // Міняємо головне зображення
                // Оновлюємо активний клас
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            }
        });
    });
}

// --- Логіка "Мої оголошення" ---

/**
 * Завантажує та відображає оголошення поточного користувача.
 */
export const fetchAndDisplayMyListings = async () => {
    const container = document.getElementById('myListingsContainer');
    if (!container) return;

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб переглянути свої оголошення.');
        window.location.href = 'login.html';
        return;
    }

    container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Завантаження ваших оголошень...</p>';

    try {
        const response = await fetch('http://localhost:3000/api/my-listings', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error('Необхідна автентифікація.');
            throw new Error(`HTTP помилка! Статус: ${response.status}`);
        }

        const listings = await response.json();
        container.innerHTML = ''; // Очищуємо

        if (listings.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">У вас ще немає створених оголошень. <a href="add_listing.html" style="text-decoration: underline; color: var(--primary-color);">Створити перше?</a></p>';
            return;
        }

        listings.forEach(listing => {
            renderMyListingCard(container, listing); // Використовуємо окрему функцію рендерингу
        });

    } catch (error) {
        console.error('Помилка завантаження моїх оголошень:', error);
        container.innerHTML = `<p style="color: var(--danger-color); padding: 10px; text-align: center;">Помилка завантаження. ${error.message}</p>`;
        if (error.message.includes('автентифікація')) {
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        }
    }
};

/**
 * Рендерить картку для сторінки "Мої оголошення" з кнопками дій.
 * @param {HTMLElement} container - Контейнер для карток.
 * @param {object} listing - Об'єкт оголошення.
 */
function renderMyListingCard(container, listing) {
    const imageUrl = listing.main_photo_url || DEFAULT_LISTING_IMAGE[listing.listing_type] || DEFAULT_LISTING_IMAGE['default'];

    let typeTag = '';
    if(listing.listing_type === 'rent_out') typeTag = '<span class="type-tag rent">Здають</span>';
    else if (listing.listing_type === 'find_mate') typeTag = '<span class="type-tag mate">Шукають сусіда</span>';
    else if (listing.listing_type === 'find_home') typeTag = '<span class="type-tag home">Шукають житло</span>';

    const card = document.createElement('div');
    card.className = `my-listing-card ${!listing.is_active ? 'inactive' : ''}`;
    card.dataset.listingId = listing.listing_id; // Зберігаємо ID

    card.innerHTML = `
        <a href="listing_detail.html?id=${listing.listing_id}" class="my-listing-link">
            <img src="${imageUrl}" alt="${listing.title}" class="my-listing-image">
            <div class="my-listing-info">
                 <h3>${listing.title}</h3>
                 <p><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто'}</p>
                 <p class="my-listing-status">
                     Статус: ${listing.is_active ? '<span style="color: var(--success-color);">Активне</span>' : '<span style="color: var(--danger-color);">Неактивне</span>'}
                 </p>
                 ${typeTag}
            </div>
        </a>
        <div class="my-listing-actions">
             <button class="action-btn edit" title="Редагувати"><i class="fas fa-pencil-alt"></i></button>
            <button class="action-btn toggle-status" title="${listing.is_active ? 'Деактивувати' : 'Активувати'}">
                ${listing.is_active ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'}
            </button>
            <button class="action-btn delete" title="Видалити"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;

    // Додаємо обробники подій для кнопок
    card.querySelector('.edit').addEventListener('click', () => {
        window.location.href = `edit_listing.html?id=${listing.listing_id}`;
    });
    card.querySelector('.toggle-status').addEventListener('click', () => {
        handleToggleListingStatus(listing.listing_id, !listing.is_active); // Передаємо НОВИЙ бажаний статус
    });
    card.querySelector('.delete').addEventListener('click', () => {
        handleDeleteListing(listing.listing_id);
    });

    container.appendChild(card);
}


/**
 * Обробляє зміну статусу активності оголошення.
 * @param {number} listingId - ID оголошення.
 * @param {boolean} newStatus - Бажаний новий статус (true - активне, false - неактивне).
 */
async function handleToggleListingStatus(listingId, newStatus) {
    if (!confirm(`Ви впевнені, що хочете ${newStatus ? 'активувати' : 'деактивувати'} це оголошення?`)) {
        return;
    }

    const card = document.querySelector(`.my-listing-card[data-listing-id="${listingId}"]`);
    const toggleButton = card?.querySelector('.toggle-status');
    if(toggleButton) toggleButton.disabled = true; // Блокуємо кнопку

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

        // Оновлюємо вигляд картки
        if (card) {
            const statusText = card.querySelector('.my-listing-status');
            if (newStatus) {
                card.classList.remove('inactive');
                statusText.innerHTML = 'Статус: <span style="color: var(--success-color);">Активне</span>';
                toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>';
                toggleButton.title = 'Деактивувати';
            } else {
                card.classList.add('inactive');
                statusText.innerHTML = 'Статус: <span style="color: var(--danger-color);">Неактивне</span>';
                toggleButton.innerHTML = '<i class="fas fa-eye"></i>';
                toggleButton.title = 'Активувати';
            }
        }
        // alert(result.message); // Можна не показувати alert, зміна UI достатня

    } catch (error) {
        console.error('Помилка зміни статусу:', error);
        alert(`Помилка: ${error.message}`);
    } finally {
        if(toggleButton) toggleButton.disabled = false; // Розблоковуємо кнопку
    }
}

/**
 * Обробляє видалення оголошення.
 * @param {number} listingId - ID оголошення для видалення.
 */
async function handleDeleteListing(listingId) {
    if (!confirm('ВИДАЛИТИ ОГОЛОШЕННЯ?\n\nЦю дію неможливо скасувати.\nВсі дані, пов\'язані з оголошенням, буде втрачено.')) {
        return;
    }

    const card = document.querySelector(`.my-listing-card[data-listing-id="${listingId}"]`);
    const deleteButton = card?.querySelector('.delete');
    if(deleteButton) deleteButton.disabled = true;

    try {
        const response = await fetch(`http://localhost:3000/api/listings/${listingId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Не вдалося видалити оголошення');
        }

        // Видаляємо картку зі сторінки плавно
        if (card) {
            card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
                card.remove();
                // Перевіряємо, чи залишились ще оголошення
                const container = document.getElementById('myListingsContainer');
                if (container && container.children.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">У вас більше немає створених оголошень.</p>';
                }
            }, 300); // Час має співпадати з transition
        }
        // alert(result.message); // Можна не показувати alert

    } catch (error) {
        console.error('Помилка видалення:', error);
        alert(`Помилка: ${error.message}`);
        if(deleteButton) deleteButton.disabled = false; // Розблоковуємо у разі помилки
    }
}


// --- Логіка "Обраного" (можна винести в favorites.js) ---

// Глобальна множина ID обраних оголошень (ініціалізується в app.js)
export let currentUserFavoriteIds = new Set();

/**
 * Завантажує ID обраних оголошень для поточного користувача.
 * Викликається один раз при завантаженні програми.
 */
export const fetchFavoriteIds = async () => {
    if (!MY_USER_ID) {
        currentUserFavoriteIds = new Set(); // Скидаємо, якщо не залогінений
        return;
    }
    try {
        const response = await fetch('http://localhost:3000/api/my-favorites/ids', {
            headers: getAuthHeaders()
        });
        if (response.ok) {
            const ids = await response.json();
            currentUserFavoriteIds = new Set(ids);
            console.log('ID обраних завантажено:', currentUserFavoriteIds);
        } else {
            console.error('Не вдалося завантажити ID обраних, статус:', response.status);
            currentUserFavoriteIds = new Set(); // Скидаємо у разі помилки
        }
    } catch (error) {
        console.error('Помилка мережі при завантаженні ID обраних:', error);
        currentUserFavoriteIds = new Set(); // Скидаємо у разі помилки
    }
};

/**
 * Налаштовує логіку кнопки "Обране" на сторінці деталей оголошення.
 * @param {string|number} listingId - ID поточного оголошення.
 * @param {number} authorId - ID автора оголошення.
 */
export function setupFavoriteButton(listingId, authorId) {
    const favButton = document.getElementById('favoriteBtn');
    if (!favButton) return;

    // Не показуємо кнопку, якщо не залогінений або це оголошення власника
    if (!MY_USER_ID || MY_USER_ID === authorId) {
        favButton.style.display = 'none';
        return;
    }

    const numericListingId = parseInt(listingId); // Перетворюємо на число для порівняння з Set

    // Показуємо кнопку і встановлюємо початковий стан
    favButton.style.display = 'flex'; // Використовуємо flex для центрування іконки
    const isFavorited = currentUserFavoriteIds.has(numericListingId);
    favButton.classList.toggle('favorited', isFavorited);
    favButton.querySelector('i').className = isFavorited ? 'fas fa-heart' : 'far fa-heart';
    favButton.title = isFavorited ? 'Видалити з обраного' : 'Додати у вибране';

    // Додаємо обробник кліка (асинхронний)
    favButton.addEventListener('click', async () => {
        const currentIsFavorited = favButton.classList.contains('favorited');
        const url = `http://localhost:3000/api/favorites/${listingId}`;
        const method = currentIsFavorited ? 'DELETE' : 'POST';

        favButton.disabled = true; // Блокуємо кнопку
        favButton.style.opacity = '0.5'; // Візуальний фідбек

        try {
            const response = await fetch(url, { method, headers: getAuthHeaders() });

            if (response.ok) {
                // Успіх! Оновлюємо UI та локальний Set
                if (currentIsFavorited) {
                    favButton.classList.remove('favorited');
                    favButton.querySelector('i').className = 'far fa-heart';
                    favButton.title = 'Додати у вибране';
                    currentUserFavoriteIds.delete(numericListingId);
                } else {
                    favButton.classList.add('favorited');
                    favButton.querySelector('i').className = 'fas fa-heart';
                    favButton.title = 'Видалити з обраного';
                    currentUserFavoriteIds.add(numericListingId);
                }
            } else if (response.status === 401 || response.status === 403) {
                alert('Будь ласка, увійдіть, щоб керувати обраним.');
                window.location.href = 'login.html';
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Не вдалося виконати дію');
            }
        } catch (error) {
            console.error('Помилка при оновленні обраного:', error);
            alert(`Помилка: ${error.message}. Спробуйте оновити сторінку.`);
            // Не змінюємо стан кнопки у разі помилки
        } finally {
            favButton.disabled = false; // Розблоковуємо кнопку
            favButton.style.opacity = '1';
        }
    });
}