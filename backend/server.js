// ===============================================
// БЕКЕНД СЕРВЕР НА EXPRESS.JS
// ===============================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
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


// 6. ЗАПУСК СЕРВЕРА
app.listen(port, () => {
    console.log(`Сервер бекенду запущено на http://localhost:${port}`);
    console.log('Готовий приймати запити від фронтенду.');
});