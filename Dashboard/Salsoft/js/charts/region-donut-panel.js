// js/charts/region-donut-panel.js
// Pie chart for region split (no list)
// renderRegionDonutPanel({ regionLabels, regionMap, totalRegionVol, regionColors, bCashMode })

function _rgdPolarToXY(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function _rgdSlicePath(cx, cy, r, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.9) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }
  const s = _rgdPolarToXY(cx, cy, r, startAngle);
  const e = _rgdPolarToXY(cx, cy, r, endAngle);
  const large = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`;
}

function renderRegionDonutPanel({ regionLabels, regionMap, totalRegionVol, regionColors, bCashMode }) {
  const formatModeAmount = (rawValue) => {
    const val = Number(rawValue || 0);
    const absTxt = fmt(Math.abs(val));
    if (bCashMode === 'debit') return `-${absTxt}`;
    if (bCashMode === 'credit' || bCashMode === 'net') return `${val >= 0 ? '+' : '-'}${absTxt}`;
    return absTxt;
  };

  const headerMap = {
    opening: 'Region Opening Balance',
    credit:  'Region Inflow',
    debit:   'Region Outflow',
    closing: 'Region Closing Balance',
    net:     'Region Net Cash Flow'
  };
  const header = headerMap[bCashMode] || 'Regions';

  if (!regionLabels || !regionLabels.length) {
    return `<div class="rgd-company-card" style="display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text2)">No region data.</div>`;
  }

  const CX = 100, CY = 100, R = 75;
  let currentAngle = 0;

  // Stable color: use state.regions order so color never changes after filtering
  const stableOrder = (typeof state !== 'undefined' && state.regions && state.regions.length)
    ? state.regions : regionLabels;

  const absTotal = regionLabels.reduce((s, r) => s + Math.abs(regionMap[r] || 0), 0);
  const slices = regionLabels.map((region, i) => {
    const vol   = regionMap[region] || 0;
    const share = absTotal > 0 ? Math.abs(vol) / absTotal : 0;
    const sweep = share * 360;
    const start = currentAngle;
    const end   = currentAngle + sweep;
    currentAngle += sweep;
    const colorIdx = stableOrder.indexOf(region);
    return {
      region, vol, color: regionColors[(colorIdx >= 0 ? colorIdx : i) % regionColors.length],
      pct: (share * 100).toFixed(1), start, end, share
    };
  });

  const svgSlices = slices.map(s =>
    `<path d="${_rgdSlicePath(CX, CY, R, s.start, s.end)}"
      fill="${s.color}" class="rgd-pie-slice"
      data-region="${s.region}" data-amount="${formatModeAmount(s.vol)}"
      data-percent="${s.pct}%" data-color="${s.color}"
      onclick="rgdSyncHighlight('${s.region}',event)">
      <title>${s.region}: ${formatModeAmount(s.vol)} (${s.pct}%)</title>
    </path>`
  ).join('');

  // Inside labels for large slices
  const insideLabels = slices.filter(s => s.share > 0.09).map(s => {
    const mid = s.start + (s.end - s.start) / 2;
    const p   = _rgdPolarToXY(CX, CY, R * 0.60, mid);
    return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}"
      text-anchor="middle" dominant-baseline="middle"
      font-size="9" font-weight="800" fill="#fff" style="pointer-events:none"
      >${s.pct}%</text>`;
  }).join('');

  // Outside labels with collision avoidance for small slices
  const outerItems = slices.filter(s => s.share <= 0.09).map(s => {
    const mid   = s.start + (s.end - s.start) / 2;
    const edge  = _rgdPolarToXY(CX, CY, R + 2,  mid);
    const ideal = _rgdPolarToXY(CX, CY, R + 28, mid);
    return { s, mid, edge, idealX: ideal.x, idealY: ideal.y, finalY: ideal.y,
             side: ideal.x >= CX ? 'R' : 'L' };
  });

  // Spread labels vertically per side to avoid overlap
  ['L', 'R'].forEach(side => {
    const grp = outerItems.filter(l => l.side === side).sort((a, b) => a.idealY - b.idealY);
    const GAP = 12;
    for (let i = 1; i < grp.length; i++) {
      if (grp[i].finalY < grp[i - 1].finalY + GAP)
        grp[i].finalY = grp[i - 1].finalY + GAP;
    }
    for (let i = grp.length - 2; i >= 0; i--) {
      if (grp[i].finalY > grp[i + 1].finalY - GAP)
        grp[i].finalY = grp[i + 1].finalY - GAP;
    }
  });

  const outerLabelX = { R: CX + R + 32, L: CX - R - 32 };
  const outsideLabels = outerItems.map(l => {
    const lx     = outerLabelX[l.side];
    const ly     = l.finalY;
    const anchor = l.side === 'R' ? 'start' : 'end';
    const elbowX = l.side === 'R' ? CX + R + 14 : CX - R - 14;
    return `<polyline points="${l.edge.x.toFixed(1)},${l.edge.y.toFixed(1)} ${elbowX.toFixed(1)},${ly.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)}"
        fill="none" stroke="${l.s.color}" stroke-width="1.1" opacity="0.85" stroke-linejoin="round"/>
      <circle cx="${l.edge.x.toFixed(1)}" cy="${l.edge.y.toFixed(1)}" r="2" fill="${l.s.color}"/>
      <text x="${lx.toFixed(1)}" y="${(ly - 2).toFixed(1)}"
        text-anchor="${anchor}" dominant-baseline="auto"
        font-size="8" font-weight="700" fill="${l.s.color}" style="pointer-events:none"
        >${l.s.region} ${l.s.pct}%</text>`;
  }).join('');

  const legendItems = slices.map(s =>
    `<div class="rgd-legend-item" style="cursor:pointer" onclick="rgdSyncHighlight('${s.region}',event)">
      <div class="rgd-legend-dot" style="background:${s.color}"></div>
      <span>${s.region}</span>
      <span style="margin-left:4px;color:var(--text2);font-size:16px">${s.pct}%</span>
    </div>`
  ).join('');

  return `<div class="rgd-company-card" onclick="rgdToggleCard(this,event)">
    <div class="rgd-chart-header-section">
      <div class="rgd-card-title">${header}</div>
      <div class="rgd-pie-wrapper">
        <svg viewBox="-50 -20 300 240" class="rgd-pie-svg" id="rgdPieSvg">
          ${svgSlices}
          ${insideLabels}
          ${outsideLabels}
        </svg>
        <div id="rgd-tooltip"></div>
      </div>
      <div class="rgd-chart-legend" style="flex-wrap:wrap;gap:6px 14px;margin-top:10px">${legendItems}</div>
    </div>
  </div>`;
}

function rgdToggleCard(card, event) {
  if (event && event.target.closest('.rgd-pie-slice')) return;
  card.classList.toggle('rgd-card-active');
}

function rgdSyncHighlight(regionName, event) {
  if (event) event.stopPropagation();
  const slice    = document.querySelector(`.rgd-pie-slice[data-region="${regionName}"]`);
  const isActive = slice && slice.classList.contains('rgd-highlighted');

  document.querySelectorAll('.rgd-pie-slice').forEach(el => el.classList.remove('rgd-highlighted'));

  if (!isActive) {
    if (slice) slice.classList.add('rgd-highlighted');
    if (filterManager.primaryFilter?.type === 'region' && filterManager.primaryFilter?.value === regionName) {
      filterManager.primaryFilter = null;
    } else {
      onPanel2Click('region', regionName);
    }
  } else {
    filterManager.primaryFilter = null;
    renderDashboardWithFilters();
  }
}

function _initRgdTooltip() {
  const tooltip = document.getElementById('rgd-tooltip');
  if (!tooltip) return;
  const svg = document.getElementById('rgdPieSvg');
  document.querySelectorAll('.rgd-pie-slice').forEach(slice => {
    slice.addEventListener('mouseenter', () => {
      tooltip.innerHTML = `<div class="rgd-tt-title" style="color:${slice.dataset.color}">● ${slice.dataset.region}</div><span class="rgd-tt-value">${slice.dataset.amount}</span> <span class="rgd-tt-percent">${slice.dataset.percent}</span>`;
      tooltip.style.opacity = '1';
    });
    slice.addEventListener('mousemove', e => {
      const rect = (svg || slice).closest('.rgd-pie-wrapper').getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
      tooltip.style.top  = (e.clientY - rect.top  - 44) + 'px';
    });
    slice.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
  });
}
