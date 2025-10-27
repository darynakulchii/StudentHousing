import { removeToken, getAuthHeaders, handleLogin, handleRegistration, MY_USER_ID, handleLoginSettings } from './modules/auth.js';
import { loadConversations, handleMessageSend, handleChatUrlParams, setupSocketIO } from './modules/chat.js';
import {
    setupAddListingFormLogic, handleListingSubmission,
    handleListingUpdateSubmission, loadListingDataForEdit,
    setupHomepageFilters, updateFormState
} from './modules/forms.js';
import {loadProfileData, setupProfileEventListeners, loadSettingsData, handleSettingsSubmission, loadPublicProfileData} from './modules/profile.js';
import { DEFAULT_AVATAR_URL, initializeNavigation} from './modules/navigation.js'
import { universitiesData } from './modules/universities.js';

export const DEFAULT_LISTING_IMAGE = {
    'rent_out': './photo/default_listing_photo.png',
    'find_mate': './photo/default_listing_photo.png',
    'find_home': './photo/default_listing_photo.png',
    'default': './photo/default_listing_photo.png'
};

window.toggleOtherInput = (checkboxElement, inputId) => {
    const inputElement = document.getElementById(inputId);
    if (inputElement) {
        inputElement.style.display = checkboxElement.checked ? 'block' : 'none';
        inputElement.classList.toggle('hidden-other-input', !checkboxElement.checked);
        if (!checkboxElement.checked) {
            inputElement.value = '';
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
            inputElement.value = '';
        }
    }
    if(form && window.updateFormState) window.updateFormState(form);
};

let currentUserFavoriteIds = new Set();

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
        const defaultQuery = 'listing_type!=find_home';
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

const displayDataMapping = {
    'building_type': {
        'tsar_building': 'Царський будинок', 'austria_building': 'Австрійський будинок', 'polish_building': 'Польський будинок',
        'stalinka': 'Сталінка', 'hrushchovka': 'Хрущовка', 'cheshka': 'Чешка', 'panel': 'Панелька',
        'sovmin': 'Совмін', 'gostinka': 'Гостинка', 'gurtogitok': 'Гуртожиток', 'private_house': 'Приватний будинок',
        'housing_80_90': 'Житловий фонд 80-90-і', 'housing_91_2000': 'Житловий фонд 91-2000-і',
        'housing_2001_2010': 'Житловий фонд 2001-2010-і', 'housing_since_2011': 'Житловий фонд від 2011 р.',
        'new_building': 'Новобудова', 'other': 'Інший тип'
    },
    'wall_type': {
        'brick': 'Цегляний', 'panel': 'Панельний', 'monolithic': 'Монолітний', 'slag_block': 'Шлакоблочний',
        'wooden': 'Дерев\'яний', 'gas_block': 'Газоблок', 'sip_panel': 'СІП панель', 'other': 'Інший'
    },
    'planning': {
        'separate': 'Роздільна', 'adjacent_walkthrough': 'Суміжна, прохідна', 'studio': 'Студія', 'penthouse': 'Пентхаус',
        'multi_level': 'Багаторівнева', 'small_family_hostel': 'Малосімейка, гостинка', 'smart_apartment': 'Смарт-квартира',
        'free_planning': 'Вільне планування', 'two_sided': 'Двостороння', 'other': 'Інше'
    },
    'bathroom_type': {
        'separate': 'Роздільний', 'combined': 'Суміжний', 'two_or_more': '2 і більше', 'none': 'Санвузол відсутній'
    },
    'heating_type': {
        'central': 'Централізоване', 'own_boiler': 'Власна котельня', 'individual_gas': 'Індивідуальне газове',
        'individual_electric': 'Індивідуальне електро', 'solid_fuel': 'Твердопаливне', 'heat_pump': 'Тепловий насос',
        'combined': 'Комбіноване', 'other': 'Інше'
    },
    'renovation_type': {
        'design': 'Авторський проєкт', 'good': 'Євроремонт', 'cosmetic': 'Косметичний', 'no_renovation': 'Без ремонту',
        'other': 'Інше'
    },
    'furnishing': { 'yes': 'З меблями', 'no': 'Без меблів' },
    'pet_policy': { 'yes': 'Тварини дозволені', 'no': 'Без тварин' },
    'target_uni_distance': { 'any': 'Неважливо', 'walk': 'До 15 хв пішки', '20min_transport': 'До 20 хв транспортом', '30min_transport': 'До 30 хв транспортом' },
    'housing_type_search': { 'apartment': 'Квартира (повністю)', 'isolated_room': 'Кімната (ізольована)', 'walkthrough_room': 'Кімната (прохідна)', 'house': 'Часний будинок', 'any': 'Неважливо', 'other': 'Інше' }
};

const getDisplayValue = (field, value, otherValue) => {
    if (!value || value === 'other' && !otherValue) return null;
    if (value === 'other' && otherValue) return otherValue;

    if (field === 'ready_to_share') {
        if (value === 'yes') return 'Готовий ділити житло';
        if (value === 'no') return 'Проти ділення житла';
        if (value === 'any') return 'Неважливо (готовий до варіантів)';
        return null;
    }

    return displayDataMapping[field]?.[value] || value;
};

// --- Логіка listing_detail.html ---
const fetchAndDisplayListingDetail = async () => {
    const container = document.getElementById('listingDetailContainer');
    if (!container) return;

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
        document.title = `UniHome | ${listing.title}`;

        let mainImage = listing.photos?.find(p => p.is_main);
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

        const categoryNames = {
            'tech': 'Побутова техніка',
            'media': 'Мультимедіа',
            'comfort': 'Комфорт',
            'pets_allowed_detail': 'Домашні улюбленці (Дозволено)',
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
            'mate_pets': 'Тварини у сусіда',
            'university_kiev': 'Університети Києва',
            'university_lviv': 'Університети Львова',
            'university_kharkiv': 'Університети Харкова',
            'university_odesa': 'Університети Одеси',
            'university_dnipro': 'Університети Дніпра',
            'university_vinnytsya': 'Університети Вінниці',
            'university_zaporizhzhya': 'Університети Запоріжжя',
            'university_ivano_frankivsk': 'Університети Івано-Франківська',
            'university_chernivtsi': 'Університети Чернівців',
            'university_poltava': 'Університети Полтави',
            'university_sumy': 'Університети Сум',
            'university_uzhgorod': 'Університети Ужгорода',
            'university_ternopil': 'Університети Тернополя',
            'university_rivne': 'Університети Рівного',
            'university_lutsk': 'Університети Луцька',
            'university_khmelnytskyi': 'Університети Хмельницького',
            'university_chernihiv': 'Університети Чернігова',
            'university_mykolaiv': 'Університети Миколаєва',
        };

        const characteristicsByCategory = {};
        const universityCharsKeys = [];
        if (listing.characteristics) {
            listing.characteristics.forEach(char => {
                const category = char.category;
                if (category.startsWith('university_')) {
                    universityCharsKeys.push(char.system_key);
                }
                if (!characteristicsByCategory[category]) {
                    characteristicsByCategory[category] = [];
                }
                characteristicsByCategory[category].push(`<span class="char-tag">${char.name_ukr}</span>`);
            });
        }

        const getUniversityFullName = (value) => {
            if (value === 'other' && listing.target_university_other) {
                return listing.target_university_other;
            }
            for (const city in universitiesData) {
                const foundUni = universitiesData[city].find(uni => uni.value === value);
                if (foundUni) {
                    return foundUni.text;
                }
            }
            return value;
        };

        const buildCharSection = (categoriesToShow, forceSeparate = false) => {
            let html = '';
            for (const category of categoriesToShow) {
                const sectionTitle = categoryNames[category] || category.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                let characteristicsHTML = characteristicsByCategory[category] ? characteristicsByCategory[category].join('') : '';

                const otherTextKey = category + '_other_text';
                if (listing[otherTextKey] && listing[otherTextKey].trim() !== '') {
                    const otherTextTag = `<span class="char-tag">${listing[otherTextKey]}</span>`;
                    characteristicsHTML += otherTextTag;
                }

                if (characteristicsHTML) {
                    html += `
                        <div class="char-category-group" ${forceSeparate ? 'style="width: 100%;"' : ''}>
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
        let housingExtraDetailsHTML = '';

        if (listing.listing_type === 'rent_out' || listing.listing_type === 'find_mate') {
            // Fields for available housing (Характеристики житла)
            housingExtraDetailsHTML += `<div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">`;

            const buildingType = getDisplayValue('building_type', listing.building_type, listing.building_type_other);
            if (buildingType) housingExtraDetailsHTML += `<span class="char-tag">Тип будинку: ${buildingType}</span>`;

            const wallType = getDisplayValue('wall_type', listing.wall_type, listing.wall_type_other);
            if (wallType) housingExtraDetailsHTML += `<span class="char-tag">Тип стін: ${wallType}</span>`;

            const planning = getDisplayValue('planning', listing.planning, listing.planning_other);
            if (planning) housingExtraDetailsHTML += `<span class="char-tag">Планування: ${planning}</span>`;

            const bathroomType = getDisplayValue('bathroom_type', listing.bathroom_type);
            if (bathroomType) housingExtraDetailsHTML += `<span class="char-tag">Санвузол: ${bathroomType}</span>`;

            const heatingType = getDisplayValue('heating_type', listing.heating_type, listing.heating_type_other);
            if (heatingType) housingExtraDetailsHTML += `<span class="char-tag">Опалення: ${heatingType}</span>`;

            const renovationType = getDisplayValue('renovation_type', listing.renovation_type, listing.renovation_type_other);
            if (renovationType) housingExtraDetailsHTML += `<span class="char-tag">Ремонт: ${renovationType}</span>`;

            const furnishing = getDisplayValue('furnishing', listing.furnishing);
            if (furnishing) housingExtraDetailsHTML += `<span class="char-tag">Меблювання: ${furnishing}</span>`;

            const petPolicy = getDisplayValue('pet_policy', listing.pet_policy);
            if (petPolicy) housingExtraDetailsHTML += `<span class="char-tag">Тварини: ${petPolicy}</span>`;

            if (listing.listing_type === 'rent_out') {
                if (listing.max_occupants) housingExtraDetailsHTML += `<span class="char-tag">Макс. мешканців: ${listing.max_occupants}</span>`;
            } else if (listing.listing_type === 'find_mate') {
                if (listing.current_occupants) housingExtraDetailsHTML += `<span class="char-tag">Проживає: ${listing.current_occupants}</span>`;
                if (listing.seeking_roommates) housingExtraDetailsHTML += `<span class="char-tag">Шукають: ${listing.seeking_roommates} сусіда</span>`;
            }

            housingExtraDetailsHTML += `</div>`;
        } else if (listing.listing_type === 'find_home') {
            housingExtraDetailsHTML += `<div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">`;

            const desiredHousingType = getDisplayValue('housing_type_search', listing.housing_type_search, listing.housing_type_search_other);
            if (desiredHousingType) housingExtraDetailsHTML += `<span class="char-tag">Шуканий тип житла: ${desiredHousingType}</span>`;

            if (listing.target_rooms) housingExtraDetailsHTML += `<span class="char-tag">Мін. кімнат: ${listing.target_rooms}</span>`;
            if (listing.target_roommates_max) housingExtraDetailsHTML += `<span class="char-tag">Макс. людей у квартирі: ${listing.target_roommates_max}</span>`;

            const petPolicySearch = getDisplayValue('search_pet_policy', listing.search_pet_policy);
            if (petPolicySearch) housingExtraDetailsHTML += `<span class="char-tag">Бажані тварини: ${petPolicySearch}</span>`;

            const readyToShare = getDisplayValue('ready_to_share', listing.ready_to_share);
            if (readyToShare && listing.ready_to_share !== 'no') {
                housingExtraDetailsHTML += `<span class="char-tag">Готовність ділити житло: ${readyToShare}</span>`;
            } else if (readyToShare && listing.ready_to_share === 'no') {
            }

            if (listing.target_uni_distance && listing.target_university) {
                const distance = getDisplayValue('target_uni_distance', listing.target_uni_distance);
                const uniName = getUniversityFullName(listing.target_university);
                housingExtraDetailsHTML += `<span class="char-tag">Віддаленість від ${uniName}: ${distance}</span>`;
            } else if (listing.target_uni_distance) {
                const distance = getDisplayValue('target_uni_distance', listing.target_uni_distance);
                housingExtraDetailsHTML += `<span class="char-tag">Бажана віддаленість від ВНЗ: ${distance}</span>`;
            }


            housingExtraDetailsHTML += `</div>`;
        }

        if (listing.listing_type === 'find_home' || listing.listing_type === 'find_mate') {
            const myCategories = ['my_personality', 'my_lifestyle', 'my_interests', 'my_pets'];
            const myCharsHTML = buildCharSection(myCategories);

            if (listing.my_age || listing.my_gender || listing.my_smoking || listing.my_drinking || listing.my_guests || myCharsHTML) {
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

            const hasRoommatePrefs = (
                (listing.roommate_gender && listing.roommate_gender !== 'any') ||
                listing.roommate_age_min ||
                listing.roommate_age_max ||
                (listing.roommate_smoking && listing.roommate_smoking !== 'any') ||
                (listing.roommate_drinking && listing.roommate_drinking !== 'any') ||
                (listing.roommate_guests && listing.roommate_guests !== 'any') ||
                (listing.roommate_description && listing.roommate_description.trim() !== '') ||
                mateCharsHTML.trim() !== ''
            );

            if (hasRoommatePrefs) {
                roommatePrefsHTML = `
                    <div class="detail-section">
                        <h2>Вимоги до сусіда</h2>
                         <div class="characteristics-list" style="flex-direction: column; align-items: flex-start; gap: 5px; margin-bottom: 15px;">
                            ${listing.roommate_gender && listing.roommate_gender !== 'any' ? `<span class="char-tag">Стать: ${listing.roommate_gender === 'female' ? 'Жіноча' : (listing.roommate_gender === 'male' ? 'Чоловіча' : 'Інша')}</span>` : ''}
                            ${listing.roommate_age_min || listing.roommate_age_max ? `<span class="char-tag">Вік: ${listing.roommate_age_min || 'Від'} - ${listing.roommate_age_max || 'До'}</span>` : ''}
                            ${listing.roommate_smoking && listing.roommate_smoking !== 'any' ? `<span class="char-tag">Паління (сусід): ${listing.roommate_smoking === 'no' ? 'Не палить' : (listing.roommate_smoking === 'yes' ? 'Палить' : 'Палить (лише на вулиці)')}</span>` : ''}
                            ${listing.roommate_drinking && listing.roommate_drinking !== 'any' ? `<span class="char-tag">Алкоголь (сусід): ${listing.roommate_drinking === 'no' ? 'Не вживає' : (listing.roommate_drinking === 'rarely' ? 'Рідко' : 'Вживає')}</span>` : ''}
                            ${listing.roommate_guests && listing.roommate_guests !== 'any' ? `<span class="char-tag">Гості (сусід): ${listing.roommate_guests === 'no' ? 'Без гостей' : (listing.roommate_guests === 'rarely' ? 'Рідко' : (listing.roommate_guests === 'sometimes' ? 'Іноді' : 'Часто'))}</span>` : ''}
                         </div>
                        ${mateCharsHTML}
                        ${listing.roommate_description ? `<div class="char-category-group"><h3>Додаткові побажання</h3><p>${listing.roommate_description.replace(/\n/g, '<br>')}</p></div>` : ''}
                    </div>
                `;
            } else {
                roommatePrefsHTML = '';
            }
        }

        // Розділяємо характеристики житла на блоки
        const techCharsHTML = buildCharSection(['tech']);
        const mediaCharsHTML = buildCharSection(['media']);
        const comfortCharsHTML = buildCharSection(['comfort']);
        const petsDetailCharsHTML = (listing.pet_policy === 'yes' && listing.listing_type !== 'find_home') ? buildCharSection(['pets_allowed_detail']) : '';
        const blackoutCharsHTML = buildCharSection(['blackout']);
        const rulesCharsHTML = buildCharSection(['rules']);
        const commCharsHTML = buildCharSection(['communications']);
        const infraCharsHTML = buildCharSection(['infra']);
        const inclusiveCharsHTML = buildCharSection(['inclusive']);

        const apartmentCharGroupsHTML = `
            ${techCharsHTML}
            ${mediaCharsHTML}
            ${comfortCharsHTML}
            ${petsDetailCharsHTML}
            ${blackoutCharsHTML}
            ${rulesCharsHTML}
            ${commCharsHTML}
            ${infraCharsHTML}
            ${inclusiveCharsHTML}
        `;

        let universityChars = universityCharsKeys.map(key => {
            const uniName = getUniversityFullName(key);
            return `<span class="char-tag">${uniName}</span>`;
        }).join('') || '';

        let optionalFieldsHTML = '';
        if (listing.study_conditions) {
            optionalFieldsHTML += `<div class="char-category-group"><h3>Умови для навчання</h3><p>${listing.study_conditions.replace(/\n/g, '<br>')}</p></div>`;
        }
        if (listing.owner_rules && listing.listing_type === 'rent_out') {
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

        const displayCity = listing.city === 'other' && listing.city_other
            ? listing.city_other
            : (listing.city || 'Місто не вказано');
        const displayDistrict = listing.district === 'other' && listing.district_other ? listing.district_other : listing.district;

        if (listing.listing_type === 'find_home') {
            housingCharsHTML = `
                <div class="detail-section">
                    <h2>Бажані характеристики житла</h2>
                    ${housingExtraDetailsHTML}
                    ${apartmentCharGroupsHTML.trim() ? `
                        <div class="characteristics-list-columns">
                            ${apartmentCharGroupsHTML}
                        </div>
                    ` : '<p>Автор не вказав бажаних характеристик.</p>'}
                    ${nearbyUniversitiesHTML}
                    ${optionalFieldsHTML}
                </div>
            `;
        } else if (listing.listing_type === 'rent_out' || listing.listing_type === 'find_mate') {
            housingCharsHTML = `
                <div class="detail-section">
                    <h2>Характеристики житла</h2>
                     ${housingExtraDetailsHTML}
                     ${apartmentCharGroupsHTML.trim() ? `
                        <div class="characteristics-list-columns">
                            ${apartmentCharGroupsHTML}
                        </div>
                    ` : '<p>Детальні характеристики не вказані.</p>'}
                    ${nearbyUniversitiesHTML}
                    ${optionalFieldsHTML}
                 </div>
            `;
        }

        let profileLinkUrl;

        if (MY_USER_ID && MY_USER_ID === listing.user_id) {
            profileLinkUrl = 'profile.html';
        } else {
            profileLinkUrl = `user_profile.html?id=${listing.user_id}`;
        }
        console.log(`Generated profile link: ${profileLinkUrl}`);

        let priceDisplayHTML = '';

        if (listing.listing_type === 'find_home') {
            const minPrice = listing.target_price_min;
            const maxPrice = listing.target_price_max;
            if (minPrice && maxPrice) {
                priceDisplayHTML = `Бюджет: ₴${minPrice} - ${maxPrice} / міс`;
            } else if (minPrice) {
                priceDisplayHTML = `Бюджет: Від ₴${minPrice} / міс`;
            } else if (maxPrice) {
                priceDisplayHTML = `Бюджет: До ₴${maxPrice} / міс`;
            } else {
                priceDisplayHTML = 'Бюджет не вказано';
            }
        } else {
            priceDisplayHTML = `₴${listing.price || 'Не вказано'} / міс`;
        }

        const authorAvatarHTML = `
             <a href="user_profile.html?id=${listing.user_id}" class="author-name-link">
                 <div class="author-avatar">
                     <img src="${listing.avatar_url || DEFAULT_AVATAR_URL}" alt="Аватар автора">
                 </div>
            </a>
        `;

        let authorPhoneHTML = '';
        if (listing.show_phone_publicly && listing.phone_number) {
            authorPhoneHTML = `
                <div class="profile-phone-public" style="display: flex; margin-top: 10px;">
                    <i class="fas fa-phone"></i>
                    <a href="tel:${listing.phone_number}">${listing.phone_number}</a>
                </div>
            `;
        }

        const contactButtonHTML = (MY_USER_ID === listing.user_id)
            ? `<a href="../profile.html" class="contact-btn" style="background: #7f8c8d;">
                 <i class="fas fa-user-edit"></i> Це ваше оголошення
               </a>`
            : (MY_USER_ID ? `<a href="chat.html?user_id=${listing.user_id}" class="contact-btn">
                 <i class="fas fa-comment-dots"></i> Зв'язатись з автором
               </a>` : `<a href="../login.html" class="contact-btn">
                 <i class="fas fa-sign-in-alt"></i> Увійдіть, щоб зв'язатись
               </a>`);

        // --- Логіка для відображення університету ---
        let universityDisplayHTML = '';
        if (listing.listing_type === 'find_home' && listing.target_university) {
            const uniName = getUniversityFullName(listing.target_university);
            universityDisplayHTML = `<p><i class="fas fa-university"></i> Шукає біля: ${uniName}</p>`;
        }

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
                    
                    <span class="detail-price">${priceDisplayHTML}</span>

                    <div class="detail-meta">
                        <p><i class="fas fa-map-marker-alt"></i> ${displayCity}${displayDistrict ? `, ${displayDistrict}` : ''}${listing.address ? `, ${listing.address}` : ''}</p>
                        ${universityDisplayHTML}
                        ${listing.rooms ? `<p><i class="fas fa-door-open"></i> Кімнат: ${listing.rooms}</p>` : ''}
                        ${listing.total_area ? `<p><i class="fas fa-ruler-combined"></i> Площа: ${listing.total_area} м²</p>` : ''}
                        ${listing.kitchen_area ? `<p><i class="fas fa-utensils"></i> Кухня: ${listing.kitchen_area} м²</p>` : ''}
                        ${listing.floor && listing.total_floors ? `<p><i class="fas fa-building"></i> Поверх: ${listing.floor} / ${listing.total_floors}</p>` : ''}
                    </div>

                    <div id="listingMap" style="height: 300px; margin-top: 20px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 20px;"></div>

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
                        <a href="${profileLinkUrl}" class="author-name-link"> <p class="author-name">${listing.first_name} ${listing.last_name}</p>
                        </a>
                        ${authorPhoneHTML}
                        ${contactButtonHTML}
                    </div>
                </aside>
            </div>
        `;
        container.innerHTML = detailHTML;

        const listingMapElement = document.getElementById('listingMap');
        console.log("Attempting to initialize map on detail page. Map element found:", !!listingMapElement);

        if (listingMapElement) {
            console.log("Coordinates received from backend:", { latitude: listing.latitude, longitude: listing.longitude });

            const lat = listing.latitude ? parseFloat(listing.latitude) : null;
            const lng = listing.longitude ? parseFloat(listing.longitude) : null;
            console.log("Parsed coordinates:", { lat, lng });

            if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
                listingMapElement.style.display = 'block';
                listingMapElement.innerHTML = '';

                try {
                    console.log("Initializing Leaflet map at:", [lat, lng]);
                    const detailMap = L.map(listingMapElement).setView([lat, lng], 15);

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    }).addTo(detailMap);

                    L.marker([lat, lng]).addTo(detailMap)
                        .bindPopup(listing.title || 'Розташування')
                        .openPopup();

                    setTimeout(() => {
                        if (detailMap) {
                            detailMap.invalidateSize();
                            console.log("Detail map size invalidated.");
                        }
                    }, 10);

                } catch (mapError) {
                    console.error("Помилка ініціалізації карти Leaflet:", mapError);
                    listingMapElement.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Помилка при відображенні карти.</p>';
                    listingMapElement.style.height = 'auto';
                }
            } else {
                console.log("Coordinates are invalid or missing. Hiding map element.");
                listingMapElement.style.display = 'none';
                listingMapElement.innerHTML = '';
            }
        } else {
            console.error("Map container element (#listingMap) not found in the generated HTML.");
        }

        const thumbnails = container.querySelectorAll('.gallery-thumbnail:not(.inactive)');
        const mainImageElement = container.querySelector('#mainDetailImage');
        if (mainImageElement && thumbnails.length > 0) {
            thumbnails.forEach(thumb => {
                thumb.addEventListener('click', () => {
                    mainImageElement.src = thumb.src;
                    thumbnails.forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
            });
        }

        setupFavoriteButton(listingId, listing.user_id);

    } catch (error) {
        console.error('Error loading listing details:', error);
        container.innerHTML = '<h1 style="text-align: center;">Помилка завантаження</h1><p style="text-align: center;">Не вдалося отримати деталі. Перевірте консоль.</p>';
    }
};

const setupFavoriteButton = (listingId, authorId) => {
    const favButton = document.getElementById('favoriteBtn');
    if (!favButton) return;

    if (!MY_USER_ID || MY_USER_ID === authorId) {
        favButton.style.display = 'none';
        return;
    }

    favButton.style.display = 'flex';

    if (currentUserFavoriteIds.has(parseInt(listingId))) {
        favButton.classList.add('favorited');
        favButton.querySelector('i').className = 'fas fa-heart';
        favButton.title = 'Видалити з обраного';
    } else {
        favButton.classList.remove('favorited');
        favButton.querySelector('i').className = 'far fa-heart';
        favButton.title = 'Додати у вибране';
    }

    favButton.addEventListener('click', async () => {
        const isFavorited = favButton.classList.contains('favorited');
        const url = `http://localhost:3000/api/favorites/${listingId}`;
        const method = isFavorited ? 'DELETE' : 'POST';

        try {
            favButton.disabled = true;

            const response = await fetch(url, {
                method: method,
                headers: getAuthHeaders()
            });

            if (response.ok) {
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
            favButton.disabled = false;
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

    container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Завантаження обраних...</p>';

    try {
        const response = await fetch('http://localhost:3000/api/my-favorites', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP помилка! статус: ${response.status}`);
        }

        const listings = await response.json();
        container.innerHTML = '';

        if (listings.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">Ви ще не додали жодного оголошення до вибраного.</p>';
            return;
        }

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
        container.innerHTML = '';

        if (listings.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">У вас ще немає створених оголошень.</p>';
            return;
        }

        listings.forEach(listing => {
            const imageUrl = listing.main_photo_url || DEFAULT_LISTING_IMAGE[listing.listing_type] || DEFAULT_LISTING_IMAGE['default'];

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
            listingCard.dataset.listingId = listing.listing_id;

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

            listingCard.querySelector('.toggle-status').addEventListener('click', () => {
                handleToggleListingStatus(listing.listing_id, !listing.is_active);
            });
            listingCard.querySelector('.delete').addEventListener('click', () => {
                handleDeleteListing(listing.listing_id);
            });

            listingCard.querySelector('.edit').addEventListener('click', () => {
                window.location.href = `edit_listing.html?id=${listing.listing_id}`;
            });

            container.appendChild(listingCard);
        });

    } catch (error) {
        console.error('Помилка завантаження моїх оголошень:', error);
        container.innerHTML = `<p style="color: red; padding: 10px;">Помилка завантаження. ${error.message}</p>`;
        if (error.message === 'Необхідна автентифікація.') {
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

        const card = document.querySelector(`.my-listing-card[data-listing-id="${listingId}"]`);
        if (card) {
            card.remove();
        }

        const container = document.getElementById('myListingsContainer');
        if (container && container.children.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">У вас більше немає створених оголошень.</p>';
        }

    } catch (error) {
        console.error('Помилка видалення:', error);
        alert(`Помилка: ${error.message}`);
    }
};

// ЛОГІКА СТОРІНКИ report_bug.html
const setupReportBugPage = () => {
    const reportForm = document.getElementById('reportForm');
    if (!reportForm) return;

    const problemTags = reportForm.querySelectorAll('.problem-tag');
    const hiddenCheckboxesContainer = document.getElementById('hiddenProblemTypes');
    const descriptionInput = document.getElementById('problemDescription');
    const fileInput = document.getElementById('fileInput');
    const fileListContainer = document.getElementById('fileList');
    const submitBtn = reportForm.querySelector('.submit-btn');
    const cancelBtn = reportForm.querySelector('.cancel-btn');
    const selectedProblemTypes = new Set();

    const updateHiddenCheckboxes = () => {
        hiddenCheckboxesContainer.innerHTML = '';
        selectedProblemTypes.forEach(value => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'problemTypes[]';
            checkbox.value = value;
            checkbox.checked = true;
            hiddenCheckboxesContainer.appendChild(checkbox);
        });
    };

    const updateFileList = () => {
        if (!fileListContainer) return;

        fileListContainer.innerHTML = '';

        if (fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                const listItem = document.createElement('div');
                listItem.className = 'file-list-item';
                listItem.innerHTML = `
                    <i class="fas fa-file-alt"></i> <span>${file.name}</span>       `;
                fileListContainer.appendChild(listItem);
            }
        }
    };

    problemTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const value = tag.dataset.value;

            tag.classList.toggle('active');

            if (tag.classList.contains('active')) {
                selectedProblemTypes.add(value);
            } else {
                selectedProblemTypes.delete(value);
            }

            updateHiddenCheckboxes();
            console.log('Вибрані типи проблем:', Array.from(selectedProblemTypes));
        });
    });

    if (fileInput) {
        fileInput.addEventListener('change', updateFileList);
    }

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = descriptionInput.value.trim();

        if (selectedProblemTypes.size === 0) {
            alert('Будь ласка, оберіть хоча б один тип проблеми.');
            return;
        }
        if (!description) {
            alert('Будь ласка, опишіть проблему.');
            descriptionInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Надсилання...';

        const formData = new FormData(reportForm);
        try {
            const response = await fetch('http://localhost:3000/api/report-bug', {
                method: 'POST',
                headers: getAuthHeaders(false),
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP помилка! Статус: ${response.status}`);
            }

            const result = await response.json();
            alert(result.message);
            reportForm.reset();
            selectedProblemTypes.clear();
            problemTags.forEach(tag => tag.classList.remove('active'));
            fileListContainer.innerHTML = '';
            updateHiddenCheckboxes();

        } catch (error) {
            console.error('Помилка надсилання звіту:', error);
            alert(`Помилка: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Надіслати';
        }
    });

    cancelBtn.addEventListener('click', () => {
        if (confirm('Ви впевнені, що хочете скасувати звіт? Введені дані буде втрачено.')) {
            reportForm.reset();
            selectedProblemTypes.clear();
            problemTags.forEach(tag => tag.classList.remove('active'));
            fileListContainer.innerHTML = '';
            updateHiddenCheckboxes();
        }
    });
};

// =================================================================================
// 5. ГОЛОВНИЙ ВИКОНАВЧИЙ БЛОК
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        console.log(">>> Async function started.");
        await fetchFavoriteIds();
        setupSocketIO();

        const path = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        const listingId = urlParams.get('id');
        const userIdForProfile = urlParams.get('id');

        await initializeNavigation();

        // Головна сторінка
        if (path.endsWith('/') || path.endsWith('index.html')) {
            await fetchAndDisplayListings('listing_type!=find_home');
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
            if (!listingId) { window.location.href = 'my_listings.html'; }
            else if (!MY_USER_ID) {window.location.href = 'login.html'; }
            else {
                const editFormHandler = await handleListingUpdateSubmission();
                await loadListingDataForEdit('editListingForm', listingId, editFormHandler.loadInitialPhotos);
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
            if (!MY_USER_ID) {window.location.href = 'login.html'; }
            else {
                await loadConversations();
                handleMessageSend();
                await handleChatUrlParams();
            }
        }
        // Налаштування
        else if (path.endsWith('settings.html')) {
            await loadSettingsData();
            handleSettingsSubmission();

            document.getElementById('btnDeleteAccount')?.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!confirm('Ви справді хочете видалити свій акаунт? Цю дію неможливо скасувати.')) return;
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
        else if (path.endsWith('user_profile.html')) {
            const userIdForProfile = urlParams.get('id');
            if (!userIdForProfile) {
                console.error(">>> Router: User ID not found in URL for profile page!");
                document.body.innerHTML = '<h1>Помилка: ID користувача не вказано в URL.</h1>';
            } else {
                await loadPublicProfileData();
                console.log(">>> Router: Called loadPublicProfileData()");
            }
        }

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
    })();
});
