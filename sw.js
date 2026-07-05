const CACHE_NAME = 'crazy-rabbit-v2'; // ← Изменили версию!
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Установка
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // ← Добавили принудительное обновление
  );
});

// Активация - удаляем старый кэш
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim()) // ← Захватываем контроль
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Сначала сеть, потом кэш
      return fetch(event.request)
        .then((response) => {
          // Обновляем кэш
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => cached); // Если нет сети - из кэша
    })
  );
}); 