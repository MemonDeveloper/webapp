function buildInterDivisionChart() {
  const ctx = document.getElementById('interDivisionChart');
  if (!ctx) return;
  if (state.charts.interDivision) state.charts.interDivision.destroy();
  const txns = getFilteredTxns();
  const map = {};
  txns.forEach(t => {
    const key = (t.interDivision || '').trim() || 'Unassigned';
    map[key] = (map[key] || 0) + Math.abs(+t.amount || 0);
  });
  const labels = Object.keys(map).sort((a, b) => map[b] - map[a]).slice(0, 8);
  if (!labels.length) return;
  const data = labels.map(label => map[label]);
  state.charts.interDivision = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Volume',
        data,
        backgroundColor: ['#1d4ed8','#0f766e','#b45309','#7c3aed','#dc2626','#2563eb','#14b8a6','#f97316'],
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 34
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ' ' + fmt(item.raw || 0)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: value => '$' + Number(value).toLocaleString() }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

