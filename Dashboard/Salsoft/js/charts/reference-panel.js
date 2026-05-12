// js/charts/reference-panel.js
// Renders the Reference Spending panel with horizontal gradient bars.
// renderReferencePanel({ referenceVolLabels, referenceVolMap, referenceSignedMap, totalReferenceVol, totalReferenceSigned, bCashMode, state })

const RS_COLORS = ['blue','green','orange','red','purple','cyan','pink','amber','teal','lime'];

/**
 * Handle Reference bar click
 * Sets reference as secondary filter via drill-down
 */
function _rsSelectBar(el, event) {
  if (event) event.stopPropagation();
  const wasActive = el.classList.contains('rs-bar-row--active');
  const reference = el.querySelector('.rs-bar-label')?.textContent;
  
  document.querySelectorAll('.rs-bar-row').forEach(r => r.classList.remove('rs-bar-row--active'));
  
  if (!wasActive && reference) {
    el.classList.add('rs-bar-row--active');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Use proper toggle: click once = set, click again = clear
    if (filterManager.secondaryFilter?.type === 'bankReference' && filterManager.secondaryFilter?.value === reference) {
      filterManager.secondaryFilter = null;
    } else {
      onPanel3Click('bankReference', reference);
    }
  } else if (wasActive) {
    // Second click = clear filter
    filterManager.secondaryFilter = null;
    renderDashboardWithFilters();
  }
}

function _rsToggleCard(el, event) {
  if (event && event.target.closest('.rs-bar-row')) return;
  el.classList.toggle('rs-card--active');
}

function renderReferencePanel({
  referenceVolLabels,
  referenceVolMap,
  referenceSignedMap,
  totalReferenceVol,
  totalReferenceSigned,
  bCashMode,
  state
}) {
  if (!referenceVolLabels.length) {
    return `<div class="rs-card"><div class="rs-empty">No reference data available.</div></div>`;
  }

  const titleMap = {
    opening: 'Reference Opening Balance',
    credit: 'Reference Inflow',
    debit: 'Reference Outflow',
    closing: 'Reference Closing Balance',
    net: 'Reference Net Cash Flow'
  };
  const title = titleMap[bCashMode] || 'Reference Spending';

  const formatModeAmount = (value) => {
    const val = Number(value || 0);
    const absTxt = fmt(Math.abs(val));
    if (bCashMode === 'debit') return `-${absTxt}`;
    if (bCashMode === 'credit') return `+${absTxt}`;
    if (bCashMode === 'net') return `${val >= 0 ? '+' : '-'}${absTxt}`;
    return absTxt;
  };

  const maxVol  = referenceVolMap[referenceVolLabels[0]] || 1;
  const activeRef = state.filters.bankReference || 'All';

  const bars = referenceVolLabels.map((ref, i) => {
    const vol      = referenceVolMap[ref] || 0;
    const signed   = referenceSignedMap ? (referenceSignedMap[ref] || 0) : vol;
    const pct      = Math.max(1, Math.round(vol / maxVol * 100));
    const color    = RS_COLORS[i % RS_COLORS.length];
    const encoded  = encodeURIComponent(ref);
    const isActive = activeRef === ref;

    return `<div class="rs-bar-row${isActive ? ' rs-bar-row--active' : ''}" data-color="${color}" data-encoded="${encoded}" onclick="_rsSelectBar(this, event)" title="${ref}: ${formatModeAmount(bCashMode === 'net' ? signed : vol)}">
      <div class="rs-bar-label">${ref}</div>
      <div class="rs-bar-track"><div class="rs-bar-fill rs-bar-fill--${color}" style="width:${pct}%"></div></div>
      <div class="rs-bar-value">${formatModeAmount(bCashMode === 'net' ? signed : vol)}</div>
    </div>`;
  }).join('');

  const totalValue = bCashMode === 'net' ? (totalReferenceSigned || 0) : totalReferenceVol;

  return `<div class="rs-card" onclick="_rsToggleCard(this, event)">
  <div class="cfd-card-header">
    <div class="rs-title">${title}</div>
    <div class="rs-total">Total: <span>${formatModeAmount(totalValue)}</span></div>
  </div>
  <div class="rs-bar-scroll" id="rs-bar-scroll">
    ${bars}
  </div>
</div>`;
}
