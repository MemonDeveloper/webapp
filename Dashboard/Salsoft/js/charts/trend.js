function buildTrendChart(creditOnly) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  if (state.charts.trend) state.charts.trend.destroy();
  const trendScroller    = ctx.closest('.bank-trend-scroll');
  const trendScrollInner = ctx.closest('.bank-trend-scroll-inner');
  const isBankScrollable = !!trendScroller;
  const trendMode  = state.filters.bankCashMode || 'all';
  const txns       = getFilteredTxns();
  const granularity = state.filters.chartGranularity || 'daily';
  const font = { family: "'Aptos Narrow','Arial Narrow',Arial,sans-serif", size: 11 };
  const bucketLimit = granularity === 'daily' ? 60 : granularity === 'weekly' ? 24 : 18;

  function toBucket(dateStr) {
    if (!dateStr) return null;
    const dv = new Date(dateStr);
    if (Number.isNaN(dv.getTime())) return null;
    let key = dateStr.slice(0, 10);
    let label = dv.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (granularity === 'weekly') {
      const s = new Date(dv); s.setDate(s.getDate() - (s.getDay() + 6) % 7);
      key = s.toISOString().slice(0, 10);
      label = 'Week of ' + s.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } else if (granularity === 'monthly') {
      key = dv.getFullYear() + '-' + String(dv.getMonth() + 1).padStart(2, '0');
      label = dv.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    }
    return { key, label };
  }

  const ptR = isBankScrollable ? 3.4 : 2;
  const ptHR = isBankScrollable ? 6.5 : 5;
  const bw   = isBankScrollable ? 2.4 : 2;
  const ds = (label, data, color, fill, bg) => ({
    label, data, borderColor: color, borderWidth: bw,
    backgroundColor: bg || color + '18', fill: fill ?? !isBankScrollable,
    tension: 0.35, pointRadius: ptR, pointHoverRadius: ptHR,
    pointBackgroundColor: color, pointBorderColor: 'white', pointBorderWidth: 1.5
  });

  let labels = [], datasets = [], visibleBuckets = [], yMin, yMax;

  if (trendMode === 'opening' || trendMode === 'closing') {
    // Show opening balance and closing balance lines per bucket
    const balMap = {};
    txns.forEach(t => {
      const b = toBucket(t.date); if (!b) return;
      if (!balMap[b.key]) balMap[b.key] = { label: b.label, opening: null, closing: null };
      const ob = $usdOpening(t);
      const cb = $usdClosing(t);
      if (ob != null && (balMap[b.key].opening === null || ob < balMap[b.key].opening)) balMap[b.key].opening = ob;
      if (cb != null && (balMap[b.key].closing === null || cb > balMap[b.key].closing)) balMap[b.key].closing = cb;
    });
    const allBuckets = Object.keys(balMap).sort();
    visibleBuckets = isBankScrollable ? allBuckets : allBuckets.slice(-bucketLimit);
    labels  = visibleBuckets.map(k => balMap[k].label);
    const oData = visibleBuckets.map(k => balMap[k].opening);
    const cData = visibleBuckets.map(k => balMap[k].closing);
    datasets = [
      ds('Opening Balance', oData, '#2196F3', false, 'rgba(33,150,243,0.08)'),
      ds('Closing Balance', cData, '#9C27B0', false, 'rgba(156,39,176,0.08)')
    ];
    const allVals = [...oData, ...cData].filter(v => v != null && !isNaN(v));
    if (allVals.length) {
      const hi = Math.max(...allVals), lo = Math.min(...allVals);
      const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
      yMin = lo - pad; yMax = hi + pad;
    }

  } else {
    // For credit/debit/net modes: bypass bankCashMode so BOTH credit+debit lines stay visible.
    // For 'all' (default, no card): txns already unfiltered, use directly.
    let chartTxns = txns;
    if (trendMode === 'credit' || trendMode === 'debit' || trendMode === 'net') {
      const saved = state.filters.bankCashMode;
      state.filters.bankCashMode = 'all';
      chartTxns = getFilteredTxns();
      state.filters.bankCashMode = saved;
    }

    const dateMap = {};
    chartTxns.forEach(t => {
      const b = toBucket(t.date); if (!b) return;
      if (!dateMap[b.key]) dateMap[b.key] = { credit: 0, debit: 0, label: b.label };
      const amt = $usdAmt(t);
      if (amt > 0) dateMap[b.key].credit += amt;
      else if (amt < 0) dateMap[b.key].debit += amt;
    });
    const allBuckets = Object.keys(dateMap).sort();
    visibleBuckets = isBankScrollable ? allBuckets : allBuckets.slice(-bucketLimit);
    labels  = visibleBuckets.map(k => dateMap[k].label);
    const cData = visibleBuckets.map(k => dateMap[k].credit);
    const dData = visibleBuckets.map(k => dateMap[k].debit);
    const maxMag = Math.max(1, ...cData.map(v => Math.abs(v)), ...dData.map(v => Math.abs(v)));
    const pad = maxMag * 0.15;
    yMin = -(maxMag + pad); yMax = maxMag + pad;

    // Highlight the active mode: thicker border + stronger fill, fade the other
    const creditStrong = trendMode !== 'debit';
    const debitStrong  = trendMode !== 'credit';
    const cDs = ds('Credit', cData, '#10b981', undefined, creditStrong ? 'rgba(16,185,129,0.11)' : 'rgba(16,185,129,0.03)');
    const dDs = ds('Debit',  dData, '#ef4444', undefined, debitStrong  ? 'rgba(239,68,68,0.09)'  : 'rgba(239,68,68,0.02)');
    cDs.borderWidth = creditStrong ? bw + 0.5 : bw - 0.5;
    dDs.borderWidth = debitStrong  ? bw + 0.5 : bw - 0.5;
    datasets = [cDs, dDs];

    if (trendMode === 'net') {
      const netData = cData.map((c, i) => c + dData[i]);
      datasets.push({
        label: 'Net Cash Flow', data: netData,
        borderColor: '#f59e0b', borderWidth: bw + 0.6,
        backgroundColor: 'rgba(245,158,11,0.10)', fill: false,
        tension: 0.35, pointRadius: ptR, pointHoverRadius: ptHR,
        pointBackgroundColor: '#f59e0b', pointBorderColor: 'white', pointBorderWidth: 1.5,
        borderDash: [4, 3]
      });
    }
  }

  if (isBankScrollable && trendScrollInner) {
    const visiblePoints = 7;
    const containerWidth = trendScroller.clientWidth || 560;
    const expandedWidth = Math.max(containerWidth, Math.ceil((Math.max(labels.length, visiblePoints) / visiblePoints) * containerWidth));
    trendScrollInner.style.width = `${expandedWidth}px`;
  }

  state.charts.trend = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: !isBankScrollable,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index', intersect: false,
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderColor: '#e4e7ed', borderWidth: 1,
          titleColor: '#111827', bodyColor: '#6b7280',
          titleFont: { family: font.family, size: 12, weight: '700' },
          bodyFont: font, padding: 12,
          callbacks: {
            title: (items) => visibleBuckets[items[0].dataIndex] + '  (' + labels[items[0].dataIndex] + ')',
            label: (item) => '  ' + item.dataset.label + ': ' + fmt(item.raw != null ? item.raw : 0)
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font, maxTicksLimit: isBankScrollable ? labels.length : 18 } },
        y: {
          min: isBankScrollable ? yMin : undefined,
          max: isBankScrollable ? yMax : undefined,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font, callback: v => '$' + v.toLocaleString() }
        }
      }
    }
  });

  if (isBankScrollable && trendScroller) {
    requestAnimationFrame(() => { trendScroller.scrollLeft = 0; });
  }
}

function buildCreditTrendChart() {
  const ctx = document.getElementById('creditTrendChart');
  if (!ctx) return;
  if (state.charts.creditTrend) state.charts.creditTrend.destroy();
  const txns = getFilteredTxns();
  const granularity = state.filters.chartGranularity || 'monthly';
  const bucketMap = {};

  txns.forEach(t => {
    if (!t.date) return;
    const dateValue = new Date(t.date);
    if (Number.isNaN(dateValue.getTime())) return;
    let bucketKey = t.date.slice(0, 10);
    let bucketLabel = dateValue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (granularity === 'weekly') {
      const start = new Date(dateValue);
      const day = start.getDay();
      const diff = (day + 6) % 7;
      start.setDate(start.getDate() - diff);
      bucketKey = start.toISOString().slice(0, 10);
      bucketLabel = 'Week of ' + start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } else if (granularity === 'monthly') {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      bucketKey = `${year}-${month}`;
      bucketLabel = dateValue.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    }
    if (!bucketMap[bucketKey]) bucketMap[bucketKey] = { spending: 0, income: 0, label: bucketLabel };
    const amt = $usdAmt(t);
    if (amt < 0) bucketMap[bucketKey].spending += Math.abs(amt);
    if (amt > 0) bucketMap[bucketKey].income += amt;
  });

  const allBuckets = Object.keys(bucketMap).sort((a, b) => a.localeCompare(b));
  const bucketLimit = granularity === 'daily' ? 60 : granularity === 'weekly' ? 24 : 18;
  const buckets = allBuckets.slice(-bucketLimit);
  const labels = buckets.map(k => bucketMap[k].label);
  const spendingData = buckets.map(k => bucketMap[k].spending);
  const incomeData = buckets.map(k => bucketMap[k].income);
  const font = { family: "'Aptos Narrow','Arial Narrow',Arial,sans-serif", size: 11 };

  state.charts.creditTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Spending',
          data: spendingData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.08)',
          fill: true,
          tension: 0.38,
          pointRadius: 2,
          pointHoverRadius: 9,
          pointHoverBorderWidth: 3,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: 'white',
          pointBorderWidth: 1.5
        },
        {
          label: 'Total Income',
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          fill: true,
          tension: 0.38,
          pointRadius: 2,
          pointHoverRadius: 9,
          pointHoverBorderWidth: 3,
          pointBackgroundColor: '#10b981',
          pointBorderColor: 'white',
          pointBorderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderColor: '#e4e7ed',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#6b7280',
          titleFont: { family: font.family, size: 12, weight: '700' },
          bodyFont: font,
          padding: 12,
          callbacks: {
            title: (items) => labels[items[0].dataIndex],
            label: (item) => `  ${item.dataset.label}: ${fmt(item.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font, maxTicksLimit: 18 } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font, callback: v => '$' + v.toLocaleString() } }
      }
    }
  });
}

function _creditModeInfo() {
  const cm = state.filters.creditAmountMode || 'all';
  return {
    cm,
    isNet: cm === 'all',
    showIncome: cm === 'income',
    label: cm === 'income' ? 'INCOME' : cm === 'spending' ? 'SPENDING' : 'NET CASH FLOW',
    sign: cm === 'income' ? '+' : cm === 'spending' ? '-' : ''
  };
}

function buildCreditCategorySpendingChart() {
  const ctx = document.getElementById('creditCategoryChart');
  if (!ctx) return;
  if (state.charts.creditCategory) state.charts.creditCategory.destroy();
  const txns = getFilteredTxns();
  const categoryMap = {};
  const { isNet, showIncome, label: modeLabel, sign } = _creditModeInfo();

  txns.forEach(t => {
    const amt = $usdAmt(t);
    if (!isNet && (showIncome ? amt <= 0 : amt >= 0)) return;
    const key = (t.category || 'Uncategorized').trim() || 'Uncategorized';
    categoryMap[key] = (categoryMap[key] || 0) + (isNet ? amt : Math.abs(amt));
  });

  const rawLabels = Object.keys(categoryMap).sort((a, b) => Math.abs(categoryMap[b]) - Math.abs(categoryMap[a]));
  if (!rawLabels.length) return;
  const data = rawLabels.map(k => Math.abs(categoryMap[k]));
  const activeCategory = state.filters.creditCategory || 'All';
  const colors = rawLabels.map((label, i) => {
    const base = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899'][i % 10];
    if (activeCategory === 'All' || activeCategory === label) return base;
    return 'rgba(148,163,184,0.45)';
  });
  const labels = rawLabels.map(label => label.length > 24 ? label.slice(0, 22) + '…' : label);

  const barH = 32;
  const canvasH = Math.max(barH * 10, rawLabels.length * barH);
  const canvasW = ctx.parentElement ? (ctx.parentElement.clientWidth || 480) : 480;
  ctx.width = canvasW;
  ctx.height = canvasH;
  ctx.style.width = canvasW + 'px';
  ctx.style.height = canvasH + 'px';

  state.charts.creditCategory = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Category',
        data,
        backgroundColor: colors,
        borderRadius: 8,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      onClick: (_evt, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        const label = rawLabels[index];
        if (typeof setDashboardCategoryFilter === 'function') setDashboardCategoryFilter(label);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => rawLabels[items[0].dataIndex],
            label: (item) => {
              const netVal = categoryMap[rawLabels[item.dataIndex]];
              const s = isNet ? (netVal >= 0 ? '+' : '-') : sign;
              return ` ${s}${fmt(item.raw)}`;
            }
          }
        }
      },
      layout: { padding: { right: 120, top: 4, bottom: 4 } },
      scales: {
        x: { display: false, grid: { display: false } },
        y: {
          grid: { display: false },
          ticks: {
            font: { family: "'Aptos Narrow','Arial Narrow',Arial,sans-serif", size: 11 },
            color: '#475569',
            padding: 4
          }
        }
      }
    },
    plugins: [{
      id: 'creditCategoryValueLabels',
      afterDatasetsDraw(chart) {
        const { ctx: c } = chart;
        const meta = chart.getDatasetMeta(0);
        c.save();
        c.font = "600 11px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        meta.data.forEach((bar, i) => {
          const value = chart.data.datasets[0].data[i];
          const netVal = categoryMap[rawLabels[i]];
          const s = isNet ? (netVal >= 0 ? '+' : '-') : sign;
          c.fillStyle = colors[i] || '#334155';
          c.fillText(s + fmt(value), bar.x + 6, bar.y);
        });
        c.restore();
      }
    }]
  });
}

function buildCreditReferenceSpendingChart() {
  const ctx = document.getElementById('creditReferenceChart');
  if (!ctx) return;
  if (state.charts.creditReference) state.charts.creditReference.destroy();
  const txns = getFilteredTxns();
  const refMap = {};
  const { isNet, showIncome, label: modeLabel, sign } = _creditModeInfo();

  txns.forEach(t => {
    const amt = $usdAmt(t);
    if (!isNet && (showIncome ? amt <= 0 : amt >= 0)) return;
    const key = (t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference';
    refMap[key] = (refMap[key] || 0) + (isNet ? amt : Math.abs(amt));
  });

  const rawLabels = Object.keys(refMap).sort((a, b) => Math.abs(refMap[b]) - Math.abs(refMap[a]));
  if (!rawLabels.length) return;
  const data = rawLabels.map(k => Math.abs(refMap[k]));
  const activeReference = state.filters.creditReference || 'All';
  const colors = rawLabels.map((label, i) => {
    const base = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316','#14b8a6','#84cc16','#a855f7','#0ea5e9'][i % 12];
    return (activeReference === 'All' || activeReference === label) ? base : 'rgba(148,163,184,0.45)';
  });
  const labels = rawLabels.map(label => label.length > 24 ? label.slice(0, 22) + '…' : label);

  const barH = 32;
  const canvasH = Math.max(barH * 10, rawLabels.length * barH);
  const canvasW = ctx.parentElement ? (ctx.parentElement.clientWidth || 480) : 480;
  ctx.width = canvasW;
  ctx.height = canvasH;
  ctx.style.width = canvasW + 'px';
  ctx.style.height = canvasH + 'px';

  state.charts.creditReference = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Reference',
        data,
        backgroundColor: colors,
        borderRadius: 8,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      onClick: (_evt, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        const label = rawLabels[index];
        if (typeof setDashboardReferenceFilter === 'function') setDashboardReferenceFilter(label);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => rawLabels[items[0].dataIndex],
            label: (item) => {
              const netVal = refMap[rawLabels[item.dataIndex]];
              const s = isNet ? (netVal >= 0 ? '+' : '-') : sign;
              return ` ${s}${fmt(item.raw)}`;
            }
          }
        }
      },
      layout: { padding: { right: 120, top: 4, bottom: 4 } },
      scales: {
        x: { display: false, grid: { display: false } },
        y: {
          grid: { display: false },
          ticks: {
            font: { family: "'Aptos Narrow','Arial Narrow',Arial,sans-serif", size: 11 },
            color: '#475569',
            padding: 4
          }
        }
      }
    },
    plugins: [{
      id: 'creditReferenceValueLabels',
      afterDatasetsDraw(chart) {
        const { ctx: c } = chart;
        const meta = chart.getDatasetMeta(0);
        c.save();
        c.font = "600 11px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        meta.data.forEach((bar, i) => {
          const value = chart.data.datasets[0].data[i];
          const netVal = refMap[rawLabels[i]];
          const s = isNet ? (netVal >= 0 ? '+' : '-') : sign;
          c.fillStyle = colors[i] || '#334155';
          c.fillText(s + fmt(value), bar.x + 6, bar.y);
        });
        c.restore();
      }
    }]
  });
}

function buildBankInterDivisionSpendingChart() {
  const ctx = document.getElementById('bankInterDivisionChart');
  if (!ctx) return;
  if (state.charts.bankInterDivision) state.charts.bankInterDivision.destroy();
  const txns = getFilteredTxns();
  const map = {};

  txns.forEach(t => {
    const key = (t.interDivision || '').trim() || 'Unassigned';
    map[key] = (map[key] || 0) + Math.abs($usdAmt(t));
  });

  const labels = Object.keys(map).sort((a, b) => map[b] - map[a]).slice(0, 10);
  const data = labels.map(k => map[k]);
  const active = state.filters.bankInterDivision || 'All';
  const colors = labels.map((label, i) => {
    const base = ['#1d4ed8','#0f766e','#b45309','#7c3aed','#dc2626','#2563eb','#14b8a6','#f97316','#0ea5e9','#84cc16'][i % 10];
    if (active === 'All' || active === label) return base;
    return 'rgba(148,163,184,0.45)';
  });

  state.charts.bankInterDivision = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Inter Division',
        data,
        backgroundColor: colors,
        borderRadius: 8,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_evt, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        const label = labels[index];
        if (typeof setDashboardInterDivisionFilter === 'function') setDashboardInterDivisionFilter(label);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${fmt(item.raw)}`
          }
        }
      },
      layout: { padding: { right: 90 } },
      scales: {
        x: { display: false, grid: { display: false } },
        y: { grid: { display: false }, ticks: { font: { family: "'Aptos Narrow','Arial Narrow',Arial,sans-serif", size: 11 } } }
      }
    },
    plugins: [{
      id: 'interDivValueLabels',
      afterDatasetsDraw(chart) {
        const { ctx: c } = chart;
        const meta = chart.getDatasetMeta(0);
        c.save();
        c.font = "600 11px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        meta.data.forEach((bar, i) => {
          const value = chart.data.datasets[0].data[i];
          c.fillStyle = colors[i] || '#374151';
          c.fillText(fmt(value), bar.x + 6, bar.y);
        });
        c.restore();
      }
    }]
  });
}

function buildBankReferenceSpendingChart() {
  const ctx = document.getElementById('bankReferenceChart');
  if (!ctx) return;
  if (state.charts.bankReference) state.charts.bankReference.destroy();
  // Bypass bankReference filter so ALL bars always show; active one is highlighted below.
  const savedRef = state.filters.bankReference;
  state.filters.bankReference = 'All';
  const txns = getFilteredTxns();
  state.filters.bankReference = savedRef;

  // Aggregate by Reference column only (primary source)
  const refMap = {};
  txns.forEach(t => {
    const key = (t.reference || '').trim() || 'No Reference';
    refMap[key] = (refMap[key] || 0) + Math.abs($usdAmt(t));
  });

  // Sort highest → lowest
  const rawLabels = Object.keys(refMap).sort((a, b) => refMap[b] - refMap[a]);
  if (!rawLabels.length) return;

  const data   = rawLabels.map(k => refMap[k]);
  const active = state.filters.bankReference || 'All';
  const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316','#14b8a6','#84cc16','#a855f7','#0ea5e9'];

  const colors = rawLabels.map((lbl, i) =>
    (active === 'All' || active === lbl) ? COLORS[i % COLORS.length] : 'rgba(148,163,184,0.28)'
  );

  // Truncate long y-axis labels; show full name in tooltip
  const yLabels = rawLabels.map(l => l.length > 24 ? l.slice(0, 22) + '…' : l);

  // barH = 32px per label row.  Fix chart height explicitly BEFORE Chart.js init so
  // responsive mode doesn't collapse everything into the scroll-container's max-height.
  const barH       = 32;
  const canvasH    = Math.max(barH * 10, rawLabels.length * barH);
  const canvasW    = ctx.parentElement ? (ctx.parentElement.clientWidth || 480) : 480;
  ctx.width        = canvasW;
  ctx.height       = canvasH;
  ctx.style.width  = canvasW + 'px';
  ctx.style.height = canvasH + 'px';

  state.charts.bankReference = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: yLabels,
      datasets: [{
        label: 'Reference Spending',
        data,
        backgroundColor: colors,
        borderRadius: 3,
        maxBarThickness: 14,
        barPercentage: 0.65,
        categoryPercentage: 0.85,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      onClick: (_evt, elements) => {
        if (!elements.length) return;
        const lbl = rawLabels[elements[0].index];
        if (typeof setDashboardBankReferenceFilter === 'function') setDashboardBankReferenceFilter(lbl);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => rawLabels[items[0].dataIndex],
            label: (item)  => '  ' + fmt(item.raw)
          }
        }
      },
      layout: { padding: { right: 112, top: 4, bottom: 4 } },
      scales: {
        x: { display: false, grid: { display: false } },
        y: {
          grid: { display: false },
          ticks: {
            font: { family: "'Aptos Narrow','Arial Narrow',Arial,sans-serif", size: 11 },
            color: '#475569',
            padding: 4,
          }
        }
      }
    },
    plugins: [{
      id: 'refValueLabels',
      afterDatasetsDraw(chart) {
        const { ctx: c } = chart;
        const meta = chart.getDatasetMeta(0);
        c.save();
        c.font = "700 10.5px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        meta.data.forEach((bar, i) => {
          const isActive = active === 'All' || active === rawLabels[i];
          c.fillStyle = isActive ? COLORS[i % COLORS.length] : '#94a3b8';
          c.fillText(fmt(data[i]), bar.x + 8, bar.y);
        });
        c.restore();
      }
    }]
  });
}
