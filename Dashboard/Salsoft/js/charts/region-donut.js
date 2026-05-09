function buildRegionDonutChart() {
  const ctx = document.getElementById('regionDonutChart');
  const compactCtx = document.getElementById('regionDonutChartCompact');
  if (!ctx && !compactCtx) return;
  if (state.charts.regionDonut) state.charts.regionDonut.destroy();
  if (state.charts.regionDonutCompact) state.charts.regionDonutCompact.destroy();
  const regionColors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#14b8a6','#f97316'];
  const txns = getFilteredTxns();
  const activeBankType = (state.filters.bankType || 'All').toLowerCase();
  const isMerchantType = activeBankType.includes('merchant');
  const isBankDashType = activeBankType.includes('bank') && !activeBankType.includes('merchant') && !activeBankType.includes('credit');
  const bCashMode = state.filters.bankCashMode || 'all';
  const isBalMode = bCashMode === 'opening' || bCashMode === 'closing';

  const regionMap = {};
  if (isBalMode) {
    const acctMap = {};
    txns.forEach(t => {
      const company = (t.company || 'Unknown').trim();
      const region = state.companyRegions[company] || 'Other';
      const account = ((t.accountNumber || '').trim()) || '_';
      const key = region + '||' + account;
      const bal = $usdBalance(t);
      if (bal == null) return;
      const dateStr = t.date || '';
      if (!acctMap[key]) acctMap[key] = { region, opening: null, closing: null, minDate: '', maxDate: '' };
      const g = acctMap[key];
      if (!g.minDate || dateStr < g.minDate) { g.minDate = dateStr; g.opening = bal; }
      if (!g.maxDate || dateStr > g.maxDate) { g.maxDate = dateStr; g.closing = bal; }
    });
    Object.values(acctMap).forEach(g => {
      const val = Math.abs(bCashMode === 'opening' ? (g.opening || 0) : (g.closing || 0));
      if (val > 0) regionMap[g.region] = (regionMap[g.region] || 0) + val;
    });
  } else {
    const chartValue = (t) => isMerchantType ? $usdNetAmt(t) : Math.abs($usdAmt(t));
    txns.forEach(t => {
      const region = state.companyRegions[t.company] || 'Other';
      regionMap[region] = (regionMap[region] || 0) + chartValue(t);
    });
  }

  const _rCredits = (!isBalMode && isBankDashType) ? txns.filter(t => $usdAmt(t) > 0).reduce((s,t) => s+$usdAmt(t), 0) : 0;
  const _rDebits  = (!isBalMode && isBankDashType) ? txns.filter(t => $usdAmt(t) < 0).reduce((s,t) => s+Math.abs($usdAmt(t)), 0) : 0;
  const rCenterLabel = isBalMode
    ? (bCashMode === 'opening' ? 'Opening Bal' : 'Closing Bal')
    : isBankDashType ? 'Net Cash Flow'
    : 'Total Volume';
  const rCenterValue = (!isBalMode && isBankDashType) ? fmt(_rCredits - _rDebits) : null;
  const sortedLabels = Object.keys(regionMap).sort((a, b) => regionMap[b] - regionMap[a]);
  if (!sortedLabels.length) return;
  const MAX_LAYER_COUNT = 5;
  const labels = sortedLabels.slice(0, MAX_LAYER_COUNT);
  if (sortedLabels.length > MAX_LAYER_COUNT) {
    const hasOtherInTop = labels.includes('Other');
    const otherValue = sortedLabels
      .slice(MAX_LAYER_COUNT)
      .reduce((sum, label) => sum + (regionMap[label] || 0), 0);
    if (otherValue > 0) {
      regionMap.Other = (regionMap.Other || 0) + otherValue;
      if (!hasOtherInTop) labels.push('Other');
    }
  }
  const total = labels.reduce((sum, label) => sum + (regionMap[label] || 0), 0);
  const datasets = labels.map((label, index) => {
    const outerRadius = Math.max(36, 100 - (index * 14));
    const innerRadius = Math.max(10, outerRadius - 22);
    return {
      label,
      data: [regionMap[label], Math.max(0, total - regionMap[label])],
      backgroundColor: [regionColors[index % regionColors.length], 'rgba(148,163,184,0.14)'],
      borderColor: ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.45)'],
      borderWidth: [1, 0.5],
      hoverOffset: 10,
      hoverBorderWidth: 2,
      spacing: 0,
      radius: `${outerRadius}%`,
      cutout: `${innerRadius}%`
    };
  });
  const createChart = (canvasEl, pad, pluginId, totalFont, isCompact) => new Chart(canvasEl, {
    type: 'doughnut',
    data: {
      labels: ['Share', 'Remaining'],
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,0.94)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          padding: 12,
          displayColors: true,
          filter: (item) => item.dataIndex === 0,
          callbacks: {
            title: (items) => items && items.length ? items[0].dataset.label : '',
            label: (item) => {
              const value = item.dataset.data[0] || 0;
              const sharePercent = (value / (total || 1)) * 100;
              return ` ${fmt(value)} • ${sharePercent.toFixed(2)}%`;
            }
          }
        }
      },
      layout: {
        padding: pad
      }
    },
    plugins: [{
      id: pluginId,
      afterDraw(chart) {
        if (isCompact) return;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data.length) return;
        const { ctx: chartCtx } = chart;
        const x = meta.data[0].x;
        const y = meta.data[0].y;
        chartCtx.save();
        chartCtx.textAlign = 'center';
        chartCtx.fillStyle = '#6b7280';
        chartCtx.font = "700 10px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
        chartCtx.fillText(rCenterLabel, x, y - 8);
        chartCtx.fillStyle = '#111827';
        chartCtx.font = totalFont;
        chartCtx.fillText(rCenterValue !== null ? rCenterValue : fmt(total), x, y + 10);
        chartCtx.restore();
      }
    }]
  });

  if (ctx) {
    state.charts.regionDonut = createChart(ctx, 18, 'regionCenterText', "800 15px 'Aptos Narrow','Arial Narrow',Arial,sans-serif", false);
  }
  if (compactCtx) {
    state.charts.regionDonutCompact = createChart(compactCtx, 8, 'regionCenterTextCompact', "800 12px 'Aptos Narrow','Arial Narrow',Arial,sans-serif", true);
  }
}
