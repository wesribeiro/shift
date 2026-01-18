/**
 * src/ui.js
 * Controlador principal da Interface de Usuário (View Controller).
 * Versão Final: Layout 3 Colunas + Relógio + Modais Extras.
 */

import db from './db.js';
import * as Logic from './logic.js';

// ==========================================
// ESTADO E CACHE
// ==========================================

const state = {
    currentDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    records: [], // Lista atual de registros do dia
    searchDebounce: null,
    collabSearchDebounce: null // Debounce específico para o modal de colaboradores
};

// Elementos DOM
const elements = {
    // Header & Relógio
    headerDate: document.getElementById('header-date'),
    headerTime: document.getElementById('header-time'),
    btnOpenManual: document.getElementById('btn-open-manual'),
    
    // Área de Ação Principal
    inputSearch: document.getElementById('input-search'),
    btnOpenRegister: document.getElementById('btn-open-register'),
    btnOpenCollaborators: document.getElementById('btn-open-collaborators'),
    
    // Tabela
    tableBody: document.getElementById('table-body'),
    emptyState: document.getElementById('empty-state'),
    
    // Modal Register
    modalRegister: document.getElementById('modal-register'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    inputRegName: document.getElementById('reg-name'),
    selectRegProfile: document.getElementById('reg-profile'),
    inputRegEntry: document.getElementById('reg-entry'),
    btnSaveRegister: document.getElementById('btn-save-register'),
    btnCancelRegister: document.getElementById('btn-cancel-register'),
    
    // Modal Colaboradores (Novo)
    modalCollaborators: document.getElementById('modal-collaborators'),
    btnCloseCollab: document.getElementById('btn-close-collab'),
    inputSearchCollabModal: document.getElementById('input-search-collab-modal'),
    collaboratorsList: document.getElementById('collaborators-list'),

    // Modal Manual (Novo)
    modalManual: document.getElementById('modal-manual'),
    btnCloseManual: document.getElementById('btn-close-manual'),
    
    // Modal Info
    modalInfo: document.getElementById('modal-info'),
    infoName: document.getElementById('info-name'),
    infoContent: document.getElementById('info-content'),
    btnCloseInfo: document.getElementById('btn-close-info'),
    btnCloseInfoX: document.getElementById('btn-close-info-x'),

    // Modal Confirm
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
    
    // 1. Iniciar Relógio (Header)
    startClock();

    // 2. Inicializar Banco de Dados
    try {
        await db.init();
        
        // 3. Carregar registros do dia
        await loadDailyRecords();
        
        // 4. Configurar Listeners Globais
        setupEventListeners();
        
        // 5. Iniciar loop de atualização de tempo (para contadores da tabela)
        startTimeLoop();

    } catch (error) {
        console.error("Falha fatal na inicialização:", error);
        alert("Erro ao carregar banco de dados. Por favor, recarregue a página.");
    }
}

// ==========================================
// RELÓGIO (HEADER)
// ==========================================

function startClock() {
    const update = () => {
        const now = new Date();
        // Data: SEG, 18 JAN
        const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
                           .toUpperCase()
                           .replace('.', ''); // Remove ponto final de abreviação se houver
        
        // Hora: 17:05
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (elements.headerDate) elements.headerDate.textContent = dateStr;
        if (elements.headerTime) elements.headerTime.textContent = timeStr;
    };
    
    update(); // Primeira chamada imediata
    setInterval(update, 1000); // Atualiza a cada segundo
}

// ==========================================
// CORE: CARREGAMENTO E RENDERIZAÇÃO
// ==========================================

async function loadDailyRecords() {
    state.records = await db.getDailyRecords(state.currentDate);
    renderTable();
}

function renderTable() {
    // Limpa a tabela atual
    elements.tableBody.innerHTML = '';

    if (state.records.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');

    state.records.forEach(record => {
        const row = createRow(record);
        elements.tableBody.appendChild(row);
        
        // Calcula e aplica o estado visual inicial
        const schedule = Logic.calculateSchedule(record, record.profile_data);
        updateRowVisuals(row, schedule);
    });
}

/**
 * Cria o elemento TR para um registro.
 */
function createRow(record) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors group'; // Group para hover styling
    tr.dataset.id = record.id;
    
    // Vincula o dado à linha (DOM Property)
    tr.recordData = record;

    const times = record.times || {};

    tr.innerHTML = `
        <td class="px-3 py-3 whitespace-nowrap text-center border-b border-gray-100">
            <button class="btn-info text-brand-600 hover:text-brand-800 p-1 rounded hover:bg-brand-50 transition" title="Detalhes">
                <i class="ph ph-info text-xl"></i>
            </button>
        </td>
        <td class="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-[150px] border-b border-gray-100" title="${record.collaborator_name}">
            ${record.collaborator_name}
        </td>
        <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500 text-center border-b border-gray-100">
            <span class="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 border border-gray-200">${record.profile_name}</span>
        </td>
        
        <td class="px-2 py-3 whitespace-nowrap text-center border-b border-gray-100">
            <input type="time" class="table-input inp-entry" value="${times.entry || ''}">
        </td>
        
        <td class="px-2 py-3 whitespace-nowrap text-center relative border-b border-gray-100">
            <input type="time" class="table-input inp-lunch-out" value="${times.lunch_out || ''}">
            <div class="cell-lunch-status text-xs mt-1 min-h-[16px]"></div>
        </td>
        
        <td class="px-2 py-3 whitespace-nowrap text-center border-b border-gray-100">
            <input type="time" class="table-input inp-lunch-in" value="${times.lunch_in || ''}">
            <div class="cell-lunch-duration text-xs text-gray-400 mt-1 min-h-[16px]"></div>
        </td>
        
        <td class="px-2 py-3 whitespace-nowrap text-center border-b border-gray-100">
             <input type="time" class="table-input inp-exit-sim font-bold text-gray-900" 
                    value="${times.exit_time_real || ''}">
             <div class="cell-estimated-exit text-xs text-gray-500 mt-1 min-h-[16px]"></div>
        </td>
        
        <td class="px-3 py-3 whitespace-nowrap text-center text-sm border-b border-gray-100 bg-gray-50/50">
            <div class="flex flex-col items-center justify-center">
                <div class="flex items-center">
                    <span class="cell-worked font-medium text-gray-600">--:--</span>
                    <span class="cell-alerts inline-block ml-1"></span>
                </div>
                <div class="cell-worked-remaining text-[10px] mt-0.5 min-h-[14px]"></div>
            </div>
        </td>
    `;

    attachRowEvents(tr);
    return tr;
}

/**
 * Atualiza APENAS o visual (Textos, Cores) da linha.
 */
function updateRowVisuals(tr, schedule) {
    if (!schedule) return;

    // 1. Status do Almoço
    const elLunchStatus = tr.querySelector('.cell-lunch-status');
    if (schedule.lunchStatusText) {
        elLunchStatus.textContent = schedule.lunchStatusText;
        if (schedule.isLunchViolation) {
            elLunchStatus.className = 'cell-lunch-status text-xs mt-1 text-red-600 font-bold';
        } else {
            elLunchStatus.className = 'cell-lunch-status text-xs mt-1 text-brand-600';
        }
    } else {
        elLunchStatus.textContent = '';
    }

    // 2. Duração Almoço
    const elLunchDur = tr.querySelector('.cell-lunch-duration');
    elLunchDur.textContent = schedule.lunchDuration ? `(${schedule.lunchDuration})` : '';

    // 3. Saída Estimada
    const inpExit = tr.querySelector('.inp-exit-sim');
    const elEstExit = tr.querySelector('.cell-estimated-exit');

    if (!inpExit.value) {
        inpExit.setAttribute('placeholder', schedule.estimatedExit || '--:--');
    }

    if (schedule.isSimulated) {
        elEstExit.textContent = 'Simulado';
        elEstExit.className = 'cell-estimated-exit text-xs mt-1 text-brand-600 font-semibold';
    } else if (schedule.estimatedExit) {
        elEstExit.textContent = `Est: ${schedule.estimatedExit}`;
        elEstExit.className = 'cell-estimated-exit text-xs mt-1 text-gray-500';
    } else {
        elEstExit.textContent = '';
    }

    // 4. Trabalhado (Principal)
    const elWorked = tr.querySelector('.cell-worked');
    elWorked.textContent = schedule.workedCurrent;
    
    if (schedule.isSimulated) {
        elWorked.className = 'cell-worked font-bold text-brand-600';
    } else {
        elWorked.className = 'cell-worked font-medium text-gray-600';
    }

    // 5. Trabalhado (Restante/Extra)
    const elRemaining = tr.querySelector('.cell-worked-remaining');
    if (schedule.workRemainingText) {
        elRemaining.textContent = schedule.workRemainingText;
        
        // Estilização condicional baseada no texto
        if (schedule.workRemainingText.includes('Extra')) {
            elRemaining.className = 'cell-worked-remaining text-[10px] mt-0.5 text-orange-600 font-bold';
        } else {
            elRemaining.className = 'cell-worked-remaining text-[10px] mt-0.5 text-gray-400 font-medium';
        }
    } else {
        elRemaining.textContent = '';
    }

    // 6. Alertas
    const elAlerts = tr.querySelector('.cell-alerts');
    if (schedule.alerts && schedule.alerts.length > 0) {
        const hasDanger = schedule.alerts.some(a => a.type === 'danger');
        const color = hasDanger ? 'text-red-500' : 'text-yellow-500';
        const titles = schedule.alerts.map(a => a.message).join('\n');
        elAlerts.innerHTML = `<i class="ph ph-warning ${color} text-lg cursor-help" title="${titles}"></i>`;
    } else {
        elAlerts.innerHTML = '';
    }
}

// ==========================================
// EVENTOS DE LINHA (Inputs)
// ==========================================

function attachRowEvents(tr) {
    const record = tr.recordData; 
    const inputs = {
        entry: tr.querySelector('.inp-entry'),
        lunch_out: tr.querySelector('.inp-lunch-out'),
        lunch_in: tr.querySelector('.inp-lunch-in'),
        exit_time_real: tr.querySelector('.inp-exit-sim')
    };

    const handleInput = (field, value) => {
        if (!record.times) record.times = {};
        if (value) {
            record.times[field] = value;
        } else {
            delete record.times[field];
        }
        // Recalcula lógica imediatamente
        const schedule = Logic.calculateSchedule(record, record.profile_data);
        updateRowVisuals(tr, schedule);
    };

    const handleSave = async () => {
        await db.saveDailyRecord(record);
    };

    Object.keys(inputs).forEach(key => {
        const input = inputs[key];
        
        // Evento Input: Atualização Visual (sem salvar)
        input.addEventListener('input', (e) => {
            handleInput(key, e.target.value);
        });

        // Evento Change: Persistência e Validação
        input.addEventListener('change', async (e) => {
            const value = e.target.value;
            
            if (key === 'lunch_in' && value) {
                const validation = Logic.validateLunchReturn(
                    record.times.lunch_out, 
                    value, 
                    record.profile_data
                );
                
                if (!validation.valid) {
                    showConfirmModal("Erro", validation.message, null, true);
                    e.target.value = ''; 
                    handleInput(key, '');
                    return;
                }
                
                if (validation.warning) {
                    showConfirmModal("Atenção", validation.message, async () => {
                        await handleSave();
                    }, false, () => {
                        e.target.value = '';
                        handleInput(key, '');
                    });
                    return; 
                }
            }
            await handleSave();
        });
    });

    tr.querySelector('.btn-info').addEventListener('click', () => openInfoModal(record));
}

// ==========================================
// LISTENERS GLOBAIS
// ==========================================

function setupEventListeners() {
    // 1. Busca Principal
    elements.inputSearch.addEventListener('input', (e) => {
        const query = e.target.value;
        if (state.searchDebounce) clearTimeout(state.searchDebounce);
        state.searchDebounce = setTimeout(async () => {
            if (query.length < 2) {
                closeSearchResults();
                return;
            }
            const results = await db.searchCollaborators(query);
            showSearchResults(results, query);
        }, 300);
    });

    // 2. Botões Principais
    elements.btnOpenRegister.addEventListener('click', () => {
        openRegisterModal(elements.inputSearch.value);
    });
    
    // Novo: Botão Colaboradores
    elements.btnOpenCollaborators.addEventListener('click', openCollaboratorsModal);
    
    // Novo: Botão Manual
    elements.btnOpenManual.addEventListener('click', () => {
        elements.modalManual.classList.remove('hidden');
        elements.modalBackdrop.classList.remove('hidden');
    });

    // 3. Modais (Fechar/Salvar)
    elements.btnSaveRegister.addEventListener('click', handleSaveRegister);
    elements.btnCancelRegister.addEventListener('click', closeRegisterModal);
    
    elements.btnCloseInfo.addEventListener('click', closeInfoModal);
    elements.btnCloseInfoX.addEventListener('click', closeInfoModal);
    
    // Novo: Fechar Modal Colaboradores
    elements.btnCloseCollab.addEventListener('click', () => {
        elements.modalCollaborators.classList.add('hidden');
        if (elements.modalBackdrop && !hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden');
    });
    
    // Novo: Busca dentro do Modal Colaboradores
    elements.inputSearchCollabModal.addEventListener('input', (e) => {
        const query = e.target.value;
        if (state.collabSearchDebounce) clearTimeout(state.collabSearchDebounce);
        state.collabSearchDebounce = setTimeout(() => {
            loadCollaboratorsList(query);
        }, 300);
    });

    // Novo: Fechar Modal Manual
    elements.btnCloseManual.addEventListener('click', () => {
        elements.modalManual.classList.add('hidden');
        if (elements.modalBackdrop && !hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden');
    });
}

function hasOtherModalsOpen() {
    // Helper para não fechar o backdrop se tiver outro modal aberto
    return !elements.modalRegister.classList.contains('hidden') || 
           !elements.modalInfo.classList.contains('hidden') ||
           !elements.modalConfirm.classList.contains('hidden');
}

// ==========================================
// LÓGICA DE BUSCA E AUTOCOMPLETE
// ==========================================

function showSearchResults(results, query) {
    closeSearchResults();
    const container = document.createElement('div');
    container.id = 'search-results';
    container.className = 'absolute top-full left-0 w-full bg-white border border-gray-200 shadow-lg rounded-lg mt-1 z-50 max-h-60 overflow-y-auto';

    if (results.length === 0) {
        const item = document.createElement('div');
        item.className = 'px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-brand-600 font-medium flex items-center gap-2';
        item.innerHTML = `<i class="ph ph-plus"></i> Registrar "${query}"`;
        item.onclick = () => {
            closeSearchResults();
            openRegisterModal(query);
        };
        container.appendChild(item);
    } else {
        results.forEach(collab => {
            const item = document.createElement('div');
            item.className = 'px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-0 hover:text-brand-600';
            item.textContent = collab.name;
            item.onclick = () => addToDaily(collab);
            container.appendChild(item);
        });
    }

    elements.inputSearch.parentElement.appendChild(container);
    
    // Listener temporário para fechar ao clicar fora
    document.addEventListener('click', function close(e) {
        if (!elements.inputSearch.contains(e.target) && !container.contains(e.target)) {
            closeSearchResults();
            document.removeEventListener('click', close);
        }
    });
}

function closeSearchResults() {
    const el = document.getElementById('search-results');
    if (el) el.remove();
}

async function addToDaily(collab) {
    closeSearchResults();
    elements.inputSearch.value = '';

    const exists = state.records.find(r => r.collaborator_id === collab.id);
    if (exists) {
        showConfirmModal("Aviso", "Este colaborador já está na lista de hoje.", null, true);
        return;
    }

    const newRecord = {
        collaborator_id: collab.id,
        date: state.currentDate,
        times: {},
        status: 'working'
    };

    await db.saveDailyRecord(newRecord);
    loadDailyRecords();
}

// ==========================================
// MODAL: COLABORADORES (LISTA GERAL)
// ==========================================

async function openCollaboratorsModal() {
    elements.inputSearchCollabModal.value = '';
    elements.modalCollaborators.classList.remove('hidden');
    elements.modalBackdrop.classList.remove('hidden');
    loadCollaboratorsList('');
}

async function loadCollaboratorsList(query) {
    // Usa a mesma função de busca, se query for vazia, deve retornar todos (dependendo da implementação do DB)
    // Se db.searchCollaborators não retornar todos com string vazia, precisamos ajustar.
    // Assumindo que db.searchCollaborators('') retorna todos ou implementamos um getAll
    
    let results = [];
    if (!query) {
        // Se a busca for vazia, precisamos de um método para pegar todos ou buscar por string vazia
        results = await db.searchCollaborators(''); 
    } else {
        results = await db.searchCollaborators(query);
    }

    const list = elements.collaboratorsList;
    list.innerHTML = '';

    if (results.length === 0) {
        list.innerHTML = '<div class="p-4 text-center text-gray-400 text-sm">Nenhum colaborador encontrado.</div>';
        return;
    }

    results.forEach(collab => {
        const div = document.createElement('div');
        div.className = 'px-4 py-3 flex items-center justify-between hover:bg-gray-50';
        
        div.innerHTML = `
            <div>
                <div class="text-sm font-medium text-gray-900">${collab.name}</div>
                <div class="text-xs text-gray-500">Perfil: 6x1</div>
            </div>
            <button class="text-gray-400 hover:text-brand-600 transition-colors p-2 rounded-full hover:bg-brand-50" title="Ver Informações">
                <i class="ph ph-info text-xl"></i>
            </button>
        `;
        
        // Clique no botão info abre o modal de detalhes do colaborador
        // Porem, openInfoModal espera um 'record' (registro do dia).
        // Se quisermos ver info de alguém que NÃO está na lista do dia, precisamos adaptar openInfoModal
        // ou criar um 'dummy record' para visualização.
        
        const btn = div.querySelector('button');
        btn.onclick = async () => {
            // Verifica se tem registro hoje para passar os dados reais
            let record = state.records.find(r => r.collaborator_id === collab.id);
            
            if (!record) {
                // Cria um objeto fake apenas para visualização de histórico
                record = {
                    collaborator_id: collab.id,
                    collaborator_name: collab.name,
                    profile_name: '6x1', // Simplificação, idealmente buscar profile
                    profile_data: await db.getProfileById(collab.profile_id),
                    times: {} // Sem horários hoje
                };
            }
            
            // Fecha lista e abre info
            // elements.modalCollaborators.classList.add('hidden'); // Opcional: Manter aberto atrás?
            // Vamos fechar para focar no info
            // elements.modalCollaborators.classList.add('hidden');
            
            openInfoModal(record);
        };

        list.appendChild(div);
    });
}

// ==========================================
// OUTROS MODAIS (Register, Info, Confirm)
// ==========================================

function openRegisterModal(nameValue = '') {
    elements.inputRegName.value = nameValue;
    elements.inputRegEntry.value = '';
    elements.selectRegProfile.value = '1'; 
    elements.modalRegister.classList.remove('hidden');
    elements.modalBackdrop.classList.remove('hidden');
    setTimeout(() => elements.inputRegName.focus(), 100);
}

function closeRegisterModal() {
    elements.modalRegister.classList.add('hidden');
    if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden');
}

async function handleSaveRegister() {
    const name = elements.inputRegName.value.trim();
    const profileId = elements.selectRegProfile.value;
    const entryTime = elements.inputRegEntry.value;

    if (!name) {
        showConfirmModal("Erro", "Nome é obrigatório", null, true);
        return;
    }

    try {
        const newId = await db.addCollaborator(name, profileId);
        const newRecord = {
            collaborator_id: newId,
            date: state.currentDate,
            times: {},
            status: 'working'
        };

        if (entryTime) {
            newRecord.times.entry = entryTime;
        }

        await db.saveDailyRecord(newRecord);
        closeRegisterModal();
        elements.inputSearch.value = ''; 
        loadDailyRecords();

    } catch (e) {
        console.error(e);
        showConfirmModal("Erro", "Falha ao salvar registro.", null, true);
    }
}

async function openInfoModal(record) {
    elements.infoName.textContent = record.collaborator_name;
    const history = await db.getHistory(record.collaborator_id, 5);
    const schedule = Logic.calculateSchedule(record, record.profile_data);

    let html = `
        <div class="bg-gray-50 p-4 rounded-lg mb-4 text-left border border-gray-100">
            <h4 class="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                <i class="ph ph-calendar-today"></i> Resumo de Hoje
            </h4>
            <div class="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div><span class="text-gray-500 block text-xs">Jornada</span> <strong class="text-gray-900">${record.profile_name}</strong></div>
                <div><span class="text-gray-500 block text-xs">Trabalhado</span> <strong class="text-gray-900">${schedule.workedCurrent}</strong></div>
                <div><span class="text-gray-500 block text-xs">Almoço</span> <strong class="text-gray-900">${schedule.lunchDuration || '--'}</strong></div>
                <div><span class="text-gray-500 block text-xs">Saída Est.</span> <strong class="text-gray-900">${schedule.estimatedExit || '--:--'}</strong></div>
            </div>
            ${renderAlertsList(schedule.alerts)}
        </div>

        <h4 class="text-xs font-bold text-gray-500 uppercase mb-3 text-left flex items-center gap-2 mt-6">
            <i class="ph ph-clock-counter-clockwise"></i> Histórico Recente
        </h4>
        <div class="overflow-hidden border border-gray-200 rounded-lg">
            <table class="min-w-full divide-y divide-gray-200 text-xs">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-gray-500 font-medium">Data</th>
                        <th class="px-3 py-2 text-center text-gray-500 font-medium">Entrada</th>
                        <th class="px-3 py-2 text-center text-gray-500 font-medium">Saída</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;

    const validHistory = history.filter(h => h.date !== state.currentDate);

    if (validHistory.length === 0) {
        html += `<tr><td colspan="3" class="px-3 py-4 text-center text-gray-400">Nenhum histórico anterior disponível.</td></tr>`;
    } else {
        validHistory.forEach(h => {
            const exitTime = h.times.exit_time_real || h.times.exit_estimated || '--:--';
            const dateStr = h.date.split('-').reverse().join('/');
            html += `
                <tr>
                    <td class="px-3 py-2 text-gray-900 font-medium">${dateStr}</td>
                    <td class="px-3 py-2 text-center text-gray-600">${h.times.entry || '--'}</td>
                    <td class="px-3 py-2 text-center text-gray-600">${exitTime}</td>
                </tr>
            `;
        });
    }

    html += `</tbody></table></div>`;
    elements.infoContent.innerHTML = html;
    elements.modalInfo.classList.remove('hidden');
    elements.modalBackdrop.classList.remove('hidden');
}

function closeInfoModal() {
    elements.modalInfo.classList.add('hidden');
    if (!hasOtherModalsOpen()) {
        elements.modalBackdrop.classList.add('hidden');
    }
}

function renderAlertsList(alerts) {
    if (!alerts || alerts.length === 0) return '';
    let html = '<div class="mt-3 space-y-1">';
    alerts.forEach(a => {
        const colorClass = a.type === 'danger' ? 'text-red-700 bg-red-100 border border-red-200' : 'text-yellow-700 bg-yellow-100 border border-yellow-200';
        html += `<div class="${colorClass} px-2 py-1.5 rounded text-xs flex items-center gap-2"><i class="ph ph-warning-circle"></i> ${a.message}</div>`;
    });
    html += '</div>';
    return html;
}

function showConfirmModal(title, message, onConfirm, isAlertOnly = false, onCancel = null) {
    elements.confirmMessage.textContent = message;
    elements.modalConfirm.classList.remove('hidden');
    elements.modalBackdrop.classList.remove('hidden');

    const btnYes = elements.btnConfirmYes;
    const btnNo = elements.btnConfirmNo;
    const newYes = btnYes.cloneNode(true);
    const newNo = btnNo.cloneNode(true);
    btnYes.parentNode.replaceChild(newYes, btnYes);
    btnNo.parentNode.replaceChild(newNo, btnNo);

    elements.btnConfirmYes = newYes;
    elements.btnConfirmNo = newNo;

    if (isAlertOnly) {
        newYes.textContent = "OK";
        newNo.classList.add('hidden');
        newYes.onclick = () => {
            elements.modalConfirm.classList.add('hidden');
            if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden');
            if (onConfirm) onConfirm();
        };
    } else {
        newYes.textContent = "Confirmar";
        newNo.classList.remove('hidden');
        newYes.onclick = () => {
            elements.modalConfirm.classList.add('hidden');
            if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden');
            if (onConfirm) onConfirm();
        };
        newNo.onclick = () => {
            elements.modalConfirm.classList.add('hidden');
            if (!hasOtherModalsOpen()) elements.modalBackdrop.classList.add('hidden');
            if (onCancel) onCancel();
        };
    }
}

function startTimeLoop() {
    setInterval(() => {
        const rows = document.querySelectorAll('#table-body tr');
        rows.forEach(tr => {
            const record = tr.recordData;
            if (record) {
                const schedule = Logic.calculateSchedule(record, record.profile_data);
                updateRowVisuals(tr, schedule);
            }
        });
    }, 60000);
}