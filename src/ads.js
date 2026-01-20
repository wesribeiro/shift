/**
 * src/ads.js
 * Gerenciador de Anúncios (Monetização).
 * Versão Final: Layout Simétrico (300x600 em ambas as laterais).
 */

// =========================================================
// CONFIGURAÇÃO DO ADSENSE
// =========================================================
const ADS_CONFIG = {
    // Mude para 'true' quando o site for aprovado e estiver em produção
    isProduction: false, 

    // Seu ID de Editor (encontrado na conta AdSense: pub-xxxxxxxxxxxxxxxx)
    client: 'ca-pub-0000000000000000', 

    slots: [
        { 
            id: 'ad-header-slot', 
            type: 'leaderboard',
            // ID do Bloco criado no AdSense para o Topo
            adSlot: '1234567890', 
            // Estilo forçado para evitarCLS (Cumulative Layout Shift)
            style: 'display:inline-block;width:728px;height:90px', 
            format: 'auto'
        },
        { 
            id: 'ad-sidebar-left', 
            type: 'halfpage',
            // ID do Bloco para Esquerda (Agora 300x600)
            adSlot: '2345678901', 
            style: 'display:inline-block;width:300px;height:600px'
        },
        { 
            id: 'ad-sidebar-right', 
            type: 'halfpage',
            // ID do Bloco para Direita (300x600)
            adSlot: '3456789012', 
            style: 'display:inline-block;width:300px;height:600px'
        }
    ],
    
    // Intervalo de Refresh (apenas para placeholders de dev)
    refreshInterval: 60000 
};

let refreshTimer = null;
let secondsSinceLastRefresh = 0;

export function initAds() {
    console.log(`Inicializando Ads (Modo: ${ADS_CONFIG.isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'})...`);

    // Carrega os anúncios iniciais
    loadAdsInitial();

    // Se estiver em DEV, inicia o timer visual. 
    // Em PROD, o Google cuida do refresh automaticamente.
    if (!ADS_CONFIG.isProduction) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        startRefreshLoop();
    }
}

function loadAdsInitial() {
    ADS_CONFIG.slots.forEach(slot => {
        const container = document.getElementById(slot.id);
        
        // Se o slot não existe na tela (ex: mobile esconde laterais), ignora
        if (!container) return;

        // Limpa o placeholder listrado e marca como carregado
        container.innerHTML = '';
        container.classList.add('ad-loaded');

        if (ADS_CONFIG.isProduction) {
            // ==========================================
            // INJEÇÃO REAL DO ADSENSE
            // ==========================================
            try {
                const ins = document.createElement('ins');
                ins.className = 'adsbygoogle';
                ins.style.cssText = slot.style || 'display:block';
                ins.setAttribute('data-ad-client', ADS_CONFIG.client);
                ins.setAttribute('data-ad-slot', slot.adSlot);
                
                if (slot.format) {
                    ins.setAttribute('data-ad-format', slot.format);
                    ins.setAttribute('data-full-width-responsive', 'true');
                }

                container.appendChild(ins);

                // Solicita o anúncio (Push)
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                // console.log(`AdSense push enviado para: ${slot.id}`);

            } catch (e) {
                console.error("Erro ao carregar AdSense:", e);
            }

        } else {
            // ==========================================
            // PLACEHOLDER DE DESENVOLVIMENTO
            // ==========================================
            container.classList.remove('ad-loaded'); // Mantém estilo visual se necessário
            
            // Dimensões para texto de debug
            const dimText = getDimensionsByType(slot.type);

            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full w-full bg-gray-200 dark:bg-gray-800 border border-dashed border-gray-400 dark:border-gray-600 rounded text-center select-none cursor-not-allowed transition-colors">
                    <span class="font-bold mb-1 text-gray-500 dark:text-gray-400 text-[10px]">PUBLICIDADE</span>
                    <span class="text-[9px] uppercase tracking-wider mb-1 text-gray-400">${dimText}</span>
                    <span class="font-mono text-gray-600 dark:text-gray-300 bg-gray-300 dark:bg-gray-700 px-2 py-0.5 rounded text-[10px]">
                        Refresh: <span id="timer-${slot.id}">0</span>s
                    </span>
                </div>
            `;
        }
    });
}

// ==========================================
// LÓGICA APENAS PARA DESENVOLVIMENTO (DEV)
// ==========================================

function startRefreshLoop() {
    refreshTimer = setInterval(() => {
        if (document.hidden) return;

        secondsSinceLastRefresh++;
        updateDevTimers(secondsSinceLastRefresh);

        if (secondsSinceLastRefresh * 1000 >= ADS_CONFIG.refreshInterval) {
            simulateRefreshEffect();
            secondsSinceLastRefresh = 0;
        }
    }, 1000);
}

function simulateRefreshEffect() {
    ADS_CONFIG.slots.forEach(slot => {
        const timerDisplay = document.getElementById(`timer-${slot.id}`);
        if (timerDisplay) {
            const parent = timerDisplay.parentElement;
            // Efeito visual de "flash" verde
            parent.className = "font-mono text-white bg-brand-500 px-2 py-0.5 rounded transition-colors duration-300 text-[10px]";
            timerDisplay.textContent = "OK";
            
            setTimeout(() => { 
                if(parent) {
                    parent.className = "font-mono text-gray-600 dark:text-gray-300 bg-gray-300 dark:bg-gray-700 px-2 py-0.5 rounded transition-colors duration-500 text-[10px]";
                    timerDisplay.textContent = "0";
                }
            }, 1000);
        }
    });
}

function updateDevTimers(seconds) {
    ADS_CONFIG.slots.forEach(slot => {
        const el = document.getElementById(`timer-${slot.id}`);
        if (el) el.textContent = seconds;
    });
}

function handleVisibilityChange() {
    // Pode ser usado para pausar timers se a aba não estiver visível
}

function getDimensionsByType(type) {
    switch(type) {
        case 'leaderboard': return '728x90';
        case 'halfpage': return '300x600'; // Ajustado para refletir a nova simetria
        default: return 'Ad';
    }
}