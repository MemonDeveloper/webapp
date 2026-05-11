function getAccountsForBank(bankName, bankType) {
  const seen = new Set();
  const list = [];
  (state.bankForAccountList || []).forEach((b, idx) => {
    if (String(b || '').trim() !== bankName) return;
    if (bankType && String((state.bankTypeList && state.bankTypeList[idx]) || '').trim() !== bankType) return;
    const acc = String((state.bankAccountList && state.bankAccountList[idx]) || '').trim();
    if (!acc || seen.has(acc)) return;
    seen.add(acc);
    list.push(acc);
  });
  if (!list.length && state.bankAccounts && state.bankAccounts[bankName]) list.push(String(state.bankAccounts[bankName]).trim());
  return list;
}

function isMerchantBankType(bankType) {
  const t = String(bankType || '').trim().toLowerCase();
  return t === 'merchant' || t === 'merchants';
}

function getAccountFieldLabel(bankType) {
  return isMerchantBankType(bankType) ? 'Account Name' : 'Account Number';
}

function syncAccountModalFieldUI() {
  const type = document.getElementById('ea-banktype')?.value || '';
  const labelEl = document.getElementById('ea-account-label');
  const inputEl = document.getElementById('ea-account');
  const label = getAccountFieldLabel(type);
  if (labelEl) labelEl.innerHTML = `${label} <span>*</span>`;
  if (inputEl) {
    inputEl.placeholder = isMerchantBankType(type) ? 'e.g. Online payment gateway' : 'e.g. 1234567890';
  }
}

function syncAddTxnAccountFieldUI() {
  const type = document.getElementById('add-banktype')?.value || '';
  const labelEl = document.getElementById('add-account-label');
  const inputEl = document.getElementById('add-account-number');
  const label = getAccountFieldLabel(type);
  if (labelEl) labelEl.textContent = label;
  if (inputEl) {
    inputEl.placeholder = isMerchantBankType(type) ? 'Auto-filled from merchant account name' : 'Auto-filled from bank account';
  }
}

function syncImportAccountFieldUI() {
  const type = document.getElementById('imp-banktype')?.value || '';
  const labelEl = document.getElementById('imp-account-label');
  if (labelEl) {
    labelEl.textContent = isMerchantBankType(type) ? 'Account Name' : 'Account';
  }
}

function getBankShortName(bankName) {
  const idx = (state.banks || []).indexOf(bankName);
  if (idx === -1) return '';
  return String((state.bankShortNameList && state.bankShortNameList[idx]) || '').trim();
}

function getBankChildShortNames(bankName) {
  const idx = (state.banks || []).indexOf(bankName);
  if (idx === -1) return [];
  return normalizeChildShortNames((state.bankChildShortNamesList && state.bankChildShortNamesList[idx]) || []);
}

function getAccountCurrency(bankName, bankType, accountNumber) {
  const idx = (state.bankForAccountList || []).findIndex((b, i) => (
    String(b || '').trim() === String(bankName || '').trim() &&
    String((state.bankTypeList && state.bankTypeList[i]) || '').trim() === String(bankType || '').trim() &&
    String((state.bankAccountList && state.bankAccountList[i]) || '').trim() === String(accountNumber || '').trim()
  ));
  if (idx === -1) return '';
  return String((state.bankCurrencyList && state.bankCurrencyList[idx]) || '').trim();
}

function normalizeBankName(name) {
  return String(name || '').trim().toLowerCase();
}

function findExistingBankName(name) {
  const target = normalizeBankName(name);
  return (state.banks || []).find(b => normalizeBankName(b) === target) || null;
}

function getCompanyColor(name, which) {
  const s = state.companyColors2 && state.companyColors2[name];
  const fallback = '#6b7280';
  if (!s) return fallback;
  return which === 'secondary' ? (s.secondary || s.primary) : (s.primary || fallback);
}

// ============================================================
// HELPERS
// ============================================================
function fmt(n) {
  return '$'+Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});
}

function updateSidebarBalances() {
  // sidebar removed — no-op
}

function toast(msg, type='info') {
  const icons = {
    success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = icons[type]+msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}

