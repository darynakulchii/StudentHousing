// js/modules/photoUtils.js

// Максимальна кількість фото
const MAX_PHOTOS = 8;

// Глобальний масив для зберігання вибраних файлів (File об'єктів)
// Його експортуємо, щоб інші модулі (forms.js) могли його читати
export let selectedFiles = [];

// Посилання на DOM елементи (ініціалізуються в initPhotoHandling)
let photoInput = null;
let previewContainer = null;

/**
 * Ініціалізує логіку обробки фото для конкретної форми.
 * Викликається з forms.js або app.js після завантаження DOM.
 * @param {HTMLInputElement} inputElement - Елемент input type="file".
 * @param {HTMLElement} containerElement - Контейнер для прев'ю (photo-upload-grid).
 */
export function initPhotoHandling(inputElement, containerElement) {
    if (!inputElement || !containerElement) {
        console.error("Photo input or preview container not found for initialization.");
        return;
    }
    photoInput = inputElement;
    previewContainer = containerElement;

    // Очищаємо масив файлів при ініціалізації (на випадок перезавантаження форми)
    selectedFiles = [];

    // Додаємо слухач змін до input type="file"
    photoInput.addEventListener('change', handleFileSelection);

    // Ініціалізуємо відображення (показуємо порожні слоти/кнопку "Додати")
    updatePhotoDisplay();
}

/**
 * Обробляє вибір нових файлів користувачем.
 * @param {Event} event - Подія 'change' від input type="file".
 */
function handleFileSelection(event) {
    const files = event.target.files;
    if (!files || !photoInput) return; // Додано перевірку photoInput

    const currentCount = selectedFiles.length;
    const availableSlots = MAX_PHOTOS - currentCount;

    // Перевіряємо, чи є вільні слоти
    if (availableSlots <= 0) {
        alert(`Ви вже додали максимальну кількість фото (${MAX_PHOTOS}).`);
        photoInput.value = null; // Скидаємо вибір
        return;
    }

    const filesToAddCount = Math.min(files.length, availableSlots);

    if (files.length > availableSlots) {
        alert(`Можна додати ще ${availableSlots} фото. Буде додано перші ${filesToAddCount}.`);
    }

    // Додаємо тільки дозволену кількість нових файлів до масиву
    for (let i = 0; i < filesToAddCount; i++) {
        // Додаткова перевірка типу файлу (хоча input[accept] вже фільтрує)
        if (files[i].type.startsWith('image/')) {
            selectedFiles.push(files[i]);
        } else {
            console.warn(`Файл "${files[i].name}" не є зображенням і буде проігнорований.`);
        }
    }

    // Скидаємо значення input після обробки, щоб подія 'change' спрацювала знову
    photoInput.value = null;

    updatePhotoDisplay(); // Оновлюємо відображення прев'ю
}

/**
 * Видаляє файл зі списку `selectedFiles` за індексом та оновлює відображення.
 * @param {number} indexToRemove - Індекс файлу для видалення.
 */
export function removeFile(indexToRemove) {
    if (indexToRemove < 0 || indexToRemove >= selectedFiles.length) return;

    selectedFiles.splice(indexToRemove, 1); // Видаляємо файл з масиву
    // Не потрібно скидати photoInput.value тут, бо це робиться при додаванні

    console.log(`Фото з індексом ${indexToRemove} видалено.`);
    updatePhotoDisplay(); // Оновлюємо відображення
}

/**
 * Програмно викликає клік на прихований input type="file".
 * Ця функція робиться доступною глобально або викликається через обробник події на кнопці "+ Додати фото".
 */
export function triggerFileInput() {
    if (photoInput) {
        if (selectedFiles.length < MAX_PHOTOS) {
            photoInput.click();
        } else {
            alert(`Ви вже додали максимальну кількість фото (${MAX_PHOTOS}).`);
        }
    } else {
        console.error("Photo input element not initialized.");
    }
}


/**
 * Оновлює відображення прев'ю фотографій у контейнері.
 * Створює кнопки видалення та мітку "Головне".
 */
export function updatePhotoDisplay() {
    if (!previewContainer) return;

    // Знаходимо всі плейсхолдери всередині контейнера
    const placeholders = previewContainer.querySelectorAll('.photo-upload-placeholder');

    placeholders.forEach((div, index) => {
        // --- 1. Очищення та скидання стану ---
        div.innerHTML = ''; // Видаляємо старий вміст (кнопки, мітки)
        div.style.backgroundImage = ''; // Скидаємо фонове зображення
        div.className = 'photo-upload-placeholder'; // Скидаємо класи до базового
        div.onclick = null; // Скидаємо попередній обробник кліка
        div.title = ''; // Скидаємо title
        div.style.cursor = 'default'; // Скидаємо курсор
        div.style.borderStyle = 'dashed'; // Базовий стиль рамки

        // --- 2. Відображення прев'ю існуючих файлів ---
        if (index < selectedFiles.length) {
            const file = selectedFiles[index];
            const reader = new FileReader();

            reader.onload = (e) => {
                div.classList.add('preview');
                div.style.backgroundImage = `url('${e.target.result}')`;
                // Стилі для cover/center краще задати в CSS для класу .preview
                div.style.borderStyle = 'solid'; // Рамка для прев'ю

                // Додаємо кнопку видалення
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'photo-delete-btn';
                deleteBtn.innerHTML = '&times;'; // Хрестик
                deleteBtn.title = 'Видалити фото';
                deleteBtn.type = 'button'; // Важливо!
                deleteBtn.onclick = (event) => {
                    event.stopPropagation(); // Не викликати triggerFileInput
                    removeFile(index);
                };
                div.appendChild(deleteBtn);

                // Позначаємо головне фото (перше у масиві)
                if (index === 0) {
                    const mainLabel = document.createElement('span');
                    mainLabel.className = 'photo-main-label';
                    mainLabel.textContent = 'Головне';
                    div.appendChild(mainLabel);
                    div.title = 'Головне фото';
                }
            }
            reader.readAsDataURL(file); // Запускаємо читання файлу

            // --- 3. Відображення кнопки "Додати фото" ---
        } else if (index === selectedFiles.length && selectedFiles.length < MAX_PHOTOS) {
            // Наступний порожній слот стає кнопкою "Додати"
            div.classList.add('add-photo-btn');
            div.innerHTML = '+ Додати фото';
            div.style.cursor = 'pointer';
            // Встановлюємо обробник кліка, який викличе вибір файлу
            div.onclick = triggerFileInput;
            // Рамка вже dashed (встановлено на початку)

            // --- 4. Порожні слоти (якщо їх більше, ніж MAX_PHOTOS) ---
        } else {
            // Решта слотів залишаються порожніми з dashed рамкою
            // Можна додати стиль в CSS для .photo-upload-placeholder::before { content: '+'; }
            // для візуального плюсика, якщо потрібно
        }
    });
}

// Поки що не реалізовано:
// - Перетягування для зміни порядку
// - Обробка існуючих фото для форми редагування