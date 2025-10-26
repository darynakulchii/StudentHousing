// =================================================================================
// FORMS MODULE
// =================================================================================

import { getAuthHeaders, MY_USER_ID } from './auth.js';
import { universitiesData } from './universities.js';
import { fetchAndDisplayListings } from '../app.js';
import { toggleFilters } from './navigation.js';

// --- Глобальні змінні для фото (специфічні для форм оголошень) ---
let addListingSelectedFiles = [];
let editListingCurrentPhotos = [];
let editListingPhotosToDelete = new Set();
let editListingNewFilesToUpload = [];
const MAX_PHOTOS = 8;

let map = null; // Змінна для зберігання екземпляру карти
let marker = null; // Змінна для зберігання маркера

const initializeMap = (formElement, initialLat = 49.8397, initialLng = 24.0297) => { // Координати Львова за замовчуванням
    const mapElement = formElement.querySelector('#map');
    const latitudeInput = formElement.querySelector('#latitude');
    const longitudeInput = formElement.querySelector('#longitude');

    if (!mapElement || !latitudeInput || !longitudeInput) {
        console.error("Map container or coordinate inputs not found in the form.");
        return;
    }

    // Видаляємо стару карту, якщо вона існує
    if (map) {
        map.remove();
        map = null;
        marker = null;
    }

    // Ініціалізуємо карту
    try {
        map = L.map(mapElement).setView([initialLat, initialLng], 13); // 13 - рівень масштабування

        // Додаємо базовий шар карти (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        // Якщо є початкові координати (для редагування), ставимо маркер
        if (initialLat && initialLng && !(initialLat === 49.8397 && initialLng === 24.0297)) { // Перевіряємо, чи не дефолтні координати
            marker = L.marker([initialLat, initialLng]).addTo(map);
            // Важливо оновити input тут, бо вони могли бути порожніми
            latitudeInput.value = initialLat.toFixed(6);
            longitudeInput.value = initialLng.toFixed(6);
        }

        // Обробник кліку на карті
        map.on('click', async function(e) { // Зробимо функцію асинхронною
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            // Видаляємо старий маркер, якщо він є
            if (marker) {
                map.removeLayer(marker);
            }

            // Додаємо новий маркер
            marker = L.marker([lat, lng]).addTo(map);

            // Зберігаємо координати у приховані поля форми
            latitudeInput.value = lat.toFixed(6);
            longitudeInput.value = lng.toFixed(6);

            // --- ЗВОРОТНЄ ГЕОКОДУВАННЯ (Nominatim) ---
            const mapErrorElement = formElement.querySelector('#mapError');
            if(mapErrorElement) mapErrorElement.style.display = 'none'; // Сховаємо попередню помилку

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=uk`);
                if (!response.ok) {
                    throw new Error(`Nominatim error! status: ${response.status}`);
                }
                const data = await response.json();

                if (data && data.address) {
                    const addr = data.address;
                    const city = addr.city || addr.town || addr.village || '';
                    const district = addr.suburb || addr.county || ''; // 'suburb' часто район міста, 'county' - район області
                    const street = addr.road || '';
                    const houseNumber = addr.house_number || '';

                    // Оновлюємо поля (якщо вони існують у формі)
                    const citySelect = formElement.querySelector('#city');
                    const districtSelect = formElement.querySelector('#district');
                    const addressInput = formElement.querySelector('#address');

                    // Оновлення міста (з перевіркою опцій)
                    if (citySelect) {
                        let cityFoundInOptions = false;
                        for (let option of citySelect.options) {
                            if (option.value.toLowerCase() === city.toLowerCase()) {
                                citySelect.value = option.value;
                                cityFoundInOptions = true;
                                break;
                            }
                        }
                        // Якщо місто не знайдено в опціях, вибираємо "Інше" і заповнюємо поле
                        if (!cityFoundInOptions && city) {
                            citySelect.value = 'other';
                            const cityOtherInput = formElement.querySelector('#city_other_text');
                            if (cityOtherInput) {
                                cityOtherInput.value = city;
                                cityOtherInput.style.display = 'block';
                                cityOtherInput.classList.remove('hidden-other-input');
                            }
                        }
                        // Викликаємо оновлення стану, якщо місто змінилось (для підвантаження університетів)
                        updateFormState(formElement);
                    }

                    // Оновлення району (подібно до міста)
                    if (districtSelect) {
                        let districtFound = false;
                        for (let option of districtSelect.options) {
                            if (option.value.toLowerCase() === district.toLowerCase()) {
                                districtSelect.value = option.value;
                                districtFound = true;
                                break;
                            }
                        }
                        if (!districtFound && district) {
                            districtSelect.value = 'other';
                            const districtOtherInput = formElement.querySelector('#district_other_text'); // Виправлено ID
                            if (districtOtherInput) {
                                districtOtherInput.value = district;
                                districtOtherInput.style.display = 'block';
                                districtOtherInput.classList.remove('hidden-other-input');
                            }
                        } else if (districtSelect.value === 'other' && !district) {
                            const districtOtherInput = formElement.querySelector('#district_other_text');
                            if (districtOtherInput) districtOtherInput.value = '';
                        }
                    }

                    // Оновлення адреси
                    if (addressInput) {
                        addressInput.value = `${street}${houseNumber ? ' ' + houseNumber : ''}`.trim();
                    }

                    console.log("Reverse geocoded address:", data.display_name);
                } else {
                    console.warn("Could not reverse geocode coordinates.");
                    if(mapErrorElement) {
                        mapErrorElement.textContent = 'Не вдалося визначити адресу для цієї точки.';
                        mapErrorElement.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error("Reverse geocoding failed:", error);
                if(mapErrorElement) {
                    mapErrorElement.textContent = 'Помилка визначення адреси.';
                    mapErrorElement.style.display = 'block';
                }
            }
        });

        // Викликаємо invalidateSize після короткої затримки, щоб дозволити DOM оновитись
        setTimeout(() => {
            if (map) { // Перевіряємо, чи карта ще існує
                map.invalidateSize();
                console.log("Map size invalidated after initialization.");
            }
        }, 10); // Невелика затримка (10 мс) зазвичай достатньо

    } catch (error) {
        console.error("Помилка ініціалізації карти Leaflet:", error);
        if (mapElement) { // Показуємо помилку в контейнері карти
            mapElement.innerHTML = `<p style="color: red; padding: 20px; text-align: center;">Помилка завантаження карти. Деталі в консолі.</p>`;
        }
        map = null; // Скидаємо змінну карти
    }
};

/**
 * Знаходить адресу на карті за даними з полів форми.
 * @param {HTMLFormElement} formElement - Елемент форми.
 */
const geocodeAddressAndShowOnMap = async (formElement) => {
    if (!map) {
        console.error("Map is not initialized yet.");
        return;
    }

    const citySelect = formElement.querySelector('#city');
    const cityOtherInput = formElement.querySelector('#city_other_text');
    const districtSelect = formElement.querySelector('#district');
    const districtOtherInput = formElement.querySelector('#district_other_text');
    const addressInput = formElement.querySelector('#address');
    const latitudeInput = formElement.querySelector('#latitude');
    const longitudeInput = formElement.querySelector('#longitude');
    const mapErrorElement = formElement.querySelector('#mapError');
    const findButton = formElement.querySelector('#findOnMapBtn');

    if (!addressInput || !latitudeInput || !longitudeInput || !mapErrorElement || !findButton) return;

    // Збираємо адресу
    const city = citySelect.value === 'other' ? cityOtherInput.value : citySelect.value;
    const district = districtSelect.value === 'other' ? districtOtherInput.value : districtSelect.value;
    const address = addressInput.value;

    if (!city || !address) {
        mapErrorElement.textContent = 'Будь ласка, введіть місто та адресу для пошуку.';
        mapErrorElement.style.display = 'block';
        return;
    }

    mapErrorElement.style.display = 'none';
    findButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    findButton.disabled = true;

    // Формуємо рядок запиту для Nominatim
    const query = `${address}, ${district ? district + ',' : ''} ${city}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1&accept-language=uk`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Nominatim error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);

            console.log("Geocoded address:", result.display_name);
            console.log("Coordinates:", lat, lng);

            // Видаляємо старий маркер
            if (marker) {
                map.removeLayer(marker);
            }

            // Додаємо новий маркер
            marker = L.marker([lat, lng]).addTo(map);

            // Центруємо карту
            map.setView([lat, lng], 16); // Більш детальний зум при пошуку

            // Оновлюємо приховані поля
            latitudeInput.value = lat.toFixed(6);
            longitudeInput.value = lng.toFixed(6);

        } else {
            console.warn("Address not found by Nominatim.");
            mapErrorElement.textContent = 'Адресу не знайдено. Спробуйте уточнити запит або вказати точку на карті вручну.';
            mapErrorElement.style.display = 'block';
            // Не видаляємо існуючий маркер, якщо він є
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
        mapErrorElement.textContent = 'Помилка пошуку адреси.';
        mapErrorElement.style.display = 'block';
    } finally {
        findButton.innerHTML = '<i class="fas fa-search-location"></i>'; // Повертаємо іконку
        findButton.disabled = false;
    }
};

// =================================================================================
// 4.1. ЛОГІКА ФОРМ СТВОРЕННЯ/РЕДАГУВАННЯ ОГОЛОШЕННЯ
// =================================================================================

/**
 * Універсальна функція оновлення стану форми оголошення (видимість, required).
 */
export const updateFormState = (formElement) => {
    if (!formElement) return;

    // --- Отримуємо елементи В МЕЖАХ КОНКРЕТНОЇ ФОРМИ ---
    const roommatePrefs = formElement.querySelector('#roommatePreferences');
    const housingFilters = formElement.querySelector('#housingFilters');
    const listingDetails = formElement.querySelector('#listingDetails');
    const aboutMe = formElement.querySelector('#aboutMe');
    const priceGroup = formElement.querySelector('#priceGroup');
    const addressGroup = formElement.querySelector('#addressGroup');
    const photoGroup = formElement.querySelector('#photoGroup');
    const studyConditionsGroup = formElement.querySelector('#studyConditionsGroup');
    const ownerRulesGroup = formElement.querySelector('.ownerRulesGroup');
    const nearbyUniversitiesGroup = formElement.querySelector('.nearbyUniversitiesGroup');
    const studentParams = formElement.querySelector('#studentParams');
    const isStudentGroup = formElement.querySelector('.isStudentGroup');
    const maxOccupantsGroup = formElement.querySelector('#maxOccupantsGroup');
    const findMateGroups = formElement.querySelector('#findMateGroups');
    const myGroupSizeGroup = formElement.querySelector('#myGroupSizeGroup');
    const myGroupCountSelect = formElement.querySelector('#my_group_count');
    const targetRoommatesTotalGroup = formElement.querySelector('#targetRoommatesTotalGroup');
    const petDetailsDiv = formElement.querySelector('#pet_details'); // Для політики щодо тварин
    const photoRequiredIndicator = formElement.querySelector('#photoRequiredIndicator');
    const citySelect = formElement.querySelector('#city'); // Потрібен для університетів

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
    const readyToShareRadios = formElement.querySelectorAll('input[name="ready_to_share"]');
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
        const universitiesCheckboxesContainer = formElement.querySelector('#nearbyUniversitiesCheckboxes');
        const universityOtherTextInputForCheckboxes = formElement.querySelector('#university_other_text'); // Для чекбоксів "Університети поруч"
        const targetUniversitySelect = formElement.querySelector('#target_university'); // Select для "Бажаний Університет"
        const targetUniversityOtherTextInput = formElement.querySelector('#target_university_other_text'); // Text input для select

        // --- 1. Обробка Select "Бажаний Університет" ---
        if (targetUniversitySelect) {
            const currentSelectedValue = targetUniversitySelect.value; // Зберігаємо поточне значення (для редагування)
            // Повністю очищуємо select
            targetUniversitySelect.innerHTML = '';

            // Додаємо опцію "Будь-який"
            const anyOption = document.createElement('option');
            anyOption.value = '';
            anyOption.textContent = 'Будь-який';
            targetUniversitySelect.appendChild(anyOption);

            // Додаємо університети зі списку
            if (unis.length > 0) {
                unis.forEach(uni => {
                    const option = document.createElement('option');
                    option.value = uni.value; // Використовуємо системний ключ
                    option.textContent = uni.text;
                    targetUniversitySelect.appendChild(option);
                });
            }

            // Додаємо опцію "Інший"
            const otherOption = document.createElement('option');
            otherOption.value = 'other';
            otherOption.textContent = 'Інший (вказати)';
            targetUniversitySelect.appendChild(otherOption);

            // Відновлюємо вибране значення, якщо воно було
            if (currentSelectedValue && targetUniversitySelect.querySelector(`option[value="${currentSelectedValue}"]`)) {
                targetUniversitySelect.value = currentSelectedValue;
            } else {
                anyOption.selected = true; // Інакше робимо "Будь-який" активним
            }


            // Показуємо/ховаємо текстове поле "Інше" для select
            if (targetUniversityOtherTextInput) {
                targetUniversityOtherTextInput.style.display = targetUniversitySelect.value === 'other' ? 'block' : 'none';
                targetUniversityOtherTextInput.classList.toggle('hidden-other-input', targetUniversitySelect.value !== 'other');
            }
        }

        // --- 2. Обробка Checkboxes "Університети поруч" ---
        if (universitiesCheckboxesContainer) {
            universitiesCheckboxesContainer.innerHTML = ''; // Очищуємо

            if (unis.length === 0) {
                universitiesCheckboxesContainer.innerHTML = '<p style="color: var(--text-light)">Університети для цього міста не вказані.</p>';
            } else {
                unis.forEach(uni => {
                    const div = document.createElement('div');
                    div.className = 'checkbox-option-item';
                    div.innerHTML = `<input type="checkbox" id="uni_${formElement.id}_${uni.value}" name="characteristics" value="${uni.value}"><label for="uni_${formElement.id}_${uni.value}">${uni.text}</label>`;
                    universitiesCheckboxesContainer.appendChild(div);
                });
            }
        }

        // --- 3. Поле "Інше" для Checkboxes "Університети поруч" ---
        // (Завжди видиме, коли видима вся секція nearbyUniversitiesGroup)
        if (universityOtherTextInputForCheckboxes) {
            universityOtherTextInputForCheckboxes.style.display = 'block';
            universityOtherTextInputForCheckboxes.classList.remove('hidden-other-input');
        }
    };


    // === Основна логіка ===

    // 1. Скидаємо 'required' для всіх потенційно обов'язкових полів
    [priceInput, targetPriceMaxInput, myAgeInput, maxOccupantsSelect, currentOccupantsSelect,
        seekingRoommatesSelect, roomsSelect, floorInput, totalFloorsInput, totalAreaInput, kitchenAreaInput,
        myGenderRadios, furnishingRadios, readyToShareRadios].forEach(el => setRequired(el, false));

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
    setVisible(studyConditionsGroup, !!selectedType);

    if (isRentOut || isFindMate) {
        setVisible(priceGroup, true);
        setRequired(priceInput, true);
        setVisible(addressGroup, true); // Адреса для rent_out/find_mate
        setVisible(listingDetails, true);
        setVisible(nearbyUniversitiesGroup, true); // Університети поруч
        if (citySelect) populateUniversities(selectedCity); // Заповнюємо університети
    }

    if (isRentOut) {
        setVisible(maxOccupantsGroup, true);
        setVisible(ownerRulesGroup, true);
    }

    if (isFindMate) {
        setVisible(findMateGroups, true);
        setVisible(aboutMe, true);
        setVisible(roommatePrefs, true);
        setVisible(isStudentGroup, true); // "Чи студент?"
        const isStudent = formElement.querySelector('input[name="is_student"]:checked')?.value;
        setVisible(studentParams, isStudent === 'yes');
    }

    if (isFindHome) {
        setVisible(housingFilters, true);
        setRequired(readyToShareRadios, true);
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
export const setupAddListingFormLogic = () => {
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
    const updateHandler = () => updateFormState(form);

    listingTypeRadios.forEach(radio => radio.addEventListener('change', updateHandler));
    citySelect?.addEventListener('change', updateHandler);
    readyToShareRadios?.forEach(radio => radio.addEventListener('change', updateHandler));
    isStudentRadios?.forEach(radio => radio.addEventListener('change', updateHandler));
    myGroupSizeRadios?.forEach(radio => radio.addEventListener('change', updateHandler));

    // Додаємо слухач для кнопки "Знайти на карті"
    const findButton = form.querySelector('#findOnMapBtn');
    if (findButton) {
        findButton.addEventListener('click', () => {
            geocodeAddressAndShowOnMap(form);
        });
    }

    // Логіка для "Інше" (залишається специфічною для форми)
    otherOptionSelects.forEach(select => {
        select.addEventListener('change', (e) => {
            const otherInput = e.target.nextElementSibling;
            if (otherInput && otherInput.classList.contains('hidden-other-input')) {
                otherInput.style.display = e.target.value === 'other' ? 'block' : 'none';
                if (e.target.value !== 'other') otherInput.value = '';
            }
        });
        const otherInputInitial = select.nextElementSibling;
        if (otherInputInitial?.classList.contains('hidden-other-input')) {
            otherInputInitial.style.display = select.value === 'other' ? 'block' : 'none';
        }
    });

    // Логіка для Тварин
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

    // 1. Мої тварини
    const myPetsPolicyRadios = form.querySelectorAll('input[name="my_pets_policy"]');
    const myPetDetailsDiv = form.querySelector('#my_pet_details');

    myPetsPolicyRadios?.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const noPetCheckbox = form.querySelector('input[name="characteristics"][value="my_pet_no"]');
            if (myPetDetailsDiv) {
                myPetDetailsDiv.style.display = e.target.value === 'yes' ? 'block' : 'none';
                if (e.target.value === 'no') {
                    myPetDetailsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                    if (noPetCheckbox) noPetCheckbox.checked = true; // Позначаємо "Не маю тварин"
                } else {
                    if (noPetCheckbox) noPetCheckbox.checked = false; // Знімаємо позначку "Не маю тварин"
                }
            }
        });
    });
    // Ініціалізація стану "Мої тварини"
    const initialMyPetsPolicy = form.querySelector('input[name="my_pets_policy"]:checked');
    if (myPetDetailsDiv && initialMyPetsPolicy) {
        myPetDetailsDiv.style.display = initialMyPetsPolicy.value === 'yes' ? 'block' : 'none';
        const noPetCheckboxInitial = form.querySelector('input[name="characteristics"][value="my_pet_no"]');
        if (noPetCheckboxInitial) noPetCheckboxInitial.checked = (initialMyPetsPolicy.value === 'no');
    }


    // 2. Тварини у сусіда
    const matePetsPolicyRadios = form.querySelectorAll('input[name="mate_pets_policy"]');
    const matePetDetailsDiv = form.querySelector('#mate_pet_details');

    matePetsPolicyRadios?.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const noMatePetCheckbox = form.querySelector('input[name="characteristics"][value="mate_no_pet"]');
            if (matePetDetailsDiv) {
                matePetDetailsDiv.style.display = (e.target.value === 'yes' || e.target.value === 'maybe') ? 'block' : 'none';
                if (e.target.value === 'no') {
                    matePetDetailsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                    if (noMatePetCheckbox) noMatePetCheckbox.checked = true;
                } else {
                    if (noMatePetCheckbox) noMatePetCheckbox.checked = false;
                }
            }
        });
    });
    // Ініціалізація стану "Тварини у сусіда"
    const initialMatePetsPolicy = form.querySelector('input[name="mate_pets_policy"]:checked');
    if (matePetDetailsDiv && initialMatePetsPolicy) {
        matePetDetailsDiv.style.display = (initialMatePetsPolicy.value === 'yes' || initialMatePetsPolicy.value === 'maybe') ? 'block' : 'none';
        const noMatePetCheckboxInitial = form.querySelector('input[name="characteristics"][value="mate_no_pet"]');
        if (noMatePetCheckboxInitial) noMatePetCheckboxInitial.checked = (initialMatePetsPolicy.value === 'no');
    }


    // 3. Бажана політика щодо тварин (у фільтрах пошуку)
    const searchPetPolicyRadios = form.querySelectorAll('input[name="search_pet_policy"]');
    const searchPetDetailsDiv = form.querySelector('#search_pet_details'); // Використовуємо новий ID
    searchPetPolicyRadios?.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (searchPetDetailsDiv) {
                searchPetDetailsDiv.style.display = e.target.value === 'yes' ? 'block' : 'none';
                if (e.target.value !== 'yes') {
                    searchPetDetailsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                }
            }
        });
    });
    // Ініціалізація стану "Бажана політика"
    const initialSearchPetPolicy = form.querySelector('input[name="search_pet_policy"]:checked');
    if (searchPetDetailsDiv && initialSearchPetPolicy) {
        searchPetDetailsDiv.style.display = initialSearchPetPolicy.value === 'yes' ? 'block' : 'none';
    }


    const initialPetPolicy = form.querySelector('input[name="pet_policy"]:checked');
    if (petDetailsDiv && initialPetPolicy) {
        petDetailsDiv.style.display = initialPetPolicy.value === 'yes' ? 'flex' : 'none';
    }


    // Логіка для чекбоксів "Мої тварини"
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

    // Логіка для чекбоксів "Тварини сусіда"
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

    // Логіка для select "Бажаний університет"
    const targetUniversitySelect = form.querySelector('#target_university');
    const targetUniversityOtherTextInput = form.querySelector('#target_university_other_text');

    targetUniversitySelect?.addEventListener('change', (e) => {
        if (targetUniversityOtherTextInput) {
            targetUniversityOtherTextInput.style.display = e.target.value === 'other' ? 'block' : 'none';
            targetUniversityOtherTextInput.classList.toggle('hidden-other-input', e.target.value !== 'other');
            if (e.target.value !== 'other') {
                targetUniversityOtherTextInput.value = ''; // Очищуємо поле, якщо вибрано не "Інше"
            }
        }
    });

    // Ініціалізація стану поля "Інше" при завантаженні (важливо для редагування)
    if (targetUniversitySelect && targetUniversityOtherTextInput) {
        targetUniversityOtherTextInput.style.display = targetUniversitySelect.value === 'other' ? 'block' : 'none';
        targetUniversityOtherTextInput.classList.toggle('hidden-other-input', targetUniversitySelect.value !== 'other');
    }

    // Ініціалізація стану форми при завантаженні
    updateFormState(form);
    // Ініціалізація карти з невеликою затримкою
    setTimeout(() => {
        initializeMap(form);
        console.log("Map initialized via setupAddListingFormLogic after delay.");
    }, 50); // Затримка 50 мс (можна спробувати 0 або 10, якщо 50 забагато)
    //
};

/**
 * Налаштовує логіку форми РЕДАГУВАННЯ оголошення.
 */
export const setupEditListingFormLogic = () => {
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

    citySelect?.addEventListener('change', updateHandler);
    readyToShareRadios?.forEach(radio => radio.addEventListener('change', updateHandler));
    isStudentRadios?.forEach(radio => radio.addEventListener('change', updateHandler));
    myGroupSizeRadios?.forEach(radio => radio.addEventListener('change', updateHandler));

    // Додаємо слухач для кнопки "Знайти на карті"
    const findButton = form.querySelector('#findOnMapBtn');
    if (findButton) {
        findButton.addEventListener('click', () => {
            geocodeAddressAndShowOnMap(form);
        });
    }

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
};

/**
 * Налаштовує логіку завантаження та відображення фото для форм оголошень.
 * @param {string} formId ID форми ('addListingForm' або 'editListingForm').
 */
export const setupPhotoUploadLogic = (formId) => {
    const form = document.getElementById(formId);
    if (!form) return;
    const photoInput = form.querySelector('#listingPhotosInput');
    const previewContainer = form.querySelector('#photoPreviewContainer');

    if (!photoInput || !previewContainer) return;

    const isEditMode = formId === 'editListingForm';

    // --- Функції для керування фото ---
    const updatePhotoDisplay = () => {
        if (!previewContainer) return;
        previewContainer.innerHTML = ''; // Очищуємо контейнер

        const filesToShow = isEditMode ? editListingNewFilesToUpload : addListingSelectedFiles;
        const existingPhotosToShow = isEditMode ? editListingCurrentPhotos.filter(p => !editListingPhotosToDelete.has(p.photo_id)) : [];
        const totalVisiblePhotos = existingPhotosToShow.length + filesToShow.length;

        // Відображення існуючих фото (тільки для редагування)
        existingPhotosToShow.forEach((photo, index) => {
            const div = createPhotoElement(index, photo.image_url, true, photo.photo_id, photo.is_main || index === 0);
            previewContainer.appendChild(div);
        });

        // Відображення нових/вибраних фото
        filesToShow.forEach((file, index) => {
            const reader = new FileReader();
            const div = createPhotoElement(index, null, false, null, existingPhotosToShow.length === 0 && index === 0); // isExisting = false
            reader.onload = (e) => {
                div.style.backgroundImage = `url('${e.target.result}')`;
            };
            reader.readAsDataURL(file);
            previewContainer.appendChild(div);
        });

        // Кнопка "Додати фото", якщо є місце
        if (totalVisiblePhotos < MAX_PHOTOS) {
            const addButton = document.createElement('div');
            addButton.className = 'photo-upload-placeholder add-photo-btn';
            addButton.innerHTML = '+ Додати фото';
            addButton.onclick = () => photoInput.click();
            previewContainer.appendChild(addButton);
        }

        // Заповнюємо решту слотів порожніми плейсхолдерами
        for (let i = totalVisiblePhotos + (totalVisiblePhotos < MAX_PHOTOS ? 1 : 0); i < MAX_PHOTOS; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'photo-upload-placeholder';
            previewContainer.appendChild(emptyDiv);
        }
    };

    // Створює DOM елемент для фото (існуючого або нового)
    const createPhotoElement = (index, imageUrl, isExisting, photoId = null, isMain = false) => {
        const div = document.createElement('div');
        div.className = 'photo-upload-placeholder preview';
        if (imageUrl) div.style.backgroundImage = `url('${imageUrl}')`;
        div.dataset.index = index; // Індекс у відповідному масиві
        if (isExisting) div.dataset.photoId = photoId;

        // Кнопка видалення
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'photo-delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = isExisting ? 'Видалити фото' : 'Скасувати додавання';
        deleteBtn.type = 'button';
        deleteBtn.onclick = (event) => {
            event.stopPropagation();
            if (isExisting) removeExistingPhoto(photoId, div);
            else removeNewFile(index);
        };
        div.appendChild(deleteBtn);

        // Мітка "Головне"
        // Визначаємо, чи це фото головне:
        // - Для існуючих: перевіряємо photo.is_main АБО якщо це перше існуюче фото І нових фото немає
        // - Для нових: перевіряємо, чи немає існуючих І це перше нове фото
        let shouldBeMain = false;
        if (isExisting) {
            const mainExisting = editListingCurrentPhotos.find(p => p.is_main && !editListingPhotosToDelete.has(p.photo_id));
            shouldBeMain = mainExisting ? mainExisting.photo_id === photoId : (index === 0 && editListingNewFilesToUpload.length === 0);
        } else {
            const visibleExistingCount = editListingCurrentPhotos.filter(p => !editListingPhotosToDelete.has(p.photo_id)).length;
            shouldBeMain = visibleExistingCount === 0 && index === 0;
        }

        if (shouldBeMain) {
            const mainLabel = document.createElement('span');
            mainLabel.className = 'photo-main-label';
            mainLabel.textContent = 'Головне';
            div.appendChild(mainLabel);
            div.title = 'Головне фото';
        }

        return div;
    };


    const removeExistingPhoto = (photoId, element) => {
        editListingPhotosToDelete.add(photoId);
        // element.remove(); // Не видаляємо, просто перемалюємо
        updatePhotoDisplay();
    };

    const removeNewFile = (indexToRemove) => {
        if (isEditMode) editListingNewFilesToUpload.splice(indexToRemove, 1);
        else addListingSelectedFiles.splice(indexToRemove, 1);
        if (photoInput) photoInput.value = null;
        updatePhotoDisplay();
    };

    // Обробник вибору файлів
    photoInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (!files) return;

        const currentFiles = isEditMode ? editListingNewFilesToUpload : addListingSelectedFiles;
        const existingVisibleCount = isEditMode ? editListingCurrentPhotos.length - editListingPhotosToDelete.size : 0;
        const currentCount = existingVisibleCount + currentFiles.length;
        const availableSlots = MAX_PHOTOS - currentCount;
        const filesToAddCount = Math.min(files.length, availableSlots);

        if (files.length > availableSlots && availableSlots > 0) alert(`Ви можете додати ще ${availableSlots} фото.`);
        else if (availableSlots <= 0) alert(`Ви вже додали максимальну кількість фото (${MAX_PHOTOS}).`);

        for (let i = 0; i < filesToAddCount; i++) currentFiles.push(files[i]);
        photoInput.value = null;
        updatePhotoDisplay();
    });

    // Ініціалізація відображення
    updatePhotoDisplay();

    // Повертаємо функцію для завантаження початкових фото (для редагування)
    if (isEditMode) {
        return {
            loadInitialPhotos: (photos) => {
                editListingCurrentPhotos = photos || [];
                editListingPhotosToDelete.clear(); // Скидаємо при завантаженні даних
                editListingNewFilesToUpload = []; // Скидаємо при завантаженні даних
                updatePhotoDisplay();
            }
        };
    }
    return null; // Для режиму додавання нічого не повертаємо
};


/**
 * Обробляє відправку форми СТВОРЕННЯ оголошення.
 */
export const handleListingSubmission = async () => {
    const form = document.getElementById('addListingForm');
    const photoInput = document.getElementById('listingPhotosInput');
    const previewContainer = document.getElementById('photoPreviewContainer');
    const submitButton = form?.querySelector('.submit-listing-btn');
    const photoErrorHint = form?.querySelector('#photoErrorHint');
    const listingTypeHint = form?.querySelector('#listingTypeHint');

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
        photoInput.value = null;
        updatePhotoDisplay();
    };

    window.triggerFileInput = () => photoInput.click();

    photoInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (!files) return;
        const currentCount = selectedFiles.length;
        const availableSlots = MAX_PHOTOS - currentCount;
        const filesToAddCount = Math.min(files.length, availableSlots);

        if (files.length > availableSlots && availableSlots > 0) alert(`Ви можете додати ще ${availableSlots} фото.`);
        else if (availableSlots <= 0) alert(`Ви вже додали максимальну кількість фото (${MAX_PHOTOS}).`);

        for (let i = 0; i < filesToAddCount; i++) selectedFiles.push(files[i]);
        photoInput.value = null;
        updatePhotoDisplay();
    });

    // --- Обробник відправки ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        listingTypeHint.style.display = 'none';

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

        if (selectedType === 'find_home') {
            const readyToShareChecked = form.querySelector('input[name="ready_to_share"]:checked');
            if (!readyToShareChecked) {
                alert('Будь ласка, вкажіть, чи готові ви жити з сусідом.');
                // Знайдемо відповідний блок для прокрутки
                const readyToShareGroup = form.querySelector('input[name="ready_to_share"]')?.closest('.form-group');
                readyToShareGroup?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }

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

/**
 * Обробляє відправку форми РЕДАГУВАННЯ оголошення.
 */
export const handleListingUpdateSubmission = async () => {
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

/**
 * Завантажує дані оголошення для форми редагування.
 */
export const loadListingDataForEdit = async (formId, listingId, loadInitialPhotosCallback) => {
    const form = document.getElementById(formId);
    if (!form || !listingId) return;

    try {
        const response = await fetch(`http://localhost:3000/api/listings/${listingId}`);
        if (!response.ok) {
            if (response.status === 404) throw new Error('Оголошення не знайдено.');
            if (response.status === 403) throw new Error('Ви не маєте доступу до редагування цього оголошення.'); // Припускаємо, що бекенд може повернути 403
            throw new Error('Не вдалося завантажити дані оголошення.');
        }
        const listing = await response.json();

        // if (listing.user_id !== MY_USER_ID) {
        //     alert('Ви не є власником цього оголошення.');
        //     window.location.href = 'my_listings.html';
        //     return;
        // }

        const initialLat = parseFloat(listing.latitude);
        const initialLng = parseFloat(listing.longitude);

        // Заповнюємо базові поля
        form.querySelector('#listingIdField').value = listing.listing_id;
        form.querySelector('#initialListingType').value = listing.listing_type; // Зберігаємо тип
        form.querySelector('#title').value = listing.title || '';
        form.querySelector('#description').value = listing.description || '';
        form.querySelector('#city').value = listing.city || '';
        // Обробка поля "Інше місто"
        const cityOtherInput = form.querySelector('#city_other_text');
        if (listing.city === 'other' && cityOtherInput) {
            cityOtherInput.value = listing.city_other || '';
            cityOtherInput.style.display = 'block';
        } else if (cityOtherInput) {
            cityOtherInput.value = '';
            cityOtherInput.style.display = 'none';
        }

        // Заповнюємо поля залежно від типу (використовуючи ті ж ID, що і в add_listing.html)
        const priceInput = form.querySelector('#price');
        if (priceInput) priceInput.value = listing.price || '';
        const addressInput = form.querySelector('#address');
        if (addressInput) addressInput.value = listing.address || '';
        const studyConditionsInput = form.querySelector('#study_conditions');
        if (studyConditionsInput) studyConditionsInput.value = listing.study_conditions || '';

        // Заповнення полів для 'rent_out' / 'find_mate' (Характеристики житла)
        const buildingTypeSelect = form.querySelector('#building_type');
        if(buildingTypeSelect) buildingTypeSelect.value = listing.building_type || '';
        const buildingTypeOther = form.querySelector('input[name="building_type_other"]');
        if(buildingTypeOther) {
            buildingTypeOther.value = listing.building_type_other || '';
            // Показуємо поле "Інше", якщо потрібно
            if (buildingTypeSelect && buildingTypeSelect.value === 'other') {
                buildingTypeOther.style.display = 'block';
                buildingTypeOther.classList.remove('hidden-other-input');
            } else {
                buildingTypeOther.style.display = 'none';
                buildingTypeOther.classList.add('hidden-other-input');
            }
        }
        form.querySelector('#rooms').value = listing.rooms || '';
        form.querySelector('#floor').value = listing.floor || '';
        form.querySelector('#total_floors').value = listing.total_floors || '';
        form.querySelector('#total_area').value = listing.total_area || '';
        form.querySelector('#kitchen_area').value = listing.kitchen_area || '';
        form.querySelector('#bathroom_type').value = listing.bathroom_type || '';

        // --- Обробка полів Select + Other ---
        const setupSelectWithOther = (baseName) => {
            const select = form.querySelector(`#${baseName}`);
            const otherInput = form.querySelector(`input[name="${baseName}_other"]`);
            if (select) select.value = listing[baseName] || '';
            if (otherInput) {
                otherInput.value = listing[`${baseName}_other`] || '';
                if (select && select.value === 'other') {
                    otherInput.style.display = 'block';
                    otherInput.classList.remove('hidden-other-input');
                } else {
                    otherInput.style.display = 'none';
                    otherInput.classList.add('hidden-other-input');
                }
            }
        };
        setupSelectWithOther('wall_type');
        setupSelectWithOther('planning');
        setupSelectWithOther('heating_type');
        setupSelectWithOther('renovation_type');
        setupSelectWithOther('building_type');
        setupSelectWithOther('district');


        // Радіо-кнопки
        const setRadioChecked = (name, value) => {
            const radio = form.querySelector(`input[name="${name}"][value="${value}"]`);
            if (radio) radio.checked = true;
        };
        if(listing.furnishing) setRadioChecked('furnishing', listing.furnishing);
        if(listing.pet_policy) setRadioChecked('pet_policy', listing.pet_policy);

        // Поля 'rent_out'
        const maxOccupantsSelect = form.querySelector('#max_occupants');
        if (maxOccupantsSelect) maxOccupantsSelect.value = listing.max_occupants || '';
        const ownerRulesTextarea = form.querySelector('#owner_rules');
        if (ownerRulesTextarea) ownerRulesTextarea.value = listing.owner_rules || '';

        // Поля 'find_mate'
        const currentOccupantsSelect = form.querySelector('#current_occupants');
        if (currentOccupantsSelect) currentOccupantsSelect.value = listing.current_occupants || '';
        const seekingRoommatesSelect = form.querySelector('#seeking_roommates');
        if (seekingRoommatesSelect) seekingRoommatesSelect.value = listing.seeking_roommates || '';

        // Поля 'find_home'
        const targetPriceMin = form.querySelector('#target_price_min');
        if (targetPriceMin) targetPriceMin.value = listing.target_price_min || '';
        const targetPriceMax = form.querySelector('#target_price_max');
        if (targetPriceMax) targetPriceMax.value = listing.target_price_max || '';
        setupSelectWithOther('housing_type_search');
        form.querySelector('#target_rooms').value = listing.target_rooms || '';
        form.querySelector('#target_roommates_max').value = listing.target_roommates_max || '';
        setupSelectWithOther('target_university'); // Університет в пошуку
        form.querySelector('#target_uni_distance').value = listing.target_uni_distance || '';

        if(listing.ready_to_share) setRadioChecked('ready_to_share', listing.ready_to_share);
        if(listing.search_pet_policy) setRadioChecked('search_pet_policy', listing.search_pet_policy);


        // Поля 'find_home' / 'find_mate' (Про себе/Вимоги)
        if(listing.is_student) setRadioChecked('is_student', listing.is_student);
        if(listing.my_gender) setRadioChecked('my_gender', listing.my_gender);
        const myAgeInput = form.querySelector('#my_age');
        if (myAgeInput) myAgeInput.value = listing.my_age || '';
        if(listing.my_group_size) setRadioChecked('my_group_size', listing.my_group_size);
        const myGroupCountSelect = form.querySelector('#my_group_count');
        if (myGroupCountSelect) myGroupCountSelect.value = listing.my_group_count || '2';

        if(listing.my_smoking) setRadioChecked('my_smoking', listing.my_smoking);
        if(listing.my_drinking) setRadioChecked('my_drinking', listing.my_drinking);
        if(listing.my_guests) setRadioChecked('my_guests', listing.my_guests);
        const aboutMeTextarea = form.querySelector('#about_me_description');
        if (aboutMeTextarea) aboutMeTextarea.value = listing.about_me_description || '';

        const roommateGenderSelect = form.querySelector('#roommate_gender');
        if (roommateGenderSelect) roommateGenderSelect.value = listing.roommate_gender || 'any';
        const roommateAgeMin = form.querySelector('#roommate_age_min');
        if (roommateAgeMin) roommateAgeMin.value = listing.roommate_age_min || '';
        const roommateAgeMax = form.querySelector('#roommate_age_max');
        if (roommateAgeMax) roommateAgeMax.value = listing.roommate_age_max || '';

        if(listing.roommate_smoking) setRadioChecked('roommate_smoking', listing.roommate_smoking);
        if(listing.roommate_drinking) setRadioChecked('roommate_drinking', listing.roommate_drinking);
        if(listing.roommate_guests) setRadioChecked('roommate_guests', listing.roommate_guests);
        const roommateDescription = form.querySelector('#roommate_description');
        if (roommateDescription) roommateDescription.value = listing.roommate_description || '';

        // Заповнення Чекбоксів (Характеристики)
        const characteristicKeys = new Set(listing.characteristics.map(c => c.system_key));
        form.querySelectorAll('input[name="characteristics"], input[name="search_characteristics"]').forEach(checkbox => {
            if (characteristicKeys.has(checkbox.value)) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false; // Явно знімаємо позначку
            }
        });

        // Обробка чекбоксів "Інше" для характеристик при завантаженні
        form.querySelectorAll('input[name="characteristics_other_trigger"]').forEach(checkbox => {
            const textInputId = checkbox.getAttribute('onchange')?.match(/'([^']+)'/)?.[1];
            if (textInputId) {
                const textInput = form.querySelector(`#${textInputId}`);
                if (textInput) {
                    const dataKey = textInput.name;
                    // Перевіряємо, чи є відповідне _other поле в даних оголошення
                    if (listing[dataKey]) {
                        checkbox.checked = true; // Відмічаємо чекбокс "Інше"
                        textInput.value = listing[dataKey]; // Заповнюємо текстове поле
                        textInput.style.display = 'block'; // Показуємо його
                        textInput.classList.remove('hidden-other-input');
                    } else {
                        checkbox.checked = false;
                        textInput.value = '';
                        textInput.style.display = 'none';
                        textInput.classList.add('hidden-other-input');
                    }
                }
            }
        });


        // Завантажуємо початкові фото
        if (loadInitialPhotosCallback && typeof loadInitialPhotosCallback === 'function') {
            loadInitialPhotosCallback(listing.photos);
        }

        // Оновлюємо стан форми (видимість блоків)
        updateFormState(form);
        // Ініціалізуємо карту з отриманими координатами (або дефолтними, якщо їх немає)
        initializeMap(form, isNaN(initialLat) ? undefined : initialLat, isNaN(initialLng) ? undefined : initialLng); // --- Передаємо 'form' та координати

    } catch (error) {
        console.error('Помилка завантаження даних для редагування:', error);
        alert(`Помилка: ${error.message}`);
        // Можливо, перенаправити на іншу сторінку
        window.location.href = 'my_listings.html';
    }
};

// =================================================================================
// 4.3. ЛОГІКА ФОРМИ ФІЛЬТРІВ (з index.html)
// =================================================================================
/**
 * Налаштовує логіку для блоку пошуку та форми фільтрів на головній сторінці.
 */
export const setupHomepageFilters = () => {
    const filtersForm = document.getElementById('filtersForm');
    const actionButtons = document.querySelectorAll('.main-actions-menu .action-btn'); // Кнопки цілей
    const searchInput = document.querySelector('.search-input');
    const searchIcon = document.querySelector('.search-icon');
    if (!filtersForm || !actionButtons.length || !searchInput || !searchIcon) {
        console.error("Не знайдено один або більше елементів для фільтрів головної сторінки.");
        return;
    }

    // --- Елементи секцій та тригерів ---
    const filterBasic = filtersForm.querySelector('#filter_basic'); // 1
    const filterDesiredHousing = filtersForm.querySelector('#filter_desired_housing'); // 2
    const filterCurrentHousing = filtersForm.querySelector('#filter_current_housing'); // 3
    const filterDesiredRoommate = filtersForm.querySelector('#filter_desired_roommate'); // 4
    const filterMyChars = filtersForm.querySelector('#filter_my_chars'); // 5
    const filterDesiredTenant = filtersForm.querySelector('#filter_desired_tenant'); // 6

    const askCurrentHousing = filtersForm.querySelector('#ask_current_housing');
    const askMyChars = filtersForm.querySelector('#ask_my_chars');

    // Радіокнопки у формі фільтрів
    const goalRadiosInForm = filtersForm.querySelectorAll('input[name="user_goal"]');
    // Інші радіокнопки (тригери)
    const showCurrentHousingRadios = filtersForm.querySelectorAll('input[name="show_current_housing"]');
    const showMyCharsRadios = filtersForm.querySelectorAll('input[name="show_my_chars"]');
    const readyToShareRadios = filtersForm.querySelectorAll('input[name="ready_to_share_filter"]');
    const searchPetPolicyRadios = filtersForm.querySelectorAll('input[name="search_pet_policy"]');
    const filterPetDetailsDiv = filtersForm.querySelector('#filter_pet_details');

    // Допоміжна функція для видимості
    const setVisible = (element, isVisible) => {
        if (element) element.style.display = isVisible ? 'block' : 'none';
    };

    // --- Оновлення видимості секцій фільтрів ---
    const updateFilterVisibility = () => {
        const selectedGoal = filtersForm.querySelector('input[name="user_goal"]:checked')?.value;
        const wantsToShare = filtersForm.querySelector('input[name="ready_to_share_filter"]:checked')?.value;
        const showCurrentHousing = filtersForm.querySelector('input[name="show_current_housing"]:checked')?.value === 'yes';
        const showMyChars = filtersForm.querySelector('input[name="show_my_chars"]:checked')?.value === 'yes';
        const isPetPolicyYes = filtersForm.querySelector('input[name="search_pet_policy"][value="yes"]:checked');

        console.log("Updating visibility. Goal:", selectedGoal, "WantsToShare:", wantsToShare, "ShowCurrent:", showCurrentHousing, "ShowMy:", showMyChars);

        // Скидаємо видимість для всіх динамічних секцій та питань (крім базової)
        [
            filterDesiredHousing, filterCurrentHousing, filterDesiredRoommate, filterMyChars, filterDesiredTenant,
            askCurrentHousing, askMyChars
        ].forEach(el => setVisible(el, false));

        // 1. Основний блок (місто) - завжди видимий
        setVisible(filterBasic, true);

        // 2. Логіка для кожної мети
        if (selectedGoal === 'find_housing') { // Знайти житло
            setVisible(filterDesiredHousing, true); // 2. Бажані характеристики житла

            // Показуємо/ховаємо деталі тварин
            setVisible(filterPetDetailsDiv, !!isPetPolicyYes); // !! перетворює на boolean
            if (!isPetPolicyYes && filterPetDetailsDiv) { // Знімаємо позначки, якщо "Дозволено" не вибрано
                filterPetDetailsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            }

            if (wantsToShare === 'yes' || wantsToShare === 'any') {
                setVisible(filterDesiredRoommate, true); // 4. Бажані характеристики сусіда
            }
            // Питання про власні характеристики показуємо ЗАВЖДИ для цього типу, ПІСЛЯ секцій 2 та 4
            setVisible(askMyChars, true);
            if (showMyChars) {
                setVisible(filterMyChars, true); // 5. Ваші характеристики
            }

        } else if (selectedGoal === 'find_roommate') { // Знайти сусіда (у своє житло)
            setVisible(filterDesiredRoommate, true); // 4. Бажані характеристики сусіда
            // Питання про власні характеристики після бажаних сусіда
            setVisible(askMyChars, true);
            if (showMyChars) {
                setVisible(filterMyChars, true); // 5. Ваші характеристики
            }
            // Питання про характеристики житла ПІСЛЯ власних характеристик (або питання про них)
            setVisible(askCurrentHousing, true);
            if (showCurrentHousing) {
                setVisible(filterCurrentHousing, true); // 3. Характеристики наявного житла
            }

        } else if (selectedGoal === 'rent_out_housing') { // Здати житло (шукати орендаря)
            setVisible(filterDesiredTenant, true); // 6. Бажані характеристики орендаря
            // Питання про характеристики житла ПІСЛЯ бажаних орендаря
            setVisible(askCurrentHousing, true);
            if (showCurrentHousing) {
                setVisible(filterCurrentHousing, true); // 3. Характеристики наявного житла
            }
        } else if (selectedGoal === 'all' || !selectedGoal) { // Всі оголошення
            // Показуємо базові + всі основні секції 2, 3, 4, 5, 6 БЕЗ питань-тригерів
            setVisible(filterDesiredHousing, true);
            setVisible(filterPetDetailsDiv, !!isPetPolicyYes);
            if (!isPetPolicyYes && filterPetDetailsDiv) {
                filterPetDetailsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            }

            setVisible(filterCurrentHousing, true);
            setVisible(filterDesiredRoommate, true);
            setVisible(filterMyChars, true);
            setVisible(filterDesiredTenant, true);
        }
    };

    // --- Функція для запуску пошуку/фільтрації ---
    const triggerSearchAndFilter = () => {
        const formData = new FormData(filtersForm);
        const params = new URLSearchParams();
        const searchTerm = searchInput.value.trim();
        if (searchTerm) params.append('search', searchTerm);

        const selectedGoal = formData.get('user_goal');
        const wantsToShare = formData.get('ready_to_share_filter');

        // *** НОВЕ: Отримуємо значення політики щодо тварин ***
        const selectedPetPolicy = formData.get('search_pet_policy');

        // Визначаємо listing_type для запиту
        if (selectedGoal === 'find_housing') {
            if (wantsToShare === 'no') {
                params.append('listing_type', 'rent_out');
            } else { // 'yes' or 'any' or not set
                params.append('listing_type', 'rent_out');
                params.append('listing_type', 'find_mate');
            }
        } else if (selectedGoal === 'find_roommate') {
            params.append('listing_type', 'find_home');
            params.append('ready_to_share_not', 'no');
        } else if (selectedGoal === 'rent_out_housing') {
            params.append('listing_type', 'find_home');
        }
        // Якщо selectedGoal === 'all', listing_type не додається

        // Збираємо дані з ВИДИМИХ секцій
        const visibleSections = Array.from(filtersForm.querySelectorAll('.filter-section'))
            .filter(el => el.style.display === 'block');

        const characteristics = {
            desired_housing: [],
            current_housing: [],
            my: [],
            desired_roommate: [],
            desired_tenant: []
        };

        visibleSections.forEach(section => {
            const sectionId = section.id;
            // Збираємо значення з select, input[type=number], input[type=text]
            section.querySelectorAll('select, input[type="number"], input[type="text"][name$="_text"]')
                .forEach(input => {
                    const value = input.value?.trim(); // Додаємо ?.trim() для безпеки
                    if (input.name === 'city' && value === 'other') {
                        const otherCityValue = formData.get('city_other_text')?.trim();
                        if (otherCityValue) params.append('city', otherCityValue);
                    }
                    else if (input.name === 'district' && value === 'other') {
                        const otherDistrictValue = formData.get('district_other')?.trim();
                        if (otherDistrictValue) params.append('district', otherDistrictValue);
                    }
                    else if (!['city_other_text', 'district_other'].includes(input.name) && value) {
                        params.append(input.name, value);
                    }
                });
            // Збираємо значення з радіокнопок (крім тригерів, мети та політики тварин)
            section.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
                if (radio.name && !['user_goal', 'show_current_housing', 'show_my_chars', 'ready_to_share_filter', 'search_pet_policy'].includes(radio.name)) {
                    const value = radio.value;
                    if (value && value !== '') params.append(radio.name, value);
                }
            });
            // Збираємо значення з чекбоксів характеристик
            let charGroupName = null;
            if (sectionId === 'filter_desired_housing') charGroupName = 'desired_housing';
            else if (sectionId === 'filter_current_housing') charGroupName = 'current_housing';
            else if (sectionId === 'filter_my_chars') charGroupName = 'my';
            else if (sectionId === 'filter_desired_roommate') charGroupName = 'desired_roommate';
            else if (sectionId === 'filter_desired_tenant') charGroupName = 'desired_tenant';

            if (charGroupName) {
                section.querySelectorAll(`input[type="checkbox"][name$="_characteristics"]:checked`).forEach(checkbox => {
                    characteristics[charGroupName].push(checkbox.value);
                });
            }
        });

        // Додаємо вибрану мету до параметрів
        if (selectedGoal && selectedGoal !== 'all') {
            params.append('user_goal', selectedGoal);
        }

        // Додаємо політику щодо тварин до параметрів, якщо вона не 'any'
        if (selectedPetPolicy && selectedPetPolicy !== 'any') {
            params.append('search_pet_policy', selectedPetPolicy);
        }

        // Додаємо згруповані характеристики до параметрів
        for (const group in characteristics) {
            if (characteristics[group].length > 0) {
                params.append(`${group}_characteristics`, [...new Set(characteristics[group])].join(','));
            }
        }

        const filterQuery = params.toString();
        console.log('Applying search/filters. Goal:', selectedGoal, '| Query:', filterQuery);
        fetchAndDisplayListings(filterQuery);
    };

    // --- Слухачі подій ---

    // Кнопки дій (#actionsMenu)
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const goal = button.getAttribute('data-goal');
            actionButtons.forEach(btn => btn.classList.remove('active-action'));
            button.classList.add('active-action');

            filtersForm.reset();
            searchInput.value = '';

            const goalRadioInForm = filtersForm.querySelector(`input[name="user_goal"][value="${goal}"]`);
            if (goalRadioInForm) goalRadioInForm.checked = true;
            else filtersForm.querySelectorAll('input[name="user_goal"]').forEach(r => r.checked = false);

            // Явно встановлюємо тригери після reset
            filtersForm.querySelector('#show_current_housing_no').checked = true;
            filtersForm.querySelector('#show_my_chars_no').checked = true;
            filtersForm.querySelector('#filter_share_any').checked = true;
            filtersForm.querySelector('#filter_pet_policy_any').checked = true;


            updateFilterVisibility();

            let initialQuery = '';
            if (goal === 'find_housing') initialQuery = 'listing_type=rent_out&listing_type=find_mate';
            else if (goal === 'find_roommate') initialQuery = 'listing_type=find_home&ready_to_share_not=no';
            else if (goal === 'rent_out_housing') initialQuery = 'listing_type=find_home';
            fetchAndDisplayListings(initialQuery);
        });
    });

    // Слухачі для всіх радіокнопок у формі (цілі, тригери, політика тварин)
    filtersForm.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.name === 'user_goal' && radio.checked) {
                const goalValue = radio.value;
                actionButtons.forEach(btn => btn.classList.remove('active-action'));
                document.querySelector(`.action-btn[data-goal="${goalValue}"]`)?.classList.add('active-action');
            }
            updateFilterVisibility(); // Завжди оновлюємо видимість при зміні будь-якого радіо
        });
    });

    // Слухач для відправки форми
    filtersForm.addEventListener('submit', (e) => {
        e.preventDefault();
        triggerSearchAndFilter();
        if (typeof toggleFilters === 'function') {
            toggleFilters('close');
        } else {
            console.warn("toggleFilters function not available for closing sidebar.");
        }
    });

    // Слухач для кнопки "Скинути"
    filtersForm.querySelector('.reset-filters-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        filtersForm.reset();
        searchInput.value = '';

        filtersForm.querySelectorAll('input[name="user_goal"]').forEach(r => r.checked = false);
        actionButtons.forEach(btn => btn.classList.remove('active-action'));
        document.querySelector('.action-btn[data-goal="all"]')?.classList.add('active-action');
        const allRadio = filtersForm.querySelector('input[name="user_goal"][value="all"]');
        if (allRadio) allRadio.checked = true;

        // Явно встановлюємо тригери
        filtersForm.querySelector('#show_current_housing_no').checked = true;
        filtersForm.querySelector('#show_my_chars_no').checked = true;
        filtersForm.querySelector('#filter_share_any').checked = true;
        filtersForm.querySelector('#filter_pet_policy_any').checked = true;


        updateFilterVisibility(); // Покаже всі секції
        fetchAndDisplayListings('');
        console.log('Filters reset, showing all listings.');
    });

    // Слухачі для пошуку
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); triggerSearchAndFilter(); } });
    searchIcon.addEventListener('click', triggerSearchAndFilter);
    searchIcon.style.cursor = 'pointer';

    // Слухач для зміни міста ("Інше")
    const citySelect = filtersForm.querySelector('#filter_city');
    const cityOtherInput = filtersForm.querySelector('#filter_city_other_text');
    if (citySelect && cityOtherInput) {
        citySelect.addEventListener('change', () => {
            const isOther = citySelect.value === 'other';
            cityOtherInput.style.display = isOther ? 'block' : 'none';
            if (!isOther) cityOtherInput.value = '';
        });
        cityOtherInput.style.display = citySelect.value === 'other' ? 'block' : 'none';
    }

    // Слухач для зміни району ("Інше")
    const districtSelect = filtersForm.querySelector('#filter_district');
    const districtOtherInput = filtersForm.querySelector('#filter_district_other_text');
    if (districtSelect && districtOtherInput) {
        districtSelect.addEventListener('change', () => {
            const isOther = districtSelect.value === 'other';
            districtOtherInput.style.display = isOther ? 'block' : 'none';
            if (!isOther) districtOtherInput.value = '';
        });
        districtOtherInput.style.display = districtSelect.value === 'other' ? 'block' : 'none';
    }

    // --- Ініціалізація видимості при завантаженні ---
    const initialGoalButton = document.querySelector('.action-btn.active-action');
    const initialGoal = initialGoalButton?.getAttribute('data-goal') || 'all';
    const initialRadioInForm = filtersForm.querySelector(`input[name="user_goal"][value="${initialGoal}"]`);
    if(initialRadioInForm) initialRadioInForm.checked = true;
    else {
        const allRadio = filtersForm.querySelector('input[name="user_goal"][value="all"]');
        if (allRadio) allRadio.checked = true;
    }

    // Встановлюємо початкові значення тригерів
    filtersForm.querySelector('#show_current_housing_no').checked = true;
    filtersForm.querySelector('#show_my_chars_no').checked = true;
    filtersForm.querySelector('#filter_share_any').checked = true;
    filtersForm.querySelector('#filter_pet_policy_any').checked = true;

    updateFilterVisibility(); // Викликаємо для встановлення початкової видимості
};

