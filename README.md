# HomeStyle - Интернет-магазин товаров для дома

## 📋 Описание проекта

Полнофункциональный прототип интернет-магазина **HomeStyle** с готовой схемой базы данных PostgreSQL и фронтенд-частью.

### Особенности:
- ✅ Адаптивный дизайн (мобильные + десктоп)
- ✅ Режим доступности для слабовидящих (ГОСТ Р 52872-2017)
- ✅ Полная схема БД PostgreSQL с триггерами и представлениями
- ✅ Готовый API-слой для подключения бэкенда
- ✅ SEO-оптимизация (Schema.org, мета-теги)
- ✅ Корзина, избранное, отзывы, программа лояльности

---

## 🗄️ База данных PostgreSQL

### Структура БД

Схема базы данных расположена в файле `database/schema.sql` и включает:

#### Основные модули:
1. **Пользователи и роли** - система аутентификации и авторизации
2. **Каталог товаров** - продукты, категории, бренды, характеристики
3. **Корзина и заказы** - управление покупками
4. **Программа лояльности** - баллы, скидки, акции
5. **Контент** - страницы, блог, новости
6. **Аналитика** - просмотры, логи действий

#### Ключевые возможности схемы:
- 🔹 JSONB поля для гибких характеристик товаров
- 🔹 Полнотекстовый поиск на русском языке
- 🔹 Автоматический пересчет рейтингов товаров
- 🔹 Генерация номеров заказов
- 🔹 История статусов заказов
- 🔹 Представления (views) для популярных запросов

### Установка БД

```bash
# 1. Создайте базу данных
createdb homestyle

# 2. Импортируйте схему
psql -d homestyle -f database/schema.sql

# 3. Проверьте структуру
psql -d homestyle -c "\dt"
```

### Конфигурация подключения

Создайте файл `.env` в корне проекта:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=homestyle
DB_USER=postgres
DB_PASSWORD=your_secure_password
```

---

## 🌐 Фронтенд

### Запуск

Просто откройте файл `index.html` в браузере:

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html
```

### Структура файлов

```
/workspace
├── index.html              # Главная страница (SPA)
├── css/
│   └── styles.css          # Стили (встроены в HTML)
├── js/
│   └── app.js              # Логика приложения (встроена в HTML)
├── database/
│   └── schema.sql          # Схема PostgreSQL
├── server/
│   └── api.js              # API сервер (для будущей разработки)
└── README.md               # Этот файл
```

---

## 🔌 Интеграция фронтенда с БД

### Примеры SQL-запросов для API

#### Получение списка товаров
```sql
SELECT * FROM active_products_with_categories 
WHERE is_in_stock = TRUE 
ORDER BY created_at DESC 
LIMIT 20;
```

#### Поиск товаров
```sql
SELECT p.*, ts_rank(to_tsvector('russian', p.name || ' ' || COALESCE(p.short_description, '')), query) AS rank
FROM products p, to_tsquery('russian', 'диван & угловой') query
WHERE to_tsvector('russian', p.name || ' ' || COALESCE(p.short_description, '')) @@ query
AND p.is_active = TRUE
ORDER BY rank DESC;
```

#### Добавление товара в корзину
```sql
INSERT INTO cart_items (cart_id, product_id, quantity, price)
VALUES ($1, $2, $3, $4)
ON CONFLICT (cart_id, product_id) 
DO UPDATE SET quantity = cart_items.quantity + $3;
```

#### Создание заказа
```sql
BEGIN;

-- Создаем заказ
INSERT INTO orders (user_id, total_amount, delivery_method)
VALUES ($1, $2, $3)
RETURNING id;

-- Переносим товары из корзины
INSERT INTO order_items (order_id, product_id, product_name, product_sku, quantity, price, total)
SELECT $4, p.id, p.name, p.sku, ci.quantity, ci.price, ci.quantity * ci.price
FROM cart_items ci
JOIN products p ON ci.product_id = p.id
WHERE ci.cart_id = $5;

-- Очищаем корзину
DELETE FROM cart_items WHERE cart_id = $5;

COMMIT;
```

---

## 🚀 Рекомендации по разработке бэкенда

### Рекомендуемый стек:
- **Node.js + Express** или **Python + FastAPI** или **PHP + Laravel**
- **PostgreSQL** (уже готова схема)
- **Redis** (кэширование, сессии)
- **JWT** (аутентификация)

### Пример структуры API endpoints:

```
GET    /api/products           # Список товаров
GET    /api/products/:slug     # Детали товара
POST   /api/cart/add           # Добавить в корзину
GET    /api/cart               # Получить корзину
POST   /api/orders             # Создать заказ
GET    /api/orders             # История заказов
POST   /api/auth/register      # Регистрация
POST   /api/auth/login         # Вход
GET    /api/user/profile       # Профиль пользователя
PUT    /api/user/profile       # Обновить профиль
```

---

## 📊 Метрики и аналитика

В схеме БД предусмотрены таблицы для отслеживания:
- Просмотры товаров (`product_views`)
- Действия пользователей (`activity_logs`)
- Конверсия заказов
- Популярность товаров (view `popular_products`)

---

## 🔒 Безопасность

Реализованные меры:
- ✅ Ролевая модель доступа (admin, manager, customer, guest)
- ✅ Хэширование паролей (bcrypt/argon2)
- ✅ Защита от SQL-инъекций (параметризированные запросы)
- ✅ HTTPS (требуется настройка на сервере)
- ✅ Логирование всех действий

---

## 📈 Масштабирование

Для высоких нагрузок рекомендуется:
1. Настроить репликацию PostgreSQL
2. Использовать connection pooling (PgBouncer)
3. Кэшировать популярные запросы в Redis
4. Разделить чтение/запись на разные узлы БД
5. Использовать CDN для статических файлов

---

## 📝 Лицензия

Проект создан в образовательных целях.

---

## 👥 Контакты

Для вопросов и предложений обращайтесь к разработчику.

**HomeStyle** - Ваш надежный партнер в обустройстве дома! 🏠
