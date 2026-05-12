// js/charts/companies-bar-panel.js
// Vertical bar chart: company spending
// renderCompaniesBarPanel({ compVolLabels, compVolMap, totalCompVol, bCashMode })

function renderCompaniesBarPanel({ compVolLabels, compVolMap, totalCompVol, bCashMode }) {
  const CPB_COLORS = ['blue','green','orange','red','purple','cyan','pink','amber','teal','lime'];
  const visible = (compVolLabels || []).slice(0, 10);
  const shortenCompanyLabel = (companyName) => {
    const cleanName = String(companyName || '').trim();
    if (cleanName.length <= 8) return cleanName;
    const firstWord = cleanName.split(/\s+/)[0] || cleanName;
    if (firstWord.length <= 8) return `${firstWord}…`;
    return `${cleanName.slice(0, 6)}…`;
  };
  const formatModeAmount = (rawValue) => {
    const val = Number(rawValue || 0);
    const absTxt = fmt(Math.abs(val));
    if (bCashMode === 'debit') return `-${absTxt}`;
    if (bCashMode === 'credit' || bCashMode === 'net') return `${val >= 0 ? '+' : '-'}${absTxt}`;
    return absTxt;
  };
  const fmtShort = (rawValue) => {
    const val = Number(rawValue || 0);
    const abs = Math.abs(val);
    const sign = bCashMode === 'debit' ? '-' : (bCashMode === 'credit' || bCashMode === 'net') ? (val >= 0 ? '+' : '-') : '';
    if (abs >= 1e9) return `${sign}$${(abs/1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}$${(abs/1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs/1e3).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  if (!visible.length) {
    return `<div class="cpb-ref-card" style="display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text2)">No company data.</div>`;
  }

  // Dynamic header based on bCashMode
  const headerMap = {
    'opening': 'Company Opening Balance',
    'credit': 'Company Inflow',
    'debit': 'Company Outflow',
    'closing': 'Company Closing Balance',
    'net': 'Company Net Cash Flow'
  };
  const header = headerMap[bCashMode] || 'Company';

  const maxVol = Math.max(...visible.map(c => Math.abs(compVolMap[c] || 0)), 1);

  const columns = visible.map((company, i) => {
    const vol       = compVolMap[company] || 0;
    const heightPct = Math.round(Math.abs(vol) / maxVol * 100);
    const colorKey  = CPB_COLORS[i % CPB_COLORS.length];
    const fullVal   = formatModeAmount(vol);
    const shortLabel = shortenCompanyLabel(company);
    const encoded   = encodeURIComponent(company);
    return `<div class="cpb-bar-column" data-full-value="${fullVal}" data-full-label="${company}" style="--cpb-fill-height:${heightPct};" onclick="cpbSelectBar(this,event,'${encoded}')">
      <div class="cpb-bar-value-top" data-short="${fullVal}" data-full="${fullVal}">${fullVal}</div>
      <div class="cpb-bar-track-v"><div class="cpb-bar-fill-v cpb-fill-${colorKey}" style="height:${heightPct}%"></div></div>
      <div class="cpb-bar-label-bottom">${shortLabel}</div>
    </div>`;
  }).join('');

  return `<div class="cpb-ref-card" onclick="cpbToggleCard(this,event)">
    <div class="cfd-card-header">
      <div class="cpb-ref-title">${header}</div>
    </div>
    <div class="cpb-bar-chart-vertical">${columns}</div>
    <div id="cpb-tooltip"></div>
  </div>`;
}

function cpbToggleCard(card, event) {
  if (event && event.target.closest('.cpb-bar-column')) return;
  card.classList.toggle('cpb-card-active');
}

/**
 * Handle Company bar click
 * Sets company as primary filter via drill-down
 */
function cpbSelectBar(item, event, encodedCompany) {
  if (event) event.stopPropagation();
  const company = encodedCompany ? decodeURIComponent(encodedCompany) : null;
  const isAlreadyActive = item.classList.contains('cpb-col-active');
  document.querySelectorAll('.cpb-bar-column').forEach(c => c.classList.remove('cpb-col-active'));
  
  if (!isAlreadyActive && company) {
    item.classList.add('cpb-col-active');
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

function _initCpbTooltip() {
  const tooltip = document.getElementById('cpb-tooltip');
  if (!tooltip) return;
  document.querySelectorAll('.cpb-bar-column').forEach(col => {
    col.addEventListener('mouseenter', () => {
      const label = col.getAttribute('data-full-label') || col.querySelector('.cpb-bar-label-bottom').textContent;
      tooltip.innerHTML = `<div style="font-size:11px;opacity:.75;margin-bottom:2px">${label}</div><div style="font-size:14px;font-weight:900">${col.getAttribute('data-full-value')}</div>`;
      tooltip.style.opacity = '1';
      const valLabel = col.querySelector('.cpb-bar-value-top');
      if (valLabel) valLabel.textContent = valLabel.dataset.full;
    });
    col.addEventListener('mousemove', e => {
      tooltip.style.left = e.clientX + 'px';
      tooltip.style.top  = (e.clientY - 36) + 'px';
    });
    col.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
      const valLabel = col.querySelector('.cpb-bar-value-top');
      if (valLabel) valLabel.textContent = valLabel.dataset.short;
    });
  });
}
