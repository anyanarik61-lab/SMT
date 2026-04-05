-- Схема базы данных PostgreSQL для интернет-магазина HomeStyle
-- Версия: 1.0
-- Дата создания: 2024

-- Включение расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Для полнотекстового поиска

-- ============================================
-- 1. ТАБЛИЦЫ ПОЛЬЗОВАТЕЛЕЙ И РОЛЕЙ
-- ============================================

-- Таблица ролей пользователей
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- 'admin', 'manager', 'customer', 'guest'
    description TEXT,
    permissions JSONB DEFAULT '{}'::jsonb, -- Права доступа в формате JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица пользователей
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role_id INTEGER REFERENCES roles(id) DEFAULT 3, -- По умолчанию 'customer'
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по email
CREATE INDEX idx_users_email ON users(email);
-- Индекс для поиска по имени и фамилии
CREATE INDEX idx_users_name ON users USING gin(to_tsvector('russian', first_name || ' ' || last_name));

-- Таблица адресов пользователей
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    address_type VARCHAR(20) DEFAULT 'delivery', -- 'delivery', 'billing', 'home'
    country VARCHAR(100) DEFAULT 'Россия',
    city VARCHAR(100) NOT NULL,
    street VARCHAR(255) NOT NULL,
    building VARCHAR(20) NOT NULL,
    apartment VARCHAR(20),
    postal_code VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. КАТАЛОГ ТОВАРОВ
-- ============================================

-- Таблица категорий товаров
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для иерархического поиска
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Таблица брендов
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица товаров
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL, -- Артикул
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(1000),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    
    -- Цены
    base_price DECIMAL(12, 2) NOT NULL,
    discount_price DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- Остатки
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 10,
    is_in_stock BOOLEAN DEFAULT TRUE,
    
    -- Характеристики
    specifications JSONB DEFAULT '{}'::jsonb, -- Гибкое хранение характеристик
    weight DECIMAL(10, 3), -- кг
    dimensions JSONB, -- {"length": 100, "width": 50, "height": 30}
    
    -- Медиа
    main_image_url VARCHAR(500),
    images JSONB DEFAULT '[]'::jsonb, -- Массив URL изображений
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(500),
    
    -- Статусы
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE, -- Хиты продаж
    is_new BOOLEAN DEFAULT FALSE, -- Новинки
    
    -- Рейтинги
    rating_avg DECIMAL(3, 2) DEFAULT 0.00,
    review_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для товаров
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_price ON products(base_price);
CREATE INDEX idx_products_stock ON products(is_in_stock);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('russian', name || ' ' || COALESCE(short_description, '')));
CREATE INDEX idx_products_specifications ON products USING gin(specifications);

-- Таблица изображений товаров (детальная)
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблица отзывов о товарах
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    pros TEXT,
    cons TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_approved ON reviews(is_approved);

-- ============================================
-- 3. КОРЗИНА И ИЗБРАННОЕ
-- ============================================

-- Таблица корзин
CREATE TABLE carts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255), -- Для гостей без авторизации
    total_amount DECIMAL(12, 2) DEFAULT 0.00,
    items_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Элементы корзины
CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(12, 2) NOT NULL, -- Цена на момент добавления
    discount DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cart_id, product_id)
);

-- Таблица избранного (wishlist)
CREATE TABLE wishlists (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Элементы избранного
CREATE TABLE wishlist_items (
    id SERIAL PRIMARY KEY,
    wishlist_id INTEGER REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wishlist_id, product_id)
);

-- ============================================
-- 4. ЗАКАЗЫ И ОПЛАТА
-- ============================================

-- Статусы заказов
CREATE TYPE order_status AS ENUM (
    'pending',        -- Ожидает подтверждения
    'confirmed',      -- Подтвержден
    'processing',     -- В обработке
    'assembling',     -- Комплектуется
    'shipping',       -- Доставляется
    'delivered',      -- Доставлен
    'cancelled',      -- Отменен
    'refunded'        -- Возврат средств
);

-- Способы оплаты
CREATE TYPE payment_method AS ENUM (
    'card_online',
    'card_on_delivery',
    'cash_on_delivery',
    'bank_transfer',
    'installments'
);

-- Таблица заказов
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL, -- Формат: ORD-YYYYMMDD-XXXX
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Статусы
    status order_status DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'paid', 'partially_paid', 'refunded'
    
    -- Данные доставки
    delivery_address_id INTEGER REFERENCES addresses(id),
    delivery_address_text TEXT, -- Резервное копирование адреса
    delivery_method VARCHAR(100),
    delivery_cost DECIMAL(10, 2) DEFAULT 0.00,
    estimated_delivery_date DATE,
    
    -- Финансы
    subtotal DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- Оплата
    payment_method payment_method,
    payment_transaction_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Комментарии
    customer_comment TEXT,
    manager_comment TEXT,
    
    -- Метаданные
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at);

-- Элементы заказа
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(500) NOT NULL, -- Копия названия на момент заказа
    product_sku VARCHAR(50) NOT NULL, -- Копия артикула
    quantity INTEGER NOT NULL,
    price DECIMAL(12, 2) NOT NULL, -- Цена на момент заказа
    discount DECIMAL(12, 2) DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- История статусов заказа
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    old_status order_status,
    new_status order_status NOT NULL,
    comment TEXT,
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. ПРОГРАММА ЛОЯЛЬНОСТИ И АКЦИИ
-- ============================================

-- Типы скидок
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed', 'buy_x_get_y');

-- Таблица акций и скидок
CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type discount_type NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    
    -- Условия
    min_order_amount DECIMAL(12, 2),
    applicable_categories INTEGER[], -- Массив ID категорий
    applicable_products INTEGER[], -- Массив ID товаров
    applicable_brands INTEGER[], -- Массив ID брендов
    
    -- Период действия
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Ограничения
    usage_limit INTEGER, -- Общее количество использований
    usage_per_user INTEGER, -- Лимит на одного пользователя
    times_used INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Баллы лояльности
CREATE TABLE loyalty_points (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points_balance INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0,
    tier VARCHAR(50) DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- История начисления/списания баллов
CREATE TABLE loyalty_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id),
    transaction_type VARCHAR(50) NOT NULL, -- 'earned', 'spent', 'expired', 'adjusted'
    points_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. КОНТЕНТ И CMS
-- ============================================

-- Страницы сайта
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    content TEXT,
    excerpt VARCHAR(1000),
    meta_title VARCHAR(255),
    meta_description TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Блог/Новости
CREATE TABLE blog_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    content TEXT,
    excerpt VARCHAR(1000),
    author_id UUID REFERENCES users(id),
    category VARCHAR(100),
    tags VARCHAR(500)[],
    featured_image_url VARCHAR(500),
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. АНАЛИТИКА И ЛОГИРОВАНИЕ
-- ============================================

-- Просмотры товаров
CREATE TABLE product_views (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    referrer_url VARCHAR(500),
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
    ip_address INET
);

CREATE INDEX idx_product_views_product ON product_views(product_id);
CREATE INDEX idx_product_views_date ON product_views(viewed_at);

-- Логи действий пользователей
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL, -- 'login', 'logout', 'purchase', 'review', etc.
    entity_type VARCHAR(50), -- 'product', 'order', 'user'
    entity_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. НАСТРОЙКИ САЙТА
-- ============================================

CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. ТРИГГЕРЫ И ФУНКЦИИ
-- ============================================

-- Функция обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для таблиц с updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция пересчета рейтинга товара после добавления отзыва
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.is_approved THEN
            UPDATE products
            SET rating_avg = (
                    SELECT COALESCE(AVG(rating), 0)
                    FROM reviews
                    WHERE product_id = NEW.product_id AND is_approved = TRUE
                ),
                review_count = (
                    SELECT COUNT(*)
                    FROM reviews
                    WHERE product_id = NEW.product_id AND is_approved = TRUE
                )
            WHERE id = NEW.product_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE products
        SET rating_avg = (
                SELECT COALESCE(AVG(rating), 0)
                FROM reviews
                WHERE product_id = OLD.product_id AND is_approved = TRUE
            ),
            review_count = (
                SELECT COUNT(*)
                FROM reviews
                WHERE product_id = OLD.product_id AND is_approved = TRUE
            )
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- Функция генерации номера заказа
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'ORD-[0-9]+-([0-9]+)$' AS INTEGER)), 0) + 1
    INTO next_val
    FROM orders
    WHERE order_number LIKE 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
    
    NEW.order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_val::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================
-- 10. НАЧАЛЬНЫЕ ДАННЫЕ
-- ============================================

-- Роли
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Администратор с полным доступом', '{"all": true}'::jsonb),
('manager', 'Менеджер магазина', '{"products": ["read", "write"], "orders": ["read", "write"], "users": ["read"]}'::jsonb),
('customer', 'Покупатель', '{"products": ["read"], "orders": ["read", "write"], "profile": ["read", "write"]}'::jsonb),
('guest', 'Гость', '{"products": ["read"]}'::jsonb);

-- Настройки сайта
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', 'HomeStyle', 'string', 'Название сайта'),
('site_description', 'Интернет-магазин товаров для дома', 'string', 'Описание сайта'),
('currency', 'RUB', 'string', 'Основная валюта'),
('tax_rate', '20', 'number', 'Ставка НДС в процентах'),
('free_shipping_threshold', '5000', 'number', 'Сумма заказа для бесплатной доставки'),
('default_locale', 'ru_RU', 'string', 'Язык по умолчанию'),
('maintenance_mode', 'false', 'boolean', 'Режим обслуживания');

-- ============================================
-- 11. ПРЕДСТАВЛЕНИЯ (VIEWS) ДЛЯ УДОБСТВА
-- ============================================

-- Представление активных товаров с категориями
CREATE VIEW active_products_with_categories AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.slug,
    p.short_description,
    p.base_price,
    p.discount_price,
    p.is_in_stock,
    p.stock_quantity,
    p.rating_avg,
    p.review_count,
    p.main_image_url,
    c.id AS category_id,
    c.name AS category_name,
    c.slug AS category_slug,
    b.id AS brand_id,
    b.name AS brand_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
WHERE p.is_active = TRUE AND c.is_active = TRUE;

-- Представление последних заказов
CREATE VIEW recent_orders AS
SELECT 
    o.id,
    o.order_number,
    o.status,
    o.total_amount,
    o.created_at,
    u.email AS customer_email,
    u.first_name,
    u.last_name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
ORDER BY o.created_at DESC
LIMIT 100;

-- Представление популярных товаров
CREATE VIEW popular_products AS
SELECT 
    p.id,
    p.name,
    p.slug,
    p.base_price,
    COUNT(pv.id) AS view_count,
    COUNT(DISTINCT oi.order_id) AS order_count
FROM products p
LEFT JOIN product_views pv ON p.id = pv.product_id
LEFT JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.name, p.slug, p.base_price
ORDER BY view_count DESC, order_count DESC
LIMIT 20;

COMMENT ON DATABASE postgres IS 'База данных для интернет-магазина HomeStyle - товары для дома';
