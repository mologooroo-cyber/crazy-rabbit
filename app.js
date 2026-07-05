// ============ ПЕРЕМЕННЫЕ ============
let currentTab = 'statistics';
let deferredPrompt;
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');
const contentBody = document.getElementById('contentBody');
const currentTabTitle = document.getElementById('currentTabTitle');
const installBtn = document.getElementById('installBtn');

// ============ БАЗА ДАННЫХ INDEXEDDB ============
class Database {
    constructor() {
        this.dbName = 'CrazyRabbitDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилища
                if (!db.objectStoreNames.contains('products')) {
                    db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('sales')) {
                    db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('clients')) {
                    db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

const db = new Database();

// ============ УПРАВЛЕНИЕ ТЕМАМИ ============
class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.loadTheme();
    }

    async loadTheme() {
        try {
            const settings = await db.get('settings', 'theme');
            if (settings) {
                this.currentTheme = settings.value;
            }
        } catch (e) {
            // Используем тему по умолчанию
        }
        this.applyTheme(this.currentTheme);
    }

    async setTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
        
        // Сохраняем в IndexedDB
        try {
            await db.put('settings', { key: 'theme', value: theme });
        } catch (e) {
            console.error('Ошибка сохранения темы:', e);
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Обновляем активную кнопку
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }
}

const themeManager = new ThemeManager();

// ============ УПРАВЛЕНИЕ ВКЛАДКАМИ ============
function switchTab(tabName) {
    currentTab = tabName;
    
    // Обновляем заголовок
    const titles = {
        'statistics': 'Статистика',
        'warehouse': 'Склад',
        'sales': 'Продажи',
        'clients': 'Клиенты'
    };
    currentTabTitle.textContent = titles[tabName];
    
    // Обновляем активный пункт меню
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });
    
    // Анимируем контент
    contentBody.style.opacity = '0';
    contentBody.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        contentBody.innerHTML = `<p class="text-center text-muted py-5">Вкладка "${titles[tabName]}" находится в разработке</p>`;
        contentBody.style.opacity = '1';
        contentBody.style.transform = 'translateY(0)';
    }, 200);
    
    // Закрываем сайдбар
    closeSidebarMenu();
}

// ============ УПРАВЛЕНИЕ САЙДБАРОМ ============
function openSidebarMenu() {
    sidebar.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebarMenu() {
    sidebar.classList.remove('active');
    document.body.style.overflow = '';
}

// ============ ЭКСПОРТ/ИМПОРТ ДАННЫХ ============
async function exportData() {
    try {
        const data = {
            products: await db.getAll('products'),
            sales: await db.getAll('sales'),
            clients: await db.getAll('clients'),
            settings: await db.getAll('settings'),
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crazy-rabbit-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Данные успешно экспортированы', 'success');
    } catch (e) {
        showToast('Ошибка экспорта данных', 'error');
        console.error(e);
    }
}

async function importData(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Валидация данных
        if (!data.products || !data.sales || !data.clients) {
            throw new Error('Неверный формат файла');
        }
        
        // Очищаем текущие данные и импортируем новые
        for (const store of ['products', 'sales', 'clients', 'settings']) {
            const items = await db.getAll(store);
            for (const item of items) {
                await db.delete(store, item.id || item.key);
            }
        }
        
        for (const product of data.products) {
            await db.add('products', product);
        }
        for (const sale of data.sales) {
            await db.add('sales', sale);
        }
        for (const client of data.clients) {
            await db.add('clients', client);
        }
        
        showToast('Данные успешно импортированы', 'success');
        // Перезагружаем страницу для применения изменений
        setTimeout(() => location.reload(), 1500);
    } catch (e) {
        showToast('Ошибка импорта данных: ' + e.message, 'error');
        console.error(e);
    }
}

// ============ УВЕДОМЛЕНИЯ (TOAST) ============
function showToast(message, type = 'info') {
    const toastContainer = document.createElement('div');
    toastContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        padding: 12px 24px;
        border-radius: 25px;
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        animation: fadeInUp 0.3s ease;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    `;
    toastContainer.textContent = message;
    document.body.appendChild(toastContainer);
    
    setTimeout(() => {
        toastContainer.style.animation = 'fadeOutDown 0.3s ease';
        setTimeout(() => toastContainer.remove(), 300);
    }, 3000);
}

// ============ PWA УСТАНОВКА ============
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'flex';
});

installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        installBtn.style.display = 'none';
        showToast('Приложение установлено! 🎉', 'success');
    }
    
    deferredPrompt = null;
});

// ============ СОБЫТИЯ ============
menuToggle.addEventListener('click', openSidebarMenu);
closeSidebar.addEventListener('click', closeSidebarMenu);

// Закрытие сайдбара по клику на оверлей
sidebar.addEventListener('click', (e) => {
    if (e.target === sidebar) {
        closeSidebarMenu();
    }
});

// Навигация по вкладкам
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(item.dataset.tab);
    });
});

// Переключение тем
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        themeManager.setTheme(btn.dataset.theme);
        closeSidebarMenu();
    });
});

// ============ ИНИЦИАЛИЗАЦИЯ ============
async function init() {
    try {
        await db.init();
        console.log('База данных инициализирована');
    } catch (e) {
        console.error('Ошибка инициализации БД:', e);
    }
    
    // Загружаем начальную вкладку
    switchTab('statistics');
    
    // Регистрируем Service Worker
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/crazy-rabbit/sw.js');
            console.log('Service Worker зарегистрирован:', registration);
        } catch (e) {
            console.error('Ошибка регистрации Service Worker:', e);
        }
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);

// ============ ГОРЯЧИЕ КЛАВИШИ ============
document.addEventListener('keydown', (e) => {
    // Escape для закрытия сайдбара
    if (e.key === 'Escape' && sidebar.classList.contains('active')) {
        closeSidebarMenu();
    }
    
    // Ctrl+E для экспорта
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        exportData();
    }
});

// ============ ЖЕСТЫ (СВАЙП ДЛЯ ЗАКРЫТИЯ САЙДБАРА) ============
let touchStartX = 0;
sidebar.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
});

sidebar.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    
    // Свайп влево для закрытия
    if (diff > 100) {
        closeSidebarMenu();
    }
});
