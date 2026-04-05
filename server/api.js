/**
 * HomeStyle API Server
 * Сервер для подключения фронтенда к базе данных PostgreSQL
 * 
 * Установка зависимостей:
 * npm install express pg dotenv cors helmet bcrypt jsonwebtoken
 * 
 * Запуск:
 * node server/api.js
 */

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Создание пула подключений к PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'homestyle',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20, // Максимальное количество подключений
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Проверка подключения к БД
pool.connect((err, client, release) => {
    if (err) {
        console.error('Ошибка подключения к PostgreSQL:', err.stack);
    } else {
        console.log('✅ Успешное подключение к PostgreSQL');
        client.query('SELECT NOW()', (err, result) => {
            if (err) {
                console.error('Ошибка выполнения запроса:', err.stack);
            } else {
                console.log('📊 Время сервера БД:', result.rows[0].now);
            }
            release();
        });
    }
});

// Middleware
app.use(helmet()); // Защита заголовков HTTP
app.use(cors()); // Разрешение CORS
app.use(express.json()); // Парсинг JSON

// Middleware для логирования запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется аутентификация' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        req.user = user;
        next();
    });
};

// Middleware для проверки роли пользователя
const authorizeRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        next();
    };
};

// Функция для безопасной пагинации
const getPagination = (page, pageSize) => {
    const limit = Math.min(parseInt(pageSize) || 20, 100); // Максимум 100 записей
    const offset = (parseInt(page) || 1 - 1) * limit;
    return { limit, offset };
};

// ============================================
// МАРШРУТЫ АУТЕНТИФИКАЦИИ
// ============================================

// Регистрация нового пользователя
app.post('/api/auth/register', async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;

    try {
        // Проверка существования пользователя
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Хэширование пароля
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Создание пользователя (роль customer по умолчанию)
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id)
             VALUES ($1, $2, $3, $4, $5, 3)
             RETURNING id, email, first_name, last_name, created_at`,
            [email, passwordHash, firstName, lastName, phone]
        );

        const user = result.rows[0];

        // Создание корзины для нового пользователя
        await pool.query(
            'INSERT INTO carts (user_id) VALUES ($1)',
            [user.id]
        );

        // Создание записи в программе лояльности
        await pool.query(
            'INSERT INTO loyalty_points (user_id) VALUES ($1)',
            [user.id]
        );

        // Генерация JWT токена
        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'customer' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ Зарегистрирован новый пользователь: ${email}`);

        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token
        });

    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка при регистрации' });
    }
});

// Вход пользователя
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Поиск пользователя по email
        const result = await pool.query(
            `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.is_active, r.name as role
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const user = result.rows[0];

        // Проверка активности аккаунта
        if (!user.is_active) {
            return res.status(403).json({ error: 'Аккаунт деактивирован' });
        }

        // Проверка пароля
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Обновление времени последнего входа
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Логирование входа
        await pool.query(
            `INSERT INTO activity_logs (user_id, action_type, ip_address, user_agent)
             VALUES ($1, 'login', $2, $3)`,
            [user.id, req.ip, req.get('user-agent')]
        );

        // Генерация JWT токена
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ Пользователь вошел в систему: ${email}`);

        res.json({
            message: 'Вход выполнен успешно',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            },
            token
        });

    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка при входе' });
    }
});

// ============================================
// МАРШРУТЫ ТОВАРОВ
// ============================================

// Получение списка товаров с фильтрацией и пагинацией
app.get('/api/products', async (req, res) => {
    try {
        const { page, pageSize, category, brand, minPrice, maxPrice, search, sort, featured, new: isNew } = req.query;
        const { limit, offset } = getPagination(page, pageSize);

        let query = `
            SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            WHERE p.is_active = TRUE
        `;

        const values = [];
        let paramIndex = 1;

        // Фильтры
        if (category) {
            query += ` AND c.slug = $${paramIndex}`;
            values.push(category);
            paramIndex++;
        }

        if (brand) {
            query += ` AND b.slug = $${paramIndex}`;
            values.push(brand);
            paramIndex++;
        }

        if (minPrice) {
            query += ` AND p.base_price >= $${paramIndex}`;
            values.push(parseFloat(minPrice));
            paramIndex++;
        }

        if (maxPrice) {
            query += ` AND p.base_price <= $${paramIndex}`;
            values.push(parseFloat(maxPrice));
            paramIndex++;
        }

        if (featured === 'true') {
            query += ` AND p.is_featured = TRUE`;
        }

        if (isNew === 'true') {
            query += ` AND p.is_new = TRUE`;
        }

        // Поиск по названию и описанию
        if (search) {
            query += ` AND (to_tsvector('russian', p.name || ' ' || COALESCE(p.short_description, '')) @@ to_tsquery('russian', $${paramIndex}))`;
            values.push(search.replace(/\s+/g, ' & '));
            paramIndex++;
        }

        // Сортировка
        const allowedSorts = ['created_at', 'base_price', 'rating_avg', 'name'];
        const sortOrder = sort === 'desc' ? 'DESC' : 'ASC';
        const sortBy = allowedSorts.includes(sort?.split('_')[0]) ? sort.split('_')[0] : 'created_at';
        query += ` ORDER BY ${sortBy} ${sortOrder}`;

        // Пагинация
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Получение общего количества товаров для пагинации
        let countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            WHERE p.is_active = TRUE
        `;

        // (Упрощено - в продакшене нужно добавить те же фильтры)
        const countResult = await pool.query(countQuery);
        const total = parseInt(countResult.rows[0].total);

        res.json({
            products: result.rows,
            pagination: {
                currentPage: parseInt(page) || 1,
                pageSize: limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Ошибка при получении товаров' });
    }
});

// Получение детальной информации о товаре
app.get('/api/products/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const result = await pool.query(
            `SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN brands b ON p.brand_id = b.id
             WHERE p.slug = $1 AND p.is_active = TRUE`,
            [slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const product = result.rows[0];

        // Логирование просмотра
        await pool.query(
            `INSERT INTO product_views (product_id, session_id, device_type, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [product.id, req.headers['x-session-id'], req.get('user-agent')?.includes('Mobile') ? 'mobile' : 'desktop', req.ip]
        );

        // Получение отзывов
        const reviewsResult = await pool.query(
            `SELECT r.*, u.first_name, u.last_name
             FROM reviews r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.product_id = $1 AND r.is_approved = TRUE
             ORDER BY r.created_at DESC
             LIMIT 10`,
            [product.id]
        );

        // Получение изображений
        const imagesResult = await pool.query(
            `SELECT image_url, alt_text, sort_order
             FROM product_images
             WHERE product_id = $1
             ORDER BY sort_order, is_main DESC`,
            [product.id]
        );

        res.json({
            product: {
                ...product,
                reviews: reviewsResult.rows,
                images: imagesResult.rows
            }
        });

    } catch (error) {
        console.error('Ошибка получения товара:', error);
        res.status(500).json({ error: 'Ошибка при получении товара' });
    }
});

// ============================================
// МАРШРУТЫ КОРЗИНЫ
// ============================================

// Добавление товара в корзину
app.post('/api/cart/add', authenticateToken, async (req, res) => {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user.id;

    try {
        // Получение корзины пользователя
        let cartResult = await pool.query(
            'SELECT id FROM carts WHERE user_id = $1',
            [userId]
        );

        let cartId;

        if (cartResult.rows.length === 0) {
            // Создание новой корзины
            const newCart = await pool.query(
                'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
                [userId]
            );
            cartId = newCart.rows[0].id;
        } else {
            cartId = cartResult.rows[0].id;
        }

        // Получение информации о товаре
        const productResult = await pool.query(
            'SELECT base_price, discount_price, stock_quantity FROM products WHERE id = $1',
            [productId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const product = productResult.rows[0];

        // Проверка наличия
        if (product.stock_quantity < quantity) {
            return res.status(400).json({ 
                error: 'Недостаточное количество товара на складе',
                available: product.stock_quantity
            });
        }

        const price = product.discount_price || product.base_price;

        // Добавление/обновление товара в корзине
        const result = await pool.query(
            `INSERT INTO cart_items (cart_id, product_id, quantity, price)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (cart_id, product_id)
             DO UPDATE SET quantity = cart_items.quantity + $3, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [cartId, productId, quantity, price]
        );

        // Обновление итогов корзины
        await pool.query(
            `UPDATE carts 
             SET total_amount = (SELECT SUM(quantity * price) FROM cart_items WHERE cart_id = $1),
                 items_count = (SELECT SUM(quantity) FROM cart_items WHERE cart_id = $1),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [cartId]
        );

        res.json({
            message: 'Товар добавлен в корзину',
            cartItem: result.rows[0]
        });

    } catch (error) {
        console.error('Ошибка добавления в корзину:', error);
        res.status(500).json({ error: 'Ошибка при добавлении в корзину' });
    }
});

// Получение содержимого корзины
app.get('/api/cart', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `SELECT ci.id, ci.quantity, ci.price, ci.discount,
                    p.id as product_id, p.name, p.slug, p.main_image_url,
                    (ci.quantity * ci.price - ci.discount) as total
             FROM cart_items ci
             JOIN carts c ON ci.cart_id = c.id
             JOIN products p ON ci.product_id = p.id
             WHERE c.user_id = $1
             ORDER BY ci.created_at DESC`,
            [userId]
        );

        const cartTotal = await pool.query(
            'SELECT total_amount, items_count FROM carts WHERE user_id = $1',
            [userId]
        );

        res.json({
            items: result.rows,
            total: cartTotal.rows[0]?.total_amount || 0,
            itemsCount: cartTotal.rows[0]?.items_count || 0
        });

    } catch (error) {
        console.error('Ошибка получения корзины:', error);
        res.status(500).json({ error: 'Ошибка при получении корзины' });
    }
});

// ============================================
// МАРШРУТЫ ЗАКАЗОВ
// ============================================

// Создание заказа
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { deliveryMethod, deliveryAddressId, customerComment, paymentMethod } = req.body;
    const userId = req.user.id;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Получение корзины пользователя
        const cartResult = await client.query(
            'SELECT id, total_amount FROM carts WHERE user_id = $1',
            [userId]
        );

        if (cartResult.rows.length === 0 || cartResult.rows[0].total_amount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Корзина пуста' });
        }

        const cart = cartResult.rows[0];

        // Расчет стоимости доставки (упрощенно)
        const deliveryCost = 0; // Можно добавить логику расчета
        const taxRate = 0.20; // НДС 20%
        const subtotal = parseFloat(cart.total_amount);
        const taxAmount = subtotal * taxRate;
        const totalAmount = subtotal + deliveryCost + taxAmount;

        // Создание заказа
        const orderResult = await client.query(
            `INSERT INTO orders (user_id, status, delivery_method, delivery_address_id, 
                                subtotal, tax_amount, delivery_cost, total_amount, 
                                payment_method, customer_comment, ip_address, user_agent)
             VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id, order_number`,
            [userId, deliveryMethod, deliveryAddressId, subtotal, taxAmount, deliveryCost, 
             totalAmount, paymentMethod, customerComment, req.ip, req.get('user-agent')]
        );

        const order = orderResult.rows[0];

        // Перенос товаров из корзины в заказ
        await client.query(
            `INSERT INTO order_items (order_id, product_id, product_name, product_sku, quantity, price, discount, total)
             SELECT $1, p.id, p.name, p.sku, ci.quantity, ci.price, ci.discount, (ci.quantity * ci.price - ci.discount)
             FROM cart_items ci
             JOIN products p ON ci.product_id = p.id
             WHERE ci.cart_id = (SELECT id FROM carts WHERE user_id = $2)`,
            [order.id, userId]
        );

        // Обновление остатков товаров
        await client.query(
            `UPDATE products p
             SET stock_quantity = stock_quantity - ci.quantity
             FROM cart_items ci
             WHERE p.id = ci.product_id AND ci.cart_id = (SELECT id FROM carts WHERE user_id = $1)`,
            [userId]
        );

        // Очистка корзины
        await client.query(
            'DELETE FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1)',
            [userId]
        );

        await client.query(
            'UPDATE carts SET total_amount = 0, items_count = 0 WHERE user_id = $1',
            [userId]
        );

        // Начисление баллов лояльности (1% от суммы заказа)
        const loyaltyPoints = Math.floor(totalAmount * 0.01);
        await client.query(
            `INSERT INTO loyalty_transactions (user_id, order_id, transaction_type, points_amount, balance_after, description)
             SELECT $1, $2, 'earned', $3, COALESCE(lp.points_balance, 0) + $3, 'Баллы за заказ #' || $4
             FROM loyalty_points lp
             WHERE lp.user_id = $1`,
            [userId, order.id, loyaltyPoints, order.order_number]
        );

        await client.query(
            `UPDATE loyalty_points 
             SET points_balance = points_balance + $1, lifetime_points = lifetime_points + $1
             WHERE user_id = $2`,
            [loyaltyPoints, userId]
        );

        await client.query('COMMIT');

        console.log(`✅ Создан новый заказ: ${order.order_number}`);

        res.status(201).json({
            message: 'Заказ успешно создан',
            order: {
                id: order.id,
                orderNumber: order.order_number,
                totalAmount: totalAmount,
                loyaltyPointsEarned: loyaltyPoints
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания заказа:', error);
        res.status(500).json({ error: 'Ошибка при создании заказа' });
    } finally {
        client.release();
    }
});

// История заказов пользователя
app.get('/api/orders', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
                    o.payment_status, o.delivery_method
             FROM orders o
             WHERE o.user_id = $1
             ORDER BY o.created_at DESC`,
            [userId]
        );

        res.json({ orders: result.rows });

    } catch (error) {
        console.error('Ошибка получения заказов:', error);
        res.status(500).json({ error: 'Ошибка при получении заказов' });
    }
});

// ============================================
// МАРШРУТЫ КАТЕГОРИЙ
// ============================================

// Получение всех категорий
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.name, c.slug, c.parent_id, c.image_url, c.sort_order,
                    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = TRUE) as product_count
             FROM categories c
             WHERE c.is_active = TRUE
             ORDER BY c.sort_order, c.name`,
            []
        );

        // Формирование иерархической структуры
        const buildTree = (items, parentId = null) => {
            return items
                .filter(item => item.parent_id === parentId)
                .map(item => ({
                    ...item,
                    children: buildTree(items, item.id)
                }));
        };

        const categories = buildTree(result.rows);

        res.json({ categories });

    } catch (error) {
        console.error('Ошибка получения категорий:', error);
        res.status(500).json({ error: 'Ошибка при получении категорий' });
    }
});

// ============================================
// МАРШРУТЫ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ============================================

// Получение профиля пользователя
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_verified,
                    lp.points_balance, lp.tier
             FROM users u
             LEFT JOIN loyalty_points lp ON u.id = lp.user_id
             WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = result.rows[0];

        // Получение адресов
        const addressesResult = await pool.query(
            `SELECT id, address_type, country, city, street, building, apartment, postal_code, is_default
             FROM addresses
             WHERE user_id = $1
             ORDER BY is_default DESC, created_at DESC`,
            [userId]
        );

        res.json({
            user: {
                ...user,
                addresses: addressesResult.rows
            }
        });

    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ error: 'Ошибка при получении профиля' });
    }
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🏠 HomeStyle API Server                         ║
║   ✅ Сервер запущен                               ║
║   🌐 Порт: ${PORT}                                     ║
║   🗄️  База данных: PostgreSQL                    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
});

// Обработка незакрытых подключений
process.on('SIGTERM', () => {
    console.log('SIGTERM сигнал получен. Закрытие сервера...');
    pool.end();
    process.exit(0);
});

module.exports = app;
