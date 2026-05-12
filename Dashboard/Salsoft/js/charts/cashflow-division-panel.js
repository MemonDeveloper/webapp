// js/charts/cashflow-division-panel.js
// Population-pyramid chart: per-company inflow vs outflow
// renderCashFlowDivisionPanel({ bankIDRows })

function renderCashFlowDivisionPanel({ bankIDRows }) {
  if (!bankIDRows || !bankIDRows.length) {
    return `<div class="cfd-ref-card" style="display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text2)">No division data available.</div>`;
  }

  const maxVol = Math.max(...bankIDRows.map(r => Math.max(r.totalIn, r.totalOut)), 1);

  const rows = bankIDRows.map(row => {
    const infPct = row.totalIn  > 0 ? Math.max(Math.round(row.totalIn  / maxVol * 95), 2) : 0;
    const outPct = row.totalOut > 0 ? Math.max(Math.round(row.totalOut / maxVol * 95), 2) : 0;
    const infTxt = fmt(row.totalIn);
    const outTxt = fmt(row.totalOut);
    const encoded = encodeURIComponent(row.company);
    return `<div class="cfd-pyramid-row" data-division="${row.company}" data-inf="${infTxt}" data-out="${outTxt}" onclick="cfdSelectRow(this,event,'${encoded}')">
      <div class="cfd-bar-right">
        <div class="cfd-bar-segment-right" style="width:${outPct}%">
          ${row.totalOut > 0 ? `<span class="cfd-bar-value">${outTxt}</span>` : ''}
        </div>
      </div>
      <div class="cfd-division-center">${row.company}</div>
      <div class="cfd-bar-left">
        <div class="cfd-bar-segment-left" style="width:${infPct}%">
          ${row.totalIn > 0 ? `<span class="cfd-bar-value">${infTxt}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="cfd-ref-card" id="cfdCard" onclick="cfdToggleCard(this,event)">
    <div class="cfd-card-header">
      <div class="cfd-card-title">Cash Flow by Division</div>
    </div>
    <div class="cfd-chart-legend">
      <div class="cfd-legend-item"><div class="cfd-legend-bar cfd-lb-red"></div>Outflow</div>
      <div class="cfd-legend-title">Cash Flow</div>
      <div class="cfd-legend-item"><div class="cfd-legend-bar cfd-lb-green"></div>Inflow</div>
    </div>
    <div class="cfd-chart-area" id="cfdChartArea">
      <div class="cfd-pyramid-rows">${rows}</div>
      <div id="cfd-tooltip"></div>
    </div>
  </div>`;
}

function cfdToggleCard(card, event) {
  if (event && event.target.closest('.cfd-pyramid-row')) return;
  card.classList.toggle('cfd-card-active');
}

/**
 * Handle Cash Flow Division row click
 * Sets company as primary filter via drill-down
 */
function cfdSelectRow(item, event, encodedCompany) {
  if (event) event.stopPropagation();
  const company = encodedCompany ? decodeURIComponent(encodedCompany) : null;
  const isAlreadyActive = item.classList.contains('cfd-row-active');
  
  document.querySelectorAll('.cfd-pyramid-row').forEach(r => r.classList.remove('cfd-row-active'));
  
  if (!isAlreadyActive && company) {
    item.classList.add('cfd-row-active');
    // Check if same filter already set
    if (filterManager.primaryFilter?.type === 'company' && filterManager.primaryFilter?.value === company) {
      filterManager.primaryFilter = null;
    } else {
      onPanel2Click('company', company);
    }
  } else if (isAlreadyActive) {
    // Clear the filter on second click
    filterManager.primaryFilter = null;
    renderDashboardWithFilters();
  }
}

function _initCfdTooltip() {
  const tooltip = document.getElementById('cfd-tooltip');
  const area    = document.getElementById('cfdChartArea');
  if (!tooltip || !area) return;
  document.querySelectorAll('.cfd-pyramid-row').forEach(row => {
    row.addEventListener('mouseenter', () => {
      tooltip.innerHTML = `
        <div class="cfd-tt-division">${row.dataset.division}</div>
        <div class="cfd-tt-row"><span class="cfd-tt-inflow">← Inflow:</span><span>${row.dataset.inf}</span></div>
        <div class="cfd-tt-row"><span class="cfd-tt-outflow">Outflow →</span><span>${row.dataset.out}</span></div>`;
      tooltip.style.opacity = '1';
    });
    row.addEventListener('mousemove', e => {
      const r = area.getBoundingClientRect();
      tooltip.style.left = (e.clientX - r.left + 12) + 'px';
      tooltip.style.top  = (e.clientY - r.top  - 60) + 'px';
    });
    row.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
  });
}
