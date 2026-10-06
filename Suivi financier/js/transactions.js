/**
 * ==========================================================================
 * js/transactions.js - Gestion des opérations et de la vue mensuelle
 * ==========================================================================
 */

/**
 * Met à jour l'intitulé du mois et de l'année dans l'en-tête
 */
function renderMonthDisplay() {
  const disp = document.getElementById('displayMonth');
  if (disp) {
    disp.textContent = `${MONTH_NAMES[state.currentMonth]} ${state.currentYear}`;
  }
}

/**
 * Calcule les totaux mensuels, affiche les cartes KPI,
 * les jauges d'impact par dépense et la liste des transactions
 */
function renderCurrentMonthView() {
  const monthStr = String(state.currentMonth + 1).padStart(2, '0');
  const prefix = `${state.currentYear}-${monthStr}`;

  const currentTxs = state.transactions.filter(t => t.date.startsWith(prefix));

  let incomeTotal = 0;
  let expenseTotal = 0;
  let expenseCount = 0;
  let incomeCount = 0;

  const totalsByCat = {};
  state.categories.forEach(c => totalsByCat[c.id] = 0);

  currentTxs.forEach(t => {
    const cat = state.categories.find(c => c.id === t.categoryId);
    if (cat) {
      totalsByCat[cat.id] += t.amount;
      if (cat.type === 'income') {
        incomeTotal += t.amount;
        incomeCount++;
      } else {
        expenseTotal += t.amount;
        expenseCount++;
      }
    }
  });

  const netBalance = incomeTotal - expenseTotal;

  // Cartes statistiques en haut
  const incElem = document.getElementById('stat-income');
  const incSub = document.getElementById('stat-income-sub');
  if (incElem) incElem.textContent = formatCur(incomeTotal);
  if (incSub) incSub.textContent = `${incomeCount} entrée${incomeCount > 1 ? 's' : ''} ce mois-ci`;

  const expElem = document.getElementById('stat-expense');
  const expSub = document.getElementById('stat-expense-sub');
  if (expElem) expElem.textContent = formatCur(expenseTotal);
  if (expSub) expSub.textContent = `${expenseCount} dépense${expenseCount > 1 ? 's' : ''} ce mois-ci`;

  const balElem = document.getElementById('stat-balance');
  const balSub = document.getElementById('stat-balance-sub');
  if (balElem) {
    balElem.textContent = formatCur(netBalance);
    if (netBalance > 0) {
      balElem.style.color = 'var(--income)';
      if (balSub) balSub.textContent = 'Épargne positive';
    } else if (netBalance < 0) {
      balElem.style.color = 'var(--expense)';
      if (balSub) balSub.textContent = 'Déficit mensuel';
    } else {
      balElem.style.color = 'var(--text)';
      if (balSub) balSub.textContent = 'Équilibre';
    }
  }

  // Jauges de dépenses ordonnées par influence
  const barsContainer = document.getElementById('categoryBarsList');
  if (barsContainer) {
    barsContainer.innerHTML = '';

    const sortedExpenseCats = state.categories
      .filter(c => c.type === 'expense')
      .map(cat => ({
        ...cat,
        total: totalsByCat[cat.id] || 0
      }))
      .sort((a, b) => b.total - a.total);

    if (expenseTotal === 0) {
      barsContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.86rem; padding: 10px 0;">Aucune dépense enregistrée pour ce mois.</div>`;
    } else {
      sortedExpenseCats.forEach((cat, index) => {
        const pct = expenseTotal > 0 ? ((cat.total / expenseTotal) * 100).toFixed(1) : 0;
        const div = document.createElement('div');
        div.className = 'cat-bar-item';
        div.innerHTML = `
          <div class="cat-bar-header">
            <div class="cat-name-label">
              <span class="cat-rank-badge">#${index + 1}</span>
              <span class="cat-dot" style="background:${cat.color}"></span>
              <span>${escapeHtml(cat.name)}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); font-size:0.82rem; margin-right:8px; font-weight:700;">${pct}%</span>
              <strong>${formatCur(cat.total)}</strong>
            </div>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${pct}%; background:${cat.color};"></div>
          </div>
        `;
        barsContainer.appendChild(div);
      });
    }
  }

  // Mettre à jour la liste des catégories dans le filtre des transactions
  renderTxCategoryFilterOptions();

  // Filtrage interactif en direct des transactions
  const filteredTxs = currentTxs.filter(tx => {
    const cat = state.categories.find(c => c.id === tx.categoryId) || { name: 'Autre', type: 'expense' };

    // Filtre par type (toutes, dépenses, rentrées)
    if (state.txFilterType && state.txFilterType !== 'all') {
      if (cat.type !== state.txFilterType) return false;
    }

    // Filtre par catégorie
    if (state.txFilterCatId && state.txFilterCatId !== 'all') {
      if (tx.categoryId !== state.txFilterCatId) return false;
    }

    // Recherche par mot-clé (note, nom catégorie, ou montant)
    if (state.txSearchTerm && state.txSearchTerm.trim() !== '') {
      const q = state.txSearchTerm.toLowerCase().trim();
      const matchNote = (tx.note || '').toLowerCase().includes(q);
      const matchCat = (cat.name || '').toLowerCase().includes(q);
      const matchAmt = tx.amount.toString().includes(q) || tx.amount.toFixed(2).replace('.', ',').includes(q);
      if (!matchNote && !matchCat && !matchAmt) return false;
    }

    return true;
  });

  // Calcul du solde filtré
  let filteredSum = 0;
  filteredTxs.forEach(t => {
    const cat = state.categories.find(c => c.id === t.categoryId);
    if (cat && cat.type === 'income') {
      filteredSum += t.amount;
    } else {
      filteredSum -= t.amount;
    }
  });

  const countSubtitle = document.getElementById('txCountSubtitle');
  if (countSubtitle) {
    if (currentTxs.length === 0) {
      countSubtitle.textContent = '0 opération enregistrée ce mois-ci';
    } else if (filteredTxs.length !== currentTxs.length) {
      countSubtitle.textContent = `${filteredTxs.length} résultat${filteredTxs.length > 1 ? 's' : ''} (sur ${currentTxs.length} opération${currentTxs.length > 1 ? 's' : ''})`;
    } else {
      countSubtitle.textContent = `${currentTxs.length} opération${currentTxs.length > 1 ? 's' : ''} enregistrée${currentTxs.length > 1 ? 's' : ''}`;
    }
  }

  const filteredBadge = document.getElementById('txFilteredTotalBadge');
  if (filteredBadge) {
    filteredBadge.textContent = `${filteredTxs.length !== currentTxs.length ? 'Total filtré : ' : 'Solde net : '}${formatCur(filteredSum)}`;
    filteredBadge.style.color = filteredSum >= 0 ? 'var(--income)' : 'var(--expense)';
  }

  // Liste détaillée des opérations avec modification, duplication et suppression
  const txContainer = document.getElementById('transactionsList');
  if (txContainer) {
    txContainer.innerHTML = '';

    if (currentTxs.length === 0) {
      txContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:24px 16px; font-size:0.88rem;">Aucune opération enregistrée pour ce mois. Cliquez sur <strong>+ Ajouter</strong> en haut à droite.</div>`;
    } else if (filteredTxs.length === 0) {
      txContainer.innerHTML = `
        <div style="text-align:center; color:var(--text-muted); padding:24px 16px; font-size:0.88rem;">
          Aucune opération ne correspond à vos critères de recherche.
          <br><button type="button" class="btn-action-ghost" onclick="window.resetTxFilters()" style="margin: 10px auto 0; font-size: 0.78rem;">Réinitialiser les filtres</button>
        </div>
      `;
    } else {
      filteredTxs.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
        const cat = state.categories.find(c => c.id === tx.categoryId) || { name: 'Autre', color: '#94a3b8', type: 'expense' };
        const isInc = cat.type === 'income';

        const row = document.createElement('div');
        row.className = 'tx-item';
        row.innerHTML = `
          <div class="tx-left">
            <div class="tx-badge-dot" style="background:${cat.color}"></div>
            <div>
              <div class="tx-title">${escapeHtml(tx.note || cat.name)}</div>
              <div class="tx-sub">${escapeHtml(cat.name)} &bull; ${formatDateFR(tx.date)}</div>
            </div>
          </div>
          <div class="tx-right">
            <div class="tx-amount" style="color:${isInc ? 'var(--income)' : 'var(--text)'};">
              ${isInc ? '+' : '-'}${formatCur(tx.amount)}
            </div>
            <button class="tx-action-btn duplicate" onclick="window.duplicateTransaction('${tx.id}')" title="Dupliquer l'opération">
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="tx-action-btn edit" onclick="window.editTransaction('${tx.id}')" title="Modifier">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="tx-action-btn delete" onclick="window.deleteTransaction('${tx.id}')" title="Supprimer">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `;
        txContainer.appendChild(row);
      });
    }
  }
}

/**
 * Remplit les options de filtre de catégorie dans la liste des opérations
 */
function renderTxCategoryFilterOptions() {
  const select = document.getElementById('txFilterCategory');
  if (!select) return;
  const currentVal = state.txFilterCatId || 'all';

  select.innerHTML = '<option value="all">Toutes les catégories</option>';
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.type === 'income' ? 'Revenu' : 'Dépense'})`;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

/**
 * Réinitialise les filtres de recherche et de catégorie
 */
window.resetTxFilters = function() {
  state.txSearchTerm = '';
  state.txFilterType = 'all';
  state.txFilterCatId = 'all';

  const searchInp = document.getElementById('txSearchInput');
  if (searchInp) searchInp.value = '';

  const clearBtn = document.getElementById('btnClearTxSearch');
  if (clearBtn) clearBtn.style.display = 'none';

  document.querySelectorAll('#txTypePills .tx-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-type') === 'all');
  });

  const catSelect = document.getElementById('txFilterCategory');
  if (catSelect) catSelect.value = 'all';

  renderCurrentMonthView();
};

/**
 * Duplique une opération en 1 clic
 * @param {string} id
 */
window.duplicateTransaction = function(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  const newTx = {
    id: 'tx-' + Date.now(),
    categoryId: tx.categoryId,
    amount: tx.amount,
    date: tx.date,
    note: tx.note ? `${tx.note} (copie)` : 'Copie'
  };

  state.transactions.unshift(newTx);
  saveData();
  renderCurrentMonthView();
  if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
    renderVisualizationCenter();
  }
  showToast('Opération dupliquée !');
};

/**
 * Exporte les opérations du mois courant en fichier CSV structuré
 */
function exportCurrentMonthCsv() {
  const monthStr = String(state.currentMonth + 1).padStart(2, '0');
  const prefix = `${state.currentYear}-${monthStr}`;
  const currentTxs = state.transactions.filter(t => t.date.startsWith(prefix));

  if (currentTxs.length === 0) {
    showToast('Aucune opération à exporter pour ce mois.');
    return;
  }

  const rows = [
    ['Date', 'Type', 'Categorie', 'Montant_EUR', 'Note']
  ];

  currentTxs.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    const cat = state.categories.find(c => c.id === t.categoryId) || { name: 'Autre', type: 'expense' };
    const typeLabel = cat.type === 'income' ? 'Revenu' : 'Depense';
    rows.push([
      t.date,
      typeLabel,
      `"${cat.name.replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      `"${(t.note || '').replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = rows.map(r => r.join(';')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, `budget-${state.currentYear}-${monthStr}.csv`);
  URL.revokeObjectURL(url);
  showToast('Export CSV mensuel téléchargé !');
}

/**
 * Ouvre la boîte de dialogue d'impression système
 */
function printMonthSummary() {
  window.print();
}

/**
 * Ouvre la modale d'édition pour une opération existante
 * @param {string} id
 */
window.editTransaction = function(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('editTxId').value = tx.id;
  document.getElementById('expenseCategory').value = tx.categoryId;
  document.getElementById('expenseAmount').value = tx.amount;
  document.getElementById('expenseDate').value = tx.date;
  document.getElementById('expenseNote').value = tx.note || '';

  document.getElementById('modalExpenseTitle').textContent = "Modifier l'opération";
  document.getElementById('btnSubmitExpense').textContent = "Enregistrer les modifications";

  document.getElementById('modalExpense').classList.add('active');
};

/**
 * Supprime une opération
 * @param {string} id
 */
window.deleteTransaction = function(id) {
  if (confirm('Voulez-vous supprimer cette opération ?')) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveData();
    renderCurrentMonthView();
    if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
      renderVisualizationCenter();
    }
    showToast('Opération supprimée');
  }
};

/**
 * Initialise les écouteurs d'événements pour les transactions
 */
function setupTransactionEventListeners() {
  const modalExp = document.getElementById('modalExpense');
  const formExp = document.getElementById('formExpense');
  const btnOpenExp = document.getElementById('btnOpenAddModal');
  const btnCloseExp = document.getElementById('btnCloseExpenseModal');

  // Barre de recherche et filtres instantanés
  const searchInput = document.getElementById('txSearchInput');
  const clearSearchBtn = document.getElementById('btnClearTxSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.txSearchTerm = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.style.display = state.txSearchTerm ? 'block' : 'none';
      }
      renderCurrentMonthView();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      state.txSearchTerm = '';
      if (searchInput) searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      renderCurrentMonthView();
    });
  }

  // Pilules de filtrage par type (Toutes / Dépenses / Rentrées)
  document.querySelectorAll('#txTypePills .tx-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#txTypePills .tx-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.txFilterType = btn.getAttribute('data-type');
      renderCurrentMonthView();
    });
  });

  // Filtre par catégorie
  const filterCatSelect = document.getElementById('txFilterCategory');
  if (filterCatSelect) {
    filterCatSelect.addEventListener('change', (e) => {
      state.txFilterCatId = e.target.value;
      renderCurrentMonthView();
    });
  }

  // Actions de l'en-tête : Export CSV & Impression
  const btnExportCsv = document.getElementById('btnExportMonthCsv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', exportCurrentMonthCsv);
  }

  const btnPrint = document.getElementById('btnPrintMonthSummary');
  if (btnPrint) {
    btnPrint.addEventListener('click', printMonthSummary);
  }

  if (btnOpenExp && modalExp) {
    btnOpenExp.addEventListener('click', () => {
      document.getElementById('editTxId').value = '';
      formExp.reset();

      // Pré-remplir la date du jour avec le mois en cours
      const today = new Date();
      let dayStr = String(today.getDate()).padStart(2, '0');
      const mStr = String(state.currentMonth + 1).padStart(2, '0');
      document.getElementById('expenseDate').value = `${state.currentYear}-${mStr}-${dayStr}`;

      document.getElementById('modalExpenseTitle').textContent = "Ajouter une opération";
      document.getElementById('btnSubmitExpense').textContent = "Enregistrer l'opération";
      modalExp.classList.add('active');
    });
  }

  if (btnCloseExp && modalExp) {
    btnCloseExp.addEventListener('click', () => modalExp.classList.remove('active'));
    modalExp.addEventListener('click', (e) => {
      if (e.target === modalExp) modalExp.classList.remove('active');
    });
  }

  if (formExp) {
    formExp.addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = document.getElementById('editTxId').value;
      const catId = document.getElementById('expenseCategory').value;
      const amount = parseFloat(document.getElementById('expenseAmount').value);
      const date = document.getElementById('expenseDate').value;
      const note = document.getElementById('expenseNote').value.trim();

      if (editId) {
        const tx = state.transactions.find(t => t.id === editId);
        if (tx) {
          tx.categoryId = catId;
          tx.amount = amount;
          tx.date = date;
          tx.note = note;
          showToast('Opération modifiée');
        }
      } else {
        state.transactions.push({
          id: 'tx-' + Date.now(),
          categoryId: catId,
          amount,
          date,
          note
        });
        showToast('Opération enregistrée');
      }

      saveData();
      modalExp.classList.remove('active');
      renderCurrentMonthView();
      if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
        renderVisualizationCenter();
      }
    });
  }

  // Navigation des mois (Mois précédent / Mois suivant)
  const btnPrev = document.getElementById('btnPrevMonth');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      state.currentMonth--;
      if (state.currentMonth < 0) {
        state.currentMonth = 11;
        state.currentYear--;
      }
      renderMonthDisplay();
      renderCurrentMonthView();
      if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
        renderVisualizationCenter();
      }
    });
  }

  const btnNext = document.getElementById('btnNextMonth');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      state.currentMonth++;
      if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear++;
      }
      renderMonthDisplay();
      renderCurrentMonthView();
      if (typeof renderVisualizationCenter === 'function' && state.activeTab === 'view-charts') {
        renderVisualizationCenter();
      }
    });
  }
}

// Export pour environnements modules / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderMonthDisplay,
    renderCurrentMonthView,
    renderTxCategoryFilterOptions,
    exportCurrentMonthCsv,
    printMonthSummary,
    setupTransactionEventListeners
  };
}