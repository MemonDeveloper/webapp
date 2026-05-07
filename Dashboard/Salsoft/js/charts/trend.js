function buildTrendChart(creditOnly) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  if (state.charts.trend) state.charts.trend.destroy();
  const txns = getFilteredTxns();
  const granularity = state.filters.chartGranularity || 'daily';
  const dateMap = {};
  txns.forEach(t => {
    if (!t.date) return;
    const dateValue = new Date(t.date);
    if (Number.isNaN(dateValue.getTime())) return;
    let bucketKey = t.date.slice(0, 10);
    let bucketLabel = bucketKey;
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
    } else {
      bucketLabel = dateValue.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }
    if (!dateMap[bucketKey]) dateMap[bucketKey] = { credit: 0, debit: 0, label: bucketLabel };
    const amt = +t.amount || 0;
    if (amt > 0) dateMap[bucketKey].credit += amt;
    else if (amt < 0) dateMap[bucketKey].debit += Math.abs(amt);
  });
  const allBuckets = Object.keys(dateMap).sort();
  const bucketLimit = granularity === 'daily' ? 60 : granularity === 'weekly' ? 24 : 18;
  const visibleBuckets = allBuckets.slice(-bucketLimit);
  const labels = visibleBuckets.map(bucket => dateMap[bucket].label);
  const cData = visibleBuckets.map(bucket => dateMap[bucket].credit);
  const dData = visibleBuckets.map(bucket => dateMap[bucket].debit);
  const font = { family: "'Aptos Narrow','Arial Narrow',Arial,sans-serif", size: 11 };
  state.charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Credit', data: cData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.09)', fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#10b981', pointBorderColor: 'white', pointBorderWidth: 1.5 },
        { label: 'Debit',  data: dData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.07)',  fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#ef4444', pointBorderColor: 'white', pointBorderWidth: 1.5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
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
            title: (items) => visibleBuckets[items[0].dataIndex] + '  (' + labels[items[0].dataIndex] + ')',
            label: (item) => '  ' + item.dataset.label + ': ' + fmt(item.raw)
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
    const amt = +t.amount || 0;
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

function buildCreditCategorySpendingChart() {
  const ctx = document.getElementById('creditCategoryChart');
  if (!ctx) return;
  if (state.charts.creditCategory) state.charts.creditCategory.destroy();
  const txns = getFilteredTxns();
  const categoryMap = {};

  txns.forEach(t => {
    const amt = +t.amount || 0;
    if (amt >= 0) return;
    const key = (t.category || 'Uncategorized').trim() || 'Uncategorized';
    categoryMap[key] = (categoryMap[key] || 0) + Math.abs(amt);
  });

  const labels = Object.keys(categoryMap).sort((a, b) => categoryMap[b] - categoryMap[a]).slice(0, 10);
  const data = labels.map(k => categoryMap[k]);
  const activeCategory = state.filters.creditCategory || 'All';
  const colors = labels.map((label, i) => {
    const base = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899'][i % 10];
    if (activeCategory === 'All' || activeCategory === label) return base;
    return 'rgba(148,163,184,0.45)';
  });

  state.charts.creditCategory = new Chart(ctx, {
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
        if (typeof setDashboardCategoryFilter === 'function') setDashboardCategoryFilter(label);
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
      scales: {
        x: { ticks: { callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function buildCreditReferenceSpendingChart() {
  const ctx = document.getElementById('creditReferenceChart');
  if (!ctx) return;
  if (state.charts.creditReference) state.charts.creditReference.destroy();
  const txns = getFilteredTxns();
  const refMap = {};

  txns.forEach(t => {
    const amt = +t.amount || 0;
    if (amt >= 0) return;
    const key = (t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference';
    refMap[key] = (refMap[key] || 0) + Math.abs(amt);
  });

  const labels = Object.keys(refMap).sort((a, b) => refMap[b] - refMap[a]).slice(0, 10);
  const data = labels.map(k => refMap[k]);
  const activeReference = state.filters.creditReference || 'All';
  const colors = labels.map(label => (activeReference === 'All' || activeReference === label) ? 'rgba(59,130,246,0.82)' : 'rgba(148,163,184,0.45)');

  state.charts.creditReference = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Reference Spending',
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
        if (typeof setDashboardReferenceFilter === 'function') setDashboardReferenceFilter(label);
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
      scales: {
        x: { ticks: { callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { grid: { display: false } }
      }
    }
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
    map[key] = (map[key] || 0) + Math.abs(+t.amount || 0);
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
      scales: {
        x: { ticks: { callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function buildBankReferenceSpendingChart() {
  const ctx = document.getElementById('bankReferenceChart');
  if (!ctx) return;
  if (state.charts.bankReference) state.charts.bankReference.destroy();
  const txns = getFilteredTxns();
  const refMap = {};

  txns.forEach(t => {
    const key = (t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference';
    refMap[key] = (refMap[key] || 0) + Math.abs(+t.amount || 0);
  });

  const labels = Object.keys(refMap).sort((a, b) => refMap[b] - refMap[a]).slice(0, 10);
  const data = labels.map(k => refMap[k]);
  const active = state.filters.bankReference || 'All';
  const colors = labels.map(label => (active === 'All' || active === label) ? 'rgba(59,130,246,0.82)' : 'rgba(148,163,184,0.45)');

  state.charts.bankReference = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Reference Spending',
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
        if (typeof setDashboardBankReferenceFilter === 'function') setDashboardBankReferenceFilter(label);
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
      scales: {
        x: { ticks: { callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { grid: { display: false } }
      }
    }
  });
}
