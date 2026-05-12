// ============================================================
// BANK & COMPANY ANALYSIS
// ============================================================
function renderBankAnalysis(area) {
  const txns = state.filters.company !== 'All'
    ? state.transactions.filter(t => t.company === state.filters.company)
    : state.transactions;

  const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];

  const bankMap = {};
  state.banks.forEach(b => { bankMap[b] = 0; });
  txns.forEach(t => {
    const b = t.bank || 'Unknown';
    if (bankMap[b] !== undefined) bankMap[b] += Math.abs(+t.amount || 0);
  });
  const bankLabels = state.banks
    .filter(b => (bankMap[b] || 0) > 0)
    .sort((a, b) => bankMap[b] - bankMap[a]);
  const bankData   = bankLabels.map(k => bankMap[k]);
  const totalVol   = bankData.reduce((s,v) => s+v, 0);

  const compMap = {};
  txns.forEach(t => { const c = t.company || 'Unknown'; compMap[c] = (compMap[c] || 0) + 1; });
  const compLabels = Object.keys(compMap).sort((a,b) => compMap[b] - compMap[a]);
  const compData   = compLabels.map(k => compMap[k]);

  const curMap = {};
  txns.forEach(t => { const c = t.currency || 'Unknown'; curMap[c] = (curMap[c] || 0) + 1; });
  const curLabels = Object.keys(curMap);
  const curData   = curLabels.map(k => curMap[k]);

  area.innerHTML = `
    <div style="margin-bottom:18px">
      <div style="font-size:19px;font-weight:800;color:var(--text)">Bank &amp; Company Analysis</div>
      <div style="font-size:13px;color:var(--text2);margin-top:3px">Volume by bank, company activity &amp; currency breakdown</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px">
      <div style="background:var(--blue-light);color:var(--blue);padding:8px 16px;border-radius:20px;font-size:12.5px;font-weight:700">Banks: ${bankLabels.length}</div>
      <div style="background:var(--green-light);color:var(--green);padding:8px 16px;border-radius:20px;font-size:12.5px;font-weight:700">Companies: ${compLabels.length}</div>
      <div style="background:var(--purple-light);color:var(--purple);padding:8px 16px;border-radius:20px;font-size:12.5px;font-weight:700">Currencies: ${curLabels.length}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
      <div class="chart-card">
        <div class="chart-card-header"><div><div class="chart-title">Amount by Bank</div><div class="chart-subtitle">Total volume per bank</div></div></div>
        <canvas id="bankAmtChart" height="180"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-card-header"><div><div class="chart-title">Transactions by Company</div><div class="chart-subtitle">Count per company</div></div></div>
        <canvas id="compTxnChart" height="180"></canvas>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:18px">
      <div class="chart-card">
        <div class="chart-card-header"><div><div class="chart-title">Currency Distribution</div><div class="chart-subtitle">Transaction share by currency</div></div></div>
        <canvas id="currencyChart" height="200"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-card-header"><div class="chart-title">Bank Detail</div></div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr>
              <th style="text-align:left;padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text2);font-weight:600">Bank</th>
              <th style="text-align:right;padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text2);font-weight:600">Volume</th>
              <th style="text-align:right;padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text2);font-weight:600">Share</th>
            </tr></thead>
            <tbody>
              ${bankLabels.map((b, i) => {
                const vol = bankMap[b];
                const sharePercent = totalVol > 0 ? (vol / totalVol * 100) : 0;
                const share = sharePercent.toFixed(2);
                const shareInt = Math.round(sharePercent);
                const color = BAR_COLORS[i % BAR_COLORS.length];
                return '<tr>'
                  + '<td style="padding:8px 12px;border-bottom:1px solid var(--border)">'
                  + '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';margin-right:8px;vertical-align:middle"></span>' + b
                  + '</td>'
                  + '<td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:right;font-weight:600">' + fmt(vol) + '</td>'
                  + '<td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:right">'
                  + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">'
                  + '<div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">'
                  + '<div style="width:' + shareInt + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>'
                  + '<span style="font-size:12px;color:var(--text2);min-width:28px;text-align:right">' + share + '%</span>'
                  + '</div></td></tr>';
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const bCtx = document.getElementById('bankAmtChart');
    if (bCtx) {
      if (state.charts.bankAmt) state.charts.bankAmt.destroy();
      state.charts.bankAmt = new Chart(bCtx, {
        type: 'bar',
        data: { labels: bankLabels, datasets: [{ label: 'Volume', data: bankData, backgroundColor: bankLabels.map((_,i) => BAR_COLORS[i%BAR_COLORS.length]), borderRadius: 6, borderSkipped: false }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' } }, y: { grid: { display: false } } } }
      });
    }
    const cCtx = document.getElementById('compTxnChart');
    if (cCtx) {
      if (state.charts.compTxn) state.charts.compTxn.destroy();
      state.charts.compTxn = new Chart(cCtx, {
        type: 'bar',
        data: { labels: compLabels, datasets: [{ label: 'Transactions', data: compData, backgroundColor: compLabels.map(c => (getCompanyColor(c,'primary')||'#6b7280')+'cc'), borderRadius: 6, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.04)' } } } }
      });
    }
    const rCtx = document.getElementById('currencyChart');
    if (rCtx) {
      if (state.charts.currency) state.charts.currency.destroy();
      state.charts.currency = new Chart(rCtx, {
        type: 'doughnut',
        data: { labels: curLabels, datasets: [{ data: curData, backgroundColor: curLabels.map((_,i) => BAR_COLORS[i%BAR_COLORS.length]), borderWidth: 2, borderColor: 'white' }] },
        options: { responsive: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 12 } } } }
      });
    }
  }, 50);
}

