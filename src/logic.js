/**
 * src/logic.js
 * Motor de cálculo de horários e regras de negócio do SHIFT.
 * Versão Atualizada: Inclui lógica de tempo restante de jornada.
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
    const workTarget = profile.work_target_min || 440; // 7h20
    const lunchTarget = profile.lunch_target || 100;   // 1h40
    const lunchMinLimit = profile.lunch_min_limit || 60;

    let estimatedExitMin = null;
    let actualLunchDuration = 0;
    let timeWorkedSoFar = 0;
    
    // 1. CÁLCULO DA SAÍDA ESTIMADA
    if (entryMin !== null) {
        if (lunchOutMin !== null && lunchInMin !== null) {
            // Almoço já realizado: usa o tempo real
            actualLunchDuration = lunchInMin - lunchOutMin;
            estimatedExitMin = entryMin + workTarget + actualLunchDuration;
        } else {
            // Sem almoço ou almoço em andamento: projeta com a meta
            estimatedExitMin = entryMin + workTarget + lunchTarget;
        }
    }

    // 2. CÁLCULO DO TRABALHADO (LÍQUIDO)
    const nowMin = timeToMinutes(getCurrentTime());
    const exitSimulatedMin = timeToMinutes(times.exit_time_real);
    
    // Define até quando calcular: Hora simulada OU Hora atual
    let calcEndMin = exitSimulatedMin !== null ? exitSimulatedMin : nowMin;
    let isSimulated = exitSimulatedMin !== null;

    if (entryMin !== null) {
        if (lunchOutMin === null) {
            // Fase 1: Trabalho direto
            timeWorkedSoFar = Math.max(0, calcEndMin - entryMin);
        } else if (lunchInMin === null) {
            // Fase 2: Está no almoço (pausa contagem)
            timeWorkedSoFar = Math.max(0, lunchOutMin - entryMin);
        } else {
            // Fase 3: Voltou do almoço
            const firstShift = Math.max(0, lunchOutMin - entryMin);
            const secondShift = Math.max(0, calcEndMin - lunchInMin);
            timeWorkedSoFar = firstShift + secondShift;
        }
    }

    // 3. CÁLCULO DO RESTANTE DE JORNADA (Novo recurso)
    let workRemainingText = null;
    if (entryMin !== null) { // Só mostra se tiver começado a trabalhar
        const remaining = workTarget - timeWorkedSoFar;
        if (remaining > 0) {
            workRemainingText = `(Restam ${minutesToTime(remaining)})`;
        } else {
            workRemainingText = `(Extra ${minutesToTime(Math.abs(remaining))})`;
        }
    }

    // 4. STATUS DO ALMOÇO (TEXTO)
    let lunchStatus = null;
    let lunchTimeRemaining = null;
    let isLunchViolation = false;

    if (lunchOutMin !== null && lunchInMin === null) {
        // Está no almoço agora
        const timeGone = nowMin - lunchOutMin;
        lunchTimeRemaining = lunchTarget - timeGone;
        
        if (lunchTimeRemaining < 0) {
            lunchStatus = `Excedido: ${minutesToTime(Math.abs(lunchTimeRemaining))}`;
            isLunchViolation = true;
        } else {
            lunchStatus = `Restam: ${minutesToTime(lunchTimeRemaining)}`;
        }
    }

    // 5. ALERTAS
    const alerts = [];
    
    if (actualLunchDuration > 0 && actualLunchDuration < lunchMinLimit) {
        alerts.push({ type: 'danger', message: `Almoço curto (${minutesToTime(actualLunchDuration)})` });
    }

    // Alerta de Horas Extras Excessivas (> 2h / 120min)
    // Verifica se já trabalhou ou se a projeção passará do limite
    const maxExtra = profile.max_extra || 120;
    // Se trabalhado atual já estourou
    if (timeWorkedSoFar > (workTarget + maxExtra)) {
        alerts.push({ type: 'danger', message: 'Limite de Horas Extras Excedido' });
    }

    return {
        estimatedExit: minutesToTime(estimatedExitMin),
        workedCurrent: minutesToTime(timeWorkedSoFar),
        workRemainingText: workRemainingText, // Novo Campo
        lunchDuration: actualLunchDuration > 0 ? minutesToTime(actualLunchDuration) : null,
        
        lunchStatusText: lunchStatus,
        isLunchViolation: isLunchViolation,
        
        isSimulated: isSimulated,
        alerts: alerts
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