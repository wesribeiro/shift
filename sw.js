/**
 * Service Worker do SHIFT PWA
 * Estratégia: Cache First (Prioriza performance e Offline)
 */

const CACHE_NAME = 'shift-pwa-v1';

// Lista de arquivos que devem ser salvos para rodar offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  
  // Módulos JS
  './src/app.js',
  './src/db.js',
  './src/logic.js',
  './src/ui.js',
  './src/ads.js',

  // Dependências Externas (CDNs)
  // Nota: Cachear CDNs garante que o visual carregue offline
  'https://cdn.tailwindcss.com', 
  'https://unpkg.com/@phosphor-icons/web'
];

// 1. Instalação: Baixa e salva os arquivos
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando app shell...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Ativa imediatamente
});

// 2. Ativação: Limpa caches antigos (se houver atualização de versão)
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Fetch: Intercepta requisições
self.addEventListener('fetch', (event) => {
  // Ignora requisições de outros domínios que não sejam os cacheados ou API
  // Para este app Local First, queremos servir quase tudo do cache.
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se está no cache, retorna do cache
      if (response) {
        return response;
      }
      
      // Se não, tenta buscar na rede
      // (Útil para scripts de anúncios que não devem ser cacheados rigidamente)
      return fetch(event.request).catch(() => {
        // Se falhar (offline) e for uma navegação, poderia retornar uma página de fallback
        // Mas como é SPA, o index.html já está em cache.
        console.log('[Service Worker] Falha na rede (Offline):', event.request.url);
      });
    })
  );
});