function buildFinancialStackChart() {
  const ctx = document.getElementById('financialStackChart');
  if (!ctx) return;
  if (state.charts.financialStack) state.charts.financialStack.destroy();
  const txns = getFilteredTxns();
  const totals = txns.reduce((acc, txn) => {
    acc.net += Math.abs($usdNetAmt(txn));
    acc.fee += Math.abs($usdFee(txn));
    acc.vat += Math.abs($usdVat(txn));
    return acc;
  }, { net: 0, fee: 0, vat: 0 });
  state.charts.financialStack = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Current View'],
      datasets: [
        { label: 'Fee', data: [totals.fee], backgroundColor: '#f59e0b', borderRadius: 10, borderSkipped: false },
        { label: 'VAT', data: [totals.vat], backgroundColor: '#ef4444', borderRadius: 10, borderSkipped: false },
        { label: 'Net', data: [totals.net], backgroundColor: '#10b981', borderRadius: 10, borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 12 } },
        tooltip: {
          callbacks: {
            label: (item) => ' ' + item.dataset.label + ': ' + fmt(item.raw || 0)
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: value => '$' + Number(value).toLocaleString() }
        }
      }
    }
  });
}

