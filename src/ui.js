/**
 * src/ui.js
 * Controlador principal da Interface de Usuário.
 * Versão Final: Alinhamento Visual Corrigido (Estratégia de Espaçadores).
 */

import db from './db.js';
import * as Logic from './logic.js';

// ==========================================
// UTILITÁRIOS
// ==========================================

const getLocalISODate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// ==========================================
// ESTADO
// ==========================================

const state = {
    currentDate: getLocalISODate(),
    records: [],
    searchDebounce: null,
    collabSearchDebounce: null,
    sentNotifications: new Set(),
    darkMode: localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
};

// Elementos DOM
const elements = {
    headerDate: document.getElementById('header-date'),
    headerTime: document.getElementById('header-time'),
    btnOpenManual: document.getElementById('btn-open-manual'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    iconTheme: document.getElementById('icon-theme'),
    
    inputSearch: document.getElementById('input-search'),
    btnOpenRegister: document.getElementById('btn-open-register'),
    btnOpenCollaborators: document.getElementById('btn-open-collaborators'),
    
    tableBody: document.getElementById('table-body'),
    emptyState: document.getElementById('empty-state'),
    notificationContainer: document.getElementById('notification-container'),
    
    // Modais
    modalRegister: document.getElementById('modal-register'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    inputRegName: document.getElementById('reg-name'),
    selectRegProfile: document.getElementById('reg-profile'),
    inputRegEntry: document.getElementById('reg-entry'),
    btnSaveRegister: document.getElementById('btn-save-register'),
    btnCancelRegister: document.getElementById('btn-cancel-register'),
    
    modalCollaborators: document.getElementById('modal-collaborators'),
    btnCloseCollab: document.getElementById('btn-close-collab'),
    inputSearchCollabModal: document.getElementById('input-search-collab-modal'),
    collaboratorsList: document.getElementById('collaborators-list'),

    modalManual: document.getElementById('modal-manual'),
    btnCloseManual: document.getElementById('btn-close-manual'),
    
    modalInfo: document.getElementById('modal-info'),
    infoName: document.getElementById('info-name'),
    infoContent: document.getElementById('info-content'),
    btnCloseInfo: document.getElementById('btn-close-info'),
    btnCloseInfoX: document.getElementById('btn-close-info-x'),

    modalConfirm: document.getElementById('modal-confirm'),
    confirmMessage: document.getElementById('confirm-message'),
    btnConfirmYes: document.getElementById('btn-confirm-yes'),
    btnConfirmNo: document.getElementById('btn-confirm-no')
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================

export async function init() {
    console.log("Inicializando UI SHIFT...");
    
    applyTheme(state.darkMode);
    startClock();

    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    try {
        await db.init();
        checkDayChangeLoop();
        await loadDailyRecords();
        setupEventListeners();
        startTimeLoop();

    } catch (error) {
        console.error("Falha fatal:", error);
    }
}

// ==========================================
// DARK MODE LOGIC
// ==========================================

function toggleDarkMode() {
    state.darkMode = !state.darkMode;
    localStorage.setItem('theme', state.darkMode ? 'dark' : 'light');
    applyTheme(state.darkMode);
}

function applyTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        if (elements.iconTheme) elements.iconTheme.classList.replace('ph-moon', 'ph-sun');
    } else {
        document.documentElement.classList.remove('dark');
        if (elements.iconTheme) elements.iconTheme.classList.replace('ph-sun', 'ph-moon');
    }
}

// ==========================================
// RELÓGIO & DATA
// ==========================================

function startClock() {
    const update = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase().replace('.', '');
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (elements.headerDate) elements.headerDate.textContent = dateStr;
        if (elements.headerTime) elements.headerTime.textContent = timeStr;
    };
    update();
    setInterval(update, 1000);
}

function checkDayChangeLoop() {
    setInterval(() => {
        const realToday = getLocalISODate();
        if (realToday !== state.currentDate) {
            state.currentDate = realToday;
            state.records = [];
            loadDailyRecords();
        }
    }, 60000);
}

// ==========================================
// TABELA
// ==========================================

async function loadDailyRecords() {
    state.records = await db.getDailyRecords(state.currentDate);
    renderTable();
}

function renderTable() {
    elements.tableBody.innerHTML = '';
    if (state.records.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }
    elements.emptyState.classList.add('hidden');

    state.records.forEach(record => {
        const row = createRow(record);
        elements.tableBody.appendChild(row);
        const schedule = Logic.calculateSchedule(record, record.profile_data);
        updateRowVisuals(row, schedule);
        checkNotifications(record, schedule);
    });
}

function createRow(record) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group';
    tr.dataset.id = record.id;
    tr.recordData = record;

    const times = record.times || {};

    // ESTRUTURA UNIFICADA PARA ALINHAMENTO PERFEITO
    // Todas as colunas de horário agora têm:
    // 1. Um container flex vertical centralizado (sem h-full para não esticar errado)
    // 2. O elemento principal (Input ou Texto)
    // 3. Um espaçador inferior com min-height fixa (14px) para garantir que todos tenham "2 andares"
    
    const cellWrapperClass = "flex flex-col items-center justify-center py-1";
    const spacerClass = "text-[10px] mt-0.5 min-h-[14px] leading-tight"; // Garante altura mesmo vazio

    tr.innerHTML = `
        <td class="px-2 align-middle border-b border-gray-100 dark:border-gray-700">
            <button class="btn-info text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 p-1 rounded hover:bg-brand-50 dark:hover:bg-brand-900 transition flex items-center justify-center mx-auto">
                <i class="ph ph-info text-xl"></i>
            </button>
        </td>

        <td class="px-3 align-middle text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px] border-b border-gray-100 dark:border-gray-700" title="${record.collaborator_name}">
            ${record.collaborator_name}
        </td>

        <td class="px-2 align-middle border-b border-gray-100 dark:border-gray-700">
            <div class="${cellWrapperClass}">
                <span class="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">${record.profile_name}</span>
                <div class="${spacerClass}"></div> 
            </div>
        </td>

        <td class="px-2 align-middle border-b border-gray-100 dark:border-gray-700">
            <div class="${cellWrapperClass}">
                <input type="time" class="table-input inp-entry dark:text-white" value="${times.entry || ''}">
                <div class="${spacerClass}"></div> </div>
        </td>

        <td class="px-2 align-middle border-b border-gray-100 dark:border-gray-700">
            <div class="${cellWrapperClass}">
                <input type="time" class="table-input inp-lunch-out dark:text-white" value="${times.lunch_out || ''}">
                <div class="cell-lunch-status ${spacerClass}"></div>
            </div>
        </td>

        <td class="px-2 align-middle border-b border-gray-100 dark:border-gray-700">
            <div class="${cellWrapperClass}">
                <input type="time" class="table-input inp-lunch-in dark:text-white" value="${times.lunch_in || ''}">
                <div class="cell-lunch-duration ${spacerClass} text-gray-400 dark:text-gray-500"></div>
            </div>
        </td>

        <td class="px-2 align-middle border-b border-gray-100 dark:border-gray-700">
             <div class="${cellWrapperClass}">
                 <div class="cell-exit-range text-xs font-medium text-gray-700 dark:text-gray-300 h-[29px] flex items-center">--:--</div> <div class="cell-exit-limit ${spacerClass} text-gray-400 dark:text-gray-500"></div>
             </div>
        </td>

        <td class="px-3 align-middle border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div class="${cellWrapperClass}">
                <div class="flex items-center h-[29px]"> <span class="cell-worked font-medium text-gray-600 dark:text-gray-400">--:--</span>
                    <span class="cell-alerts inline-block ml-1"></span>
                </div>
                <div class="cell-worked-remaining ${spacerClass}"></div>
            </div>
        </td>
    `;
    attachRowEvents(tr);
    return tr;
}

function updateRowVisuals(tr, schedule) {
    if (!schedule) return;

    // 1. Lunch Status
    const elLunchStatus = tr.querySelector('.cell-lunch-status');
    if (schedule.lunchStatusText) {
        elLunchStatus.textContent = schedule.lunchStatusText;
        elLunchStatus.className = schedule.isLunchViolation 
            ? 'cell-lunch-status text-[10px] mt-0.5 min-h-[14px] leading-tight text-red-600 dark:text-red-400 font-bold' 
            : 'cell-lunch-status text-[10px] mt-0.5 min-h-[14px] leading-tight text-brand-600 dark:text-brand-400';
    } else { elLunchStatus.textContent = ''; }

    // 2. Lunch Duration
    const elLunchDur = tr.querySelector('.cell-lunch-duration');
    elLunchDur.textContent = schedule.lunchDuration ? `(${schedule.lunchDuration})` : '';

    // 3. Exit Range
    const elExitRange = tr.querySelector('.cell-exit-range');
    const elExitLimit = tr.querySelector('.cell-exit-limit');
    if (schedule.exitRangeText) {
        elExitRange.textContent = schedule.exitRangeText;
        elExitLimit.textContent = "Recomendado";
    } else {
        elExitRange.textContent = "--:--";
        elExitLimit.textContent = "";
    }

    // 4. Worked
    const elWorked = tr.querySelector('.cell-worked');
    elWorked.textContent = schedule.workedCurrent;
    
    if (schedule.workStatusType === 'exceeded') elWorked.className = 'cell-worked font-bold text-red-600 dark:text-red-400';
    else if (schedule.workStatusType === 'extra') elWorked.className = 'cell-worked font-bold text-orange-500 dark:text-orange-400';
    else if (schedule.isSimulated) elWorked.className = 'cell-worked font-bold text-brand-600 dark:text-brand-400';
    else elWorked.className = 'cell-worked font-medium text-gray-600 dark:text-gray-400';

    // 5. Remaining
    const elRemaining = tr.querySelector('.cell-worked-remaining');
    if (schedule.workRemainingText) {
        elRemaining.textContent = schedule.workRemainingText;
        if (schedule.workStatusType === 'exceeded') elRemaining.className = 'cell-worked-remaining text-[10px] mt-0.5 min-h-[14px] leading-tight text-red-600 dark:text-red-400 font-bold';
        else if (schedule.workStatusType === 'extra') elRemaining.className = 'cell-worked-remaining text-[10px] mt-0.5 min-h-[14px] leading-tight text-orange-500 dark:text-orange-400 font-bold';
        else elRemaining.className = 'cell-worked-remaining text-[10px] mt-0.5 min-h-[14px] leading-tight text-gray-400 dark:text-gray-500';
    } else { elRemaining.textContent = ''; }

    // 6. Alerts
    const elAlerts = tr.querySelector('.cell-alerts');
    if (schedule.alerts && schedule.alerts.length > 0) {
        const hasDanger = schedule.alerts.some(a => a.type === 'danger');
        const color = hasDanger ? 'text-red-500' : 'text-yellow-500';
        const titles = schedule.alerts.map(a => a.message).join('\n');
        elAlerts.innerHTML = `<i class="ph ph-warning ${color} text-lg cursor-help" title="${titles}"></i>`;
    } else { elAlerts.innerHTML = ''; }
}

// ==========================================
// NOTIFICATIONS & TOASTS
// ==========================================

function checkNotifications(record, schedule) {
    const trigger = schedule.notificationTrigger;
    if (!trigger) return;

    const key = `${record.id}_${trigger}`;
    if (state.sentNotifications.has(key)) return;

    if (trigger === 'warning_10min') {
        sendNotification(`⚠️ Atenção: ${record.collaborator_name}`, `Faltam 10 minutos para o limite máximo de horas extras.`, 'warning');
    } else if (trigger === 'warning_critical') {
        sendNotification(`🚨 CRÍTICO: ${record.collaborator_name}`, `Limite de horas extras atingido ou prestes a estourar!`, 'danger');
    }
    state.sentNotifications.add(key);
}

function sendNotification(title, body, type = 'info') {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(title, { body: body, icon: 'assets/icons/icon-192.png', tag: 'shift-alert' });
    }
    createToast(title, body, type);
}

function createToast(title, body, type) {
    const container = elements.notificationContainer;
    if (!container) return;

    const toast = document.createElement('div');
    let bgClass = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    let iconClass = 'text-brand-500 dark:text-brand-400';
    let iconName = 'info';

    if (type === 'warning') {
        bgClass = 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700';
        iconClass = 'text-yellow-600 dark:text-yellow-400';
        iconName = 'warning';
    } else if (type === 'danger') {
        bgClass = 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700';
        iconClass = 'text-red-600 dark:text-red-400';
        iconName = 'warning-circle';
    }

    toast.className = `transform transition-all duration-300 translate-x-full opacity-0 flex items-start p-4 mb-2 rounded-lg shadow-lg border ${bgClass} w-full pointer-events-auto`;
    toast.innerHTML = `
        <div class="flex-shrink-0"><i class="ph ph-${iconName} text-xl ${iconClass}"></i></div>
        <div class="ml-3 w-0 flex-1 pt-0.5">
            <p class="text-sm font-bold text-gray-900 dark:text-gray-100">${title}</p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">${body}</p>
        </div>
        <div class="ml-4 flex-shrink-0 flex">
            <button class="inline-flex text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none">
                <i class="ph ph-x text-lg"></i>
            </button>
        </div>
    `;

    toast.querySelector('button').onclick = () => toast.remove();
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }
    }, 10000);
}

// ==========================================
// SEARCH & MODAIS
// ==========================================

function showSearchResults(results, query) {
    closeSearchResults();
    const container = document.createElement('div');
    container.id = 'search-results';
    container.className = 'absolute top-full left-0 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-lg rounded-lg mt-1 z-50 max-h-60 overflow-y-auto';

    if (results.length === 0) {
        const item = document.createElement('div');
        item.className = 'px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-brand-600 dark:text-brand-400 font-medium flex items-center gap-2';
        item.innerHTML = `<i class="ph ph-plus"></i> Registrar "${query}"`;
        item.onclick = () => { closeSearchResults(); openRegisterModal(query); };
        container.appendChild(item);
    } else {
        results.forEach(collab => {
            const item = document.createElement('div');
            item.className = 'px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:text-brand-600 dark:hover:text-brand-400';
            item.textContent = collab.name;
            item.onclick = () => addToDaily(collab);
            container.appendChild(item);
        });
    }
    elements.inputSearch.parentElement.appendChild(container);
    document.addEventListener('click', function close(e) {
        if (!elements.inputSearch.contains(e.target) && !container.contains(e.target)) {
            closeSearchResults();
            document.removeEventListener('click', close);
        }
    });
}

async function loadCollaboratorsList(query) {
    let results = query ? await db.searchCollaborators(query) : await db.searchCollaborators('');
    const list = elements.collaboratorsList;
    list.innerHTML = '';
    if (results.length === 0) {
        list.innerHTML = '<div class="p-4 text-center text-gray-400 text-sm">Nenhum colaborador encontrado.</div>';
        return;
    }
    results.forEach(collab => {
        const div = document.createElement('div');
        div.className = 'px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0';
        div.innerHTML = `
            <div>
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${collab.name}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Perfil: 6x1</div>
            </div>
            <button class="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors p-2 rounded-full hover:bg-brand-50 dark:hover:bg-brand-900" title="Ver Informações">
                <i class="ph ph-info text-xl"></i>
            </button>
        `;
        const btn = div.querySelector('button');
        btn.onclick = async () => {
            let record = state.records.find(r => r.collaborator_id === collab.id);
            if (!record) {
                record = {
                    collaborator_id: collab.id,
                    collaborator_name: collab.name,
                    profile_name: '6x1',
                    profile_data: await db.getProfileById(collab.profile_id),
                    times: {}
                };
            }
            openInfoModal(record);
        };
        list.appendChild(div);
    });
}

async function openInfoModal(record) {
    elements.infoName.textContent = record.collaborator_name;
    const history = await db.getHistory(record.collaborator_id, 5);
    const schedule = Logic.calculateSchedule(record, record.profile_data);

    let html = `
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4 text-left border border-gray-100 dark:border-gray-600">
            <h4 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-2">
                <i class="ph ph-calendar-today"></i> Resumo de Hoje
            </h4>
            <div class="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div><span class="text-gray-500 dark:text-gray-400 block text-xs">Jornada</span> <strong class="text-gray-900 dark:text-white">${record.profile_name}</strong></div>
                <div><span class="text-gray-500 dark:text-gray-400 block text-xs">Trabalhado</span> <strong class="text-gray-900 dark:text-white">${schedule.workedCurrent}</strong></div>
                <div><span class="text-gray-500 dark:text-gray-400 block text-xs">Almoço</span> <strong class="text-gray-900 dark:text-white">${schedule.lunchDuration || '--'}</strong></div>
                <div><span class="text-gray-500 dark:text-gray-400 block text-xs">Faixa Est.</span> <strong class="text-gray-900 dark:text-white">${schedule.exitRangeText || '--:--'}</strong></div>
            </div>
            ${renderAlertsList(schedule.alerts)}
        </div>
        <h4 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 text-left flex items-center gap-2 mt-6">
            <i class="ph ph-clock-counter-clockwise"></i> Histórico Recente
        </h4>
        <div class="overflow-hidden border border-gray-200 dark:border-gray-600 rounded-lg">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600 text-xs">
                <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Data</th>
                        <th class="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Entrada</th>
                        <th class="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Saída</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
    `;
    const validHistory = history.filter(h => h.date !== state.currentDate);
    if (validHistory.length === 0) {
        html += `<tr><td colspan="3" class="px-3 py-4 text-center text-gray-400">Nenhum histórico anterior disponível.</td></tr>`;
    } else {
        validHistory.forEach(h => {
            const exitTime = h.times.exit_time_real || h.times.exit_estimated || '--:--';
            const dateStr = h.date.split('-').reverse().join('/');
            html += `<tr><td class="px-3 py-2 text-gray-900 dark:text-gray-200 font-medium">${dateStr}</td><td class="px-3 py-2 text-center text-gray-600 dark:text-gray-400">${h.times.entry || '--'}</td><td class="px-3 py-2 text-center text-gray-600 dark:text-gray-400">${exitTime}</td></tr>`;
        });
    }
    html += `</tbody></table></div>`;
    elements.infoContent.innerHTML = html;
    elements.modalInfo.classList.remove('hidden');
    elements.modalBackdrop.classList.remove('hidden');
}

// ==========================================
// HELPERS & EVENTS
// ==========================================

function setupEventListeners() {
    elements.btnThemeToggle.addEventListener('click', toggleDarkMode);

    elements.inputSearch.addEventListener('input', (e) => {
        const query = e.target.value;
        if (state.searchDebounce) clearTimeout(state.searchDebounce);
        state.searchDebounce = setTimeout(async () => {
            if (query.length < 2) { closeSearchResults(); return; }
            const results = await db.searchCollaborators(query);
            showSearchResults(results, query);
        }, 300);
    });

    elements.btnOpenRegister.addEventListener('click', () => openRegisterModal(elements.inputSearch.value));
    elements.btnOpenCollaborators.addEventListener('click', openCollaboratorsModal);
    elements.btnOpenManual.addEventListener('click', () => { elements.modalManual.classList.remove('hidden'); elements.modalBackdrop.classList.remove('hidden'); });

    elements.btnSaveRegister.addEventListener('click', handleSaveRegister);
    elements.btnCancelRegister.addEventListener('click', closeRegisterModal);
    
    elements.btnCloseInfo.addEventListener('click', closeInfoModal);
    elements.btnCloseInfoX.addEventListener('click', closeInfoModal);
    
    elements.btnCloseCollab.addEventListener('click', () => { elements.modalCollaborators.classList.add('hidden'); if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden'); });
    elements.inputSearchCollabModal.addEventListener('input', (e) => { const query = e.target.value; if (state.collabSearchDebounce) clearTimeout(state.collabSearchDebounce); state.collabSearchDebounce = setTimeout(() => loadCollaboratorsList(query), 300); });
    elements.btnCloseManual.addEventListener('click', () => { elements.modalManual.classList.add('hidden'); if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden'); });
}

function hasOtherModalsOpen() { return !elements.modalRegister.classList.contains('hidden') || !elements.modalInfo.classList.contains('hidden') || !elements.modalConfirm.classList.contains('hidden'); }
function closeSearchResults() { const el = document.getElementById('search-results'); if (el) el.remove(); }
async function addToDaily(collab) { closeSearchResults(); elements.inputSearch.value = ''; const exists = state.records.find(r => r.collaborator_id === collab.id); if (exists) { showConfirmModal("Aviso", "Este colaborador já está na lista de hoje.", null, true); return; } const newRecord = { collaborator_id: collab.id, date: state.currentDate, times: {}, status: 'working' }; await db.saveDailyRecord(newRecord); loadDailyRecords(); }
function openRegisterModal(nameValue = '') { elements.inputRegName.value = nameValue; elements.inputRegEntry.value = ''; elements.selectRegProfile.value = '1'; elements.modalRegister.classList.remove('hidden'); elements.modalBackdrop.classList.remove('hidden'); setTimeout(() => elements.inputRegName.focus(), 100); }
function closeRegisterModal() { elements.modalRegister.classList.add('hidden'); if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden'); }
async function handleSaveRegister() { const name = elements.inputRegName.value.trim(); const profileId = elements.selectRegProfile.value; const entryTime = elements.inputRegEntry.value; if (!name) { showConfirmModal("Erro", "Nome é obrigatório", null, true); return; } try { const newId = await db.addCollaborator(name, profileId); const newRecord = { collaborator_id: newId, date: state.currentDate, times: {}, status: 'working' }; if (entryTime) newRecord.times.entry = entryTime; await db.saveDailyRecord(newRecord); closeRegisterModal(); elements.inputSearch.value = ''; loadDailyRecords(); } catch (e) { console.error(e); showConfirmModal("Erro", "Falha ao salvar registro.", null, true); } }
function closeInfoModal() { elements.modalInfo.classList.add('hidden'); if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden'); }
function renderAlertsList(alerts) { if (!alerts || alerts.length === 0) return ''; let html = '<div class="mt-3 space-y-1">'; alerts.forEach(a => { const colorClass = a.type === 'danger' ? 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800' : 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-800'; html += `<div class="${colorClass} px-2 py-1.5 rounded text-xs flex items-center gap-2"><i class="ph ph-warning-circle"></i> ${a.message}</div>`; }); html += '</div>'; return html; }
function showConfirmModal(title, message, onConfirm, isAlertOnly = false, onCancel = null) { elements.confirmMessage.textContent = message; elements.modalConfirm.classList.remove('hidden'); elements.modalBackdrop.classList.remove('hidden'); const btnYes = elements.btnConfirmYes; const btnNo = elements.btnConfirmNo; const newYes = btnYes.cloneNode(true); const newNo = btnNo.cloneNode(true); btnYes.parentNode.replaceChild(newYes, btnYes); btnNo.parentNode.replaceChild(newNo, btnNo); elements.btnConfirmYes = newYes; elements.btnConfirmNo = newNo; if (isAlertOnly) { newYes.textContent = "OK"; newNo.classList.add('hidden'); newYes.onclick = () => { elements.modalConfirm.classList.add('hidden'); if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden'); if (onConfirm) onConfirm(); }; } else { newYes.textContent = "Confirmar"; newNo.classList.remove('hidden'); newYes.onclick = () => { elements.modalConfirm.classList.add('hidden'); if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden'); if (onConfirm) onConfirm(); }; newNo.onclick = () => { elements.modalConfirm.classList.add('hidden'); if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden'); if (onCancel) onCancel(); }; } }
function attachRowEvents(tr) { const record = tr.recordData; const inputs = { entry: tr.querySelector('.inp-entry'), lunch_out: tr.querySelector('.inp-lunch-out'), lunch_in: tr.querySelector('.inp-lunch-in') }; const handleInput = (field, value) => { if (!record.times) record.times = {}; if (value) record.times[field] = value; else delete record.times[field]; const schedule = Logic.calculateSchedule(record, record.profile_data); updateRowVisuals(tr, schedule); checkNotifications(record, schedule); }; const handleSave = async () => { await db.saveDailyRecord(record); }; Object.keys(inputs).forEach(key => { const input = inputs[key]; if(!input) return; input.addEventListener('input', (e) => handleInput(key, e.target.value)); input.addEventListener('change', async (e) => { const value = e.target.value; if (key === 'lunch_in' && value) { const validation = Logic.validateLunchReturn(record.times.lunch_out, value, record.profile_data); if (!validation.valid) { showConfirmModal("Erro", validation.message, null, true); e.target.value = ''; handleInput(key, ''); return; } if (validation.warning) { showConfirmModal("Atenção", validation.message, async () => { await handleSave(); }, false, () => { e.target.value = ''; handleInput(key, ''); }); return; } } await handleSave(); }); }); tr.querySelector('.btn-info').addEventListener('click', () => openInfoModal(record)); }
function startTimeLoop() { setInterval(() => { const rows = document.querySelectorAll('#table-body tr'); rows.forEach(tr => { const record = tr.recordData; if (record) { const schedule = Logic.calculateSchedule(record, record.profile_data); updateRowVisuals(tr, schedule); checkNotifications(record, schedule); } }); }, 60000); }