// js/charts/region-donut-panel.js
// SVG donut chart for region split
// renderRegionDonutPanel({ regionLabels, regionMap, totalRegionVol, regionColors, bCashMode })

function renderRegionDonutPanel({ regionLabels, regionMap, totalRegionVol, regionColors, bCashMode }) {
  const formatModeAmount = (rawValue) => {
    const val = Number(rawValue || 0);
    const absTxt = fmt(Math.abs(val));
    if (bCashMode === 'debit') return `-${absTxt}`;
    if (bCashMode === 'credit' || bCashMode === 'net') return `${val >= 0 ? '+' : '-'}${absTxt}`;
    return absTxt;
  };

  // Dynamic header based on bCashMode
  const headerMap = {
    'opening': 'Region Opening Balance',
    'credit': 'Region Inflow',
    'debit': 'Region Outflow',
    'closing': 'Region Closing Balance',
    'net': 'Region Net Cash Flow'
  };
  const header = headerMap[bCashMode] || 'Regions';
  const CIRC = 251.327; // 2π × 40

  if (!regionLabels || !regionLabels.length) {
    return `<div class="rgd-company-card" style="display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text2)">No region data.</div>`;
  }

  let offset = 0;
  const slices = regionLabels.map((region, i) => {
    const vol     = regionMap[region] || 0;
    const share   = totalRegionVol > 0 ? vol / totalRegionVol : 0;
    const dashLen = share * CIRC;
    const color   = regionColors[i % regionColors.length];
    const pct     = (share * 100).toFixed(2);
    const s       = { region, vol, dashLen, color, pct, offset: -offset };
    offset       += dashLen;
    return s;
  });

  const top = slices[0];

  const svgSlices = slices.map(s =>
    `<circle cx="50" cy="50" r="40" stroke="${s.color}" stroke-width="14" fill="none"
      stroke-dasharray="${s.dashLen.toFixed(2)} ${CIRC.toFixed(2)}"
      stroke-dashoffset="${s.offset.toFixed(2)}"
      class="rgd-chart-slice"
        data-region="${s.region}" data-amount="${formatModeAmount(s.vol)}" data-percent="${s.pct}%" data-color="${s.color}"
      onclick="rgdSyncHighlight('${s.region}',event)"></circle>`
  ).join('');

  const RGD_ITEM_COLORS = ['blue','purple','green','orange','cyan','pink','teal','amber'];
  const listItems = slices.map((s, i) => {
    const ck = RGD_ITEM_COLORS[i % RGD_ITEM_COLORS.length];
    return `<div class="rgd-company-item rgd-ci-${ck}" data-region="${s.region}" onclick="rgdSyncHighlight('${s.region}',event)">
      <div class="rgd-company-dot" style="background:${s.color}"></div>
      <div class="rgd-company-name">${s.region}</div>
      <div class="rgd-company-amounts">
        <div class="rgd-amount">${formatModeAmount(s.vol)}</div>
        <div class="rgd-percentage">${s.pct}%</div>
      </div>
    </div>${i < slices.length - 1 ? '<div class="rgd-divider"></div>' : ''}`;
  }).join('');

  const legendItems = slices.map(s =>
    `<div class="rgd-legend-item"><div class="rgd-legend-dot" style="background:${s.color}"></div>${s.region}</div>`
  ).join('');

  return `<div class="rgd-company-card" onclick="rgdToggleCard(this,event)">
    <div class="rgd-chart-header-section">
      <div class="rgd-card-title">${header}</div>
      <div class="rgd-donut-chart">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke="#e2e8f0" stroke-width="14" fill="none"/>
          ${svgSlices}
        </svg>
        <div class="rgd-chart-center-text" id="rgdCenterText">
          <div class="rgd-center-amount">${formatModeAmount(totalRegionVol)}</div>
          <div class="rgd-center-label">Total Split</div>
        </div>
        <div id="rgd-tooltip"></div>
      </div>
      ${top ? `<div class="rgd-chart-info">
        <div class="rgd-lead-badge"><span class="rgd-dot" style="background:${top.color}"></span>${top.region} leads with ${top.pct}%</div>
      </div>` : ''}
      <div class="rgd-chart-legend">${legendItems}</div>
    </div>
    <div class="rgd-company-list">${listItems}</div>
  </div>`;
}

function rgdToggleCard(card, event) {
  if (event && event.target.closest('.rgd-company-item, .rgd-chart-slice')) return;
  card.classList.toggle('rgd-card-active');
}

/**
 * Handle Region donut click or list item click
 * Sets region as primary filter via drill-down
 */
function rgdSyncHighlight(regionName, event) {
  if (event) event.stopPropagation();
  const listItem = document.querySelector(`.rgd-company-item[data-region="${regionName}"]`);
  const slice    = document.querySelector(`.rgd-chart-slice[data-region="${regionName}"]`);
  const isActive = listItem && listItem.classList.contains('rgd-ci-active');
  
  document.querySelectorAll('.rgd-company-item').forEach(el => el.classList.remove('rgd-ci-active'));
  document.querySelectorAll('.rgd-chart-slice').forEach(el => el.classList.remove('rgd-highlighted'));
  
  if (!isActive) {
    if (listItem) listItem.classList.add('rgd-ci-active');
    if (slice)    slice.classList.add('rgd-highlighted');
    // Check if same filter already set
    if (filterManager.primaryFilter?.type === 'region' && filterManager.primaryFilter?.value === regionName) {
      filterManager.primaryFilter = null;
    } else {
      onPanel2Click('region', regionName);
    }
  } else {
    // Clear the filter on second click
    filterManager.primaryFilter = null;
    renderDashboardWithFilters();
  }
}

function _initRgdTooltip() {
  const tooltip    = document.getElementById('rgd-tooltip');
  const centerText = document.getElementById('rgdCenterText');
  if (!tooltip) return;
  document.querySelectorAll('.rgd-chart-slice').forEach(slice => {
    slice.addEventListener('mouseenter', () => {
      tooltip.innerHTML = `<div class="rgd-tt-title" style="color:${slice.dataset.color}">● ${slice.dataset.region}</div><span class="rgd-tt-value">${slice.dataset.amount}</span><span class="rgd-tt-percent">${slice.dataset.percent}</span>`;
      tooltip.style.opacity = '1';
      if (centerText) centerText.style.opacity = '0';
    });
    slice.addEventListener('mousemove', e => {
      const rect = tooltip.parentElement.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left) + 'px';
      tooltip.style.top  = (e.clientY - rect.top)  + 'px';
    });
    slice.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
      if (centerText) centerText.style.opacity = '1';
    });
  });
}
