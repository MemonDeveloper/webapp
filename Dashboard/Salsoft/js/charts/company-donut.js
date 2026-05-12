function buildPeopleDonutChart() {
  const ctx = document.getElementById('peopleDonutChart');
  if (!ctx) return;
  if (state.charts.peopleDonut) state.charts.peopleDonut.destroy();
  const txns = getFilteredTxns();
  const peopleMap = {};
  txns.forEach(t => {
    const p = String(t.people || '').trim();
    if (!p) return;
    peopleMap[p] = (peopleMap[p] || 0) + Math.abs(+t.amount || 0);
  });
  const labels = Object.keys(peopleMap).sort((a, b) => peopleMap[b] - peopleMap[a]);
  if (!labels.length) return;
  const data = labels.map(l => peopleMap[l]);
  const total = data.reduce((s, v) => s + v, 0);
  const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#f97316'];
  const colors = labels.map((_, i) => COLORS[i % COLORS.length]);

  state.charts.peopleDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'rgba(255,255,255,0.96)',
        borderWidth: 3,
        hoverOffset: 14,
        hoverBorderWidth: 5,
        spacing: 4,
        minArcLength: 25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,0.94)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          padding: 12,
          callbacks: {
            label: (item) => {
              const share = ((item.raw / (total || 1)) * 100).toFixed(1);
              return ` ${fmt(item.raw)} · ${share}%`;
            }
          }
        }
      },
      layout: { padding: 20 }
    },
    plugins: [{
      id: 'peopleCenterText',
      afterDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data.length) return;
        const { ctx: c } = chart;
        const x = meta.data[0].x, y = meta.data[0].y;
        c.save();
        c.textAlign = 'center';
        c.fillStyle = '#6b7280';
        c.font = "700 10px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
        c.fillText('Total Volume', x, y - 8);
        c.fillStyle = '#111827';
        c.font = "800 15px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
        c.fillText(fmt(total), x, y + 10);
        c.restore();
      }
    }]
  });
}

function buildCompanyDonutChart() {
  const ctx = document.getElementById('companyDonutChart');
  const compactCtx = document.getElementById('companyDonutChartCompact');
  if (!ctx && !compactCtx) return;
  if (state.charts.companyDonut) state.charts.companyDonut.destroy();
  if (state.charts.companyDonutCompact) state.charts.companyDonutCompact.destroy();
  const txns = getFilteredTxns();
  const activeBankType = (state.filters.bankType || 'All').toLowerCase();
  const isMerchantType = activeBankType.includes('merchant');
  const isBankDashType = activeBankType.includes('bank') && !activeBankType.includes('merchant') && !activeBankType.includes('credit');
  const bCashMode = state.filters.bankCashMode || 'all';
  const isBalMode = bCashMode === 'opening' || bCashMode === 'closing';

  const companyMap = {};
  if (isBalMode) {
    const acctMap = {};
    txns.forEach(t => {
      const company = (t.company || 'Unknown').trim();
      const account = ((t.accountNumber || '').trim()) || '_';
      const key = company + '||' + account;
      const bal = $usdBalance(t);
      if (bal == null) return;
      const dateStr = t.date || '';
      if (!acctMap[key]) acctMap[key] = { company, opening: null, closing: null, minDate: '', maxDate: '' };
      const g = acctMap[key];
      if (!g.minDate || dateStr < g.minDate) { g.minDate = dateStr; g.opening = bal; }
      if (!g.maxDate || dateStr > g.maxDate) { g.maxDate = dateStr; g.closing = bal; }
    });
    Object.values(acctMap).forEach(g => {
      const val = Math.abs(bCashMode === 'opening' ? (g.opening || 0) : (g.closing || 0));
      if (val > 0) companyMap[g.company] = (companyMap[g.company] || 0) + val;
    });
  } else {
    const chartValue = (t) => isMerchantType ? $usdNetAmt(t) : Math.abs($usdAmt(t));
    txns.forEach(t => {
      const company = (t.company || 'Unknown').trim() || 'Unknown';
      companyMap[company] = (companyMap[company] || 0) + chartValue(t);
    });
  }

  const labels = Object.keys(companyMap).sort((a, b) => companyMap[b] - companyMap[a]);
  if (!labels.length) return;
  const data = labels.map(label => companyMap[label]);
  const total = data.reduce((sum, value) => sum + value, 0);
  const _bankCredits = (!isBalMode && isBankDashType) ? txns.filter(t => $usdAmt(t) > 0).reduce((s,t) => s+$usdAmt(t), 0) : 0;
  const _bankDebits  = (!isBalMode && isBankDashType) ? txns.filter(t => $usdAmt(t) < 0).reduce((s,t) => s+Math.abs($usdAmt(t)), 0) : 0;
  const centerLabel = isBalMode
    ? (bCashMode === 'opening' ? 'Opening Bal' : 'Closing Bal')
    : isMerchantType ? 'Total Net Amount'
    : isBankDashType ? 'Net Cash Flow'
    : 'Total Volume';
  const centerValue = (!isBalMode && isBankDashType) ? fmt(_bankCredits - _bankDebits) : fmt(total);
  const colors = labels.map((label, index) => getCompanyColor(label, 'primary') || ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'][index % 6]);
  const createChart = (canvasEl, cutout, pad, pluginId, totalFont, isCompact) => new Chart(canvasEl, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'rgba(255,255,255,0.96)',
        borderWidth: 3,
        hoverOffset: 14,
        hoverBorderWidth: 5,
        spacing: 4,
        minArcLength: 25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout,
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
          callbacks: {
            label: (item) => {
              const value = item.raw || 0;
              const sharePercent = (value / (total || 1)) * 100;
              const share = sharePercent.toFixed(2);
              return ` ${fmt(value)} • ${share}%`;
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
        chartCtx.fillText(centerLabel, x, y - 8);
        chartCtx.fillStyle = '#111827';
        chartCtx.font = totalFont;
        chartCtx.fillText(centerValue, x, y + 10);
        chartCtx.restore();
      }
    }]
  });

  if (ctx) {
    state.charts.companyDonut = createChart(ctx, '62%', 20, 'companyCenterText', "800 15px 'Aptos Narrow','Arial Narrow',Arial,sans-serif", false);
  }
  if (compactCtx) {
    state.charts.companyDonutCompact = createChart(compactCtx, '60%', 8, 'companyCenterTextCompact', "800 12px 'Aptos Narrow','Arial Narrow',Arial,sans-serif", true);
  }
}

