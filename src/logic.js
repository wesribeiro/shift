/**
 * src/logic.js
 * Motor de cálculo de horários e regras de negócio do SHIFT.
 * Versão: Faixa de Horários + Gatilhos de Notificação.
 */

// ==========================================
// UTILITÁRIOS DE TEMPO
// ==========================================

export const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return (hours * 60) + minutes;
};

export const minutesToTime = (totalMinutes) => {
    if (totalMinutes === null || isNaN(totalMinutes)) return "--:--";
    
    const sign = totalMinutes < 0 ? "-" : "";
    const absMin = Math.abs(totalMinutes);
    const h = Math.floor(absMin / 60);
    const m = absMin % 60;
    
    const hStr = String(h).padStart(2, '0');
    const mStr = String(m).padStart(2, '0');
    return `${sign}${hStr}:${mStr}`;
};

export const getCurrentTime = () => {
    const now = new Date();
    return minutesToTime((now.getHours() * 60) + now.getMinutes());
};

// ==========================================
// REGRAS DE NEGÓCIO
// ==========================================

export const calculateSchedule = (record, profile) => {
    const times = record.times || {};
    const entryMin = timeToMinutes(times.entry);
    const lunchOutMin = timeToMinutes(times.lunch_out);
    const lunchInMin = timeToMinutes(times.lunch_in);
    
    // Configurações do Perfil
    const workTarget = profile.work_target_min || 440; // 7h20 (440 min)
    const lunchTarget = profile.lunch_target || 100;   // 1h40
    const lunchMinLimit = profile.lunch_min_limit || 60;
    const maxExtra = profile.max_extra || 120; // 2h extras permitidas

    let estimatedExitMin = null;     // Horário ideal (7h20 trab)
    let limitExitMin = null;         // Horário limite (9h20 trab)
    let actualLunchDuration = 0;
    let timeWorkedSoFar = 0;
    
    // 1. CÁLCULO DA FAIXA DE SAÍDA
    if (entryMin !== null) {
        let lunchCalc = lunchTarget; // Assume meta padrão

        if (lunchOutMin !== null && lunchInMin !== null) {
            // Almoço realizado: usa real
            actualLunchDuration = lunchInMin - lunchOutMin;
            lunchCalc = actualLunchDuration;
        } else if (lunchOutMin !== null) {
            // Almoço em andamento: usa meta
            lunchCalc = lunchTarget;
        }

        // Saída Mínima (Jornada Padrão)
        estimatedExitMin = entryMin + workTarget + lunchCalc;
        
        // Saída Máxima (Limite Legal)
        limitExitMin = entryMin + workTarget + maxExtra + lunchCalc;
    }

    // String da Faixa: "16:20 - 18:20"
    let exitRangeText = null;
    if (estimatedExitMin !== null && limitExitMin !== null) {
        exitRangeText = `${minutesToTime(estimatedExitMin)} - ${minutesToTime(limitExitMin)}`;
    }

    // 2. CÁLCULO DO TRABALHADO (LÍQUIDO)
    const nowMin = timeToMinutes(getCurrentTime());
    const exitSimulatedMin = timeToMinutes(times.exit_time_real);
    
    let calcEndMin = exitSimulatedMin !== null ? exitSimulatedMin : nowMin;
    let isSimulated = exitSimulatedMin !== null;

    if (entryMin !== null) {
        if (lunchOutMin === null) {
            timeWorkedSoFar = Math.max(0, calcEndMin - entryMin);
        } else if (lunchInMin === null) {
            timeWorkedSoFar = Math.max(0, lunchOutMin - entryMin);
        } else {
            const firstShift = Math.max(0, lunchOutMin - entryMin);
            const secondShift = Math.max(0, calcEndMin - lunchInMin);
            timeWorkedSoFar = firstShift + secondShift;
        }
    }

    // 3. TEXTO DE STATUS (Restante / Extra / Excedido)
    let workRemainingText = null;
    let workStatusType = 'normal'; // normal | extra | exceeded

    if (entryMin !== null) {
        const remaining = workTarget - timeWorkedSoFar;
        
        if (remaining > 0) {
            // Ainda falta trabalhar
            workRemainingText = `(Restam ${minutesToTime(remaining)})`;
            workStatusType = 'normal';
        } else {
            // Entrou em horas extras
            const extraMinutes = Math.abs(remaining);
            
            if (extraMinutes <= maxExtra) {
                // Hora Extra permitida
                workRemainingText = `(Extra ${minutesToTime(extraMinutes)})`;
                workStatusType = 'extra';
            } else {
                // Estourou o limite legal (> 2h)
                const exceededBy = extraMinutes - maxExtra; // Opcional: mostrar quanto passou do limite ou total extra
                // Vamos mostrar o total extra, mas mudar a label para Excedido
                workRemainingText = `(Excedido ${minutesToTime(extraMinutes)})`;
                workStatusType = 'exceeded';
            }
        }
    }

    // 4. GATILHOS DE NOTIFICAÇÃO
    // Calcula quantos minutos faltam para estourar o limite máximo (Target + MaxExtra)
    let minutesToLimit = null;
    let notificationTrigger = null;

    if (entryMin !== null && !isSimulated) { // Só notifica se for tempo real
        const totalLimit = workTarget + maxExtra;
        minutesToLimit = totalLimit - timeWorkedSoFar;

        // Gatilho 1: Exatamente 10 minutos para o fim (ou entrou na janela de 10 a 9 min)
        if (minutesToLimit <= 10 && minutesToLimit > 1) {
            notificationTrigger = 'warning_10min';
        }
        // Gatilho 2: 1 minuto para o fim (ou estourou agora)
        else if (minutesToLimit <= 1) {
            notificationTrigger = 'warning_critical';
        }
    }

    // 5. STATUS DO ALMOÇO
    let lunchStatus = null;
    let isLunchViolation = false;

    if (lunchOutMin !== null && lunchInMin === null) {
        const timeGone = nowMin - lunchOutMin;
        const lunchRemaining = lunchTarget - timeGone;
        
        if (lunchRemaining < 0) {
            lunchStatus = `Excedido: ${minutesToTime(Math.abs(lunchRemaining))}`;
            isLunchViolation = true;
        } else {
            lunchStatus = `Restam: ${minutesToTime(lunchRemaining)}`;
        }
    }

    // 6. ALERTAS GERAIS
    const alerts = [];
    if (actualLunchDuration > 0 && actualLunchDuration < lunchMinLimit) {
        alerts.push({ type: 'danger', message: `Almoço curto (${minutesToTime(actualLunchDuration)})` });
    }
    if (workStatusType === 'exceeded') {
        alerts.push({ type: 'danger', message: 'Limite legal de jornada excedido!' });
    }

    return {
        estimatedExit: minutesToTime(estimatedExitMin), // Mantemos para placeholder simples se precisar
        exitRangeText: exitRangeText, // Nova faixa "16:20 - 18:20"
        
        workedCurrent: minutesToTime(timeWorkedSoFar),
        workRemainingText: workRemainingText,
        workStatusType: workStatusType, // para cor
        
        lunchDuration: actualLunchDuration > 0 ? minutesToTime(actualLunchDuration) : null,
        lunchStatusText: lunchStatus,
        isLunchViolation: isLunchViolation,
        
        isSimulated: isSimulated,
        alerts: alerts,
        
        // Dados para sistema de notificação
        notificationTrigger: notificationTrigger,
        minutesToLimit: minutesToLimit
    };
};

export const validateLunchReturn = (lunchOutStr, lunchInStr, profile) => {
    const outMin = timeToMinutes(lunchOutStr);
    const inMin = timeToMinutes(lunchInStr);
    
    if (inMin < outMin) {
        return { valid: false, message: "A volta não pode ser antes da saída." };
    }
    
    const duration = inMin - outMin;
    if (duration < (profile.lunch_min_limit || 60)) {
        return { 
            valid: true, 
            warning: true, 
            message: `Intervalo de apenas ${duration} min é inferior ao mínimo de 1h. Confirma?` 
        };
    }
    return { valid: true };
};