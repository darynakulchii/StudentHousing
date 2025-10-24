// ===============================================
// БЕКЕНД СЕРВЕР НА EXPRESS.JS
// ===============================================

const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const app = express();
const httpServer = http.createServer(app);
const port = 3000;

// СЕКРЕТНИЙ КЛЮЧ ДЛЯ JWT (в реальному проєкті має бути в .env)
const JWT_SECRET = 'my_super_secret_key_12345';

// 1. НАЛАШТУВАННЯ MIDDLEWARE
app.use(cors());
app.use(express.json());

// --- CLOUDINARY CONFIG ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Використовувати https
});
console.log('Cloudinary Configured:', !!process.env.CLOUDINARY_CLOUD_NAME); // Перевірка

// --- MULTER CONFIG (для обробки файлів в пам'яті) ---
const storage = multer.memoryStorage(); // Зберігаємо файл в буфері пам'яті
const upload = multer({
    storage: storage,
    // === ВИПРАВЛЕНО: Збільшено ліміт до 10MB ===
    limits: { fileSize: 10 * 1024 * 1024 }, // Обмеження 10MB на файл
    fileFilter: (req, file, cb) => { // Дозволяємо тільки зображення
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Дозволено завантажувати лише зображення!'), false);
        }
    }
});

// 2. НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ДО БАЗИ ДАНИХ (PostgreSQL)
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'postgres',
    password: process.env.DB_PASSWORD || '25122005',
    port: 5432,
});

// 2.1 ІНІЦІАЛІЗАЦІЯ SOCKET.IO
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:63342", // Або "*" для будь-якого джерела
        methods: ["GET", "POST"]
    }
});

// ===============================================
// ЛОГІКА SOCKET.IO (REAL-TIME)
// ===============================================
io.on('connection', (socket) => {
    console.log(`Клієнт підключився: ${socket.id}`);

    // Приєднуємось до особистої кімнати для сповіщень
    socket.on('join_user_room', (userId) => {
        if (userId) {
            const userRoom = `user_${userId}`;
            socket.join(userRoom);
            console.log(`Клієнт ${socket.id} приєднався до особистої кімнати ${userRoom}`);
        }
    });

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId.toString());
        console.log(`Клієнт ${socket.id} приєднався до кімнати ${conversationId}`);
    });

    socket.on('disconnect', () => {
        console.log(`Клієнт від'єднався: ${socket.id}`);
    });
});

// ===============================================
// 3. MIDDLEWARE ДЛЯ АВТЕНТИФІКАЦІЇ
// ===============================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ error: 'Необхідна автентифікація (немає токена)' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Токен недійсний або протермінований' });
        }
        // Додаємо дані користувача (userId) до об'єкта req
        req.user = user;
        next();
    });
};

/**
 * Допоміжна функція для створення та відправки сповіщень
 * @param {number} userId - ID користувача, ЯКИЙ ОТРИМУЄ сповіщення
 * @param {string} message - Текст сповіщення
 * @param {string} link_url - (Необов'язково) Посилання, куди перейде користувач
 */
const createNotification = async (userId, message, link_url = null) => {
    try {
        const insertQuery = `
            INSERT INTO notifications (user_id, message, link_url)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [userId, message, link_url]);
        const newNotification = result.rows[0];

        // Відправляємо сповіщення через Socket.io в "кімнату" цього користувача
        io.to(`user_${userId}`).emit('new_notification', newNotification);

        console.log(`Notification created for user ${userId}: ${message}`);
        return newNotification;

    } catch (err) {
        console.error('Error creating notification:', err);
    }
};

// ===============================================
// 4. МАРШРУТИ ДЛЯ ОГОЛОШЕНЬ (Публічні)
// ===============================================

// 4.1 ОТРИМАННЯ ВСІХ ОГОЛОШЕНЬ
app.get('/api/listings', async (req, res) => {
    try {
        let query = `SELECT l.* FROM listings l`;
        const whereClauses = ['l.is_active = TRUE'];
        const params = [];
        let paramIndex = 1;

        // === 1. ПОШУК ===
        if (req.query.search) {
            whereClauses.push(`
                to_tsvector('ukrainian', l.title || ' ' || l.description || ' ' || l.city || ' ' || COALESCE(l.target_university, ''))
                @@ websearch_to_tsquery('ukrainian', $${paramIndex++})
            `);
            params.push(req.query.search);
        }

        // === 2. Прості фільтри ===
        if (req.query.listing_type) {
            const listingTypes = Array.isArray(req.query.listing_type)
                ? req.query.listing_type
                : [req.query.listing_type];

            // Перевіряємо, чи масив не порожній після обробки
            if (listingTypes.length > 0 && listingTypes[0] !== '') { // Додано перевірку на порожній рядок
                const typePlaceholders = listingTypes.map(() => `$${paramIndex++}`).join(',');
                whereClauses.push(`l.listing_type IN (${typePlaceholders})`);
                params.push(...listingTypes);
            }
        }
        if (req.query.city) {
            whereClauses.push(`l.city = $${paramIndex++}`);
            params.push(req.query.city);
        }
        if (req.query.price_min) {
            whereClauses.push(`(l.price >= $${paramIndex++} OR l.target_price_min >= $${paramIndex++})`);
            params.push(req.query.price_min, req.query.price_min);
        }
        if (req.query.price_max) {
            whereClauses.push(`(l.price <= $${paramIndex++} OR l.target_price_max <= $${paramIndex++})`);
            params.push(req.query.price_max, req.query.price_max);
        }
        if (req.query.rooms) {
            whereClauses.push(`(l.rooms = $${paramIndex++} OR l.target_rooms = $${paramIndex++})`);
            params.push(req.query.rooms, req.query.rooms);
        }
        if (req.query.furnishing) {
            whereClauses.push(`l.furnishing = $${paramIndex++}`);
            params.push(req.query.furnishing);
        }
        if (req.query.housing_type_search) {
            whereClauses.push(`l.housing_type_search = $${paramIndex++}`);
            params.push(req.query.housing_type_search);
        }
        if (req.query.my_gender) {
            whereClauses.push(`l.my_gender = $${paramIndex++}`);
            params.push(req.query.my_gender);
        }
        if (req.query.my_age_min) {
            whereClauses.push(`l.my_age >= $${paramIndex++}`);
            params.push(req.query.my_age_min);
        }
        if (req.query.my_age_max) {
            whereClauses.push(`l.my_age <= $${paramIndex++}`);
            params.push(req.query.my_age_max);
        }
        if (req.query.roommate_gender) {
            whereClauses.push(`l.roommate_gender = $${paramIndex++}`);
            params.push(req.query.roommate_gender);
        }
        if (req.query.roommate_smoking) {
            whereClauses.push(`l.roommate_smoking = $${paramIndex++}`);
            params.push(req.query.roommate_smoking);
        }


        // === 3. Складні фільтри (Характеристики) ===
        if (req.query.characteristics) {
            const charList = req.query.characteristics.split(',');
            if (charList.length > 0) {
                const charPlaceholders = charList.map(() => `$${paramIndex++}`).join(',');
                whereClauses.push(`
                    (
                        SELECT COUNT(DISTINCT c.system_key)
                        FROM listing_characteristics lc
                        JOIN characteristics c ON lc.char_id = c.char_id
                        WHERE lc.listing_id = l.listing_id
                        AND c.system_key IN (${charPlaceholders})
                    ) = ${charList.length}
                `);
                params.push(...charList);
            }
        }

        // === 4. Збираємо запит ===
        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }
        query += ' ORDER BY l.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error('Помилка виконання запиту до БД', err);
        res.status(500).json({ error: 'Помилка сервера при отриманні оголошень' });
    }
});


// 4.2 ОТРИМАННЯ ОДНОГО ОГОЛОШЕННЯ (З ДЕТАЛЯМИ)
app.get('/api/listings/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const client = await pool.connect();

        // === ОНОВЛЕНО: Додано u.avatar_url до запиту ===
        const listingQuery = `
            SELECT l.*, u.first_name, u.last_name, u.email, u.avatar_url
            FROM listings l
                     JOIN users u ON l.user_id = u.user_id
            WHERE l.listing_id = $1;
        `;
        const listingPromise = client.query(listingQuery, [id]);

        const photosQuery = `SELECT photo_id, image_url, is_main FROM listing_photos WHERE listing_id = $1 ORDER BY photo_order;`;
        const photosPromise = client.query(photosQuery, [id]);

        const charsQuery = `
            SELECT c.name_ukr, c.system_key, c.category
            FROM listing_characteristics lc
                     JOIN characteristics c ON lc.char_id = c.char_id
            WHERE lc.listing_id = $1;
        `;
        const charsPromise = client.query(charsQuery, [id]);

        const [listingResult, photosResult, charsResult] = await Promise.all([
            listingPromise,
            photosPromise,
            charsPromise
        ]);

        client.release();

        if (listingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Оголошення не знайдено' });
        }

        const listing = listingResult.rows[0];
        listing.photos = photosResult.rows;
        listing.characteristics = charsResult.rows;

        res.json(listing);

    } catch (err) {
        console.error('Помилка отримання деталей оголошення:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ===============================================
// 5. МАРШРУТИ АВТЕНТИФІКАЦІЇ (Публічні)
// ===============================================

// 5.1 РЕЄСТРАЦІЯ КОРИСТУВАЧА
app.post('/api/register', async (req, res) => {
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password || !first_name || !last_name) {
        return res.status(400).json({ error: 'Всі поля є обов\'язковими' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const queryText = 'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING user_id';
        const result = await pool.query(queryText, [email, hashedPassword, first_name, last_name]);

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

// 5.2 ЛОГІН КОРИСТУВАЧА
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Необхідно вказати email та пароль' });
    }

    try {
        const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userQuery.rows.length === 0) {
            return res.status(401).json({ error: 'Неправильний email або пароль' });
        }
        const user = userQuery.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неправильний email або пароль' });
        }

        const payload = {
            userId: user.user_id,
            email: user.email,
            first_name: user.first_name
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

        res.json({
            message: 'Вхід успішний!',
            token: token,
            user: payload
        });

    } catch (err) {
        console.error('Помилка логіну:', err);
        res.status(500).json({ error: 'Помилка сервера.' });
    }
});

// ===============================================
// 6. ЗАХИЩЕНІ МАРШРУТИ (Потребують токен)
// ===============================================

// 6.1 ДОДАВАННЯ ОГОЛОШЕННЯ
app.post('/api/listings', authenticateToken, async (req, res) => {
    const user_id = req.user.userId;
    const { characteristics, ...listingData } = req.body;
// --- 1. Місто ---
    if (listingData.city === 'other' && listingData.city_other) {
        // Значення 'other' вибрано і текст введено - нічого не робимо
    } else {
        // В іншому випадку (або вибрано не 'other', або поле _other пусте) - очищуємо
        listingData.city_other = null;
    }

// --- 2. Тип будинку ---
    if (listingData.building_type === 'other' && listingData.building_type_other) {
        // (Ваш приклад використовував 'other_building', я використовую 'other' для уніфікації)
    } else {
        listingData.building_type_other = null;
    }

// --- 3. Тип стін ---
    if (listingData.wall_type === 'other' && listingData.wall_type_other) {
    } else {
        listingData.wall_type_other = null;
    }

// --- 4. Планування ---
    if (listingData.planning === 'other' && listingData.planning_other) {
    } else {
        listingData.planning_other = null;
    }

// --- 5. Тип опалення ---
    if (listingData.heating_type === 'other' && listingData.heating_type_other) {
    } else {
        listingData.heating_type_other = null;
    }

// --- 6. Тип ремонту ---
    if (listingData.renovation_type === 'other' && listingData.renovation_type_other) {
    } else {
        listingData.renovation_type_other = null;
    }

// --- 7. Тип житла (пошук) ---
    if (listingData.housing_type_search === 'other' && listingData.housing_type_search_other) {
    } else {
        listingData.housing_type_search_other = null;
    }

// --- 8. Університет (пошук) ---
    if (listingData.target_university === 'other' && listingData.target_university_other) {
    } else {
        listingData.target_university_other = null;
    }

    const allowedKeys = [
        'listing_type', 'title', 'description', 'city', 'main_photo_url', 'price',
        'building_type', 'rooms', 'floor', 'total_floors', 'total_area', 'kitchen_area',
        'wall_type', 'planning', 'bathroom_type', 'heating_type', 'renovation_type', 'furnishing',
        'max_occupants', 'current_occupants', 'seeking_roommates', 'target_price_min',
        'target_price_max', 'housing_type_search', 'target_rooms', 'target_roommates_max',
        'is_student', 'target_university', 'target_uni_distance', 'ready_to_share',
        'my_gender', 'my_age', 'my_group_size', 'my_group_count', 'my_smoking',
        'my_drinking', 'my_guests', 'about_me_description', 'roommate_gender',
        'roommate_age_min', 'roommate_age_max', 'roommate_smoking', 'roommate_drinking',
        'roommate_guests', 'roommate_description', 'address','latitude', 'longitude', 'study_conditions',
        'building_type_other', 'wall_type_other', 'planning_other', 'heating_type_other',
        'renovation_type_other', 'pet_policy', 'owner_rules', 'search_pet_policy',
        'city_other', 'housing_type_search_other', 'target_university_other',
        'tech_other_text', 'media_other_text', 'comfort_other_text',
        'my_personality_other_text', 'my_lifestyle_other_text', 'my_interests_other_text',
        'mate_personality_other_text', 'mate_lifestyle_other_text', 'mate_interests_other_text',
        'comm_other_text', 'infra_other_text', 'incl_other_text', 'blackout_other_text',
        'university_other_text'
    ];
    const columns = ['user_id'];
    const values = [user_id];
    const valuePlaceholders = ['$1'];
    let counter = 2;
    for (const key of allowedKeys) {
        if (listingData[key] !== undefined && listingData[key] !== null && listingData[key] !== '') {
            columns.push(key);
            values.push(listingData[key]);
            valuePlaceholders.push(`$${counter}`);
            counter++;
        }
    }
    const listingQuery = `
        INSERT INTO listings (${columns.join(', ')})
        VALUES (${valuePlaceholders.join(', ')})
        RETURNING listing_id;
    `;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const listingResult = await client.query(listingQuery, values);
        const listingId = listingResult.rows[0].listing_id;

        if (characteristics && characteristics.length > 0) {
            const uniqueChars = [...new Set(characteristics)];
            const validChars = uniqueChars.filter(key => key && key.trim() !== '');
            if (validChars.length > 0) {
                const charKeys = validChars.map(key => `'${key}'`).join(',');
                const charIdQuery = `SELECT char_id FROM characteristics WHERE system_key IN (${charKeys})`;
                const charIdResult = await client.query(charIdQuery);
                if (charIdResult.rows.length > 0) {
                    const insertChars = charIdResult.rows.map(row =>
                        `(${listingId}, ${row.char_id})`
                    ).join(',');
                    const insertCharQuery = `INSERT INTO listing_characteristics (listing_id, char_id) VALUES ${insertChars};`;
                    await client.query(insertCharQuery);
                } else {
                    console.warn(`Для оголошення ${listingId} не знайдено ID для характеристик: ${charKeys}`);
                }
            }
        }
        await client.query('COMMIT');
        res.status(201).json({ message: 'Оголошення успішно опубліковано!', listingId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка додавання оголошення:', err);
        console.error('SQL Query:', listingQuery);
        console.error('Values:', values);
        res.status(500).json({ error: 'Помилка сервера при публікації оголошення.' });
    } finally {
        client.release();
    }
});

// 6.2 ОТРИМАННЯ ОГОЛОШЕНЬ ПОТОЧНОГО КОРИСТУВАЧА
app.get('/api/my-listings', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const query = `
            SELECT listing_id, title, city, price, main_photo_url, is_active, created_at, listing_type
            FROM listings
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання моїх оголошень:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 6.3 ЗМІНА СТАТУСУ АКТИВНОСТІ ОГОЛОШЕННЯ
app.patch('/api/listings/:id/status', authenticateToken, async (req, res) => {
    const listingId = req.params.id;
    const userId = req.user.userId;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'Необхідно передати поле is_active (true/false)' });
    }
    try {
        const query = `
            UPDATE listings
            SET is_active = $1
            WHERE listing_id = $2 AND user_id = $3
            RETURNING listing_id, is_active;
        `;
        const result = await pool.query(query, [is_active, listingId, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Оголошення не знайдено або у вас немає прав на його зміну' });
        }
        res.json({
            message: `Статус оголошення ${result.rows[0].listing_id} змінено на ${result.rows[0].is_active ? 'активне' : 'неактивне'}`,
            listing: result.rows[0]
        });
    } catch (err) {
        console.error('Помилка зміни статусу оголошення:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 6.4 ВИДАЛЕННЯ ОГОЛОШЕННЯ
app.delete('/api/listings/:id', authenticateToken, async (req, res) => {
    const listingId = req.params.id;
    const userId = req.user.userId;
    try {
        const query = `
            DELETE FROM listings
            WHERE listing_id = $1 AND user_id = $2
            RETURNING listing_id;
        `;
        const result = await pool.query(query, [listingId, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Оголошення не знайдено або у вас немає прав на його видалення' });
        }
        res.json({ message: `Оголошення ${result.rows[0].listing_id} успішно видалено` });
    } catch (err) {
        console.error('Помилка видалення оголошення:', err);
        res.status(500).json({ error: 'Помилка сервера при видаленні оголошення' });
    }
});

// 6.5 ОНОВЛЕННЯ ОГОЛОШЕННЯ (НОВИЙ МАРШРУТ)
app.put('/api/listings/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.userId;
    const { characteristics, ...listingData } = req.body;

    // Перевірка, чи користувач є власником
    try {
        const checkOwner = await pool.query('SELECT user_id FROM listings WHERE listing_id = $1', [id]);
        if (checkOwner.rows.length === 0) {
            return res.status(404).json({ error: 'Оголошення не знайдено' });
        }
        if (checkOwner.rows[0].user_id !== user_id) {
            return res.status(403).json({ error: 'Ви не є власником цього оголошення' });
        }
    } catch(e) {
        console.error("Помилка перевірки власника:", e);
        return res.status(500).json({ error: 'Помилка сервера' });
    }

    // --- Початок транзакції ---
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

// --- 1. Місто ---
        if (listingData.city === 'other' && listingData.city_other) {
        } else {
            listingData.city_other = null;
        }

// --- 2. Тип будинку ---
        if (listingData.building_type === 'other' && listingData.building_type_other) {
        } else {
            listingData.building_type_other = null;
        }

// --- 3. Тип стін ---
        if (listingData.wall_type === 'other' && listingData.wall_type_other) {
        } else {
            listingData.wall_type_other = null;
        }

// --- 4. Планування ---
        if (listingData.planning === 'other' && listingData.planning_other) {
        } else {
            listingData.planning_other = null;
        }

// --- 5. Тип опалення ---
        if (listingData.heating_type === 'other' && listingData.heating_type_other) {
        } else {
            listingData.heating_type_other = null;
        }

// --- 6. Тип ремонту ---
        if (listingData.renovation_type === 'other' && listingData.renovation_type_other) {
        } else {
            listingData.renovation_type_other = null;
        }

// --- 7. Тип житла (пошук) ---
        if (listingData.housing_type_search === 'other' && listingData.housing_type_search_other) {
        } else {
            listingData.housing_type_search_other = null;
        }

// --- 8. Університет (пошук) ---
        if (listingData.target_university === 'other' && listingData.target_university_other) {
        } else {
            listingData.target_university_other = null;
        }

        const allowedKeys = [
            'listing_type', 'title', 'description', 'city', 'main_photo_url', 'price',
            'building_type', 'rooms', 'floor', 'total_floors', 'total_area', 'kitchen_area',
            'wall_type', 'planning', 'bathroom_type', 'heating_type', 'renovation_type', 'furnishing',
            'max_occupants', 'current_occupants', 'seeking_roommates', 'target_price_min',
            'target_price_max', 'housing_type_search', 'target_rooms', 'target_roommates_max',
            'is_student', 'target_university', 'target_uni_distance', 'ready_to_share',
            'my_gender', 'my_age', 'my_group_size', 'my_group_count', 'my_smoking',
            'my_drinking', 'my_guests', 'about_me_description', 'roommate_gender',
            'roommate_age_min', 'roommate_age_max', 'roommate_smoking', 'roommate_drinking',
            'roommate_guests', 'roommate_description', 'address','latitude', 'longitude', 'study_conditions',
            'building_type_other', 'wall_type_other', 'planning_other', 'heating_type_other',
            'renovation_type_other', 'pet_policy', 'owner_rules', 'search_pet_policy',
            'city_other', 'housing_type_search_other', 'target_university_other',
            'tech_other_text', 'media_other_text', 'comfort_other_text',
            'my_personality_other_text', 'my_lifestyle_other_text', 'my_interests_other_text',
            'mate_personality_other_text', 'mate_lifestyle_other_text', 'mate_interests_other_text',
            'comm_other_text', 'infra_other_text', 'incl_other_text', 'blackout_other_text',
            'university_other_text'
        ];

        const setClauses = [];
        const values = [];
        let counter = 1;

        for (const key of allowedKeys) {
            // Оновлюємо поле, навіть якщо воно null (для скидання)
            if (listingData.hasOwnProperty(key)) {
                setClauses.push(`${key} = $${counter}`);
                values.push(listingData[key] === '' ? null : listingData[key]); // Встановлюємо null, якщо прийшов порожній рядок
                counter++;
            }
        }

        if (setClauses.length > 0) {
            values.push(id); // Додаємо listing_id в кінець для WHERE
            const updateQuery = `
                UPDATE listings SET ${setClauses.join(', ')}
                WHERE listing_id = $${counter};
            `;
            await client.query(updateQuery, values);
        }

        // 2. Видаляємо СТАРІ характеристики
        await client.query('DELETE FROM listing_characteristics WHERE listing_id = $1', [id]);

        // 3. Додаємо НОВІ характеристики
        if (characteristics && characteristics.length > 0) {
            const uniqueChars = [...new Set(characteristics)];
            const validChars = uniqueChars.filter(key => key && key.trim() !== '');
            if (validChars.length > 0) {
                // Екрануємо ' для system_key
                const charKeys = validChars.map(key => `'${key.replace(/'/g, "''")}'`).join(',');
                const charIdQuery = `SELECT char_id FROM characteristics WHERE system_key IN (${charKeys})`;
                const charIdResult = await client.query(charIdQuery);
                if (charIdResult.rows.length > 0) {
                    const insertChars = charIdResult.rows.map(row =>
                        `(${id}, ${row.char_id})`
                    ).join(',');
                    const insertCharQuery = `INSERT INTO listing_characteristics (listing_id, char_id) VALUES ${insertChars} ON CONFLICT DO NOTHING;`;
                    await client.query(insertCharQuery);
                }
            }
        }

        // 4. Завершуємо транзакцію
        await client.query('COMMIT');
        res.status(200).json({ message: 'Оголошення успішно оновлено!', listingId: id });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка оновлення оголошення:', err);
        res.status(500).json({ error: 'Помилка сервера при оновленні оголошення.' });
    } finally {
        client.release();
    }
});

// ===============================================
// 7. МАРШРУТИ ДЛЯ ЧАТУ
// ===============================================

// 7.1 Отримати всі розмови поточного користувача
app.get('/api/my-conversations', authenticateToken, async (req, res) => {
    const CURRENT_USER_ID = req.user.userId;
    try {
        const query = `
            SELECT
                c.conversation_id,
                CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END AS other_user_id,
                u.first_name, u.last_name
            FROM conversations c
                     JOIN users u ON u.user_id = CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END
            WHERE c.user_one_id = $1 OR c.user_two_id = $1;
        `;
        const result = await pool.query(query, [CURRENT_USER_ID]);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання розмов:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 7.2 Отримати повідомлення для конкретної розмови
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const CURRENT_USER_ID = req.user.userId;
    try {
        const checkQuery = await pool.query(
            'SELECT 1 FROM conversations WHERE conversation_id = $1 AND (user_one_id = $2 OR user_two_id = $2)',
            [id, CURRENT_USER_ID]
        );
        if (checkQuery.rows.length === 0) {
            return res.status(403).json({ error: 'Ви не є учасником цієї розмови' });
        }
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

// 7.3 Надіслати повідомлення
app.post('/api/messages', authenticateToken, async (req, res) => {
    const { receiver_id, message_body } = req.body;
    const sender_id = req.user.userId;
    if (!receiver_id || !message_body) {
        return res.status(400).json({ error: 'Missing receiver_id or message_body' });
    }
    if (receiver_id === sender_id) {
        return res.status(400).json({ error: 'Не можна надіслати повідомлення самому собі' });
    }
    const user_one = Math.min(sender_id, receiver_id);
    const user_two = Math.max(sender_id, receiver_id);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let conversationResult = await client.query(`
            SELECT conversation_id FROM conversations WHERE user_one_id = $1 AND user_two_id = $2
        `, [user_one, user_two]);
        let conversationId;
        if (conversationResult.rows.length > 0) {
            conversationId = conversationResult.rows[0].conversation_id;
        } else {
            conversationResult = await client.query(`
                INSERT INTO conversations (user_one_id, user_two_id) VALUES ($1, $2) RETURNING conversation_id
            `, [user_one, user_two]);
            conversationId = conversationResult.rows[0].conversation_id;
        }
        const messageResult = await client.query(`
            INSERT INTO messages (conversation_id, sender_id, message_body) VALUES ($1, $2, $3) RETURNING *
        `, [conversationId, sender_id, message_body]);
        await client.query('COMMIT');
        const newMessage = messageResult.rows[0];
        io.to(conversationId.toString()).emit('receive_message', newMessage);
        // Створюємо сповіщення для ОДЕРЖУВАЧА
        try {
            const senderName = req.user.first_name || 'Хтось';
            await createNotification(
                receiver_id, // Кому
                `Нове повідомлення від ${senderName}`, // Текст
                `chat.html?user_id=${sender_id}` // Посилання
            );
        } catch (notifyErr) {
            console.error("Не вдалося створити сповіщення про повідомлення:", notifyErr);
        }
        res.status(201).json(newMessage);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Помилка відправки повідомлення:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    } finally {
        client.release();
    }
});

// ===============================================
// 7.5 МАРШРУТИ ДЛЯ СПОВІЩЕНЬ (НОВІ)
// ===============================================

// 7.5.1 Отримати всі мої сповіщення
app.get('/api/my-notifications', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const query = `
            SELECT * FROM notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 50; -- Обмежимо, щоб не завантажувати забагато
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання сповіщень:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 7.5.2 Позначити мої сповіщення як прочитані
app.patch('/api/my-notifications/read', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const query = `
            UPDATE notifications 
            SET is_read = TRUE 
            WHERE user_id = $1 AND is_read = FALSE 
            RETURNING notification_id;
        `;
        const result = await pool.query(query, [userId]);
        res.json({ message: `Оновлено ${result.rows.length} сповіщень` });
    } catch (err) {
        console.error('Помилка оновлення сповіщень:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ===============================================
// 8. МАРШРУТИ ДЛЯ ПРОФІЛЮ
// ===============================================

// 8.1 ОТРИМАННЯ ДАНИХ ПРОФІЛЮ
app.get('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const query = `
            SELECT email, first_name, last_name, city, date_of_birth, bio, avatar_url, phone_number, show_phone_publicly
            FROM users WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Помилка отримання профілю:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 8.2 ОНОВЛЕННЯ ДАНИХ ПРОФІЛЮ
app.put('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { first_name, last_name, email, city, date_of_birth, bio, phone_number, avatar_url, show_phone_publicly } = req.body;
    const dobValue = date_of_birth || null;
    const showPhoneBool = !!show_phone_publicly;
    try {
        const query = `
            UPDATE users SET
                             first_name = $1, last_name = $2, email = $3, city = $4,
                             date_of_birth = $5, bio = $6, phone_number = $7,
                             avatar_url = $8, show_phone_publicly = $9
            WHERE user_id = $10
            RETURNING user_id, email, first_name, last_name, avatar_url, show_phone_publicly;
        `;
        const result = await pool.query(query, [
            first_name, last_name, email, city, dobValue,
            bio, phone_number, avatar_url, showPhoneBool, userId
        ]);
        res.json({ message: 'Профіль успішно оновлено', user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Користувач з таким email вже існує.' });
        } else {
            console.error('Помилка оновлення профілю:', err);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
});

// 8.3 ЗМІНА EMAIL (НОВИЙ МАРШРУТ)
app.post('/api/profile/change-email', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { email, current_password } = req.body;

    if (!email || !current_password) {
        return res.status(400).json({ error: 'Потрібно вказати новий email та поточний пароль' });
    }

    try {
        const userQuery = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }
        const user = userQuery.rows[0];

        // 1. Перевіряємо поточний пароль
        const isMatch = await bcrypt.compare(current_password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неправильний поточний пароль' });
        }

        // 2. Пароль вірний, оновлюємо email
        const updateQuery = 'UPDATE users SET email = $1 WHERE user_id = $2 RETURNING user_id, email';
        const result = await pool.query(updateQuery, [email, userId]);

        res.json({ message: 'Email успішно оновлено', user: result.rows[0] });

    } catch (err) {
        if (err.code === '23505') { // unique_violation
            res.status(409).json({ error: 'Користувач з таким email вже існує.' });
        } else {
            console.error('Помилка зміни email:', err);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    }
});

// 8.4 ЗМІНА ПАРОЛЯ (НОВИЙ МАРШРУТ)
app.post('/api/profile/change-password', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
        return res.status(400).json({ error: 'Потрібно вказати старий та новий пароль' });
    }

    try {
        const userQuery = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }
        const user = userQuery.rows[0];

        // 1. Перевіряємо старий пароль
        const isMatch = await bcrypt.compare(old_password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неправильний старий пароль' });
        }

        // 2. Пароль вірний, хешуємо та оновлюємо
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(new_password, salt);

        const updateQuery = 'UPDATE users SET password_hash = $1 WHERE user_id = $2';
        await pool.query(updateQuery, [hashedPassword, userId]);

        res.json({ message: 'Пароль успішно оновлено' });

    } catch (err) {
        console.error('Помилка зміни паролю:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 8.5 ВИДАЛЕННЯ АКАУНТУ (НОВИЙ МАРШРУТ)
app.delete('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Необхідно ввести поточний пароль для видалення' });
    }

    try {
        const userQuery = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }
        const user = userQuery.rows[0];

        // 1. Перевіряємо пароль
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Неправильний пароль' });
        }

        // 2. Пароль вірний, видаляємо користувача.
        // Завдяки 'ON DELETE CASCADE' у вашій schema.sql,
        // всі пов'язані оголошення, повідомлення, обране тощо будуть видалені автоматично.
        await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);

        res.json({ message: 'Акаунт успішно видалено' });

    } catch (err) {
        console.error('Помилка видалення акаунту:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 8.6 ОТРИМАННЯ ПУБЛІЧНИХ ДАНИХ ПРОФІЛЮ (НОВИЙ ЕНДПОІНТ)
app.get('/api/users/:id/public-profile', async (req, res) => {
    const userId = req.params.id;
    try {
        const query = `
            SELECT user_id, first_name, last_name, city, date_of_birth, bio, avatar_url,
                   (CASE WHEN show_phone_publicly = TRUE THEN phone_number ELSE NULL END) as phone_number
            FROM users WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }

        // Ми НЕ повертаємо email чи сам номер телефону
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Помилка отримання публічного профілю:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 8.6 ОТРИМАННЯ АКТИВНИХ ОГОЛОШЕНЬ КОРИСТУВАЧА (НОВИЙ ЕНДПОІНТ)
app.get('/api/users/:id/listings', async (req, res) => {
    const userId = req.params.id;
    try {
        const query = `
            SELECT listing_id, title, city, price, main_photo_url, listing_type, created_at
            FROM listings
            WHERE user_id = $1 AND is_active = TRUE
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання публічних оголошень:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ===============================================
// 9. МАРШРУТИ ДЛЯ "ОБРАНОГО"
// ===============================================

// 9.1 ОТРИМАННЯ ID ВСІХ ОБРАНИХ ОГОЛОШЕНЬ (для швидкої перевірки)
app.get('/api/my-favorites/ids', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const query = 'SELECT listing_id FROM favorites WHERE user_id = $1';
        const result = await pool.query(query, [userId]);
        // Повертаємо простий масив ID
        res.json(result.rows.map(row => row.listing_id));
    } catch (err) {
        console.error('Помилка отримання ID обраних:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 9.2 ОТРИМАННЯ ПОВНОГО СПИСКУ ОБРАНИХ ОГОЛОШЕНЬ
app.get('/api/my-favorites', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        // Отримуємо повні дані оголошень, які користувач додав в обране
        const query = `
            SELECT l.*
            FROM listings l
            JOIN favorites f ON l.listing_id = f.listing_id
            WHERE f.user_id = $1 AND l.is_active = TRUE
            ORDER BY f.created_at DESC; 
        `;
        // Примітка: f.created_at ще не існує в схемі, але було б добре додати
        // Тим часом, сортуємо за l.created_at
        const fallbackQuery = `
            SELECT l.*
            FROM listings l
            JOIN favorites f ON l.listing_id = f.listing_id
            WHERE f.user_id = $1 AND l.is_active = TRUE
            ORDER BY l.created_at DESC;
        `;
        const result = await pool.query(fallbackQuery, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Помилка отримання обраних оголошень:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 9.3 ДОДАТИ ОГОЛОШЕННЯ В ОБРАНЕ
app.post('/api/favorites/:listingId', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { listingId } = req.params;
    try {
        const query = 'INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2) RETURNING favorite_id';
        const result = await pool.query(query, [userId, listingId]);

        try {
            // Дізнаємось, хто власник оголошення
            const listingQuery = await pool.query('SELECT user_id, title FROM listings WHERE listing_id = $1', [listingId]);
            if (listingQuery.rows.length > 0) {
                const ownerId = listingQuery.rows[0].user_id;
                const listingTitle = listingQuery.rows[0].title;
                const favoritedByName = req.user.first_name || 'Хтось';
                // Не надсилаємо сповіщення самому собі
                if (ownerId !== userId) {
                    await createNotification(
                        ownerId, // Кому
                        `${favoritedByName} додав ваше оголошення "${listingTitle}" у вибране.`, // Текст
                        `listing_detail.html?id=${listingId}` // Посилання
                    );
                }
            }
        } catch (notifyErr) {
            console.error("Не вдалося створити сповіщення про 'вибране':", notifyErr);
        }

        res.status(201).json({ message: 'Додано до обраного', favoriteId: result.rows[0].favorite_id });
    } catch (err) {
        if (err.code === '23505') { // 'unique_violation'
            return res.status(409).json({ error: 'Оголошення вже у вибраному' });
        }
        if (err.code === '23503') { // 'foreign_key_violation'
            return res.status(404).json({ error: 'Оголошення не знайдено' });
        }
        console.error('Помилка додавання в обране:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// 9.4 ВИДАЛИТИ ОГОЛОШЕННЯ З ОБРАНОГО
app.delete('/api/favorites/:listingId', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { listingId } = req.params;
    try {
        const query = 'DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2 RETURNING favorite_id';
        const result = await pool.query(query, [userId, listingId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Оголошення не знайдено у вашому списку обраного' });
        }
        res.json({ message: 'Видалено з обраного' });
    } catch (err) {
        console.error('Помилка видалення з обраного:', err);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// ===============================================
// 10. МАРШРУТИ ЗАВАНТАЖЕННЯ ФОТО
// ===============================================

// --- Функція для завантаження в Cloudinary ---
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'image', folder: 'student_housing' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

// --- 10.1 Завантаження Аватара ---
app.post('/api/upload/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл аватара не знайдено' });
    }
    const userId = req.user.userId;
    try {
        console.log(`Uploading avatar for user ${userId}...`);
        const result = await uploadToCloudinary(req.file.buffer);
        const avatarUrl = result.secure_url;
        console.log(`Avatar uploaded to: ${avatarUrl}`);
        const updateQuery = 'UPDATE users SET avatar_url = $1 WHERE user_id = $2 RETURNING avatar_url';
        const dbResult = await pool.query(updateQuery, [avatarUrl, userId]);
        res.json({ message: 'Аватар успішно оновлено', avatarUrl: dbResult.rows[0].avatar_url });
    } catch (error) {
        console.error('Помилка завантаження аватара:', error);
        res.status(500).json({ error: 'Помилка сервера при завантаженні аватара' });
    }
});

// --- 10.2 Завантаження Фото Оголошення ---
app.post('/api/upload/listing-photos/:listingId', authenticateToken, upload.array('photos', 8), async (req, res) => {
    const listingId = req.params.listingId;
    const userId = req.user.userId;
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Файли фото не знайдено' });
    }
    try {
        const checkOwner = await pool.query('SELECT user_id FROM listings WHERE listing_id = $1', [listingId]);
        if (checkOwner.rows.length === 0 || checkOwner.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Ви не є власником цього оголошення' });
        }
    } catch(e) {
        console.error("Помилка перевірки власника:", e);
        return res.status(500).json({ error: 'Помилка сервера' });
    }
    const uploadedUrls = [];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query('SELECT COALESCE(MAX(photo_order), -1) as max_order FROM listing_photos WHERE listing_id = $1', [listingId]);
        let nextOrder = orderResult.rows[0].max_order + 1;
        for (const file of req.files) {
            console.log(`Uploading photo for listing ${listingId}...`);
            const result = await uploadToCloudinary(file.buffer);
            const imageUrl = result.secure_url;
            console.log(`Photo uploaded to: ${imageUrl}`);
            const isMain = (nextOrder === 0);
            const insertQuery = `
                INSERT INTO listing_photos (listing_id, image_url, is_main, photo_order)
                VALUES ($1, $2, $3, $4) RETURNING image_url;
            `;
            const dbResult = await client.query(insertQuery, [listingId, imageUrl, isMain, nextOrder]);
            uploadedUrls.push(dbResult.rows[0].image_url);
            if (isMain) {
                await client.query('UPDATE listings SET main_photo_url = $1 WHERE listing_id = $2', [imageUrl, listingId]);
            }
            nextOrder++;
        }
        await client.query('COMMIT');
        res.status(201).json({ message: `${req.files.length} фото успішно завантажено!`, photoUrls: uploadedUrls });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Помилка завантаження фото оголошення:', error);
        res.status(500).json({ error: 'Помилка сервера при завантаженні фото' });
    } finally {
        client.release();
    }
});

// --- Обробник помилок Multer ---
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Помилка завантаження файлу: ${err.message}` });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

// ===============================================
// 11. ЗАПУСК СЕРВЕРА
// ===============================================
httpServer.listen(port, () => {
    console.log(`Сервер бекенду (з Socket.io) запущено на http://localhost:${port}`);
    console.log('Готовий приймати запити від фронтенду.');
});