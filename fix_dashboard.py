content = open(r'e:\webapp\Dashboard\Salsoft\finance-dashboard.html', encoding='utf-8').read()

# ── renderDashboard old → new ──────────────────────────────────────────────────
old_render_start = """function renderDashboard(area) {
  const txns = state.filters.company !== 'All'
    ? state.transactions.filter(t => t.company === state.filters.company)
    : state.transactions;
  const credits = txns.filter(t=>(+t.amount||0)>0).reduce((s,t)=>s+(+t.amount||0),0);
  const debits  = txns.filter(t=>(+t.amount||0)<0).reduce((s,t)=>s+Math.abs(+t.amount||0),0);
  const balance = credits - debits;
  const totalFlow = credits + debits;
  const creditPct = totalFlow > 0 ? Math.round((credits / totalFlow) * 100) : 50;
  const debitPct = 100 - creditPct;
  const curMonth = new Date().getMonth();
  const monthlyIn  = txns.filter(t=>(+t.amount||0)>0&&new Date(t.date).getMonth()===curMonth).reduce((s,t)=>s+(+t.amount||0),0);
  const monthlyOut = txns.filter(t=>(+t.amount||0)<0&&new Date(t.date).getMonth()===curMonth).reduce((s,t)=>s+Math.abs(+t.amount||0),0);

  updateSidebarBalances(balance, credits, debits);

  const filteredPeople = state.filters.company !== 'All'
    ? state.people.filter(p => p.company === state.filters.company)
    : state.people;
  const avatarColors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899'];"""

new_render_start = """function renderDashboard(area) {
  const txns = state.filters.company !== 'All'
    ? state.transactions.filter(t => t.company === state.filters.company)
    : state.transactions;
  const credits = txns.filter(t=>(+t.amount||0)>0).reduce((s,t)=>s+(+t.amount||0),0);
  const debits  = txns.filter(t=>(+t.amount||0)<0).reduce((s,t)=>s+Math.abs(+t.amount||0),0);
  const balance = credits - debits;
  updateSidebarBalances(balance, credits, debits);

  const filteredPeople = state.filters.company !== 'All'
    ? state.people.filter(p => p.company === state.filters.company)
    : state.people;"""

assert old_render_start in content, "ERROR: old_render_start not found"
content = content.replace(old_render_start, new_render_start, 1)
print("Step 1 done: cleaned up renderDashboard header")

# ── Replace old area.innerHTML + post code up to end of renderDashboard ────────
old_area_to_end = """  area.innerHTML = `
    <div class="stats-grid">"""

# Find where the old area.innerHTML starts
idx_area = content.find(old_area_to_end)
assert idx_area != -1, "ERROR: old area.innerHTML not found"

# Find the end of renderDashboard function (end of setTimeout block before buildTrendChart)
end_marker = "\nfunction buildTrendChart() {"
idx_end = content.find(end_marker, idx_area)
assert idx_end != -1, "ERROR: buildTrendChart marker not found"

old_section = content[idx_area:idx_end]
print(f"Step 2: Found old section length={len(old_section)}")

new_section = r"""  const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];
  const regionColors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];
  const compVolMap = {};
  txns.forEach(t => { const c = t.company || 'Unknown'; compVolMap[c] = (compVolMap[c] || 0) + Math.abs(+t.amount || 0); });
  const compVolLabels = Object.keys(compVolMap).sort((a, b) => compVolMap[b] - compVolMap[a]);
  const totalCompVol = compVolLabels.reduce((s, c) => s + compVolMap[c], 0);
  const bankVolMap = {};
  txns.forEach(t => { const b = t.bank || 'Unknown'; bankVolMap[b] = (bankVolMap[b] || 0) + Math.abs(+t.amount || 0); });
  const bankVolLabels = Object.keys(bankVolMap).sort((a, b) => bankVolMap[b] - bankVolMap[a]);
  const totalBankVol = bankVolLabels.reduce((s, b) => s + bankVolMap[b], 0);
  const regionMap = {};
  txns.forEach(t => { const r = state.companyRegions[t.company] || companyRegions[t.company] || 'Other'; regionMap[r] = (regionMap[r] || 0) + Math.abs(+t.amount || 0); });
  const regionLabels = Object.keys(regionMap).sort((a, b) => regionMap[b] - regionMap[a]);
  const totalRegionVol = regionLabels.reduce((s, r) => s + regionMap[r], 0);
  const thS = 'text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--text2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;background:var(--surface2)';
  const thR = 'text-align:right;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--text2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;background:var(--surface2)';
  function miniRows(labels, volMap, totalVol, colorFn, cntFilter) {
    return labels.map((item, i) => {
      const vol = volMap[item];
      const cnt = txns.filter(cntFilter(item)).length;
      const share = totalVol > 0 ? Math.round(vol / totalVol * 100) : 0;
      const color = colorFn(item, i);
      return '<tr>'
        + '<td style="padding:8px 10px;border-bottom:1px solid var(--border)">'
        + '<div style="display:flex;align-items:center;gap:7px"><span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;display:inline-block"></span><span style="font-weight:700">' + item + '</span></div>'
        + '<div style="margin-left:15px;margin-top:4px;height:3px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:' + share + '%;height:100%;background:' + color + ';border-radius:2px"></div></div>'
        + '</td>'
        + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;color:var(--text2);font-weight:600;font-size:12px">' + cnt + '</td>'
        + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px">' + fmt(vol) + '</td>'
        + '</tr>';
    }).join('');
  }

  area.innerHTML = `
    <!-- PANEL 1: Total Detail -->
    <div style="display:grid;grid-template-columns:260px 1fr 260px;gap:16px;margin-bottom:18px;align-items:stretch">
      <div style="background:var(--surface);border-radius:var(--radius);padding:24px 22px;box-shadow:var(--shadow);border:1px solid var(--border);display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px">Total Available Balance</div>
        <div style="font-size:30px;font-weight:800;color:var(--text);letter-spacing:-1px;margin-bottom:22px">${fmt(balance)}</div>
        <div style="height:1px;background:var(--border);margin-bottom:22px"></div>
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px">Total Transactions</div>
        <div style="font-size:30px;font-weight:800;color:var(--blue)">${txns.length}</div>
      </div>
      <div style="background:var(--surface);border-radius:var(--radius);padding:16px 20px;box-shadow:var(--shadow);border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:140px">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px;align-self:flex-start">Team</div>
        ${filteredPeople.length === 0
          ? '<span style="font-size:13px;color:var(--text3)">No people found</span>'
          : `<div class="people-carousel" style="width:100%">
              <button class="people-nav-btn" onclick="scrollAvatars(-1)">&#8249;</button>
              <div class="people-avatar-row" id="people-avatar-scroll" data-page="0">${peopleAvatarsHTML}</div>
              <button class="people-nav-btn" onclick="scrollAvatars(1)">&#8250;</button>
            </div>`
        }
      </div>
      <div style="background:var(--surface);border-radius:var(--radius);padding:24px 22px;box-shadow:var(--shadow);border:1px solid var(--border);display:flex;flex-direction:column;justify-content:center">
        <div style="margin-bottom:22px">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--red)"></div>
            <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.6px">Total Debit</div>
          </div>
          <div style="font-size:30px;font-weight:800;color:var(--red);letter-spacing:-1px">${fmt(debits)}</div>
        </div>
        <div style="height:1px;background:var(--border);margin-bottom:22px"></div>
        <div>
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--green)"></div>
            <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.6px">Total Credit</div>
          </div>
          <div style="font-size:30px;font-weight:800;color:var(--green);letter-spacing:-1px">${fmt(credits)}</div>
        </div>
      </div>
    </div>

    <!-- PANEL 2: Transaction Graph -->
    <div class="chart-card" style="margin-bottom:18px">
      <div class="chart-card-header">
        <div>
          <div class="chart-title">Transaction Graph</div>
          <div class="chart-subtitle">Day-wise Credit &amp; Debit — hover for details</div>
        </div>
        <div class="chart-legend">
          <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Credit</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Debit</div>
        </div>
      </div>
      <canvas id="trendChart" height="55"></canvas>
    </div>

    <!-- PANEL 3: Bank Detail -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:18px">
      <div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Company Detail</div></div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="${thS}">Company</th><th style="${thR}">Txns</th><th style="${thR}">Volume</th></tr></thead>
          <tbody>${miniRows(compVolLabels, compVolMap, totalCompVol, (c,i) => getCompanyColor(c,'primary') || BAR_COLORS[i%BAR_COLORS.length], item => t => (t.company||'Unknown')===item)}</tbody>
        </table></div>
      </div>
      <div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Bank Detail</div></div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="${thS}">Bank</th><th style="${thR}">Txns</th><th style="${thR}">Volume</th></tr></thead>
          <tbody>${miniRows(bankVolLabels, bankVolMap, totalBankVol, (_,i) => BAR_COLORS[i%BAR_COLORS.length], item => t => (t.bank||'Unknown')===item)}</tbody>
        </table></div>
      </div>
      <div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Region Wise</div></div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="${thS}">Region</th><th style="${thR}">Txns</th><th style="${thR}">Volume</th></tr></thead>
          <tbody>${miniRows(regionLabels, regionMap, totalRegionVol, (_,i) => regionColors[i%regionColors.length], item => t => (state.companyRegions[t.company]||companyRegions[t.company]||'Other')===item)}</tbody>
        </table></div>
      </div>
    </div>

    <!-- PANEL 4: Recent Transactions -->
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Recent Transactions</div>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="navigate('transactions')">View All</button>
          <button class="btn btn-primary btn-sm" onclick="openModal('addTxnModal')">+ Add</button>
        </div>
      </div>
      ${renderTableHTML(txns.slice(0,8))}
    </div>
  `;

  setTimeout(() => { buildTrendChart(); }, 50);
}"""

content = content[:idx_area] + new_section + content[idx_end:]
print("Step 2 done: replaced area.innerHTML and post-innerHTML code")

# ── Replace buildTrendChart ────────────────────────────────────────────────────
old_trend_start = "function buildTrendChart() {"
old_trend_end = "\nfunction buildDonutChart() {"
idx_trend = content.find(old_trend_start)
idx_trend_end = content.find(old_trend_end, idx_trend)
assert idx_trend != -1, "ERROR: buildTrendChart not found"
assert idx_trend_end != -1, "ERROR: buildDonutChart marker not found"

new_trend = """function buildTrendChart() {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  if (state.charts.trend) state.charts.trend.destroy();
  const dateMap = {};
  state.transactions.forEach(t => {
    if (!t.date) return;
    const d = t.date.slice(0, 10);
    if (!dateMap[d]) dateMap[d] = { credit: 0, debit: 0 };
    const amt = +t.amount || 0;
    if (amt > 0) dateMap[d].credit += amt;
    else if (amt < 0) dateMap[d].debit += Math.abs(amt);
  });
  const allDates = Object.keys(dateMap).sort();
  const days = allDates.slice(-60);
  const labels = days.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  });
  const cData = days.map(d => dateMap[d].credit);
  const dData = days.map(d => dateMap[d].debit);
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
            title: (items) => days[items[0].dataIndex] + '  (' + labels[items[0].dataIndex] + ')',
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
}"""

content = content[:idx_trend] + new_trend + content[idx_trend_end:]
print("Step 3 done: replaced buildTrendChart with day-wise version")

open(r'e:\webapp\Dashboard\Salsoft\finance-dashboard.html', 'w', encoding='utf-8').write(content)
print("File saved successfully!")
