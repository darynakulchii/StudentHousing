// =================================================================================
// CHAT MODULE
// =================================================================================

import { getAuthHeaders, MY_USER_ID } from './auth.js';
import {updateNotificationCount} from './navigation.js';
import {prependNotification, markNotificationsAsRead, notificationSidebar, initializeNavigation} from './navigation.js';

// --- Глобальні змінні для чату ---
let socket;
let currentOpenConversationId = null;
let currentOpenReceiverId = null;

/**
 * Завантажує список розмов користувача.
 */
export const loadConversations = async () => {
    const container = document.getElementById('conversationsList');
    if (!container) return;

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

/**
 * Завантажує повідомлення для обраної розмови.
 * @param {number|string} conversationId ID розмови.
 * @param {number|string} receiverId ID співрозмовника.
 * @param {string} receiverName Ім'я співрозмовника.
 */
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
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

    } catch (error) {
        console.error('Помилка завантаження повідомлень:', error);
        messagesArea.innerHTML = `<p style="color: red; margin: auto;">Помилка завантаження. ${error.message}</p>`;
    }
};

/**
 * Додає повідомлення до області чату.
 * @param {object} msg Об'єкт повідомлення.
 */
const appendMessage = (msg) => {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;

    const placeholder = messagesArea.querySelector('p');
    if (placeholder) placeholder.remove();

    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.classList.add(msg.sender_id === MY_USER_ID ? 'sent' : 'received');
    messageEl.textContent = msg.message_body;
    messagesArea.appendChild(messageEl);
};

/**
 * Налаштовує обробник відправки повідомлень.
 */
export const handleMessageSend = () => {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const sendButton = messageForm?.querySelector('button[type="submit"]');
    const messagesArea = document.getElementById('messagesArea'); // Потрібно для прокрутки
    if (!messageForm || !messageInput || !sendButton || !messagesArea) return;

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageBody = messageInput.value.trim();

        if (messageBody === '' || !currentOpenReceiverId) return;

        sendButton.disabled = true;

        try {
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
                messageInput.value = '';
                messageInput.focus();

                // Додаємо візуально, НЕ чекаючи socket.io
                appendMessage(newMessage);
                messagesArea.scrollTop = messagesArea.scrollHeight; // Прокручуємо вниз

                if (currentOpenConversationId === null && newMessage.conversation_id) {
                    console.log('Створено нову розмову, ID:', newMessage.conversation_id);
                    currentOpenConversationId = newMessage.conversation_id.toString();

                    if (socket) {
                        socket.emit('join_conversation', currentOpenConversationId);
                    }
                    await loadConversations();
                    const newItem = document.querySelector(`.conversation-item[data-conversation-id="${currentOpenConversationId}"]`);
                    if (newItem) newItem.classList.add('active');
                }
            } else {
                const errorData = await response.json();
                alert(`Помилка відправки: ${errorData.error || 'Невідома помилка'}`);
            }
        } catch (error) {
            console.error('Помилка відправки:', error);
            alert('Помилка мережі.');
        } finally {
            sendButton.disabled = false;
        }
    });
};

/**
 * Ініціалізує та налаштовує з'єднання Socket.IO.
 */
export const setupSocketIO = () => {
    if (typeof io === 'undefined') {
        console.warn('Socket.io client library not found.');
        return;
    }
    if (!MY_USER_ID) {
        console.log("Користувач не авторизований, Socket.IO не підключається.");
        return;
    }

    if (socket && socket.connected) {
        console.log("Socket.IO вже підключено.");
        return;
    }

    console.log("Підключення до Socket.IO...");
    socket = io("http://localhost:3000");

    socket.on('connect', () => {
        console.log(`Socket.io підключено: ${socket.id}`);
        socket.emit('join_user_room', MY_USER_ID);

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

    socket.on('receive_message', (newMessage) => {
        console.log('Отримано нове повідомлення:', newMessage);
        const messagesArea = document.getElementById('messagesArea');
        if (!messagesArea) return;

        if (currentOpenConversationId && newMessage.conversation_id.toString() === currentOpenConversationId) {
            if (newMessage.sender_id !== MY_USER_ID) {
                appendMessage(newMessage);
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        } else {
            console.log("Повідомлення для іншої розмови, оновлюємо список розмов...");
            loadConversations();
        }
    });

    socket.on('new_notification', (notification) => {
        console.log('Отримано нове сповіщення:', notification);
        prependNotification(notification); // Використовуємо імпортовану функцію

        const isSidebarOpen = notificationSidebar?.classList.contains('open');
        if (!isSidebarOpen) {
            // Оновлюємо лічильник - потрібно отримати доступ до currentNotificationCount з app.js
            // або передати функцію оновлення
            // TODO: Подумати, як краще передати оновлення лічильника
            updateNotificationCount(currentNotificationCount + 1); // Поки що так, але це не оновить змінну в app.js
            // Правильніше було б зробити так:
            // 1. Експортувати функцію incrementNotificationCount з app.js
            // 2. Імпортувати її сюди і викликати: incrementNotificationCount();
        } else {
            markNotificationsAsRead(); // Використовуємо імпортовану функцію
        }
    });

    socket.on('connect_error', (err) => {
        console.error("Помилка підключення Socket.IO:", err.message);
    });

    socket.on('disconnect', (reason) => {
        console.log(`Socket.io відключено: ${reason}`);
    });
};


/**
 * Обробляє параметри URL для відкриття конкретного чату.
 */
export const handleChatUrlParams = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userIdToOpen = urlParams.get('user_id');

    window.history.replaceState({}, document.title, window.location.pathname);

    if (!userIdToOpen || (MY_USER_ID && userIdToOpen === MY_USER_ID.toString())) {
        console.log("Параметр user_id відсутній або вказує на поточного користувача.");
        return;
    }

    // Чекаємо завантаження списку розмов
    const conversationList = document.getElementById('conversationsList');
    if (!conversationList || conversationList.querySelector('.fa-spinner')) {
        console.log("Список розмов ще завантажується, чекаємо...");
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        foundItem.click();
        return;
    }

    // Нова розмова
    console.log('Це нова розмова, готуємо вікно чату...');
    const chatHeader = document.getElementById('chatHeader');
    const messageForm = document.getElementById('messageForm');
    const messagesArea = document.getElementById('messagesArea');
    if (!chatHeader || !messageForm || !messagesArea) return;

    currentOpenConversationId = null;
    currentOpenReceiverId = userIdToOpen;

    messageForm.style.display = 'flex';
    messagesArea.innerHTML = '<p style="text-align: center; color: var(--text-light); margin: auto;">Почніть розмову, щоб надіслати перше повідомлення.</p>';
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));

    chatHeader.textContent = 'Завантаження імені...';
    try {
        const response = await fetch(`http://localhost:3000/api/users/${userIdToOpen}/public-profile`);
        if (!response.ok) throw new Error('Не вдалося отримати дані користувача');
        const user = await response.json();
        chatHeader.textContent = `${user.first_name} ${user.last_name}`;
    } catch (err) {
        console.error(err);
        chatHeader.textContent = 'Нова розмова';
    }
};