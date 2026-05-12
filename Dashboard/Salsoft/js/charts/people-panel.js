// js/charts/people-panel.js
// Renders the People panel for PANEL 3.
// renderPeoplePanel({ peopleVolLabels, txns, state, panelFilterSuffix, totalPeopleVol })

function renderPeoplePanel({ peopleVolLabels, txns, state, panelFilterSuffix, totalPeopleVol }) {
  const AVATAR_COLORS = ['#2563eb','#7c3aed','#ea580c','#0891b2','#dc2626','#16a34a','#d97706','#ec4899'];
  const calSvg = `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>`;
  const calIcon = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>`;
  const activeBankType = String(state?.filters?.bankType || '').toLowerCase();
  const hideOpeningClosing = activeBankType.includes('credit') || activeBankType.includes('merchant');

  if (!peopleVolLabels.length) {
    return `<div class="pp-shell"><div class="pp-empty">No people assigned to transactions.</div></div>`;
  }

  const cards = peopleVolLabels.map((person, i) => {
    const pData = state.people.find(p => (p.name || '').toLowerCase() === person.toLowerCase());
    const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const initials = person.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
    const avatarInner = pData?.image
      ? `<img src="${pData.image}" alt="${person}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
      : initials;
    const isActive = state.filters.people === person;
    const encodedPerson = encodeURIComponent(person);

    const personTxns = txns.filter(t => String(t.people || '').trim().toLowerCase() === person.toLowerCase());
    let personCredit = 0, personDebit = 0;
    let openingBal = null, closingBal = null, lastDate = null;
    let minTs = Infinity, maxTs = -Infinity;

    personTxns.forEach(t => {
      const amt = $usdAmt(t);
      if (amt > 0) personCredit += amt;
      else if (amt < 0) personDebit += Math.abs(amt);
      const d = t.date ? new Date(t.date).getTime() : null;
      if (d && !isNaN(d)) {
        if (d < minTs) { minTs = d; const bal = $usdBalance(t); if (bal != null) openingBal = bal; }
        if (d > maxTs) { maxTs = d; const bal = $usdBalance(t); if (bal != null) closingBal = bal; lastDate = t.date; }
      }
    });

    const personNet = personCredit - personDebit;
    const isNetPos = personNet >= 0;
    const total = personCredit + personDebit;
    const crPct = total > 0 ? Math.round(personCredit / total * 100) : 50;
    const dbPct = 100 - crPct;
    const lastStr = lastDate
      ? new Date(lastDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
      : '—';
    const openStr  = openingBal != null ? fmt(openingBal) : '—';
    const closeStr = closingBal != null ? fmt(closingBal) : '—';

    // Previous date comparison
    const sortedDates = [...new Set(personTxns.map(t => (t.date || '').slice(0, 10)).filter(Boolean))].sort();
    const prevD = sortedDates.length >= 2 ? sortedDates[sortedDates.length - 2] : null;
    let prevCr = 0, prevDb = 0;
    if (prevD) {
      personTxns.filter(t => (t.date || '').slice(0, 10) === prevD).forEach(t => {
        const amt = $usdAmt(t);
        if (amt > 0) prevCr += amt;
        else if (amt < 0) prevDb += Math.abs(amt);
      });
    }

    return `<div class="pp-card${isActive ? ' pp-card--active' : ''}" onclick="applyFilter('people','${isActive ? 'All' : encodedPerson}')">

      <div class="pp-header">
        <div class="pp-person-info">
          <div class="pp-avatar" style="background:${color}">${avatarInner}</div>
          <div>
            <div class="pp-name">${person}</div>
            <div class="pp-rank">#${i + 1} by volume</div>
          </div>
        </div>
        <div class="pp-date">
          <span>Last txn</span>
          <strong>${lastStr}</strong>
        </div>
      </div>

      <div class="pp-comparison">
        <div class="pp-comp-labels">
          <div class="pp-comp-label pp-comp-label--cr"><div class="pp-dot pp-dot--green"></div>Credit</div>
          <div class="pp-comp-label pp-comp-label--db">Debit<div class="pp-dot pp-dot--red"></div></div>
        </div>
        <div class="pp-progress-bar">
          <div class="pp-credit-fill" style="width:${crPct}%"></div>
          <div class="pp-debit-fill"  style="width:${dbPct}%"></div>
        </div>
        <div class="pp-comp-values">
          <div>
            <div class="pp-amount pp-amount--green">+${fmt(personCredit)}</div>
            ${prevD ? `<div class="pp-yday pp-yday--positive">${calSvg}Prev: +${fmt(prevCr)}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div class="pp-amount pp-amount--red">-${fmt(personDebit)}</div>
            ${prevD ? `<div class="pp-yday pp-yday--negative">${calSvg}Prev: -${fmt(prevDb)}</div>` : ''}
          </div>
        </div>
      </div>

      ${hideOpeningClosing ? '' : `<div class="pp-balances">
        <div class="pp-bal-item pp-bal-item--opening">
          <label>${calIcon} Opening</label>
          <div class="pp-bal-amount">${openStr}</div>
        </div>
        <div class="pp-bal-item pp-bal-item--closing">
          <label>${calIcon} Closing</label>
          <div class="pp-bal-amount">${closeStr}</div>
        </div>
      </div>`}

      <div class="pp-net-footer${isNetPos ? ' pp-net-footer--pos' : ' pp-net-footer--neg'}">
        <div class="pp-net-label">● NET CASH FLOW</div>
        <div class="pp-net-value">${isNetPos ? '+' : ''}${fmt(personNet)}</div>
      </div>

    </div>`;
  }).join('');

  return `<div class="pp-shell">
  <div class="cfd-card-header">
    <h2 class="pp-page-title">Team Performance</h2>
    <div class="pp-count-badge">${peopleVolLabels.length} Members</div>
  </div>
  <div class="pp-scroll-area" id="pp-scroll-area">${cards}</div>

</div>`;
}
