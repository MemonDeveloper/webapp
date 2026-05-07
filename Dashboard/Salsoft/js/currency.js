function normalizeCurrencyForUsdApi(code) {
  const txt = String(code || '').trim().toUpperCase();
  const aliases = {
    EURO: 'EUR',
  };
  return aliases[txt] || txt;
}

function getUtcDateKey(d) {
  const dt = d instanceof Date ? d : new Date();
  return dt.toISOString().slice(0, 10);
}

function readUsdRatesCache() {
  try {
    const raw = localStorage.getItem(USD_RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.utcDate || !parsed.usdMap || typeof parsed.usdMap !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeUsdRatesCache(utcDate, apiDate, usdMap) {
  try {
    localStorage.setItem(USD_RATES_CACHE_KEY, JSON.stringify({ utcDate, apiDate, usdMap }));
  } catch (_) {
    // Ignore storage failures and continue with in-memory rates.
  }
}

function applyUsdMapToCurrentCurrencies(usdMap, apiDate, signature, now) {
  const byCurrency = {};
  (state.currencies || []).forEach(code => {
    const normalized = normalizeCurrencyForUsdApi(code).toLowerCase();
    const rate = usdMap[normalized];
    byCurrency[code] = Number.isFinite(Number(rate)) ? Number(rate) : null;
  });
  _currencyRateState.byCurrency = byCurrency;
  _currencyRateState.date = String(apiDate || '').trim();
  _currencyRateState.lastCurrencySig = signature;
  _currencyRateState.lastFetchedAt = now;
}

function formatUsdRate(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'N/A';
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  if (n > 0) return n.toFixed(6);
  return '0';
}

function getNextUtcMidnightMs(nowMs) {
  const now = new Date(nowMs || Date.now());
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
}

function formatDurationHms(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function updateCurrencyRefreshTimerText() {
  const timerEl = document.getElementById('currency-refresh-timer');
  if (!timerEl) return;
  const now = Date.now();
  const nextUtc = getNextUtcMidnightMs(now);
  timerEl.textContent = `Next UTC refresh in ${formatDurationHms(nextUtc - now)} (00:00 UTC)`;
}

function stopCurrencyRefreshTicker() {
  if (_currencyRefreshTimerId) {
    clearInterval(_currencyRefreshTimerId);
    _currencyRefreshTimerId = null;
  }
}

function startCurrencyRefreshTicker() {
  stopCurrencyRefreshTicker();
  updateCurrencyRefreshTimerText();
  _currencyRefreshTimerId = setInterval(() => {
    const timerEl = document.getElementById('currency-refresh-timer');
    if (!timerEl) {
      stopCurrencyRefreshTicker();
      return;
    }
    updateCurrencyRefreshTimerText();

    const cache = readUsdRatesCache();
    const utcToday = getUtcDateKey(new Date());
    if (!_currencyRateState.loading && (!cache || cache.utcDate !== utcToday)) {
      fetchUsdRatesForCurrencies();
    }
  }, 1000);
}

function refreshCurrencyRateCard() {
  const bodyEl = document.getElementById('sc-currency');
  if (bodyEl) bodyEl.innerHTML = renderCurrencyRateRows();
  const metaEl = document.getElementById('currency-rate-meta');
  if (metaEl) {
    if (_currencyRateState.loading) metaEl.textContent = 'Fetching USD today rates...';
    else if (_currencyRateState.error) metaEl.textContent = `Rate fetch failed: ${_currencyRateState.error}`;
    else if (_currencyRateState.date) metaEl.textContent = `As of ${_currencyRateState.date} (base USD)`;
    else metaEl.textContent = 'Rates not loaded';
  }
  updateCurrencyRefreshTimerText();
  applySettingsRowLimit();
}

function renderCurrencyRateRows() {
  return (state.currencies || []).map((item, i) => {
    const rateVal = _currencyRateState.byCurrency[item];
    const rateText = formatUsdRate(rateVal);
    return `
      <div class="settings-item">
        <div>
          <div class="settings-item-name" style="display:flex;align-items:center;gap:8px">${item}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">1 USD = ${rateText} ${item}</div>
        </div>
        <div class="settings-item-actions">
          <div class="icon-btn" onclick="openEditSettingModal('currency',${i},'Currencies')" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </div>
          <div class="icon-btn danger" onclick="removeSettingItem('currency',${i})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function fetchUsdRatesForCurrencies() {
  let force = false;
  if (arguments.length && arguments[0] === true) force = true;
  const signature = JSON.stringify((state.currencies || []).map(c => String(c || '').trim()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  const now = Date.now();
  const utcToday = getUtcDateKey(new Date(now));

  if (!force && _currencyRateState.lastCurrencySig === signature && (now - _currencyRateState.lastFetchedAt) < 300000) {
    refreshCurrencyRateCard();
    return;
  }

  const cache = readUsdRatesCache();
  if (!force && cache && cache.utcDate === utcToday) {
    applyUsdMapToCurrentCurrencies(cache.usdMap, cache.apiDate || utcToday, signature, now);
    refreshCurrencyRateCard();
    return;
  }

  if (_currencyRateState.loading && _currencyRateState.pendingPromise) return _currencyRateState.pendingPromise;
  _currencyRateState.loading = true;
  _currencyRateState.error = '';
  refreshCurrencyRateCard();

  _currencyRateState.pendingPromise = (async () => {
    try {
      const res = await fetch(USD_RATES_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const usdMap = data && data.usd ? data.usd : {};
      const apiDate = String(data.date || '').trim() || utcToday;
      applyUsdMapToCurrentCurrencies(usdMap, apiDate, signature, now);
      writeUsdRatesCache(utcToday, apiDate, usdMap);
    } catch (err) {
      _currencyRateState.error = (err && err.message) ? err.message : 'Unknown error';
    } finally {
      _currencyRateState.loading = false;
      _currencyRateState.pendingPromise = null;
      refreshCurrencyRateCard();
    }
  })();

  return _currencyRateState.pendingPromise;
}

async function refreshCurrencyRatesNow() {
  try {
    const res = await fetch('/api/settings/currency-rates/refresh', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    localStorage.removeItem(USD_RATES_CACHE_KEY);
    _currencyRateState.lastCurrencySig = '';
    _currencyRateState.lastFetchedAt = 0;
    await fetchUsdRatesForCurrencies(true);
    await loadFromDB();
    if (state.currentPage === 'transactions') renderFilteredTable();
    else if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
    const added = Number(payload && payload.addedCount ? payload.addedCount : 0);
    toast(`Currency rates refreshed (${added} missing dates added)`, 'success');
  } catch (e) {
    toast('Refresh failed: ' + (e.message || e), 'error');
  }
}

function settingsCardCurrencies() {
  return `
    <div class="settings-card">
      <div class="settings-card-header">
        <div>
          <div class="settings-card-title">Currencies</div>
          <div id="currency-rate-meta" style="font-size:11px;color:var(--text2);margin-top:4px">${_currencyRateState.loading ? 'Fetching USD today rates...' : (_currencyRateState.date ? `As of ${_currencyRateState.date} (base USD)` : 'Rates not loaded')}</div>
          <div id="currency-refresh-timer" style="font-size:11px;color:var(--text2);margin-top:2px">Next UTC refresh in --:--:-- (00:00 UTC)</div>
        </div>
        <div class="settings-card-tools">
          <button class="btn btn-secondary btn-sm" onclick="refreshCurrencyRatesNow()">Refresh</button>
          <button class="btn btn-secondary btn-sm" onclick="exportSettingsData('currency')">Export</button>
          <button class="btn btn-secondary btn-sm" onclick="triggerSettingsImport('currency')">Import</button>
          <button class="btn btn-primary btn-sm" onclick="openAddSettingModal('currency','Currencies')">+ Add</button>
        </div>
        <input class="settings-file-input" type="file" id="settings-import-currency" accept=".csv,.xlsx,.xls" onchange="handleSettingsImport(this,'currency')">
      </div>
      <div class="settings-card-body settings-scroll settings-limit-rows" id="sc-currency">
        ${renderCurrencyRateRows()}
      </div>
    </div>
  `;
}

function clearStore(store) {
  const labels = { transactions: 'all transactions', people: 'all people', auditLog: 'the audit log' };
  if (!confirm(`Are you sure you want to delete ${labels[store]}? This cannot be undone.`)) return;
  fetch(`/api/data/${_apiStore(store)}`, { method: 'DELETE' });
  if (store === 'transactions') { state.transactions = []; updateSidebarBalances(); document.getElementById('txn-count').textContent = 0; }
  else if (store === 'people') state.people = [];
  else if (store === 'auditLog') state.auditLog = [];
  addAuditEntry(`${store.charAt(0).toUpperCase()+store.slice(1)} Cleared`, 'All records deleted', '#ef4444');
  toast(`${labels[store].charAt(0).toUpperCase()+labels[store].slice(1)} deleted`, 'info');
  renderSettings(document.getElementById('content-area'));
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function clearAllData() {
  if (!confirm('Reset EVERYTHING? All transactions, people, audit log, and settings will be permanently deleted.')) return;
  ['transactions', 'people', 'audit_log', 'settings'].forEach(store => {
    fetch(`/api/data/${store}`, { method: 'DELETE' });
  });
  state.transactions = [];
  state.people = [];
  state.auditLog = [];
  state.companies = [];
  state.companyRegions = {};
  state.companyParents = {};
  state.companyColors2 = {};
  state.parentCompanies = [];
  state.regions = [];
  state.bankTypes = [];
  state.banks = [];
  state.bankShortNameList = [];
  state.bankChildShortNamesList = [];
  state.bankForAccountList = [];
  state.bankTypeList = [];
  state.bankAccountList = [];
  state.accountCompanyList = [];
  state.accountRegionList = [];
  state.bankCurrencyList = [];
  state.bankAccounts = {};
  state.currencies = [];
  state.beginningBalanceKeywords = [];
  state.openingBalance = null;
  state.closingBalance = null;
  sortSettingsLists();
  syncBankAccountState();
  updateSidebarBalances();
  document.getElementById('txn-count').textContent = 0;
  toast('All data has been reset', 'info');
  renderSettings(document.getElementById('content-area'));
  renderDashboard(document.getElementById('content-area'));
}

function applySettingsRowLimit() {
  const bodies = document.querySelectorAll('.settings-card-body.settings-limit-rows');
  bodies.forEach(body => {
    const rows = body.querySelectorAll(':scope > .settings-item');
    if (rows.length <= 6) {
      body.style.maxHeight = '';
      body.style.overflowY = '';
      return;
    }
    let total = 0;
    for (let i = 0; i < 6; i++) total += rows[i].offsetHeight;
    // If layout is not ready yet (0 heights), defer a second pass.
    if (!total) {
      setTimeout(applySettingsRowLimit, 40);
      return;
    }
    const cs = window.getComputedStyle(body);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    body.style.maxHeight = `${Math.ceil(total + padTop + padBottom + 2)}px`;
    body.style.overflowY = 'auto';
    body.style.overflowX = 'hidden';
  });
}

function triggerSettingsImport(key) {
  const input = document.getElementById(`settings-import-${key}`);
  if (!input) return;
  input.value = '';
  input.click();
}

function _firstNonEmptyValue(row) {
  const values = Object.values(row || {});
  for (let i = 0; i < values.length; i++) {
    const val = String(values[i] ?? '').trim();
    if (val) return val;
  }
  return '';
}

async function handleSettingsImport(input, key) {
  const file = input && input.files ? input.files[0] : null;
  if (!file) return;

  let rows = [];
  try {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer();
      rows = parseXLSX(buf);
    } else {
      const text = await file.text();
      rows = parseCSV(text);
    }
  } catch (e) {
    toast('Settings import failed: ' + e.message, 'error');
    return;
  }

  if (!rows.length) {
    toast('No rows found in selected file', 'error');
    return;
  }

  let imported = 0;

  if (key === 'company') {
    rows.forEach(r => {
      const name = String(r.company || r.companyname || r.name || _firstNonEmptyValue(r) || '').trim();
      if (!name) return;

      const parent = String(r.parentcompany || r.parent || '').trim();
      const region = String(r.region || '').trim();
      const primary = String(r.primarycolor || r.primary || r.color1 || '').trim();
      const secondary = String(r.secondarycolor || r.secondary || r.color2 || '').trim();

      if (!state.companies.includes(name)) {
        state.companies.push(name);
        imported++;
      }
      if (parent) {
        state.companyParents[name] = parent;
        if (!state.parentCompanies.includes(parent)) state.parentCompanies.push(parent);
      }
      if (region) state.companyRegions[name] = region;
      if (primary || secondary) {
        if (!state.companyColors2) state.companyColors2 = {};
        const existing = state.companyColors2[name] || {};
        state.companyColors2[name] = {
          primary: primary || existing.primary || getCompanyColor(name, 'primary'),
          secondary: secondary || existing.secondary || primary || getCompanyColor(name, 'secondary'),
        };
      }
    });
  } else if (key === 'bank') {
    rows.forEach(r => {
      const bank = String(r.bank || r.bankname || r.name || _firstNonEmptyValue(r) || '').trim();
      if (!bank) return;
      const shortName = String(r.primaryshortname || r.bankshortname || r.shortname || r.short || '').trim();
      const childShorts = normalizeChildShortNames(r.childshortnames || r.bankchildshortnames || r.children || '');
      const existingBank = findExistingBankName(bank);
      if (existingBank) return;

      state.banks.push(bank);
      state.bankShortNameList.push(shortName);
      state.bankChildShortNamesList.push(childShorts);
      imported++;
    });
  } else if (key === 'account') {
    rows.forEach(r => {
      const company = String(r.company || r.companyname || '').trim() || (state.companies[0] || '');
      const bankRaw = String(r.bank || r.bankname || '').trim();
      const bankType = String(r.banktype || r.type || '').trim();
      const account = String(r.accountnumber || r.account || r.acc || _firstNonEmptyValue(r) || '').trim();
      const region = String(r.region || r.accountregion || '').trim() || (state.regions[0] || '');
      const currency = String(r.currency || r.curr || '').trim() || (state.currencies[0] || '');
      if (!company || !bankRaw || !account) return;

      let bank = findExistingBankName(bankRaw) || bankRaw;

      if (!findExistingBankName(bank)) {
        state.banks.push(bank);
        const shortName = String(r.bankshortname || r.shortname || r.short || '').trim();
        state.bankShortNameList.push(shortName);
      }

      const exists = state.bankForAccountList.some((b, idx) => (
        String(state.accountCompanyList[idx] || '') === company &&
        b === bank &&
        String(state.bankTypeList[idx] || '') === bankType &&
        String(state.bankAccountList[idx] || '') === account &&
        String(state.accountRegionList[idx] || '') === region &&
        String(state.bankCurrencyList[idx] || '') === currency
      ));
      if (exists) return;

      state.accountCompanyList.push(company);
      state.bankForAccountList.push(bank);
      state.bankTypeList.push(bankType);
      state.bankAccountList.push(account);
      state.accountRegionList.push(region);
      state.bankCurrencyList.push(currency);
      if (company && !state.companies.includes(company)) state.companies.push(company);
      if (region && !state.regions.includes(region)) state.regions.push(region);
      if (!state.bankTypes.includes(bankType)) state.bankTypes.push(bankType);
      imported++;
    });
  } else {
    const arr = _getSettingArrayByKey(key);
    if (!arr) {
      toast('Unsupported settings import target', 'error');
      return;
    }

    rows.forEach(r => {
      let val = '';
      if (key === 'parentCompany') val = String(r.parentcompany || r.parent || _firstNonEmptyValue(r) || '').trim();
      else if (key === 'region') val = String(r.region || r.regions || _firstNonEmptyValue(r) || '').trim();
      else if (key === 'bankType') val = String(r.banktype || r.type || _firstNonEmptyValue(r) || '').trim();
      else if (key === 'currency') val = String(r.currency || r.code || _firstNonEmptyValue(r) || '').trim();
      else if (key === 'beginningBalanceKeywords') val = String(r.keyword || r.keywords || _firstNonEmptyValue(r) || '').trim();
      else val = _firstNonEmptyValue(r);

      if (!val) return;
      if (arr.includes(val)) return;
      arr.push(val);
      imported++;
    });
  }

  syncBankAccountState();
  saveSettings();
  renderCompanyChips();
  renderSettings(document.getElementById('content-area'));
  toast(`${imported} row(s) imported`, imported ? 'success' : 'info');
}

async function exportSettingsData(key) {
  let rows = [];
  let fileName = 'settings-export';

  if (key === 'company') {
    fileName = 'settings-companies';
    rows = [['Company', 'Parent Company', 'Region', 'Primary Color', 'Secondary Color']];
    state.companies.forEach(name => {
      const colors = (state.companyColors2 && state.companyColors2[name]) || {};
      rows.push([
        name,
        state.companyParents[name] || '',
        state.companyRegions[name] || '',
        colors.primary || getCompanyColor(name, 'primary') || '',
        colors.secondary || getCompanyColor(name, 'secondary') || '',
      ]);
    });
  } else if (key === 'bank') {
    fileName = 'settings-banks';
    rows = [['Bank', 'Primary Short Name', 'Child Short Names']];
    state.banks.forEach((bank, idx) => {
      rows.push([
        bank,
        state.bankShortNameList[idx] || '',
        getBankChildShortNames(bank).join(', '),
      ]);
    });
  } else if (key === 'account') {
    fileName = 'settings-accounts';
    rows = [['Company', 'Bank', 'Bank Short Name', 'Bank Type', 'Account Number', 'Region', 'Currency']];
    state.bankForAccountList.forEach((bank, idx) => {
      rows.push([
        state.accountCompanyList[idx] || '',
        bank,
        getBankShortName(bank),
        state.bankTypeList[idx] || '',
        state.bankAccountList[idx] || '',
        state.accountRegionList[idx] || '',
        state.bankCurrencyList[idx] || '',
      ]);
    });
  } else if (key === 'parentCompany') {
    fileName = 'settings-parent-companies';
    rows = [['Parent Company'], ...state.parentCompanies.map(v => [v])];
  } else if (key === 'region') {
    fileName = 'settings-regions';
    rows = [['Region'], ...(state.regions || []).map(v => [v])];
  } else if (key === 'bankType') {
    fileName = 'settings-bank-types';
    rows = [['Bank Type'], ...state.bankTypes.map(v => [v])];
  } else if (key === 'currency') {
    await fetchUsdRatesForCurrencies();
    fileName = 'settings-currencies';
    rows = [['Currency', 'USD Rate', 'Rate Date']];
    state.currencies.forEach(v => {
      rows.push([
        v,
        formatUsdRate(_currencyRateState.byCurrency[v]),
        _currencyRateState.date || '',
      ]);
    });
  } else if (key === 'beginningBalanceKeywords') {
    fileName = 'settings-beginning-balance-keywords';
    rows = [['Keyword'], ...state.beginningBalanceKeywords.map(v => [v])];
  } else {
    toast('Unsupported settings export target', 'error');
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Settings');
  XLSX.writeFile(wb, `${fileName}-${getExportTimestamp()}.xlsx`);
  toast('Settings exported', 'success');
}

function getExportTimestamp() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const mmmm = String(d.getMilliseconds()).padStart(3, '0') + '0';
  return `${dd}${mm}${yy}${hh}${ss}${mi}:${mmmm}`;
}

function settingsCardCompanies() {
  return `
    <div class="settings-card">
      <div class="settings-card-header">
        <div class="settings-card-title">Companies</div>
        <div class="settings-card-tools">
          <button class="btn btn-secondary btn-sm" onclick="exportSettingsData('company')">Export</button>
          <button class="btn btn-secondary btn-sm" onclick="triggerSettingsImport('company')">Import</button>
          <button class="btn btn-primary btn-sm" onclick="openAddCompanyModal()">+ Add</button>
        </div>
        <input class="settings-file-input" type="file" id="settings-import-company" accept=".csv,.xlsx,.xls" onchange="handleSettingsImport(this,'company')">
      </div>
      <div class="settings-card-body settings-scroll settings-limit-rows" id="sc-company">
        ${state.companies.map((item, i) => `
          <div class="settings-item">
            <div>
              <div class="settings-item-name" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="display:inline-flex;gap:5px">
                  <span style="width:14px;height:14px;border-radius:50%;background:${getCompanyColor(item,'primary')};display:inline-block;flex-shrink:0"></span>
                  <span style="width:14px;height:14px;border-radius:50%;background:${getCompanyColor(item,'secondary')};display:inline-block;flex-shrink:0"></span>
                </span>
                <span>${item}</span>
              </div>
              <div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.45;word-break:break-word">
                Parent: ${state.companyParents[item] || '—'}
                &nbsp; | &nbsp; Region: ${state.companyRegions[item] || '—'}
              </div>
            </div>
            <div class="settings-item-actions">
              <div class="icon-btn" onclick="openEditCompanyModal(${i})" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              </div>
              <div class="icon-btn danger" onclick="removeSettingItem('company',${i})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function openAddCompanyModal() {
  _editingCompanyName = null;
  const titleEl = document.getElementById('add-company-modal-title');
  const submitEl = document.getElementById('add-company-submit-btn');
  const nameEl = document.getElementById('ac-name');
  const regionEl = document.getElementById('ac-region');
  const parentEl = document.getElementById('ac-parent');
  if (titleEl) titleEl.textContent = 'Add Company';
  if (submitEl) submitEl.textContent = 'Add Company';
  if (nameEl) nameEl.value = '';
  populateCompanyRegionOptions('');
  if (regionEl) regionEl.value = '';
  if (parentEl) parentEl.value = '';
  const c1 = document.getElementById('ac-color1'); if (c1) c1.value = '#3b82f6';
  const c2 = document.getElementById('ac-color2'); if (c2) c2.value = '#1d4ed8';
  openModal('addCompanyModal');
}

function populateCompanyRegionOptions(selectedRegion) {
  const regionEl = document.getElementById('ac-region');
  if (!regionEl) return;
  const options = [...new Set((state.regions || []).map(r => String(r || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (selectedRegion && !options.includes(selectedRegion)) options.push(selectedRegion);
  regionEl.innerHTML = `<option value="">Select Region</option>${options.map(r => `<option value="${r}">${r}</option>`).join('')}`;
  regionEl.value = selectedRegion || '';
}

function openEditCompanyModal(idx) {
  const name = state.companies[idx];
  if (!name) return;
  _editingCompanyName = name;
  const titleEl = document.getElementById('add-company-modal-title');
  const submitEl = document.getElementById('add-company-submit-btn');
  const nameEl = document.getElementById('ac-name');
  const regionEl = document.getElementById('ac-region');
  const parentEl = document.getElementById('ac-parent');
  const selectedRegion = state.companyRegions[name] || '';
  if (titleEl) titleEl.textContent = 'Edit Company';
  if (submitEl) submitEl.textContent = 'Update Company';
  if (nameEl) nameEl.value = name;
  populateCompanyRegionOptions(selectedRegion);
  if (regionEl) regionEl.value = selectedRegion;
  if (parentEl) parentEl.value = state.companyParents[name] || '';
  const existColors = (state.companyColors2 && state.companyColors2[name]) || { primary: getCompanyColor(name,'primary'), secondary: getCompanyColor(name,'secondary') };
  const c1 = document.getElementById('ac-color1'); if (c1) c1.value = existColors.primary;
  const c2 = document.getElementById('ac-color2'); if (c2) c2.value = existColors.secondary;
  openModal('addCompanyModal');
}

function submitAddCompanyModal() {
  const isEditMode = !!_editingCompanyName;
  const name = (document.getElementById('ac-name')?.value || '').trim();
  const region = (document.getElementById('ac-region')?.value || '').trim();
  const parent = (document.getElementById('ac-parent')?.value || '').trim();
  const color1 = document.getElementById('ac-color1')?.value || '#3b82f6';
  const color2 = document.getElementById('ac-color2')?.value || '#1d4ed8';

  if (!name) { toast('Company name is required', 'error'); return; }
  if (!region) { toast('Region is required', 'error'); return; }
  if (!parent) { toast('Parent company is required', 'error'); return; }
  if (!state.regions.includes(region)) state.regions.push(region);

  if (_editingCompanyName) {
    const old = _editingCompanyName;
    if (name !== old && state.companies.includes(name)) { toast('Company already exists', 'error'); return; }
    const idx = state.companies.indexOf(old);
    if (idx !== -1) state.companies[idx] = name;
    if (name !== old) {
      state.transactions.forEach(t => { if (t.company === old) t.company = name; });
      state.people.forEach(p => { if (p.company === old) p.company = name; });
      state.accountCompanyList = (state.accountCompanyList || []).map(c => c === old ? name : c);
      delete state.companyRegions[old];
      delete state.companyParents[old];
      if (state.companyColors2) delete state.companyColors2[old];
    }
    state.companyRegions[name] = region;
    state.companyParents[name] = parent;
    if (!state.companyColors2) state.companyColors2 = {};
    state.companyColors2[name] = { primary: color1, secondary: color2 };
    if (!state.parentCompanies.includes(parent)) state.parentCompanies.push(parent);
  } else {
    if (state.companies.includes(name)) { toast('Company already exists', 'error'); return; }
    state.companies.push(name);
    state.companyRegions[name] = region;
    state.companyParents[name] = parent;
    if (!state.companyColors2) state.companyColors2 = {};
    state.companyColors2[name] = { primary: color1, secondary: color2 };
    if (!state.parentCompanies.includes(parent)) state.parentCompanies.push(parent);
  }

  saveSettings();
  renderCompanyChips();
  renderSettings(document.getElementById('content-area'));
  closeModal('addCompanyModal');
  toast(isEditMode ? `"${name}" updated` : `"${name}" added to Companies`, 'success');
  _editingCompanyName = null;
}

function settingsCard(title, items, key, colorMap) {
  return `
    <div class="settings-card">
      <div class="settings-card-header">
        <div class="settings-card-title">${title}</div>
        <div class="settings-card-tools">
          <button class="btn btn-secondary btn-sm" onclick="exportSettingsData('${key}')">Export</button>
          <button class="btn btn-secondary btn-sm" onclick="triggerSettingsImport('${key}')">Import</button>
          <button class="btn btn-primary btn-sm" onclick="openAddSettingModal('${key}','${title}')">+ Add</button>
        </div>
        <input class="settings-file-input" type="file" id="settings-import-${key}" accept=".csv,.xlsx,.xls" onchange="handleSettingsImport(this,'${key}')">
      </div>
      <div class="settings-card-body settings-scroll settings-limit-rows" id="sc-${key}">
        ${items.map((item,i) => `
          <div class="settings-item">
            <div>
              <div class="settings-item-name" style="display:flex;align-items:center;gap:8px">
                ${colorMap[item]?`<div style="width:8px;height:8px;border-radius:50%;background:${colorMap[item]}"></div>`:''}
                ${item}
              </div>
            </div>
            <div class="settings-item-actions">
              <div class="icon-btn" onclick="openEditSettingModal('${key}',${i},'${title}')" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              </div>
              <div class="icon-btn danger" onclick="removeSettingItem('${key}',${i})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function settingsCardBanks() {
  return `
    <div class="settings-card">
      <div class="settings-card-header">
        <div class="settings-card-title">Banks</div>
        <div class="settings-card-tools">
          <button class="btn btn-secondary btn-sm" onclick="exportSettingsData('bank')">Export</button>
          <button class="btn btn-secondary btn-sm" onclick="triggerSettingsImport('bank')">Import</button>
          <button class="btn btn-primary btn-sm" onclick="openAddBankModal()">+ Add</button>
        </div>
        <input class="settings-file-input" type="file" id="settings-import-bank" accept=".csv,.xlsx,.xls" onchange="handleSettingsImport(this,'bank')">
      </div>
      <div class="settings-card-body settings-scroll settings-limit-rows" id="sc-bank">
        ${state.banks.map((bank, i) => `
          <div class="settings-item">
            <div>
              <div class="settings-item-name">${bank}</div>
              ${(state.bankShortNameList[i] || '') ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">Primary: ${state.bankShortNameList[i]}</div>` : ''}
              ${getBankChildShortNames(bank).length ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">Child: ${getBankChildShortNames(bank).join(', ')}</div>` : ''}
            </div>
            <div class="settings-item-actions">
              <div class="icon-btn" onclick="openEditBankModal(${i})" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              </div>
              <div class="icon-btn danger" onclick="removeSettingItem('bank',${i})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function settingsCardAccounts() {
  return `
    <div class="settings-card">
      <div class="settings-card-header">
        <div class="settings-card-title">Accounts</div>
        <div class="settings-card-tools">
          <button class="btn btn-secondary btn-sm" onclick="exportSettingsData('account')">Export</button>
          <button class="btn btn-secondary btn-sm" onclick="triggerSettingsImport('account')">Import</button>
          <button class="btn btn-primary btn-sm" onclick="openAddAccountModal()">+ Add</button>
        </div>
        <input class="settings-file-input" type="file" id="settings-import-account" accept=".csv,.xlsx,.xls" onchange="handleSettingsImport(this,'account')">
      </div>
      <div class="settings-card-body settings-scroll settings-limit-rows" id="sc-account">
        ${state.bankForAccountList.map((bank, i) => `
          <div class="settings-item">
            <div>
              <div class="settings-item-name">${isMerchantBankType(state.bankTypeList[i] || '') ? `Account Name: ${(state.bankAccountList[i] || '')}` : `Account Number: ${(state.bankAccountList[i] || '')}`}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.45;word-break:break-word">
                Company: ${(state.accountCompanyList[i] || state.companies[0] || '')}
                &nbsp; | &nbsp;
                Bank: ${bank}${getBankShortName(bank) ? ` (${getBankShortName(bank)})` : ''}
                &nbsp; | &nbsp; Type: ${(state.bankTypeList[i] || '-')}
                &nbsp; | &nbsp; Region: ${(state.accountRegionList[i] || state.regions[0] || '')}
                &nbsp; | &nbsp; Currency: ${(state.bankCurrencyList[i] || state.currencies[0] || '')}
              </div>
            </div>
            <div class="settings-item-actions">
              <div class="icon-btn" onclick="openEditAccountModal(${i})" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              </div>
              <div class="icon-btn danger" onclick="removeSettingItem('account',${i})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function _getSettingArrayByKey(key) {
  if (key === 'bank') return state.banks;
  if (key === 'bankType') return state.bankTypes;
  if (key === 'region') return state.regions;
  if (key === 'currency') return state.currencies;
  if (key === 'parentCompany') return state.parentCompanies;
  if (key === 'beginningBalanceKeywords') return state.beginningBalanceKeywords;
  return null;
}

function openAddSettingModal(key, title) {
  _editingSettingKey = key;
  _editingSettingIdx = -1;
  const titleEl = document.getElementById('edit-setting-modal-title');
  const labelEl = document.getElementById('edit-setting-modal-label');
  const submitEl = document.getElementById('edit-setting-submit-btn');
  const valueEl = document.getElementById('es-value');
  if (titleEl) titleEl.textContent = `Add ${title.slice(0,-1)}`;
  if (labelEl) labelEl.innerHTML = `${title.slice(0,-1)} <span>*</span>`;
  if (submitEl) submitEl.textContent = 'Add';
  if (valueEl) valueEl.value = '';
  openModal('editSettingModal');
}

function openEditSettingModal(key, idx, title) {
  const arr = _getSettingArrayByKey(key);
  if (!arr || arr[idx] === undefined) return;
  _editingSettingKey = key;
  _editingSettingIdx = idx;
  const titleEl = document.getElementById('edit-setting-modal-title');
  const labelEl = document.getElementById('edit-setting-modal-label');
  const submitEl = document.getElementById('edit-setting-submit-btn');
  const valueEl = document.getElementById('es-value');
  if (titleEl) titleEl.textContent = `Edit ${title.slice(0,-1)}`;
  if (labelEl) labelEl.innerHTML = `${title.slice(0,-1)} <span>*</span>`;
  if (submitEl) submitEl.textContent = 'Update';
  if (valueEl) valueEl.value = arr[idx];
  openModal('editSettingModal');
}

function submitSettingItemModal() {
  const arr = _getSettingArrayByKey(_editingSettingKey);
  if (!arr) return;
  const inputEl = document.getElementById('es-value');
  const newVal = (inputEl?.value || '').trim();
  if (!newVal) { toast('Value is required', 'error'); return; }

  if (_editingSettingIdx === -1) {
    if (arr.includes(newVal)) { toast('Value already exists', 'error'); return; }
    arr.push(newVal);
    saveSettings();
    renderSettings(document.getElementById('content-area'));
    closeModal('editSettingModal');
    toast(`"${newVal}" added`, 'success');
    return;
  }

  const oldVal = arr[_editingSettingIdx];
  if (oldVal === undefined) return;
  if (newVal !== oldVal && arr.includes(newVal)) { toast('Value already exists', 'error'); return; }
  arr[_editingSettingIdx] = newVal;
  if (_editingSettingKey === 'parentCompany') {
    Object.keys(state.companyParents).forEach(c => {
      if (state.companyParents[c] === oldVal) state.companyParents[c] = newVal;
    });
  }
  saveSettings();
  renderSettings(document.getElementById('content-area'));
  closeModal('editSettingModal');
  toast('Item updated', 'success');
}

let _editingBankIdx = -1;
let _editingAccountIdx = -1;

function populateEditBankTypeOptions(selectedType) {
  const el = document.getElementById('eb-banktype');
  if (!el) return;
  const fallback = state.bankTypes[0] || '';
  const selected = selectedType && state.bankTypes.includes(selectedType) ? selectedType : fallback;
  el.innerHTML = state.bankTypes.map(t => `<option value="${t}" ${t===selected?'selected':''}>${t}</option>`).join('');
}

function openAddBankModal() {
  _editingBankIdx = -1;
  document.getElementById('edit-bank-modal-title').textContent = 'Add Bank';
  document.getElementById('edit-bank-submit-btn').textContent = 'Add';
  document.getElementById('eb-name').value = '';
  document.getElementById('eb-shortname').value = '';
  document.getElementById('eb-short-children').value = '';
  openModal('editBankModal');
}

function openEditBankModal(idx) {
  const bankName = state.banks[idx];
  if (bankName === undefined) return;
  _editingBankIdx = idx;
  document.getElementById('edit-bank-modal-title').textContent = 'Edit Bank';
  document.getElementById('edit-bank-submit-btn').textContent = 'Update';
  document.getElementById('eb-name').value = bankName;
  document.getElementById('eb-shortname').value = (state.bankShortNameList && state.bankShortNameList[idx]) || '';
  document.getElementById('eb-short-children').value = getBankChildShortNames(bankName).join(', ');
  openModal('editBankModal');
}

function submitBankModal() {
  const newName = (document.getElementById('eb-name').value || '').trim();
  const newShortName = (document.getElementById('eb-shortname').value || '').trim();
  const newChildShorts = normalizeChildShortNames(document.getElementById('eb-short-children').value || '');
  if (!newName) { toast('Bank name is required', 'error'); return; }

  if (_editingBankIdx === -1) {
    if (findExistingBankName(newName)) { toast('Bank already exists', 'error'); return; }
    state.banks.push(newName);
    state.bankShortNameList.push(newShortName);
    state.bankChildShortNamesList.push(newChildShorts.filter(s => s.toLowerCase() !== newShortName.toLowerCase()));
    saveSettings();
    renderSettings(document.getElementById('content-area'));
    closeModal('editBankModal');
    toast(`"${newName}" added`, 'success');
  } else {
    const oldName = state.banks[_editingBankIdx];
    const existingBank = findExistingBankName(newName);
    if (newName !== oldName && existingBank && existingBank !== oldName) { toast('Bank already exists', 'error'); return; }

    state.banks[_editingBankIdx] = newName;
    state.bankShortNameList[_editingBankIdx] = newShortName;
    state.bankChildShortNamesList[_editingBankIdx] = newChildShorts.filter(s => s.toLowerCase() !== newShortName.toLowerCase());
    state.bankForAccountList = (state.bankForAccountList || []).map(b => b === oldName ? newName : b);
    // Update existing transactions
    state.transactions.forEach(t => { if (t.bank === oldName) t.bank = newName; });
    saveSettings();
    renderSettings(document.getElementById('content-area'));
    closeModal('editBankModal');
    toast('Bank updated', 'success');
  }
}

function populateAccountBankTypeOptions(selectedType) {
  const el = document.getElementById('ea-banktype');
  if (!el) return;
  const fallback = state.bankTypes[0] || '';
  const selected = selectedType && state.bankTypes.includes(selectedType) ? selectedType : fallback;
  el.innerHTML = state.bankTypes.map(t => `<option value="${t}" ${t===selected?'selected':''}>${t}</option>`).join('');
}

function populateAccountBankOptions(selectedBank) {
  const bankEl = document.getElementById('ea-bank');
  if (!bankEl) return;
  const banks = state.banks || [];
  bankEl.innerHTML = banks.map(b => `<option value="${b}" ${b===selectedBank?'selected':''}>${b}</option>`).join('');
  if (!selectedBank && banks.length) bankEl.value = banks[0];
  syncAccountShortName();
}

function populateAccountCompanyOptions(selectedCompany) {
  const companyEl = document.getElementById('ea-company');
  if (!companyEl) return;
  const companies = state.companies || [];
  companyEl.innerHTML = companies.map(c => `<option value="${c}" ${c===selectedCompany?'selected':''}>${c}</option>`).join('');
  if (!selectedCompany && companies.length) companyEl.value = companies[0];
}

function syncAccountShortName() {
  const bank = document.getElementById('ea-bank')?.value || '';
  const shortEl = document.getElementById('ea-shortname');
  if (shortEl) shortEl.value = getBankShortName(bank);
}

function openAddAccountModal() {
  if (!state.companies.length) {
    toast('Please add a company first', 'error');
    return;
  }
  if (!state.banks.length) {
    toast('Please add a bank first', 'error');
    return;
  }
  _editingAccountIdx = -1;
  document.getElementById('edit-account-modal-title').textContent = 'Add Account';
  document.getElementById('edit-account-submit-btn').textContent = 'Add';
  populateAccountCompanyOptions(state.companies[0]);
  populateAccountBankOptions(state.banks[0]);
  populateAccountBankTypeOptions(state.bankTypes[0] || '');
  document.getElementById('ea-currency').innerHTML = (state.currencies || []).map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('ea-region').innerHTML = (state.regions || []).map(r => `<option value="${r}">${r}</option>`).join('');
  if (state.currencies && state.currencies.length) document.getElementById('ea-currency').value = state.currencies[0];
  if (state.regions && state.regions.length) document.getElementById('ea-region').value = state.regions[0];
  document.getElementById('ea-account').value = '';
  syncAccountModalFieldUI();
  openModal('editAccountModal');
}

function openEditAccountModal(idx) {
  const company = (state.accountCompanyList && state.accountCompanyList[idx]) || '';
  const bank = (state.bankForAccountList && state.bankForAccountList[idx]) || '';
  if (!bank) return;
  _editingAccountIdx = idx;
  document.getElementById('edit-account-modal-title').textContent = 'Edit Account';
  document.getElementById('edit-account-submit-btn').textContent = 'Update';
  populateAccountCompanyOptions(company);
  populateAccountBankOptions(bank);
  populateAccountBankTypeOptions((state.bankTypeList && state.bankTypeList[idx]) || (state.bankTypes[0] || ''));
  document.getElementById('ea-currency').innerHTML = (state.currencies || []).map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('ea-region').innerHTML = (state.regions || []).map(r => `<option value="${r}">${r}</option>`).join('');
  document.getElementById('ea-currency').value = (state.bankCurrencyList && state.bankCurrencyList[idx]) || (state.currencies[0] || '');
  document.getElementById('ea-region').value = (state.accountRegionList && state.accountRegionList[idx]) || (state.regions[0] || '');
  document.getElementById('ea-account').value = (state.bankAccountList && state.bankAccountList[idx]) || '';
  syncAccountModalFieldUI();
  openModal('editAccountModal');
}

function submitAccountModal() {
  const company = (document.getElementById('ea-company')?.value || '').trim();
  const bank = (document.getElementById('ea-bank')?.value || '').trim();
  const bankType = (document.getElementById('ea-banktype')?.value || '').trim();
  const currency = (document.getElementById('ea-currency')?.value || '').trim();
  const region = (document.getElementById('ea-region')?.value || '').trim();
  const account = (document.getElementById('ea-account')?.value || '').trim();
  const accountLabel = getAccountFieldLabel(bankType).toLowerCase();
  if (!company) { toast('Company is required', 'error'); return; }
  if (!bank) { toast('Bank is required', 'error'); return; }
  if (!bankType) { toast('Bank type is required', 'error'); return; }
  if (!currency) { toast('Currency is required', 'error'); return; }
  if (!region) { toast('Region is required', 'error'); return; }
  if (!account) { toast(`${accountLabel} is required`, 'error'); return; }
  if (!state.companies.includes(company)) state.companies.push(company);
  if (!state.regions.includes(region)) state.regions.push(region);

  if (_editingAccountIdx === -1) {
    const exists = (state.bankForAccountList || []).some((b, i) => (
      String(state.accountCompanyList[i] || '') === company &&
      b === bank &&
      String(state.bankTypeList[i] || '') === bankType &&
      String(state.bankAccountList[i] || '') === account &&
      String(state.accountRegionList[i] || '') === region &&
      String(state.bankCurrencyList[i] || '') === currency
    ));
    if (exists) { toast('Same account already exists', 'error'); return; }
    state.accountCompanyList.push(company);
    state.bankForAccountList.push(bank);
    state.bankTypeList.push(bankType);
    state.bankAccountList.push(account);
    state.accountRegionList.push(region);
    state.bankCurrencyList.push(currency);
    saveSettings();
    renderSettings(document.getElementById('content-area'));
    closeModal('editAccountModal');
    toast('Account added', 'success');
  } else {
    const exists = (state.bankForAccountList || []).some((b, i) => (
      i !== _editingAccountIdx &&
      String(state.accountCompanyList[i] || '') === company &&
      b === bank &&
      String(state.bankTypeList[i] || '') === bankType &&
      String(state.bankAccountList[i] || '') === account &&
      String(state.accountRegionList[i] || '') === region &&
      String(state.bankCurrencyList[i] || '') === currency
    ));
    if (exists) { toast('Same account already exists', 'error'); return; }
    state.accountCompanyList[_editingAccountIdx] = company;
    state.bankForAccountList[_editingAccountIdx] = bank;
    state.bankTypeList[_editingAccountIdx] = bankType;
    state.bankAccountList[_editingAccountIdx] = account;
    state.accountRegionList[_editingAccountIdx] = region;
    state.bankCurrencyList[_editingAccountIdx] = currency;
    saveSettings();
    renderSettings(document.getElementById('content-area'));
    closeModal('editAccountModal');
    toast('Account updated', 'success');
  }
}

function removeSettingItem(key, idx) {
  if (!confirm('Remove this item?')) return;
  if (key === 'company') {
    const name = state.companies.splice(idx,1)[0];
    delete state.companyRegions[name];
    delete state.companyParents[name];
    if (state.companyColors2) delete state.companyColors2[name];
    if (name) {
      const keepRows = [];
      (state.bankForAccountList || []).forEach((b, i) => {
        if (String((state.accountCompanyList && state.accountCompanyList[i]) || '') === name) return;
        keepRows.push({
          company: (state.accountCompanyList && state.accountCompanyList[i]) || (state.companies[0] || ''),
          bank: b,
          type: state.bankTypeList[i] || '',
          account: state.bankAccountList[i] || '',
          region: state.accountRegionList[i] || (state.regions[0] || ''),
          currency: state.bankCurrencyList[i] || '',
        });
      });
      state.accountCompanyList = keepRows.map(r => r.company);
      state.bankForAccountList = keepRows.map(r => r.bank);
      state.bankTypeList = keepRows.map(r => r.type);
      state.bankAccountList = keepRows.map(r => r.account);
      state.accountRegionList = keepRows.map(r => r.region);
      state.bankCurrencyList = keepRows.map(r => r.currency);
    }
  }
  else if (key === 'bankType') state.bankTypes.splice(idx,1);
  else if (key === 'bank') {
    const removedBank = state.banks.splice(idx, 1)[0];
    if (Array.isArray(state.bankShortNameList)) state.bankShortNameList.splice(idx, 1);
    if (Array.isArray(state.bankChildShortNamesList)) state.bankChildShortNamesList.splice(idx, 1);
    if (removedBank) {
      const keepRows = [];
      (state.bankForAccountList || []).forEach((b, i) => {
        if (b === removedBank) return;
        keepRows.push({ company: (state.accountCompanyList && state.accountCompanyList[i]) || (state.companies[0] || ''), bank: b, type: state.bankTypeList[i] || '', account: state.bankAccountList[i] || '', region: state.accountRegionList[i] || (state.regions[0] || ''), currency: state.bankCurrencyList[i] || '' });
      });
      state.accountCompanyList = keepRows.map(r => r.company);
      state.bankForAccountList = keepRows.map(r => r.bank);
      state.bankTypeList = keepRows.map(r => r.type);
      state.bankAccountList = keepRows.map(r => r.account);
      state.accountRegionList = keepRows.map(r => r.region);
      state.bankCurrencyList = keepRows.map(r => r.currency);
    }
  }
  else if (key === 'account') {
    if (Array.isArray(state.accountCompanyList)) state.accountCompanyList.splice(idx, 1);
    if (Array.isArray(state.bankForAccountList)) state.bankForAccountList.splice(idx, 1);
    if (Array.isArray(state.bankTypeList)) state.bankTypeList.splice(idx, 1);
    if (Array.isArray(state.bankAccountList)) state.bankAccountList.splice(idx, 1);
    if (Array.isArray(state.accountRegionList)) state.accountRegionList.splice(idx, 1);
    if (Array.isArray(state.bankCurrencyList)) state.bankCurrencyList.splice(idx, 1);
  }
  else if (key === 'currency') state.currencies.splice(idx,1);
  else if (key === 'region') {
    const removedRegion = state.regions.splice(idx, 1)[0];
    if (removedRegion && Array.isArray(state.accountRegionList)) {
      const fallbackRegion = state.regions[0] || '';
      state.accountRegionList = state.accountRegionList.map(r => (String(r || '').trim() === removedRegion ? fallbackRegion : r));
    }
  }
  else if (key === 'beginningBalanceKeywords') state.beginningBalanceKeywords.splice(idx,1);
  else if (key === 'parentCompany') {
    const parent = state.parentCompanies.splice(idx,1)[0];
    Object.keys(state.companyParents).forEach(c => {
      if (state.companyParents[c] === parent) delete state.companyParents[c];
    });
  }
  saveSettings();
  renderCompanyChips();
  renderSettings(document.getElementById('content-area'));
  toast('Item removed', 'info');
}

