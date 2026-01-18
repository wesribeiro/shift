/**
 * src/ads.js
 * Gerenciador de Anúncios (Monetização CPM).
 * Versão Final: Configurada para Layout Full Width (Header + 2 Laterais).
 */

// Configurações
const ADS_CONFIG = {
    refreshInterval: 60000, // 60 segundos
    slots: [
        // Topo (Leaderboard 728x90)
        { id: 'ad-header-slot', type: 'leaderboard' },
        
        // Lateral Esquerda (Skyscraper 160x600) - Apenas Desktop Large
        { id: 'ad-sidebar-left', type: 'skyscraper' },
        
        // Lateral Direita (Medium Rectangle/Skyscraper 300x600) - Desktop
        { id: 'ad-sidebar-right', type: 'rect' }
    ],
    isProduction: false // Mude para true em produção
};

let refreshTimer = null;
let secondsSinceLastRefresh = 0;

export function initAds() {
    console.log("Inicializando módulo de anúncios (Layout 3 Colunas)...");

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startRefreshLoop();
    loadAdsInitial();
}

/**
 * Carrega os anúncios pela primeira vez.
 */
function loadAdsInitial() {
    ADS_CONFIG.slots.forEach(slot => {
        const el = document.getElementById(slot.id);
        
        // Se o elemento não existe no DOM (ex: mobile ocultando laterais), ignora
        if (!el) return;

        if (ADS_CONFIG.isProduction) {
            // (window.adsbygoogle = window.adsbygoogle || []).push({});
            el.classList.add('ad-loaded');
        } else {
            // Placeholder Dev Mode
            // Pequeno delay para simular carregamento assíncrono
            setTimeout(() => {
                const dims = getDimensionsByType(slot.type);
                el.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full w-full bg-gray-100 text-gray-400 text-[10px] p-2 text-center select-none cursor-default">
                        <span class="font-bold mb-1 text-gray-500">AD SPACE</span>
                        <span class="text-[9px] uppercase tracking-wider mb-1">${slot.type}</span>
                        <span class="font-mono text-gray-600 bg-gray-200 px-2 py-0.5 rounded">
                            Refresh: <span id="timer-${slot.id}">0</span>s
                        </span>
                    </div>
                `;
                el.classList.add('ad-loaded');
            }, 300); 
        }
    });
}

/**
 * Loop principal de refresh.
 */
function startRefreshLoop() {
    refreshTimer = setInterval(() => {
        if (document.hidden) return;

        secondsSinceLastRefresh++;

        if (!ADS_CONFIG.isProduction) updateDevTimers(secondsSinceLastRefresh);

        if (secondsSinceLastRefresh * 1000 >= ADS_CONFIG.refreshInterval) {
            refreshSlots();
            secondsSinceLastRefresh = 0;
        }
    }, 1000);
}

/**
 * Refresh apenas nos slots visíveis.
 */
function refreshSlots() {
    // console.log("ADS: Refresh cycle triggered.");
    
    ADS_CONFIG.slots.forEach(slot => {
        const el = document.getElementById(slot.id);
        
        if (isElementInViewport(el)) {
            if (ADS_CONFIG.isProduction) {
                // Refresh logic real (GPT/AdSense)
            } else {
                // Feedback visual de refresh
                const timerDisplay = document.getElementById(`timer-${slot.id}`);
                if (timerDisplay) {
                    const parent = timerDisplay.parentElement;
                    const originalBg = parent.className;
                    
                    // Pisca verde
                    parent.className = "font-mono text-white bg-green-500 px-2 py-0.5 rounded transition-colors duration-300";
                    timerDisplay.textContent = "OK";
                    
                    setTimeout(() => { 
                        if(parent) {
                            parent.className = "font-mono text-gray-600 bg-gray-200 px-2 py-0.5 rounded transition-colors duration-500";
                            timerDisplay.textContent = "0";
                        }
                    }, 1000);
                }
            }
        }
    });
}

function handleVisibilityChange() {
    // Lógica opcional para forçar refresh ao voltar para aba após muito tempo
}

// Helpers
function isElementInViewport(el) {
    if (!el) return false;
    if (el.offsetParent === null) return false; // Elemento oculto (display:none)

    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

function updateDevTimers(seconds) {
    ADS_CONFIG.slots.forEach(slot => {
        const el = document.getElementById(`timer-${slot.id}`);
        if (el) el.textContent = seconds;
    });
}

function getDimensionsByType(type) {
    switch(type) {
        case 'leaderboard': return '728x90';
        case 'skyscraper': return '160x600';
        case 'rect': return '300x600';
        default: return 'Ad';
    }
}