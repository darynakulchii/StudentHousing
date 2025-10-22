-- =================================================================
-- КРОК 0: СТВОРЕННЯ УКРАЇНСЬКОЇ КОНФІГУРАЦІЇ ПОШУКУ (НОВЕ!)
-- Спроба створити конфігурацію, якщо вона ще не існує
-- =================================================================
DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'ukrainian') THEN
            CREATE TEXT SEARCH CONFIGURATION ukrainian (COPY = simple);
            -- Примітка: Для кращої роботи може знадобитися словник (наприклад, Hunspell),
            -- але це вимагає встановлення додаткових пакетів в образ Docker,
            -- тому поки що ми копіюємо 'simple', що забезпечить базову роботу.
            ALTER TEXT SEARCH CONFIGURATION ukrainian
                ALTER MAPPING FOR hword, hword_part, word WITH simple;
        END IF;
    END
$$;

-- =================================================================
-- СТВОРЕННЯ НОВОЇ СТРУКТУРИ ТАБЛИЦЬ
-- =================================================================

-- Таблиця користувачів
CREATE TABLE "users" (
                         "user_id" SERIAL PRIMARY KEY,
                         "email" VARCHAR(255) UNIQUE NOT NULL,
                         "password_hash" VARCHAR(255) NOT NULL,
                         "first_name" VARCHAR(100),
                         "last_name" VARCHAR(100),
                         "city" VARCHAR(100),
                         "date_of_birth" DATE,
                         "habits" VARCHAR(50), -- З profile.html (це <select>, а не multiple)
                         "interests" VARCHAR(50), -- З profile.html (це <select>, а не multiple)
                         "bio" TEXT,
                         "avatar_url" VARCHAR(255),
                         "phone_number" VARCHAR(20) -- З profile.html
);

-- Головна таблиця оголошень
CREATE TABLE "listings" (
                            "listing_id" SERIAL PRIMARY KEY,
                            "user_id" INT NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE,
                            "is_active" BOOLEAN DEFAULT TRUE,
                            "created_at" TIMESTAMP DEFAULT NOW(),

    -- === Загальні поля (для всіх типів) ===
                            "listing_type" VARCHAR(50) NOT NULL, -- 'rent_out', 'find_mate', 'find_home'
                            "title" VARCHAR(255) NOT NULL,
                            "description" TEXT,
                            "city" VARCHAR(100) NOT NULL,
                            "main_photo_url" VARCHAR(500), -- Для картки оголошення

    -- === Поля для 'rent_out' та 'find_mate' (Характеристики житла) ===
                            "price" DECIMAL(10, 2),
                            "building_type" VARCHAR(50),
                            "rooms" VARCHAR(10), -- '1', '2', '4+'
                            "floor" INT,
                            "total_floors" INT,
                            "total_area" DECIMAL(8, 2), -- м²
                            "kitchen_area" DECIMAL(8, 2), -- м²
                            "wall_type" VARCHAR(50),
                            "planning" VARCHAR(50),
                            "bathroom_type" VARCHAR(50),
                            "heating_type" VARCHAR(50),
                            "renovation_type" VARCHAR(50),
                            "furnishing" VARCHAR(10), -- 'yes', 'no'

    -- Специфічно для 'rent_out'
                            "max_occupants" VARCHAR(10), -- '1', '2', '5+'

    -- Специфічно для 'find_mate'
                            "current_occupants" VARCHAR(10),
                            "seeking_roommates" VARCHAR(10),

    -- === Поля для 'find_home' (Фільтри пошуку) ===
                            "target_price_min" INT,
                            "target_price_max" INT,
                            "housing_type_search" VARCHAR(50),
                            "target_rooms" VARCHAR(10),
                            "target_roommates_max" VARCHAR(10),
                            "is_student" VARCHAR(5), -- 'yes', 'no'
                            "target_university" VARCHAR(255),
                            "target_uni_distance" VARCHAR(50),
                            "ready_to_share" VARCHAR(10), -- 'yes', 'no', 'any'

    -- === Поля для 'find_home' та 'find_mate' (Про себе) ===
                            "my_gender" VARCHAR(10),
                            "my_age" INT,
                            "my_group_size" VARCHAR(10), -- '1', 'more'
                            "my_group_count" INT,
                            "my_smoking" VARCHAR(20),
                            "my_drinking" VARCHAR(20),
                            "my_guests" VARCHAR(20),
                            "about_me_description" TEXT,

    -- === Поля для 'find_home' та 'find_mate' (Вимоги до сусіда) ===
                            "roommate_gender" VARCHAR(10),
                            "roommate_age_min" INT,
                            "roommate_age_max" INT,
                            "roommate_smoking" VARCHAR(20),
                            "roommate_drinking" VARCHAR(20),
                            "roommate_guests" VARCHAR(20),
                            "roommate_description" TEXT
);

-- Таблиця фотографій (для галереї)
CREATE TABLE "listing_photos" (
                                  "photo_id" SERIAL PRIMARY KEY,
                                  "listing_id" INT NOT NULL REFERENCES "listings"("listing_id") ON DELETE CASCADE,
                                  "image_url" VARCHAR(500) NOT NULL,
                                  "is_main" BOOLEAN DEFAULT FALSE,
                                  "photo_order" INT DEFAULT 0
);

-- Довідник УСІХ можливих характеристик
CREATE TABLE "characteristics" (
                                   "char_id" SERIAL PRIMARY KEY,
                                   "system_key" VARCHAR(50) UNIQUE NOT NULL, -- 'fridge', 'my_introvert', 'infra_metro'
                                   "name_ukr" VARCHAR(100) NOT NULL, -- 'Холодильник', 'Інтроверт', 'Метро'
                                   "category" VARCHAR(50) NOT NULL -- 'tech', 'my_personality', 'infra'
);

-- Зв'язуюча таблиця "багато-до-багатьох" (Оголошення <-> Характеристики)
CREATE TABLE "listing_characteristics" (
                                           "listing_char_id" SERIAL PRIMARY KEY,
                                           "listing_id" INT NOT NULL REFERENCES "listings"("listing_id") ON DELETE CASCADE,
                                           "char_id" INT NOT NULL REFERENCES "characteristics"("char_id") ON DELETE CASCADE,
                                           UNIQUE ("listing_id", "char_id")
);

-- Таблиця "Обране"
CREATE TABLE "favorites" (
                             "favorite_id" SERIAL PRIMARY KEY,
                             "user_id" INT NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE,
                             "listing_id" INT NOT NULL REFERENCES "listings"("listing_id") ON DELETE CASCADE,
                             UNIQUE ("user_id", "listing_id")
);

-- Таблиця розмов (чатів)
CREATE TABLE "conversations" (
                                 "conversation_id" SERIAL PRIMARY KEY,
                                 "user_one_id" INT REFERENCES "users"("user_id") ON DELETE CASCADE NOT NULL,
                                 "user_two_id" INT REFERENCES "users"("user_id") ON DELETE CASCADE NOT NULL,
                                 "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                 CONSTRAINT "check_user_order" CHECK ("user_one_id" < "user_two_id"),
                                 CONSTRAINT "unique_user_pair" UNIQUE ("user_one_id", "user_two_id")
);

-- Таблиця повідомлень (для чатів)
CREATE TABLE "messages" (
                            "message_id" SERIAL PRIMARY KEY,
                            "conversation_id" INT REFERENCES "conversations"("conversation_id") ON DELETE CASCADE NOT NULL,
                            "sender_id" INT REFERENCES "users"("user_id") ON DELETE CASCADE NOT NULL,
                            "message_body" TEXT NOT NULL,
                            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            "is_read" BOOLEAN DEFAULT FALSE
);


-- =================================================================
-- КРОК 2: ЗАПОВНЕННЯ ДОВІДНИКА ХАРАКТЕРИСТИК
-- Всі дані взяті з add_listing.html
-- =================================================================

INSERT INTO "characteristics" ("system_key", "name_ukr", "category") VALUES
-- 'Про себе' (Особистість)
('my_introvert', 'Інтроверт', 'my_personality'),
('my_extrovert', 'Екстраверт', 'my_personality'),
('my_ambivert', 'Амбіверт', 'my_personality'),
('my_tidy', 'Охайний/а', 'my_personality'),
('my_creative', 'Творчий/а', 'my_personality'),
('my_sporty', 'Спортивний/а', 'my_personality'),
-- 'Про себе' (Спосіб життя)
('my_early_bird', '"Жайворонок"', 'my_lifestyle'),
('my_night_owl', '"Сова"', 'my_lifestyle'),
('my_wfh', 'Працюю/вчуся вдома', 'my_lifestyle'),
('my_office', 'Працюю/вчуся в офісі', 'my_lifestyle'),
-- 'Про себе' (Інтереси)
('my_music', 'Музика', 'my_interests'),
('my_gaming', 'Ігри', 'my_interests'),
('my_cooking', 'Кулінарія', 'my_interests'),
('my_movies', 'Кіно', 'my_interests'),
('my_travel', 'Подорожі', 'my_interests'),
('my_reading', 'Читання', 'my_interests'),
-- 'Про себе' (Мої тварини)
('my_pet_cat', 'Маю кота', 'my_pets'),
('my_pet_dog', 'Маю собаку', 'my_pets'),
('my_pet_other', 'Маю іншу тваринку', 'my_pets'),
('my_pet_no', 'Не маю тварин', 'my_pets'),

-- 'Вимоги до сусіда' (Особистість)
('mate_introvert', 'Інтроверт', 'mate_personality'),
('mate_extrovert', 'Екстраверт', 'mate_personality'),
('mate_ambivert', 'Амбіверт', 'mate_personality'),
('mate_tidy', 'Охайний', 'mate_personality'),
('mate_creative', 'Творчий', 'mate_personality'),
('mate_sporty', 'Спортивний', 'mate_personality'),
-- 'Вимоги до сусіда' (Спосіб життя)
('mate_early_bird', '"Жайворонок"', 'mate_lifestyle'),
('mate_night_owl', '"Сова"', 'mate_lifestyle'),
('mate_wfh', 'Працюю/вчиться вдома', 'mate_lifestyle'),
('mate_office', 'Працюю/вчиться в офісі', 'mate_lifestyle'),
-- 'Вимоги до сусіда' (Інтереси)
('mate_music', 'Музика', 'mate_interests'),
('mate_gaming', 'Ігри', 'mate_interests'),
('mate_cooking', 'Кулінарія', 'mate_interests'),
('mate_movies', 'Кіно', 'mate_interests'),
('mate_travel', 'Подорожі', 'mate_interests'),
('mate_reading', 'Читання', 'mate_interests'),
-- 'Вимоги до сусіда' (Тварини у сусіда)
('mate_has_cat', 'З котом', 'mate_pets'),
('mate_has_dog', 'З собакою', 'mate_pets'),
('mate_has_other', 'З іншою тваринкою', 'mate_pets'),
('mate_no_pet', 'Бажано без тварин', 'mate_pets'),

-- 'Характеристики житла' (Побутова техніка)
('fridge', 'Холодильник', 'tech'),
('stove', 'Плита', 'tech'),
('washing_machine', 'Пральна машина', 'tech'),
('hob', 'Варильна панель', 'tech'),
('oven', 'Духова шафа', 'tech'),
('microwave', 'Мікрохвильова піч', 'tech'),
('vacuum', 'Пилосос', 'tech'),
('kettle', 'Електрочайник', 'tech'),
('multicooker', 'Мультиварка', 'tech'),
('coffee_machine', 'Кавомашина', 'tech'),
('iron', 'Праска', 'tech'),
('hair_dryer', 'Фен', 'tech'),
('dishwasher', 'Посудомийна машина', 'tech'),
('drying_machine', 'Сушильна машина', 'tech'),
('no_appliances', 'Без побутової техніки', 'tech'),
-- 'Характеристики житла' (Мультимедіа)
('wifi', 'Wi-Fi', 'media'),
('cable_tv', 'Кабельне, цифрове ТБ', 'media'),
('fast_internet', 'Швидкісний інтернет', 'media'),
('satellite_tv', 'Супутникове ТБ', 'media'),
('tv', 'Телевізор', 'media'),
('no_media', 'Без мультимедіа', 'media'),
-- 'Характеристики житла' (Комфорт)
('ac', 'Кондиціонер', 'comfort'),
('cctv', 'Відеоспостереження', 'comfort'),
('floor_heating', 'Підігрів підлоги', 'comfort'),
('concierge', 'Консьєрж', 'comfort'),
('bath', 'Ванна', 'comfort'),
('security', 'Охорона території', 'comfort'),
('shower', 'Душова кабіна', 'comfort'),
('parking', 'Паркувальне місце', 'comfort'),
('kitchen_furniture', 'Меблі на кухні', 'comfort'),
('guest_parking', 'Гостьовий паркінг', 'comfort'),
('wardrobe', 'Гардероб', 'comfort'),
('underground_parking', 'Підземний паркінг', 'comfort'),
('balcony', 'Балкон, лоджія', 'comfort'),
('garage', 'Гараж', 'comfort'),
('terrace', 'Тераса', 'comfort'),
('elevator', 'Ліфт', 'comfort'),
('panoramic_windows', 'Панорамні вікна', 'comfort'),
('cargo_elevator', 'Грузовий ліфт', 'comfort'),
('window_bars', 'Грати на вікнах', 'comfort'),
('storage_room', 'Госп. приміщення, комора', 'comfort'),
('alarm', 'Сигналізація', 'comfort'),
('smart_home', 'Технологія "розумний будинок"', 'comfort'),
('fire_alarm', 'Пожежна сигналізація', 'comfort'),
('generator', 'Автономний електрогенератор', 'comfort'),
-- 'Характеристики житла' (Домашні улюбленці)
('pet_no', 'Ні', 'pets_allowed'),
('pet_mid_dog', 'Так, песик', 'pets_allowed'),
('pet_cat', 'Так, котик', 'pets_allowed'),
('pet_other', 'Так, інша тваринка', 'pets_allowed'),
-- 'Характеристики житла' (Автономність при блекауті)
('blackout_internet', 'Працює інтернет', 'blackout'),
('blackout_heating', 'Працює опалення', 'blackout'),
('blackout_elevator', 'Працює ліфт', 'blackout'),
('blackout_backup_power', 'Підключене резервне живлення', 'blackout'),
('blackout_water', 'Працює водопостачання', 'blackout'),
-- 'Характеристики житла' (Додатково/Правила)
('rules_families', 'Тільки сім''ям', 'rules'),
('rules_with_owners', 'З господарями', 'rules'),
('rules_kids', 'Можна з дітьми', 'rules'),
('rules_students', 'Можна студентам', 'rules'),
('rules_smoking', 'Можна курити', 'rules'),
-- 'Характеристики житла' (Комунікації)
('comm_gas', 'Газ', 'communications'),
('comm_septic', 'Каналізація септик', 'communications'),
('comm_central_water', 'Центральний водопровід', 'communications'),
('comm_waste', 'Вивіз відходів', 'communications'),
('comm_well', 'Скважина', 'communications'),
('comm_asphalt', 'Асфальтована дорога', 'communications'),
('comm_electricity', 'Електрика', 'communications'),
('comm_no', 'Без комунікацій', 'communications'),
('comm_central_sewer', 'Центральна каналізація', 'communications'),
-- 'Характеристики житла' (Інфраструктура)
('infra_kindergarten', 'Дитячий садок', 'infra'),
('infra_pharmacy', 'Аптека', 'infra'),
('infra_school', 'Школа', 'infra'),
('infra_hospital', 'Лікарня, поліклініка', 'infra'),
('infra_well_room', 'Бювет', 'infra'),
('infra_center', 'Центр міста', 'infra'),
('infra_bus_stop', 'Зупинка транспорту', 'infra'),
('infra_restaurant', 'Ресторан, кафе', 'infra'),
('infra_metro', 'Метро', 'infra'),
('infra_cinema', 'Кінотеатр, театр', 'infra'),
('infra_market', 'Ринок', 'infra'),
('infra_post', 'Відділення пошти', 'infra'),
('infra_shop', 'Магазин, кіоск', 'infra'),
('infra_bank', 'Відділення банку, банкомат', 'infra'),
('infra_mall', 'Супермаркет, ТРЦ', 'infra'),
('infra_bus_station', 'Автовокзал', 'infra'),
('infra_park', 'Парк, зелена зона', 'infra'),
('infra_train_station', 'Залізнична станція', 'infra'),
('infra_playground', 'Дитячий майданчик', 'infra'),
-- 'Характеристики житла' (Інклюзивність)
('incl_ramp_short', 'Пандус довжиною до 2,4 м.', 'inclusive'),
('incl_wide_doors_entry', 'Широкі двері в під''їзді (від 0,9 м.)', 'inclusive'),
('incl_ramp_long', 'Пандус довжиною понад 2,4 м.', 'inclusive'),
('incl_wide_doors_elevator', 'Двері ліфту шириною від 0,9 м.', 'inclusive'),
('incl_ramp_platform', 'Пандус має майданчик для відпочинку', 'inclusive'),
('incl_elevator_size', 'Ліфт розміром не менше 1,1х1,4 м.', 'inclusive'),
('incl_ramp_handrails', 'Поручні на пандусі', 'inclusive'),
('incl_contrast_marks', 'Наявність контрастних маркувань', 'inclusive'),
('incl_stairs_handrails', 'Поручні на сходах', 'inclusive'),
('incl_tactile_strips', 'Тактильні смуги на підлозі', 'inclusive'),
('incl_street_entry', 'Вхід в рівень з вулицею', 'inclusive'),
('incl_voice_alerts', 'Голосові сповіщення у ліфті', 'inclusive');

-- Примітка: 'search_characteristics' з 'add_listing.html' використовують ті ж
-- system_key, що й характеристики житла (наприклад, 'fridge', 'wifi', 'ac'),
-- тому ми не дублюємо їх. Ваша логіка на бекенді просто буде шукати
-- оголошення, які мають ці 'char_id'.

COMMIT;
