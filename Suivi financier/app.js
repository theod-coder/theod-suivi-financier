/**
 * ==========================================================================
 * app.js - Point d'entrée principal & Orchestrateur de l'application
 * ==========================================================================
 * Mon Budget - PWA 100% Locale & Hors-Ligne
 * 
 * Architecture modulaire dans /js :
 * - js/constants.js     : Constantes et configurations de base
 * - js/utils.js         : Formatage monétaire, dates, toasts, génération d'icônes
 * - js/state.js         : État global (budget, cockpit, thèmes) et persistance
 * - js/realtime.js      : Compteur de gains en direct au travail (60 FPS)
 * - js/transactions.js  : Vue mensuelle et gestion des opérations (CRUD)
 * - js/visualization.js : Centre de Visualisation, Min/Max, Donut, Flux, Insights
 * - js/categories.js    : Gestion des catégories personnalisées
 * - js/backup.js        : Sauvegarde / Restauration JSON et icônes PWA
 * ==========================================================================
 */

/**
 * Initialise tous les modules et l'interface utilisateur
 */
function initApp() {
  // 1. Initialiser le service worker pour le mode hors-ligne
  if (typeof initServiceWorker === 'function') {
    initServiceWorker();
  }

  // 2. Charger les données du stockage local
  initState();

  // 3. Synchroniser les champs du module Temps Réel
  if (typeof syncScheduleInputs === 'function') {
    syncScheduleInputs();
  }

  // 4. Initialiser tous les écouteurs d'événements
  setupEventListeners();

  // 5. Affichage initial de la vue du mois et des sélecteurs
  renderMonthDisplay();
  renderCurrentMonthView();
  renderCategorySelects();
  updateRealtimeStaticKPIs();
  if (typeof renderSystemStats === 'function') {
    renderSystemStats();
  }

  // 6. Optimisation batterie : couper la boucle 60 FPS si l'application est en arrière-plan
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (typeof stopRealtimeLoop === 'function') stopRealtimeLoop();
    } else if (state.activeTab === 'view-realtime') {
      if (typeof startRealtimeLoop === 'function') startRealtimeLoop();
    }
  });
}

/**
 * Configure les écouteurs de navigation globale et délègue aux modules
 */
function setupEventListeners() {
  // Bascule Thème clair / sombre
  const themeBtn = document.getElementById('btnToggleTheme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(state.theme === 'light' ? 'dark' : 'light');
    });
  }

  // Navigation par onglets (Dock flottant inférieur)
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-tab');
      state.activeTab = target;

      // Bascule des vues d'onglets
      document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');
      const targetElem = document.getElementById(target);
      if (targetElem) targetElem.style.display = 'block';

      // Afficher le sélecteur de mois uniquement sur la vue mois
      const monthBar = document.getElementById('monthBar');
      if (monthBar) monthBar.style.display = (target === 'view-month') ? 'block' : 'none';

      // Gestion de la boucle 60 FPS du module Temps Réel
      if (target === 'view-realtime') {
        if (typeof startRealtimeLoop === 'function') startRealtimeLoop();
      } else {
        if (typeof stopRealtimeLoop === 'function') stopRealtimeLoop();
      }

      // Rafraîchissement automatique lors de l'accès à un onglet
      if (target === 'view-month' && typeof renderCurrentMonthView === 'function') {
        renderCurrentMonthView();
      }
      if (target === 'view-charts' && typeof renderVisualizationCenter === 'function') {
        renderVisualizationCenter();
      }
      if (target === 'view-categories' && typeof renderAllCategoriesView === 'function') {
        renderAllCategoriesView();
      }
      if (target === 'view-data' && typeof renderSystemStats === 'function') {
        renderSystemStats();
      }
    });
  });

  // Initialisation des écouteurs des modules spécialisés
  if (typeof setupTransactionEventListeners === 'function') setupTransactionEventListeners();
  if (typeof setupRealtimeEventListeners === 'function') setupRealtimeEventListeners();
  if (typeof setupVisualizationEventListeners === 'function') setupVisualizationEventListeners();
  if (typeof setupCategoriesEventListeners === 'function') setupCategoriesEventListeners();
  if (typeof setupBackupEventListeners === 'function') setupBackupEventListeners();
}

// Lancement à l'événement DOMContentLoaded
window.addEventListener('DOMContentLoaded', initApp);