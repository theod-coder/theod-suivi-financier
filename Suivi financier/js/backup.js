/**
 * ==========================================================================
 * js/backup.js - Sauvegarde, restauration, diagnostic système et PWA
 * ==========================================================================
 */

/**
 * Enregistre le service worker pour le fonctionnement PWA et hors-ligne
 */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

/**
 * Calcule l'espace approximatif consommé par le LocalStorage en octets
 * @returns {number}
 */
function getLocalStorageUsageBytes() {
  let totalBytes = 0;
  for (let key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      totalBytes += (localStorage[key].length + key.length) * 2; // UTF-16 = 2 octets par caractère
    }
  }
  return totalBytes;
}

/**
 * Met à jour le diagnostic système (espace LocalStorage, statut réseau, métriques globales)
 */
function renderSystemStats() {
  // 1. Statut réseau PWA
  const statusEl = document.getElementById('systemOnlineStatus');
  const statusTextEl = document.getElementById('systemOnlineText');
  if (statusEl && statusTextEl) {
    const isOnline = navigator.onLine;
    statusEl.className = isOnline ? 'system-status-pill online' : 'system-status-pill offline';
    statusTextEl.textContent = isOnline ? 'En ligne (PWA Connectée)' : 'Hors-ligne (Stockage 100% Local)';
  }

  // 2. Jauge d'espace LocalStorage
  const usedBytes = getLocalStorageUsageBytes();
  const usedKo = (usedBytes / 1024).toFixed(1);
  const maxKo = 5120; // Quota typique standard ~5 Mo
  const pct = Math.min(100, Math.max(0.5, (usedBytes / (maxKo * 1024)) * 100)).toFixed(1);

  const usageText = document.getElementById('storageUsageText');
  const meterFill = document.getElementById('storageMeterFill');
  if (usageText) {
    usageText.textContent = `${usedKo} Ko / ~${maxKo} Ko (${pct}%)`;
  }
  if (meterFill) {
    meterFill.style.width = `${pct}%`;
  }

  // 3. Métriques globales
  const txCountEl = document.getElementById('sysKpiTxCount');
  if (txCountEl) {
    txCountEl.textContent = state.transactions.length;
  }

  const catCountEl = document.getElementById('sysKpiCatCount');
  if (catCountEl) {
    catCountEl.textContent = state.categories.length;
  }

  const dateRangeEl = document.getElementById('sysKpiDateRange');
  if (dateRangeEl) {
    if (state.transactions.length === 0) {
      dateRangeEl.textContent = 'Aucune opération';
    } else {
      const dates = state.transactions.map(t => t.date).sort();
      const first = dates[0].substring(0, 7);
      const last = dates[dates.length - 1].substring(0, 7);
      dateRangeEl.textContent = first === last ? first : `${first} à ${last}`;
    }
  }

  const lastBackupEl = document.getElementById('sysKpiLastBackup');
  if (lastBackupEl) {
    const savedBackupDate = localStorage.getItem('budget_last_backup_date');
    if (savedBackupDate) {
      try {
        const d = new Date(savedBackupDate);
        lastBackupEl.textContent = `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      } catch (e) {
        lastBackupEl.textContent = savedBackupDate;
      }
    } else {
      lastBackupEl.textContent = 'Jamais exporté';
    }
  }
}

/**
 * Exporte toutes les données (catégories, transactions, taux et horaires) en JSON
 */
function exportDataJson() {
  const exportTimestamp = new Date().toISOString();
  localStorage.setItem('budget_last_backup_date', exportTimestamp);

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
    version: 2,
    exportDate: exportTimestamp,
    hourlyRate: state.hourlyRate,
    monthlySalary: state.monthlySalary,
    schedule: state.schedule,
    categories: state.categories,
    transactions: state.transactions
  }, null, 2));

  downloadFile(dataStr, `budget-sauvegarde-${state.currentYear}.json`);
  renderSystemStats();
  showToast('Sauvegarde JSON téléchargée !');
}

/**
 * Restaure une sauvegarde JSON
 * @param {File} file
 */
function importDataJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.categories && data.transactions) {
        state.categories = data.categories;
        state.transactions = data.transactions;

        if (data.hourlyRate && !isNaN(data.hourlyRate)) {
          state.hourlyRate = parseFloat(data.hourlyRate);
          const rateInp = document.getElementById('rtHourlyRateInput');
          if (rateInp) rateInp.value = state.hourlyRate;
        }

        if (data.monthlySalary && !isNaN(data.monthlySalary)) {
          state.monthlySalary = parseFloat(data.monthlySalary);
          const salInp = document.getElementById('rtMonthlySalaryInput');
          if (salInp) salInp.value = state.monthlySalary.toFixed(2);
        }

        if (data.schedule) {
          state.schedule = data.schedule;
          if (typeof syncScheduleInputs === 'function') syncScheduleInputs();
        }

        saveData();

        if (typeof renderCategorySelects === 'function') renderCategorySelects();
        if (typeof renderAllCategoriesView === 'function') renderAllCategoriesView();
        if (typeof renderCurrentMonthView === 'function') renderCurrentMonthView();
        if (typeof updateRealtimeStaticKPIs === 'function') updateRealtimeStaticKPIs();
        if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
          renderVisualizationCenter();
        }
        renderSystemStats();

        showToast('Sauvegarde restaurée avec succès');
      }
    } catch(err) {
      alert('Format de fichier JSON non valide.');
    }
  };
  reader.readAsText(file);
}

/**
 * Génère et télécharge les icônes PWA en haute définition (192px et 512px)
 */
function downloadPwaIcons() {
  downloadFile(createIconPNG(192), 'icon-192.png');
  setTimeout(() => {
    downloadFile(createIconPNG(512), 'icon-512.png');
  }, 400);
  showToast('Icônes 192px et 512px générées !');
}

/**
 * Réinitialise complètement les données locales avec confirmation de sécurité
 */
window.resetAllData = function() {
  const confirm1 = confirm("⚠️ ATTENTION : Êtes-vous sûr de vouloir réinitialiser toutes les données locales de l'application ?\n\nToutes vos opérations saisies seront définitivement effacées.");
  if (!confirm1) return;

  const confirm2 = confirm("CONFIRMATION FINALE : Voulez-vous vraiment continuer et repartir d'un compte vierge ?\n\n(Astuce : Téléchargez une sauvegarde JSON avant si vous souhaitez archiver vos comptes actuels).");
  if (!confirm2) return;

  state.transactions = [];
  state.categories = [...BASE_CATEGORIES];
  state.hourlyRate = DEFAULT_HOURLY_RATE;
  state.monthlySalary = Math.round(DEFAULT_HOURLY_RATE * 8 * (260 / 12) * 100) / 100;
  state.schedule = { ...DEFAULT_SCHEDULE };
  localStorage.removeItem('budget_last_backup_date');
  localStorage.removeItem(STORAGE_KEYS.MONTHLY_SALARY);

  saveData();

  if (typeof renderCategorySelects === 'function') renderCategorySelects();
  if (typeof renderAllCategoriesView === 'function') renderAllCategoriesView();
  if (typeof renderCurrentMonthView === 'function') renderCurrentMonthView();
  if (typeof updateRealtimeStaticKPIs === 'function') updateRealtimeStaticKPIs();
  if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
    renderVisualizationCenter();
  }
  renderSystemStats();

  showToast('Toutes les données ont été réinitialisées.');
};

/**
 * Configure les écouteurs d'événements pour la sauvegarde et les icônes
 */
function setupBackupEventListeners() {
  const btnExport = document.getElementById('btnExportJson');
  if (btnExport) {
    btnExport.addEventListener('click', exportDataJson);
  }

  const inputImport = document.getElementById('inputImportJson');
  if (inputImport) {
    inputImport.addEventListener('change', (e) => {
      importDataJson(e.target.files[0]);
    });
  }

  const btnIcons = document.getElementById('btnDownloadIcons');
  if (btnIcons) {
    btnIcons.addEventListener('click', downloadPwaIcons);
  }

  const btnRefresh = document.getElementById('btnRefreshSystemStats');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      renderSystemStats();
      showToast('Métriques système actualisées');
    });
  }

  const btnReset = document.getElementById('btnResetAllData');
  if (btnReset) {
    btnReset.addEventListener('click', window.resetAllData);
  }

  // Écoute des changements de connectivité réseau
  window.addEventListener('online', renderSystemStats);
  window.addEventListener('offline', renderSystemStats);
}

// Export pour environnements modules / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initServiceWorker,
    renderSystemStats,
    exportDataJson,
    importDataJson,
    downloadPwaIcons,
    setupBackupEventListeners
  };
}
