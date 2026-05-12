// js/charts/bank-panel.js
// Renders the Bank panel for PANEL 3 with Bank / Companies toggle.
// renderBankPanel({ bankDetailRows, maxBankDetailVol, state })

let _bpViewMode = 'bank';

function setBankPanelView(mode) {
  _bpViewMode = mode;
  const shell = document.getElementById('bp-shell');
  if (!shell) return;
  shell.querySelectorAll('.bp-view').forEach(v => { v.style.display = 'none'; });
  const active = shell.querySelector('.bp-view-' + mode);
  if (active) active.style.display = '';
  shell.querySelectorAll('.bp-tab').forEach(b => b.classList.toggle('bp-tab--active', b.dataset.mode === mode));
  const titleEl = document.getElementById('bp-page-title');
  const countEl = document.getElementById('bp-count-badge');
  if (titleEl) titleEl.textContent = mode === 'bank' ? 'Bank Accounts' : mode === 'company' ? 'Companies' : 'Regions';
  if (countEl) countEl.textContent = mode === 'bank'
    ? (shell.dataset.bankCount    + ' Accounts')
    : mode === 'company'
    ? (shell.dataset.companyCount + ' Companies')
    : (shell.dataset.regionCount  + ' Regions');
}

function renderBankPanel({ bankDetailRows, maxBankDetailVol, state, hideBalanceColumns = false, shellClass = '' }) {
  const BANK_COLORS = ['#2563eb','#7c3aed','#ea580c','#0891b2','#dc2626','#16a34a','#d97706','#ec4899'];

  if (!bankDetailRows.length) {
    return `<div class="bp-shell ${shellClass}" id="bp-shell"><div class="bp-empty">No bank accounts found.</div></div>`;
  }

  const isAnyActive = state.filters.bank && state.filters.bank !== 'All';

  // ── Bank rows ────────────────────────────────────────────
  const maxBankVol = maxBankDetailVol || 1;

  const bankRows = bankDetailRows.map((row, i) => {
    const color        = BANK_COLORS[i % BANK_COLORS.length];
    const encodedBank  = encodeURIComponent(row.bankName);
    const encodedAcct  = encodeURIComponent(row.accountNumber);
    const isActive     = state.filters.bank === row.bankName && state.filters.account === row.accountNumber;
    const barPct       = Math.round(Math.abs(row.volume || 0) / maxBankVol * 100);
    const openTxt      = row.opening == null ? '—' : fmt(row.opening);
    const closeTxt     = row.closing == null ? '—' : fmt(row.closing);
    const net          = (row.inflow || 0) - (row.outflow || 0);
    const netIsPos     = net >= 0;
    const netTxt       = (netIsPos ? '+' : '-') + fmt(Math.abs(net));

    return `<tr class="bp-row${isActive ? ' bp-row--active' : ''}" onclick="setDashboardBankFilter('${encodedBank}','${encodedAcct}')" title="${row.bankName} / ${row.accountNumber}">
      <td class="bp-td bp-td--bank">
        <div class="bp-bank-cell">
          <span class="bp-dot" style="background:${color}"></span>
          <div class="bp-bank-info">
            <div class="bp-bank-name">${row.bankName}</div>
            <div class="bp-bar-track"><div class="bp-bar-fill" style="width:${barPct}%;background:${color}"></div></div>
          </div>
        </div>
      </td>
      <td class="bp-td bp-td--acct">${row.accountNumber}</td>
      <td class="bp-td bp-td--company">${row.companyName}</td>
      ${hideBalanceColumns ? '' : `<td class="bp-td bp-td--num">${openTxt}</td>`}
      <td class="bp-td bp-td--num bp-td--inflow">+${fmt(row.inflow)}</td>
      <td class="bp-td bp-td--num bp-td--outflow">-${fmt(row.outflow)}</td>
      ${hideBalanceColumns ? '' : `<td class="bp-td bp-td--num">${closeTxt}</td>`}
      <td class="bp-td bp-td--num bp-td--net${netIsPos ? ' bp-td--net-pos' : ' bp-td--net-neg'}">${netTxt}</td>
      <td class="bp-td bp-td--date">${row.lastUpdatedLabel}</td>
    </tr>`;
  }).join('');

  // ── Company rows (aggregate by company) ─────────────────
  const compMap = {};
  bankDetailRows.forEach(row => {
    const co = row.companyName || 'Unknown';
    if (!compMap[co]) {
      compMap[co] = { companyName: co, opening: 0, inflow: 0, outflow: 0, closing: 0, lastUpdatedLabel: row.lastUpdatedLabel || '' };
    }
    compMap[co].inflow  += row.inflow  || 0;
    compMap[co].outflow += row.outflow || 0;
    compMap[co].opening += row.opening || 0;
    compMap[co].closing += row.closing || 0;
    if ((row.lastUpdatedLabel || '') > compMap[co].lastUpdatedLabel) {
      compMap[co].lastUpdatedLabel = row.lastUpdatedLabel;
    }
  });
  const companyRows = Object.values(compMap).sort((a, b) => (b.inflow + b.outflow) - (a.inflow + a.outflow));
  const maxCompVol = Math.max(...companyRows.map(c => c.inflow + c.outflow), 1);

  const compRows = companyRows.map((co, i) => {
    const color    = BANK_COLORS[i % BANK_COLORS.length];
    const barPct   = Math.round((co.inflow + co.outflow) / maxCompVol * 100);
    const openTxt  = fmt(co.opening);
    const closeTxt = fmt(co.closing);
    const net      = co.inflow - co.outflow;
    const netIsPos = net >= 0;
    const netTxt   = (netIsPos ? '+' : '-') + fmt(Math.abs(net));

    return `<tr class="bp-row">
      <td class="bp-td bp-td--bank">
        <div class="bp-bank-cell">
          <span class="bp-dot" style="background:${color}"></span>
          <div class="bp-bank-info">
            <div class="bp-bank-name">${co.companyName}</div>
            <div class="bp-bar-track"><div class="bp-bar-fill" style="width:${barPct}%;background:${color}"></div></div>
          </div>
        </div>
      </td>
      ${hideBalanceColumns ? '' : `<td class="bp-td bp-td--num">${openTxt}</td>`}
      <td class="bp-td bp-td--num bp-td--inflow">+${fmt(co.inflow)}</td>
      <td class="bp-td bp-td--num bp-td--outflow">-${fmt(co.outflow)}</td>
      ${hideBalanceColumns ? '' : `<td class="bp-td bp-td--num">${closeTxt}</td>`}
      <td class="bp-td bp-td--num bp-td--net${netIsPos ? ' bp-td--net-pos' : ' bp-td--net-neg'}">${netTxt}</td>
      <td class="bp-td bp-td--date">${co.lastUpdatedLabel}</td>
    </tr>`;
  }).join('');

  // ── Region rows (aggregate by region) ───────────────────
  const regionMap = {};
  bankDetailRows.forEach(row => {
    const rg = (state.companyRegions && state.companyRegions[row.companyName]) || 'Other';
    if (!regionMap[rg]) {
      regionMap[rg] = { regionName: rg, opening: 0, inflow: 0, outflow: 0, closing: 0, lastUpdatedLabel: row.lastUpdatedLabel || '' };
    }
    regionMap[rg].inflow  += row.inflow  || 0;
    regionMap[rg].outflow += row.outflow || 0;
    regionMap[rg].opening += row.opening || 0;
    regionMap[rg].closing += row.closing || 0;
    if ((row.lastUpdatedLabel || '') > regionMap[rg].lastUpdatedLabel) {
      regionMap[rg].lastUpdatedLabel = row.lastUpdatedLabel;
    }
  });
  const regionRows2 = Object.values(regionMap).sort((a, b) => (b.inflow + b.outflow) - (a.inflow + a.outflow));
  const maxRegionVol = Math.max(...regionRows2.map(r => r.inflow + r.outflow), 1);

  const regRows = regionRows2.map((rg, i) => {
    const color    = BANK_COLORS[i % BANK_COLORS.length];
    const barPct   = Math.round((rg.inflow + rg.outflow) / maxRegionVol * 100);
    const openTxt  = fmt(rg.opening);
    const closeTxt = fmt(rg.closing);
    const net      = rg.inflow - rg.outflow;
    const netIsPos = net >= 0;
    const netTxt   = (netIsPos ? '+' : '-') + fmt(Math.abs(net));

    return `<tr class="bp-row">
      <td class="bp-td bp-td--bank">
        <div class="bp-bank-cell">
          <span class="bp-dot" style="background:${color}"></span>
          <div class="bp-bank-info">
            <div class="bp-bank-name">${rg.regionName}</div>
            <div class="bp-bar-track"><div class="bp-bar-fill" style="width:${barPct}%;background:${color}"></div></div>
          </div>
        </div>
      </td>
      ${hideBalanceColumns ? '' : `<td class="bp-td bp-td--num">${openTxt}</td>`}
      <td class="bp-td bp-td--num bp-td--inflow">+${fmt(rg.inflow)}</td>
      <td class="bp-td bp-td--num bp-td--outflow">-${fmt(rg.outflow)}</td>
      ${hideBalanceColumns ? '' : `<td class="bp-td bp-td--num">${closeTxt}</td>`}
      <td class="bp-td bp-td--num bp-td--net${netIsPos ? ' bp-td--net-pos' : ' bp-td--net-neg'}">${netTxt}</td>
      <td class="bp-td bp-td--date">${rg.lastUpdatedLabel}</td>
    </tr>`;
  }).join('');

  const isBankView    = _bpViewMode === 'bank';
  const isRegionView  = _bpViewMode === 'region';
  const isCompanyView = _bpViewMode === 'company';

  const pageTitle = isBankView ? 'Bank Accounts' : isCompanyView ? 'Companies' : 'Regions';
  const countBadge = isBankView
    ? bankDetailRows.length + ' Accounts'
    : isCompanyView
    ? companyRows.length + ' Companies'
    : regionRows2.length + ' Regions';

  return `<div class="bp-shell ${shellClass}" id="bp-shell" data-bank-count="${bankDetailRows.length}" data-company-count="${companyRows.length}" data-region-count="${regionRows2.length}">
  <div class="cfd-card-header">
    <div class="bp-header-left">
      <h2 class="bp-page-title" id="bp-page-title">${pageTitle}</h2>
      <div class="bp-count-badge" id="bp-count-badge">${countBadge}</div>
    </div>
    <div class="bp-tabs">
      <button class="bp-tab${isBankView ? ' bp-tab--active' : ''}" data-mode="bank" onclick="setBankPanelView('bank')">Bank</button>
      <button class="bp-tab${isCompanyView ? ' bp-tab--active' : ''}" data-mode="company" onclick="setBankPanelView('company')">Companies</button>
      <button class="bp-tab${isRegionView ? ' bp-tab--active' : ''}" data-mode="region" onclick="setBankPanelView('region')">Region</button>
    </div>
    ${isAnyActive ? `<button class="btn btn-secondary btn-sm" onclick="setDashboardBankFilter('All','All')">× Clear</button>` : ''}
  </div>

  <!-- Bank View -->
  <div class="bp-view bp-view-bank bp-table-wrap" id="bp-table-wrap"${isBankView ? '' : ' style="display:none"'}>
    <table class="bp-table">
      <thead>
        <tr>
          <th class="bp-th bp-th--bank">Bank</th>
          <th class="bp-th">Account No.</th>
          <th class="bp-th">Company</th>
          ${hideBalanceColumns ? '' : '<th class="bp-th bp-th--right">Opening</th>'}
          <th class="bp-th bp-th--right bp-th--inflow">Inflow</th>
          <th class="bp-th bp-th--right bp-th--outflow">Outflow</th>
          ${hideBalanceColumns ? '' : '<th class="bp-th bp-th--right">Closing</th>'}
          <th class="bp-th bp-th--right bp-th--net">Net Flow</th>
          <th class="bp-th">Last Updated</th>
        </tr>
      </thead>
      <tbody>${bankRows}</tbody>
    </table>
  </div>

  <!-- Company View -->
  <div class="bp-view bp-view-company bp-table-wrap"${isCompanyView ? '' : ' style="display:none"'}>
    <table class="bp-table">
      <thead>
        <tr>
          <th class="bp-th bp-th--bank">Company</th>
          ${hideBalanceColumns ? '' : '<th class="bp-th bp-th--right">Opening</th>'}
          <th class="bp-th bp-th--right bp-th--inflow">Inflow</th>
          <th class="bp-th bp-th--right bp-th--outflow">Outflow</th>
          ${hideBalanceColumns ? '' : '<th class="bp-th bp-th--right">Closing</th>'}
          <th class="bp-th bp-th--right bp-th--net">Net Flow</th>
          <th class="bp-th">Last Updated</th>
        </tr>
      </thead>
      <tbody>${compRows}</tbody>
    </table>
  </div>

  <!-- Region View -->
  <div class="bp-view bp-view-region bp-table-wrap"${isRegionView ? '' : ' style="display:none"'}>
    <table class="bp-table">
      <thead>
        <tr>
          <th class="bp-th bp-th--bank">Region</th>
          ${hideBalanceColumns ? '' : '<th class="bp-th bp-th--right">Opening</th>'}
          <th class="bp-th bp-th--right bp-th--inflow">Inflow</th>
          <th class="bp-th bp-th--right bp-th--outflow">Outflow</th>
          ${hideBalanceColumns ? '' : '<th class="bp-th bp-th--right">Closing</th>'}
          <th class="bp-th bp-th--right bp-th--net">Net Flow</th>
          <th class="bp-th">Last Updated</th>
        </tr>
      </thead>
      <tbody>${regRows}</tbody>
    </table>
  </div>


</div>`;
}
