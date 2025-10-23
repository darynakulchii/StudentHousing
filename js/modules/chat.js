// js/modules/chat.js

// Імпортуємо залежності з інших модулів
import { MY_USER_ID, getAuthHeaders } from './auth.js';

import {
    prependNotification,
    updateNotificationCount,
    markNotificationsAsRead,
    currentNotificationCount,
    notificationSidebar
} from './notifications.js';

// Змінні, специфічні для чату
let socket;
let currentOpenConversationId = null;
let currentOpenReceiverId = null;

export const loadConversations = async () => {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    // Додано індикатор завантаження
    container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Завантаження розмов...</p>';

    try {
        const response = await fetch('http://localhost:3000/api/my-conversations', {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) throw new Error('Необхідна автентифікація для доступу до чату.');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const conversations = await response.json();
        container.innerHTML = '';

        if (conversations.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 10px; color: var(--text-light);">У вас ще немає розмов.</p>';
            // Якщо розмов немає, показуємо заглушку у вікні повідомлень
            const messagesArea = document.getElementById('messagesArea');
            const chatHeader = document.getElementById('chatHeader');
            const messageForm = document.getElementById('messageForm');
            if(messagesArea) messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Оберіть або почніть нову розмову.</p>';
            if(chatHeader) chatHeader.textContent = 'Оберіть розмову';
            if(messageForm) messageForm.style.display = 'none';

            return;
        }

        conversations.forEach(convo => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.dataset.conversationId = convo.conversation_id;
            item.dataset.receiverId = convo.other_user_id;
            item.dataset.receiverName = `${convo.first_name} ${convo.last_name}`;
            item.innerHTML = `
                <span class="avatar-placeholder"><i class="fas fa-user-circle"></i></span>
                <span>${convo.first_name} ${convo.last_name}</span>
            `;
            item.addEventListener('click', () => {
                loadMessages(convo.conversation_id, convo.other_user_id, `${convo.first_name} ${convo.last_name}`);
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

export const loadMessages = async (conversationId, receiverId, receiverName) => {
    const messagesArea = document.getElementById('messagesArea');
    const chatHeader = document.getElementById('chatHeader');
    const messageForm = document.getElementById('messageForm');
    if (!messagesArea || !chatHeader || !messageForm) return;

    currentOpenConversationId = conversationId.toString();
    currentOpenReceiverId = receiverId;

    chatHeader.textContent = receiverName;
    messageForm.style.display = 'flex';
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;"><i class="fas fa-spinner fa-spin"></i> Завантаження повідомлень...</p>';


    try {
        const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}/messages`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) throw new Error('Помилка доступу до чату');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const messages = await response.json();
        messagesArea.innerHTML = '';

        if (messages.length === 0) {
            messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Повідомлень ще немає.</p>';
        } else {
            messages.forEach(msg => appendMessage(msg));
            // Прокрутка до останнього повідомлення
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

    } catch (error) {
        console.error('Помилка завантаження повідомлень:', error);
        messagesArea.innerHTML = `<p style="color: red; margin: auto;">Помилка завантаження. ${error.message}</p>`;
    }
};

const appendMessage = (msg) => {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;

    // Видаляємо заглушку "Повідомлень ще немає" або спіннер
    const placeholder = messagesArea.querySelector('p');
    if (placeholder) placeholder.remove();

    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.classList.add(msg.sender_id === MY_USER_ID ? 'sent' : 'received');
    messageEl.textContent = msg.message_body;
    messagesArea.appendChild(messageEl);
};

export const handleMessageSend = () => {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const sendButton = messageForm?.querySelector('button[type="submit"]'); // Додано для блокування
    if (!messageForm || !messageInput || !sendButton) return;

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageBody = messageInput.value.trim();

        // Перевіряємо, чи є текст і чи обрано отримувача (важливо для нових розмов)
        if (messageBody === '' || !currentOpenReceiverId) return;

        // Блокуємо кнопку на час відправки
        sendButton.disabled = true;

        try {
            // Оптимістична відправка (поки не чекаємо відповіді socket.io)
            const response = await fetch('http://localhost:3000/api/messages', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    receiver_id: currentOpenReceiverId,
                    message_body: messageBody
                })
            });

            if (response.ok) {
                const newMessage = await response.json(); // Отримуємо повідомлення
                messageInput.value = ''; // Очищуємо поле вводу
                messageInput.focus(); // Повертаємо фокус для наступного повідомлення

                // Додаємо візуально, НЕ чекаючи socket.io (щоб уникнути подвоєння, якщо socket прийде)
                appendMessage(newMessage);
                const messagesArea = document.getElementById('messagesArea'); // Потрібно отримати тут знову
                if(messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight; // Прокручуємо вниз

                // Якщо це була нова розмова (ми відправили, не маючи ID розмови)
                // currentOpenConversationId буде null
                if (currentOpenConversationId === null && newMessage.conversation_id) {
                    console.log('Створено нову розмову, ID:', newMessage.conversation_id);
                    // 1. Оновлюємо поточні ID
                    currentOpenConversationId = newMessage.conversation_id.toString();

                    // 2. Приєднуємось до нової socket.io кімнати
                    if (socket) { // Перевіряємо, чи socket ініціалізовано
                        socket.emit('join_conversation', currentOpenConversationId);
                    }
                    // 3. Оновлюємо список розмов зліва
                    await loadConversations();
                    // 4. "Клікаємо" на щойно створену розмову, щоб вона стала активною
                    const newItem = document.querySelector(`.conversation-item[data-conversation-id="${currentOpenConversationId}"]`);
                    if (newItem) newItem.classList.add('active');
                }
            }else {
                const errorData = await response.json();
                alert(`Помилка відправки: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка відправки:', error);
            alert('Помилка мережі.');
        } finally {
            // Розблоковуємо кнопку
            sendButton.disabled = false;
        }
    });
};

export const setupSocketIO = () => {
    // Перевіряємо наявність io та MY_USER_ID
    if (typeof io === 'undefined') {
        console.warn('Socket.io client library not found.');
        return;
    }
    if (!MY_USER_ID) {
        console.log("Користувач не авторизований, Socket.IO не підключається.");
        return; // Не підключаємо, якщо не залогінений
    }

    if (socket && socket.connected) {
        console.log("Socket.IO вже підключено.");
        return; // Вже підключено
    }

    console.log("Підключення до Socket.IO...");
    socket = io("http://localhost:3000");

    socket.on('connect', () => {
        console.log(`Socket.io підключено: ${socket.id}`);

        // 1. Приєднуємось до особистої кімнати для сповіщень
        socket.emit('join_user_room', MY_USER_ID);

        // 2. Приєднуємось до кімнат існуючих розмов (ЯКЩО ми на сторінці чату)
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

    // Слухаємо нові ПОВІДОМЛЕННЯ (для оновлення чату)
    socket.on('receive_message', (newMessage) => {
        console.log('Отримано нове повідомлення:', newMessage);

        // Перевіряємо, чи ми на сторінці чату
        const messagesArea = document.getElementById('messagesArea');
        if (!messagesArea) return; // Ми не на сторінці чату

        if (currentOpenConversationId && newMessage.conversation_id.toString() === currentOpenConversationId) {
            // Перевіряємо, чи це не наше власне повідомлення (щоб уникнути дублювання)
            if (newMessage.sender_id !== MY_USER_ID) {
                appendMessage(newMessage);
                messagesArea.scrollTop = messagesArea.scrollHeight; // Прокручуємо вниз
            }
        } else {
            console.log("Повідомлення для іншої розмови, оновлюємо список розмов...");
            loadConversations(); // Оновлюємо список, щоб побачити нову розмову або порядок
        }
    });

    // (НОВЕ) Слухаємо всі СПОВІЩЕННЯ
    socket.on('new_notification', (notification) => {
        console.log('Отримано нове сповіщення:', notification);

        // Додаємо на початок списку в сайдбарі
        prependNotification(notification);

        // Збільшуємо лічильник (якщо сайдбар закритий)
        const isSidebarOpen = notificationSidebar?.classList.contains('open'); // Додано перевірку
        if (!isSidebarOpen) {
            // Використовуємо 'let' для currentNotificationCount, щоб її можна було змінювати
            // Ця змінна має бути імпортована з notifications.js
            let newCount = currentNotificationCount + 1;
            updateNotificationCount(newCount);
        } else {
            // Якщо сайдбар відкритий, одразу позначаємо його як прочитане
            markNotificationsAsRead();
        }
    });

    socket.on('connect_error', (err) => {
        console.error("Помилка підключення Socket.IO:", err.message);
    });

    socket.on('disconnect', (reason) => {
        console.log(`Socket.io відключено: ${reason}`);
    });
};

export const handleChatUrlParams = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userIdToOpen = urlParams.get('user_id');

    // Очищуємо URL одразу, щоб він не заважав при перезавантаженні або навігації
    window.history.replaceState({}, document.title, window.location.pathname);

    if (!userIdToOpen || (MY_USER_ID && userIdToOpen === MY_USER_ID.toString())) {
        console.log("Параметр user_id відсутній або вказує на поточного користувача.");
        return;
    }

    const conversationList = document.getElementById('conversationsList');
    if (!conversationList || conversationList.querySelector('.fa-spinner')) {
        console.log("Список розмов ще завантажується, чекаємо...");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Чекаємо 1 секунду
    }

    const conversationItems = document.querySelectorAll('.conversation-item');
    let foundItem = null;
    conversationItems.forEach(item => {
        if (item.dataset.receiverId === userIdToOpen) {
            foundItem = item;
        }
    });

    if (foundItem) {
        console.log('Знайдено існуючу розмову, відкриваємо...');
        foundItem.click(); // Симулюємо клік
        return;
    }

    console.log('Це нова розмова, готуємо вікно чату...');

    const chatHeader = document.getElementById('chatHeader');
    const messageForm = document.getElementById('messageForm');
    const messagesArea = document.getElementById('messagesArea');
    if (!chatHeader || !messageForm || !messagesArea) return;

    currentOpenConversationId = null; // Немає ID розмови, бо вона нова
    currentOpenReceiverId = userIdToOpen; // ID отримувача

    messageForm.style.display = 'flex';
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Почніть розмову, щоб надіслати перше повідомлення.</p>';
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));

    chatHeader.textContent = 'Завантаження імені...';
    try {
        const response = await fetch(`http://localhost:3000/api/users/${userIdToOpen}/public-profile`);
        if (!response.ok) throw new Error('Не вдалося отримати дані користувача');

        const user = await response.json();
        chatHeader.textContent = `${user.first_name} ${user.last_name}`; // Встановлюємо ім'я

    } catch (err) {
        console.error(err);
        chatHeader.textContent = 'Нова розмова'; // Запасний варіант
    }
};