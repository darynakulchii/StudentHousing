// =================================================================================
// 0. ІМПОРТИ ТА ГЛОБАЛЬНІ ДАНІ
// =================================================================================

// ВИКОРИСТОВУЄМО ДАНІ З МОДУЛЯ
import { removeToken, getAuthHeaders, handleLogin, handleRegistration, MY_USER_ID, handleLoginSettings } from './modules/auth.js';
import { loadConversations, handleMessageSend, handleChatUrlParams, setupSocketIO } from './modules/chat.js';
import {
    setupAddListingFormLogic, handleListingSubmission,
    handleListingUpdateSubmission, loadListingDataForEdit,
    setupHomepageFilters
} from './modules/forms.js';
import {loadProfileData, setupProfileEventListeners, loadSettingsData, handleSettingsSubmission, loadPublicProfileData} from './modules/profile.js';
import { DEFAULT_AVATAR_URL, initializeNavigation} from './modules/navigation.js'

// --- ФОТО: Додаємо URL за замовчуванням ---
export const DEFAULT_LISTING_IMAGE = {
    'rent_out': 'https://via.placeholder.com/400x300.png?text=Rent+Out',
    'find_mate': 'https://via.placeholder.com/400x300.png?text=Find+Mate',
    'find_home': 'https://via.placeholder.com/400x300.png?text=Find+Home',
    'default': 'https://picsum.photos/400/300' // Загальний
};

// *** ДОДАНО: Глобальна функція для перемикання полів "Інше" ***
window.toggleOtherInput = (checkboxElement, inputId) => {
    const inputElement = document.getElementById(inputId);
    if (inputElement) {
        inputElement.style.display = checkboxElement.checked ? 'block' : 'none';
        inputElement.classList.toggle('hidden-other-input', !checkboxElement.checked);
        if (!checkboxElement.checked) {
            inputElement.value = ''; // Очищаємо поле, якщо чекбокс знято
        }
    }
};

window.toggleOtherCityInput = (selectElement) => {
    const inputElement = document.getElementById('city_other_text');
    if (inputElement) {
        const isOther = selectElement.value === 'other';
        inputElement.style.display = isOther ? 'block' : 'none';
        inputElement.classList.toggle('hidden-other-input', !isOther);
        if (!isOther) {
            inputElement.value = ''; // Очищаємо поле, якщо вибрано не "Інше"
        }
    }
};

// =================================================================================
// 1. ГЛОБАЛЬНІ ЗМІННІ ТА ФУНКЦІЇ ІНТЕРФЕЙСУ (Навігація, Сповіщення)
// =================================================================================

let currentUserFavoriteIds = new Set(); // Зберігає ID обраних оголошень

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

// =================================================================================
// 3. ЛОГІКА КОНКРЕТНИХ СТОРІНОК
// =================================================================================

// --- Логіка index.html (Головна сторінка, Фільтри) ---

export const fetchAndDisplayListings = async (filterQuery = '') => {
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

        const buildCharSection = (categoriesToShow) => {
            let html = '';
            for (const category of categoriesToShow) {
                const sectionTitle = categoryNames[category] || category.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()); // Fallback title
                let characteristicsHTML = characteristicsByCategory[category] ? characteristicsByCategory[category].join('') : '';

                const otherTextKey = category + '_other_text';
                if (listing[otherTextKey] && listing[otherTextKey].trim() !== '') {
                    const otherTextTag = `<span class="char-tag">${listing[otherTextKey]}</span>`;
                    characteristicsHTML += otherTextTag;
                }

                if (characteristicsHTML) {
                    html += `
                        <div class="char-category-group">
                            <h3>${sectionTitle}</h3>
                            <div class="characteristics-list">
                                ${characteristicsHTML}
                            </div>
                        </div>
                    `;
                }
            }
            return html;
        };

        let aboutAuthorHTML = '';
        let roommatePrefsHTML = '';
        let housingCharsHTML = '';

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

        const apartmentCategories = [
            'tech', 'media', 'comfort', ...(listing.pet_policy === 'yes' ? ['pets_allowed_detail'] : []),
            'blackout', 'rules', 'communications', 'infra', 'inclusive'
        ];
        const universityChars = listing.characteristics?.filter(c => c.category.startsWith('university_'))
            .map(c => `<span class="char-tag">${c.name_ukr}</span>`).join('') || '';

        const apartmentCharsHTML = buildCharSection(apartmentCategories);

        let optionalFieldsHTML = '';
        if (listing.study_conditions) {
            optionalFieldsHTML += `<div class="char-category-group"><h3>Умови для навчання</h3><p>${listing.study_conditions.replace(/\n/g, '<br>')}</p></div>`;
        }
        if (listing.owner_rules && listing.listing_type === 'rent_out') { // Only for rent_out
            optionalFieldsHTML += `<div class="char-category-group"><h3>Правила від власника</h3><p>${listing.owner_rules.replace(/\n/g, '<br>')}</p></div>`;
        }
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

        const displayDistrict = listing.district === 'other' && listing.district_other ? listing.district_other : listing.district;
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
                        <p><i class="fas fa-map-marker-alt"></i> ${listing.city || 'Місто не вказано'} ${displayDistrict ? `, ${displayDistrict}` : ''} ${listing.address ? `, ${listing.address}` : ''}</p>
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

// =================================================================================
// ЛОГІКА СТОРІНКИ report_bug.html
// =================================================================================

const setupReportBugPage = () => {
    const reportForm = document.getElementById('reportForm');
    if (!reportForm) return;

    const problemTags = reportForm.querySelectorAll('.problem-tag'); // Кнопки вибору типу
    const hiddenCheckboxesContainer = document.getElementById('hiddenProblemTypes'); // Контейнер для прихованих чекбоксів
    const descriptionInput = document.getElementById('problemDescription'); // Поле для опису
    const fileInput = document.getElementById('fileInput'); // Інпут для файлів
    const fileListContainer = document.getElementById('fileList'); // Контейнер для списку файлів
    const submitBtn = reportForm.querySelector('.submit-btn'); // Кнопка "Надіслати"
    const cancelBtn = reportForm.querySelector('.cancel-btn'); // Кнопка "Скасувати"

    // Використовуємо Set для зберігання унікальних вибраних значень типів проблеми
    const selectedProblemTypes = new Set();

    /**
     * Оновлює приховані чекбокси, які будуть надіслані з формою.
     * Створює <input type="checkbox" name="problemTypes[]" value="..." checked>
     * для кожного вибраного типу проблеми.
     */
    const updateHiddenCheckboxes = () => {
        hiddenCheckboxesContainer.innerHTML = ''; // Очищуємо попередні чекбокси
        // Для кожного вибраного типу створюємо відповідний чекбокс
        selectedProblemTypes.forEach(value => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'problemTypes[]'; // Важливо: '[]' для передачі масиву
            checkbox.value = value;
            checkbox.checked = true; // Завжди позначений, бо він відповідає вибраному типу
            hiddenCheckboxesContainer.appendChild(checkbox);
        });
    };

    /**
     * Оновлює список імен вибраних файлів, що відображається користувачу.
     */
    const updateFileList = () => {
        // Якщо контейнер для списку не знайдено, виходимо
        if (!fileListContainer) return;

        fileListContainer.innerHTML = ''; // Очищуємо поточний список

        // Якщо файли вибрано, створюємо список
        if (fileInput.files.length > 0) {
            // Проходимо по кожному вибраному файлу
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                // Створюємо елемент списку
                const listItem = document.createElement('div');
                listItem.className = 'file-list-item'; // Додаємо CSS клас
                // Вставляємо іконку та ім'я файлу
                listItem.innerHTML = `
                    <i class="fas fa-file-alt"></i> <span>${file.name}</span>       `;
                // Додаємо елемент до контейнера
                fileListContainer.appendChild(listItem);
            }
        }
    };

    // --- Обробка кліку на кнопки типів проблеми ---
    problemTags.forEach(tag => {
        tag.addEventListener('click', () => {
            // Отримуємо значення типу проблеми з data-атрибута кнопки
            const value = tag.dataset.value;

            // Перемикаємо CSS клас 'active' для візуального підсвічування
            tag.classList.toggle('active');

            // Оновлюємо Set вибраних типів
            if (tag.classList.contains('active')) {
                selectedProblemTypes.add(value); // Додаємо тип, якщо кнопка стала активною
            } else {
                selectedProblemTypes.delete(value); // Видаляємо тип, якщо кнопка стала неактивною
            }

            // Оновлюємо приховані чекбокси, щоб дані коректно надіслались
            updateHiddenCheckboxes();

            // Виводимо в консоль поточний список вибраних типів (для налагодження)
            console.log('Вибрані типи проблем:', Array.from(selectedProblemTypes));
        });
    });

    // --- Додаємо слухача події 'change' для інпуту файлів ---
    if (fileInput) {
        // Коли користувач вибирає файли, викликаємо функцію оновлення списку
        fileInput.addEventListener('change', updateFileList);
    }

    // --- Обробка відправки форми ---
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Запобігаємо стандартній відправці форми
        const description = descriptionInput.value.trim(); // Отримуємо текст опису

        // --- Валідація форми ---
        if (selectedProblemTypes.size === 0) { // Перевіряємо, чи вибрано хоча б один тип
            alert('Будь ласка, оберіть хоча б один тип проблеми.');
            return; // Зупиняємо відправку
        }
        if (!description) { // Перевіряємо, чи введено опис
            alert('Будь ласка, опишіть проблему.');
            descriptionInput.focus(); // Ставимо фокус на поле опису
            return; // Зупиняємо відправку
        }
        // --- Кінець валідації ---

        // Блокуємо кнопку та змінюємо текст на час відправки
        submitBtn.disabled = true;
        submitBtn.textContent = 'Надсилання...';

        // Створюємо об'єкт FormData прямо з HTML-форми.
        // Він автоматично включатиме:
        // - Текст з <textarea name="problemDescription">
        // - Вибрані файли з <input type="file" name="files">
        // - Значення всіх checked чекбоксів з #hiddenProblemTypes (name="problemTypes[]")
        const formData = new FormData(reportForm);

        try {
            // Надсилаємо дані на сервер методом POST
            const response = await fetch('http://localhost:3000/api/report-bug', {
                method: 'POST',
                headers: getAuthHeaders(false), // Важливо: isJson=false для FormData
                body: formData, // Передаємо FormData
            });

            // Перевіряємо відповідь сервера
            if (!response.ok) {
                // Якщо помилка, намагаємось отримати текст помилки з відповіді
                const errorData = await response.json();
                // Кидаємо помилку, щоб перейти в блок catch
                throw new Error(errorData.error || `HTTP помилка! Статус: ${response.status}`);
            }

            // Якщо відповідь успішна (ok)
            const result = await response.json(); // Отримуємо дані з відповіді
            alert(result.message); // Показуємо повідомлення про успіх
            reportForm.reset(); // Скидаємо всі поля форми
            selectedProblemTypes.clear(); // Очищуємо Set вибраних типів
            problemTags.forEach(tag => tag.classList.remove('active')); // Знімаємо виділення з кнопок
            fileListContainer.innerHTML = ''; // Очищуємо список файлів
            updateHiddenCheckboxes(); // Очищуємо приховані чекбокси

        } catch (error) {
            // Обробка помилок (мережевих або отриманих від сервера)
            console.error('Помилка надсилання звіту:', error);
            alert(`Помилка: ${error.message}`); // Показуємо повідомлення про помилку
        } finally {
            // У будь-якому випадку (успіх чи помилка) розблоковуємо кнопку
            submitBtn.disabled = false;
            submitBtn.textContent = 'Надіслати';
        }
    });

    // --- Обробка кнопки "Скасувати" ---
    cancelBtn.addEventListener('click', () => {
        // Питаємо підтвердження у користувача
        if (confirm('Ви впевнені, що хочете скасувати звіт? Введені дані буде втрачено.')) {
            reportForm.reset(); // Скидаємо форму
            selectedProblemTypes.clear(); // Очищуємо Set
            problemTags.forEach(tag => tag.classList.remove('active')); // Знімаємо виділення кнопок
            fileListContainer.innerHTML = ''; // Очищуємо список файлів
            updateHiddenCheckboxes(); // Очищуємо приховані чекбокси
            // Можна додати перехід назад: history.back();
        }
    });
};

// =================================================================================
// 5. ГОЛОВНИЙ ВИКОНАВЧИЙ БЛОК (РОУТЕР)
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        await fetchFavoriteIds(); // Завантажуємо ID обраних
        setupSocketIO(); // Ініціалізуємо сокети

        const path = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('id'); // ID для detail та edit

        await initializeNavigation();

        // Головна сторінка
        if (path.endsWith('/') || path.endsWith('index.html')) {
            await fetchAndDisplayListings('listing_type!=find_home'); // Default view
            setupHomepageFilters();
        }
        // Реєстрація
        else if (path.endsWith('register.html')) { await handleRegistration(); }
        // Вхід
        else if (path.endsWith('login.html')) { await handleLogin(); }
        // Створення оголошення
        else if (path.endsWith('add_listing.html')) {
            setupAddListingFormLogic();
            await handleListingSubmission();
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

        // Налаштування сторінки звіту про помилку
        if (path.endsWith('report_bug.html')) {
            if (!MY_USER_ID) {
                alert('Будь ласка, увійдіть, щоб повідомити про помилку.');
                window.location.href = 'login.html';
                return;
            }
            setupReportBugPage();
        }

    })(); // Само_викликаюча асинхронна функція
});
