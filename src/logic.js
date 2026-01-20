/**
 * src/logic.js
 * Lógica de Negócio: Cálculos de Jornada, Horas Extras e Regras CLT.
 * Versão Final: Adicionada regra de limite de 6h sem almoço.
 */

// ==========================================
// CONSTANTES E CONFIGURAÇÕES
// ==========================================

const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Calcula todo o cronograma do dia para um registro.
 * @param {Object} record - Registro do dia (do banco de dados).
 * @param {Object} profile - Perfil de jornada (ex: 6x1).
 * @returns {Object} Objeto com todos os cálculos, status e alertas.
 */
export function calculateSchedule(record, profile) {
    const times = record.times || {};
    const now = new Date();
    
    // Converte strings "HH:MM" para objetos Date (usando data base dummy)
    const entry = parseTime(times.entry);
    const lunchOut = parseTime(times.lunch_out);
    const lunchIn = parseTime(times.lunch_in);
    
    // Objeto de resultado base
    const schedule = {
        workedCurrent: "--:--",
        lunchDuration: null,
        lunchStatusText: null,
        isLunchViolation: false,
        exitRangeText: null,
        workStatusType: 'normal', // normal, extra, exceeded
        workRemainingText: null,
        timeToLunchLimit: null, // NOVO: Tempo restante para estourar as 6h sem almoço
        alerts: [],
        notificationTrigger: null
    };

    // 1. Cálculo do Limite de 6h sem Almoço (Se já entrou e não saiu p/ almoço)
    if (entry && !lunchOut) {
        // Regra: Não pode trabalhar mais de 6h consecutivas sem intervalo
        const limit6h = new Date(entry.getTime() + (6 * MS_PER_HOUR));
        const diffMs = limit6h - now; // Diferença para o limite (pode ser negativa se estourou)
        
        // Formata para exibição
        const absDiffMs = Math.abs(diffMs);
        const diffStr = formatDuration(absDiffMs); // ex: "00:45"

        if (diffMs > 0) {
            // Ainda dentro do prazo
            schedule.timeToLunchLimit = `Almoço em: ${diffStr}`;
            
            // Alerta se faltar menos de 1 hora
            if (diffMs < (1 * MS_PER_HOUR)) {
                schedule.alerts.push({
                    type: 'warning',
                    message: `Atenção: Almoço obrigatório em menos de ${diffStr}.`
                });
            }
        } else {
            // Estourou as 6h
            schedule.timeToLunchLimit = `Estourou 6h: +${diffStr}`;
            schedule.alerts.push({
                type: 'danger',
                message: "VIOLAÇÃO: Mais de 6h trabalhadas sem intervalo!"
            });
        }
    }

    // Se não tem entrada, não há mais nada a calcular
    if (!entry) return schedule;

    // 2. Cálculo do Almoço Realizado
    let lunchMs = 0;
    if (lunchOut && lunchIn) {
        lunchMs = lunchIn - lunchOut;
        schedule.lunchDuration = formatDuration(lunchMs);
        
        // Validação: Mínimo 1h (com tolerância de 10 min, ou seja, 50min aceitável em alguns casos, mas regra padrão é 1h)
        // Vamos ser estritos: Menos de 1h = Aviso
        if (lunchMs < (1 * MS_PER_HOUR)) {
            schedule.lunchStatusText = "Intervalo Curto";
            schedule.isLunchViolation = true;
            schedule.alerts.push({
                type: 'danger',
                message: "Intervalo de almoço inferior a 1 hora."
            });
        } else {
            schedule.lunchStatusText = "OK";
        }
    } else if (lunchOut && !lunchIn) {
        schedule.lunchStatusText = "Em intervalo...";
    }

    // 3. Jornada Esperada (Baseado no perfil)
    // Ex: 6x1 geralmente é 7h20 (440 minutos)
    const targetWorkMs = (profile.daily_hours || 7.3333) * MS_PER_HOUR; 
    const maxExtraMs = (profile.max_extra_hours || 2) * MS_PER_HOUR;
    const hardLimitMs = targetWorkMs + maxExtraMs;

    // 4. Cálculo de Horas Trabalhadas (Até agora)
    let workedMs = 0;
    
    // Parte 1: Entrada até Almoço (ou Agora)
    const endFirstPart = lunchOut || (lunchIn ? null : now); // Se saiu pro almoço, usa a saída. Se não, usa agora.
    
    if (endFirstPart && endFirstPart > entry) {
        workedMs += (endFirstPart - entry);
    }

    // Parte 2: Volta do Almoço até Agora (Se já voltou)
    if (lunchIn) {
        // Se ainda não saiu (sem exit time), conta até agora
        // Como o sistema não tem input de saída final na tabela principal (ainda), assumimos "agora"
        // num cenário real, teria um input de saída.
        // Para a tabela dinâmica, vamos considerar até "agora" se não houver saída definida.
        // Mas a UI atual não tem "exit_time" na tabela, então é sempre "agora".
        if (now > lunchIn) {
            workedMs += (now - lunchIn);
        }
    }

    schedule.workedCurrent = formatDuration(workedMs);

    // 5. Previsão de Saída (Range)
    // Saída Ideal = Entrada + Jornada + Almoço (se houve)
    // Se não houve almoço ainda, projetamos o almoço padrão (ex: 1h) ou o tempo já decorrido
    
    let projectedLunchMs = lunchMs;
    if (!lunchIn) {
        // Se não terminou o almoço, projeta 1h mínima ou o tempo que já passou
        if (lunchOut) {
            const currentLunchDuration = now - lunchOut;
            projectedLunchMs = Math.max(currentLunchDuration, MS_PER_HOUR);
        } else {
            // Nem saiu ainda
            projectedLunchMs = MS_PER_HOUR; // Assume 1h padrão
        }
    }

    // Saída Mínima (Cumprir tabela)
    const exitMin = new Date(entry.getTime() + targetWorkMs + projectedLunchMs);
    // Saída Máxima (Limite de extras)
    const exitMax = new Date(entry.getTime() + hardLimitMs + projectedLunchMs);

    schedule.exitRangeText = `${formatTime(exitMin)} - ${formatTime(exitMax)}`;

    // 6. Status da Jornada e Alertas de Estouro
    const remainingMs = targetWorkMs - workedMs;
    
    if (remainingMs > 0) {
        schedule.workRemainingText = `Faltam: ${formatDuration(remainingMs)}`;
    } else {
        // Já cumpriu a jornada, está em hora extra
        const extraMs = Math.abs(remainingMs);
        
        if (extraMs < maxExtraMs) {
            schedule.workStatusType = 'extra';
            schedule.workRemainingText = `Extra: +${formatDuration(extraMs)}`;
            
            // Aviso de 10 min para o limite máximo
            const msUntilCritical = maxExtraMs - extraMs;
            if (msUntilCritical <= (10 * MS_PER_MINUTE)) {
                schedule.notificationTrigger = 'warning_10min';
                schedule.alerts.push({
                    type: 'warning',
                    message: "Faltam menos de 10min para o limite máximo de extras."
                });
            }

        } else {
            schedule.workStatusType = 'exceeded';
            schedule.workRemainingText = `Excedido: +${formatDuration(extraMs)}`;
            schedule.notificationTrigger = 'warning_critical';
            schedule.alerts.push({
                type: 'danger',
                message: "Limite legal de horas extras excedido!"
            });
        }
    }

    return schedule;
}

/**
 * Valida a tentativa de retorno do almoço.
 * @param {string} lunchOutStr - Horário de saída (HH:MM).
 * @param {string} lunchInStr - Horário de volta (HH:MM).
 * @returns {Object} { valid: boolean, warning: boolean, message: string }
 */
export function validateLunchReturn(lunchOutStr, lunchInStr) {
    if (!lunchOutStr) return { valid: false, message: "Informe a saída para o almoço primeiro." };
    
    const outTime = parseTime(lunchOutStr);
    const inTime = parseTime(lunchInStr);
    
    if (inTime <= outTime) return { valid: false, message: "A volta deve ser depois da saída." };
    
    const diffMs = inTime - outTime;
    
    // Regra: Mínimo 1 hora (com pequena tolerância de erro de input, mas vamos forçar o aviso)
    if (diffMs < (1 * MS_PER_HOUR)) {
        return { 
            valid: true, // É válido (pode salvar), mas gera aviso
            warning: true, 
            message: `Intervalo de apenas ${formatDuration(diffMs)}. A legislação exige no mínimo 1h. Deseja confirmar?`
        };
    }
    
    return { valid: true, warning: false };
}

// ==========================================
// HELPERS INTERNOS
// ==========================================

function parseTime(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date;
}

function formatTime(date) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms) {
    const totalMinutes = Math.floor(ms / MS_PER_MINUTE);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}