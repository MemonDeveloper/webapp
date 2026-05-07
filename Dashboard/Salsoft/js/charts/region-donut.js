function buildRegionDonutChart() {
  const ctx = document.getElementById('regionDonutChart');
  if (!ctx) return;
  if (state.charts.regionDonut) state.charts.regionDonut.destroy();
  const regionColors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#14b8a6','#f97316'];
  const txns = getFilteredTxns();
  const activeBankType = (state.filters.bankType || 'All').toLowerCase();
  const isMerchantType = activeBankType.includes('merchant');
  const chartValue = (t) => isMerchantType ? (+t.net_amount || 0) : Math.abs(+t.amount || 0);
  const regionMap = {};
  txns.forEach(t => {
    const region = state.companyRegions[t.company] || 'Other';
    regionMap[region] = (regionMap[region] || 0) + chartValue(t);
  });
  const labels = Object.keys(regionMap).sort((a, b) => regionMap[b] - regionMap[a]);
  if (!labels.length) return;
  const total = Object.values(regionMap).reduce((sum, value) => sum + value, 0);
  const datasets = labels.map((label, index) => {
    const outerRadius = Math.max(42, 98 - (index * 12));
    const innerRadius = Math.max(20, outerRadius - 16);
    return {
      label,
      data: [regionMap[label], Math.max(0, total - regionMap[label])],
      backgroundColor: [regionColors[index % regionColors.length], 'rgba(148,163,184,0.16)'],
      borderColor: ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.55)'],
      borderWidth: [2, 1],
      hoverOffset: 10,
      hoverBorderWidth: 5,
      spacing: 3,
      radius: `${outerRadius}%`,
      cutout: `${innerRadius}%`
    };
  });
  const centerTextPlugin = {
    id: 'regionCenterText',
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
      ctx.fillText('Total Volume', x, y - 10);
      ctx.fillStyle = '#111827';
      ctx.font = "800 15px 'Aptos Narrow','Arial Narrow',Arial,sans-serif";
      ctx.fillText(fmt(total), x, y + 12);
      ctx.restore();
    }
  };
  state.charts.regionDonut = new Chart(ctx, {
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
        padding: 18
      }
    },
    plugins: [centerTextPlugin]
  });
}
