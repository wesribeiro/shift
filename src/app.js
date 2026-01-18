/**
 * src/app.js
 * Ponto de entrada (Entry Point) da aplicação SHIFT.
 * Orquestra a inicialização da UI, Banco de Dados e Monetização.
 */

import { init as initUI } from './ui.js';
import { initAds } from './ads.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("SHIFT App: Iniciando sistemas...");

    try {
        // 1. Inicializa a Interface Gráfica
        // Isso dispara a conexão com o IndexedDB e o carregamento dos registros do dia
        await initUI();
        console.log("SHIFT App: UI pronta.");

        // 2. Inicializa o subsistema de Anúncios
        // Roda em paralelo/independente para não bloquear a UI
        initAds();
        console.log("SHIFT App: Módulo de Ads ativo.");

        // 3. Registro do Service Worker (PWA)
        // Necessário para funcionamento offline (cache de assets).
        // O arquivo sw.js deve estar na raiz.
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registrado com sucesso: ', registration.scope);
                    })
                    .catch(err => {
                        console.log('Falha ao registrar ServiceWorker: ', err);
                    });
            });
        }

    } catch (error) {
        console.error("SHIFT App: Erro fatal na inicialização:", error);
        document.body.innerHTML = `
            <div class="flex items-center justify-center h-screen bg-red-50 text-red-800 p-4 text-center">
                <div>
                    <h1 class="text-2xl font-bold mb-2">Erro de Inicialização</h1>
                    <p>Não foi possível carregar a base de dados local.</p>
                    <p class="text-sm mt-2 font-mono bg-red-100 p-2 rounded">${error.message}</p>
                    <button onclick="window.location.reload()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Tentar Novamente</button>
                </div>
            </div>
        `;
    }
});