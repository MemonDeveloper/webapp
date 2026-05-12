// js/charts/card.js
// Summary financial cards for PANEL 1 of the bank dashboard.
// Exports: renderSummaryCards({ txns, credits, debits, opening, closing, bCashMode })

function _scardSparkline(series, type, color) {
  const pts = series.slice(-20);
  const N = pts.length;
  if (N < 2) {
    return `<svg viewBox="0 0 150 60" style="width:100%;height:100%;display:block">
      <line x1="2" y1="40" x2="148" y2="40" stroke="${color}" stroke-width="2" stroke-dasharray="4 4" stroke-opacity="0.3"/>
    </svg>`;
  }

  const maxVal = Math.max(...pts.map(Math.abs), 1);
  const norm = v => Math.min(Math.abs(v) / maxVal, 1);

  if (type === 'bar') {
    const w = Math.floor(148 / N);
    const bars = pts.map((v, i) => {
      const h = Math.max(3, norm(v) * 52);
      const x = 1 + i * w;
      const op = (0.4 + (i / N) * 0.6).toFixed(2);
      return `<rect x="${x}" y="${57 - h}" width="${Math.max(w - 3, 2)}" height="${h}" fill="${color}" opacity="${op}" rx="3"/>`;
    }).join('');
    return `<svg viewBox="0 0 150 60" preserveAspectRatio="none" style="width:100%;height:100%;display:block">${bars}</svg>`;
  }

  const points = pts.map((v, i) => {
    const x = ((i / (N - 1)) * 146 + 2).toFixed(1);
    const y = (56 - norm(v) * 50).toFixed(1);
    return `${x},${y}`;
  });
  const pathD = `M${points.join(' L')}`;
  const gId = `sg${Math.random().toString(36).substr(2, 7)}`;

  return `<svg viewBox="0 0 150 60" preserveAspectRatio="none" style="width:100%;height:100%;display:block">
    <defs>
      <linearGradient id="${gId}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${type === 'area' ? `<path d="${pathD} L148,60 L2,60 Z" fill="url(#${gId})"/>` : ''}
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function renderSummaryCards({ txns, credits, debits, opening, closing, bCashMode }) {
  const net = credits - debits;
  const isNetPos = net >= 0;

  // Build daily series for sparklines
  const dailyMap = {};
  txns.forEach(t => {
    const d = (t.date || '').slice(0, 10);
    if (!d) return;
    if (!dailyMap[d]) dailyMap[d] = { cr: 0, db: 0, net: 0, bal: null };
    const amt = $usdAmt(t);
    if (amt > 0) dailyMap[d].cr += amt;
    else if (amt < 0) dailyMap[d].db += Math.abs(amt);
    dailyMap[d].net += amt;
    const bal = $usdBalance(t);
    if (bal != null) dailyMap[d].bal = bal;
  });
  const dates = Object.keys(dailyMap).sort();
  const crSeries  = dates.map(d => dailyMap[d].cr);
  const dbSeries  = dates.map(d => dailyMap[d].db);
  const netSeries = dates.map(d => dailyMap[d].net);
  const balSeries = dates.map(d => dailyMap[d].bal).filter(v => v != null);

  // Previous date for comparison
  const prevD   = dates.length >= 2 ? dates[dates.length - 2] : null;
  const prevCr  = prevD ? (dailyMap[prevD].cr  || 0) : null;
  const prevDb  = prevD ? (dailyMap[prevD].db  || 0) : null;
  const prevNet = prevD ? (dailyMap[prevD].net || 0) : null;

  const crCount  = txns.filter(t => $usdAmt(t) > 0).length;
  const dbCount  = txns.filter(t => $usdAmt(t) < 0).length;
  const txnCount = txns.length;

  // Calendar icon (shared)
  const calSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>`;

  // Secondary metric texts + CSS class (positive / negative / neutral)
  const openSecCls = 'neutral';
  const openSecTxt = txnCount > 0 ? `${txnCount} transactions in period` : 'No data';

  const crSecCls = 'positive';
  const crSecTxt = prevCr !== null ? `Prev day: +${fmt(prevCr)}` : `${crCount} credit transactions`;

  const dbSecCls = 'negative';
  const dbSecTxt = prevDb !== null ? `Prev day: -${fmt(prevDb)}` : `${dbCount} debit transactions`;

  const clsSecCls = 'neutral';
  const clsSecTxt = txnCount > 0 ? 'Key Financial Position' : 'No data';

  const netSecCls = prevNet !== null ? (prevNet >= 0 ? 'positive' : 'negative') : 'neutral';
  const netSecTxt = prevNet !== null ? `Prev day: ${prevNet >= 0 ? '+' : ''}${fmt(prevNet)}` : `${txnCount} transactions`;

  // Active state from bCashMode
  const openAct = bCashMode === 'opening';
  const crAct   = bCashMode === 'credit';
  const dbAct   = bCashMode === 'debit';
  const clsAct  = bCashMode === 'closing';
  const netAct  = bCashMode === 'net';

  // Sparklines — use balance series for opening/closing when available
  const balOrCr = balSeries.length >= 2 ? balSeries : (crSeries.length >= 2 ? crSeries : [0, 1]);
  const openSpk = _scardSparkline(balOrCr,   'line', '#f97316');
  const crSpk   = _scardSparkline(crSeries,  'area', '#16a34a');
  const dbSpk   = _scardSparkline(dbSeries,  'area', '#dc2626');
  const clsSpk  = _scardSparkline(balOrCr,   'line', '#2563eb');
  const netSpk  = _scardSparkline(netSeries, 'bar',  isNetPos ? '#16a34a' : '#dc2626');

  return `
<div class="scard-grid">

  <!-- 1. Opening Balance -->
  <div class="scard scard-opening${openAct ? ' scard-active' : ''}" onclick="setBankCashMode('opening')" title="View Opening Balance" style="min-height: 120px; padding: 10px 10px 8px 10px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; min-height: 28px;">
      <div class="scard-title" style="margin-bottom: 0;">OPENING BAL.</div>
      <div class="scard-icon-box" style="margin-bottom: 0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
      </div>
    </div>
    <div class="scard-value scard-value--orange" style="text-align: right;">${opening != null ? fmt(opening) : '$0'}</div>
  </div>

  <!-- 2. Inflow -->
  <div class="scard scard-inflow${crAct ? ' scard-active' : ''}" onclick="setBankCashMode('credit')" title="Filter credit transactions" style="min-height: 120px; padding: 10px 10px 8px 10px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; min-height: 28px;">
      <div class="scard-title" style="margin-bottom: 0;">INFLOW</div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div class="scard-flow-icon scard-flow-icon--green" style="margin-bottom: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
        </div>
        <div class="scard-dot scard-dot--green"></div>
      </div>
    </div>
    <div class="scard-value scard-value--sm scard-value--green" style="text-align: right;">+${fmt(credits)}</div>
    <div class="scard-yday scard-yday--sm ${crSecCls}" style="font-size: 1.00em; font-weight: 600;">${calSvg}${crSecTxt}</div>
  </div>

  <!-- 3. Outflow -->
  <div class="scard scard-outflow${dbAct ? ' scard-active' : ''}" onclick="setBankCashMode('debit')" title="Filter debit transactions" style="min-height: 120px; padding: 10px 10px 8px 10px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; min-height: 28px;">
      <div class="scard-title" style="margin-bottom: 0;">OUTFLOW</div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div class="scard-flow-icon scard-flow-icon--red" style="margin-bottom: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/></svg>
        </div>
        <div class="scard-dot scard-dot--red"></div>
      </div>
    </div>
    <div class="scard-value scard-value--sm scard-value--red" style="text-align: right;">-${fmt(debits)}</div>
    <div class="scard-yday scard-yday--sm ${dbSecCls}" style="font-size: 1.00em; font-weight: 600;">${calSvg}${dbSecTxt}</div>
  </div>

  <!-- 4. Closing Balance -->
  <div class="scard scard-closing${clsAct ? ' scard-active' : ''}" onclick="setBankCashMode('closing')" title="View Closing Balance" style="min-height: 120px; padding: 10px 10px 8px 10px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; min-height: 28px;">
      <div class="scard-title" style="margin-bottom: 0;">CLOSING BAL.</div>
      <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #2563eb;">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z"/></svg>
      </div>
    </div>
    <div class="scard-value scard-value--blue" style="text-align: right;">${closing != null ? fmt(closing) : '$0'}</div>
    <div class="scard-yday scard-yday--sm ${clsSecCls}" style="font-size: 1em; font-weight: 600;">${calSvg}${clsSecTxt}</div>
  </div>

  <!-- 5. Net Cash Flow -->
  <div class="scard scard-net${isNetPos ? '' : ' scard-net--neg'}${netAct ? ' scard-active' : ''}" onclick="setBankCashMode('net')" title="View all transactions" style="min-height: 120px; padding: 10px 10px 8px 10px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; min-height: 28px;">
      <div class="scard-title" style="margin-bottom: 0;">NET CASH FLOW</div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div class="scard-flow-icon${isNetPos ? ' scard-flow-icon--green' : ' scard-flow-icon--red'}" style="margin-bottom: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        </div>
        <div class="scard-dot${isNetPos ? ' scard-dot--green' : ' scard-dot--red'}"></div>
      </div>
    </div>
    <div class="scard-value scard-value--sm${isNetPos ? ' scard-value--green' : ' scard-value--red'}" style="text-align: right;">${isNetPos ? '+' : ''}${fmt(net)}</div>
    <div class="scard-yday scard-yday--sm ${netSecCls}" style="font-size: 1.0em; font-weight: 600;">${calSvg}${netSecTxt}</div>
  </div>
</div>`;
}
