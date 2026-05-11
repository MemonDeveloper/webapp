// js/charts/inter-division-panel.js
// Renders the Inter Division Transactions panel.
// renderInterDivisionPanel({ txns, idInflowCats, idOutflowCats })

/**
 * Handle Inter-Division row click
 * Sets inter-division as secondary filter via drill-down
 */
function _idSelectRow(el, event) {
  if (event) event.stopPropagation();
  const wasActive = el.classList.contains('id-row--active');
  const companyName = el.querySelector('.id-td--company strong')?.textContent;
  
  document.querySelectorAll('.id-row').forEach(r => r.classList.remove('id-row--active'));
  
  if (!wasActive && companyName) {
    el.classList.add('id-row--active');
    onPanel2Click('company', companyName);
  } else {
    // Clear the primary company filter
    filterManager.primaryFilter = null;
    renderDashboardWithFilters();
  }
}

function _idToggleCard(el, event) {
  if (event && event.target.closest('.id-row')) return;
  el.classList.toggle('id-card--active');
}

function renderInterDivisionPanel({ txns, idInflowCats, idOutflowCats }) {
  const ID_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];
  const fmtBr = v => (!v || v === 0) ? '—' : fmt(v);

  // Compute per-company breakdown
  const groupMap = {};
  txns.forEach(t => {
    const comp   = (t.company || 'Unknown').trim();
    const intDiv = (t.interDivision || '').trim();
    const amt    = $usdAmt(t);
    if (!groupMap[comp]) {
      groupMap[comp] = { company: comp, inflow: {}, outflow: {}, totalIn: 0, totalOut: 0 };
    }
    const g = groupMap[comp];
    if (amt > 0) {
      g.totalIn += amt;
      if (intDiv) g.inflow[intDiv] = (g.inflow[intDiv] || 0) + amt;
    } else if (amt < 0) {
      const abs = Math.abs(amt);
      g.totalOut += abs;
      if (intDiv) g.outflow[intDiv] = (g.outflow[intDiv] || 0) + abs;
    }
  });

  const rows = Object.values(groupMap).sort((a, b) =>
    (b.totalIn + b.totalOut) - (a.totalIn + a.totalOut)
  );

  if (!rows.length) {
    return `<div class="id-card"><div class="id-empty">No inter-division data available.</div></div>`;
  }

  // Grand totals
  const grandIn  = rows.reduce((s, r) => s + r.totalIn,  0);
  const grandOut = rows.reduce((s, r) => s + r.totalOut, 0);
  const grandNet = grandIn - grandOut;
  const netIsPos = grandNet >= 0;
  const grandNetFmt = (netIsPos ? '+' : '(') + fmt(Math.abs(grandNet)) + (netIsPos ? '' : ')');

  const grandInflowByCat  = {};
  const grandOutflowByCat = {};
  idInflowCats.forEach(c  => { grandInflowByCat[c]  = rows.reduce((s, r) => s + (r.inflow[c]  || 0), 0); });
  idOutflowCats.forEach(c => { grandOutflowByCat[c] = rows.reduce((s, r) => s + (r.outflow[c] || 0), 0); });

  const inColspan  = Math.max(idInflowCats.length  + 1, 1);
  const outColspan = Math.max(idOutflowCats.length + 1, 1);

  const tableRows = rows.map((row, i) => {
    const color     = ID_COLORS[i % ID_COLORS.length];
    const rowNet    = row.totalIn - row.totalOut;
    const rowNetPos = rowNet >= 0;
    const rowNetFmt = (rowNetPos ? '+' : '(') + fmt(Math.abs(rowNet)) + (rowNetPos ? '' : ')');

    const isActive = state.filters.company === row.company;
    return `<tr class="id-row${isActive ? ' id-row--active' : ''}" onclick="_idSelectRow(this, event)">
      <td class="id-td id-td--company">
        <div style="display:flex;align-items:center;gap:7px">
          <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
          <strong>${row.company}</strong>
        </div>
      </td>
      ${idInflowCats.map(c => `<td class="id-td id-td--inflow id-td--right">${fmtBr(row.inflow[c] || 0)}</td>`).join('')}
      <td class="id-td id-td--inflow id-td--right id-td--sep">${fmtBr(row.totalIn)}</td>
      ${idOutflowCats.map(c => `<td class="id-td id-td--outflow id-td--right">${(row.outflow[c] || 0) > 0 ? '(' + fmt(row.outflow[c]) + ')' : '—'}</td>`).join('')}
      <td class="id-td id-td--outflow id-td--right id-td--sep">${row.totalOut > 0 ? '(' + fmt(row.totalOut) + ')' : '—'}</td>
      <td class="id-td id-td--net id-td--right" style="color:${rowNetPos ? '#16a34a' : '#dc2626'}">${rowNetFmt}</td>
    </tr>`;
  }).join('');

  const grandRow = `<tr class="id-total-row">
    <td class="id-td id-td--grand-label">Grand Total</td>
    ${idInflowCats.map(c => `<td class="id-td id-td--grand-inflow id-td--right">${fmtBr(grandInflowByCat[c] || 0)}</td>`).join('')}
    <td class="id-td id-td--grand-inflow id-td--right id-td--sep">${fmtBr(grandIn)}</td>
    ${idOutflowCats.map(c => `<td class="id-td id-td--grand-outflow id-td--right">${(grandOutflowByCat[c] || 0) > 0 ? '(' + fmt(grandOutflowByCat[c]) + ')' : '—'}</td>`).join('')}
    <td class="id-td id-td--grand-outflow id-td--right id-td--sep">${grandOut > 0 ? '(' + fmt(grandOut) + ')' : '—'}</td>
    <td class="id-td id-td--right" style="color:${netIsPos ? '#16a34a' : '#dc2626'};font-weight:800">${grandNetFmt}</td>
  </tr>`;

  return `<div class="id-card" onclick="_idToggleCard(this, event)">
  <div class="cfd-card-header">
    <div class="id-card-title">Inter Division Transactions</div>
    <div class="id-card-total">Net: <span style="color:${netIsPos ? '#16a34a' : '#dc2626'}">${grandNetFmt}</span></div>
  </div>
  <div class="id-table-scroll">
    <table class="id-table">
      <thead>
        <tr>
          <th class="id-th" rowspan="2" style="text-align:left;min-width:130px">Company</th>
          <th class="id-th id-th--group id-th--inflow" colspan="${inColspan}">Inflow</th>
          <th class="id-th id-th--group id-th--outflow" colspan="${outColspan}">Outflow</th>
          <th class="id-th" rowspan="2">Net Total</th>
        </tr>
        <tr>
          ${idInflowCats.map(c => `<th class="id-th">${c}</th>`).join('')}
          <th class="id-th id-th--sep">Total</th>
          ${idOutflowCats.map(c => `<th class="id-th">${c}</th>`).join('')}
          <th class="id-th id-th--sep">Total</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        ${grandRow}
      </tbody>
    </table>
  </div>
</div>`;
}
