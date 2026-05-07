function buildCompanyDonutChart() {
  const ctx = document.getElementById('companyDonutChart');
  if (!ctx) return;
  if (state.charts.companyDonut) state.charts.companyDonut.destroy();
  const txns = getFilteredTxns();
  const activeBankType = (state.filters.bankType || 'All').toLowerCase();
  const isMerchantType = activeBankType.includes('merchant');
  const chartValue = (t) => isMerchantType ? (+t.net_amount || 0) : Math.abs(+t.amount || 0);
  const companyMap = {};
  txns.forEach(t => {
    const company = (t.company || 'Unknown').trim() || 'Unknown';
    companyMap[company] = (companyMap[company] || 0) + chartValue(t);
  });
  const labels = Object.keys(companyMap).sort((a, b) => companyMap[b] - companyMap[a]);
  if (!labels.length) return;
  const data = labels.map(label => companyMap[label]);
  const total = data.reduce((sum, value) => sum + value, 0);
  const colors = labels.map((label, index) => getCompanyColor(label, 'primary') || ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'][index % 6]);
  const centerTextPlugin = {
    id: 'companyCenterText',
    afterDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;
      const { ctx } = chart;
      const x = meta.data[0].x;
      const y = meta.data[0].y;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6b7280';
      ctx.font = "700 11px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
      ctx.fillText(isMerchantType ? 'Total Net Amount' : 'Total Volume', x, y - 10);
      ctx.fillStyle = '#111827';
      ctx.font = "800 15px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
      ctx.fillText(fmt(total), x, y + 12);
      ctx.restore();
    }
  };
  state.charts.companyDonut = new Chart(ctx, {
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
        padding: 20
      }
    },
    plugins: [centerTextPlugin]
  });
}

