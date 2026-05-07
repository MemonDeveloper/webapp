// ============================================================
// MODALS
// ============================================================
function openModal(id) {
  if (id === 'importModal') populateImportModal();
  if (id === 'addTxnModal') populateAddTxnModal();
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function populateImportModal() {
  ensureDefaultBankTypes();
  const opt = v => `<option value="${v}">${v}</option>`;
  const modeEl = document.getElementById('imp-mode');
  if (modeEl) {
    modeEl.value = 'auto';
    modeEl.disabled = true;
  }
  document.getElementById('imp-company').innerHTML  = state.companies.map(opt).join('');
  document.getElementById('imp-currency').innerHTML = state.currencies.map(opt).join('');
  const peopleOptions = state.people.map(p => `<option value="${String(p.name || '').replace(/"/g, '&quot;')}">${String(p.name || '').replace(/</g, '&lt;')}</option>`);
  document.getElementById('imp-people').innerHTML = peopleOptions.join('');
  document.getElementById('imp-banktype').innerHTML = state.bankTypes.map(opt).join('');
  refreshImportBankOptions();
  syncImportAccountFieldUI();

  // Reset file selection
  _importFile = null;
  document.getElementById('fileInput').value = '';
  document.querySelector('.upload-title').textContent = 'Drop CSV / Excel file here';
  document.querySelector('.upload-sub').textContent = 'or click to browse · .csv, .xlsx, .xls supported';
  document.getElementById('validation-results').innerHTML = '';
}

function setImportMode(mode) {
  _importMode = 'auto';
  if (_importFile) {
    applyAutoImportSelectionFromFilename(_importFile.name);
  }
}

function _normImportValue(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _findBestTokenMatch(values, filenameNorm, tokens) {
  let best = '';
  let bestScore = -1;
  values.forEach(v => {
    const n = _normImportValue(v);
    if (!n) return;
    let score = -1;
    if (filenameNorm.includes(n)) score = n.length + 100;
    else if (tokens.includes(n)) score = n.length + 50;
    else if (tokens.some(t => n.includes(t) || t.includes(n))) score = n.length;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  });
  return best;
}

function _findBestBankFromFilename(filenameNorm, tokens) {
  let bestBank = '';
  let bestScore = -1;
  (state.banks || []).forEach(bank => {
    const aliases = [bank, getBankShortName(bank), ...getBankChildShortNames(bank)].filter(Boolean);
    aliases.forEach(alias => {
      const n = _normImportValue(alias);
      if (!n) return;
      let score = -1;
      if (filenameNorm.includes(n)) score = n.length + 100;
      else if (tokens.includes(n)) score = n.length + 50;
      if (score > bestScore) {
        bestScore = score;
        bestBank = bank;
      }
    });
  });
  return bestBank;
}

function _findCurrencyFromFilename(rawTokens, filenameNorm) {
  const normalizedTokens = new Set(rawTokens.map(_normImportValue).filter(Boolean));
  let best = '';
  let bestScore = -1;

  (state.currencies || []).forEach(currency => {
    const code = String(currency || '').trim();
    if (!code) return;
    const norm = _normImportValue(code);
    if (!norm) return;

    let score = -1;
    if (normalizedTokens.has(norm)) score = norm.length + 100;
    else if (filenameNorm.includes(norm)) score = norm.length + 50;

    // Handle common EUR filename token written as EURO.
    if (norm === 'eur' && (normalizedTokens.has('euro') || filenameNorm.includes('euro'))) {
      score = Math.max(score, 120);
    }

    if (score > bestScore) {
      bestScore = score;
      best = code;
    }
  });

  return bestScore >= 0 ? best : '';
}

function _findBestAccountFromFilename(bank, bankType, filenameNorm, rawTokens) {
  const digitTokens = rawTokens.filter(t => /^\d{3,}$/.test(t));
  let best = { company: '', bank: '', type: '', account: '', currency: '', region: '', score: -1 };

  (state.bankAccountList || []).forEach((acc, idx) => {
    const rowBank = String((state.bankForAccountList && state.bankForAccountList[idx]) || '').trim();
    const rowType = String((state.bankTypeList && state.bankTypeList[idx]) || '').trim();
    const rowCompany = String((state.accountCompanyList && state.accountCompanyList[idx]) || '').trim();
    const account = String(acc || '').trim();
    const rowRegion = String((state.accountRegionList && state.accountRegionList[idx]) || '').trim();
    const rowCurrency = String((state.bankCurrencyList && state.bankCurrencyList[idx]) || '').trim();
    if (!rowBank || !account) return;
    if (bank && rowBank !== bank) return;
    if (bankType && rowType && rowType !== bankType) return;

    const aNorm = _normImportValue(account);
    let score = -1;
    if (filenameNorm.includes(aNorm)) score = aNorm.length + 100;
    digitTokens.forEach(t => {
      if (_normImportValue(account).includes(_normImportValue(t))) score = Math.max(score, t.length + 30);
    });

    if (score > best.score) {
      best = { company: rowCompany, bank: rowBank, type: rowType, account, currency: rowCurrency, region: rowRegion, score };
    }
  });

  return best.score >= 0 ? best : null;
}

function applyAutoImportSelectionFromFilename(fileName) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '');
  const rawTokens = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const tokens = rawTokens.map(_normImportValue).filter(Boolean);
  const filenameNorm = _normImportValue(base);
  const currencyFromFile = _findCurrencyFromFilename(rawTokens, filenameNorm);

  let bankType = '';
  let bank = _findBestBankFromFilename(filenameNorm, tokens);

  const accountByAny = _findBestAccountFromFilename(bank, '', filenameNorm, rawTokens);
  if (accountByAny && !bank) bank = accountByAny.bank;
  if (accountByAny) bankType = accountByAny.type || '';

  const bankTypeEl = document.getElementById('imp-banktype');
  const bankEl = document.getElementById('imp-bank');
  const accountEl = document.getElementById('imp-account-number');
  const currencyEl = document.getElementById('imp-currency');

  if (bankType && bankTypeEl && Array.from(bankTypeEl.options).some(o => o.value === bankType)) bankTypeEl.value = bankType;

  refreshImportBankOptions();

  if (bank && bankEl && Array.from(bankEl.options).some(o => o.value === bank)) {
    bankEl.value = bank;
  }
  autoFillImportAccountNumber();

  const accountByBank = _findBestAccountFromFilename(bankEl?.value || '', bankTypeEl?.value || '', filenameNorm, rawTokens);
  if (accountByBank && accountEl && Array.from(accountEl.options).some(o => o.value === accountByBank.account)) {
    accountEl.value = accountByBank.account;
  }

  applyImportSelectionFromAccount();

  // Priority: filename currency -> configured currency from matched account.
  if (currencyEl && currencyFromFile && Array.from(currencyEl.options).some(o => o.value === currencyFromFile)) {
    currencyEl.value = currencyFromFile;
  }

  const resolved = [
    bankTypeEl?.value ? `Bank Type: ${bankTypeEl.value}` : '',
    bankEl?.value ? `Bank: ${bankEl.value}` : '',
    accountEl?.value ? `Account: ${accountEl.value}` : '',
    currencyEl?.value ? `Currency: ${currencyEl.value}` : '',
  ].filter(Boolean);
  if (resolved.length) toast(`Auto selected -> ${resolved.join(' | ')}`, 'info');
}

function populateAddTxnModal() {
  ensureDefaultBankTypes();
  const opt = v => `<option value="${v}">${v}</option>`;
  document.getElementById('add-company').innerHTML  = state.companies.map(opt).join('');
  document.getElementById('add-currency').innerHTML = state.currencies.map(opt).join('');
  document.getElementById('add-banktype').innerHTML = state.bankTypes.map(opt).join('');
  document.getElementById('add-bank').innerHTML     = ['', ...state.banks].map(b => `<option value="${b}">${b || '— Select Bank —'}</option>`).join('');
  autoFillAddTxnAccountNumber();
  syncAddTxnAccountFieldUI();
  const dateEl = document.getElementById('add-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
}

function autoFillAddTxnAccountNumber() {
  const bankEl = document.getElementById('add-bank');
  const bankTypeEl = document.getElementById('add-banktype');
  const acctEl = document.getElementById('add-account-number');
  if (!bankEl || !bankTypeEl || !acctEl) return;
  const accounts = getAccountsForBank(bankEl.value, bankTypeEl.value);
  acctEl.value = accounts[0] || '';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'addCompanyModal') _editingCompanyName = null;
  if (id === 'editSettingModal') { _editingSettingKey = null; _editingSettingIdx = -1; }
  if (id === 'editBankModal') _editingBankIdx = -1;
  if (id === 'editAccountModal') _editingAccountIdx = -1;
  if (id === 'addPersonModal') _editingPersonId = null;
  document.body.style.overflow = '';
}

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target !== el) return;
    // Keep Edit Person modal open on outside click; close only via explicit actions.
    if (el.id === 'addPersonModal' && _editingPersonId) return;
    closeModal(el.id);
  });
});

