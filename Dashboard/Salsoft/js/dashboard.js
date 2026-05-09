// ============================================================
// USD-FIRST VALUE HELPERS
// Use USD column when available, fall back to original currency.
// ============================================================
function $usdAmt(t)     { return t.amount_usd        != null ? +t.amount_usd        : (+t.amount     || 0); }
function $usdNetAmt(t)  { return t.net_amount_usd     != null ? +t.net_amount_usd     : (+t.net_amount  || 0); }
function $usdFee(t)     { return t.fee_usd            != null ? +t.fee_usd            : (+t.fee         || 0); }
function $usdVat(t)     { return t.vat_usd            != null ? +t.vat_usd            : (+t.vat         || 0); }
function $usdBalance(t) { return t.balance_usd != null ? +t.balance_usd : (t.balance != null ? +t.balance : null); }

// ============================================================
// PORTFOLIO BALANCE HELPERS
// ============================================================
function computePortfolioBalances() {
  const dateFrom = state.filters.dateFrom;
  const dateTo   = state.filters.dateTo;
  const fc    = state.filters.company;
  const fp    = state.filters.parentCompany || 'All';
  const fbt   = state.filters.bankType || 'All';
  const fpeople = state.filters.people || 'All';
  const fr    = state.filters.region || 'All';
  const fb    = state.filters.bank || 'All';
  const fa    = state.filters.account || 'All';
  const fcur  = state.filters.currency || 'All';
  const normBT = (v) => String(v || '').trim().toLowerCase().replace(/s$/, '');

  const allRelevant = state.transactions.filter(t => {
    if (fc !== 'All' && t.company !== fc) return false;
    if (fp !== 'All') { const subs = getCompaniesForParent(fp); if (!subs.includes(t.company)) return false; }
    if (fbt !== 'All' && normBT(t.bankType) !== normBT(fbt)) return false;
    if (fpeople !== 'All' && String(t.people || '').trim() !== fpeople) return false;
    if (fr !== 'All' && (state.companyRegions[t.company] || 'Other') !== fr) return false;
    if (fb !== 'All' && String(t.bank || '').trim() !== fb) return false;
    if (fa !== 'All' && ((t.accountNumber || '').trim() || 'No account') !== fa) return false;
    if (fcur !== 'All' && String(t.currency || '').trim() !== fcur) return false;
    return true;
  });

  const accountTxns = {};
  allRelevant.forEach(t => {
    const key = (t.bank || 'Unknown') + '||' + ((t.accountNumber || '').trim() || 'No account');
    if (!accountTxns[key]) accountTxns[key] = [];
    accountTxns[key].push(t);
  });

  let totalOpening = 0, openingCount = 0;
  let totalClosing = 0, closingCount = 0;

  Object.values(accountTxns).forEach(acctTxns => {
    const sorted = [...acctTxns].sort((a, b) => String(a.date || '') < String(b.date || '') ? -1 : 1);

    // Opening: balance of last transaction before dateFrom (balance at period start)
    let openingVal = null;
    if (dateFrom) {
      const before = sorted.filter(t => t.date && t.date < dateFrom);
      if (before.length > 0) openingVal = $usdBalance(before[before.length - 1]);
      if (openingVal == null) {
        const onStart = sorted.filter(t => t.date === dateFrom);
        if (onStart.length > 0) openingVal = $usdBalance(onStart[0]);
      }
      if (openingVal == null) {
        const first = sorted.find(t => $usdBalance(t) != null);
        if (first) openingVal = $usdBalance(first);
      }
    } else {
      const first = sorted.find(t => $usdBalance(t) != null);
      if (first) openingVal = $usdBalance(first);
    }
    if (openingVal != null && !isNaN(openingVal)) { totalOpening += openingVal; openingCount++; }

    // Closing: balance of last transaction on or before dateTo
    let closingVal = null;
    if (dateTo) {
      const onOrBefore = sorted.filter(t => t.date && t.date <= dateTo);
      if (onOrBefore.length > 0) closingVal = $usdBalance(onOrBefore[onOrBefore.length - 1]);
    } else {
      const rev = [...sorted].reverse();
      const last = rev.find(t => $usdBalance(t) != null);
      if (last) closingVal = $usdBalance(last);
    }
    if (closingVal != null && !isNaN(closingVal)) { totalClosing += closingVal; closingCount++; }
  });

  return {
    opening: openingCount > 0 ? totalOpening : null,
    closing: closingCount > 0 ? totalClosing : null
  };
}

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
  const credits = txns.filter(t=>$usdAmt(t)>0).reduce((s,t)=>s+$usdAmt(t),0);
  const debits  = txns.filter(t=>$usdAmt(t)<0).reduce((s,t)=>s+Math.abs($usdAmt(t)),0);
  const balance = credits - debits;
  updateSidebarBalances(balance, credits, debits);

  // displayOpeningBalance / displayClosingBalance computed after bankDetailRows below

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
      const amt = $usdAmt(t);
      return amt > 0 ? sum + amt : sum;
    }, 0);
    const personDebit = personTxns.reduce((sum, t) => {
      const amt = $usdAmt(t);
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

  const bCashMode = state.filters.bankCashMode || 'all';

  // analyticsTxns already filtered by credit/debit via getFilteredTxns().
  // For opening/closing modes txns = all transactions (getFilteredTxns doesn't filter them).
  const analyticsTxns = txns;

  // analyticsValue returns the field that matches the active mode so entity panels
  // (Companies, Region, People, etc.) always reflect what the SVG card filter shows.
  const analyticsValue = (t) => {
    if (isMerchantType) return $usdNetAmt(t);
    if (bCashMode === 'opening') return Math.abs($usdBalance(t) || 0);
    if (bCashMode === 'closing') return Math.abs($usdBalance(t) || 0);
    if (bCashMode === 'net') return Math.abs($usdBalance(t) || 0);
    return Math.abs($usdAmt(t));
  };

  const compVolMap = {};
  analyticsTxns.forEach(t => { const c = t.company || 'Unknown'; compVolMap[c] = (compVolMap[c] || 0) + analyticsValue(t); });
  const compVolLabels = Object.keys(compVolMap).sort((a, b) => compVolMap[b] - compVolMap[a]);
  const totalCompVol = compVolLabels.reduce((s, c) => s + compVolMap[c], 0);
  // Net per company (signed): sum = credits − debits = Net Cash Flow → consistent with SVG card
  const compNetMap = {};
  analyticsTxns.forEach(t => { const c = t.company || 'Unknown'; compNetMap[c] = (compNetMap[c] || 0) + $usdAmt(t); });
  const totalCompNet = credits - debits;
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
    const amount = $usdAmt(t);
    const dateRaw = t.date || t.date_2 || '';
    const dateObj = dateRaw ? new Date(dateRaw) : null;
    const dateTs = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.getTime() : null;
    const balanceValue = $usdBalance(t);
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
    if (balanceValue != null && dateTs != null && (entry.openingTs == null || dateTs < entry.openingTs)) {
      entry.opening = balanceValue;
      entry.openingTs = dateTs;
    }
    if (balanceValue != null && dateTs != null && (entry.closingTs == null || dateTs > entry.closingTs)) {
      entry.closing = balanceValue;
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

  // Portfolio balances: Opening = sum of per-account balance AS OF start date (USD).
  //                    Closing = sum of per-account LAST entry balance AS OF end date (USD).
  const _portfolio = computePortfolioBalances();
  const displayOpeningBalance = _portfolio.opening;
  const displayClosingBalance = _portfolio.closing;

  const regionMap = {};
  analyticsTxns.forEach(t => { const r = state.companyRegions[t.company] || 'Other'; regionMap[r] = (regionMap[r] || 0) + analyticsValue(t); });
  const regionLabels = Object.keys(regionMap).sort((a, b) => regionMap[b] - regionMap[a]);
  const totalRegionVol = regionLabels.reduce((s, r) => s + regionMap[r], 0);
  // Net per region (signed): sum = Net Cash Flow → consistent with SVG card
  const regionNetMap = {};
  analyticsTxns.forEach(t => { const r = state.companyRegions[t.company] || 'Other'; regionNetMap[r] = (regionNetMap[r] || 0) + $usdAmt(t); });
  const totalRegionNet = credits - debits;

  // Per-company / per-region balance maps for Opening/Closing card modes
  const isBalanceMode = bCashMode === 'opening' || bCashMode === 'closing';
  const compBalMap = {};
  const regionBalMap = {};
  if (isBalanceMode) {
    const acctFirstLast = {};
    analyticsTxns.forEach(t => {
      const company = (t.company || 'Unknown').trim();
      const account = ((t.accountNumber || '').trim()) || '_';
      const key = company + '||' + account;
      const bal = $usdBalance(t);
      if (bal == null) return;
      const dateStr = t.date || '';
      if (!acctFirstLast[key]) {
        acctFirstLast[key] = { company, region: state.companyRegions[company] || 'Other', opening: null, closing: null, minDate: '', maxDate: '' };
      }
      const g = acctFirstLast[key];
      if (!g.minDate || dateStr < g.minDate) { g.minDate = dateStr; g.opening = bal; }
      if (!g.maxDate || dateStr > g.maxDate) { g.maxDate = dateStr; g.closing = bal; }
    });
    Object.values(acctFirstLast).forEach(g => {
      const val = Math.abs(bCashMode === 'opening' ? (g.opening || 0) : (g.closing || 0));
      if (val > 0) {
        compBalMap[g.company] = (compBalMap[g.company] || 0) + val;
        regionBalMap[g.region] = (regionBalMap[g.region] || 0) + val;
      }
    });
  }
  // Unified display maps — switch between balance and net modes
  const compDisplayMap    = isBalanceMode ? compBalMap : compNetMap;
  const compDisplayLabels = isBalanceMode
    ? Object.keys(compBalMap).sort((a, b) => compBalMap[b] - compBalMap[a])
    : compVolLabels;
  const totalCompDisplay  = compDisplayLabels.reduce((s, c) => s + Math.abs(compDisplayMap[c] || 0), 0);
  const regionDisplayMap    = isBalanceMode ? regionBalMap : regionNetMap;
  const regionDisplayLabels = isBalanceMode
    ? Object.keys(regionBalMap).sort((a, b) => regionBalMap[b] - regionBalMap[a])
    : regionLabels;
  const totalRegionDisplay  = regionDisplayLabels.reduce((s, r) => s + Math.abs(regionDisplayMap[r] || 0), 0);
  const entityModeLabel = isBalanceMode ? (bCashMode === 'opening' ? 'Opening Balance' : 'Closing Balance') : 'Net Cash Flow';

  // People: raw credit+debit map for sorting (always by total, ignoring mode)
  const peopleCDMap = {};
  txns.forEach(t => {
    const pName = String(t.people || '').trim();
    if (pName && pName !== 'Unassigned') peopleCDMap[pName] = (peopleCDMap[pName] || 0) + Math.abs($usdAmt(t));
  });
  // People volume map respects current analyticsValue mode (for subtitle total)
  const peopleVolMap = {};
  analyticsTxns.forEach(t => {
    const pName = String(t.people || '').trim() || 'Unassigned';
    peopleVolMap[pName] = (peopleVolMap[pName] || 0) + analyticsValue(t);
  });
  // Sort by raw credit+debit (largest → smallest), regardless of active SVG card mode
  const peopleVolLabels = Object.keys(peopleCDMap).sort((a, b) => peopleCDMap[b] - peopleCDMap[a]);
  const totalPeopleVol = peopleVolLabels.reduce((s, p) => s + (peopleVolMap[p] || 0), 0);

  // Active filter name for chart subtitles
  const activeFilterLabel = state.filters.company !== 'All' ? state.filters.company
    : state.filters.region !== 'All' ? state.filters.region
    : state.filters.bank !== 'All' ? state.filters.bank
    : state.filters.people !== 'All' ? state.filters.people
    : null;
  const cashModeLabel = bCashMode === 'credit' ? 'Credit'
    : bCashMode === 'debit' ? 'Debit'
    : bCashMode === 'opening' ? 'Opening Balance'
    : bCashMode === 'closing' ? 'Closing Balance'
    : bCashMode === 'net' ? 'Net Cash Flow'
    : '';
  const panelFilterSuffix = [activeFilterLabel, cashModeLabel].filter(Boolean).join(' · ');
  const trendSubtitle = (bCashMode === 'opening' || bCashMode === 'closing')
    ? 'Opening and Closing'
    : bCashMode === 'net'
    ? 'Credit, Debit and Net Cash Flow'
    : 'Credit and Debit';

  // Inter Division Transactions table — fully dynamic sub-columns from interDivision field
  const _idInflowCats = new Set();
  const _idOutflowCats = new Set();
  const compIDMap = {};
  txns.forEach(t => {
    const comp   = (t.company || 'Unknown').trim();
    const intDiv = (t.interDivision || '').trim();
    const amt    = $usdAmt(t);
    if (!compIDMap[comp]) compIDMap[comp] = { inflow: {}, outflow: {}, totalIn: 0, totalOut: 0 };
    const b = compIDMap[comp];
    if (amt > 0) {
      b.totalIn += amt;
      if (intDiv) { _idInflowCats.add(intDiv); b.inflow[intDiv] = (b.inflow[intDiv] || 0) + amt; }
    } else if (amt < 0) {
      const abs = Math.abs(amt);
      b.totalOut += abs;
      if (intDiv) { _idOutflowCats.add(intDiv); b.outflow[intDiv] = (b.outflow[intDiv] || 0) + abs; }
    }
  });
  const idInflowCats  = [..._idInflowCats].sort();
  const idOutflowCats = [..._idOutflowCats].sort();
  const bankIDRows = Object.entries(compIDMap)
    .map(([comp, d]) => ({ company: comp, inflow: d.inflow, outflow: d.outflow, totalIn: d.totalIn, totalOut: d.totalOut, net: d.totalIn - d.totalOut }))
    .sort((a, b) => b.net - a.net);

  // Legacy interDivisionMap still used for non-bank chart path
  const interDivisionMap = {};
  txns.forEach(t => {
    const interDivision = (t.interDivision || '').trim() || 'Unassigned';
    interDivisionMap[interDivision] = (interDivisionMap[interDivision] || 0) + Math.abs($usdAmt(t));
  });
  const interDivisionLabels = Object.keys(interDivisionMap).sort((a, b) => interDivisionMap[b] - interDivisionMap[a]).slice(0, 8);
  const statusCountMap = {};
  txns.forEach(t => {
    const status = (t.status || 'Unknown').trim() || 'Unknown';
    statusCountMap[status] = (statusCountMap[status] || 0) + 1;
  });
  const financialTotals = txns.reduce((totals, txn) => {
    totals.net += Math.abs($usdNetAmt(txn));
    totals.fee += Math.abs($usdFee(txn));
    totals.vat += Math.abs($usdVat(txn));
    return totals;
  }, { net: 0, fee: 0, vat: 0 });
  const thS = 'text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--text2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;background:var(--surface2)';
  const thR = 'text-align:right;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--text2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;background:var(--surface2)';

  // Credit card specific metrics
  const creditIncomeTxns = txns.filter(t => $usdAmt(t) > 0);
  const creditSpendingTxns = txns.filter(t => $usdAmt(t) < 0);
  const creditTxns = txns.filter(t => $usdAmt(t) !== 0);
  const totalIncome = creditIncomeTxns.reduce((s, t) => s + $usdAmt(t), 0);
  const totalSpending = creditSpendingTxns.reduce((s, t) => s + Math.abs($usdAmt(t)), 0);
  const avgTxn = creditTxns.length ? creditTxns.reduce((s, t) => s + Math.abs($usdAmt(t)), 0) / creditTxns.length : 0;
  const highestTxn = creditTxns.length ? Math.max(...creditTxns.map(t => Math.abs($usdAmt(t)))) : 0;
  const showCreditCompanyDonut = isCreditType;
  const showMerchantCompanyDonut = isMerchantType;
  const showBankCompanyDonut = isBankDashboardType;

  const creditCompanyMap = {};
  creditTxns.forEach(t => {
    const company = (t.company || 'Unknown').trim() || 'Unknown';
    creditCompanyMap[company] = (creditCompanyMap[company] || 0) + $usdAmt(t);
  });
  const creditCompanyLabels = Object.keys(creditCompanyMap).sort((a, b) => creditCompanyMap[b] - creditCompanyMap[a]);
  const totalCreditCompanyVol = creditCompanyLabels.reduce((sum, key) => sum + creditCompanyMap[key], 0);

  // Merchant spending (reference-based for credit)
  const merchantMap = {};
  creditTxns.forEach(t => {
    const merchant = (t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference';
    merchantMap[merchant] = (merchantMap[merchant] || 0) + $usdAmt(t);
  });
  const merchantLabels = Object.keys(merchantMap).sort((a, b) => merchantMap[b] - merchantMap[a]);
  const totalMerchantVol = merchantLabels.reduce((s, k) => s + merchantMap[k], 0);

  // Category wise spending (credit) - DEPRECATED, replaced with status
  const categoryMap = {};
  creditTxns.forEach(t => {
    const cat = (t.category || 'Uncategorized').trim() || 'Uncategorized';
    categoryMap[cat] = (categoryMap[cat] || 0) + $usdAmt(t);
  });
  const categoryLabels = Object.keys(categoryMap).sort((a, b) => categoryMap[b] - categoryMap[a]);
  const totalCategoryVol = categoryLabels.reduce((s, k) => s + categoryMap[k], 0);

  // Status wise spending (credit) - replaces category
  const statusMap = {};
  creditTxns.forEach(t => {
    const status = (t.status || 'Unknown').trim() || 'Unknown';
    statusMap[status] = (statusMap[status] || 0) + $usdAmt(t);
  });
  const statusLabels = Object.keys(statusMap).sort((a, b) => statusMap[b] - statusMap[a]);
  const totalStatusVol = statusLabels.reduce((s, k) => s + statusMap[k], 0);

  // Credit-specific totals
  const creditFinancialTotals = creditTxns.reduce((totals, txn) => {
    totals.net += Math.abs($usdNetAmt(txn));
    totals.fee += Math.abs($usdFee(txn));
    totals.vat += Math.abs($usdVat(txn));
    return totals;
  }, { net: 0, fee: 0, vat: 0 });
  const merchantTotalAmount = txns.reduce((sum, txn) => sum + $usdAmt(txn), 0);
  const merchantTotalNetAmount = txns.reduce((sum, txn) => sum + $usdNetAmt(txn), 0);
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
        <span class="filter-label">Category</span>
        ${['Bank', 'Credit Card', 'Merchant'].map(type => `<button class="dashboard-filter-chip ${state.filters.bankType===type?'active':''}" onclick="applyFilter('bankType','${type}')">${type}</button>`).join('')}
      </div>
      <div class="filter-group">
        <span class="filter-label">From Date</span>
        <input type="text" id="dash-date-from" class="dash-fp-input" placeholder="Select date" readonly>
      </div>
      <div class="filter-group">
        <span class="filter-label">To Date</span>
        <input type="text" id="dash-date-to" class="dash-fp-input" placeholder="Select date" readonly>
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
            <div class="dashboard-number" style="color:var(--text)">${displayOpeningBalance != null ? fmt(displayOpeningBalance) : '$0'}</div>
          </div>
          <div class="dashboard-balance-box">
            <div class="dashboard-meta-label">Closing Balance</div>
            <div class="dashboard-number" style="color:var(--text2)">${displayClosingBalance != null ? fmt(displayClosingBalance) : '$0'}</div>
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

    ${isBankDashboardType ? (() => {
      // Use properly filtered & aggregated values — not just top bank
      const opening = displayOpeningBalance;
      const closing = displayClosingBalance;
      const netFlow = credits - debits;
      const openingText = opening != null ? fmt(opening) : '—';
      const closingText = closing != null ? fmt(closing) : '—';
      const creditText = fmt(credits);
      const debitText = fmt(debits);
      const netFlowText = fmt(netFlow);
      const creditActive  = bCashMode === 'credit';
      const debitActive   = bCashMode === 'debit';
      const openingActive = bCashMode === 'opening';
      const closingActive = bCashMode === 'closing';
      const netActive     = bCashMode === 'net';
      const filterLabel   = panelFilterSuffix || 'All Transactions';
      return `<svg width="100%" viewBox="0 0 1300 160" role="img" xmlns="http://www.w3.org/2000/svg" style="min-height: 140px;">
          <!-- Opening Balance -->
          <g transform="translate(10,10)" onclick="setBankCashMode('opening')" style="cursor:pointer">
            <rect width="250" height="140" rx="12" fill="${openingActive ? '#bfdbfe' : '#E8F4FD'}" stroke="#2196F3" stroke-width="${openingActive ? '2.5' : '1.5'}"/>
            <rect x="20" y="40" width="70" height="60" rx="6" fill="#2196F3" fill-opacity="0.15" stroke="#2196F3" stroke-width="1.5"/>
            <line x1="30" y1="56" x2="80" y2="56" stroke="#2196F3" stroke-width="2" stroke-linecap="round"/>
            <line x1="30" y1="68" x2="68" y2="68" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="30" y1="80" x2="73" y2="80" stroke="#2196F3" stroke-width="1.5" stroke-linecap="round"/>
            <text x="100" y="52" text-anchor="start" fill="#2196F3" font-family="sans-serif" font-size="14" font-weight="700">Opening Balance</text>
            <text x="100" y="74" text-anchor="start" fill="#2196F3" font-family="sans-serif" font-size="16" font-weight="800">${openingText}</text>
            <text x="100" y="96" text-anchor="start" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="600">${filterLabel}</text>
            <text x="100" y="114" text-anchor="start" fill="${openingActive ? '#2196F3' : '#93c5fd'}" font-family="sans-serif" font-size="10">${openingActive ? '▶ Opening Balance view' : 'Click to filter'}</text>
          </g>

          <!-- Credit -->
          <g transform="translate(270,10)" onclick="setBankCashMode('credit')" style="cursor:pointer">
            <rect width="250" height="140" rx="12" fill="${creditActive ? '#bbf7d0' : '#E8F8EF'}" stroke="${creditActive ? '#16a34a' : '#4CAF50'}" stroke-width="${creditActive ? '2.5' : '1.5'}"/>
            <circle cx="55" cy="70" r="30" fill="#4CAF50" fill-opacity="0.15" stroke="#4CAF50" stroke-width="1.5"/>
            <line x1="55" y1="86" x2="55" y2="54" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="41" y1="75" x2="55" y2="54" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
            <line x1="69" y1="75" x2="55" y2="54" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
            <text x="100" y="48" text-anchor="start" font-family="sans-serif" font-size="14" font-weight="700" fill="#4CAF50">Credit</text>
            <text x="100" y="70" text-anchor="start" font-family="sans-serif" font-size="16" font-weight="800" fill="#4CAF50">${creditText}</text>
            <text x="100" y="92" text-anchor="start" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="600">${filterLabel}</text>
            <text x="100" y="114" text-anchor="start" font-family="sans-serif" font-size="10" fill="${creditActive ? '#16a34a' : '#6b7280'}">${creditActive ? '▶ Filtering credit only' : 'Click to filter'}</text>
          </g>

          <!-- Debit -->
          <g transform="translate(530,10)" onclick="setBankCashMode('debit')" style="cursor:pointer">
            <rect width="250" height="140" rx="12" fill="${debitActive ? '#fecaca' : '#FDECEA'}" stroke="${debitActive ? '#dc2626' : '#F44336'}" stroke-width="${debitActive ? '2.5' : '1.5'}"/>
            <circle cx="55" cy="70" r="30" fill="#F44336" fill-opacity="0.15" stroke="#F44336" stroke-width="1.5"/>
            <line x1="55" y1="54" x2="55" y2="86" stroke="#F44336" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="41" y1="67" x2="55" y2="86" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
            <line x1="69" y1="67" x2="55" y2="86" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
            <text x="100" y="48" text-anchor="start" font-family="sans-serif" font-size="14" font-weight="700" fill="#F44336">Debit</text>
            <text x="100" y="70" text-anchor="start" font-family="sans-serif" font-size="16" font-weight="800" fill="#F44336">${debitText}</text>
            <text x="100" y="92" text-anchor="start" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="600">${filterLabel}</text>
            <text x="100" y="114" text-anchor="start" font-family="sans-serif" font-size="10" fill="${debitActive ? '#dc2626' : '#6b7280'}">${debitActive ? '▶ Filtering debit only' : 'Click to filter'}</text>
          </g>

          <!-- Closing Balance -->
          <g transform="translate(790,10)" onclick="setBankCashMode('closing')" style="cursor:pointer">
            <rect width="250" height="140" rx="12" fill="${closingActive ? '#e9d5ff' : '#F3E5F5'}" stroke="#9C27B0" stroke-width="${closingActive ? '2.5' : '1.5'}"/>
            <rect x="15" y="40" width="70" height="60" rx="6" fill="#9C27B0" fill-opacity="0.13" stroke="#9C27B0" stroke-width="1.5"/>
            <line x1="25" y1="56" x2="75" y2="56" stroke="#9C27B0" stroke-width="2" stroke-linecap="round"/>
            <line x1="25" y1="68" x2="63" y2="68" stroke="#9C27B0" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="25" y1="80" x2="68" y2="80" stroke="#9C27B0" stroke-width="1.5" stroke-linecap="round"/>
            <text x="100" y="52" text-anchor="start" font-family="sans-serif" font-size="14" font-weight="700" fill="#9C27B0">Closing Balance</text>
            <text x="100" y="74" text-anchor="start" font-family="sans-serif" font-size="16" font-weight="800" fill="#9C27B0">${closingText}</text>
            <text x="100" y="96" text-anchor="start" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="600">${filterLabel}</text>
            <text x="100" y="114" text-anchor="start" fill="${closingActive ? '#9C27B0' : '#c4b5fd'}" font-family="sans-serif" font-size="10">${closingActive ? '▶ Closing Balance view' : 'Click to filter'}</text>
          </g>

          <!-- Net Cash Flow -->
          <g transform="translate(1050,10)" onclick="setBankCashMode('net')" style="cursor:pointer">
            <rect width="240" height="140" rx="12" fill="${netActive ? '#fef3c7' : '#FFF8E1'}" stroke="${netActive ? '#d97706' : '#FF9800'}" stroke-width="${netActive ? '2.5' : '1.5'}"/>
            <rect x="23" y="42" width="64" height="64" rx="6" fill="#FF9800" fill-opacity="0.12" stroke="#FF9800" stroke-width="1.5"/>
            <rect x="31" y="78" width="11" height="16" rx="2" fill="#FF9800" fill-opacity="0.5"/>
            <rect x="46" y="65" width="11" height="29" rx="2" fill="#FF9800" fill-opacity="0.7"/>
            <rect x="61" y="54" width="11" height="40" rx="2" fill="#FF9800"/>
            <line x1="27" y1="100" x2="83" y2="100" stroke="#FF9800" stroke-width="1.5"/>
            <text x="100" y="48" text-anchor="start" font-family="sans-serif" font-size="14" font-weight="700" fill="#FF9800">Net Cash Flow</text>
            <text x="100" y="70" text-anchor="start" font-family="sans-serif" font-size="16" font-weight="800" fill="#FF9800">${netFlowText}</text>
            <text x="100" y="92" text-anchor="start" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="600">${filterLabel}</text>
            <text x="100" y="114" text-anchor="start" font-family="sans-serif" font-size="10" fill="${netActive ? '#d97706' : '#6b7280'}">${netActive ? '▶ All transactions' : 'Click to reset'}</text>
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
            <div class="chart-title">Cash Flow Trend${panelFilterSuffix ? ` · ${panelFilterSuffix}` : ''}</div>
            <div class="chart-subtitle">${trendSubtitle}${activeFilterLabel ? ` · ${activeFilterLabel}` : ''} — ${state.filters.chartGranularity[0].toUpperCase() + state.filters.chartGranularity.slice(1)} trend</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end">
            <select class="form-select" style="min-width:120px;height:34px;padding:6px 28px 6px 10px;font-size:12px" onchange="setChartGranularity(this.value)">
              <option value="daily" ${state.filters.chartGranularity==='daily'?'selected':''}>Daily</option>
              <option value="weekly" ${state.filters.chartGranularity==='weekly'?'selected':''}>Weekly</option>
              <option value="monthly" ${state.filters.chartGranularity==='monthly'?'selected':''}>Monthly</option>
            </select>
            <div class="chart-legend">
              ${(bCashMode === 'opening' || bCashMode === 'closing') ? `
                <div class="legend-item"><div class="legend-dot" style="background:#2196F3"></div>Opening</div>
                <div class="legend-item"><div class="legend-dot" style="background:#9C27B0"></div>Closing</div>
              ` : bCashMode === 'net' ? `
                <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Credit</div>
                <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Debit</div>
                <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>Net</div>
              ` : `
                <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Credit</div>
                <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Debit</div>
              `}
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
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Companies${panelFilterSuffix ? ` · ${panelFilterSuffix}` : ''}</div></div>
        <div class="compact-entity-summary">
          <div class="compact-entity-donut-inline"><canvas id="companyDonutChartCompact"></canvas></div>
          <div class="compact-entity-summary-left">
            <div class="compact-entity-kicker">Company Split</div>
            <div class="compact-entity-total">${fmt(totalCompDisplay)}</div>
            <div class="compact-entity-submeta">${compDisplayLabels.length || 0} companies · ${entityModeLabel}</div>
            ${compDisplayLabels[0]
              ? (() => {
                  const topVal = Math.abs(compDisplayMap[compDisplayLabels[0]] || 0);
                  const topShare = (totalCompDisplay > 0 ? topVal / totalCompDisplay * 100 : 0).toFixed(2);
                  return `<div class="compact-entity-topline"><span class="region-donut-dot" style="background:${getCompanyColor(compDisplayLabels[0],'primary') || BAR_COLORS[0]}"></span>${compDisplayLabels[0]} leads with ${topShare}%</div>`;
                })()
              : '<div class="compact-entity-topline">No company data available</div>'}
          </div>
        </div>
        <div class="compact-entity-list">
          ${compDisplayLabels.length
            ? compDisplayLabels.map((company, i) => {
                const cVal = compDisplayMap[company] || 0;
                const share = (totalCompDisplay > 0 ? Math.abs(cVal) / totalCompDisplay * 100 : 0).toFixed(2);
                const color = getCompanyColor(company,'primary') || BAR_COLORS[i % BAR_COLORS.length];
                const encodedCompany = encodeURIComponent(company);
                const isActiveCompany = state.filters.company === company;
                const valColor = isBalanceMode ? 'var(--text2,#6b7280)' : (cVal >= 0 ? 'var(--green,#10b981)' : 'var(--red,#ef4444)');
                const valLabel = isBalanceMode ? fmt(Math.abs(cVal)) : (cVal >= 0 ? fmt(cVal) : `(${fmt(Math.abs(cVal))})`);
                return `<div class="compact-entity-item" style="cursor:pointer;${isActiveCompany ? 'border-color:var(--blue);background:rgba(59,130,246,0.08);' : ''}" onclick="setDashboardCompanyFilter('${encodedCompany}')" title="Filter by ${company}">
                  <div class="compact-entity-main">
                    <span class="region-donut-dot" style="background:${color}"></span>
                    <div>
                      <div class="compact-entity-name">${company}</div>
                    </div>
                  </div>
                  <div class="compact-entity-stats">
                    <div class="compact-entity-volume" style="color:${valColor}">${valLabel}</div>
                    <div class="compact-entity-share">${share}%</div>
                  </div>
                </div>`;
              }).join('')
            : '<div class="region-donut-empty">No company transactions in the current view.</div>'}
        </div>
      </div>

      <div class="chart-card bank-side-list-card">
        <div class="chart-card-header" style="margin-bottom:4px"><div class="chart-title">Region${panelFilterSuffix ? ` · ${panelFilterSuffix}` : ''}</div></div>
        <div class="compact-entity-summary">
          <div class="compact-entity-donut-inline"><canvas id="regionDonutChartCompact"></canvas></div>
          <div class="compact-entity-summary-left">
            <div class="compact-entity-kicker">Region Split</div>
            <div class="compact-entity-total">${fmt(totalRegionDisplay)}</div>
            <div class="compact-entity-submeta">${regionDisplayLabels.length || 0} regions · ${entityModeLabel}</div>
            ${regionDisplayLabels[0]
              ? (() => {
                  const topVal = Math.abs(regionDisplayMap[regionDisplayLabels[0]] || 0);
                  const topShare = (totalRegionDisplay > 0 ? topVal / totalRegionDisplay * 100 : 0).toFixed(2);
                  return `<div class="compact-entity-topline"><span class="region-donut-dot" style="background:${regionColors[0]}"></span>${regionDisplayLabels[0]} leads with ${topShare}%</div>`;
                })()
              : '<div class="compact-entity-topline">No regional data available</div>'}
          </div>
        </div>
        <div class="compact-entity-list">
          ${regionDisplayLabels.length
            ? regionDisplayLabels.map((region, i) => {
                const rVal = regionDisplayMap[region] || 0;
                const share = (totalRegionDisplay > 0 ? Math.abs(rVal) / totalRegionDisplay * 100 : 0).toFixed(2);
                const encodedRegion = encodeURIComponent(region);
                const isActiveRegion = state.filters.region === region;
                const valColor = isBalanceMode ? 'var(--text2,#6b7280)' : (rVal >= 0 ? 'var(--green,#10b981)' : 'var(--red,#ef4444)');
                const valLabel = isBalanceMode ? fmt(Math.abs(rVal)) : (rVal >= 0 ? fmt(rVal) : `(${fmt(Math.abs(rVal))})`);
                return `<div class="compact-entity-item" style="cursor:pointer;${isActiveRegion ? 'border-color:var(--blue);background:rgba(59,130,246,0.08);' : ''}" onclick="setDashboardRegionFilter('${encodedRegion}')" title="Filter by ${region}">
                  <div class="compact-entity-main">
                    <span class="region-donut-dot" style="background:${regionColors[i % regionColors.length]}"></span>
                    <div>
                      <div class="compact-entity-name">${region}</div>
                    </div>
                  </div>
                  <div class="compact-entity-stats">
                    <div class="compact-entity-volume" style="color:${valColor}">${valLabel}</div>
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
      <div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:8px">
          <div>
            <div class="chart-title">People${panelFilterSuffix ? ` · ${panelFilterSuffix}` : ''}</div>
            <div class="chart-subtitle">${peopleVolLabels.length} people · ${fmt(totalPeopleVol)} total</div>
          </div>
          ${state.filters.people !== 'All' ? `<button class="btn btn-secondary btn-sm" onclick="applyFilter('people','All')">× Clear</button>` : ''}
        </div>
        ${peopleVolLabels.length
          ? `<div class="people-detail-list">
              ${peopleVolLabels.map((person, i) => {
                const pData = state.people.find(p => (p.name||'').toLowerCase() === person.toLowerCase());
                const color = BAR_COLORS[i % BAR_COLORS.length];
                const initials = person.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
                const avatarInner = pData?.image ? `<img src="${pData.image}" alt="${person}">` : initials;
                const isActive = state.filters.people === person;
                const encodedPerson = encodeURIComponent(person);

                // Compute all stats from full txns set for this person
                const personTxns = txns.filter(t => String(t.people||'').trim().toLowerCase() === person.toLowerCase());
                let personCredit = 0, personDebit = 0;
                let openingBal = null, closingBal = null, lastDate = null;
                let minTs = Infinity, maxTs = -Infinity;
                personTxns.forEach(t => {
                  const amt = +t.amount || 0;
                  if (amt > 0) personCredit += amt;
                  else if (amt < 0) personDebit += Math.abs(amt);
                  const d = t.date ? new Date(t.date).getTime() : null;
                  if (d && !isNaN(d)) {
                    if (d < minTs) { minTs = d; if (t.balance != null) openingBal = +t.balance; }
                    if (d > maxTs) { maxTs = d; if (t.balance != null) closingBal = +t.balance; lastDate = t.date; }
                  }
                });
                const personNet = personCredit - personDebit;
                const netSign   = personNet >= 0 ? '+' : '−';
                const lastStr   = lastDate ? new Date(lastDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}) : '—';
                const openStr   = openingBal != null ? fmt(openingBal) : '—';
                const closeStr  = closingBal != null ? fmt(closingBal) : '—';

                return `<div class="people-detail-card${isActive ? ' people-detail-card-active' : ''}" onclick="applyFilter('people','${encodedPerson}')">
                  <div class="people-detail-header">
                    <div class="people-detail-avatar" style="background:${color}">${avatarInner}</div>
                    <div class="people-detail-name-block">
                      <div class="people-detail-name">${person}</div>
                      <div class="people-detail-rank">#${i+1} by volume</div>
                    </div>
                    <div class="people-detail-last">Last txn<br>${lastStr}</div>
                  </div>
                  <div class="people-detail-stats">
                    <div class="people-detail-stat">
                      <div class="people-detail-stat-label"><span class="people-detail-stat-dot" style="background:#10b981"></span>Credit</div>
                      <div class="people-detail-stat-value" style="color:#10b981">${fmt(personCredit)}</div>
                    </div>
                    <div class="people-detail-stat">
                      <div class="people-detail-stat-label"><span class="people-detail-stat-dot" style="background:#ef4444"></span>Debit</div>
                      <div class="people-detail-stat-value" style="color:#ef4444">${fmt(personDebit)}</div>
                    </div>
                    <div class="people-detail-stat">
                      <div class="people-detail-stat-label">Opening Bal</div>
                      <div class="people-detail-stat-value">${openStr}</div>
                    </div>
                    <div class="people-detail-stat">
                      <div class="people-detail-stat-label">Closing Bal</div>
                      <div class="people-detail-stat-value">${closeStr}</div>
                    </div>
                  </div>
                  <div class="people-detail-net-row">
                    <div class="people-detail-net-label">Net Cash Flow</div>
                    <div class="people-detail-net-value">${netSign}${fmt(Math.abs(personNet))}</div>
                  </div>
                </div>`;
              }).join('')}
            </div>`
          : `<div class="region-donut-empty" style="padding:24px">No people assigned to transactions.</div>`
        }
      </div>
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
            const barPct = maxBankDetailVol > 0 ? Math.round(Math.abs(row.volume || 0) / maxBankDetailVol * 100) : 0;
            return '<tr>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer;' + rowBg + '" onclick="setDashboardBankFilter(\'' + encodedBank + '\',\'' + encodedAccount + '\')" title="Filter by ' + row.bankName + ' / ' + row.accountNumber + '">'
              + '<div style="display:flex;align-items:center;gap:7px"><span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;display:inline-block"></span><span style="font-weight:700">' + row.bankName + '</span></div>'
              + '<div style="margin-left:15px;margin-top:4px;height:3px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:' + barPct + '%;height:100%;background:' + color + ';border-radius:2px;min-width:' + (barPct > 0 ? '3px' : '0') + '"></div></div>'
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
            const barPct2 = maxBankDetailVol > 0 ? Math.round(Math.abs(row.volume || 0) / maxBankDetailVol * 100) : 0;
            return '<tr>'
              + '<td style="padding:8px 10px;border-bottom:1px solid var(--border)">'
              + '<div style="display:flex;align-items:center;gap:7px"><span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;display:inline-block"></span><span style="font-weight:700">' + row.bankName + '</span></div>'
              + '<div style="margin-left:15px;margin-top:4px;height:3px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:' + barPct2 + '%;height:100%;background:' + color + ';border-radius:2px;min-width:' + (barPct2 > 0 ? '3px' : '0') + '"></div></div>'
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
      <div class="chart-card" style="overflow:hidden">
        <div class="chart-card-header" style="margin-bottom:8px">
          <div class="chart-title">${isBankDashboardType ? 'Inter Division Transactions' : 'Category Wise Spending'}</div>
        </div>
        ${isBankDashboardType ? (() => {
          const thBase   = 'background:var(--surface2,#f8fafc);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;border-bottom:2px solid var(--border);padding:6px 10px;';
          const thL      = thBase + 'text-align:left;';
          const thIn     = thBase + 'text-align:right;color:#0f766e;';
          const thOut    = thBase + 'text-align:right;color:#dc2626;';
          const thNet    = thBase + 'text-align:right;color:var(--text);';
          const thGroup  = 'background:var(--surface2,#f8fafc);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;padding:5px 10px;border-bottom:1px solid var(--border);';
          const tdBase   = 'padding:7px 10px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;white-space:nowrap;';
          const fmtBr    = v => v === 0 ? '—' : fmt(v);
          const inColspan  = idInflowCats.length + 1;
          const outColspan = idOutflowCats.length + 1;
          const minWidth   = 160 + (idInflowCats.length + idOutflowCats.length) * 90 + 180 + 100;
          return `<div class="mini-table-scroll inter-div-table-scroll">
            <table style="width:100%;border-collapse:collapse;min-width:${minWidth}px">
              <thead>
                <tr>
                  <th rowspan="2" style="${thL}border-right:2px solid var(--border);">Company</th>
                  <th colspan="${inColspan}" style="${thGroup}color:#0f766e;border-right:1px solid var(--border);text-align:center;">Inflow</th>
                  <th colspan="${outColspan}" style="${thGroup}color:#dc2626;border-right:1px solid var(--border);text-align:center;">Outflow</th>
                  <th rowspan="2" style="${thNet}">Net Total</th>
                </tr>
                <tr>
                  ${idInflowCats.map(c => `<th style="${thIn}">${c}</th>`).join('')}
                  <th style="${thIn}border-right:1px solid var(--border);">Total Inflow</th>
                  ${idOutflowCats.map(c => `<th style="${thOut}">${c}</th>`).join('')}
                  <th style="${thOut}border-right:1px solid var(--border);">Total Outflow</th>
                </tr>
              </thead>
              <tbody>
                ${bankIDRows.map((row, i) => {
                  const netColor = row.net >= 0 ? '#0f766e' : '#dc2626';
                  const netFmt   = (row.net >= 0 ? '' : '(') + fmt(Math.abs(row.net)) + (row.net >= 0 ? '' : ')');
                  const dotColor = BAR_COLORS[i % BAR_COLORS.length];
                  return '<tr>'
                    + `<td style="${tdBase}text-align:left;border-right:2px solid var(--border);">`
                    + `<div style="display:flex;align-items:center;gap:6px"><span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0"></span><span>${row.company}</span></div></td>`
                    + idInflowCats.map(c => `<td style="${tdBase}text-align:right;color:#0f766e;">${fmtBr(row.inflow[c] || 0)}</td>`).join('')
                    + `<td style="${tdBase}text-align:right;color:#0f766e;font-weight:800;border-right:1px solid var(--border);">${fmtBr(row.totalIn)}</td>`
                    + idOutflowCats.map(c => `<td style="${tdBase}text-align:right;color:#dc2626;">${(row.outflow[c] || 0) > 0 ? '('+fmt(row.outflow[c])+')' : '—'}</td>`).join('')
                    + `<td style="${tdBase}text-align:right;color:#dc2626;font-weight:800;border-right:1px solid var(--border);">${row.totalOut > 0 ? '('+fmt(row.totalOut)+')' : '—'}</td>`
                    + `<td style="${tdBase}text-align:right;color:${netColor};font-size:13px;">${netFmt}</td>`
                    + '</tr>';
                }).join('')}
              </tbody>
            </table>
          </div>`;
        })() : `<div class="chart-canvas-tall"><canvas id="creditCategoryChart"></canvas></div>`}
      </div>
      <div class="chart-card">
        <div class="chart-card-header" style="margin-bottom:8px">
          <div class="chart-title">Reference Spending</div>
        </div>
        <div class="ref-chart-scroll-wrap"><canvas id="${isBankDashboardType ? 'bankReferenceChart' : 'creditReferenceChart'}"></canvas></div>
      </div>
    </div>
    ` : ''}

    <!-- PANEL 4: Recent Transactions -->
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Recent Transactions</div>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="navigate('transactions')">View All</button>
        </div>
      </div>
      <div class="dashboard-recent-txn-scroll">${renderTableHTML(isCreditType ? creditTxns.slice(0,8) : txns.slice(0,8))}</div>
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
      buildBankReferenceSpendingChart(); // Inter Division is now a table, no chart needed
    } else {
      buildTrendChart(false);
    }
    if (showMerchantCompanyDonut || showCreditCompanyDonut || showBankCompanyDonut) buildCompanyDonutChart();
    if (isMerchantType || isCreditType || isBankDashboardType) buildRegionDonutChart();

    if (!isMerchantType) buildInterDivisionChart();
    if (!isMerchantType) buildFinancialStackChart();
    _initDashDatePickers();
  }, 50);
}

let _dashFpFrom = null;
let _dashFpTo   = null;

function _initDashDatePickers() {
  if (typeof flatpickr === 'undefined') return;
  if (_dashFpFrom) { _dashFpFrom.destroy(); _dashFpFrom = null; }
  if (_dashFpTo)   { _dashFpTo.destroy();   _dashFpTo   = null; }

  const enabledDates = [...new Set(
    state.transactions
      .map(t => String(t.date || '').slice(0, 10))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
  )];

  const _fmtDate = d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const fromEl = document.getElementById('dash-date-from');
  const toEl   = document.getElementById('dash-date-to');

  if (fromEl) {
    _dashFpFrom = flatpickr(fromEl, {
      enable: enabledDates,
      defaultDate: state.filters.dateFrom || null,
      dateFormat: 'Y-m-d',
      disableMobile: true,
      onChange([date]) {
        if (date) applyFilter('dateFrom', _fmtDate(date));
      },
    });
  }

  if (toEl) {
    _dashFpTo = flatpickr(toEl, {
      enable: enabledDates,
      defaultDate: state.filters.dateTo || null,
      dateFormat: 'Y-m-d',
      disableMobile: true,
      onChange([date]) {
        if (date) applyFilter('dateTo', _fmtDate(date));
      },
    });
  }
}
function setChartGranularity(granularity) {
  state.filters.chartGranularity = granularity;
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}
function clearDashboardDateFilters() {
  state.filters.dateFrom = state._autoDateFrom;
  state.filters.dateTo   = state._autoDateTo;
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
