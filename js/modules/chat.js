// =================================================================================
// МОДУЛЬ ЧАТУ
// =================================================================================

import { getAuthHeaders, MY_USER_ID } from './auth.js';
import { prependNotification, markNotificationsAsRead, notificationSidebar, incrementNotificationCount } from './navigation.js';

// --- Стан модуля ---
let socket; // Екземпляр Socket.IO
let currentOpenConversationId = null; // ID поточної відкритої розмови
let currentOpenReceiverId = null; // ID співрозмовника в поточній відкритій розмові

// Завантажує список розмов користувача та відображає їх у бічній панелі.
export const loadConversations = async () => {
    const container = document.getElementById('conversationsList');
    if (!container) return; // Виходимо, якщо елемент контейнера не існує

    container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Завантаження розмов...</p>';

    try {
        // Отримуємо розмови з бекенду
        const response = await fetch('http://localhost:3000/api/my-conversations', {
            headers: getAuthHeaders()
        });
        // Обробляємо помилки автентифікації
        if (response.status === 401 || response.status === 403) throw new Error('Необхідна автентифікація для доступу до чату.');
        if (!response.ok) throw new Error(`HTTP помилка! статус: ${response.status}`);

        const conversations = await response.json();
        container.innerHTML = ''; // Очищуємо індикатор завантаження

        // Обробляємо випадок, коли розмов немає
        if (conversations.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-light);">У вас ще немає розмов.</p>';
            // Скидаємо UI вікна чату
            const messagesArea = document.getElementById('messagesArea');
            const chatHeader = document.getElementById('chatHeader');
            const messageForm = document.getElementById('messageForm');
            if(messagesArea) messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Оберіть або почніть нову розмову.</p>';
            if(chatHeader) chatHeader.textContent = 'Оберіть розмову';
            if(messageForm) messageForm.style.display = 'none';
            return;
        }

        // Рендеримо елементи списку розмов
        conversations.forEach(convo => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            // Зберігаємо data-атрибути для подальшого використання (відкриття чату, відправлення повідомлень)
            item.dataset.conversationId = convo.conversation_id;
            item.dataset.receiverId = convo.other_user_id;
            item.dataset.receiverName = `${convo.first_name} ${convo.last_name}`;
            item.innerHTML = `
                <span class="avatar-placeholder"><i class="fas fa-user-circle"></i></span>
                <span>${convo.first_name} ${convo.last_name}</span>
            `;
            // Додаємо обробник кліку для завантаження повідомлень та виділення обраної розмови
            item.addEventListener('click', () => {
                loadMessages(convo.conversation_id, convo.other_user_id, `${convo.first_name} ${convo.last_name}`);
                // Видаляємо клас 'active' з усіх елементів та додаємо його до клікнутого
                document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
            });
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Помилка завантаження розмов:', error);
        container.innerHTML = `<p style="color: red; padding: 10px;">Помилка завантаження. ${error.message}</p>`;
    }
};

/**
 * Завантажує та відображає повідомлення для обраної розмови.
 * @param {number|string} conversationId ID розмови.
 * @param {number|string} receiverId ID співрозмовника.
 * @param {string} receiverName Ім'я співрозмовника.
 */
export const loadMessages = async (conversationId, receiverId, receiverName) => {
    const messagesArea = document.getElementById('messagesArea');
    const chatHeader = document.getElementById('chatHeader');
    const messageForm = document.getElementById('messageForm');
    if (!messagesArea || !chatHeader || !messageForm) return; // Переконуємось, що всі елементи існують

    // Оновлюємо глобальний стан для поточного відкритого чату
    currentOpenConversationId = conversationId.toString();
    currentOpenReceiverId = receiverId;

    // Оновлюємо елементи UI (заголовок, показ форми вводу)
    chatHeader.textContent = receiverName;
    messageForm.style.display = 'flex';
    // Показуємо індикатор завантаження повідомлень
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;"><i class="fas fa-spinner fa-spin"></i> Завантаження повідомлень...</p>';

    try {
        // Отримуємо повідомлення для конкретної розмови
        const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}/messages`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) throw new Error('Помилка доступу до чату');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const messages = await response.json();
        messagesArea.innerHTML = ''; // Очищуємо індикатор завантаження

        // Відображаємо повідомлення або плейсхолдер, якщо їх немає
        if (messages.length === 0) {
            messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Повідомлень ще немає.</p>';
        } else {
            messages.forEach(msg => appendMessage(msg));
            // Прокручуємо вниз, щоб показати останні повідомлення
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

    } catch (error) {
        // Відображаємо повідомлення про помилку, якщо не вдалося завантажити повідомлення
        console.error('Помилка завантаження повідомлень:', error);
        messagesArea.innerHTML = `<p style="color: red; margin: auto;">Помилка завантаження. ${error.message}</p>`;
    }
};

// Додає DOM-елемент повідомлення (надісланого чи отриманого) до області чату.
const appendMessage = (msg) => {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;

    // Видаляємо плейсхолдер, якщо він є
    const placeholder = messagesArea.querySelector('p');
    if (placeholder) placeholder.remove();

    // Створюємо елемент повідомлення та додаємо відповідні класи для стилізації
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.classList.add(msg.sender_id === MY_USER_ID ? 'sent' : 'received');
    messageEl.textContent = msg.message_body;
    messagesArea.appendChild(messageEl);
};

// Налаштовує обробник події для форми відправки повідомлень.
export const handleMessageSend = () => {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const sendButton = messageForm?.querySelector('button[type="submit"]');
    const messagesArea = document.getElementById('messagesArea'); // Потрібно для прокрутки
    if (!messageForm || !messageInput || !sendButton || !messagesArea) return;

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Запобігаємо стандартній відправці форми
        const messageBody = messageInput.value.trim();

        // Не відправляти порожні повідомлення або якщо розмова не відкрита
        if (messageBody === '' || !currentOpenReceiverId) return;

        sendButton.disabled = true; // Блокуємо кнопку під час запиту

        try {
            // Надсилаємо дані повідомлення на бекенд
            const response = await fetch('http://localhost:3000/api/messages', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    receiver_id: currentOpenReceiverId,
                    message_body: messageBody
                })
            });

            if (response.ok) {
                const newMessage = await response.json();
                messageInput.value = ''; // Очищуємо поле вводу
                messageInput.focus(); // Залишаємо фокус на полі вводу

                // Оптимістично додаємо відправлене повідомлення до UI
                appendMessage(newMessage);
                messagesArea.scrollTop = messagesArea.scrollHeight; // Прокручуємо вниз

                // Якщо це було перше повідомлення, створилася нова розмова
                if (currentOpenConversationId === null && newMessage.conversation_id) {
                    console.log('Створено нову розмову, ID:', newMessage.conversation_id);
                    currentOpenConversationId = newMessage.conversation_id.toString();

                    // Приєднуємось до Socket.IO кімнати для нової розмови
                    if (socket) {
                        socket.emit('join_conversation', currentOpenConversationId);
                    }
                    // Перезавантажуємо список розмов, щоб показати нову
                    await loadConversations();
                    // Виділяємо новостворену розмову в списку
                    const newItem = document.querySelector(`.conversation-item[data-conversation-id="${currentOpenConversationId}"]`);
                    if (newItem) newItem.classList.add('active');
                }
            } else {
                // Обробляємо помилки бекенду
                const errorData = await response.json();
                alert(`Помилка відправки: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            // Обробляємо мережеві помилки
            console.error('Помилка відправки:', error);
            alert('Помилка мережі.');
        } finally {
            sendButton.disabled = false; // Розблоковуємо кнопку відправки
        }
    });
};

// Ініціалізує з'єднання Socket.IO та налаштовує обробники подій.
export const setupSocketIO = () => {
    // Перевіряємо, чи завантажена бібліотека Socket.IO
    if (typeof io === 'undefined') {
        console.warn('Клієнтська бібліотека Socket.io не знайдена.');
        return;
    }
    // Підключаємось тільки якщо користувач авторизований
    if (!MY_USER_ID) {
        console.log("Користувач не авторизований, Socket.IO не підключається.");
        return;
    }
    // Запобігаємо повторному підключенню
    if (socket && socket.connected) {
        console.log("Socket.IO вже підключено.");
        return;
    }

    console.log("Підключення до Socket.IO...");
    socket = io("http://localhost:3000"); // Підключаємось до сервера бекенду

    // При успішному підключенні
    socket.on('connect', () => {
        console.log(`Socket.io підключено: ${socket.id}`);
        // Приєднуємось до приватної кімнати для сповіщень користувача
        socket.emit('join_user_room', MY_USER_ID);

        // Якщо зараз на сторінці чату, приєднуємось до кімнат існуючих розмов
        if (window.location.pathname.endsWith('chat.html')) {
            console.log('Приєднуємось до кімнат чатів socket.io...');
            const conversationItems = document.querySelectorAll('.conversation-item');
            conversationItems.forEach(item => {
                const convoId = item.dataset.conversationId;
                if (convoId) {
                    socket.emit('join_conversation', convoId);
                }
            });
        }
    });

    // Обробник отримання нових повідомлень
    socket.on('receive_message', (newMessage) => {
        console.log('Отримано нове повідомлення:', newMessage);
        const messagesArea = document.getElementById('messagesArea');
        if (!messagesArea) return;

        // Перевіряємо, чи повідомлення належить до поточної відкритої розмови
        if (currentOpenConversationId && newMessage.conversation_id.toString() === currentOpenConversationId) {
            // Додаємо повідомлення, тільки якщо воно не від поточного користувача (вже додано оптимістично)
            if (newMessage.sender_id !== MY_USER_ID) {
                appendMessage(newMessage);
                messagesArea.scrollTop = messagesArea.scrollHeight; // Прокручуємо вниз
            }
        } else {
            // Якщо повідомлення для іншої розмови, перезавантажуємо список для індикації активності (напр., виділення)
            console.log("Повідомлення для іншої розмови, оновлюємо список розмов...");
            loadConversations(); // Перезавантажуємо список розмов
        }
    });

    // Обробник отримання нових сповіщень
    socket.on('new_notification', (notification) => {
        console.log('Отримано нове сповіщення:', notification);
        prependNotification(notification); // Додаємо сповіщення на початок списку (використовуючи імпортовану функцію)

        const isSidebarOpen = notificationSidebar?.classList.contains('open');
        if (!isSidebarOpen) {
            // === ЗМІНА ТУТ: Викликаємо функцію інкременту ===
            incrementNotificationCount(); // Збільшуємо лічильник через імпортовану функцію
        } else {
            // Якщо бічна панель відкрита, одразу позначаємо сповіщення як прочитані
            markNotificationsAsRead(); // Позначаємо як прочитані (використовуючи імпортовану функцію)
        }
    });

    // Обробка помилок підключення
    socket.on('connect_error', (err) => {
        console.error("Помилка підключення Socket.IO:", err.message);
    });

    // Обробка відключення
    socket.on('disconnect', (reason) => {
        console.log(`Socket.io відключено: ${reason}`);
    });
};


// Обробляє параметр `user_id` в URL для автоматичного відкриття чату з цим користувачем.
export const handleChatUrlParams = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userIdToOpen = urlParams.get('user_id');

    // Очищуємо URL (видаляємо параметр user_id після обробки)
    window.history.replaceState({}, document.title, window.location.pathname);

    // Виходимо, якщо user_id не надано або це ID поточного користувача
    if (!userIdToOpen || (MY_USER_ID && userIdToOpen === MY_USER_ID.toString())) {
        console.log("Параметр user_id відсутній або вказує на поточного користувача.");
        return;
    }

    // Чекаємо завантаження списку розмов, якщо він ще не завантажився
    const conversationList = document.getElementById('conversationsList');
    // Перевіряємо, чи існує список і чи не показує він індикатор завантаження
    if (!conversationList || conversationList.querySelector('.fa-spinner')) {
        console.log("Список розмов ще завантажується, чекаємо...");
        await new Promise(resolve => setTimeout(resolve, 500)); // Чекаємо недовго
        // Повторна перевірка після очікування
        if (!document.getElementById('conversationsList') || document.getElementById('conversationsList').querySelector('.fa-spinner')) {
            console.log("Список розмов все ще завантажується після очікування.");
            // Можливо, повторити спробу або повідомити користувача
            return;
        }
    }

    // Спробуємо знайти існуючу розмову з вказаним користувачем
    const conversationItems = document.querySelectorAll('.conversation-item');
    let foundItem = null;
    conversationItems.forEach(item => {
        if (item.dataset.receiverId === userIdToOpen) {
            foundItem = item;
        }
    });

    // Якщо існуючу розмову знайдено, симулюємо клік для її відкриття
    if (foundItem) {
        console.log('Знайдено існуючу розмову, відкриваємо...');
        foundItem.click(); // Викликаємо обробник кліку
        return;
    }

    // Якщо існуючої розмови немає, готуємо UI для нового чату
    console.log('Це нова розмова, готуємо вікно чату...');
    const chatHeader = document.getElementById('chatHeader');
    const messageForm = document.getElementById('messageForm');
    const messagesArea = document.getElementById('messagesArea');
    if (!chatHeader || !messageForm || !messagesArea) return; // Переконуємось, що елементи існують

    // Скидаємо стан для нової розмови
    currentOpenConversationId = null; // Ще немає ID розмови
    currentOpenReceiverId = userIdToOpen; // Встановлюємо отримувача

    // Оновлюємо UI
    messageForm.style.display = 'flex'; // Показуємо форму вводу
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Почніть розмову, щоб надіслати перше повідомлення.</p>'; // Текст-плейсхолдер
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active')); // Знімаємо виділення з будь-якої активної розмови в списку

    // Отримуємо ім'я отримувача для відображення в заголовку
    chatHeader.textContent = 'Завантаження імені...';
    try {
        const response = await fetch(`http://localhost:3000/api/users/${userIdToOpen}/public-profile`);
        if (!response.ok) throw new Error('Не вдалося отримати дані користувача');
        const user = await response.json();
        chatHeader.textContent = `${user.first_name} ${user.last_name}`; // Відображаємо ім'я
    } catch (err) {
        console.error("Помилка завантаження імені співрозмовника:", err);
        chatHeader.textContent = 'Нова розмова'; // Запасний текст заголовка
    }
};