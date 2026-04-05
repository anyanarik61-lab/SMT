// Данные товаров
const products = [
    {
        id: 1,
        title: "Обои виниловые Premium",
        category: "decoration",
        price: 2499,
        rating: 4.8,
        reviews: 156,
        image: "🎨"
    },
    {
        id: 2,
        title: "Ламинат дуб натуральный",
        category: "decoration",
        price: 1899,
        rating: 4.7,
        reviews: 203,
        image: "🪵"
    },
    {
        id: 3,
        title: "Краска интерьерная матовая",
        category: "repair",
        price: 899,
        rating: 4.6,
        reviews: 98,
        image: "🖌️"
    },
    {
        id: 4,
        title: "Светильник потолочный LED",
        category: "lighting",
        price: 3499,
        rating: 4.9,
        reviews: 187,
        image: "💡"
    },
    {
        id: 5,
        title: "Диван угловой Modern",
        category: "furniture",
        price: 45999,
        rating: 4.8,
        reviews: 76,
        image: "🛋️"
    },
    {
        id: 6,
        title: "Шторы блэкаут 2шт",
        category: "decor",
        price: 4299,
        rating: 4.5,
        reviews: 134,
        image: "🪟"
    },
    {
        id: 7,
        title: "Плитка керамическая",
        category: "decoration",
        price: 1599,
        rating: 4.7,
        reviews: 245,
        image: "🔲"
    },
    {
        id: 8,
        title: "Смеситель кухонный",
        category: "repair",
        price: 5999,
        rating: 4.6,
        reviews: 89,
        image: "🚰"
    },
    {
        id: 9,
        title: "Ковер шерстяной 2x3м",
        category: "decor",
        price: 12999,
        rating: 4.8,
        reviews: 67,
        image: "🧶"
    },
    {
        id: 10,
        title: "Торшер напольный",
        category: "lighting",
        price: 6499,
        rating: 4.7,
        reviews: 112,
        image: "🏮"
    },
    {
        id: 11,
        title: "Комод деревянный",
        category: "furniture",
        price: 18999,
        rating: 4.6,
        reviews: 54,
        image: "🗄️"
    },
    {
        id: 12,
        title: "Зеркало в раме 80x120",
        category: "decor",
        price: 7999,
        rating: 4.9,
        reviews: 143,
        image: "🪞"
    }
];

// Отзывы клиентов
const reviews = [
    {
        id: 1,
        author: "Александр М.",
        date: "15.11.2024",
        text: "Отличный магазин! Заказывал обои и ламинат для ремонта квартиры. Качество товаров превосходное, доставка быстрая. Консультанты помогли подобрать материалы. Рекомендую!",
        rating: 5,
        avatar: "А"
    },
    {
        id: 2,
        author: "Елена К.",
        date: "12.11.2024",
        text: "Покупала здесь светильники и шторы. Очень довольна покупкой! Цены адекватные, ассортимент большой. Особенно понравилась программа лояльности - получила хорошую скидку.",
        rating: 5,
        avatar: "Е"
    },
    {
        id: 3,
        author: "Дмитрий П.",
        date: "08.11.2024",
        text: "Заказывал мебель для гостиной. Качество отличное, сборка профессиональная. Единственное - доставка задержалась на день, но менеджер предупредил заранее.",
        rating: 4,
        avatar: "Д"
    },
    {
        id: 4,
        author: "Ольга С.",
        date: "05.11.2024",
        text: "Регулярно покупаю здесь товары для дома. Нравится удобный сайт с фильтрами, всегда можно найти нужное. Программа лояльности действительно выгодная.",
        rating: 5,
        avatar: "О"
    }
];

// Корзина
let cart = [];
let favorites = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загрузка товаров
    renderProducts(products);
    
    // Загрузка отзывов
    renderReviews(reviews);
    
    // Обработчик переключения доступности
    const accessibilityBtn = document.getElementById('accessibility-toggle');
    accessibilityBtn.addEventListener('click', toggleAccessibility);
    
    // Обработчики фильтров
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    
    // Обработчик формы консультации
    document.getElementById('consultation-form').addEventListener('submit', handleConsultation);
    
    // Плавная прокрутка
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

// Рендеринг товаров
function renderProducts(productsToRender) {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    
    productsToRender.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-image">${product.image}</div>
            <div class="product-info">
                <div class="product-category">${getCategoryName(product.category)}</div>
                <h3 class="product-title">${product.title}</h3>
                <div class="product-price">${product.price.toLocaleString()} ₽</div>
                <div class="product-rating">
                    <span class="stars">${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}</span>
                    <span class="rating-count">(${product.reviews})</span>
                </div>
                <div class="product-actions">
                    <button class="btn-add-to-cart" onclick="addToCart(${product.id})">В корзину</button>
                    <button class="btn-favorite" onclick="toggleFavorite(${product.id})">❤️</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Рендеринг отзывов
function renderReviews(reviewsToRender) {
    const container = document.getElementById('reviews-container');
    container.innerHTML = '';
    
    reviewsToRender.forEach(review => {
        const card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = `
            <div class="review-header">
                <div class="review-avatar">${review.avatar}</div>
                <div>
                    <div class="review-author">${review.author}</div>
                    <div class="review-date">${review.date}</div>
                </div>
            </div>
            <p class="review-text">${review.text}</p>
            <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
        `;
        container.appendChild(card);
    });
}

// Получение названия категории
function getCategoryName(category) {
    const categories = {
        'repair': 'Ремонт',
        'decoration': 'Отделка',
        'decor': 'Декор',
        'furniture': 'Мебель',
        'lighting': 'Освещение'
    };
    return categories[category] || category;
}

// Применение фильтров
function applyFilters() {
    const category = document.getElementById('category-filter').value;
    const minPrice = document.getElementById('min-price').value;
    const maxPrice = document.getElementById('max-price').value;
    const rating = document.getElementById('rating-filter').value;
    
    let filtered = [...products];
    
    if (category) {
        filtered = filtered.filter(p => p.category === category);
    }
    
    if (minPrice) {
        filtered = filtered.filter(p => p.price >= parseInt(minPrice));
    }
    
    if (maxPrice) {
        filtered = filtered.filter(p => p.price <= parseInt(maxPrice));
    }
    
    if (rating) {
        filtered = filtered.filter(p => p.rating >= parseInt(rating));
    }
    
    renderProducts(filtered);
}

// Сброс фильтров
function resetFilters() {
    document.getElementById('category-filter').value = '';
    document.getElementById('min-price').value = '';
    document.getElementById('max-price').value = '';
    document.getElementById('rating-filter').value = '';
    renderProducts(products);
}

// Добавление в корзину
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        cart.push(product);
        updateCartCount();
        showNotification(`"${product.title}" добавлен в корзину`);
    }
}

// Обновление счетчика корзины
function updateCartCount() {
    const countElement = document.querySelector('.cart-count');
    countElement.textContent = cart.length;
}

// Переключение избранного
function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    if (index === -1) {
        favorites.push(productId);
        showNotification('Добавлено в избранное');
    } else {
        favorites.splice(index, 1);
        showNotification('Удалено из избранного');
    }
}

// Обработка формы консультации
function handleConsultation(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    
    // Здесь должна быть отправка на сервер
    console.log('Заявка на консультацию:', { name, phone, email, message });
    
    showNotification('Спасибо! Ваша заявка отправлена. Мы свяжемся с вами в ближайшее время.');
    e.target.reset();
}

// Переключение режима доступности
function toggleAccessibility() {
    const body = document.body;
    const btn = document.getElementById('accessibility-toggle');
    
    if (body.classList.contains('standard-mode')) {
        body.classList.remove('standard-mode');
        body.classList.add('accessibility-mode');
        btn.innerHTML = '<span class="icon">👁️</span><span>Обычная версия</span>';
    } else {
        body.classList.remove('accessibility-mode');
        body.classList.add('standard-mode');
        btn.innerHTML = '<span class="icon">👁️</span><span>Версия для слабовидящих</span>';
    }
}

// Показ уведомления
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #2E7D32 0%, #1976D2 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Добавляем стили для анимации уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
