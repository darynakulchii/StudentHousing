const filtersBtn = document.getElementById('btnFilters');
const menuBtn = document.getElementById('btnMenu');
const listingsBtn = document.getElementById('btnListings');

const filtersWindow = document.getElementById('filtersWindow');
const menuWindow = document.getElementById('menuWindow');
const listingsWindow = document.getElementById('listingsWindow');

function showWindow(activeWindow) {
    [filtersWindow, menuWindow, listingsWindow].forEach(win => {
        win.classList.remove('active');
    });
    activeWindow.classList.add('active');
}

filtersBtn.addEventListener('click', () => showWindow(filtersWindow));
menuBtn.addEventListener('click', () => showWindow(menuWindow));
listingsBtn.addEventListener('click', () => showWindow(listingsWindow));
