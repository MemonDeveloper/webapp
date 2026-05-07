// ============================================================
// TRANSACTIONS PAGE
// ============================================================
function getTxnRegion(t) {
  return String((t && (t.region || (state.companyRegions && state.companyRegions[t.company]))) || '').trim();
}

function getTxnAccount(t) {
  return String((t && t.accountNumber) || '').trim();
}

function _matchesTransactionFilters(t, filters, skipKey = '') {
  const f = filters || state.filters;
  const company = String((t && t.company) || '').trim();
  const parentCompany = String((state.companyParents && state.companyParents[company]) || '').trim();
  const bankType = String((t && t.bankType) || '').trim();
  const people = String((t && t.people) || '').trim();
  const region = getTxnRegion(t);
  const bank = String((t && t.bank) || '').trim();
  const account = getTxnAccount(t);
  const currency = String((t && t.currency) || '').trim();

  if (skipKey !== 'company' && f.company !== 'All' && company !== f.company) return false;

  if (skipKey !== 'parentCompany' && f.parentCompany !== 'All') {
    const subs = getCompaniesForParent(f.parentCompany);
    if (!subs.includes(company)) return false;
  }

  if (skipKey !== 'bankType' && f.bankType !== 'All' && bankType !== f.bankType) return false;
  if (skipKey !== 'people' && f.people !== 'All' && people !== f.people) return false;
  if (skipKey !== 'region' && f.region !== 'All' && region !== f.region) return false;
  if (skipKey !== 'bank' && f.bank !== 'All' && bank !== f.bank) return false;
  if (skipKey !== 'account' && f.account !== 'All' && account !== f.account) return false;
  if (skipKey !== 'currency' && f.currency !== 'All' && currency !== f.currency) return false;

  if (skipKey !== 'search' && f.search) {
    const haystack = `${t.id}${company}${parentCompany}${bankType}${people}${region}${bank}${account}${currency}${t.name || ''}${t.description || ''}${t.reference || ''}`.toLowerCase();
    if (!haystack.includes(String(f.search || '').toLowerCase())) return false;
  }

  if (skipKey !== 'dateFrom' && f.dateFrom && t.date && t.date < f.dateFrom) return false;
  if (skipKey !== 'dateTo' && f.dateTo && t.date && t.date > f.dateTo) return false;
  return true;
}

function _sortFilterValues(values) {
  return values.sort((a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true }));
}

function getTransactionFilterOptions(filters = state.filters) {
  const keys = ['parentCompany', 'company', 'bankType', 'people', 'region', 'bank', 'account', 'currency'];
  const out = {};

  const valueByKey = {
    parentCompany: t => String((state.companyParents && state.companyParents[t.company]) || '').trim(),
    company: t => String((t && t.company) || '').trim(),
    bankType: t => String((t && t.bankType) || '').trim(),
    people: t => String((t && t.people) || '').trim(),
    region: t => getTxnRegion(t),
    bank: t => String((t && t.bank) || '').trim(),
    account: t => getTxnAccount(t),
    currency: t => String((t && t.currency) || '').trim(),
  };

  keys.forEach(key => {
    const set = new Set();
    state.transactions.forEach(t => {
      if (!_matchesTransactionFilters(t, filters, key)) return;
      const value = valueByKey[key](t);
      if (value) set.add(value);
    });
    out[key] = _sortFilterValues(Array.from(set));
  });

  return out;
}

function sanitizeTransactionFilterSelections(options) {
  const keys = ['parentCompany', 'company', 'bankType', 'people', 'region', 'bank', 'account', 'currency'];
  let changed = false;
  keys.forEach(key => {
    const current = state.filters[key] || 'All';
    if (current === 'All') return;
    const allowed = options[key] || [];
    if (!allowed.includes(current)) {
      state.filters[key] = 'All';
      changed = true;
    }
  });
  return changed;
}

function renderTransactions(area) {
  let txFilterOptions = getTransactionFilterOptions(state.filters);
  if (sanitizeTransactionFilterSelections(txFilterOptions)) {
    txFilterOptions = getTransactionFilterOptions(state.filters);
  }
  const activeFiltersCount = [
    state.filters.parentCompany,
    state.filters.company,
    state.filters.bankType,
    state.filters.people,
    state.filters.region,
    state.filters.bank,
    state.filters.account,
    state.filters.currency,
  ].filter(v => String(v || '').trim() && String(v || '').trim() !== 'All').length;

  area.innerHTML = `
    <div class="filter-bar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search transactions..." id="f-search" value="${state.filters.search}" oninput="applyFilter('search',this.value)">
      </div>
      <div class="filter-divider"></div>
      <div class="filter-group">
        <span class="filter-label">From</span>
        <input type="date" id="f-from" value="${state.filters.dateFrom}" onchange="applyFilter('dateFrom',this.value)">
      </div>
      <div class="filter-group">
        <span class="filter-label">To</span>
        <input type="date" id="f-to" value="${state.filters.dateTo}" onchange="applyFilter('dateTo',this.value)">
      </div>
      <div class="filter-spacer"></div>
      <div class="col-picker-wrap" id="txn-filter-wrap">
        <button class="btn btn-secondary btn-sm" onclick="toggleTxnFilterPanel(event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:4px"><path d="M3 4h18M6 12h12M10 20h4"/></svg>
          Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}
        </button>
        <div class="col-picker-dropdown" id="txn-filter-dropdown" style="display:${_txnFiltersPanelOpen ? 'block' : 'none'};min-width:380px;max-width:min(92vw,520px)">
          <div style="font-size:11px;font-weight:700;color:var(--text2);padding:10px 14px 6px;letter-spacing:.05em;text-transform:uppercase">Transaction Filters</div>
          <div style="padding:8px 14px 12px;display:grid;grid-template-columns:1fr 1fr;gap:10px 12px">
            <div class="filter-group" style="margin:0">
              <span class="filter-label">Parent Company</span>
              <select onchange="applyFilter('parentCompany',this.value)">
                <option value="All">All</option>
                ${txFilterOptions.parentCompany.map(p=>`<option ${state.filters.parentCompany===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group" style="margin:0">
              <span class="filter-label">Company</span>
              <select onchange="applyFilter('company',this.value)">
                <option value="All">All</option>
                ${txFilterOptions.company.map(c=>`<option ${state.filters.company===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group" style="margin:0">
              <span class="filter-label">People</span>
              <select onchange="applyFilter('people',this.value)">
                <option value="All">All</option>
                ${txFilterOptions.people.map(p=>`<option ${state.filters.people===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group" style="margin:0">
              <span class="filter-label">Region</span>
              <select onchange="applyFilter('region',this.value)">
                <option value="All">All</option>
                ${txFilterOptions.region.map(r=>`<option ${state.filters.region===r?'selected':''}>${r}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group" style="margin:0">
              <span class="filter-label">Bank Type</span>
              <select onchange="applyFilter('bankType',this.value)">
                <option value="All">All</option>
                ${txFilterOptions.bankType.map(b=>`<option ${state.filters.bankType===b?'selected':''}>${b}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group" style="margin:0">
              <span class="filter-label">Bank</span>
              <select onchange="applyFilter('bank',this.value)">
                <option value="All">All</option>
                ${txFilterOptions.bank.map(b=>`<option ${state.filters.bank===b?'selected':''}>${b}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group" style="margin:0">
              <span class="filter-label">Account</span>
              <select onchange="applyFilter('account',this.value)">
                <option value="All">All</option>
                ${txFilterOptions.account.map(a=>`<option ${state.filters.account===a?'selected':''}>${a}</option>`).join('')}
              </select>
            </div>
            <div class="filter-group" style="margin:0">
              <span class="filter-label">Currency</span>
              <select onchange="applyFilter('currency',this.value)">
                <option value="All">All</option>
                ${txFilterOptions.currency.map(c=>`<option ${state.filters.currency===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="padding:8px 14px;border-top:1px solid var(--border);margin-top:2px;display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="resetFilters()">Reset Filters</button>
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="closeTxnFilterPanel()">Close</button>
          </div>
        </div>
      </div>
      <div class="col-picker-wrap" id="col-picker-wrap">
        <button class="btn btn-secondary btn-sm" onclick="toggleColPicker(event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:4px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Columns
        </button>
        <div class="col-picker-dropdown" id="col-picker-dropdown" style="display:none">
          <div style="font-size:11px;font-weight:700;color:var(--text2);padding:10px 14px 6px;letter-spacing:.05em;text-transform:uppercase">Show / Hide Columns</div>
          ${ALL_COLS.map(c=>`
            <label class="col-picker-item">
              <input type="checkbox" ${state.visibleCols.has(c.key)?'checked':''} onchange="toggleCol('${c.key}',this.checked)">
              <span>${c.label}</span>
            </label>
          `).join('')}
          <div style="padding:8px 14px;border-top:1px solid var(--border);margin-top:4px;display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="resetColsToDefault()">Reset</button>
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="showAllCols()">All</button>
          </div>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="resetFilters()">Reset</button>
      <button class="btn btn-primary btn-sm" onclick="openModal('addTxnModal')">+ Add</button>
    </div>

    <div class="table-card" id="txn-table-wrap">
      <div class="table-header">
        <div class="table-title" id="txn-count-label">Loading...</div>
        <div class="table-actions" style="display:flex;align-items:center;gap:12px">
          ${state.openingBalance != null ? `<span style="font-size:12px;font-weight:600;color:var(--text2)">Opening: <strong style="color:var(--text)">${(state.openingBalance).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></span>` : ''}
          ${state.closingBalance != null ? `<span style="font-size:12px;font-weight:600;color:var(--text2)">Closing: <strong style="color:var(--text)">${(state.closingBalance).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></span>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="openModal('exportModal')">Export CSV</button>
        </div>
      </div>
      <div id="txn-table-body"></div>
      <div class="pagination" id="pagination"></div>
    </div>
  `;
  renderFilteredTable();
}

function getFiltered() {
  return state.transactions.filter(t => _matchesTransactionFilters(t, state.filters));
}

function renderFilteredTable() {
  const filtered = getFiltered();
  const total = filtered.length;
  const start = (state.page - 1) * state.rowsPerPage;
  const paged = filtered.slice(start, start + state.rowsPerPage);

  // Compute running balances for all filtered rows (oldest first)
  if (state.openingBalance != null) {
    const sorted = [...filtered].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    let running = state.openingBalance;
    const balMap = {};
    sorted.forEach(t => {
      balMap[t.id] = { opening: running, closing: running + (+t.amount || 0) };
      running = balMap[t.id].closing;
    });
    paged.forEach(t => {
      t._opening = balMap[t.id] != null ? balMap[t.id].opening : null;
      t._closing = balMap[t.id] != null ? balMap[t.id].closing : null;
    });
  } else {
    paged.forEach(t => { t._opening = null; t._closing = null; });
  }

  const label = document.getElementById('txn-count-label');
  if (label) label.innerHTML = `Transactions <span style="color:var(--text2);font-weight:400;font-size:13px">${total} records</span>`;
  document.getElementById('txn-count').textContent = total;

  const body = document.getElementById('txn-table-body');
  if (body) body.innerHTML = total === 0
    ? `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9.5 9h.01M14.5 9h.01"/></svg><h3>No transactions found</h3><p>Adjust your filters or import data</p></div>`
    : renderTableHTML(paged);

  const pg = document.getElementById('pagination');
  if (pg) {
    const pages = Math.ceil(total / state.rowsPerPage);
    pg.innerHTML = `
      <div class="pagination-info">Showing ${start+1}–${Math.min(start+state.rowsPerPage,total)} of ${total}</div>
      <div class="pagination-btns">
        <div class="page-btn" onclick="changePage(${state.page-1})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></div>
        ${Array.from({length:Math.min(pages,6)},(_,i)=>`<div class="page-btn ${i+1===state.page?'active':''}" onclick="changePage(${i+1})">${i+1}</div>`).join('')}
        <div class="page-btn" onclick="changePage(${state.page+1})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
      </div>
    `;
  }
}

function renderColCell(t, key) {
  const esc = s => String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  switch(key) {
    case 'transaction_id':      return `<td><span class="cell-id" style="font-size:11px">${esc(t.transaction_id||t.id)}</span></td>`;
    case 'fileName':            return `<td style="color:var(--text2);white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${esc(t.fileName)}">${esc(t.fileName)}</td>`;
    case 'uploadDate':          return `<td style="color:var(--text2);white-space:nowrap">${esc(t.uploadDate)}</td>`;
    case 'people':              return `<td style="color:var(--text2);white-space:nowrap">${esc(t.people||'')}</td>`;
    case 'parentCompanies':     return `<td style="color:var(--text2);white-space:nowrap">${esc((t.parentCompany||state.companyParents[t.company]||''))}</td>`;
    case 'company':             return `<td><span class="company-badge" style="background:${(getCompanyColor(t.company,'primary')||'#888')+'18'};color:${getCompanyColor(t.company,'secondary')||'#888'}">${esc(t.company)}</span></td>`;
    case 'regions':             return `<td style="color:var(--text2);white-space:nowrap">${esc((t.region||state.companyRegions[t.company]||''))}</td>`;
    case 'bankTypes':           return `<td style="color:var(--text2);white-space:nowrap">${esc(t.bankType||'')}</td>`;
    case 'bank':                return `<td style="color:var(--text2)">${esc(t.bank)}</td>`;
    case 'accountNumber':       return `<td style="color:var(--text2);font-size:11px">${esc(t.accountNumber||'')}</td>`;
    case 'currency':            return `<td><span class="badge badge-gray">${esc(t.currency)}</span></td>`;
    case 'currency_rate':       return `<td style="text-align:right;color:var(--text2)">${(+(t.currency_rate)||0).toFixed(6)}</td>`;
    case 'date':                return `<td style="white-space:nowrap;color:var(--text2)">${esc(t.date)}</td>`;
    case 'date_2':              return `<td style="white-space:nowrap;color:var(--text2)">${esc(t.date_2||'')}</td>`;
    case 'status':              return `<td>${statusBadge(t.status)}</td>`;
    case 'name':                return `<td><span class="cell-name">${esc(t.name)}</span></td>`;
    case 'category':            return `<td style="color:var(--text2)">${esc(t.category||'')}</td>`;
    case 'reference_id':        return `<td style="color:var(--text2);font-size:11px">${esc(t.referenceId||'')}</td>`;
    case 'reference':           return `<td><input class="inline-edit" value="${esc(t.reference||'')}" data-txn-id="${t.id}" onblur="saveReference(this.dataset.txnId,this.value)" onkeydown="if(event.key==='Enter')this.blur()" style="min-width:110px"></td>`;
    case 'transaction_reference': return `<td style="color:var(--text2);font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.transactionReference)}">${esc(t.transactionReference||'')}</td>`;
    case 'description':         return `<td><textarea class="inline-edit inline-edit-area" data-txn-id="${t.id}" data-field="description" onblur="saveField(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();this.blur()}">${esc(t.description)}</textarea></td>`;
    case 'inter_division':      return `<td><input class="inline-edit" data-txn-id="${t.id}" data-field="interDivision" value="${esc(t.interDivision||'')}" onblur="saveField(this)" onkeydown="if(event.key==='Enter')this.blur()" style="min-width:100px"></td>`;
    case 'net_amount':          return `<td style="text-align:right;color:var(--text2)">${(+(t.net_amount)||0).toFixed(2)}</td>`;
    case 'fee':                 return `<td style="text-align:right;color:var(--text2)">${(+(t.fee)||0).toFixed(2)}</td>`;
    case 'vat':                 return `<td style="text-align:right;color:var(--text2)">${(+(t.vat)||0).toFixed(2)}</td>`;
    case 'amount':              return `<td style="text-align:right"><span class="${t.amount>=0?'amount-positive':'amount-negative'}">${t.amount>=0?'+':''}${(+t.amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</span></td>`;
    case 'openingBalance':      return `<td style="text-align:right;color:var(--text2);white-space:nowrap;font-size:11px">${t._opening != null ? `<span style="color:var(--text2);font-weight:600">Opening: <strong style="color:var(--text)">${t._opening.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></span>` : ''}</td>`;
    case 'closingBalance':      return `<td style="text-align:right;white-space:nowrap;font-size:11px"><span style="color:var(--text2);font-weight:600">Closing: <strong style="color:var(--text)">${t._closing != null ? t._closing.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}</strong></span></td>`;
    case 'is_split':            return `<td style="text-align:center;color:var(--text2)">${t.isSplit?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l5.1 5.1M4 4l5 5"/></svg>':''}</td>`;
    case 'createdDate':         return `<td style="color:var(--text2);white-space:nowrap">${esc(t.createdDate||'')}</td>`;
    case 'updatedDate':         return `<td style="color:var(--text2);white-space:nowrap">${esc(t.updatedDate||'')}</td>`;
    case 'lastModification':    return `<td style="color:var(--text2);white-space:nowrap">${esc(t.lastModification||'')}</td>`;
    default: return '<td></td>';
  }
}

function renderTableHTML(txns) {
  const cols = ALL_COLS.filter(c => state.visibleCols.has(c.key));
  const thAlign = a => a === 'right' ? ' style="text-align:right"' : a === 'center' ? ' style="text-align:center"' : '';
  return `
    <div style="overflow-x:auto">
    <table style="font-size:12px">
      <thead>
        <tr>
          ${cols.map(c=>`<th${thAlign(c.align)} style="white-space:nowrap">${c.label}</th>`).join('')}
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${txns.map(t=>`
          <tr>
            ${cols.map(c=>renderColCell(t,c.key)).join('')}
            <td><div class="icon-btn danger" data-txn-id="${t.id}" onclick="deleteTxn(this.dataset.txnId)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></div></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
}

function saveField(el) {
  const id = el.dataset.txnId;
  const field = el.dataset.field;
  const val = el.value;
  const t = state.transactions.find(x => x.id === id);
  if (!t || t[field] === val) return;
  t[field] = val;
  dbPut('transactions', t);
}

function saveReference(id, val) {
  const t = state.transactions.find(x => x.id === id);
  if (!t || t.reference === val) return;
  t.reference = val;
  dbPut('transactions', t);
}

function toggleCol(key, visible) {
  if (visible) state.visibleCols.add(key);
  else state.visibleCols.delete(key);
  renderFilteredTable();
}

function resetColsToDefault() {
  state.visibleCols = new Set(DEFAULT_COLS);
  // re-render col picker checkboxes
  document.querySelectorAll('#col-picker-dropdown input[type=checkbox]').forEach(cb => {
    const key = cb.getAttribute('onchange').match(/'([^']+)'/)[1];
    cb.checked = state.visibleCols.has(key);
  });
  renderFilteredTable();
}

function showAllCols() {
  state.visibleCols = new Set(ALL_COLS.map(c=>c.key));
  document.querySelectorAll('#col-picker-dropdown input[type=checkbox]').forEach(cb => cb.checked = true);
  renderFilteredTable();
}

function toggleColPicker(e) {
  e.stopPropagation();
  const dd = document.getElementById('col-picker-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function toggleTxnFilterPanel(e) {
  if (e) e.stopPropagation();
  _txnFiltersPanelOpen = !_txnFiltersPanelOpen;
  const dd = document.getElementById('txn-filter-dropdown');
  if (dd) dd.style.display = _txnFiltersPanelOpen ? 'block' : 'none';
}

function closeTxnFilterPanel() {
  _txnFiltersPanelOpen = false;
  const dd = document.getElementById('txn-filter-dropdown');
  if (dd) dd.style.display = 'none';
}

// Close col picker on outside click
document.addEventListener('click', e => {
  const dd = document.getElementById('col-picker-dropdown');
  if (dd && !document.getElementById('col-picker-wrap').contains(e.target)) {
    dd.style.display = 'none';
  }

  const filterDd = document.getElementById('txn-filter-dropdown');
  const filterWrap = document.getElementById('txn-filter-wrap');
  if (filterDd && filterWrap && !filterWrap.contains(e.target)) {
    closeTxnFilterPanel();
  }
});

function statusBadge(s) {
  const map = {Completed:'badge-green',Pending:'badge-amber',Processing:'badge-blue',Failed:'badge-red'};
  return `<span class="badge ${map[s]||'badge-gray'}">${s}</span>`;
}

function applyFilter(key, val) {
  state.filters[key] = val;
  if (key === 'bankType') {
    state.filters.company = 'All';
    state.filters.parentCompany = 'All';
    state.filters.people = 'All';
    state.filters.region = 'All';
    state.filters.bank = 'All';
    state.filters.account = 'All';
    state.filters.currency = 'All';
    state.filters.creditAmountMode = 'all';
    state.filters.bankCashMode = 'all';
    state.filters.creditCategory = 'All';
    state.filters.creditReference = 'All';
    state.filters.bankInterDivision = 'All';
    state.filters.bankReference = 'All';
  }
  if (key === 'bankType' && !String(val || '').toLowerCase().includes('credit')) {
    state.filters.creditAmountMode = 'all';
    state.filters.creditCategory = 'All';
    state.filters.creditReference = 'All';
  }
  if (key === 'bankType' && !String(val || '').toLowerCase().includes('bank')) {
    state.filters.bankCashMode = 'all';
  }
  if (key === 'bankType' && String(val || '').toLowerCase().includes('credit')) {
    state.filters.bankInterDivision = 'All';
    state.filters.bankReference = 'All';
  }
  state.page = 1;
  if (state.currentPage === 'transactions') {
    const linkedKeys = new Set(['parentCompany', 'company', 'bankType', 'people', 'region', 'bank', 'account', 'currency']);
    if (linkedKeys.has(key)) {
      _txnFiltersPanelOpen = true;
      renderTransactions(document.getElementById('content-area'));
    }
    else renderFilteredTable();
  }
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function resetFilters() {
  state.filters = { company:'All', parentCompany:'All', bankType:'All', people:'All', region:'All', bank:'All', account:'All', currency:'All', search:'', dateFrom:'', dateTo:'', chartGranularity: state.filters.chartGranularity || 'daily', creditAmountMode:'all', bankCashMode:'all', creditCategory:'All', creditReference:'All', bankInterDivision:'All', bankReference:'All' };
  _txnFiltersPanelOpen = false;
  renderTransactions(document.getElementById('content-area'));
}

function changePage(p) {
  const filtered = getFiltered();
  const pages = Math.ceil(filtered.length / state.rowsPerPage);
  if (p < 1 || p > pages) return;
  state.page = p;
  renderFilteredTable();
}

// ============================================================
// ADD / DELETE TRANSACTION
// ============================================================
function addTransaction() {
  const name = document.getElementById('add-name').value.trim();
  const amount = parseFloat(document.getElementById('add-amount').value);
  if (!name || isNaN(amount)) { toast('Please fill required fields','error'); return; }

  const t = {
    id: `TXN-${Date.now()}`,
    transaction_id: '',
    fileName: 'Manual',
    uploadDate: new Date().toISOString().split('T')[0],
    date: document.getElementById('add-date').value || new Date().toISOString().split('T')[0],
    date_2: '',
    status: document.getElementById('add-status').value,
    name, amount,
    net_amount: amount,
    description: document.getElementById('add-desc').value,
    category: document.getElementById('add-category').value,
    reference: document.getElementById('add-reference').value,
    referenceId: '',
    transactionReference: '',
    interDivision: '',
    currency: document.getElementById('add-currency').value,
    currency_rate: safeFloat((_currencyRateState.byCurrency || {})[document.getElementById('add-currency').value]),
    company: document.getElementById('add-company').value,
    bankType: document.getElementById('add-banktype').value,
    bank: document.getElementById('add-bank').value || 'Manual Entry',
    accountNumber: document.getElementById('add-account-number').value.trim(),
    fee: parseFloat(document.getElementById('add-fee').value)||0,
    vat: parseFloat(document.getElementById('add-vat').value)||0,
    isSplit: false
  };

  state.transactions.unshift(t);
  dbPut('transactions', t);
  addAuditEntry('Transaction Added', `${t.id} · ${t.company} · ${t.currency} ${t.amount}`, '#8b5cf6');
  updateSidebarBalances();
  document.getElementById('txn-count').textContent = state.transactions.length;
  closeModal('addTxnModal');
  toast(`Transaction ${t.id} added`, 'success');

  if (state.currentPage==='transactions') renderFilteredTable();
  else if (state.currentPage==='dashboard') renderDashboard(document.getElementById('content-area'));
}

function deleteTxn(id) {
  if (!confirm(`Delete transaction ${id}?`)) return;
  state.transactions = state.transactions.filter(t=>t.id!==id);
  dbDelete('transactions', id);
  addAuditEntry('Transaction Deleted', `${id} removed`, '#ef4444');
  document.getElementById('txn-count').textContent = state.transactions.length;
  updateSidebarBalances();
  renderFilteredTable();
  toast(`${id} deleted`,'info');
}

