/**
 * ==========================================================================
 * js/state.js - Gestion de l'état global et persistance LocalStorage
 * ==========================================================================
 */

const nowInitial = new Date();

let state = {
  currentYear: nowInitial.getFullYear(),
  currentMonth: nowInitial.getMonth(),
  categories: [],
  transactions: [],
  selectedCatsForChart: [],
  chartMode: 'categories', // conservé pour compatibilité
  theme: 'light',
  hourlyRate: DEFAULT_HOURLY_RATE,
  monthlySalary: null,
  schedule: { ...DEFAULT_SCHEDULE },
  activeTab: 'view-month',
  txSearchTerm: '',
  txFilterType: 'all',
  txFilterCatId: 'all'
};

/* --- ÉTAT SPÉCIFIQUE AU CENTRE DE VISUALISATION --- */
let vizState = {
  mode: 'minmax', // 'minmax', 'trends', 'breakdown', 'balance'
  year: nowInitial.getFullYear(),
  horizon: 'year', // 'year', 'rolling12', 'last6', 'all'
  minNonZero: true, // true = Min sur mois actifs (> 0 €), false = Min absolu
  sort: 'maxDesc', // 'maxDesc', 'totalDesc', 'amplitudeDesc', 'minAsc', 'nameAsc'
  filterType: 'expense', // 'expense', 'income', 'all'
  trendChartType: 'line', // 'line', 'bar', 'area'
  breakdownType: 'expense', // 'expense', 'income'
  soloCatId: null,
  searchCat: '',
  selectedDetailCatId: null
};

/* --- INSTANCES DE GRAPHIQUES CHART.JS --- */
let chartInstance = null;
let chartInstances = {
  evolution: null,
  minMax: null,
  breakdown: null,
  balance: null,
  categoryModal: null
};

function destroyChart(name) {
  if (chartInstances[name]) {
    try { chartInstances[name].destroy(); } catch (e) {}
    chartInstances[name] = null;
  }
}

function destroyAllVizCharts() {
  Object.keys(chartInstances).forEach(destroyChart);
}

/**
 * Sauvegarde l'ensemble de l'état dans le LocalStorage
 */
function saveData() {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
  localStorage.setItem(STORAGE_KEYS.HOURLY_RATE, state.hourlyRate.toString());
  if (state.monthlySalary !== null && !isNaN(state.monthlySalary) && state.monthlySalary > 0) {
    localStorage.setItem(STORAGE_KEYS.MONTHLY_SALARY, state.monthlySalary.toString());
  }
  localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(state.schedule));
}

/**
 * Applique le thème (clair ou sombre) et actualise les graphiques
 * @param {'light'|'dark'} theme
 */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
    renderVisualizationCenter();
  }
}

/**
 * Initialise l'état applicatif depuis le LocalStorage
 */
function initState() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  applyTheme(savedTheme);

  const savedCats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
  const savedTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  const savedRate = localStorage.getItem(STORAGE_KEYS.HOURLY_RATE) || localStorage.getItem('realtime_hourly_rate');
  const savedSalary = localStorage.getItem(STORAGE_KEYS.MONTHLY_SALARY);
  const savedSchedule = localStorage.getItem(STORAGE_KEYS.SCHEDULE);

  state.categories = savedCats ? JSON.parse(savedCats) : [...BASE_CATEGORIES];
  state.transactions = savedTxs ? JSON.parse(savedTxs) : [];

  if (savedRate && !isNaN(parseFloat(savedRate)) && parseFloat(savedRate) > 0) {
    state.hourlyRate = parseFloat(savedRate);
  } else {
    state.hourlyRate = DEFAULT_HOURLY_RATE;
  }

  if (savedSchedule) {
    try {
      const parsed = JSON.parse(savedSchedule);
      if (parsed.morningStart && parsed.morningEnd && parsed.afternoonStart && parsed.afternoonEnd) {
        state.schedule = parsed;
      }
    } catch (e) {}
  }

  if (savedSalary && !isNaN(parseFloat(savedSalary)) && parseFloat(savedSalary) > 0) {
    state.monthlySalary = parseFloat(savedSalary);
  } else {
    // Calcul par défaut basé sur l'horaire actuel
    state.monthlySalary = Math.round(state.hourlyRate * 8 * (260 / 12) * 100) / 100;
  }

  state.selectedCatsForChart = state.categories
    .filter(c => c.type === 'expense')
    .map(c => c.id);

  saveData();
}

// Export pour environnements modules / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    nowInitial,
    state,
    vizState,
    chartInstance,
    chartInstances,
    destroyChart,
    destroyAllVizCharts,
    saveData,
    applyTheme,
    initState
  };
}