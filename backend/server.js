// ===============================================
// БЕКЕНД СЕРВЕР НА EXPRESS.JS
// ===============================================

const http = require('http');
const { Server } = require('socket.io');

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const httpServer = http.createServer(app);
const port = 3000;

// 1. НАЛАШТУВАННЯ MIDDLEWARE
app.use(cors());
app.use(express.json());

// 2. НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ДО БАЗИ ДАНИХ (PostgreSQL)
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '25122005',
    port: 5432,
});

// 2.1 ІНІЦІАЛІЗАЦІЯ SOCKET.IO
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:63342",
        methods: ["GET", "POST"]
    }
});

// ===============================================
// ЛОГІКА SOCKET.IO (REAL-TIME)
// ===============================================
io.on('connection', (socket) => { // <-- ПРАВИЛЬНО
    console.log(`Клієнт підключився: ${socket.id}`);

    // 1. Користувач приєднується до "кімнати" розмови
    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId.toString());
        console.log(`Клієнт ${socket.id} приєднався до кімнати ${conversationId}`);
    });

    // 2. Користувач від'єднується
    socket.on('disconnect', () => {
        console.log(`Клієнт від'єднався: ${socket.id}`);
    });
});

// 3. ПРИКЛАД МАРШРУТУ (Endpoint): ОТРИМАННЯ ВСІХ ОГОЛОШЕНЬ
app.get('/api/listings', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM listings WHERE is_active = TRUE ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка виконання запиту до БД', err);
        res.status(500).json({ error: 'Помилка сервера при отриманні оголошень' });
    }
});

// ===============================================
// НОВИЙ МАРШРУТ: ОТРИМАННЯ ОДНОГО ОГОЛОШЕННЯ (З ДЕТАЛЯМИ)
// ===============================================
app.get('/api/listings/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const client = await pool.connect();

        // 1. Отримуємо основну інформацію (оголошення + автор)
        const listingQuery = `
            SELECT l.*, u.first_name, u.last_name, u.email
            FROM listings l
                     JOIN users u ON l.user_id = u.user_id
            WHERE l.listing_id = $1;
        `;
        const listingPromise = client.query(listingQuery, [id]);

        // 2. Отримуємо всі фото для цього оголошення
        const photosQuery = `
            SELECT photo_id, image_url, is_main
            FROM listing_photos
            WHERE listing_id = $1
            ORDER BY photo_order;
        `;
        const photosPromise = client.query(photosQuery, [id]);

        // 3. Отримуємо всі характеристики
        const charsQuery = `
            SELECT c.name_ukr, c.system_key
            FROM listing_characteristics lc
                     JOIN characteristics c ON lc.char_id = c.char_id
            WHERE lc.listing_id = $1;
        `;
        const charsPromise = client.query(charsQuery, [id]);

        // Виконуємо всі запити паралельно
        const [listingResult, photosResult, charsResult] = await Promise.all([
            listingPromise,
            photosPromise,
            charsPromise
        ]);

        client.release();

        if (listingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Оголошення не знайдено' });
        }

        // 4. Збираємо все в один об'єкт
        const listing = listingResult.rows[0];
        listing.photos = photosResult.rows;
        listing.characteristics = charsResult.rows;

        res.json(listing);

    } catch (err) {
        console.error('Помилка отримання деталей оголошення:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 4. ПРИКЛАД МАРШРУТУ: РЕЄСТРАЦІЯ КОРИСТУВАЧА
app.post('/api/register', async (req, res) => {
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Необхідно вказати email та пароль' });
    }

    try {
        const queryText = 'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING user_id';
        const result = await pool.query(queryText, [email, password, first_name, last_name]);

        res.status(201).json({
            message: 'Користувач успішно зареєстрований',
            userId: result.rows[0].user_id
        });
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Користувач з таким email вже існує.' });
        } else {
            console.error('Помилка реєстрації:', err);
            res.status(500).json({ error: 'Помилка сервера.' });
        }
    }
});


// 5. НОВИЙ МАРШРУТ: ДОДАВАННЯ ОГОЛОШЕННЯ
app.post('/api/listings', async (req, res) => {
    const {
        title, description, city, price, listing_type,
        main_photo_url, characteristics
    } = req.body;

    // ТИМЧАСОВО: user_id користувача, який створює оголошення
    const user_id = 1;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 2. ВСТАВКА В LISTINGS
        const listingQuery = `
            INSERT INTO listings (user_id, listing_type, title, description, price, city, main_photo_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING listing_id;
        `;
        const listingResult = await client.query(listingQuery, [
            user_id, listing_type, title, description, price, city, main_photo_url
        ]);
        const listingId = listingResult.rows[0].listing_id;

        // 3. ВСТАВКА ХАРАКТЕРИСТИК (Якщо вони були обрані)
        if (characteristics && characteristics.length > 0) {
            const charKeys = characteristics.map(key => `'${key}'`).join(',');

            // Отримуємо ID характеристик за їхнім системним ключем (system_key)
            const charIdQuery = `SELECT char_id FROM characteristics WHERE system_key IN (${charKeys})`;
            const charIdResult = await client.query(charIdQuery);

            if (charIdResult.rows.length > 0) {
                const insertChars = charIdResult.rows.map(row =>
                    `(${listingId}, ${row.char_id})`
                ).join(',');

                const insertCharQuery = `
                    INSERT INTO listing_characteristics (listing_id, char_id)
                    VALUES ${insertChars};
                `;
                await client.query(insertCharQuery);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Оголошення успішно опубліковано!', listingId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка додавання оголошення:', err);
        res.status(500).json({ error: 'Помилка сервера при публікації оголошення.' });
    } finally {
        client.release();
    }
});

// ===============================================
// МАРШРУТИ ДЛЯ ЧАТУ
// ===============================================

// ТИМЧАСОВО: ID поточного користувача (замість справжньої аутентифікації)
const CURRENT_USER_ID = 1;

// 1. Отримати всі "розмови" поточного користувача
app.get('/api/my-conversations', async (req, res) => {
    try {
        const query = `
            SELECT
                c.conversation_id,
                -- Отримуємо ID, ім'я та прізвище "співрозмовника"
                CASE
                    WHEN c.user_one_id = $1 THEN c.user_two_id
                    ELSE c.user_one_id
                    END AS other_user_id,
                u.first_name,
                u.last_name
            FROM conversations c
                     JOIN users u ON u.user_id = CASE
                                                     WHEN c.user_one_id = $1 THEN c.user_two_id
                                                     ELSE c.user_one_id
                END
            WHERE c.user_one_id = $1 OR c.user_two_id = $1;
        `;
        const result = await pool.query(query, [CURRENT_USER_ID]);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання розмов:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});


// 2. Отримати повідомлення для конкретної розмови
app.get('/api/conversations/:id/messages', async (req, res) => {
    const { id } = req.params;
    try {
        // TODO: Тут варто додати перевірку, чи CURRENT_USER_ID є учасником цієї розмови

        const query = `
            SELECT message_id, sender_id, message_body, created_at
            FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC;
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання повідомлень:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 3. Надіслати повідомлення (або почати нову розмову)
app.post('/api/messages', async (req, res) => {
    const { receiver_id, message_body } = req.body;
    const sender_id = CURRENT_USER_ID;

    if (!receiver_id || !message_body) {
        return res.status(400).json({ error: 'Missing receiver_id or message_body' });
    }

    // --- Логіка сортування ID для відповідності SQL CHECK ---
    const user_one = Math.min(sender_id, receiver_id);
    const user_two = Math.max(sender_id, receiver_id);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Знайти або створити розмову
        // --- Шукаємо лише у впорядкованому вигляді ---
        let conversationResult = await client.query(`
            SELECT conversation_id FROM conversations
            WHERE user_one_id = $1 AND user_two_id = $2
        `, [user_one, user_two]); // <-- Використовуємо впорядковані ID

        let conversationId;
        if (conversationResult.rows.length > 0) {
            conversationId = conversationResult.rows[0].conversation_id;
        } else {
            // --- Створюємо у впорядкованому вигляді ---
            conversationResult = await client.query(`
                INSERT INTO conversations (user_one_id, user_two_id)
                VALUES ($1, $2)
                RETURNING conversation_id
            `, [user_one, user_two]); // <-- Використовуємо впорядковані ID
            conversationId = conversationResult.rows[0].conversation_id;
        }

        // 2. Вставити повідомлення
        const messageResult = await client.query(`
            INSERT INTO messages (conversation_id, sender_id, message_body)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [conversationId, sender_id, message_body]);

        await client.query('COMMIT');

        const newMessage = messageResult.rows[0];

        // Надсилаємо повідомлення всім, хто в кімнаті цієї розмови
        io.to(conversationId.toString()).emit('receive_message', newMessage);
        res.status(201).json(newMessage);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка відправки повідомлення:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    } finally {
        client.release();
    }
});

// 6. ЗАПУСК СЕРВЕРА
// --- Запускаємо httpServer, а не app ---
httpServer.listen(port, () => {
    console.log(`Сервер бекенду (з Socket.io) запущено на http://localhost:${port}`);
    console.log('Готовий приймати запити від фронтенду.');
});