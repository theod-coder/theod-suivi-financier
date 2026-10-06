/**
 * ==========================================================================
 * js/realtime.js - Compteur de gains en temps réel (60 FPS & Précision ms)
 * ==========================================================================
 */

let realtimeRafId = null;
let lastRenderedMode = null;
let lastRenderedStatus = null;

/**
 * Convertit une chaîne HH:MM en millisecondes depuis minuit
 * @param {string} timeStr
 * @returns {number}
 */
function parseTimeToMs(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(v => parseInt(v, 10) || 0);
  return (h * 3600 + m * 60) * MS_IN_SECOND;
}

/**
 * Calcule les durées effectives à partir des horaires configurés
 */
function getScheduleDurations() {
  const tMornStart = parseTimeToMs(state.schedule.morningStart);
  const tMornEnd   = parseTimeToMs(state.schedule.morningEnd);
  const tAftStart  = parseTimeToMs(state.schedule.afternoonStart);
  const tAftEnd    = parseTimeToMs(state.schedule.afternoonEnd);

  const mornMs = Math.max(0, tMornEnd - tMornStart);
  const aftMs  = Math.max(0, tAftEnd - tAftStart);
  const totalMs = mornMs + aftMs;
  const mornRatio = totalMs > 0 ? (mornMs / totalMs) : 0.5;

  return { tMornStart, tMornEnd, tAftStart, tAftEnd, mornMs, aftMs, totalMs, mornRatio };
}

/**
 * Calcule l'état de travail en fonction de l'heure système réelle
 * @param {Date} dateObj
 */
function computeRealtimeWorkState(dateObj) {
  const day = dateObj.getDay(); // 0 = Dimanche, 6 = Samedi
  const isWeekday = (day >= 1 && day <= 5);

  const { tMornStart, tMornEnd, tAftStart, tAftEnd, mornMs, aftMs, totalMs, mornRatio } = getScheduleDurations();

  const msSinceMidnight = 
    (dateObj.getHours() * 3600 + dateObj.getMinutes() * 60 + dateObj.getSeconds()) * 1000 + 
    dateObj.getMilliseconds();

  // 1. Week-end : Inactif
  if (!isWeekday) {
    return {
      mode: 'state-inactive',
      statusText: 'Hors plage (Week-end)',
      periodLabel: 'Repos hebdomadaire',
      workedMs: 0,
      progressRatio: 0
    };
  }

  // 2. Avant le début du matin : Inactif
  if (msSinceMidnight < tMornStart) {
    return {
      mode: 'state-inactive',
      statusText: 'Hors plage / En pause',
      periodLabel: `Prise de poste à ${state.schedule.morningStart}`,
      workedMs: 0,
      progressRatio: 0
    };
  }

  // 3. Matin actif : tMornStart -> tMornEnd
  if (msSinceMidnight >= tMornStart && msSinceMidnight < tMornEnd) {
    const morningWorked = msSinceMidnight - tMornStart;
    return {
      mode: 'state-active',
      statusText: 'Actif / En cours',
      periodLabel: `Accumulation matin (${state.schedule.morningStart} - ${state.schedule.morningEnd})`,
      workedMs: morningWorked,
      progressRatio: totalMs > 0 ? (morningWorked / totalMs) : 0
    };
  }

  // 4. Pause déjeuner : tMornEnd -> tAftStart (compteur figé sur la matinée)
  if (msSinceMidnight >= tMornEnd && msSinceMidnight < tAftStart) {
    return {
      mode: 'state-pause',
      statusText: 'Pause déjeuner',
      periodLabel: `Compteur figé • Reprise à ${state.schedule.afternoonStart}`,
      workedMs: mornMs,
      progressRatio: mornRatio
    };
  }

  // 5. Après-midi actif : tAftStart -> tAftEnd
  if (msSinceMidnight >= tAftStart && msSinceMidnight < tAftEnd) {
    const afternoonWorked = msSinceMidnight - tAftStart;
    const totalWorked = mornMs + afternoonWorked;
    return {
      mode: 'state-active',
      statusText: 'Actif / En cours',
      periodLabel: `Accumulation après-midi (${state.schedule.afternoonStart} - ${state.schedule.afternoonEnd})`,
      workedMs: totalWorked,
      progressRatio: totalMs > 0 ? (totalWorked / totalMs) : 0
    };
  }

  // 6. Après la fin de l'après-midi : Journée terminée, plafonnée au total
  return {
    mode: 'state-inactive',
    statusText: 'Hors plage / En pause',
    periodLabel: 'Plafond journalier atteint',
    workedMs: totalMs,
    progressRatio: 1.0
  };
}

/**
 * Formate un nombre de millisecondes en HH:MM:SS
 * @param {number} ms
 */
function formatTimeHHMMSS(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Boucle d'animation à 60 FPS du compteur (100% heure système réelle)
 */
function renderRealtimeLoop() {
  const now = new Date();
  const workState = computeRealtimeWorkState(now);
  const { totalMs } = getScheduleDurations();

  // Formule mathématique : (workedMs * rate) / (3600 * 1000)
  const earnedAmount = (workState.workedMs * state.hourlyRate) / (3600 * MS_IN_SECOND);

  // Découpage Entier & 6 décimales pour un rendu fixe sans aucun sautillement
  const intPart = Math.floor(earnedAmount);
  const decPart = (earnedAmount - intPart).toFixed(6).substring(2);

  const elemInt = document.getElementById('rtAmountInt');
  const elemDec = document.getElementById('rtAmountDecimals');
  if (elemInt && elemDec) {
    elemInt.textContent = intPart.toLocaleString('fr-FR');
    elemDec.textContent = decPart;
  }

  // Progression (0% à 100%)
  const elemPct = document.getElementById('rtProgressPercent');
  const elemFill = document.getElementById('rtProgressFill');
  if (elemPct && elemFill) {
    const pctVal = (workState.progressRatio * 100).toFixed(1);
    elemPct.textContent = `${pctVal} %`;
    elemFill.style.width = `${Math.min(100, Math.max(0, workState.progressRatio * 100))}%`;
  }

  // Temps travaillé & libellé
  const elemTime = document.getElementById('rtTimeWorked');
  const elemLabel = document.getElementById('rtPeriodLabel');
  if (elemTime) {
    elemTime.textContent = `${formatTimeHHMMSS(workState.workedMs)} / ${formatTimeHHMMSS(totalMs)}`;
  }
  if (elemLabel) elemLabel.textContent = workState.periodLabel;

  // Mise à jour de la classe d'état du conteneur (state-active, state-pause, state-inactive)
  const root = document.getElementById('rtComponentRoot');
  if (root && lastRenderedMode !== workState.mode) {
    root.classList.remove('state-active', 'state-pause', 'state-inactive');
    root.classList.add(workState.mode);
    lastRenderedMode = workState.mode;
  }

  // Mise à jour du texte du badge
  const elemStatus = document.getElementById('rtStatusText');
  if (elemStatus && lastRenderedStatus !== workState.statusText) {
    elemStatus.textContent = workState.statusText;
    lastRenderedStatus = workState.statusText;
  }

  // Boucle suivante tant que l'onglet est affiché
  if (state.activeTab === 'view-realtime') {
    realtimeRafId = requestAnimationFrame(renderRealtimeLoop);
  }
}

/**
 * Démarre la boucle d'animation si elle n'est pas déjà en cours
 */
function startRealtimeLoop() {
  if (!realtimeRafId) {
    realtimeRafId = requestAnimationFrame(renderRealtimeLoop);
  }
}

/**
 * Arrête strictement la boucle d'animation pour préserver la batterie
 */
function stopRealtimeLoop() {
  if (realtimeRafId) {
    cancelAnimationFrame(realtimeRafId);
    realtimeRafId = null;
  }
}

/**
 * Calcule le nombre d'heures travaillées par jour et la base mensuelle légale (52 sem./an)
 * @returns {{ dailyHours: number, monthlyHours: number }}
 */
function computeMonthlyHours() {
  const { totalMs } = getScheduleDurations();
  const dailyHours = totalMs / (3600 * MS_IN_SECOND);
  // Base mensualisée : 5 jours par semaine * 52 semaines / 12 mois = 21.6667 jours ouvrés/mois
  const monthlyHours = dailyHours * 5 * (52 / 12);
  return { dailyHours, monthlyHours };
}

/**
 * Met à jour les KPIs secondaires, les repères de la jauge et la base de salaire
 */
function updateRealtimeStaticKPIs() {
  const { totalMs, mornRatio } = getScheduleDurations();
  const { dailyHours, monthlyHours } = computeMonthlyHours();
  const maxDay = dailyHours * state.hourlyRate;
  const rateMin = state.hourlyRate / 60;

  const elemMax = document.getElementById('rtKpiMaxDaily');
  const elemRateMin = document.getElementById('rtKpiRatePerMin');

  if (elemMax) {
    elemMax.textContent = maxDay.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  }
  if (elemRateMin) {
    elemRateMin.textContent = rateMin.toLocaleString('fr-FR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }) + ' €';
  }

  // Titre de jauge avec nombre d'heures dynamiques
  const elemTitle = document.getElementById('rtProgressTitle');
  if (elemTitle) {
    const formattedHours = dailyHours.toFixed(2).replace(/\.?0+$/, '');
    elemTitle.textContent = `Progression journée (${formattedHours}h ouvrées)`;
  }

  // Repères sur la jauge
  const mStart = document.getElementById('rtMilestoneStart');
  const mMid   = document.getElementById('rtMilestoneMid');
  const mEnd   = document.getElementById('rtMilestoneEnd');

  if (mStart) mStart.textContent = `${state.schedule.morningStart.replace(':', 'h')} (0%)`;
  if (mMid)   mMid.textContent   = `${state.schedule.morningEnd.replace(':', 'h')} (${Math.round(mornRatio * 100)}%)`;
  if (mEnd)   mEnd.textContent   = `${state.schedule.afternoonEnd.replace(':', 'h')} (100%)`;

  // Résumé et total dans le panneau d'horaires
  const schedSum = document.getElementById('rtScheduleSummary');
  if (schedSum) {
    schedSum.textContent = `Matin : ${state.schedule.morningStart.replace(':', 'h')} - ${state.schedule.morningEnd.replace(':', 'h')} • A-Midi : ${state.schedule.afternoonStart.replace(':', 'h')} - ${state.schedule.afternoonEnd.replace(':', 'h')}`;
  }

  const schedDur = document.getElementById('rtTotalWorkDuration');
  if (schedDur) {
    schedDur.textContent = `${formatTimeHHMMSS(totalMs).substring(0, 5).replace(':', ' h ')} / jour`;
  }

  // Base d'heures mensuelles et synchronisation des champs
  const basisEl = document.getElementById('rtSalaryHoursBasis');
  if (basisEl) {
    const formattedDaily = dailyHours.toFixed(2).replace(/\.?0+$/, '');
    const formattedMonthly = monthlyHours.toFixed(1).replace('.', ',');
    basisEl.textContent = `Base : ${formattedDaily}h / jour • ~${formattedMonthly}h / mois (21,7 j/mois)`;
  }

  const inpMonthlySalary = document.getElementById('rtMonthlySalaryInput');
  if (inpMonthlySalary && document.activeElement !== inpMonthlySalary) {
    if (state.monthlySalary && state.monthlySalary > 0) {
      inpMonthlySalary.value = state.monthlySalary.toFixed(2);
    } else if (monthlyHours > 0) {
      state.monthlySalary = Math.round(state.hourlyRate * monthlyHours * 100) / 100;
      inpMonthlySalary.value = state.monthlySalary.toFixed(2);
    }
  }

  const inpRate = document.getElementById('rtHourlyRateInput');
  if (inpRate && document.activeElement !== inpRate) {
    inpRate.value = state.hourlyRate;
  }
}

/**
 * Synchronise les champs inputs avec state.schedule
 */
function syncScheduleInputs() {
  const inpMStart = document.getElementById('rtMorningStart');
  const inpMEnd   = document.getElementById('rtMorningEnd');
  const inpAStart = document.getElementById('rtAfternoonStart');
  const inpAEnd   = document.getElementById('rtAfternoonEnd');

  if (inpMStart) inpMStart.value = state.schedule.morningStart;
  if (inpMEnd)   inpMEnd.value   = state.schedule.morningEnd;
  if (inpAStart) inpAStart.value = state.schedule.afternoonStart;
  if (inpAEnd)   inpAEnd.value   = state.schedule.afternoonEnd;
}

/**
 * Configure les écouteurs d'événements du module Temps Réel
 */
function setupRealtimeEventListeners() {
  // Édition du salaire mensuel (calcul automatique du taux horaire)
  const salaryInput = document.getElementById('rtMonthlySalaryInput');
  if (salaryInput) {
    if (state.monthlySalary && state.monthlySalary > 0) {
      salaryInput.value = state.monthlySalary.toFixed(2);
    }
    salaryInput.addEventListener('input', (e) => {
      const sal = parseFloat(e.target.value);
      if (!isNaN(sal) && sal > 0) {
        state.monthlySalary = sal;
        const { monthlyHours } = computeMonthlyHours();
        if (monthlyHours > 0) {
          state.hourlyRate = Math.round((sal / monthlyHours) * 1000) / 1000;
          const rateInp = document.getElementById('rtHourlyRateInput');
          if (rateInp) rateInp.value = state.hourlyRate;
          saveData();
          updateRealtimeStaticKPIs();
        }
      }
    });
  }

  // Édition directe du taux horaire
  const rateInput = document.getElementById('rtHourlyRateInput');
  if (rateInput) {
    rateInput.value = state.hourlyRate;
    rateInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val > 0) {
        state.hourlyRate = val;
        const { monthlyHours } = computeMonthlyHours();
        if (monthlyHours > 0) {
          state.monthlySalary = Math.round(val * monthlyHours * 100) / 100;
          const salInp = document.getElementById('rtMonthlySalaryInput');
          if (salInp) salInp.value = state.monthlySalary.toFixed(2);
        }
        saveData();
        updateRealtimeStaticKPIs();
      }
    });
  }

  // Édition des horaires de travail
  const inpMStart = document.getElementById('rtMorningStart');
  const inpMEnd   = document.getElementById('rtMorningEnd');
  const inpAStart = document.getElementById('rtAfternoonStart');
  const inpAEnd   = document.getElementById('rtAfternoonEnd');

  function onScheduleChange() {
    state.schedule.morningStart   = inpMStart.value || DEFAULT_SCHEDULE.morningStart;
    state.schedule.morningEnd     = inpMEnd.value   || DEFAULT_SCHEDULE.morningEnd;
    state.schedule.afternoonStart = inpAStart.value || DEFAULT_SCHEDULE.afternoonStart;
    state.schedule.afternoonEnd   = inpAEnd.value   || DEFAULT_SCHEDULE.afternoonEnd;

    // Recalcul automatique du taux horaire à partir du salaire mensuel
    const { monthlyHours } = computeMonthlyHours();
    if (state.monthlySalary && state.monthlySalary > 0 && monthlyHours > 0) {
      state.hourlyRate = Math.round((state.monthlySalary / monthlyHours) * 1000) / 1000;
      const rateInp = document.getElementById('rtHourlyRateInput');
      if (rateInp) rateInp.value = state.hourlyRate;
    }

    saveData();
    updateRealtimeStaticKPIs();
  }

  [inpMStart, inpMEnd, inpAStart, inpAEnd].forEach(inp => {
    if (inp) inp.addEventListener('change', onScheduleChange);
  });

  // Bouton réinitialiser les horaires par défaut
  const btnReset = document.getElementById('btnResetSchedule');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      state.schedule = { ...DEFAULT_SCHEDULE };
      syncScheduleInputs();

      const { monthlyHours } = computeMonthlyHours();
      if (state.monthlySalary && state.monthlySalary > 0 && monthlyHours > 0) {
        state.hourlyRate = Math.round((state.monthlySalary / monthlyHours) * 1000) / 1000;
        const rateInp = document.getElementById('rtHourlyRateInput');
        if (rateInp) rateInp.value = state.hourlyRate;
      }

      saveData();
      updateRealtimeStaticKPIs();
      showToast('Horaires réinitialisés par défaut');
    });
  }
}

// Export pour environnements modules / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseTimeToMs,
    getScheduleDurations,
    computeMonthlyHours,
    computeRealtimeWorkState,
    formatTimeHHMMSS,
    renderRealtimeLoop,
    startRealtimeLoop,
    stopRealtimeLoop,
    updateRealtimeStaticKPIs,
    syncScheduleInputs,
    setupRealtimeEventListeners
  };
}
