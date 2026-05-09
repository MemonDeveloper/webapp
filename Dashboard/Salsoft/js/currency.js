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
      const person = String(r.people || r.person || '').trim();
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
      if (!Array.isArray(state.accountPeopleList)) state.accountPeopleList = [];
      state.accountPeopleList.push(person);
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
    rows = [['Company', 'Bank', 'Bank Short Name', 'Bank Type', 'Account Number', 'People', 'Region', 'Currency']];
    state.bankForAccountList.forEach((bank, idx) => {
      rows.push([
        state.accountCompanyList[idx] || '',
        bank,
        getBankShortName(bank),
        state.bankTypeList[idx] || '',
        state.bankAccountList[idx] || '',
        (state.accountPeopleList && state.accountPeopleList[idx]) || '',
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