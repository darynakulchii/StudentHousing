// js/modules/forms.js

import { MY_USER_ID, getAuthHeaders } from './auth.js';
// Потрібно буде створити ui.js і експортувати photoUtils, або визначити їх тут
import { triggerFileInput, updatePhotoDisplay, selectedFiles, removeFile, initPhotoHandling } from './photoUtils.js';

/**
 * Керує динамічною видимістю полів ТА атрибутами 'required'
 * для форм СТВОРЕННЯ та РЕДАГУВАННЯ оголошень.
 * @param {string} formId - ID форми ('addListingForm' або 'editListingForm').
 */
export const setupDynamicFormLogic = (formId) => {
    const form = document.getElementById(formId);
    if (!form) return;

    // --- Знаходимо ВСІ необхідні елементи форми ---
    const roommatePrefs = form.querySelector('#roommatePreferences');
    const housingFilters = form.querySelector('#housingFilters');
    const listingDetails = form.querySelector('#listingDetails');
    const aboutMe = form.querySelector('#aboutMe');
    const priceGroup = form.querySelector('#priceGroup');
    const photoGroup = form.querySelector('#photoGroup'); // Може бути null в edit
    const maxOccupantsGroup = form.querySelector('#maxOccupantsGroup');
    const findMateGroups = form.querySelector('#findMateGroups');
    const myGroupSizeGroup = form.querySelector('#myGroupSizeGroup');
    const targetRoommatesTotalGroup = form.querySelector('#targetRoommatesTotalGroup');
    const studentParams = form.querySelector('#studentParams');
    const myGroupCountSelect = form.querySelector('#my_group_count'); // Селект кількості друзів

    // Поля, що можуть бути required
    const priceInput = form.querySelector('#price');
    const targetPriceMaxInput = form.querySelector('#target_price_max');
    const myGenderRadios = form.querySelectorAll('input[name="my_gender"]');
    const myAgeInput = form.querySelector('#my_age');
    const maxOccupantsSelect = form.querySelector('#max_occupants');
    const currentOccupantsSelect = form.querySelector('#current_occupants');
    const seekingRoommatesSelect = form.querySelector('#seeking_roommates');
    const roomsSelect = form.querySelector('#rooms');
    const floorInput = form.querySelector('#floor');
    const totalFloorsInput = form.querySelector('#total_floors');
    const totalAreaInput = form.querySelector('#total_area');
    const kitchenAreaInput = form.querySelector('#kitchen_area');
    const furnishingRadios = form.querySelectorAll('input[name="furnishing"]');

    // Масив усіх полів, що можуть бути required, для легкого скидання
    const potentiallyRequiredFields = [
        priceInput, targetPriceMaxInput, myAgeInput, maxOccupantsSelect,
        currentOccupantsSelect, seekingRoommatesSelect, roomsSelect, floorInput,
        totalFloorsInput, totalAreaInput, kitchenAreaInput,
        ...myGenderRadios, ...furnishingRadios // Додаємо радіо кнопки
    ].filter(el => el); // Фільтруємо null, якщо елемент не знайдено

    // Слухачі змін для динаміки
    const listingTypeRadios = form.querySelectorAll('input[name="listing_type"]');
    const readyToShareRadios = form.querySelectorAll('input[name="ready_to_share"]');
    const isStudentRadios = form.querySelectorAll('input[name="is_student"]');
    const myGroupSizeRadios = form.querySelectorAll('input[name="my_group_size"]');


    /**
     * Основна функція, що оновлює видимість секцій та 'required' атрибути.
     */
    function updateVisibility() {
        // --- 1. Отримуємо поточні значення ---
        // Для edit форми, де тип не можна змінити, беремо з прихованого поля
        const selectedTypeInput = form.querySelector('input[name="listing_type"]:checked')
            || form.querySelector('input[name="listing_type"][type="hidden"]');
        const selectedType = selectedTypeInput?.value;

        const isSharing = form.querySelector('input[name="ready_to_share"]:checked')?.value;
        const isStudent = form.querySelector('input[name="is_student"]:checked')?.value;
        const myGroupSize = form.querySelector('input[name="my_group_size"]:checked')?.value;

        // --- 2. Скидаємо видимість для всіх динамічних блоків ---
        [roommatePrefs, housingFilters, listingDetails, aboutMe, priceGroup, photoGroup,
            maxOccupantsGroup, findMateGroups, myGroupSizeGroup, targetRoommatesTotalGroup,
            studentParams, myGroupCountSelect]
            .filter(el => el) // Перевіряємо, чи елемент існує
            .forEach(el => el.style.display = 'none');

        // --- 3. Скидаємо 'required' для всіх полів ---
        potentiallyRequiredFields.forEach(field => field.required = false);

        // --- 4. Налаштовуємо видимість і 'required' на основі типу ---
        if (selectedType === 'find_home') {
            // Показуємо:
            if(housingFilters) housingFilters.style.display = 'block';
            if(aboutMe) aboutMe.style.display = 'block';
            if(myGroupSizeGroup) myGroupSizeGroup.style.display = 'block';
            if(targetRoommatesTotalGroup) targetRoommatesTotalGroup.style.display = 'block';

            // Показуємо вибір кількості друзів, якщо обрано 'more'
            if (myGroupSize === 'more' && myGroupCountSelect) {
                myGroupCountSelect.style.display = 'block';
            }
            // Показуємо вимоги до сусіда, якщо готові ділити житло
            if (isSharing !== 'no' && roommatePrefs) {
                roommatePrefs.style.display = 'block';
            }
            // Показуємо параметри студента
            if (isStudent === 'yes' && studentParams) {
                studentParams.style.display = 'block';
            }

            // Встановлюємо required:
            if (targetPriceMaxInput) targetPriceMaxInput.required = true;
            if (myAgeInput) myAgeInput.required = true;
            myGenderRadios.forEach(radio => radio.required = true);

        } else if (selectedType === 'rent_out') {
            // Показуємо:
            if(listingDetails) listingDetails.style.display = 'block';
            if(photoGroup) photoGroup.style.display = 'block'; // фото для здачі
            if(priceGroup) priceGroup.style.display = 'block';
            if(maxOccupantsGroup) maxOccupantsGroup.style.display = 'block';

            // Встановлюємо required:
            if (priceInput) priceInput.required = true;
            if (maxOccupantsSelect) maxOccupantsSelect.required = true;
            if (roomsSelect) roomsSelect.required = true;
            if (floorInput) floorInput.required = true;
            if (totalFloorsInput) totalFloorsInput.required = true;
            if (totalAreaInput) totalAreaInput.required = true;
            if (kitchenAreaInput) kitchenAreaInput.required = true;
            furnishingRadios.forEach(radio => radio.required = true);

        } else if (selectedType === 'find_mate') {
            // Показуємо:
            if(listingDetails) listingDetails.style.display = 'block';
            if(roommatePrefs) roommatePrefs.style.display = 'block';
            if(aboutMe) aboutMe.style.display = 'block';
            if(photoGroup) photoGroup.style.display = 'block'; // фото для пошуку сусіда
            if(priceGroup) priceGroup.style.display = 'block';
            if(findMateGroups) findMateGroups.style.display = 'block';

            // Встановлюємо required:
            if (priceInput) priceInput.required = true;
            if (myAgeInput) myAgeInput.required = true;
            myGenderRadios.forEach(radio => radio.required = true);
            if (currentOccupantsSelect) currentOccupantsSelect.required = true;
            if (seekingRoommatesSelect) seekingRoommatesSelect.required = true;
            // Поля житла теж required
            if (roomsSelect) roomsSelect.required = true;
            if (floorInput) floorInput.required = true;
            if (totalFloorsInput) totalFloorsInput.required = true;
            if (totalAreaInput) totalAreaInput.required = true;
            if (kitchenAreaInput) kitchenAreaInput.required = true;
            furnishingRadios.forEach(radio => radio.required = true);
        }
    }

    // --- Додаємо слухачі подій ---
    // Тільки для форми створення, бо в редагуванні тип не змінюється
    if (formId === 'addListingForm') {
        listingTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const hint = form.querySelector('#listingTypeHint');
                if (hint) hint.style.display = 'none'; // Ховаємо підказку при виборі
                updateVisibility();
            });
        });
        // Перевірка при відправці, чи обрано тип
        form.addEventListener('submit', function(event) {
            const selectedType = form.querySelector('input[name="listing_type"]:checked');
            // Додаткова перевірка, чи значення не порожнє (для прихованого required інпута)
            if (!selectedType || !selectedType.value) {
                event.preventDefault();
                const listingTypeHint = form.querySelector('#listingTypeHint');
                if (listingTypeHint) {
                    listingTypeHint.style.display = 'block';
                    // Прокрутка до підказки
                    listingTypeHint.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                alert('Будь ласка, оберіть тип оголошення: Здати житло, Знайти сусіда або Знайти житло.');
            }
        });
    }

    // Слухачі, що впливають на видимість інших блоків
    if(readyToShareRadios) readyToShareRadios.forEach(radio => radio.addEventListener('change', updateVisibility));
    if(isStudentRadios) isStudentRadios.forEach(radio => radio.addEventListener('change', updateVisibility));
    if(myGroupSizeRadios) myGroupSizeRadios.forEach(radio => radio.addEventListener('change', updateVisibility));

    // --- Перший виклик для ініціалізації ---
    // Важливо: для edit форми це має викликатися ПІСЛЯ завантаження даних
    if (formId === 'addListingForm') {
        updateVisibility();
    }

    // Повертаємо функцію, щоб її можна було викликати ззовні (для edit форми)
    return updateVisibility;
};


/**
 * Обробляє відправку форми СТВОРЕННЯ оголошення.
 */
export const handleListingSubmission = async () => {
    const form = document.getElementById('addListingForm');
    // Елементи для фото (припускаємо, що вони є в DOM)
    const photoInput = document.getElementById('listingPhotosInput');
    const previewContainer = document.getElementById('photoPreviewContainer');
    const submitButton = form?.querySelector('.submit-listing-btn');
    if (!form || !submitButton) return; // Основна перевірка

    // Ініціалізуємо логіку фото, якщо елементи існують
    if (photoInput && previewContainer) {
        initPhotoHandling(photoInput, previewContainer);
    } else {
        console.warn('Елементи для завантаження фото не знайдено.');
    }


    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб додати оголошення.');
        window.location.href = 'login.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedType = form.querySelector('input[name="listing_type"]:checked')?.value;
        const requiresPhoto = selectedType === 'rent_out' || selectedType === 'find_mate';
        // selectedFiles імпортується з photoUtils.js
        if (requiresPhoto && selectedFiles.length === 0) {
            alert('Будь ласка, додайте хоча б одну фотографію для цього типу оголошення.');
            // Прокручуємо до секції фото
            photoGroup?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        delete data.photos; // Видаляємо поле з текстових даних

        // Збираємо характеристики
        const characteristics = formData.getAll('characteristics');
        const searchCharacteristics = formData.getAll('search_characteristics');
        const allCharacteristics = [...characteristics, ...searchCharacteristics].filter(key => {
            return key && key !== 'my_pet_no' && key !== 'mate_no_pet';
        });
        data.characteristics = [...new Set(allCharacteristics)];
        delete data.search_characteristics;

        submitButton.disabled = true;
        submitButton.textContent = 'Публікація...';

        try {
            // 1. Створюємо оголошення (текстові дані)
            const listingResponse = await fetch('http://localhost:3000/api/listings', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            });

            let listingResult; // Оголошуємо змінну тут
            if (listingResponse.ok) {
                listingResult = await listingResponse.json(); // Присвоюємо значення
            } else {
                // Обробка помилок відповіді від сервера
                if (listingResponse.status === 401 || listingResponse.status === 403) {
                    alert('Помилка автентифікації. Будь ласка, увійдіть знову.');
                    window.location.href = 'login.html';
                } else {
                    const errorData = await listingResponse.json();
                    alert(`Помилка публікації: ${errorData.error || 'Невідома помилка сервера'}`);
                }
                throw new Error('Помилка при створенні оголошення'); // Зупиняємо виконання
            }

            const listingId = listingResult.listingId;
            console.log(`Оголошення створено, ID: ${listingId}`);

            // 2. Завантажуємо фото (ЯКЩО вони є і ID отримано)
            if (selectedFiles.length > 0 && listingId) {
                console.log(`Завантаження ${selectedFiles.length} фото для оголошення ${listingId}...`);
                const photoFormData = new FormData();
                selectedFiles.forEach(file => {
                    photoFormData.append('photos', file);
                });

                const photoResponse = await fetch(`http://localhost:3000/api/upload/listing-photos/${listingId}`, {
                    method: 'POST',
                    headers: getAuthHeaders(false), // isJson = false
                    body: photoFormData,
                });

                if (!photoResponse.ok) {
                    const errorData = await photoResponse.json();
                    // Повідомляємо про помилку фото, але оголошення вже створено
                    alert(`Оголошення створено (ID: ${listingId}), але сталася помилка при завантаженні фото: ${errorData.error || 'Невідома помилка'}. Ви можете додати фото пізніше через редагування.`);
                    console.error('Помилка завантаження фото:', errorData);
                    // Все одно переходимо на сторінку оголошення
                    window.location.href = `listing_detail.html?id=${listingId}`;
                    return; // Виходимо, щоб не показувати фінальний alert
                } else {
                    const photoResult = await photoResponse.json();
                    console.log(photoResult.message);
                }
            }

            // 3. Успішне завершення (після створення тексту і, можливо, фото)
            alert(`Успіх! Оголошення опубліковано (ID: ${listingId})`);
            form.reset();
            selectedFiles.length = 0; // Очищуємо масив файлів (photoUtils)
            if(updatePhotoDisplay) updatePhotoDisplay(); // Оновлюємо відображення (photoUtils)
            window.location.href = `listing_detail.html?id=${listingId}`; // Перехід на сторінку оголошення

        } catch (error) {
            console.error('Помилка під час відправки оголошення:', error);
            // Повертаємо текст кнопки, якщо це була не помилка відповіді сервера
            if (!error.message.includes('Помилка при створенні оголошення')) {
                alert('Не вдалося з’єднатися з сервером. Перевірте консоль.');
            }
        } finally {
            // Переконуємося, що кнопка розблокована
            submitButton.disabled = false;
            submitButton.textContent = 'Опублікувати оголошення';
        }
    });
};

/**
 * Завантажує дані оголошення та заповнює форму редагування.
 * @param {string} formId - ID форми ('editListingForm').
 * @param {string} listingId - ID оголошення для завантаження.
 */
export const loadListingDataForEdit = async (formId, listingId) => {
    const form = document.getElementById(formId);
    if (!form) return;

    const submitButton = form.querySelector('.submit-listing-btn');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Завантаження даних...';
    }

    try {
        const response = await fetch(`http://localhost:3000/api/listings/${listingId}`);
        if (response.status === 404) throw new Error('Оголошення не знайдено.');
        if (!response.ok) throw new Error('Не вдалося завантажити дані оголошення.');

        const listing = await response.json();

        // Перевірка власника (використовуємо MY_USER_ID з auth.js)
        if (MY_USER_ID !== listing.user_id) {
            alert('Ви не можете редагувати це оголошення.');
            window.location.href = 'my_listings.html';
            return;
        }

        // --- Заповнення форми ---
        // 1. Зберігаємо початковий тип у приховане поле
        const initialTypeField = form.querySelector('#initialListingType');
        if (initialTypeField) initialTypeField.value = listing.listing_type;

        // 2. Заповнюємо прості поля (input, select, textarea)
        Object.keys(listing).forEach(key => {
            const element = form.elements[key];
            if (element) {
                if (element.length && element[0]?.type === 'radio') {
                    // Радіокнопки
                    form.querySelectorAll(`input[name="${key}"]`).forEach(radio => {
                        radio.checked = (String(radio.value) === String(listing[key]));
                    });
                } else if (element.type !== 'checkbox' && element.type !== 'file') {
                    // Інші поля (крім чекбоксів та файлів)
                    element.value = listing[key] ?? ''; // Використовуємо ?? для null/undefined
                }
            }
        });

        // 3. Заповнюємо чекбокси (Характеристики)
        form.querySelectorAll('input[name="characteristics"], input[name="search_characteristics"]').forEach(cb => cb.checked = false);
        if (listing.characteristics) {
            listing.characteristics.forEach(char => {
                const checkbox = form.querySelector(`input[name="characteristics"][value="${char.system_key}"], input[name="search_characteristics"][value="${char.system_key}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // 4. Заповнюємо ID оголошення
        const idField = form.querySelector('#listingIdField');
        if (idField) idField.value = listingId;

        // 5. Завантажуємо та відображаємо ІСНУЮЧІ фото
        // Потрібно буде реалізувати логіку в photoUtils.js для відображення
        // існуючих фото з listing.photos та їх видалення/зміни порядку
        // loadAndDisplayExistingPhotos(listing.photos); // Гіпотетична функція

        // 6. Викликаємо updateVisibility ПІСЛЯ заповнення даних
        const updateVisibilityFunc = setupDynamicFormLogic(formId);
        if(updateVisibilityFunc) updateVisibilityFunc();


    } catch (error) {
        console.error('Помилка завантаження даних для редагування:', error);
        alert(`Помилка: ${error.message}`);
        window.location.href = 'my_listings.html';
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Зберегти зміни';
        }
    }
};

/**
 * Обробляє відправку форми РЕДАГУВАННЯ оголошення (без нових фото).
 */
export const handleListingUpdateSubmission = async () => {
    const form = document.getElementById('editListingForm');
    const submitButton = form?.querySelector('.submit-listing-btn');
    if (!form || !submitButton) return;

    if (!MY_USER_ID) {
        alert('Будь ласка, увійдіть, щоб редагувати оголошення.');
        window.location.href = 'login.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const listingId = form.querySelector('#listingIdField')?.value;
        if (!listingId) {
            alert('Помилка: ID оголошення не знайдено.');
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Видаляємо поля, які не мають оновлюватися або обробляються окремо
        delete data.photos; // Фото обробляються окремо
        delete data.listing_id; // ID береться з URL
        delete data.initialListingType; // Не надсилаємо початковий тип

        // Збираємо характеристики
        const characteristics = formData.getAll('characteristics');
        const searchCharacteristics = formData.getAll('search_characteristics');
        const allCharacteristics = [...characteristics, ...searchCharacteristics].filter(key => {
            return key && key !== 'my_pet_no' && key !== 'mate_no_pet';
        });
        data.characteristics = [...new Set(allCharacteristics)];
        delete data.search_characteristics;

        submitButton.disabled = true;
        submitButton.textContent = 'Збереження...';

        try {
            // Оновлюємо оголошення (текстові дані та характеристики)
            const listingResponse = await fetch(`http://localhost:3000/api/listings/${listingId}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data),
            });

            if (listingResponse.ok) {
                // Тут можна додати логіку завантаження/видалення фото, якщо потрібно
                // await handlePhotoUpdatesForEdit(listingId); // Гіпотетична функція

                alert(`Успіх! Оголошення оновлено.`);
                window.location.href = `listing_detail.html?id=${listingId}`; // Перехід на сторінку деталей

            } else if (listingResponse.status === 401 || listingResponse.status === 403) {
                alert('Помилка автентифікації або доступу. Будь ласка, увійдіть знову.');
                window.location.href = 'login.html';
            } else {
                const errorData = await listingResponse.json();
                alert(`Помилка оновлення: ${errorData.error || 'Невідома помилка'}`);
            }

        } catch (error) {
            console.error('Помилка мережі/сервера при оновленні:', error);
            alert('Не вдалося з’єднатися з сервером.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Зберегти зміни';
        }
    });
};

// Додатково: Логіка для фото в редагуванні (потрібно створити photoUtils.js)
// const handlePhotoUpdatesForEdit = async (listingId) => {
//     // 1. Визначити, які фото видалено (порівняти початковий список з поточним у selectedFiles)
//     // 2. Надіслати запити на DELETE /api/photos/:photoId для видалених
//     // 3. Визначити, які фото додано (нові файли у selectedFiles)
//     // 4. Надіслати запит на POST /api/upload/listing-photos/:listingId для нових
//     // 5. Визначити, чи змінився порядок або головне фото
//     // 6. Надіслати запит на PATCH /api/photos/reorder для оновлення порядку/is_main
// };