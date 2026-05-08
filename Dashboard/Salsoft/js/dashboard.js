// ============================================================
// DASHBOARD
// ============================================================
function getFilteredTxns() {
  const fc = state.filters.company;
  const fp = state.filters.parentCompany || 'All';
  const fbt = state.filters.bankType || 'All';
  const fpeople = state.filters.people || 'All';
  const fr = state.filters.region || 'All';
  const fb = state.filters.bank || 'All';
  const fa = state.filters.account || 'All';
  const fcur = state.filters.currency || 'All';
  const fcat = state.filters.creditCategory || 'All';
  const fref = state.filters.creditReference || 'All';
  const fInter = state.filters.bankInterDivision || 'All';
  const fBankRef = state.filters.bankReference || 'All';
  const creditMode = state.filters.creditAmountMode || 'all';
  const bankCashMode = state.filters.bankCashMode || 'all';
  const isCreditType = String(fbt || '').toLowerCase().includes('credit');
  const isBankDashboardType = String(fbt || '').toLowerCase().includes('bank') && !String(fbt || '').toLowerCase().includes('merchant') && !String(fbt || '').toLowerCase().includes('credit');
  const normalizeBankType = (v) => String(v || '').trim().toLowerCase().replace(/s$/, '');
  return state.transactions.filter(t => {
    if (fc !== 'All' && t.company !== fc) return false;
    if (fp !== 'All') {
      const subs = getCompaniesForParent(fp);
      if (!subs.includes(t.company)) return false;
    }
    if (fbt !== 'All') {
      const txnBt = normalizeBankType(t.bankType);
      const filterBt = normalizeBankType(fbt);
      if (txnBt !== filterBt) return false;
    }
    if (fpeople !== 'All' && String(t.people || '').trim() !== fpeople) return false;
    if (fr !== 'All' && (state.companyRegions[t.company] || 'Other') !== fr) return false;
    if (fb !== 'All' && String(t.bank || '').trim() !== fb) return false;
    if (fa !== 'All' && (((t.accountNumber || '').trim() || 'No account') !== fa)) return false;
    if (fcur !== 'All' && String(t.currency || '').trim() !== fcur) return false;
    if (fcat !== 'All' && (((t.category || 'Uncategorized').trim() || 'Uncategorized') !== fcat)) return false;
    if (fref !== 'All' && (((t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference') !== fref)) return false;
    if (fInter !== 'All' && (((t.interDivision || '').trim() || 'Unassigned') !== fInter)) return false;
    if (fBankRef !== 'All' && (((t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference') !== fBankRef)) return false;
    if (isCreditType && creditMode === 'spending' && (+t.amount || 0) >= 0) return false;
    if (isCreditType && creditMode === 'income' && (+t.amount || 0) <= 0) return false;
    if (isBankDashboardType && bankCashMode === 'credit' && (+t.amount || 0) <= 0) return false;
    if (isBankDashboardType && bankCashMode === 'debit' && (+t.amount || 0) >= 0) return false;
    if (state.filters.dateFrom && t.date && t.date < state.filters.dateFrom) return false;
    if (state.filters.dateTo && t.date && t.date > state.filters.dateTo) return false;
    return true;
  });
}
function getFilteredPeople() {
  const fc = state.filters.company;
  const fp = state.filters.parentCompany || 'All';
  if (fc !== 'All') return state.people.filter(p => p.company === fc);
  if (fp !== 'All') {
    const subs = getCompaniesForParent(fp);
    return state.people.filter(p => subs.includes(p.company));
  }
  return state.people;
}
function renderDashboard(area) {
  // Keep dashboard default on Bank when no specific bank type is selected.
  if (!state.filters.bankType || state.filters.bankType === 'All') {
    state.filters.bankType = 'Bank';
  }

  const txns = getFilteredTxns();
  const credits = txns.filter(t=>(+t.amount||0)>0).reduce((s,t)=>s+(+t.amount||0),0);
  const debits  = txns.filter(t=>(+t.amount||0)<0).reduce((s,t)=>s+Math.abs(+t.amount||0),0);
  const balance = credits - debits;
  updateSidebarBalances(balance, credits, debits);

  // Calculate dynamic opening/closing balances based on filtered transactions
  let displayOpeningBalance = null;
  let displayClosingBalance = null;
  
  if (state.openingBalance != null && txns.length > 0) {
    // Get all transactions sorted by date (oldest first)
    const allSorted = [...state.transactions].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
    
    // Calculate running balances for all transactions
    let runningBalance = state.openingBalance;
    const balances = {};
    allSorted.forEach(t => {
      const oldBal = runningBalance;
      runningBalance += (+t.amount || 0);
      balances[t.id] = { opening: oldBal, closing: runningBalance };
    });
    
    // Get opening and closing balances from filtered transactions
    const txnsSorted = [...txns].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
    const earliest = txnsSorted[0];
    const latest = txnsSorted[txnsSorted.length - 1];
    
    displayOpeningBalance = balances[earliest.id]?.opening;
    displayClosingBalance = balances[latest.id]?.closing;
  }
  if ((displayOpeningBalance == null || displayClosingBalance == null) && txns.length > 0) {
    const txnsSorted = [...txns].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
    const firstWithOpening = txnsSorted.find(t => t.openingBalance != null && !Number.isNaN(+t.openingBalance));
    const lastWithClosing = [...txnsSorted].reverse().find(t => t.closingBalance != null && !Number.isNaN(+t.closingBalance));
    if (displayOpeningBalance == null && firstWithOpening) displayOpeningBalance = +firstWithOpening.openingBalance;
    if (displayClosingBalance == null && lastWithClosing) displayClosingBalance = +lastWithClosing.closingBalance;
  }
  // If no filtered transactions, keep displayOpeningBalance and displayClosingBalance as null

  const filteredPeople = getFilteredPeople();
  const displayPeople = filteredPeople.slice(0, 5);
  const peopleAvatarsHTML = displayPeople.map((p) => {
    const name = p.name || '?';
    const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const color = getCompanyColor(p.company, 'primary');
    const personName = name.trim().toLowerCase();
    const personTxnsByPeople = txns.filter(t => String(t.people || '').trim().toLowerCase() === personName);
    const personTxns = personTxnsByPeople.length ? personTxnsByPeople : txns.filter(t => (t.company || '') === (p.company || ''));
    const personCredit = personTxns.reduce((sum, t) => {
      const amt = safeFloat(t.amount);
      return amt > 0 ? sum + amt : sum;
    }, 0);
    const personDebit = personTxns.reduce((sum, t) => {
      const amt = safeFloat(t.amount);
      return amt < 0 ? sum + Math.abs(amt) : sum;
    }, 0);
    const balanceClass = personDebit > personCredit ? 'p-debit' : 'p-credit';
    const encodedName = encodeURIComponent(name);
    const encodedCompany = encodeURIComponent(p.company || 'All');
    const avatarInner = p.image ? `<img src="${p.image}" alt="${name}">` : initials;
    return `<div class="p-avatar-wrap ${balanceClass}" onclick="selectAvatar(this,'${encodedName}','${encodedCompany}')"><div class="p-avatar" style="background:${color}">${avatarInner}</div><div class="p-name">${name}</div><div class="p-tooltip"><div>${name}</div><div class="p-tooltip-credit"><span>Credit:</span> <span>${fmt(personCredit)}</span></div><div class="p-tooltip-debit"><span>Debit:</span> <span>${fmt(personDebit)}</span></div></div></div>`;
  }).join('');

  const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];
  const regionColors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

  // Bank type detection for conditional sections and metric source selection
  const activeBankType = (state.filters.bankType || 'All').toLowerCase();
  const isBankType     = activeBankType === 'all' || activeBankType.includes('bank');
  const isMerchantType = activeBankType.includes('merchant');
  const isCreditType   = activeBankType.includes('credit');
  const isBankDashboardType = isBankType && !isMerchantType && !isCreditType;

  // Merchant analytics must come from net amount values.
  const analyticsTxns = txns;
  const analyticsValue = (t) => {
    if (isMerchantType) return (+t.net_amount || 0);
    return Math.abs(+t.amount || 0);
  };

  const compVolMap = {};
  analyticsTxns.forEach(t => { const c = t.company || 'Unknown'; compVolMap[c] = (compVolMap[c] || 0) + analyticsValue(t); });
  const compVolLabels = Object.keys(compVolMap).sort((a, b) => compVolMap[b] - compVolMap[a]);
  const totalCompVol = compVolLabels.reduce((s, c) => s + compVolMap[c], 0);
  const referenceVolMap = {};
  analyticsTxns.forEach(t => {
    const referenceKey = (t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference';
    referenceVolMap[referenceKey] = (referenceVolMap[referenceKey] || 0) + analyticsValue(t);
  });
  const referenceVolLabels = Object.keys(referenceVolMap).sort((a, b) => referenceVolMap[b] - referenceVolMap[a]);
  const totalReferenceVol = referenceVolLabels.reduce((sum, key) => sum + referenceVolMap[key], 0);
  const bankVolMap = {};
  state.banks.forEach(b => { bankVolMap[b] = 0; });
  analyticsTxns.forEach(t => {
    const b = t.bank || 'Unknown';
    if (bankVolMap[b] !== undefined) bankVolMap[b] += analyticsValue(t);
  });
  const bankVolLabels = state.banks
    .filter(b => (bankVolMap[b] || 0) > 0)
    .sort((a, b) => bankVolMap[b] - bankVolMap[a]);
  const totalBankVol = bankVolLabels.reduce((s, b) => s + bankVolMap[b], 0);
  const bankAccountMap = {};
  analyticsTxns.forEach(t => {
    const bankName = t.bank || 'Unknown';
    const accountNumber = (t.accountNumber || '').trim() || 'No account';
    const companyName = (t.company || 'Unknown').trim() || 'Unknown';
    const amount = +t.amount || 0;
    const dateRaw = t.date || t.date_2 || '';
    const dateObj = dateRaw ? new Date(dateRaw) : null;
    const dateTs = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.getTime() : null;
    const openingValue = t.openingBalance != null && !Number.isNaN(+t.openingBalance) ? (+t.openingBalance) : null;
    const closingValue = t.closingBalance != null && !Number.isNaN(+t.closingBalance) ? (+t.closingBalance) : null;
    const key = bankName + '||' + accountNumber;
    if (!bankAccountMap[key]) {
      bankAccountMap[key] = {
        bankName,
        accountNumber,
        volume: 0,
        count: 0,
        inflow: 0,
        outflow: 0,
        opening: null,
        closing: null,
        openingTs: null,
        closingTs: null,
        lastUpdatedTs: null,
        lastUpdatedLabel: '—',
        companyMap: {}
      };
    }
    const entry = bankAccountMap[key];
    entry.companyMap[companyName] = (entry.companyMap[companyName] || 0) + analyticsValue(t);
    if (amount > 0) entry.inflow += amount;
    else if (amount < 0) entry.outflow += Math.abs(amount);
    if (openingValue != null && dateTs != null && (entry.openingTs == null || dateTs < entry.openingTs)) {
      entry.opening = openingValue;
      entry.openingTs = dateTs;
    }
    if (closingValue != null && dateTs != null && (entry.closingTs == null || dateTs > entry.closingTs)) {
      entry.closing = closingValue;
      entry.closingTs = dateTs;
    }
    if (dateTs != null && (entry.lastUpdatedTs == null || dateTs > entry.lastUpdatedTs)) {
      entry.lastUpdatedTs = dateTs;
      entry.lastUpdatedLabel = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    entry.volume += analyticsValue(t);
    entry.count += 1;
  });
  const bankDetailRows = Object.values(bankAccountMap)
    .map(row => {
      const companyName = Object.keys(row.companyMap)
        .sort((a, b) => (row.companyMap[b] - row.companyMap[a]) || a.localeCompare(b))[0] || 'Unknown';
      let opening = row.opening;
      let closing = row.closing;
      if (opening == null && closing != null) opening = closing - row.inflow + row.outflow;
      if (closing == null && opening != null) closing = opening + row.inflow - row.outflow;
      return {
        ...row,
        companyName,
        opening,
        closing
      };
    })
    .sort((a, b) => Math.abs(b.volume || 0) - Math.abs(a.volume || 0));
  const maxBankDetailVol = bankDetailRows.length
    ? Math.max(...bankDetailRows.map(row => Math.abs(row.volume || 0)))
    : 0;
  const regionMap = {};
  analyticsTxns.forEach(t => { const r = state.companyRegions[t.company] || 'Other'; regionMap[r] = (regionMap[r] || 0) + analyticsValue(t); });
  const regionLabels = Object.keys(regionMap).sort((a, b) => regionMap[b] - regionMap[a]);
  const totalRegionVol = regionLabels.reduce((s, r) => s + regionMap[r], 0);
  const interDivisionMap = {};
  txns.forEach(t => {
    const interDivision = (t.interDivision || '').trim() || 'Unassigned';
    interDivisionMap[interDivision] = (interDivisionMap[interDivision] || 0) + Math.abs(+t.amount || 0);
  });
  const interDivisionLabels = Object.keys(interDivisionMap).sort((a, b) => interDivisionMap[b] - interDivisionMap[a]).slice(0, 8);
  const statusCountMap = {};
  txns.forEach(t => {
    const status = (t.status || 'Unknown').trim() || 'Unknown';
    statusCountMap[status] = (statusCountMap[status] || 0) + 1;
  });
  const financialTotals = txns.reduce((totals, txn) => {
    totals.net += Math.abs(+txn.net_amount || 0);
    totals.fee += Math.abs(+txn.fee || 0);
    totals.vat += Math.abs(+txn.vat || 0);
    return totals;
  }, { net: 0, fee: 0, vat: 0 });
  const thS = 'text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--text2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;background:var(--surface2)';
  const thR = 'text-align:right;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--text2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;background:var(--surface2)';

  // Credit card specific metrics
  const creditIncomeTxns = txns.filter(t => (+t.amount || 0) > 0);
  const creditSpendingTxns = txns.filter(t => (+t.amount || 0) < 0);
  const creditTxns = txns.filter(t => (+t.amount || 0) !== 0);
  const totalIncome = creditIncomeTxns.reduce((s, t) => s + (+t.amount || 0), 0);
  const totalSpending = creditSpendingTxns.reduce((s, t) => s + Math.abs(+t.amount || 0), 0);
  const avgTxn = creditTxns.length ? creditTxns.reduce((s, t) => s + Math.abs(+t.amount || 0), 0) / creditTxns.length : 0;
  const highestTxn = creditTxns.length ? Math.max(...creditTxns.map(t => Math.abs(+t.amount || 0))) : 0;
  const showCreditCompanyDonut = isCreditType;
  const showMerchantCompanyDonut = isMerchantType;
  const showBankCompanyDonut = isBankDashboardType;

  const creditCompanyMap = {};
  creditTxns.forEach(t => {
    const company = (t.company || 'Unknown').trim() || 'Unknown';
    creditCompanyMap[company] = (creditCompanyMap[company] || 0) + (+t.amount || 0);
  });
  const creditCompanyLabels = Object.keys(creditCompanyMap).sort((a, b) => creditCompanyMap[b] - creditCompanyMap[a]);
  const totalCreditCompanyVol = creditCompanyLabels.reduce((sum, key) => sum + creditCompanyMap[key], 0);

  // Merchant spending (reference-based for credit)
  const merchantMap = {};
  creditTxns.forEach(t => {
    const merchant = (t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference';
    merchantMap[merchant] = (merchantMap[merchant] || 0) + (+t.amount || 0);
  });
  const merchantLabels = Object.keys(merchantMap).sort((a, b) => merchantMap[b] - merchantMap[a]);
  const totalMerchantVol = merchantLabels.reduce((s, k) => s + merchantMap[k], 0);

  // Category wise spending (credit) - DEPRECATED, replaced with status
  const categoryMap = {};
  creditTxns.forEach(t => {
    const cat = (t.category || 'Uncategorized').trim() || 'Uncategorized';
    categoryMap[cat] = (categoryMap[cat] || 0) + (+t.amount || 0);
  });
  const categoryLabels = Object.keys(categoryMap).sort((a, b) => categoryMap[b] - categoryMap[a]);
  const totalCategoryVol = categoryLabels.reduce((s, k) => s + categoryMap[k], 0);

  // Status wise spending (credit) - replaces category
  const statusMap = {};
  creditTxns.forEach(t => {
    const status = (t.status || 'Unknown').trim() || 'Unknown';
    statusMap[status] = (statusMap[status] || 0) + (+t.amount || 0);
  });
  const statusLabels = Object.keys(statusMap).sort((a, b) => statusMap[b] - statusMap[a]);
  const totalStatusVol = statusLabels.reduce((s, k) => s + statusMap[k], 0);

  // Credit-specific totals
  const creditFinancialTotals = creditTxns.reduce((totals, txn) => {
    totals.net += Math.abs(+txn.net_amount || 0);
    totals.fee += Math.abs(+txn.fee || 0);
    totals.vat += Math.abs(+txn.vat || 0);
    return totals;
  }, { net: 0, fee: 0, vat: 0 });
  const merchantTotalAmount = txns.reduce((sum, txn) => sum + (+txn.amount || 0), 0);
  const merchantTotalNetAmount = txns.reduce((sum, txn) => sum + (+txn.net_amount || 0), 0);
  function miniRows(labels, volMap, totalVol, colorFn, cntFilter) {
    return labels.map((item, i) => {
      const vol = volMap[item];
      const share = totalVol > 0 ? Math.round(vol / totalVol * 100) : 0;
      const color = colorFn(item, i);
      return '<tr>'
        + '<td style="padding:8px 10px;border-bottom:1px solid var(--border)">'
        + '<div style="display:flex;align-items:center;gap:7px"><span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;display:inline-block"></span><span style="font-weight:700">' + item + '</span></div>'
        + '<div style="margin-left:15px;margin-top:4px;height:3px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:' + share + '%;height:100%;background:' + color + ';border-radius:2px"></div></div>'
        + '</td>'
        + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px">' + fmt(vol) + '</td>'
        + '</tr>';
    }).join('');
  }

  area.innerHTML = `
    <div class="filter-bar dashboard-filter-bar">
      <div class="dashboard-filter-chips">
        <span class="filter-label">Category Type</span>
        ${state.bankTypes.map(type => `<button class="dashboard-filter-chip ${state.filters.bankType===type?'active':''}" onclick="applyFilter('bankType','${type}')">${type}</button>`).join('')}
      </div>
      <div class="filter-group">
        <span class="filter-label">From Date</span>
        <input type="date" value="${state.filters.dateFrom}" onchange="applyFilter('dateFrom',this.value)">
      </div>
      <div class="filter-group">
        <span class="filter-label">To Date</span>
        <input type="date" value="${state.filters.dateTo}" onchange="applyFilter('dateTo',this.value)">
      </div>
      <div class="filter-group">
        <span class="filter-label">People</span>
        <select onchange="applyFilter('people',this.value)">
          <option value="All">All</option>
          ${[...new Set(state.transactions.map(t => String(t.people||'').trim()).filter(Boolean))].sort().map(p=>`<option ${state.filters.people===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="table-actions" style="margin-left:auto">
        <button class="btn btn-secondary btn-sm" onclick="clearDashboardDateFilters()">Reset All</button>
      </div>
    </div>
    <!-- PANEL 1: Total Detail -->
    ${isMerchantType || isCreditType ? `
    <div class="dashboard-total-grid merchant-summary-grid">
      <div class="dashboard-card dashboard-merchant-summary-card">
        <div class="dashboard-balance-row">
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">Total Transactions</div>
            <div class="dashboard-number" style="color:var(--blue)">${isCreditType ? creditTxns.length : txns.length}</div>
          </div>
        </div>
      </div>
      <div class="dashboard-card dashboard-merchant-summary-card" style="background:var(--red-light)">
        <div class="dashboard-balance-row">
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">${isCreditType ? 'Total Spending' : 'Total Fees'}</div>
            <div class="dashboard-number" style="color:var(--amber)${isCreditType ? ';cursor:pointer' : ''}" ${isCreditType ? `onclick="setCreditAmountMode('spending')" title="Filter dashboard by spending transactions"` : ''}>${isCreditType ? fmt(totalSpending) : fmt(financialTotals.fee)}</div>
          </div>
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">${isCreditType ? 'Total Income' : 'Total Vat'}</div>
            <div class="dashboard-number" style="color:var(--purple)${isCreditType ? ';cursor:pointer' : ''}" ${isCreditType ? `onclick="setCreditAmountMode('income')" title="Filter dashboard by income transactions"` : ''}>${isCreditType ? fmt(totalIncome) : fmt(financialTotals.vat)}</div>
          </div>
        </div>
      </div>
      <div class="dashboard-card dashboard-merchant-summary-card" style="background:var(--green-light)">
        <div class="dashboard-balance-row">
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">${isCreditType ? 'Average Transaction' : 'Total Amount'}</div>
            <div class="dashboard-number" style="color:var(--blue)">${isCreditType ? fmt(avgTxn) : fmt(merchantTotalAmount)}</div>
          </div>
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">${isCreditType ? 'Highest Transaction' : 'Total Net Amount'}</div>
            <div class="dashboard-number" style="color:var(--green)">${isCreditType ? fmt(highestTxn) : fmt(merchantTotalNetAmount)}</div>
          </div>
        </div>
      </div>
    </div>
    ` : isBankDashboardType ? `` : `
    <div class="dashboard-total-grid">
      <div class="dashboard-card dashboard-left-card">
        ${isBankType ? `
        <div class="dashboard-balance-row">
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">Opening Balance</div>
            <div class="dashboard-number" style="color:var(--text)">${displayOpeningBalance != null ? fmt(displayOpeningBalance) : '—'}</div>
          </div>
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">Closing Balance</div>
            <div class="dashboard-number" style="color:var(--text2)">${displayClosingBalance != null ? fmt(displayClosingBalance) : '—'}</div>
          </div>
        </div>
        <div class="dashboard-divider"></div>` : ''}
        <div class="dashboard-balance-row">
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">Total Transactions</div>
            <div class="dashboard-number" style="color:var(--blue)">${isCreditType ? creditTxns.length : txns.length}</div>
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:center">
        ${state.people.length === 0
          ? '<span style="font-size:13px;color:var(--text3)">No people found</span>'
          : `<div class="people-carousel" style="width:fit-content">
              <button class="people-nav-btn" onclick="scrollAvatars(-1)">&#8249;</button>
              <div class="people-avatar-row" id="people-avatar-scroll">${peopleAvatarsHTML}</div>
              <button class="people-nav-btn" onclick="scrollAvatars(1)">&#8250;</button>
            </div>`
        }
      </div>
      <div class="dashboard-card dashboard-right-card">
        <div class="dashboard-credit-debit-box debit">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--red)"></div>
            <div class="dashboard-meta-label" style="margin-bottom:0">Total Debit</div>
          </div>
          <div class="dashboard-number" style="color:var(--red)">${fmt(debits)}</div>
        </div>
        <div class="dashboard-credit-debit-box credit">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
            <div style="width:8px;height:8px;border-radius:50%;background:var(--green)"></div>
            <div class="dashboard-meta-label" style="margin-bottom:0">Total Credit</div>
          </div>
          <div class="dashboard-number" style="color:var(--green)">${fmt(credits)}</div>
        </div>
      </div>
    </div>
    `}

    ${isBankDashboardType && bankDetailRows.length > 0 ? (() => {
      const row = bankDetailRows[0];
      const opening = row.opening == null ? 0 : row.opening;
      const closing = row.closing == null ? 0 : row.closing;
      const netFlow = closing - opening;
      const openingText = fmt(opening);
      const closingText = fmt(closing);
      const creditText = fmt(row.inflow);
      const debitText = fmt(row.outflow);
      const netFlowText = fmt(netFlow);
      return `<svg width="100%" viewBox="0 0 1300 160" role="img" xmlns="http://www.w3.org/2000/svg" style="min-height: 140px;">
          <!-- Opening Balance -->
          <g transform="translate(10,10)">
            <rect width="250" height="140" rx="12" fill="#E8F4FD" stroke="#2196F3" stroke-width="1.5"/>
            <rect x="20" y="40" width="70" height="60" rx="6" fill="#2196F3" fill-opacity="0.15" stroke="#2196F3" stroke-width="1.5"/>
            <line x1="30" y1="56" x2="80" y2="56" stroke="#2196F3" stroke-width="2" stroke-linecap="round"/>
            <line x1="30" y1="68" x2="68" y2="68" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="30" y1="80" x2="73" y2="80" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round"/>
            <text x="100" y="60" text-anchor="start" fill="#2196F3" font-family="sans-serif" font-size="18" font-weight="700">Opening Balance</text>
            <text x="100" y="90" text-anchor="start" fill="#2196F3" font-family="sans-serif" font-size="17" font-weight="700">${openingText}</text>
          </g>

          <!-- Credit -->
          <g transform="translate(270,10)">
            <rect width="250" height="140" rx="12" fill="#E8F8EF" stroke="#4CAF50" stroke-width="1.5"/>
            <circle cx="55" cy="70" r="30" fill="#4CAF50" fill-opacity="0.15" stroke="#4CAF50" stroke-width="1.5"/>
            <line x1="55" y1="86" x2="55" y2="54" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" marker-end="url(#arrow)"/>
            <line x1="41" y1="75" x2="55" y2="54" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
            <line x1="69" y1="75" x2="55" y2="54" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
            <text x="100" y="60" text-anchor="start" font-family="sans-serif" font-size="18" font-weight="700" fill="#4CAF50">Credit</text>
            <text x="100" y="90" text-anchor="start" font-family="sans-serif" font-size="17" font-weight="700" fill="#4CAF50">${creditText}</text>
          </g>

          <!-- Debit -->
          <g transform="translate(530,10)">
            <rect width="250" height="140" rx="12" fill="#FDECEA" stroke="#F44336" stroke-width="1.5"/>
            <circle cx="55" cy="70" r="30" fill="#F44336" fill-opacity="0.15" stroke="#F44336" stroke-width="1.5"/>
            <line x1="55" y1="54" x2="55" y2="86" stroke="#F44336" stroke-width="2.5" stroke-linecap="round" marker-end="url(#arrow)"/>
            <line x1="41" y1="67" x2="55" y2="86" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
            <line x1="69" y1="67" x2="55" y2="86" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
            <text x="100" y="60" text-anchor="start" font-family="sans-serif" font-size="18" font-weight="700" fill="#F44336">Debit</text>
            <text x="100" y="90" text-anchor="start" font-family="sans-serif" font-size="17" font-weight="700" fill="#F44336">${debitText}</text>
          </g>

          <!-- Closing Balance -->
          <g transform="translate(790,10)">
            <rect width="250" height="140" rx="12" fill="#F3E5F5" stroke="#9C27B0" stroke-width="1.5"/>
            <rect x="15" y="40" width="70" height="60" rx="6" fill="#9C27B0" fill-opacity="0.13" stroke="#9C27B0" stroke-width="1.5"/>
            <line x1="25" y1="56" x2="75" y2="56" stroke="#9C27B0" stroke-width="2" stroke-linecap="round"/>
            <line x1="25" y1="68" x2="63" y2="68" stroke="#9C27B0" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="25" y1="80" x2="68" y2="80" stroke="#9C27B0" stroke-width="1.5" stroke-linecap="round"/>
            <text x="100" y="60" text-anchor="start" font-family="sans-serif" font-size="18" font-weight="700" fill="#9C27B0">Closing Balance</text>
            <text x="100" y="90" text-anchor="start" font-family="sans-serif" font-size="17" font-weight="700" fill="#9C27B0">${closingText}</text>
          </g>

          <!-- Net Cash Flow -->
          <g transform="translate(1050,10)">
            <rect width="240" height="140" rx="12" fill="#FFF8E1" stroke="#FF9800" stroke-width="1.5"/>
            <rect x="23" y="42" width="64" height="64" rx="6" fill="#FF9800" fill-opacity="0.12" stroke="#FF9800" stroke-width="1.5"/>
            <rect x="31" y="78" width="11" height="16" rx="2" fill="#FF9800" fill-opacity="0.5"/>
            <rect x="46" y="65" width="11" height="29" rx="2" fill="#FF9800" fill-opacity="0.7"/>
            <rect x="61" y="54" width="11" height="40" rx="2" fill="#FF9800"/>
            <line x1="27" y1="100" x2="83" y2="100" stroke="#FF9800" stroke-width="1.5"/>
            <line x1="35" y1="88" x2="71" y2="60" stroke="#FF9800" stroke-width="2" stroke-linecap="round" marker-end="url(#arrow)" stroke-dasharray="4 3"/>
            <text x="100" y="60" text-anchor="start" font-family="sans-serif" font-size="18" font-weight="700" fill="#FF9800">Net Cash Flow</text>
            <text x="100" y="90" text-anchor="start" font-family="sans-serif" font-size="17" font-weight="700" fill="#FF9800">${netFlowText}</text>
          </g>
        </svg>`;
    })() : ''}

    <!-- PANEL 2: Transaction Graph or Revenue Trend -->
    ${isMerchantType ? `
    <div class="chart-card" style="margin-bottom:18px">
      <div class="chart-card-header">
        <div>
          <div class="chart-title">Merchant Trend</div>
          <div class="chart-subtitle">Daily merchant amount, fee &amp; VAT trend</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end">
          <select class="form-select" style="min-width:120px;height:34px;padding:6px 28px 6px 10px;font-size:12px" onchange="setChartGranularity(this.value)">
            <option value="daily" ${state.filters.chartGranularity==='daily'?'selected':''}>Daily</option>
            <option value="weekly" ${state.filters.chartGranularity==='weekly'?'selected':''}>Weekly</option>
            <option value="monthly" ${state.filters.chartGranularity==='monthly'?'selected':''}>Monthly</option>
          </select>
          <div class="chart-legend">
            <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Net Amount</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--amber)"></div>Fee</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--purple)"></div>VAT</div>
          </div>
        </div>
      </div>
      <canvas id="revenueChart" height="55"></canvas>
    </div>
    ` : isCreditType ? `
    <div class="chart-card" style="margin-bottom:18px">
      <div class="chart-card-header">
        <div>
          <div class="chart-title">Monthly Spending Trend + Total Income</div>
          <div class="chart-subtitle">Month-wise total spending and total income trend</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end">
          <select class="form-select" style="min-width:120px;height:34px;padding:6px 28px 6px 10px;font-size:12px" onchange="setChartGranularity(this.value)">
            <option value="daily" ${state.filters.chartGranularity==='daily'?'selected':''}>Daily</option>
            <option value="weekly" ${state.filters.chartGranularity==='weekly'?'selected':''}>Weekly</option>
            <option value="monthly" ${state.filters.chartGranularity==='monthly' || !state.filters.chartGranularity ?'selected':''}>Monthly</option>
          </select>
          <div class="chart-legend">
            <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Total Spending</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Total Income</div>
          </div>
        </div>
      </div>
      <canvas id="creditTrendChart" height="55"></canvas>
    </div>
    ` : isBankDashboardType ? `
    <div class="bank-trend-row" style="margin-bottom:18px">
      <div class="chart-card bank-trend-compact-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-title">Cash Flow Trend</div>
            <div class="chart-subtitle">${state.filters.chartGranularity[0].toUpperCase() + state.filters.chartGranularity.slice(1)} credit and debit cash flow</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end">
            <select class="form-select" style="min-width:120px;height:34px;padding:6px 28px 6px 10px;font-size:12px" onchange="setChartGranularity(this.value)">
              <option value="daily" ${state.filters.chartGranularity==='daily'?'selected':''}>Daily</option>
              <option value="weekly" ${state.filters.chartGranularity==='weekly'?'selected':''}>Weekly</option>
              <option value="monthly" ${state.filters.chartGranularity==='monthly'?'selected':''}>Monthly</option>
            </select>
            <div class="chart-legend">
              <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Credit</div>
              <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Debit</div>
            </div>
          </div>
        </div>
        <div class="bank-trend-scroll">
          <div class="bank-trend-scroll-inner">
            <canvas id="trendChart" height="200"></canvas>
          </div>
        </div>
      </div>

      <div class="chart-card bank-side-list-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Companies</div></div>
        <div class="compact-entity-summary">
          <div class="compact-entity-donut-inline"><canvas id="companyDonutChartCompact"></canvas></div>
          <div class="compact-entity-summary-left">
            <div class="compact-entity-kicker">Company Split</div>
            <div class="compact-entity-total">${fmt(totalCompVol)}</div>
            <div class="compact-entity-submeta">${compVolLabels.length || 0} companies</div>
            ${compVolLabels[0]
              ? (() => {
                  const topPercent = (compVolMap[compVolLabels[0]] / (totalCompVol || 1)) * 100;
                  const topShare = topPercent.toFixed(2);
                  return `<div class="compact-entity-topline"><span class="region-donut-dot" style="background:${getCompanyColor(compVolLabels[0],'primary') || BAR_COLORS[0]}"></span>${compVolLabels[0]} leads with ${topShare}%</div>`;
                })()
              : '<div class="compact-entity-topline">No company data available</div>'}
          </div>
        </div>
        <div class="compact-entity-list">
          ${compVolLabels.length
            ? compVolLabels.map((company, i) => {
                const share = ((compVolMap[company] / (totalCompVol || 1)) * 100).toFixed(2);
                const color = getCompanyColor(company,'primary') || BAR_COLORS[i % BAR_COLORS.length];
                const encodedCompany = encodeURIComponent(company);
                const isActiveCompany = state.filters.company === company;
                return `<div class="compact-entity-item" style="cursor:pointer;${isActiveCompany ? 'border-color:var(--blue);background:rgba(59,130,246,0.08);' : ''}" onclick="setDashboardCompanyFilter('${encodedCompany}')" title="Filter by ${company}">
                  <div class="compact-entity-main">
                    <span class="region-donut-dot" style="background:${color}"></span>
                    <div>
                      <div class="compact-entity-name">${company}</div>
                    </div>
                  </div>
                  <div class="compact-entity-stats">
                    <div class="compact-entity-volume">${fmt(compVolMap[company])}</div>
                    <div class="compact-entity-share">${share}%</div>
                  </div>
                </div>`;
              }).join('')
            : '<div class="region-donut-empty">No company transactions in the current view.</div>'}
        </div>
      </div>

      <div class="chart-card bank-side-list-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Region</div></div>
        <div class="compact-entity-summary">
          <div class="compact-entity-donut-inline"><canvas id="regionDonutChartCompact"></canvas></div>
          <div class="compact-entity-summary-left">
            <div class="compact-entity-kicker">Region Split</div>
            <div class="compact-entity-total">${fmt(totalRegionVol)}</div>
            <div class="compact-entity-submeta">${regionLabels.length || 0} regions</div>
            ${regionLabels[0]
              ? (() => {
                  const topPercent = (regionMap[regionLabels[0]] / (totalRegionVol || 1)) * 100;
                  const topShare = topPercent.toFixed(2);
                  return `<div class="compact-entity-topline"><span class="region-donut-dot" style="background:${regionColors[0]}"></span>${regionLabels[0]} leads with ${topShare}%</div>`;
                })()
              : '<div class="compact-entity-topline">No regional data available</div>'}
          </div>
        </div>
        <div class="compact-entity-list">
          ${regionLabels.length
            ? regionLabels.map((region, i) => {
                const share = ((regionMap[region] / (totalRegionVol || 1)) * 100).toFixed(2);
                const encodedRegion = encodeURIComponent(region);
                const isActiveRegion = state.filters.region === region;
                return `<div class="compact-entity-item" style="cursor:pointer;${isActiveRegion ? 'border-color:var(--blue);background:rgba(59,130,246,0.08);' : ''}" onclick="setDashboardRegionFilter('${encodedRegion}')" title="Filter by ${region}">
                  <div class="compact-entity-main">
                    <span class="region-donut-dot" style="background:${regionColors[i % regionColors.length]}"></span>
                    <div>
                      <div class="compact-entity-name">${region}</div>
                    </div>
                  </div>
                  <div class="compact-entity-stats">
                    <div class="compact-entity-volume">${fmt(regionMap[region])}</div>
                    <div class="compact-entity-share">${share}%</div>
                  </div>
                </div>`;
              }).join('')
            : '<div class="region-donut-empty">No regional transactions in the current view.</div>'}
        </div>
      </div>

    </div>
    ` : `
    <div class="chart-card" style="margin-bottom:18px">
      <div class="chart-card-header">
        <div>
          <div class="chart-title">Transaction Graph</div>
          <div class="chart-subtitle">${state.filters.chartGranularity[0].toUpperCase() + state.filters.chartGranularity.slice(1) + ' credit &amp; debit trend'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end">
          <select class="form-select" style="min-width:120px;height:34px;padding:6px 28px 6px 10px;font-size:12px" onchange="setChartGranularity(this.value)">
            <option value="daily" ${state.filters.chartGranularity==='daily'?'selected':''}>Daily</option>
            <option value="weekly" ${state.filters.chartGranularity==='weekly'?'selected':''}>Weekly</option>
            <option value="monthly" ${state.filters.chartGranularity==='monthly'?'selected':''}>Monthly</option>
          </select>
          <div class="chart-legend">
          <div class="legend-item"><div class="legend-dot" style="background:var(--blue)"></div>Spending</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Debit</div>
          </div>
        </div>
      </div>
      <canvas id="trendChart" height="55"></canvas>
    </div>
    `}


    <!-- PANEL 3: Bank Detail -->
    <div class="${isBankDashboardType ? 'dashboard-bank-grid-bank-mode' : (isMerchantType || isCreditType || isBankDashboardType || showMerchantCompanyDonut || showCreditCompanyDonut || showBankCompanyDonut || !isMerchantType ? 'dashboard-bank-grid' : 'dashboard-bank-grid-2col')}">
      ${(showMerchantCompanyDonut || showCreditCompanyDonut || showBankCompanyDonut) ? `<div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Companies</div></div>
        <div class="region-donut-shell">
          <div class="region-donut-visual">
            <div class="region-donut-canvas"><canvas id="companyDonutChart"></canvas></div>
            <div class="region-donut-summary">
              <div class="region-donut-kicker">Company Split</div>
              <div class="region-donut-meta">${compVolLabels.length || 0} companies</div>
              ${compVolLabels[0]
                ? (() => {
                    const topPercent = (compVolMap[compVolLabels[0]] / (totalCompVol || 1)) * 100;
                    const topShare = topPercent.toFixed(2);
                    return `<div class="region-donut-topline"><span class="region-donut-dot" style="background:${getCompanyColor(compVolLabels[0],'primary') || BAR_COLORS[0]}"></span>${compVolLabels[0]} leads with ${topShare}%</div>`;
                  })()
                : '<div class="region-donut-topline">No company data available</div>'}
            </div>
          </div>
          ${isBankDashboardType ? '' : `
          <div class="region-donut-list">
            ${compVolLabels.length
              ? compVolLabels.map((company, i) => {
                  const sharePercent = (compVolMap[company] / (totalCompVol || 1)) * 100;
                  const share = sharePercent.toFixed(2);
                  const color = getCompanyColor(company,'primary') || BAR_COLORS[i % BAR_COLORS.length];
                  const encodedCompany = encodeURIComponent(company);
                  const isActiveCompany = state.filters.company === company;
                  return `<div class="region-donut-item">
                    <div class="region-donut-item-main" style="cursor:pointer" onclick="setDashboardCompanyFilter('${encodedCompany}')" title="Filter by ${company}">
                      <span class="region-donut-dot" style="background:${color}"></span>
                      <div>
                        <div class="region-donut-item-name" style="${isActiveCompany ? 'text-decoration:underline;' : ''}">${company}</div>
                        <div class="region-donut-item-share">${share}% of total volume</div>
                      </div>
                    </div>
                    <div class="region-donut-item-stats">
                      <div class="region-donut-item-volume">${fmt(compVolMap[company])}</div>
                    </div>
                  </div>`;
                }).join('')
              : '<div class="region-donut-empty">No company transactions in the current view.</div>'}
          </div>
          `}
        </div>
      </div>` : ''}
      ${isMerchantType || isCreditType ? `<div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Region</div></div>
        <div class="region-donut-shell">
          <div class="region-donut-visual">
            <div class="region-donut-canvas"><canvas id="regionDonutChart"></canvas></div>
            <div class="region-donut-summary">
              <div class="region-donut-kicker">Region Split</div>
              <div class="region-donut-volume">${fmt(totalRegionVol)}</div>
              <div class="region-donut-meta">${regionLabels.length || 0} regions</div>
              ${regionLabels[0]
                ? (() => {
                    const topPercent = (regionMap[regionLabels[0]] / (totalRegionVol || 1)) * 100;
                    const topShare = topPercent.toFixed(2);
                    return `<div class="region-donut-topline"><span class="region-donut-dot" style="background:${regionColors[0]}"></span>${regionLabels[0]} leads with ${topShare}%</div>`;
                  })()
                : '<div class="region-donut-topline">No regional data available</div>'}
            </div>
          </div>
          ${isBankDashboardType ? '' : `
          <div class="region-donut-list">
            ${regionLabels.length
              ? regionLabels.map((region, i) => {
                  const share = ((regionMap[region] / (totalRegionVol || 1)) * 100).toFixed(2);
                  const encodedRegion = encodeURIComponent(region);
                  const isActiveRegion = state.filters.region === region;
                  return `<div class="region-donut-item">
                    <div class="region-donut-item-main" style="cursor:pointer" onclick="setDashboardRegionFilter('${encodedRegion}')" title="Filter by ${region}">
                      <span class="region-donut-dot" style="background:${regionColors[i % regionColors.length]}"></span>
                      <div>
                        <div class="region-donut-item-name" style="${isActiveRegion ? 'text-decoration:underline;' : ''}">${region}</div>
                        <div class="region-donut-item-share">${share}% of total volume</div>
                      </div>
                    </div>
                    <div class="region-donut-item-stats">
                      <div class="region-donut-item-volume">${fmt(regionMap[region])}</div>
                    </div>
                  </div>`;
                }).join('')
              : '<div class="region-donut-empty">No regional transactions in the current view.</div>'}
          </div>
          `}
        </div>
      </div>` : ''}
        ${isMerchantType || isCreditType || isBankDashboardType ? '' : state.filters.company !== 'All'
          ? `<div class="chart-card">
          <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Reference</div></div>
          <div class="mini-table-scroll"><table>
            <thead><tr><th style="${thS}">Reference</th><th style="${thR}">Volume</th></tr></thead>
            <tbody>${miniRows(referenceVolLabels, referenceVolMap, totalReferenceVol, (_,i) => BAR_COLORS[i%BAR_COLORS.length], item => t => ((t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference')===item)}</tbody>
          </table></div>
        </div>`
          : `<div class="chart-card">
          <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Company Detail</div></div>
          <div class="mini-table-scroll"><table>
            <thead><tr><th style="${thS}">Company</th><th style="${thR}">Volume</th></tr></thead>
            <tbody>${miniRows(compVolLabels, compVolMap, totalCompVol, (c,i) => getCompanyColor(c,'primary') || BAR_COLORS[i%BAR_COLORS.length], item => t => (t.company||'Unknown')===item)}</tbody>
          </table></div>
        </div>`}
      ${isMerchantType || isCreditType ? '' : isBankDashboardType ? `<div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Bank</div></div>
        <div class="mini-table-scroll bank-table-scroll"><table>
          <thead><tr><th style="${thS}">Bank</th><th style="${thS}">Bank Account No.</th><th style="${thS}">Company Name</th><th style="${thR}">Opening</th><th style="${thR}">Inflow</th><th style="${thR}">Outflow</th><th style="${thR}">Closing</th><th style="${thS}">Last Updated</th></tr></thead>
            <tbody>${bankDetailRows.map((row, i) => {
            const color = BAR_COLORS[i % BAR_COLORS.length];
            const encodedBank = encodeURIComponent(row.bankName);
            const encodedAccount = encodeURIComponent(row.accountNumber);
            const isActiveBankRow = state.filters.bank === row.bankName && state.filters.account === row.accountNumber;
            const rowBg = isActiveBankRow ? 'background:rgba(59,130,246,0.08);' : '';
            const openingText = row.opening == null ? '—' : fmt(row.opening);
            const closingText = row.closing == null ? '—' : fmt(row.closing);
            return '<tr>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')" title="Filter by ' + row.bankName + ' / ' + row.accountNumber + '">'
              + '<div style="display:flex;align-items:center;gap:7px"><span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;display:inline-block"></span><span style="font-weight:700">' + row.bankName + '</span></div>'
              + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);color:var(--text2);font-weight:600;font-size:12px;cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')">' + row.accountNumber + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px;cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')">' + row.companyName + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px;cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')">' + openingText + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px;color:var(--green);cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')">' + fmt(row.inflow) + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px;color:var(--red);cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')">' + fmt(row.outflow) + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px;cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')">' + closingText + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text2);cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')">' + row.lastUpdatedLabel + '</td>'
              + '</tr>';
          }).join('')}</tbody>
        </table></div>
      </div>` : `<div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Bank Detail</div></div>
        <div class="mini-table-scroll bank-table-scroll"><table>
          <thead><tr><th style="${thS}">Bank</th><th style="${thS}">Bank Account No.</th><th style="${thS}">Company Name</th><th style="${thR}">Opening</th><th style="${thR}">Inflow</th><th style="${thR}">Outflow</th><th style="${thR}">Closing</th><th style="${thS}">Last Updated</th></tr></thead>
            <tbody>${bankDetailRows.map((row, i) => {
            const color = BAR_COLORS[i % BAR_COLORS.length];
            const openingText = row.opening == null ? '—' : fmt(row.opening);
            const closingText = row.closing == null ? '—' : fmt(row.closing);
            return '<tr>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border)">'
              + '<div style="display:flex;align-items:center;gap:7px"><span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;display:inline-block"></span><span style="font-weight:700">' + row.bankName + '</span></div>'
              + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);color:var(--text2);font-weight:600;font-size:12px">' + row.accountNumber + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px">' + row.companyName + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px">' + openingText + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px;color:var(--green)">' + fmt(row.inflow) + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px;color:var(--red)">' + fmt(row.outflow) + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);text-align:right;font-weight:700;font-size:12px">' + closingText + '</td>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text2)">' + row.lastUpdatedLabel + '</td>'
              + '</tr>';
          }).join('')}</tbody>
        </table></div>
      </div>`}
    </div>

    ${(isCreditType || isBankDashboardType) ? `
    <div class="analysis-grid">
      <div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:8px">
          <div class="chart-title">${isBankDashboardType ? 'Inter Division' : 'Category Wise Spending'}</div>
        </div>
        <div class="chart-canvas-tall"><canvas id="${isBankDashboardType ? 'bankInterDivisionChart' : 'creditCategoryChart'}"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:8px">
          <div class="chart-title">Reference Spending</div>
        </div>
        <div class="chart-canvas-tall"><canvas id="${isBankDashboardType ? 'bankReferenceChart' : 'creditReferenceChart'}"></canvas></div>
      </div>
    </div>
    ` : ''}

    <!-- PANEL 4: Recent Transactions -->
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Recent Transactions</div>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="navigate('transactions')">View All</button>
          ${isCreditType ? '' : `<button class="btn btn-primary btn-sm" onclick="openModal('addTxnModal')">+ Add</button>`}
        </div>
      </div>
      ${renderTableHTML(isCreditType ? creditTxns.slice(0,8) : txns.slice(0,8))}
    </div>
  `;

  renderCompanyChips();
  setTimeout(() => {
    if (isMerchantType) {
      buildRevenueChart();
    } else if (isCreditType) {
      buildCreditTrendChart();
      buildCreditCategorySpendingChart();
      buildCreditReferenceSpendingChart();
    } else if (isBankDashboardType) {
      buildTrendChart(false);
      buildBankInterDivisionSpendingChart();
      buildBankReferenceSpendingChart();
    } else {
      buildTrendChart(false);
    }
    if (showMerchantCompanyDonut || showCreditCompanyDonut || showBankCompanyDonut) buildCompanyDonutChart();
    if (isMerchantType || isCreditType || isBankDashboardType) buildRegionDonutChart();
    if (!isMerchantType) buildInterDivisionChart();
    if (!isMerchantType) buildFinancialStackChart();
  }, 50);
}
function setChartGranularity(granularity) {
  state.filters.chartGranularity = granularity;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}
function clearDashboardDateFilters() {
  state.filters.dateFrom = '';
  state.filters.dateTo = '';
  state.filters.people = 'All';
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function setCreditAmountMode(mode) {
  const next = (state.filters.creditAmountMode === mode) ? 'all' : mode;
  state.filters.creditAmountMode = next;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function setBankCashMode(mode) {
  const next = (state.filters.bankCashMode === mode) ? 'all' : mode;
  state.filters.bankCashMode = next;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function clearDashboardQuickFilters() {
  state.filters.company = 'All';
  state.filters.region = 'All';
  state.filters.bank = 'All';
  state.filters.account = 'All';
  state.filters.creditCategory = 'All';
  state.filters.creditReference = 'All';
  state.filters.bankInterDivision = 'All';
  state.filters.bankReference = 'All';
}

function setDashboardCompanyFilter(encodedCompany) {
  const company = decodeURIComponent(encodedCompany || '');
  const isSame = state.filters.company === company;
  clearDashboardQuickFilters();
  state.filters.parentCompany = 'All';
  state.filters.company = isSame ? 'All' : company;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function setDashboardRegionFilter(encodedRegion) {
  const region = decodeURIComponent(encodedRegion || '');
  const isSame = state.filters.region === region;
  clearDashboardQuickFilters();
  state.filters.parentCompany = 'All';
  state.filters.region = isSame ? 'All' : region;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function setDashboardBankFilter(encodedBank, encodedAccount) {
  const bank = decodeURIComponent(encodedBank || '');
  const account = decodeURIComponent(encodedAccount || '');
  const isSame = state.filters.bank === bank && state.filters.account === account;
  clearDashboardQuickFilters();
  state.filters.parentCompany = 'All';
  if (!isSame) {
    state.filters.bank = bank;
    state.filters.account = account;
  }
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function setDashboardCategoryFilter(category) {
  const key = String(category || '').trim() || 'Uncategorized';
  const isSame = state.filters.creditCategory === key;
  clearDashboardQuickFilters();
  state.filters.parentCompany = 'All';
  state.filters.creditCategory = isSame ? 'All' : key;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function setDashboardReferenceFilter(reference) {
  const key = String(reference || '').trim() || 'No Reference';
  const isSame = state.filters.creditReference === key;
  clearDashboardQuickFilters();
  state.filters.parentCompany = 'All';
  state.filters.creditReference = isSame ? 'All' : key;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function setDashboardInterDivisionFilter(value) {
  const key = String(value || '').trim() || 'Unassigned';
  const isSame = state.filters.bankInterDivision === key;
  clearDashboardQuickFilters();
  state.filters.parentCompany = 'All';
  state.filters.bankInterDivision = isSame ? 'All' : key;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function setDashboardBankReferenceFilter(value) {
  const key = String(value || '').trim() || 'No Reference';
  const isSame = state.filters.bankReference === key;
  clearDashboardQuickFilters();
  state.filters.parentCompany = 'All';
  state.filters.bankReference = isSame ? 'All' : key;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}