// ============================================================
// INDEXED DB LAYER
// ============================================================
// STORAGE LAYER — Flask / SQLite API
// Store name map: JS name -> API endpoint segment
// ============================================================
let _importFile = null;
let _importMode = 'auto';
let _editingCompanyName = null;
let _editingSettingKey = null;
let _editingSettingIdx = -1;
let _editingPersonId = null;
const USD_RATES_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
const USD_RATES_CACHE_KEY = 'salsoft-usd-rates-cache-v1';
let _currencyRateState = {
  loading: false,
  date: '',
  byCurrency: {},
  error: '',
  lastCurrencySig: '',
  lastFetchedAt: 0,
  pendingPromise: null,
};
let _currencyRefreshTimerId = null;
let _txnFiltersPanelOpen = false;
const _STORE_API = {
  transactions: 'transactions',
  people:       'people',
  auditLog:     'audit_log',
  settings:     'settings',
};

function _apiStore(store) { return _STORE_API[store] || store; }

function initDB() {
  // No client-side DB to init — server handles it.
  return Promise.resolve();
}

function getCompanyFromBankAccount(bankName, accountNumber, bankType) {
  const bank = String(bankName || '').trim();
  const account = String(accountNumber || '').trim();
  const type = String(bankType || '').trim();
  if (!bank || !account) return '';

  const rows = state.bankForAccountList || [];
  // First pass: exact bank + account + type
  for (let i = 0; i < rows.length; i++) {
    const b = String(rows[i] || '').trim();
    const a = String((state.bankAccountList && state.bankAccountList[i]) || '').trim();
    const t = String((state.bankTypeList && state.bankTypeList[i]) || '').trim();
    if (b === bank && a === account && (!type || t === type)) {
      return String((state.accountCompanyList && state.accountCompanyList[i]) || '').trim();
    }
  }
  // Fallback: exact bank + account
  for (let i = 0; i < rows.length; i++) {
    const b = String(rows[i] || '').trim();
    const a = String((state.bankAccountList && state.bankAccountList[i]) || '').trim();
    if (b === bank && a === account) {
      return String((state.accountCompanyList && state.accountCompanyList[i]) || '').trim();
    }
  }
  return '';
}

function optionalNumber(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  const n = Number(String(val).replace(/[,$\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toAccessTransactionRecord(t) {
  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  };
  const id = String(pick(t.id, t.transaction_id, t['Transaction ID'])).trim();
  const bank = String(pick(t.bank, t['Bank'])).trim();
  const accountNumber = String(pick(t.accountNumber, t['Account No.'])).trim();
  const bankType = String(pick(t.bankType, t.bankTypes, t['Bank Types'])).trim();
  const derivedCurrency = String(getAccountCurrency(bank, bankType, accountNumber) || '').trim();
  const derivedCompany = getCompanyFromBankAccount(bank, accountNumber, bankType);
  const company = String(derivedCompany || pick(t.company, t['Company'])).trim();
  const derivedParent = String((state.companyParents && state.companyParents[company]) || '').trim();
  const derivedRegion = String((state.companyRegions && state.companyRegions[company]) || '').trim();

  return {
    'Transaction ID': id,
    'File Name': pick(t.fileName, t['File Name']),
    'Upload Date': pick(t.uploadDate, t['Upload Date']),
    'People': pick(t.people, t['People']),
    'Parent Companies': derivedParent || pick(t.parentCompany, t.parentCompanies, t['Parent Companies']),
    'Company': company,
    'Regions': derivedRegion || pick(t.region, t.regions, t['Regions']),
    'Bank Types': bankType,
    'Bank': bank,
    'Account No.': accountNumber,
    'Currency': pick(t.currency, t['Currency'], derivedCurrency),
    'Currency Rate': optionalNumber(pick(t.currency_rate, t.currencyRate, t['Currency Rate'])),
    'Date': pick(t.date, t['Date']),
    'Date 2': pick(t.date_2, t.date2, t['Date 2']),
    'Status': pick(t.status, t['Status']),
    'Name': pick(t.name, t['Name']),
    'Category': pick(t.category, t['Category']),
    'Reference ID': pick(t.referenceId, t.reference_id, t['Reference ID']),
    'Reference': pick(t.reference, t['Reference']),
    'Txn Reference': pick(t.transactionReference, t.transaction_reference, t['Txn Reference']),
    'Description': pick(t.description, t['Description']),
    'Inter Division': pick(t.interDivision, t.inter_division, t['Inter Division']),
    'Net Amount': safeFloat(pick(t.net_amount, t['Net Amount'])),
    'Fee': safeFloat(pick(t.fee, t['Fee'])),
    'VAT': safeFloat(pick(t.vat, t['VAT'])),
    'Amount': safeFloat(pick(t.amount, t['Amount'])),
    'Balance': optionalNumber(pick(t.balance, t['Balance'])),
    'Net Amount USD': optionalNumber(pick(t.net_amount_usd, t['Net Amount USD'])),
    'Fee USD': optionalNumber(pick(t.fee_usd, t['Fee USD'])),
    'VAT USD': optionalNumber(pick(t.vat_usd, t['VAT USD'])),
    'Amount USD': optionalNumber(pick(t.amount_usd, t['Amount USD'])),
    'Balance USD': optionalNumber(pick(t.balance_usd, t['Balance USD'])),
    'Is Split': Boolean(pick(t.isSplit, t.is_split, t['Is Split'])),
    'CreatedDate': pick(t.createdDate, t['CreatedDate']),
    'UpdatedDate': pick(t.updatedDate, t['UpdatedDate']),
    'LastModification': pick(t.lastModification, t['LastModification']),
  };
}

function fromAccessTransactionRecord(t) {
  if (!t || typeof t !== 'object') return t;
  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  };
  const id = String(pick(t.id, t['Transaction ID'], t.transaction_id)).trim();
  const bank = String(pick(t.bank, t['Bank'])).trim();
  const accountNumber = String(pick(t.accountNumber, t['Account No.'])).trim();
  const bankType = String(pick(t.bankType, t.bankTypes, t['Bank Types'])).trim();
  const derivedCompany = getCompanyFromBankAccount(bank, accountNumber, bankType);
  const company = String(derivedCompany || pick(t.company, t['Company'])).trim();
  const derivedParent = String((state.companyParents && state.companyParents[company]) || '').trim();
  const derivedRegion = String((state.companyRegions && state.companyRegions[company]) || '').trim();

  return {
    id,
    transaction_id: String(pick(t.transaction_id, t['Transaction ID'], id)).trim(),
    fileName: pick(t.fileName, t['File Name']),
    uploadDate: pick(t.uploadDate, t['Upload Date']),
    people: pick(t.people, t['People']),
    parentCompany: derivedParent || pick(t.parentCompany, t.parentCompanies, t['Parent Companies']),
    company,
    region: derivedRegion || pick(t.region, t.regions, t['Regions']),
    bankType,
    bank,
    accountNumber,
    currency: pick(t.currency, t['Currency']),
    currency_rate: optionalNumber(pick(t.currency_rate, t.currencyRate, t['Currency Rate'])),
    date: pick(t.date, t['Date']),
    date_2: pick(t.date_2, t.date2, t['Date 2']),
    status: pick(t.status, t['Status']),
    name: pick(t.name, t['Name']),
    category: pick(t.category, t['Category']),
    referenceId: pick(t.referenceId, t.reference_id, t['Reference ID']),
    reference: pick(t.reference, t['Reference']),
    transactionReference: pick(t.transactionReference, t.transaction_reference, t['Txn Reference']),
    description: pick(t.description, t['Description']),
    interDivision: pick(t.interDivision, t.inter_division, t['Inter Division']),
    net_amount: safeFloat(pick(t.net_amount, t['Net Amount'])),
    fee: safeFloat(pick(t.fee, t['Fee'])),
    vat: safeFloat(pick(t.vat, t['VAT'])),
    amount: safeFloat(pick(t.amount, t['Amount'])),
    balance: optionalNumber(pick(t.balance, t['Balance'])),
    net_amount_usd: optionalNumber(pick(t.net_amount_usd, t['Net Amount USD'])),
    fee_usd: optionalNumber(pick(t.fee_usd, t['Fee USD'])),
    vat_usd: optionalNumber(pick(t.vat_usd, t['VAT USD'])),
    amount_usd: optionalNumber(pick(t.amount_usd, t['Amount USD'])),
    balance_usd: optionalNumber(pick(t.balance_usd, t['Balance USD'])),
    isSplit: ['1','true','yes'].includes(String(pick(t.isSplit, t.is_split, t['Is Split'])).toLowerCase()),
    createdDate: pick(t.createdDate, t['CreatedDate']),
    updatedDate: pick(t.updatedDate, t['UpdatedDate']),
    lastModification: pick(t.lastModification, t['LastModification']),
  };
}

function dbGetAll(store) {
  return fetch(`/api/data/${_apiStore(store)}`).then(async r => {
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || `Request failed: ${r.status}`);
    }
    return r.json();
  });
}

function dbPut(store, record) {
  let payload = store === 'transactions' ? toAccessTransactionRecord(record) : record;
  if (store === 'transactions') {
    const txId = String((record && (record.id || record.transaction_id)) || payload['Transaction ID'] || '').trim();
    payload = {
      ...payload,
      id: txId,
      'Transaction ID': String(payload['Transaction ID'] || txId).trim(),
    };
  }
  return fetch(`/api/data/${_apiStore(store)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async r => {
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || `Request failed: ${r.status}`);
    }
    return r.json().catch(() => ({}));
  });
}

function dbPutAll(store, records) {
  if (!records || !records.length) return Promise.resolve({ ok: true, count: 0 });
  const payload = store === 'transactions' ? records.map(toAccessTransactionRecord) : records;
  return fetch(`/api/data/${_apiStore(store)}/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async r => {
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || `Request failed: ${r.status}`);
    }
    return r.json().catch(() => ({}));
  });
}

function dbDelete(store, key) {
  return fetch(`/api/data/${_apiStore(store)}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  }).then(async r => {
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || `Request failed: ${r.status}`);
    }
    return r.json().catch(() => ({}));
  });
}

const SETTINGS_KEYS = [
  'companies',
  'companyRegions',
  'companyParents',
  'companyColors2',
  'parentCompanies',
  'regions',
  'bankTypes',
  'banks',
  'bankShortNameList',
  'bankChildShortNamesList',
  'accountCompanyList',
  'bankForAccountList',
  'bankTypeList',
  'bankAccountList',
  'accountRegionList',
  'bankCurrencyList',
  'accountPeopleList',
  'bankAccounts',
  'currencies',
  'beginningBalanceKeywords',
  'openingBalance',
  'closingBalance',
];

async function loadFromDB() {
  const [txns, people, auditLog, settingsArr] = await Promise.all([
    dbGetAll('transactions'),
    dbGetAll('people'),
    dbGetAll('auditLog'),
    dbGetAll('settings'),
  ]);
  state.transactions = (txns || [])
    .map(fromAccessTransactionRecord);
  state.people = people;
  state.auditLog = auditLog.sort((a, b) => a.id - b.id);
  const settingsMap = {};
  settingsArr.forEach(s => settingsMap[s.key] = s.value);
  if (settingsMap.companies) state.companies = settingsMap.companies;
  if (settingsMap.companyRegions) state.companyRegions = settingsMap.companyRegions;
  if (settingsMap.companyParents) state.companyParents = settingsMap.companyParents;
  if (settingsMap.companyColors2) state.companyColors2 = settingsMap.companyColors2;
  if (settingsMap.parentCompanies) state.parentCompanies = settingsMap.parentCompanies;
  if (settingsMap.regions) state.regions = settingsMap.regions;
  if (settingsMap.bankTypes) state.bankTypes = settingsMap.bankTypes;
  if (settingsMap.banks) state.banks = settingsMap.banks;
  if (settingsMap.bankShortNameList) state.bankShortNameList = settingsMap.bankShortNameList;
  if (settingsMap.bankChildShortNamesList) state.bankChildShortNamesList = settingsMap.bankChildShortNamesList;
  if (settingsMap.accountCompanyList) state.accountCompanyList = settingsMap.accountCompanyList;
  if (settingsMap.bankForAccountList) state.bankForAccountList = settingsMap.bankForAccountList;
  if (settingsMap.bankTypeList) state.bankTypeList = settingsMap.bankTypeList;
  if (settingsMap.bankAccountList) state.bankAccountList = settingsMap.bankAccountList;
  if (settingsMap.accountRegionList) state.accountRegionList = settingsMap.accountRegionList;
  if (settingsMap.bankCurrencyList) state.bankCurrencyList = settingsMap.bankCurrencyList;
  if (settingsMap.accountPeopleList) state.accountPeopleList = settingsMap.accountPeopleList;
  if (settingsMap.bankAccounts) state.bankAccounts = settingsMap.bankAccounts;
  if (!settingsMap.bankForAccountList && Array.isArray(state.bankAccountList) && state.bankAccountList.length) {
    state.bankForAccountList = state.bankAccountList.map((_, i) => state.banks[i] || '');
  }
  if (!settingsMap.accountCompanyList && Array.isArray(state.bankForAccountList)) {
    state.accountCompanyList = state.bankForAccountList.map(() => state.companies[0] || '');
  }
  if (!settingsMap.accountRegionList && Array.isArray(settingsMap.bankRegionList) && Array.isArray(state.bankForAccountList)) {
    const bankRegionMap = {};
    (state.banks || []).forEach((bank, i) => { bankRegionMap[bank] = String(settingsMap.bankRegionList[i] || '').trim(); });
    state.accountRegionList = state.bankForAccountList.map(bank => bankRegionMap[bank] || (state.regions[0] || ''));
  }
  if (settingsMap.currencies) state.currencies = settingsMap.currencies;
  if (settingsMap.beginningBalanceKeywords) state.beginningBalanceKeywords = settingsMap.beginningBalanceKeywords;
  if (settingsMap.openingBalance !== undefined) state.openingBalance = settingsMap.openingBalance;
  if (settingsMap.closingBalance !== undefined) state.closingBalance = settingsMap.closingBalance;
  if (typeof ensureDefaultBankTypes === 'function') ensureDefaultBankTypes();
  sortSettingsLists();
  syncBankAccountState();

  // DB-first enforcement: if any setting key is absent, seed it once from current state.
  // After this, settings are consistently sourced from DB on subsequent loads.
  const presentKeys = new Set(settingsArr.map(s => String((s && s.key) || '')));
  const missingRecords = [];
  SETTINGS_KEYS.forEach(key => {
    if (!presentKeys.has(key)) {
      missingRecords.push({ key, value: state[key] });
    }
  });
  if (missingRecords.length) {
    dbPutAll('settings', missingRecords);
  }
  autoSyncDateRange();
}

function autoSyncDateRange() {
  const dates = state.transactions
    .map(t => String(t.date || '').slice(0, 10))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!dates.length) return;
  const minDate = dates.reduce((a, b) => a < b ? a : b);
  const maxDate = dates.reduce((a, b) => a > b ? a : b);
  if (!state.filters.dateFrom || state.filters.dateFrom === state._autoDateFrom) {
    state.filters.dateFrom = minDate;
  }
  if (!state.filters.dateTo || state.filters.dateTo === state._autoDateTo) {
    state.filters.dateTo = maxDate;
  }
  state._autoDateFrom = minDate;
  state._autoDateTo = maxDate;
}