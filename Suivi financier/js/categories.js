/**
 * ==========================================================================
 * js/categories.js - Gestion des catégories personnalisées (CRUD)
 * ==========================================================================
 */

/**
 * Affiche la liste des catégories dans l'onglet de gestion
 */
function renderAllCategoriesView() {
  const container = document.getElementById('allCategoriesList');
  if (!container) return;
  container.innerHTML = '';

  // Mise à jour des compteurs statistiques
  const totalCountEl = document.getElementById('catStatTotalCount');
  const expCountEl = document.getElementById('catStatExpenseCount');
  const incCountEl = document.getElementById('catStatIncomeCount');

  const expCats = state.categories.filter(c => c.type === 'expense');
  const incCats = state.categories.filter(c => c.type === 'income');

  if (totalCountEl) totalCountEl.textContent = state.categories.length;
  if (expCountEl) expCountEl.textContent = expCats.length;
  if (incCountEl) incCountEl.textContent = incCats.length;

  if (state.categories.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 24px; font-size: 0.9rem;">Aucune catégorie définie. Cliquez sur <strong>+ Nouvelle catégorie</strong> ci-dessus.</div>`;
    return;
  }

  state.categories.forEach(cat => {
    const isInc = cat.type === 'income';
    const catTxs = state.transactions.filter(t => t.categoryId === cat.id);
    const catSum = catTxs.reduce((sum, t) => sum + t.amount, 0);

    const card = document.createElement('div');
    card.className = 'cat-card-modern';
    card.innerHTML = `
      <div class="cat-card-left">
        <span class="cat-dot" style="background:${cat.color};"></span>
        <div class="cat-card-info">
          <div class="cat-card-name-row">
            <span class="cat-card-name">${escapeHtml(cat.name)}</span>
            <span class="cat-type-pill ${isInc ? 'pill-income' : 'pill-expense'}">
              ${isInc ? 'Revenu' : 'Dépense'}
            </span>
          </div>
          <div class="cat-card-sub">
            ${catTxs.length} opération${catTxs.length > 1 ? 's' : ''} &bull; Cumul : <strong>${formatCur(catSum)}</strong>
          </div>
        </div>
      </div>
      <div class="cat-card-actions">
        <button class="btn-cat-action analyze" onclick="window.openCategoryDetail('${cat.id}')" title="Consulter l'analyse détaillée">
          <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          <span>Analyser</span>
        </button>
        <button class="btn-cat-action delete" onclick="window.deleteCategory('${cat.id}')" title="Supprimer la catégorie">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * Remplit les listes déroulantes de sélection de catégorie (ex: modale d'ajout)
 */
function renderCategorySelects() {
  const select = document.getElementById('expenseCategory');
  if (!select) return;
  select.innerHTML = '';
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.type === 'income' ? 'Revenu' : 'Dépense'})`;
    select.appendChild(opt);
  });
}

/**
 * Supprime une catégorie et ses opérations associées
 * @param {string} id
 */
window.deleteCategory = function(id) {
  if (confirm('Supprimer cette catégorie ? Les opérations associées seront également effacées.')) {
    state.categories = state.categories.filter(c => c.id !== id);
    state.transactions = state.transactions.filter(t => t.categoryId !== id);
    state.selectedCatsForChart = state.selectedCatsForChart.filter(cId => cId !== id);
    saveData();
    renderCategorySelects();
    renderAllCategoriesView();
    renderCurrentMonthView();
    if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
      renderVisualizationCenter();
    }
    showToast('Catégorie supprimée');
  }
};

/**
 * Initialise les écouteurs d'événements pour la gestion des catégories
 */
function setupCategoriesEventListeners() {
  const modalCat = document.getElementById('modalAddCategory');
  const btnOpenCat = document.getElementById('btnOpenNewCatModal');
  const btnCloseCat = document.getElementById('btnCloseCatModal');
  const formCat = document.getElementById('formAddCategory');

  if (btnOpenCat && modalCat) {
    btnOpenCat.addEventListener('click', () => modalCat.classList.add('active'));
  }

  if (btnCloseCat && modalCat) {
    btnCloseCat.addEventListener('click', () => modalCat.classList.remove('active'));
    modalCat.addEventListener('click', (e) => {
      if (e.target === modalCat) modalCat.classList.remove('active');
    });
  }

  if (formCat && modalCat) {
    formCat.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('catName').value.trim();
      const type = document.getElementById('catType').value;
      const color = document.getElementById('catColor').value;

      const newCat = { id: 'cat-' + Date.now(), name, type, color };
      state.categories.push(newCat);
      if (type === 'expense') state.selectedCatsForChart.push(newCat.id);

      saveData();
      modalCat.classList.remove('active');
      formCat.reset();
      renderCategorySelects();
      renderAllCategoriesView();
      if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
        renderVisualizationCenter();
      }
      showToast('Catégorie créée');
    });
  }
}

// Export pour environnements modules / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderAllCategoriesView,
    renderCategorySelects,
    setupCategoriesEventListeners
  };
}
