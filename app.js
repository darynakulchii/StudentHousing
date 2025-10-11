document.addEventListener('DOMContentLoaded', () => {
    // 1. УПРАВЛІННЯ МОБІЛЬНИМ МЕНЮ (якщо потрібно)
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const desktopNav = document.querySelector('.desktop-nav');

    if (menuToggle && desktopNav) {
        menuToggle.addEventListener('click', () => {
            // Тут потрібно додати логіку для показу/приховування мобільного меню
            // Наприклад, додати/видалити клас 'active' до/з body або nav
            // desktopNav.classList.toggle('active-mobile'); 
            console.log('Mobile menu toggled');
        });
    }

    // 2. ФІЛЬТРИ (заглушка)
    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            alert('Відкриття вікна/панелі фільтрів...');
        });
    }

    // 3. ПОШУК (заглушка)
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Пошук за запитом:', searchInput.value);
                // Тут буде логіка API-запиту
            }
        });
    }
});