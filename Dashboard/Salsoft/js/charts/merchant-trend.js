function buildRevenueChart() {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;
  if (state.charts.revenue) state.charts.revenue.destroy();
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
    if (!dateMap[bucketKey]) dateMap[bucketKey] = { net: 0, fee: 0, vat: 0, label: bucketLabel };
    dateMap[bucketKey].net = (dateMap[bucketKey].net || 0) + (+t.net_amount || 0);
    dateMap[bucketKey].fee = (dateMap[bucketKey].fee || 0) + (+t.fee || 0);
    dateMap[bucketKey].vat = (dateMap[bucketKey].vat || 0) + (+t.vat || 0);
  });
  const buckets = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));
  const labels = buckets.map(k => dateMap[k].label);
  const visibleBuckets = buckets.map(k => dateMap[k].label);
  const netData = buckets.map(k => dateMap[k].net);
  const feeData = buckets.map(k => dateMap[k].fee);
  const vatData = buckets.map(k => dateMap[k].vat);
  const font = { family: "'Aptos Narrow','Arial Narrow',Arial,sans-serif", size: 12, weight: '500' };
  state.charts.revenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Net Amount', data: netData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.38, pointRadius: 2, pointHoverRadius: 9, pointHoverBorderWidth: 3, pointBackgroundColor: '#10b981', pointBorderColor: 'white', pointBorderWidth: 1.5 },
        { label: 'Fee', data: feeData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.06)', fill: true, tension: 0.38, pointRadius: 2, pointHoverRadius: 9, pointHoverBorderWidth: 3, pointBackgroundColor: '#f59e0b', pointBorderColor: 'white', pointBorderWidth: 1.5 },
        { label: 'VAT', data: vatData, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.06)', fill: true, tension: 0.38, pointRadius: 2, pointHoverRadius: 9, pointHoverBorderWidth: 3, pointBackgroundColor: '#8b5cf6', pointBorderColor: 'white', pointBorderWidth: 1.5 }
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

