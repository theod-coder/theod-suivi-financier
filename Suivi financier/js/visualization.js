/**
 * ==========================================================================
 * js/visualization.js - Centre de Visualisation & Analytique Avancé (Chart.js)
 * ==========================================================================
 */

/**
 * Calcule la liste des mois de la période sélectionnée
 */
function getVizPeriodMonths() {
  const months = [];
  const yr = vizState.year;

  if (vizState.horizon === 'year') {
    for (let m = 0; m < 12; m++) {
      const mStr = String(m + 1).padStart(2, '0');
      months.push({
        year: yr,
        month: m,
        key: `${yr}-${mStr}`,
        label: `${MONTH_NAMES[m]} ${yr}`,
        shortLabel: MONTH_NAMES[m].substring(0, 3)
      });
    }
  } else if (vizState.horizon === 'rolling12') {
    const endYear = state.currentYear;
    const endMonth = state.currentMonth;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(endYear, endMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const mStr = String(m + 1).padStart(2, '0');
      months.push({
        year: y,
        month: m,
        key: `${y}-${mStr}`,
        label: `${MONTH_NAMES[m]} ${y}`,
        shortLabel: `${MONTH_NAMES[m].substring(0, 3)} ${String(y).slice(-2)}`
      });
    }
  } else if (vizState.horizon === 'last6') {
    const endYear = state.currentYear;
    const endMonth = state.currentMonth;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(endYear, endMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const mStr = String(m + 1).padStart(2, '0');
      months.push({
        year: y,
        month: m,
        key: `${y}-${mStr}`,
        label: `${MONTH_NAMES[m]} ${y}`,
        shortLabel: `${MONTH_NAMES[m].substring(0, 3)} ${String(y).slice(-2)}`
      });
    }
  } else if (vizState.horizon === 'all') {
    const dates = state.transactions.map(t => t.date).filter(Boolean).sort();
    let startYear = yr;
    let startMonth = 0;
    let endYear = yr;
    let endMonth = 11;

    if (dates.length > 0) {
      const pStart = dates[0].split('-');
      const pEnd = dates[dates.length - 1].split('-');
      startYear = parseInt(pStart[0], 10);
      startMonth = parseInt(pStart[1], 10) - 1;
      endYear = parseInt(pEnd[0], 10);
      endMonth = parseInt(pEnd[1], 10) - 1;
    }

    const cur = new Date(startYear, startMonth, 1);
    const end = new Date(endYear, endMonth, 1);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const mStr = String(m + 1).padStart(2, '0');
      months.push({
        year: y,
        month: m,
        key: `${y}-${mStr}`,
        label: `${MONTH_NAMES[m]} ${y}`,
        shortLabel: `${MONTH_NAMES[m].substring(0, 3)} ${String(y).slice(-2)}`
      });
      cur.setMonth(cur.getMonth() + 1);
    }

    if (months.length === 0) {
      for (let m = 0; m < 12; m++) {
        const mStr = String(m + 1).padStart(2, '0');
        months.push({
          year: yr,
          month: m,
          key: `${yr}-${mStr}`,
          label: `${MONTH_NAMES[m]} ${yr}`,
          shortLabel: MONTH_NAMES[m].substring(0, 3)
        });
      }
    }
  }

  return months;
}

/**
 * Calcule toutes les statistiques financières et Min/Max par catégorie
 */
function computeAllCategoryStats(periodMonths) {
  let totalPeriodExpenses = 0;
  let totalPeriodIncomes = 0;

  const stats = state.categories.map(cat => {
    const monthlyAmounts = [];
    let catTotal = 0;
    const periodTxs = [];

    periodMonths.forEach(m => {
      const txs = state.transactions.filter(t => t.categoryId === cat.id && t.date.startsWith(m.key));
      const sum = txs.reduce((acc, t) => acc + t.amount, 0);
      monthlyAmounts.push({
        month: m,
        amount: sum
      });
      catTotal += sum;
      periodTxs.push(...txs);
    });

    if (cat.type === 'expense') totalPeriodExpenses += catTotal;
    else totalPeriodIncomes += catTotal;

    const activeMonths = monthlyAmounts.filter(x => x.amount > 0);
    const activeCount = activeMonths.length;

    // Moyenne
    const avg = vizState.minNonZero
      ? (activeCount > 0 ? (catTotal / activeCount) : 0)
      : (periodMonths.length > 0 ? (catTotal / periodMonths.length) : 0);

    // Min & Mois du Min
    let min = 0;
    let minMonth = '-';
    if (vizState.minNonZero) {
      if (activeMonths.length > 0) {
        let lowest = activeMonths[0];
        activeMonths.forEach(item => {
          if (item.amount < lowest.amount) lowest = item;
        });
        min = lowest.amount;
        minMonth = lowest.month.label;
      }
    } else {
      if (monthlyAmounts.length > 0) {
        let lowest = monthlyAmounts[0];
        monthlyAmounts.forEach(item => {
          if (item.amount < lowest.amount) lowest = item;
        });
        min = lowest.amount;
        minMonth = lowest.month.label;
      }
    }

    // Max & Mois du Max
    let max = 0;
    let maxMonth = '-';
    if (monthlyAmounts.length > 0) {
      let highest = monthlyAmounts[0];
      monthlyAmounts.forEach(item => {
        if (item.amount > highest.amount) highest = item;
      });
      max = highest.amount;
      maxMonth = highest.month.label;
    }

    const amplitude = Math.max(0, max - min);

    // Transaction unitaire record
    let highestSingleTx = null;
    if (periodTxs.length > 0) {
      highestSingleTx = periodTxs.reduce((prev, curr) => (curr.amount > prev.amount ? curr : prev), periodTxs[0]);
    }

    return {
      cat,
      total: catTotal,
      monthlyAmounts,
      activeCount,
      avg,
      min,
      minMonth,
      max,
      maxMonth,
      amplitude,
      highestSingleTx,
      txCount: periodTxs.length,
      periodTxs,
      percentOfTotal: 0
    };
  });

  // Calcul du pourcentage relatif
  stats.forEach(st => {
    const denom = st.cat.type === 'expense' ? totalPeriodExpenses : totalPeriodIncomes;
    st.percentOfTotal = denom > 0 ? (st.total / denom) * 100 : 0;
  });

  return {
    stats,
    totalPeriodExpenses,
    totalPeriodIncomes,
    periodMonths
  };
}

/**
 * Point d'entrée principal du Centre de Visualisation
 */
function renderVisualizationCenter() {
  const periodMonths = getVizPeriodMonths();
  const statsData = computeAllCategoryStats(periodMonths);

  // Mise à jour de l'en-tête et sous-titre
  const yearDisp = document.getElementById('vizYearDisplay');
  if (yearDisp) yearDisp.textContent = vizState.year;

  const subElem = document.getElementById('vizSubtitleSummary');
  if (subElem) {
    const horizonNames = {
      year: `Année ${vizState.year}`,
      rolling12: '12 mois glissants',
      last6: '6 derniers mois',
      all: 'Tout l\'historique'
    };
    const totalTxsInPeriod = statsData.stats.reduce((acc, s) => acc + s.txCount, 0);
    const activeCatsCount = statsData.stats.filter(s => s.total > 0).length;
    subElem.textContent = `${horizonNames[vizState.horizon]} • ${activeCatsCount} catégories actives • ${totalTxsInPeriod} opérations analysées`;
  }

  // Mise à jour des boutons d'onglets du centre
  document.querySelectorAll('.viz-mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === vizState.mode);
  });

  // Mise à jour des sections visibles
  const views = {
    minmax: 'vizViewMinMax',
    trends: 'vizViewTrends',
    breakdown: 'vizViewBreakdown',
    balance: 'vizViewBalance'
  };

  Object.entries(views).forEach(([m, elemId]) => {
    const elem = document.getElementById(elemId);
    if (elem) elem.style.display = (m === vizState.mode) ? 'block' : 'none';
  });

  // Rendu de la vue active
  if (vizState.mode === 'minmax') {
    renderVizMinMaxView(statsData);
  } else if (vizState.mode === 'trends') {
    renderVizTrendsView(statsData);
  } else if (vizState.mode === 'breakdown') {
    renderVizBreakdownView(statsData);
  } else if (vizState.mode === 'balance') {
    renderVizBalanceView(statsData);
  }

  // Rendu des Insights Intelligents
  renderVizInsights(statsData);
}

// Alias rétro-compatible
function renderEvolutionChart() {
  renderVisualizationCenter();
}

/**
 * ==========================================================================
 * 1. VUE : MIN, MAX & EXTRÊMES PAR CATÉGORIE
 * ==========================================================================
 */
function renderVizMinMaxView(statsData) {
  const { stats } = statsData;
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

  // --- A. Calcul des Flash KPIs Extrêmes Globaux ---
  const expenseStats = stats.filter(s => s.cat.type === 'expense');

  // 1. N°1 des Dépenses
  const topCat = [...expenseStats].sort((a, b) => b.total - a.total)[0];
  const kpiTopName = document.getElementById('kpiTopCatName');
  const kpiTopAmount = document.getElementById('kpiTopCatAmount');
  const kpiTopSub = document.getElementById('kpiTopCatSub');
  if (topCat && topCat.total > 0) {
    if (kpiTopName) kpiTopName.textContent = topCat.cat.name;
    if (kpiTopAmount) kpiTopAmount.textContent = formatCur(topCat.total);
    if (kpiTopSub) kpiTopSub.textContent = `${topCat.percentOfTotal.toFixed(1)}% du budget total`;
  } else {
    if (kpiTopName) kpiTopName.textContent = '-';
    if (kpiTopAmount) kpiTopAmount.textContent = '0,00 €';
    if (kpiTopSub) kpiTopSub.textContent = 'Aucune dépense';
  }

  // 2. Pic Record Mensuel
  let peakRecord = { cat: null, amount: 0, month: '-' };
  expenseStats.forEach(st => {
    st.monthlyAmounts.forEach(mItem => {
      if (mItem.amount > peakRecord.amount) {
        peakRecord = { cat: st.cat, amount: mItem.amount, month: mItem.month.label };
      }
    });
  });
  const kpiPeakName = document.getElementById('kpiPeakCatName');
  const kpiPeakAmount = document.getElementById('kpiPeakAmount');
  const kpiPeakMonth = document.getElementById('kpiPeakMonth');
  if (peakRecord.cat && peakRecord.amount > 0) {
    if (kpiPeakName) kpiPeakName.textContent = peakRecord.cat.name;
    if (kpiPeakAmount) kpiPeakAmount.textContent = formatCur(peakRecord.amount);
    if (kpiPeakMonth) kpiPeakMonth.textContent = `en ${peakRecord.month}`;
  } else {
    if (kpiPeakName) kpiPeakName.textContent = '-';
    if (kpiPeakAmount) kpiPeakAmount.textContent = '0,00 €';
    if (kpiPeakMonth) kpiPeakMonth.textContent = '-';
  }

  // 3. Mois le Plus Économe (Min non nul)
  let lowRecord = { cat: null, amount: Infinity, month: '-' };
  expenseStats.forEach(st => {
    st.monthlyAmounts.forEach(mItem => {
      if (mItem.amount > 0 && mItem.amount < lowRecord.amount) {
        lowRecord = { cat: st.cat, amount: mItem.amount, month: mItem.month.label };
      }
    });
  });
  const kpiLowName = document.getElementById('kpiLowCatName');
  const kpiLowAmount = document.getElementById('kpiLowAmount');
  const kpiLowMonth = document.getElementById('kpiLowMonth');
  if (lowRecord.cat && lowRecord.amount < Infinity) {
    if (kpiLowName) kpiLowName.textContent = lowRecord.cat.name;
    if (kpiLowAmount) kpiLowAmount.textContent = formatCur(lowRecord.amount);
    if (kpiLowMonth) kpiLowMonth.textContent = `en ${lowRecord.month}`;
  } else {
    if (kpiLowName) kpiLowName.textContent = '-';
    if (kpiLowAmount) kpiLowAmount.textContent = '0,00 €';
    if (kpiLowMonth) kpiLowMonth.textContent = '-';
  }

  // 4. Catégorie la Plus Volatile
  const volatileCat = [...expenseStats].sort((a, b) => b.amplitude - a.amplitude)[0];
  const kpiVolName = document.getElementById('kpiVolatileCatName');
  const kpiVolAmp = document.getElementById('kpiVolatileAmplitude');
  const kpiVolSub = document.getElementById('kpiVolatileSub');
  if (volatileCat && volatileCat.amplitude > 0) {
    if (kpiVolName) kpiVolName.textContent = volatileCat.cat.name;
    if (kpiVolAmp) kpiVolAmp.textContent = formatCur(volatileCat.amplitude);
    if (kpiVolSub) kpiVolSub.textContent = `Écart Max (${formatCur(volatileCat.max)}) - Min (${formatCur(volatileCat.min)})`;
  } else {
    if (kpiVolName) kpiVolName.textContent = '-';
    if (kpiVolAmp) kpiVolAmp.textContent = '0,00 €';
    if (kpiVolSub) kpiVolSub.textContent = 'Écart Max - Min';
  }

  // --- B. Graphique Comparatif Min vs Moyenne vs Max (Chart.js) ---
  const chartCanvas = document.getElementById('vizMinMaxChartCanvas');
  if (chartCanvas) {
    destroyChart('minMax');
    const ctx = chartCanvas.getContext('2d');

    let chartStats = stats.filter(s => {
      if (vizState.filterType === 'expense') return s.cat.type === 'expense';
      if (vizState.filterType === 'income') return s.cat.type === 'income';
      return true;
    });

    if (chartStats.some(s => s.total > 0)) {
      chartStats = chartStats.filter(s => s.total > 0);
    }
    chartStats = chartStats.slice(0, 10);

    const labels = chartStats.map(s => s.cat.name);
    const minData = chartStats.map(s => s.min);
    const avgData = chartStats.map(s => s.avg);
    const maxData = chartStats.map(s => s.max);

    chartInstances.minMax = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Minimum mensuel',
            data: minData,
            backgroundColor: '#0ea5e9',
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: 'Moyenne mensuelle',
            data: avgData,
            backgroundColor: '#10b981',
            borderRadius: 6,
            borderSkipped: false
          },
          {
            label: 'Maximum mensuel (Pic)',
            data: maxData,
            backgroundColor: '#f43f5e',
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const s = chartStats[context.dataIndex];
                const val = context.parsed.y;
                if (context.datasetIndex === 0) {
                  return ` Min: ${formatCur(val)} (${s.minMonth})`;
                } else if (context.datasetIndex === 1) {
                  return ` Moyenne: ${formatCur(val)}`;
                } else {
                  return ` Max: ${formatCur(val)} (${s.maxMonth})`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { weight: '600' } },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor,
              callback: v => formatCur(v)
            },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  // --- C. Grille des Cartes Détaillées par Catégorie ---
  const container = document.getElementById('categoryMinMaxCardsGrid');
  if (!container) return;
  container.innerHTML = '';

  let filtered = stats.filter(s => {
    if (vizState.filterType === 'expense') return s.cat.type === 'expense';
    if (vizState.filterType === 'income') return s.cat.type === 'income';
    return true;
  });

  filtered.sort((a, b) => {
    if (vizState.sort === 'maxDesc') return b.max - a.max;
    if (vizState.sort === 'totalDesc') return b.total - a.total;
    if (vizState.sort === 'amplitudeDesc') return b.amplitude - a.amplitude;
    if (vizState.sort === 'minAsc') return a.min - b.min;
    if (vizState.sort === 'nameAsc') return a.cat.name.localeCompare(b.cat.name);
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: var(--text-muted);">
        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Aucune catégorie trouvée</p>
        <p style="font-size: 0.85rem;">Aucune opération n'est enregistrée pour cette période avec les filtres actuels.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(st => {
    const card = document.createElement('div');
    card.className = 'cat-minmax-card';

    let markerPercent = 50;
    if (st.max > st.min) {
      markerPercent = Math.min(100, Math.max(0, ((st.avg - st.min) / (st.max - st.min)) * 100));
    } else if (st.max === 0) {
      markerPercent = 0;
    }

    const isExpense = st.cat.type === 'expense';
    const singleRecordText = st.highestSingleTx
      ? `⚡ Record ponctuel : <strong>${formatCur(st.highestSingleTx.amount)}</strong> (${formatDateFR(st.highestSingleTx.date)}${st.highestSingleTx.note ? ' - ' + escapeHtml(st.highestSingleTx.note) : ''})`
      : 'Aucune opération ponctuelle';

    card.innerHTML = `
      <div class="cat-minmax-card-header">
        <div class="cat-minmax-identity">
          <span class="cat-color-badge-dot" style="background: ${st.cat.color};"></span>
          <span class="cat-minmax-name" title="${escapeHtml(st.cat.name)}">${escapeHtml(st.cat.name)}</span>
        </div>
        <div class="cat-minmax-badges">
          <span class="cat-modal-type-badge">${isExpense ? 'Dépense' : 'Revenu'}</span>
          <span class="cat-share-pill">${st.percentOfTotal.toFixed(1)}%</span>
        </div>
      </div>

      <div class="cat-minmax-metrics-grid">
        <div class="cat-metric-box metric-box-min">
          <div class="cat-metric-label">
            <span>Minimum</span>
            <span style="color:#0ea5e9;">&#9660;</span>
          </div>
          <div class="cat-metric-val text-income">${formatCur(st.min)}</div>
          <div class="cat-metric-month-tag">${st.minMonth}</div>
        </div>

        <div class="cat-metric-box metric-box-max">
          <div class="cat-metric-label">
            <span>Maximum (Pic)</span>
            <span style="color:#f43f5e;">&#9650;</span>
          </div>
          <div class="cat-metric-val text-expense">${formatCur(st.max)}</div>
          <div class="cat-metric-month-tag">${st.maxMonth}</div>
        </div>

        <div class="cat-metric-box">
          <div class="cat-metric-label">Moyenne / mois</div>
          <div class="cat-metric-val">${formatCur(st.avg)}</div>
          <div class="cat-metric-month-tag">${st.activeCount} mois actif${st.activeCount > 1 ? 's' : ''}</div>
        </div>

        <div class="cat-metric-box">
          <div class="cat-metric-label">Total cumulé</div>
          <div class="cat-metric-val">${formatCur(st.total)}</div>
          <div class="cat-metric-month-tag">${st.txCount} opération${st.txCount > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div class="cat-range-gauge-wrap">
        <div class="gauge-labels-row">
          <span>Min : ${formatCur(st.min)}</span>
          <span style="font-weight: 850; color: var(--primary);">Moy : ${formatCur(st.avg)}</span>
          <span>Max : ${formatCur(st.max)}</span>
        </div>
        <div class="gauge-track">
          <div class="gauge-fill"></div>
          <div class="gauge-marker" style="left: ${markerPercent}%;" title="Moyenne à ${markerPercent.toFixed(0)}% de l'amplitude"></div>
        </div>
        <div class="gauge-subtext">
          Amplitude (Max - Min) : <strong>${formatCur(st.amplitude)}</strong>
        </div>
      </div>

      <div class="cat-minmax-footer">
        <div class="cat-record-single" title="${escapeHtml(singleRecordText.replace(/<[^>]*>/g, ''))}">
          ${singleRecordText}
        </div>
        <button class="btn-open-cat-detail" type="button" onclick="window.openCategoryDetailModal('${st.cat.id}')">
          Détail &#8250;
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * ==========================================================================
 * 2. VUE : ÉVOLUTION & COURBES TEMPORELLES
 * ==========================================================================
 */
function renderVizTrendsView(statsData) {
  const { periodMonths } = statsData;
  const chartCanvas = document.getElementById('evolutionChart');
  if (!chartCanvas) return;
  destroyChart('evolution');

  const ctx = chartCanvas.getContext('2d');
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

  renderCatCheckboxes();
  renderActiveChips();

  const labels = periodMonths.map(m => m.shortLabel);
  const datasets = [];

  let activeCatIds = vizState.soloCatId ? [vizState.soloCatId] : state.selectedCatsForChart;
  const activeCats = state.categories.filter(c => activeCatIds.includes(c.id));

  activeCats.forEach(cat => {
    const monthlyData = [];
    periodMonths.forEach(m => {
      const sum = state.transactions
        .filter(t => t.categoryId === cat.id && t.date.startsWith(m.key))
        .reduce((acc, t) => acc + t.amount, 0);
      monthlyData.push(sum);
    });

    const isStacked = vizState.trendChartType === 'bar';
    const isArea = vizState.trendChartType === 'area';

    datasets.push({
      type: isStacked ? 'bar' : 'line',
      label: cat.name,
      data: monthlyData,
      borderColor: cat.color,
      backgroundColor: isStacked ? cat.color + 'dd' : (isArea ? cat.color + '35' : cat.color + '15'),
      tension: 0.35,
      borderWidth: 2.8,
      pointRadius: isStacked ? 0 : 4,
      pointHoverRadius: 6,
      fill: isArea,
      borderRadius: isStacked ? 4 : 0
    });
  });

  chartInstances.evolution = new Chart(ctx, {
    type: vizState.trendChartType === 'bar' ? 'bar' : 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label} : ${formatCur(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: vizState.trendChartType === 'bar',
          ticks: { color: textColor },
          grid: { color: gridColor }
        },
        y: {
          stacked: vizState.trendChartType === 'bar',
          beginAtZero: true,
          ticks: {
            color: textColor,
            callback: v => formatCur(v)
          },
          grid: { color: gridColor }
        }
      }
    }
  });

  chartInstance = chartInstances.evolution;

  // Bandeau de synthèse des tendances sous le graphique
  const banner = document.getElementById('trendsSummaryBanner');
  if (banner && periodMonths.length >= 2) {
    const firstM = periodMonths[0];
    const lastM = periodMonths[periodMonths.length - 1];

    let firstTotal = 0;
    let lastTotal = 0;

    activeCats.forEach(cat => {
      firstTotal += state.transactions
        .filter(t => t.categoryId === cat.id && t.date.startsWith(firstM.key))
        .reduce((acc, t) => acc + t.amount, 0);
      lastTotal += state.transactions
        .filter(t => t.categoryId === cat.id && t.date.startsWith(lastM.key))
        .reduce((acc, t) => acc + t.amount, 0);
    });

    const diff = lastTotal - firstTotal;
    const pctDiff = firstTotal > 0 ? ((diff / firstTotal) * 100).toFixed(1) : 0;
    const isUp = diff > 0;

    banner.innerHTML = `
      <div class="trend-banner-item">
        <div class="trend-banner-title">Évolution Globale</div>
        <div class="trend-banner-val" style="color: ${isUp ? 'var(--expense)' : 'var(--income)'};">
          ${isUp ? '↗ +' : '↘ '}${formatCur(diff)} (${isUp ? '+' : ''}${pctDiff}%)
        </div>
        <div class="trend-banner-sub">Entre ${firstM.shortLabel} et ${lastM.shortLabel}</div>
      </div>
      <div class="trend-banner-item">
        <div class="trend-banner-title">Postes Sélectionnés</div>
        <div class="trend-banner-val">${activeCats.length} catégorie${activeCats.length > 1 ? 's' : ''}</div>
        <div class="trend-banner-sub">${vizState.soloCatId ? 'Mode Solo actif' : 'Affichage groupé'}</div>
      </div>
      <div class="trend-banner-item">
        <div class="trend-banner-title">Dépense du Dernier Mois</div>
        <div class="trend-banner-val">${formatCur(lastTotal)}</div>
        <div class="trend-banner-sub">Mois de ${lastM.label}</div>
      </div>
    `;
  }
}

/**
 * ==========================================================================
 * 3. VUE : RÉPARTITION & STRUCTURE (DONUT & PARETO)
 * ==========================================================================
 */
function renderVizBreakdownView(statsData) {
  const { stats } = statsData;
  const chartCanvas = document.getElementById('breakdownChart');
  if (!chartCanvas) return;
  destroyChart('breakdown');

  const ctx = chartCanvas.getContext('2d');
  const filtered = stats
    .filter(s => s.cat.type === vizState.breakdownType && s.total > 0)
    .sort((a, b) => b.total - a.total);

  const totalSum = filtered.reduce((acc, s) => acc + s.total, 0);

  const centerVal = document.getElementById('donutCenterVal');
  const centerSub = document.getElementById('donutCenterSub');
  if (centerVal) centerVal.textContent = formatCur(totalSum);
  if (centerSub) centerSub.textContent = `${filtered.length} catégorie${filtered.length > 1 ? 's' : ''}`;

  const labels = filtered.map(s => s.cat.name);
  const data = filtered.map(s => s.total);
  const colors = filtered.map(s => s.cat.color);

  chartInstances.breakdown = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: state.theme === 'dark' ? '#111827' : '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed;
              const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : 0;
              return ` ${context.label} : ${formatCur(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  const paretoText = document.getElementById('paretoInsightText');
  if (paretoText && filtered.length > 0) {
    let cum = 0;
    let count80 = 0;
    for (let i = 0; i < filtered.length; i++) {
      cum += filtered[i].total;
      count80++;
      if (totalSum > 0 && (cum / totalSum) >= 0.70) break;
    }
    const pctTop = totalSum > 0 ? ((cum / totalSum) * 100).toFixed(0) : 0;
    paretoText.innerHTML = `Concentration budgétaire : vos <strong>${count80} premiers postes</strong> concentrent <strong>${pctTop}%</strong> de vos ${vizState.breakdownType === 'expense' ? 'dépenses' : 'revenus'}.`;
  }

  const listContainer = document.getElementById('breakdownRankedList');
  if (listContainer) {
    listContainer.innerHTML = '';
    filtered.forEach((st, idx) => {
      const pct = totalSum > 0 ? (st.total / totalSum) * 100 : 0;
      const item = document.createElement('div');
      item.className = 'breakdown-ranked-item';
      item.innerHTML = `
        <div class="ranked-item-header">
          <div class="ranked-item-left">
            <span class="ranked-badge-num">#${idx + 1}</span>
            <span class="ranked-dot" style="background: ${st.cat.color};"></span>
            <span class="ranked-name">${escapeHtml(st.cat.name)}</span>
          </div>
          <div class="ranked-item-right">
            <span class="ranked-pct">${pct.toFixed(1)}%</span>
            <span class="ranked-amount">${formatCur(st.total)}</span>
          </div>
        </div>
        <div class="ranked-bar-track">
          <div class="ranked-bar-fill" style="width: ${pct}%; background: ${st.cat.color};"></div>
        </div>
      `;
      listContainer.appendChild(item);
    });
  }
}

/**
 * ==========================================================================
 * 4. VUE : FLUX, BALANCE & TAUX D'ÉPARGNE
 * ==========================================================================
 */
function renderVizBalanceView(statsData) {
  const { periodMonths } = statsData;
  const chartCanvas = document.getElementById('balanceChart');
  if (!chartCanvas) return;
  destroyChart('balance');

  const ctx = chartCanvas.getContext('2d');
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

  const labels = periodMonths.map(m => m.shortLabel);
  const monthlyNet = [];
  const monthlyIncome = [];
  const monthlyExpense = [];

  let totalIncome = 0;
  let totalExpense = 0;
  let totalNet = 0;
  let bestNet = -Infinity;
  let bestMonthIndex = -1;
  let activeMonthsCount = 0;

  periodMonths.forEach((m, idx) => {
    const txs = state.transactions.filter(t => t.date.startsWith(m.key));
    let inc = 0;
    let exp = 0;

    txs.forEach(t => {
      const cat = state.categories.find(c => c.id === t.categoryId);
      if (cat) {
        if (cat.type === 'income') inc += t.amount;
        else exp += t.amount;
      }
    });

    const net = inc - exp;
    monthlyNet.push(net);
    monthlyIncome.push(inc);
    monthlyExpense.push(exp);

    totalIncome += inc;
    totalExpense += exp;
    totalNet += net;

    if (inc > 0 || exp > 0) {
      activeMonthsCount++;
      if (net > bestNet) {
        bestNet = net;
        bestMonthIndex = idx;
      }
    }
  });

  const incElem = document.getElementById('balTotalIncome');
  const expElem = document.getElementById('balTotalExpense');
  const netElem = document.getElementById('balanceYearTotal');
  const verdictElem = document.getElementById('balNetVerdict');
  const savRateElem = document.getElementById('balSavingsRate');
  const savBadgeElem = document.getElementById('balSavingsBadge');
  const avgElem = document.getElementById('balanceYearAvg');
  const bestMonthElem = document.getElementById('balanceBestMonth');

  if (incElem) incElem.textContent = formatCur(totalIncome);
  if (expElem) expElem.textContent = formatCur(totalExpense);

  if (netElem) {
    netElem.textContent = (totalNet >= 0 ? '+' : '') + formatCur(totalNet);
    netElem.style.color = totalNet >= 0 ? 'var(--income)' : 'var(--expense)';
  }
  if (verdictElem) {
    verdictElem.textContent = totalNet >= 0 ? 'Excédent net' : 'Déficit net';
  }

  const savingsRate = totalIncome > 0 ? (totalNet / totalIncome) * 100 : 0;
  if (savRateElem) {
    savRateElem.textContent = (savingsRate >= 0 ? '+' : '') + savingsRate.toFixed(1) + '%';
    savRateElem.style.color = savingsRate >= 20 ? 'var(--income)' : (savingsRate >= 0 ? 'var(--primary)' : 'var(--expense)');
  }
  if (savBadgeElem) {
    if (savingsRate >= 20) savBadgeElem.textContent = 'Excellente santé';
    else if (savingsRate >= 5) savBadgeElem.textContent = 'Équilibre sain';
    else if (savingsRate >= 0) savBadgeElem.textContent = 'Attention aux dépenses';
    else savBadgeElem.textContent = 'Déficit budgétaire';
  }

  const avgNet = activeMonthsCount > 0 ? (totalNet / activeMonthsCount) : 0;
  if (avgElem) {
    avgElem.textContent = (avgNet >= 0 ? '+' : '') + formatCur(avgNet);
    avgElem.style.color = avgNet >= 0 ? 'var(--income)' : 'var(--expense)';
  }

  if (bestMonthElem) {
    bestMonthElem.textContent = bestMonthIndex >= 0 ? `${periodMonths[bestMonthIndex].label} (+${formatCur(bestNet)})` : '-';
  }

  chartInstances.balance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Solde Net',
          data: monthlyNet,
          borderColor: isDark ? '#38bdf8' : '#0284c7',
          backgroundColor: isDark ? '#38bdf820' : '#0284c720',
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.35,
          order: 1
        },
        {
          type: 'bar',
          label: 'Rentrées (Revenus)',
          data: monthlyIncome,
          backgroundColor: '#10b981cc',
          borderRadius: 6,
          borderSkipped: false,
          order: 2
        },
        {
          type: 'bar',
          label: 'Dépenses',
          data: monthlyExpense,
          backgroundColor: '#f43f5ecc',
          borderRadius: 6,
          borderSkipped: false,
          order: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          labels: { color: textColor, font: { weight: '600' } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              return ` ${context.dataset.label} : ${val >= 0 ? '+' : ''}${formatCur(val)}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: {
          ticks: {
            color: textColor,
            callback: v => formatCur(v)
          },
          grid: { color: gridColor }
        }
      }
    }
  });
}

/**
 * ==========================================================================
 * 5. INSIGHTS & ANALYSES INTELLIGENTES AUTOMATISÉES
 * ==========================================================================
 */
function renderVizInsights(statsData) {
  const container = document.getElementById('vizInsightsGrid');
  if (!container) return;
  container.innerHTML = '';

  const { stats, totalPeriodExpenses, totalPeriodIncomes } = statsData;
  const insights = [];

  const expenseStats = stats.filter(s => s.cat.type === 'expense');
  let highestRatio = 0;
  let spikeCat = null;
  expenseStats.forEach(st => {
    if (st.avg > 0 && st.max > st.avg * 1.35 && st.max >= 40) {
      const ratio = st.max / st.avg;
      if (ratio > highestRatio) {
        highestRatio = ratio;
        spikeCat = st;
      }
    }
  });

  if (spikeCat) {
    const pctAbove = Math.round((highestRatio - 1) * 100);
    insights.push({
      icon: '🚨',
      title: `Pic de dépenses détecté : ${escapeHtml(spikeCat.cat.name)}`,
      desc: `Votre dépense a atteint <strong>${formatCur(spikeCat.max)}</strong> en ${spikeCat.maxMonth}, soit <strong>+${pctAbove}%</strong> au-dessus de votre moyenne habituelle (${formatCur(spikeCat.avg)}).`
    });
  }

  let bestSavingCat = null;
  expenseStats.forEach(st => {
    if (st.activeCount >= 2 && st.min > 0 && st.min < st.avg * 0.65) {
      if (!bestSavingCat || (st.avg - st.min) > (bestSavingCat.avg - bestSavingCat.min)) {
        bestSavingCat = st;
      }
    }
  });

  if (bestSavingCat) {
    const savingAmt = bestSavingCat.avg - bestSavingCat.min;
    insights.push({
      icon: '🍃',
      title: `Économie record : ${escapeHtml(bestSavingCat.cat.name)}`,
      desc: `En ${bestSavingCat.minMonth}, vous avez réduit ce poste à <strong>${formatCur(bestSavingCat.min)}</strong>, économisant <strong>${formatCur(savingAmt)}</strong> par rapport à votre moyenne.`
    });
  }

  const net = totalPeriodIncomes - totalPeriodExpenses;
  const rate = totalPeriodIncomes > 0 ? (net / totalPeriodIncomes) * 100 : 0;
  if (totalPeriodIncomes > 0) {
    if (rate >= 20) {
      insights.push({
        icon: '🏆',
        title: 'Taux d\'épargne très solide',
        desc: `Bravo ! Vous conservez <strong>${rate.toFixed(1)}%</strong> de vos revenus sur la période (${formatCur(net)} conservés sur ${formatCur(totalPeriodIncomes)}).`
      });
    } else if (rate >= 0) {
      insights.push({
        icon: '⚖️',
        title: 'Budget équilibré',
        desc: `Votre taux d\'épargne moyen est de <strong>${rate.toFixed(1)}%</strong> (${formatCur(net)} de solde net restant).`
      });
    } else {
      insights.push({
        icon: '⚠️',
        title: 'Solde net en déficit',
        desc: `Vos dépenses dépassent vos rentrées de <strong>${formatCur(Math.abs(net))}</strong> sur la période sélectionnée.`
      });
    }
  }

  const topExp = [...expenseStats].sort((a, b) => b.total - a.total)[0];
  if (topExp && topExp.total > 0 && topExp.percentOfTotal >= 25) {
    insights.push({
      icon: '📊',
      title: `Poste prédominant : ${escapeHtml(topExp.cat.name)}`,
      desc: `Cette catégorie représente à elle seule <strong>${topExp.percentOfTotal.toFixed(1)}%</strong> de toutes vos dépenses (${formatCur(topExp.total)}).`
    });
  }

  if (insights.length === 0) {
    insights.push({
      icon: '💡',
      title: 'Centre de Visualisation Actif',
      desc: 'Ajoutez des opérations régulières pour que le centre détecte automatiquement vos habitudes budgétaires et vos marges d\'optimisation.'
    });
  }

  insights.slice(0, 4).forEach(ins => {
    const el = document.createElement('div');
    el.className = 'insight-item-card';
    el.innerHTML = `
      <span class="insight-item-icon">${ins.icon}</span>
      <div class="insight-item-content">
        <div class="insight-item-title">${ins.title}</div>
        <div class="insight-item-desc">${ins.desc}</div>
      </div>
    `;
    container.appendChild(el);
  });
}

/**
 * ==========================================================================
 * 6. MODALE DÉTAIL APPROFONDI D'UNE CATÉGORIE (DRILL-DOWN)
 * ==========================================================================
 */
window.openCategoryDetailModal = function(catId) {
  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;

  const periodMonths = getVizPeriodMonths();
  const statsData = computeAllCategoryStats(periodMonths);
  const st = statsData.stats.find(s => s.cat.id === catId);
  if (!st) return;

  vizState.selectedDetailCatId = catId;

  const dot = document.getElementById('catDetailDot');
  if (dot) dot.style.background = cat.color;

  const title = document.getElementById('catDetailTitle');
  if (title) title.textContent = cat.name;

  const typeBadge = document.getElementById('catDetailTypeBadge');
  if (typeBadge) {
    typeBadge.textContent = cat.type === 'expense' ? 'Dépense' : 'Revenu';
  }

  document.getElementById('catDetailTotal').textContent = formatCur(st.total);
  document.getElementById('catDetailAvg').textContent = formatCur(st.avg);
  document.getElementById('catDetailMin').textContent = formatCur(st.min);
  document.getElementById('catDetailMinMonth').textContent = st.minMonth;
  document.getElementById('catDetailMax').textContent = formatCur(st.max);
  document.getElementById('catDetailMaxMonth').textContent = st.maxMonth;
  document.getElementById('catDetailAmplitude').textContent = formatCur(st.amplitude);

  const highestValElem = document.getElementById('catDetailHighestSingle');
  const highestDateElem = document.getElementById('catDetailHighestSingleDate');
  if (st.highestSingleTx) {
    if (highestValElem) highestValElem.textContent = formatCur(st.highestSingleTx.amount);
    if (highestDateElem) highestDateElem.textContent = `${formatDateFR(st.highestSingleTx.date)}${st.highestSingleTx.note ? ' • ' + st.highestSingleTx.note : ''}`;
  } else {
    if (highestValElem) highestValElem.textContent = '0,00 €';
    if (highestDateElem) highestDateElem.textContent = '-';
  }

  const txCountBadge = document.getElementById('catDetailTxCountBadge');
  if (txCountBadge) txCountBadge.textContent = `${st.txCount} opération${st.txCount > 1 ? 's' : ''}`;

  const chartCanvas = document.getElementById('categoryDetailChartCanvas');
  if (chartCanvas) {
    destroyChart('categoryModal');
    const ctx = chartCanvas.getContext('2d');
    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

    const labels = st.monthlyAmounts.map(m => m.month.shortLabel);
    const data = st.monthlyAmounts.map(m => m.amount);

    chartInstances.categoryModal = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: cat.name,
          data,
          backgroundColor: cat.color + 'cc',
          borderColor: cat.color,
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctxTooltip => ` ${formatCur(ctxTooltip.parsed.y)}`
            }
          }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { color: textColor, callback: v => formatCur(v) },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  const txListContainer = document.getElementById('catDetailTxList');
  if (txListContainer) {
    txListContainer.innerHTML = '';
    const sortedTxs = [...st.periodTxs].sort((a, b) => b.date.localeCompare(a.date));

    if (sortedTxs.length === 0) {
      txListContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 16px;">Aucune opération enregistrée sur cette période.</div>';
    } else {
      sortedTxs.forEach(tx => {
        const row = document.createElement('div');
        row.className = 'cat-tx-row';
        row.innerHTML = `
          <div class="cat-tx-row-left">
            <span class="cat-tx-row-date">${formatDateFR(tx.date)}</span>
            <span class="cat-tx-row-note">${escapeHtml(tx.note || cat.name)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="cat-tx-row-amount" style="color: ${cat.type === 'income' ? 'var(--income)' : 'var(--text)'};">
              ${cat.type === 'income' ? '+' : '-'}${formatCur(tx.amount)}
            </span>
            <button class="tx-action-btn edit" onclick="window.editTransaction('${tx.id}'); document.getElementById('modalCategoryDetail').classList.remove('active');" title="Modifier">
              <svg viewBox="0 0 24 24" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
        `;
        txListContainer.appendChild(row);
      });
    }
  }

  const modal = document.getElementById('modalCategoryDetail');
  if (modal) modal.classList.add('active');
};

function closeCategoryDetailModal() {
  destroyChart('categoryModal');
  const modal = document.getElementById('modalCategoryDetail');
  if (modal) modal.classList.remove('active');
}

/**
 * ==========================================================================
 * 7. OUTILS : EXPORT IMAGE, EXPORT CSV & DONNÉES DÉMO
 * ==========================================================================
 */
function exportVizChartImage() {
  let targetCanvas = null;
  if (vizState.mode === 'minmax') targetCanvas = document.getElementById('vizMinMaxChartCanvas');
  else if (vizState.mode === 'trends') targetCanvas = document.getElementById('evolutionChart');
  else if (vizState.mode === 'breakdown') targetCanvas = document.getElementById('breakdownChart');
  else if (vizState.mode === 'balance') targetCanvas = document.getElementById('balanceChart');

  if (!targetCanvas) {
    showToast('Aucun graphique disponible pour l\'export');
    return;
  }

  try {
    const dataUrl = targetCanvas.toDataURL('image/png');
    downloadFile(dataUrl, `analyse-budget-${vizState.mode}-${vizState.year}.png`);
    showToast('Graphique téléchargé en PNG !');
  } catch (e) {
    showToast('Erreur lors de l\'export image');
  }
}

function exportVizCsv() {
  const periodMonths = getVizPeriodMonths();
  const statsData = computeAllCategoryStats(periodMonths);

  let csv = '\uFEFF';
  csv += 'Categorie;Type;Total;Moyenne_Mensuelle;Min_Mensuel;Mois_Min;Max_Mensuel;Mois_Max;Amplitude;Nb_Operations;Part_Budget_Pct\n';

  statsData.stats.forEach(st => {
    const line = [
      `"${st.cat.name.replace(/"/g, '""')}"`,
      st.cat.type === 'expense' ? 'Depense' : 'Revenu',
      st.total.toFixed(2).replace('.', ','),
      st.avg.toFixed(2).replace('.', ','),
      st.min.toFixed(2).replace('.', ','),
      `"${st.minMonth}"`,
      st.max.toFixed(2).replace('.', ','),
      `"${st.maxMonth}"`,
      st.amplitude.toFixed(2).replace('.', ','),
      st.txCount,
      st.percentOfTotal.toFixed(1).replace('.', ',')
    ].join(';');
    csv += line + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, `statistiques-budget-${vizState.year}.csv`);
  URL.revokeObjectURL(url);
  showToast('Rapport CSV téléchargé !');
}

function generateDemoData() {
  if (!confirm('Voulez-vous générer un jeu de données de démo réaliste pour l\'année ' + vizState.year + ' ? Cela permettra de tester immédiatement le centre de visualisation à pleine puissance.')) {
    return;
  }

  const yr = vizState.year;
  const demoTxs = [];

  const getCatId = (namePart, type = 'expense') => {
    const found = state.categories.find(c => c.name.toLowerCase().includes(namePart.toLowerCase()) && c.type === type);
    return found ? found.id : null;
  };

  const idSalaire = getCatId('salaire', 'income') || (state.categories.find(c => c.type === 'income') || {}).id;
  const idCourses = getCatId('course') || (state.categories[0] || {}).id;
  const idCarbu = getCatId('carburant') || (state.categories[1] || {}).id;
  const idAbo = getCatId('abonnement') || (state.categories[2] || {}).id;
  const idResto = getCatId('resto') || (state.categories[3] || {}).id;
  const idAuto = getCatId('autoroute') || (state.categories[4] || {}).id;
  const idAutre = getCatId('autre') || (state.categories[5] || {}).id;

  for (let m = 0; m < 12; m++) {
    const mStr = String(m + 1).padStart(2, '0');

    if (idSalaire) {
      demoTxs.push({
        id: `demo-sal-${yr}-${mStr}`,
        categoryId: idSalaire,
        amount: 2250.00,
        date: `${yr}-${mStr}-01`,
        note: `Salaire mensuel ${MONTH_NAMES[m]}`
      });
    }

    if (idCourses) {
      const trips = [
        { day: '05', amt: 75.40 + Math.sin(m) * 12, note: 'Courses semaine 1' },
        { day: '12', amt: 84.10 + Math.cos(m) * 15, note: 'Supermarché frais' },
        { day: '19', amt: 92.50 + Math.sin(m * 2) * 10, note: 'Courses complètes' },
        { day: '26', amt: 68.20 + (m === 11 ? 120 : 0), note: m === 11 ? 'Festin fêtes de fin d\'année' : 'Marché bio' }
      ];
      trips.forEach((t, i) => {
        demoTxs.push({
          id: `demo-crs-${yr}-${mStr}-${i}`,
          categoryId: idCourses,
          amount: Math.round(t.amt * 100) / 100,
          date: `${yr}-${mStr}-${t.day}`,
          note: t.note
        });
      });
    }

    if (idCarbu) {
      const isSummer = (m === 6 || m === 7);
      demoTxs.push({
        id: `demo-carb-${yr}-${mStr}-1`,
        categoryId: idCarbu,
        amount: isSummer ? 145.50 : 85.20,
        date: `${yr}-${mStr}-08`,
        note: isSummer ? 'Plein départ vacances' : 'Plein SP95'
      });
      if (isSummer || m === 2 || m === 9) {
        demoTxs.push({
          id: `demo-carb-${yr}-${mStr}-2`,
          categoryId: idCarbu,
          amount: isSummer ? 120.00 : 70.30,
          date: `${yr}-${mStr}-22`,
          note: 'Plein station autoroute'
        });
      }
    }

    if (idAbo) {
      demoTxs.push({
        id: `demo-abo-${yr}-${mStr}`,
        categoryId: idAbo,
        amount: 44.99,
        date: `${yr}-${mStr}-03`,
        note: 'Netflix, Spotify & Salle sport'
      });
    }

    if (idResto) {
      const restoAmounts = [35.0, 48.0, 75.0, 92.0, 110.0, 165.0, 210.0, 195.0, 120.0, 85.0, 60.0, 140.0];
      demoTxs.push({
        id: `demo-rst-${yr}-${mStr}`,
        categoryId: idResto,
        amount: restoAmounts[m],
        date: `${yr}-${mStr}-15`,
        note: m === 6 ? 'Dîner terrasse d\'été' : 'Repas restaurant'
      });
    }

    if (idAuto && (m === 3 || m === 6 || m === 7 || m === 10 || m === 11)) {
      demoTxs.push({
        id: `demo-aut-${yr}-${mStr}`,
        categoryId: idAuto,
        amount: (m === 6 || m === 7) ? 68.40 : 24.80,
        date: `${yr}-${mStr}-17`,
        note: 'Péage aller-retour'
      });
    }

    if (idAutre && m % 2 === 0) {
      demoTxs.push({
        id: `demo-otr-${yr}-${mStr}`,
        categoryId: idAutre,
        amount: 35.00 + (m * 8),
        date: `${yr}-${mStr}-18`,
        note: 'Pharmacie / Bricolage'
      });
    }
  }

  const nonDemoExisting = state.transactions.filter(t => !t.id.startsWith('demo-'));
  state.transactions = [...nonDemoExisting, ...demoTxs];

  saveData();
  renderCurrentMonthView();
  renderVisualizationCenter();
  showToast(`${demoTxs.length} opérations de démo ajoutées !`);
}

/**
 * ==========================================================================
 * 8. FILTRES DE CATÉGORIES & CHIPS D'ÉVOLUTION
 * ==========================================================================
 */
function renderCatCheckboxes() {
  const container = document.getElementById('catCheckboxesList');
  if (!container) return;
  container.innerHTML = '';

  const search = vizState.searchCat.toLowerCase().trim();

  state.categories.forEach(cat => {
    if (search && !cat.name.toLowerCase().includes(search)) return;

    const isChecked = state.selectedCatsForChart.includes(cat.id);
    const label = document.createElement('label');
    label.className = 'cat-checkbox-item';
    label.innerHTML = `
      <input type="checkbox" value="${cat.id}" ${isChecked ? 'checked' : ''}>
      <span class="cat-dot" style="background:${cat.color}"></span>
      <span>${escapeHtml(cat.name)}</span>
    `;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!state.selectedCatsForChart.includes(cat.id)) state.selectedCatsForChart.push(cat.id);
      } else {
        state.selectedCatsForChart = state.selectedCatsForChart.filter(id => id !== cat.id);
      }
      renderEvolutionChart();
    });
    container.appendChild(label);
  });
}

function renderActiveChips() {
  const container = document.getElementById('activeCategoryChips');
  if (!container) return;
  container.innerHTML = '';

  const activeIds = vizState.soloCatId ? [vizState.soloCatId] : state.selectedCatsForChart;

  activeIds.forEach(catId => {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    const isSolo = vizState.soloCatId === cat.id;
    chip.innerHTML = `
      <span class="cat-dot" style="background:${cat.color}"></span>
      <span>${escapeHtml(cat.name)}</span>
      <button class="btn-solo-cat" type="button" onclick="window.toggleCatSolo('${cat.id}')" title="${isSolo ? 'Quitter le mode solo' : 'Isoler cette catégorie uniquement'}">
        ${isSolo ? '★ SOLO' : 'SOLO'}
      </button>
      <button type="button" onclick="window.removeCatFilter('${cat.id}')" title="Retirer">&times;</button>
    `;
    container.appendChild(chip);
  });
}

window.toggleCatSolo = function(catId) {
  if (vizState.soloCatId === catId) {
    vizState.soloCatId = null;
  } else {
    vizState.soloCatId = catId;
  }
  renderEvolutionChart();
};

window.removeCatFilter = function(id) {
  if (vizState.soloCatId === id) vizState.soloCatId = null;
  state.selectedCatsForChart = state.selectedCatsForChart.filter(cId => cId !== id);
  renderEvolutionChart();
};

/**
 * ==========================================================================
 * ÉCOUTEURS D'ÉVÉNEMENTS DU CENTRE DE VISUALISATION
 * ==========================================================================
 */
function setupVisualizationEventListeners() {
  // 1. Actions rapides (Export PNG, Export CSV, Démo)
  const btnImg = document.getElementById('btnExportVizChart');
  if (btnImg) btnImg.addEventListener('click', exportVizChartImage);

  const btnCsv = document.getElementById('btnExportVizCsv');
  if (btnCsv) btnCsv.addEventListener('click', exportVizCsv);

  const btnDemo = document.getElementById('btnLoadDemoData');
  if (btnDemo) btnDemo.addEventListener('click', generateDemoData);

  // 2. Navigation de l'Année & Horizon
  const btnPrevY = document.getElementById('btnVizPrevYear');
  if (btnPrevY) {
    btnPrevY.addEventListener('click', () => {
      vizState.year--;
      renderVisualizationCenter();
    });
  }

  const btnNextY = document.getElementById('btnVizNextYear');
  if (btnNextY) {
    btnNextY.addEventListener('click', () => {
      vizState.year++;
      renderVisualizationCenter();
    });
  }

  const btnCurY = document.getElementById('btnVizCurrentYear');
  if (btnCurY) {
    btnCurY.addEventListener('click', () => {
      vizState.year = nowInitial.getFullYear();
      renderVisualizationCenter();
    });
  }

  document.querySelectorAll('#vizHorizonSelector .viz-horizon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#vizHorizonSelector .viz-horizon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      vizState.horizon = btn.getAttribute('data-horizon');
      renderVisualizationCenter();
    });
  });

  // 3. Bascule des 4 Modes
  const modeTabs = [
    { id: 'btnTabMinMax', mode: 'minmax' },
    { id: 'btnTabTrends', mode: 'trends' },
    { id: 'btnTabBreakdown', mode: 'breakdown' },
    { id: 'btnTabBalance', mode: 'balance' }
  ];

  modeTabs.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener('click', () => {
        vizState.mode = item.mode;
        renderVisualizationCenter();
      });
    }
  });

  // 4. Contrôles Min / Max
  document.querySelectorAll('#minmaxTypeSegment .filter-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#minmaxTypeSegment .filter-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      vizState.filterType = btn.getAttribute('data-type');
      renderVisualizationCenter();
    });
  });

  const toggleMin = document.getElementById('toggleMinNonZero');
  if (toggleMin) {
    toggleMin.addEventListener('change', (e) => {
      vizState.minNonZero = e.target.checked;
      renderVisualizationCenter();
    });
  }

  const sortSelect = document.getElementById('selectMinMaxSort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      vizState.sort = e.target.value;
      renderVisualizationCenter();
    });
  }

  // 5. Contrôles Évolution (Trends)
  document.querySelectorAll('#trendChartTypePills .chart-type-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#trendChartTypePills .chart-type-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      vizState.trendChartType = btn.getAttribute('data-charttype');
      renderVisualizationCenter();
    });
  });

  const dropBtn = document.getElementById('btnToggleCatDropdown');
  const dropMenu = document.getElementById('catDropdownMenu');
  if (dropBtn && dropMenu) {
    dropBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropMenu.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
      if (!dropMenu.contains(e.target) && e.target !== dropBtn) {
        dropMenu.classList.remove('active');
      }
    });
  }

  const searchInput = document.getElementById('inputCatSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      vizState.searchCat = e.target.value;
      renderCatCheckboxes();
    });
  }

  const btnAll = document.getElementById('btnSelectAllCats');
  if (btnAll) {
    btnAll.addEventListener('click', () => {
      vizState.soloCatId = null;
      state.selectedCatsForChart = state.categories.filter(c => c.type === 'expense').map(c => c.id);
      renderVisualizationCenter();
    });
  }

  const btnNone = document.getElementById('btnUnselectAllCats');
  if (btnNone) {
    btnNone.addEventListener('click', () => {
      vizState.soloCatId = null;
      state.selectedCatsForChart = [];
      renderVisualizationCenter();
    });
  }

  const btnTop3 = document.getElementById('btnPresetTop3');
  if (btnTop3) {
    btnTop3.addEventListener('click', () => {
      vizState.soloCatId = null;
      const periodMonths = getVizPeriodMonths();
      const statsData = computeAllCategoryStats(periodMonths);
      const top3 = statsData.stats
        .filter(s => s.cat.type === 'expense')
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)
        .map(s => s.cat.id);
      state.selectedCatsForChart = top3;
      renderVisualizationCenter();
    });
  }

  // 6. Contrôles Répartition (Breakdown)
  document.querySelectorAll('#breakdownTypeSegment .breakdown-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#breakdownTypeSegment .breakdown-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      vizState.breakdownType = btn.getAttribute('data-btype');
      renderVisualizationCenter();
    });
  });

  // 7. Modale Détail Catégorie
  const btnCloseCatDetail = document.getElementById('btnCloseCatDetailModal');
  if (btnCloseCatDetail) {
    btnCloseCatDetail.addEventListener('click', closeCategoryDetailModal);
  }

  const modalCatDetail = document.getElementById('modalCategoryDetail');
  if (modalCatDetail) {
    modalCatDetail.addEventListener('click', (e) => {
      if (e.target === modalCatDetail) closeCategoryDetailModal();
    });
  }
}

// Export pour environnements modules / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getVizPeriodMonths,
    computeAllCategoryStats,
    renderVisualizationCenter,
    renderEvolutionChart,
    exportVizChartImage,
    exportVizCsv,
    generateDemoData,
    setupVisualizationEventListeners
  };
}
