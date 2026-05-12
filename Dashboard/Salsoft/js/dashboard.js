// ============================================================
// USD-FIRST VALUE HELPERS
// Use USD column when available, fall back to original currency.
// ============================================================
function $usdAmt(t)     { return t.amount_usd     != null ? +t.amount_usd     : 0; }
function $usdNetAmt(t)  { return t.net_amount_usd != null ? +t.net_amount_usd : 0; }
function $usdFee(t)     { return t.fee_usd        != null ? +t.fee_usd        : 0; }
function $usdVat(t)     { return t.vat_usd        != null ? +t.vat_usd        : 0; }
function $usdBalance(t) { return t.balance_usd    != null ? +t.balance_usd    : null; }

function _normalizeBalanceText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function _getBeginningBalanceKeywords() {
  const configured = (state.beginningBalanceKeywords || [])
    .map(_normalizeBalanceText)
    .filter(Boolean);
  const defaults = ['beginning balance as of', 'beginning balance'];
  return [...new Set([...configured, ...defaults])];
}

function _isBeginningBalanceTxn(t) {
  const fields = [t.name, t.description].map(_normalizeBalanceText).filter(Boolean);
  if (!fields.length) return false;
  const keywords = _getBeginningBalanceKeywords();
  return keywords.some(keyword => fields.some(field => field === keyword || field.startsWith(`${keyword} `)));
}

function _beginningBalanceAmount(t) {
  if (t.amount_usd != null && !Number.isNaN(+t.amount_usd)) return +t.amount_usd;
  if (t.amount != null && !Number.isNaN(+t.amount)) return +t.amount;
  if (t.net_amount_usd != null && !Number.isNaN(+t.net_amount_usd)) return +t.net_amount_usd;
  if (t.net_amount != null && !Number.isNaN(+t.net_amount)) return +t.net_amount;
  return null;
}

function _pickOpeningFromBeginningRows(sorted, dateFrom) {
  const rows = (sorted || [])
    .filter(_isBeginningBalanceTxn)
    .map(t => ({ t, amt: _beginningBalanceAmount(t), date: String(t.date || '') }));
  if (!rows.length) return null;

  const nonZero = (r) => r.amt != null && !Number.isNaN(r.amt) && r.amt !== 0;

  if (dateFrom) {
    const uptoDate = rows.filter(r => !r.date || r.date <= dateFrom);
    if (uptoDate.length) {
      for (let i = uptoDate.length - 1; i >= 0; i--) {
        if (nonZero(uptoDate[i])) return uptoDate[i].amt;
      }
      return uptoDate[uptoDate.length - 1].amt;
    }
  }

  for (let i = rows.length - 1; i >= 0; i--) {
    if (nonZero(rows[i])) return rows[i].amt;
  }
  return rows[rows.length - 1].amt;
}

function _pickOpeningForAccount(sorted, dateFrom, bankName, accountNumber) {
  let openingVal = _pickOpeningFromBeginningRows(sorted, dateFrom);
  if (openingVal != null) return openingVal;

  // Date-filtered dashboard views can hide beginning-balance rows.
  // Fallback to the full account history so opening remains stable.
  const allAccountTxns = (state.transactions || [])
    .filter(t => String(t.bank || 'Unknown') === String(bankName || 'Unknown')
      && String((t.accountNumber || '').trim() || 'No account') === String(accountNumber || 'No account'))
    .sort((a, b) => String(a.date || '') < String(b.date || '') ? -1 : 1);

  openingVal = _pickOpeningFromBeginningRows(allAccountTxns, dateFrom);
  return openingVal;
}

function _closingFromLastEntry(sorted, dateTo, openingVal) {
  const scoped = dateTo
    ? sorted.filter(t => t.date && t.date <= dateTo)
    : sorted;
  if (!scoped.length) return null;

  // Determine latest date first, then pick first listed row on that date.
  // Bank statement rows are typically newest-first within same date,
  // so this captures the actual closing entry for that day.
  const latestDate = scoped.reduce((mx, t) => {
    const d = String(t.date || '');
    return !mx || d > mx ? d : mx;
  }, '');
  const sameDayRows = latestDate ? scoped.filter(t => String(t.date || '') === latestDate) : scoped;
  const lastEntry = sameDayRows[0] || scoped[scoped.length - 1];

  const directBal = $usdBalance(lastEntry);
  if (directBal != null && !Number.isNaN(directBal)) return directBal;

  const lastWithBalance = sameDayRows.find(t => $usdBalance(t) != null) || [...scoped].reverse().find(t => $usdBalance(t) != null);
  if (lastWithBalance) return $usdBalance(lastWithBalance);

  if (openingVal != null && !Number.isNaN(openingVal)) {
    let running = openingVal;
    scoped.forEach(t => {
      // Beginning-balance row is the base opening amount; don't add it again.
      if (_isBeginningBalanceTxn(t)) return;
      running += $usdAmt(t);
    });
    return running;
  }

  return null;
}

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

    // Opening: use amount from transaction named like "Beginning balance ...".
    const bankName = acctTxns[0]?.bank || 'Unknown';
    const accountNumber = ((acctTxns[0]?.accountNumber || '').trim()) || 'No account';
    let openingVal = _pickOpeningForAccount(sorted, dateFrom, bankName, accountNumber);
    if (openingVal == null) {
      // Fallback for old data with no beginning-balance row.
      if (dateFrom) {
        const before = sorted.filter(t => t.date && t.date < dateFrom);
        if (before.length > 0) openingVal = $usdBalance(before[before.length - 1]);
        if (openingVal == null) {
          const onStart = sorted.filter(t => t.date === dateFrom);
          if (onStart.length > 0) openingVal = $usdBalance(onStart[0]);
        }
      }
      if (openingVal == null) {
        const first = sorted.find(t => $usdBalance(t) != null);
        if (first) openingVal = $usdBalance(first);
      }
    }
    if (openingVal != null && !isNaN(openingVal)) { totalOpening += openingVal; openingCount++; }

    // Closing: each account's closing is from its last entry.
    let closingVal = _closingFromLastEntry(sorted, dateTo, openingVal);
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

function renderCreditSummaryCards({ txns, inflows, outflows, netCashFlow, avgTxn, highestTxn, creditMode }) {
  const incomeCount = txns.filter(t => $usdAmt(t) > 0).length;
  const spendingCount = txns.filter(t => $usdAmt(t) < 0).length;
  const byDate = {};

  txns.forEach(t => {
    const d = String(t.date || '').slice(0, 10);
    if (!d) return;
    if (!byDate[d]) byDate[d] = { inflow: 0, outflow: 0, net: 0 };
    const amt = $usdAmt(t);
    if (amt > 0) byDate[d].inflow += amt;
    if (amt < 0) byDate[d].outflow += Math.abs(amt);
    byDate[d].net += amt;
  });

  const dates = Object.keys(byDate).sort();
  const inflowSeries = dates.map(d => byDate[d].inflow);
  const outflowSeries = dates.map(d => byDate[d].outflow);
  const netSeries = dates.map(d => byDate[d].net);
  const baseSeries = inflowSeries.length >= 2 ? inflowSeries : [0, 1];
  const isNetPositive = netCashFlow >= 0;

  const inflowSpark = typeof _scardSparkline === 'function' ? _scardSparkline(inflowSeries.length >= 2 ? inflowSeries : baseSeries, 'area', '#16a34a') : '';
  const outflowSpark = typeof _scardSparkline === 'function' ? _scardSparkline(outflowSeries.length >= 2 ? outflowSeries : baseSeries, 'area', '#dc2626') : '';
  const netSpark = typeof _scardSparkline === 'function' ? _scardSparkline(netSeries.length >= 2 ? netSeries : baseSeries, 'bar', isNetPositive ? '#16a34a' : '#dc2626') : '';
  const avgSpark = typeof _scardSparkline === 'function' ? _scardSparkline(txns.map(t => Math.abs($usdAmt(t))), 'line', '#f97316') : '';
  const highSpark = typeof _scardSparkline === 'function' ? _scardSparkline(txns.map(t => Math.abs($usdAmt(t))), 'line', '#2563eb') : '';

  return `<div class="scard-grid">
    <div class="scard scard-inflow${creditMode === 'income' ? ' scard-active' : ''}" onclick="setCreditAmountMode('income')" title="Filter income transactions">
      <div class="scard-title">INFLOWS</div>
      <div class="scard-value scard-value--sm">+${fmt(inflows)}</div>
      <div class="scard-yday positive">${incomeCount} income transactions</div>
      <div class="scard-chart">${inflowSpark}</div>
    </div>
    <div class="scard scard-outflow${creditMode === 'spending' ? ' scard-active' : ''}" onclick="setCreditAmountMode('spending')" title="Filter spending transactions">
      <div class="scard-title">OUTFLOWS</div>
      <div class="scard-value scard-value--sm">-${fmt(outflows)}</div>
      <div class="scard-yday negative">${spendingCount} spending transactions</div>
      <div class="scard-chart">${outflowSpark}</div>
    </div>
    <div class="scard scard-net${isNetPositive ? '' : ' scard-net--neg'}${creditMode === 'all' ? ' scard-active' : ''}" onclick="setCreditAmountMode('all')" title="Show all transactions">
      <div class="scard-title">NET CASH FLOW</div>
      <div class="scard-value scard-value--sm${isNetPositive ? ' scard-value--green' : ' scard-value--red'}">${isNetPositive ? '+' : '-'}${fmt(Math.abs(netCashFlow))}</div>
      <div class="scard-yday ${isNetPositive ? 'positive' : 'negative'}">Income minus spending</div>
      <div class="scard-chart">${netSpark}</div>
    </div>
    <div class="scard scard-opening">
      <div class="scard-title">AVERAGE TRANSACTION</div>
      <div class="scard-value">${fmt(avgTxn)}</div>
      <div class="scard-yday neutral">Across income and spending</div>
      <div class="scard-chart">${avgSpark}</div>
    </div>
    <div class="scard scard-closing">
      <div class="scard-title">HIGHEST TRANSACTION</div>
      <div class="scard-value scard-value--blue">${fmt(highestTxn)}</div>
      <div class="scard-yday neutral">Peak single transaction</div>
      <div class="scard-chart">${highSpark}</div>
    </div>
  </div>`;
}

function renderMerchantSummaryCards({ txns, totalAmount, totalNetAmount, totalFee, totalVat, avgTxn }) {
  const inflows = txns.filter(t => $usdAmt(t) > 0).reduce((s, t) => s + $usdAmt(t), 0);
  const outflows = txns.filter(t => $usdAmt(t) < 0).reduce((s, t) => s + Math.abs($usdAmt(t)), 0);
  const netCashFlow = inflows - outflows;
  const isNetPositive = netCashFlow >= 0;
  const byDate = {};

  txns.forEach(t => {
    const d = String(t.date || '').slice(0, 10);
    if (!d) return;
    if (!byDate[d]) byDate[d] = { total: 0, net: 0, fee: 0, vat: 0, avg: [] };
    byDate[d].total += Math.abs($usdAmt(t));
    byDate[d].net += Math.abs($usdNetAmt(t));
    byDate[d].fee += Math.abs($usdFee(t));
    byDate[d].vat += Math.abs($usdVat(t));
    byDate[d].avg.push(Math.abs($usdAmt(t)));
  });

  const dates = Object.keys(byDate).sort();
  const totalSeries = dates.map(d => byDate[d].total);
  const netSeries = dates.map(d => byDate[d].net);
  const feeSeries = dates.map(d => byDate[d].fee);
  const vatSeries = dates.map(d => byDate[d].vat);
  const avgSeries = dates.map(d => {
    const arr = byDate[d].avg;
    return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  });
  const fallbackSeries = totalSeries.length >= 2 ? totalSeries : [0, 1];

  const totalSpark = typeof _scardSparkline === 'function' ? _scardSparkline(totalSeries.length >= 2 ? totalSeries : fallbackSeries, 'area', '#2563eb') : '';
  const netSpark = typeof _scardSparkline === 'function' ? _scardSparkline(netSeries.length >= 2 ? netSeries : fallbackSeries, 'line', '#16a34a') : '';
  const feeSpark = typeof _scardSparkline === 'function' ? _scardSparkline(feeSeries.length >= 2 ? feeSeries : fallbackSeries, 'bar', '#dc2626') : '';
  const vatSpark = typeof _scardSparkline === 'function' ? _scardSparkline(vatSeries.length >= 2 ? vatSeries : fallbackSeries, 'bar', '#7c3aed') : '';
  const avgSpark = typeof _scardSparkline === 'function' ? _scardSparkline(avgSeries.length >= 2 ? avgSeries : fallbackSeries, 'line', '#f97316') : '';

  return `<div class="scard-grid">
    <div class="scard scard-closing">
      <div class="scard-title">TOTAL AMOUNT</div>
      <div class="scard-value scard-value--blue">${fmt(totalAmount)}</div>
      <div class="scard-yday neutral">${txns.length} transactions</div>
      <div class="scard-chart">${totalSpark}</div>
    </div>
    <div class="scard scard-net${isNetPositive ? '' : ' scard-net--neg'}">
      <div class="scard-title">TOTAL NET AMOUNT</div>
      <div class="scard-value scard-value--sm${isNetPositive ? ' scard-value--green' : ' scard-value--red'}">${isNetPositive ? '+' : '-'}${fmt(Math.abs(totalNetAmount))}</div>
      <div class="scard-yday ${isNetPositive ? 'positive' : 'negative'}">Net outcome</div>
      <div class="scard-chart">${netSpark}</div>
    </div>
    <div class="scard scard-outflow">
      <div class="scard-title">TOTAL FEES</div>
      <div class="scard-value scard-value--sm">-${fmt(totalFee)}</div>
      <div class="scard-yday negative">Processing charges</div>
      <div class="scard-chart">${feeSpark}</div>
    </div>
    <div class="scard scard-opening">
      <div class="scard-title">TOTAL VAT</div>
      <div class="scard-value">${fmt(totalVat)}</div>
      <div class="scard-yday neutral">Tax component</div>
      <div class="scard-chart">${vatSpark}</div>
    </div>
    <div class="scard scard-inflow">
      <div class="scard-title">AVERAGE TRANSACTION</div>
      <div class="scard-value scard-value--sm">${fmt(avgTxn)}</div>
      <div class="scard-yday positive">Average ticket size</div>
      <div class="scard-chart">${avgSpark}</div>
    </div>
  </div>`;
}

function renderDashboard(area) {
  // Keep dashboard default on Bank when no specific bank type is selected.
  if (!state.filters.bankType || state.filters.bankType === 'All') {
    state.filters.bankType = 'Bank';
  }
  if (typeof populateTopbarCurrency === 'function') populateTopbarCurrency();

  const txns = getFilteredTxns();
  const flowTxns = txns.filter(t => !_isBeginningBalanceTxn(t));
  const credits = flowTxns.filter(t => $usdAmt(t) > 0).reduce((s, t) => s + $usdAmt(t), 0);
  const debits  = flowTxns.filter(t => $usdAmt(t) < 0).reduce((s, t) => s + Math.abs($usdAmt(t)), 0);
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

  // For opening/closing modes we need all txns (including beginning-balance rows)
  // to detect per-account opening values. For flow/net modes, exclude beginning-balance rows.
  const analyticsTxns = (bCashMode === 'opening' || bCashMode === 'closing') ? txns : flowTxns;

  // analyticsValue returns the field that matches the active mode so entity panels
  // (Companies, Region, People, etc.) always reflect what the SVG card filter shows.
  const analyticsValue = (t) => {
    if (isMerchantType) return $usdNetAmt(t);
    return Math.abs($usdAmt(t));
  };
  const isNetMode = bCashMode === 'net';

  const compVolMap = {};
  analyticsTxns.forEach(t => { const c = t.company || 'Unknown'; compVolMap[c] = (compVolMap[c] || 0) + analyticsValue(t); });
  const compVolLabels = Object.keys(compVolMap).sort((a, b) => compVolMap[b] - compVolMap[a]);
  const totalCompVol = compVolLabels.reduce((s, c) => s + compVolMap[c], 0);
  // Net per company (signed): sum = credits − debits = Net Cash Flow → consistent with SVG card
  const compNetMap = {};
  flowTxns.forEach(t => { const c = t.company || 'Unknown'; compNetMap[c] = (compNetMap[c] || 0) + $usdAmt(t); });
  const totalCompNet = credits - debits;
  const referenceVolMap = {};
  const referenceNetMap = {};
  analyticsTxns.forEach(t => {
    const referenceKey = (t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference';
    referenceVolMap[referenceKey] = (referenceVolMap[referenceKey] || 0) + analyticsValue(t);
  });
  flowTxns.forEach(t => {
    const referenceKey = (t.reference || t.transactionReference || t.referenceId || 'No Reference').trim() || 'No Reference';
    referenceNetMap[referenceKey] = (referenceNetMap[referenceKey] || 0) + $usdAmt(t);
  });
  const referenceNetAbsMap = {};
  Object.keys(referenceNetMap).forEach((ref) => {
    referenceNetAbsMap[ref] = Math.abs(referenceNetMap[ref] || 0);
  });
  const referencePanelMap = isNetMode ? referenceNetAbsMap : referenceVolMap;
  const referenceVolLabels = Object.keys(referencePanelMap).sort((a, b) => (referencePanelMap[b] || 0) - (referencePanelMap[a] || 0));
  const totalReferenceVol = referenceVolLabels.reduce((sum, key) => sum + (referencePanelMap[key] || 0), 0);
  const totalReferenceNet = Object.keys(referenceNetMap).reduce((sum, key) => sum + (referenceNetMap[key] || 0), 0);
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
        companyMap: {},
        txns: []
      };
    }
    const entry = bankAccountMap[key];
    entry.txns.push(t);
    const isBeginningTxn = _isBeginningBalanceTxn(t);
    if (!isBeginningTxn) {
      entry.companyMap[companyName] = (entry.companyMap[companyName] || 0) + analyticsValue(t);
      if (amount > 0) entry.inflow += amount;
      else if (amount < 0) entry.outflow += Math.abs(amount);
      entry.volume += analyticsValue(t);
    }
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
    entry.count += 1;
  });
  const bankDetailRows = Object.values(bankAccountMap)
    .map(row => {
      const companyName = Object.keys(row.companyMap)
        .sort((a, b) => (row.companyMap[b] - row.companyMap[a]) || a.localeCompare(b))[0] || 'Unknown';
      const sorted = [...(row.txns || [])].sort((a, b) => String(a.date || '') < String(b.date || '') ? -1 : 1);
      const dateFrom = state.filters.dateFrom;
      const dateTo = state.filters.dateTo;

      let opening = _pickOpeningForAccount(sorted, dateFrom, row.bankName, row.accountNumber);
      if (opening == null) {
        if (dateFrom) {
          const before = sorted.filter(t => t.date && t.date < dateFrom);
          if (before.length > 0) opening = $usdBalance(before[before.length - 1]);
          if (opening == null) {
            const onStart = sorted.filter(t => t.date === dateFrom);
            if (onStart.length > 0) opening = $usdBalance(onStart[0]);
          }
        }
        if (opening == null) {
          const first = sorted.find(t => $usdBalance(t) != null);
          if (first) opening = $usdBalance(first);
        }
      }

      let closing = _closingFromLastEntry(sorted, dateTo, opening);

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
  flowTxns.forEach(t => { const r = state.companyRegions[t.company] || 'Other'; regionNetMap[r] = (regionNetMap[r] || 0) + $usdAmt(t); });
  const totalRegionNet = credits - debits;

  // Per-company / per-region balance maps for Opening/Closing card modes
  // IMPORTANT: Use same date range logic as computePortfolioBalances to ensure consistency
  const isBalanceMode = bCashMode === 'opening' || bCashMode === 'closing';
  const compBalMap = {};
  const regionBalMap = {};
  if (isBalanceMode) {
    const dateFrom = state.filters.dateFrom;
    const dateTo = state.filters.dateTo;
    const acctTxns = {};
    
    // Group transactions by account
    analyticsTxns.forEach(t => {
      const key = (t.bank || 'Unknown') + '||' + ((t.accountNumber || '').trim() || 'No account');
      if (!acctTxns[key]) acctTxns[key] = [];
      acctTxns[key].push(t);
    });
    
    // For each account, calculate opening/closing balances
    Object.values(acctTxns).forEach(txnList => {
      if (txnList.length === 0) return;
      
      const sorted = [...txnList].sort((a, b) => String(a.date || '') < String(b.date || '') ? -1 : 1);
      
      // Get opening balance from "Beginning balance ..." row amount
      const accountNumber = ((txnList[0]?.accountNumber || '').trim()) || 'No account';
      const bankName = txnList[0]?.bank || 'Unknown';
      let openingVal = _pickOpeningForAccount(sorted, dateFrom, bankName, accountNumber);
      if (openingVal == null) {
        if (dateFrom) {
          const before = sorted.filter(t => t.date && t.date < dateFrom);
          if (before.length > 0) openingVal = $usdBalance(before[before.length - 1]);
          if (openingVal == null) {
            const onStart = sorted.filter(t => t.date === dateFrom);
            if (onStart.length > 0) openingVal = $usdBalance(onStart[0]);
          }
        }
        if (openingVal == null) {
          const first = sorted.find(t => $usdBalance(t) != null);
          if (first) openingVal = $usdBalance(first);
        }
      }
      
      // Closing: each account's closing is from its last entry.
      let closingVal = _closingFromLastEntry(sorted, dateTo, openingVal);
      
      // Get company and region from first transaction in account
      const company = (txnList[0].company || 'Unknown').trim();
      const region = state.companyRegions[company] || 'Other';
      
      // Add to appropriate map based on mode
      if (bCashMode === 'opening' && openingVal != null) {
        const val = Math.abs(openingVal);
        if (val > 0) {
          compBalMap[company] = (compBalMap[company] || 0) + val;
          regionBalMap[region] = (regionBalMap[region] || 0) + val;
        }
      } else if (bCashMode === 'closing' && closingVal != null) {
        const val = Math.abs(closingVal);
        if (val > 0) {
          compBalMap[company] = (compBalMap[company] || 0) + val;
          regionBalMap[region] = (regionBalMap[region] || 0) + val;
        }
      }
    });
  }
  // Panel 2 (Company + Region) mode-specific data maps
  const compNetAbsMap = {};
  Object.keys(compNetMap).forEach((company) => {
    compNetAbsMap[company] = Math.abs(compNetMap[company] || 0);
  });
  const regionNetAbsMap = {};
  Object.keys(regionNetMap).forEach((region) => {
    regionNetAbsMap[region] = Math.abs(regionNetMap[region] || 0);
  });

  const panel2CompMap = isBalanceMode ? compBalMap : (isNetMode ? compNetMap : compVolMap);
  const panel2CompLabels = Object.keys(panel2CompMap).sort((a, b) => Math.abs(panel2CompMap[b] || 0) - Math.abs(panel2CompMap[a] || 0));
  const panel2TotalCompVol = panel2CompLabels.reduce((s, c) => s + (panel2CompMap[c] || 0), 0);

  const panel2RegionMap = isBalanceMode ? regionBalMap : (isNetMode ? regionNetMap : regionMap);
  const panel2RegionLabels = Object.keys(panel2RegionMap).sort((a, b) => Math.abs(panel2RegionMap[b] || 0) - Math.abs(panel2RegionMap[a] || 0));
  const panel2TotalRegionVol = panel2RegionLabels.reduce((s, r) => s + (panel2RegionMap[r] || 0), 0);

  // People: raw credit+debit map for sorting (always by total, ignoring mode)
  const peopleCDMap = {};
  flowTxns.forEach(t => {
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
  flowTxns.forEach(t => {
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
  flowTxns.forEach(t => {
    const interDivision = (t.interDivision || '').trim() || 'Unassigned';
    interDivisionMap[interDivision] = (interDivisionMap[interDivision] || 0) + Math.abs($usdAmt(t));
  });
  const interDivisionLabels = Object.keys(interDivisionMap).sort((a, b) => interDivisionMap[b] - interDivisionMap[a]).slice(0, 8);
  const statusCountMap = {};
  flowTxns.forEach(t => {
    const status = (t.status || 'Unknown').trim() || 'Unknown';
    statusCountMap[status] = (statusCountMap[status] || 0) + 1;
  });
  const financialTotals = flowTxns.reduce((totals, txn) => {
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
  const creditNetFlow = totalIncome - totalSpending;
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
  const merchantAvgTxn = txns.length ? txns.reduce((sum, txn) => sum + Math.abs($usdAmt(txn)), 0) / txns.length : 0;
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

  const _creditModeLabel = (state.filters.creditAmountMode || 'all') === 'income' ? 'INCOME' : (state.filters.creditAmountMode === 'spending' ? 'SPENDING' : 'OVERVIEW');
  const _creditActiveCat = (state.filters.creditCategory || 'All') !== 'All' ? state.filters.creditCategory : '';
  const _creditActiveRef = (state.filters.creditReference || 'All') !== 'All' ? state.filters.creditReference : '';

  area.innerHTML = `
    <div class="filter-bar dashboard-filter-bar">
      <div class="dashboard-filter-chips">
        <span class="filter-label">Category</span>
        ${['Bank', 'Credit Card', 'Merchant'].map(type => `<button class="dashboard-filter-chip ${state.filters.bankType===type?'active':''}" onclick="applyFilter('bankType','${type}')">${type}</button>`).join('')}
      </div>
      <div class="dashboard-filter-date-group">
        <div class="filter-group">
          <span class="filter-label">From</span>
          <input type="text" id="dash-date-from" class="dash-fp-input" placeholder="Select date" readonly>
        </div>
        <div class="filter-group">
          <span class="filter-label">To</span>
          <input type="text" id="dash-date-to" class="dash-fp-input" placeholder="Select date" readonly>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="clearDashboardDateFilters()">Reset</button>
      </div>
    </div>
    <!-- PANEL 1: Total Detail -->
    ${isCreditType ? `${renderCreditSummaryCards({ txns: creditTxns, inflows: totalIncome, outflows: totalSpending, netCashFlow: creditNetFlow, avgTxn, highestTxn, creditMode: state.filters.creditAmountMode || 'all' })}` : isMerchantType ? `${renderMerchantSummaryCards({ txns, totalAmount: merchantTotalAmount, totalNetAmount: merchantTotalNetAmount, totalFee: financialTotals.fee, totalVat: financialTotals.vat, avgTxn: merchantAvgTxn })}` : isBankDashboardType ? `` : `
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

    ${isBankDashboardType ? renderSummaryCards({ txns, credits, debits, opening: displayOpeningBalance, closing: displayClosingBalance, bCashMode }) : ''}

    <!-- PANEL 2: CashFlow Division / Companies / Region -->
    <div class="bank-trend-row" style="margin-bottom:18px">
      ${renderCashFlowDivisionPanel({ bankIDRows })}
      ${renderCompaniesBarPanel({ compVolLabels: panel2CompLabels, compVolMap: panel2CompMap, totalCompVol: panel2TotalCompVol, bCashMode })}
      ${renderRegionDonutPanel({ regionLabels: panel2RegionLabels, regionMap: panel2RegionMap, totalRegionVol: panel2TotalRegionVol, regionColors, bCashMode })}
    </div>


    <!-- PANEL 3: Bank Detail -->
    <div class="${isBankDashboardType ? 'dashboard-bank-grid-bank-mode' : (isMerchantType || isCreditType || isBankDashboardType || showMerchantCompanyDonut || showCreditCompanyDonut || showBankCompanyDonut || !isMerchantType ? 'dashboard-bank-grid' : 'dashboard-bank-grid-2col')}">
      ${renderPeoplePanel({ peopleVolLabels, txns: flowTxns, state, panelFilterSuffix, totalPeopleVol })}
      ${isMerchantType ? renderBankPanel({ bankDetailRows, maxBankDetailVol, state, hideBalanceColumns: true, shellClass: 'bank-detail-expanded' }) : isCreditType ? renderBankPanel({ bankDetailRows, maxBankDetailVol, state, hideBalanceColumns: true, shellClass: 'bank-detail-expanded' }) : ''}
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
      ${isMerchantType || isCreditType ? '' : isBankDashboardType ? renderBankPanel({ bankDetailRows, maxBankDetailVol, state }) : `<div class="chart-card">
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

    ${isBankDashboardType ? `
    <div class="panel4-grid">
      ${renderInterDivisionPanel({ txns, idInflowCats, idOutflowCats })}
      ${renderReferencePanel({
        referenceVolLabels,
        referenceVolMap: referencePanelMap,
        referenceSignedMap: referenceNetMap,
        totalReferenceVol,
        totalReferenceSigned: totalReferenceNet,
        bCashMode,
        state
      })}
    </div>
    ` : isCreditType ? `
    <div class="analysis-grid">
      <div class="cpb-ref-card" style="cursor:default">
        <div class="cfd-card-header" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
          <div class="cpb-ref-title">CATEGORY ${_creditModeLabel}</div>
          ${_creditActiveCat ? `<div style="font-size:11px;color:var(--blue,#2563eb);font-weight:700;margin-top:2px">${_creditActiveCat}</div>` : ''}
        </div>
        <div class="ref-chart-scroll-wrap"><canvas id="creditCategoryChart"></canvas></div>
      </div>
      <div class="cpb-ref-card" style="cursor:default">
        <div class="cfd-card-header" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
          <div class="cpb-ref-title">REFERENCE ${_creditModeLabel}</div>
          ${_creditActiveRef ? `<div style="font-size:11px;color:var(--blue,#2563eb);font-weight:700;margin-top:2px">${_creditActiveRef}</div>` : ''}
        </div>
        <div class="ref-chart-scroll-wrap"><canvas id="creditReferenceChart"></canvas></div>
      </div>
    </div>
    ` : ''}

    <!-- PANEL 4: Recent Transactions -->
    <div class="rtx-card" id="recentTxnCard">
      <div class="rtx-card-header">
        <div class="rtx-card-title">Recent Transactions</div>
        <button class="rtx-view-all-btn" onclick="navigate('transactions');event.stopPropagation()">View All</button>
      </div>
      <div class="rtx-table-scroll">${renderTableHTML(isCreditType ? creditTxns.slice(0,8) : txns.slice(0,8))}</div>
    </div>
  `;

  renderCompanyChips();
  setTimeout(() => {
    if (isCreditType) {
      buildCreditCategorySpendingChart();
      buildCreditReferenceSpendingChart();
    }
    if (isMerchantType || isCreditType) buildRegionDonutChart();
    if (!isMerchantType) buildInterDivisionChart();
    if (!isMerchantType) buildFinancialStackChart();
    _initCfdTooltip();
    _initCpbTooltip();
    _initRgdTooltip();
    _initDashDatePickers();
    _initRtxInteractions();
  }, 50);
}

let _dashFpFrom = null;
let _dashFpTo   = null;

let _rtxDocListener = null;
function _initRtxInteractions() {
  const card = document.getElementById('recentTxnCard');
  if (!card) return;
  const rows = card.querySelectorAll('.rtx-table-scroll tbody tr');

  card.addEventListener('click', e => {
    if (e.target.closest('tr')) return;
    card.classList.toggle('rtx-card--active');
  });

  rows.forEach(row => {
    row.addEventListener('click', e => {
      e.stopPropagation();
      const isActive = row.classList.contains('rtx-row--active');
      rows.forEach(r => r.classList.remove('rtx-row--active'));
      if (!isActive) {
        row.classList.add('rtx-row--active');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  if (_rtxDocListener) document.removeEventListener('click', _rtxDocListener);
  _rtxDocListener = e => {
    if (!e.target.closest('#recentTxnCard')) {
      rows.forEach(r => r.classList.remove('rtx-row--active'));
      card.classList.remove('rtx-card--active');
    }
  };
  document.addEventListener('click', _rtxDocListener);
}

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
/**
 * Clear date filters and re-render
 * Date filters are persistent, not subject to drill-down logic
 */
function clearDashboardDateFilters() {
  filterManager.dateFrom = state._autoDateFrom;
  filterManager.dateTo = state._autoDateTo;
  renderDashboardWithFilters();
}

function setTopbarCurrency(val) {
  state.filters.currency = val || 'All';
  renderDashboardWithFilters();
}

function populateTopbarCurrency() {
  const sel = document.getElementById('topbar-currency');
  if (!sel) return;
  const currencies = Array.isArray(state.currencies) ? state.currencies : [];
  const current = state.filters.currency || 'All';
  sel.innerHTML = '<option value="All">All Currencies</option>'
    + currencies.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
  sel.value = current;
}

/**
 * Set credit amount mode (income/spending)
 * For Credit Card types only
 */
function setCreditAmountMode(mode) {
  onCreditModeClick(mode);
}

/**
 * Set bank cash mode (opening/closing/credit/debit/net)
 * Controls balance vs. flow display
 */
function setBankCashMode(mode) {
  onCashModeClick(mode);
}

/**
 * DEPRECATED: Use filterManager instead
 * Kept for backward compatibility
 */
function clearDashboardQuickFilters() {
  filterManager.clear();
  renderDashboardWithFilters();
}

/**
 * DEPRECATED: Use onPanel2Click() instead
 * Company filter via drill-down
 */
function setDashboardCompanyFilter(encodedCompany) {
  const company = decodeURIComponent(encodedCompany || '');
  onPanel2Click('company', company);
}

/**
 * DEPRECATED: Use onPanel2Click() instead  
 * Region filter via drill-down
 */
function setDashboardRegionFilter(encodedRegion) {
  const region = decodeURIComponent(encodedRegion || '');
  onPanel2Click('region', region);
}

/**
 * DEPRECATED: Use onPanel3Click() instead
 * Bank/Account filter
 */
function setDashboardBankFilter(encodedBank, encodedAccount) {
  const bank = decodeURIComponent(encodedBank || '');
  const account = decodeURIComponent(encodedAccount || '');
  
  // Toggle: if the same bank+account is already selected, clear the filter
  const isSameFilter = filterManager.secondaryFilter?.type === 'account' && 
                       filterManager.secondaryFilter?.value === account &&
                       state.filters.bank === bank;
  
  if (isSameFilter) {
    filterManager.secondaryFilter = null;
  } else {
    filterManager.setSecondaryFilter('account', account);
    // Also update the bank in state.filters
    state.filters.bank = bank;
  }
  
  renderDashboardWithFilters();
}

/**
 * DEPRECATED: Use onPanel3Click() instead
 * Credit category filter
 */
function setDashboardCategoryFilter(category) {
  const key = String(category || '').trim() || 'Uncategorized';
  filterManager.setSecondaryFilter('creditCategory', key);
  renderDashboardWithFilters();
}

/**
 * DEPRECATED: Use onPanel3Click() instead
 * Credit reference filter
 */
function setDashboardReferenceFilter(reference) {
  const key = String(reference || '').trim() || 'No Reference';
  filterManager.setSecondaryFilter('creditReference', key);
  renderDashboardWithFilters();
}

/**
 * DEPRECATED: Use onPanel3Click() instead
 * Inter-division filter
 */
function setDashboardInterDivisionFilter(value) {
  const key = String(value || '').trim() || 'Unassigned';
  filterManager.setSecondaryFilter('interDivision', key);
  renderDashboardWithFilters();
}

/**
 * DEPRECATED: Use onPanel3Click() instead
 * Bank reference filter
 */
function setDashboardBankReferenceFilter(value) {
  const key = String(value || '').trim() || 'No Reference';
  filterManager.setSecondaryFilter('bankReference', key);
  renderDashboardWithFilters();
}
