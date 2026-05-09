function saveSettings() {
  sortSettingsLists();
  syncBankAccountState();
  const records = ['companies', 'companyRegions', 'companyParents', 'companyColors2', 'parentCompanies', 'regions', 'bankTypes', 'banks', 'bankShortNameList', 'bankChildShortNamesList', 'accountCompanyList', 'bankForAccountList', 'bankTypeList', 'bankAccountList', 'accountRegionList', 'bankCurrencyList', 'accountPeopleList', 'bankAccounts', 'currencies', 'beginningBalanceKeywords', 'openingBalance', 'closingBalance']
    .map(key => ({ key, value: state[key] }));
  dbPutAll('settings', records);
}

function ensureDefaultBankTypes() {
  if (!Array.isArray(state.bankTypes)) state.bankTypes = [];
  const seen = new Set();
  state.bankTypes = state.bankTypes
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .filter(v => {
      const key = v.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const legacyDefaults = new Set(['bank', 'merchant bank', 'credit card']);
  if (state.bankTypes.length && state.bankTypes.every(v => legacyDefaults.has(v.toLowerCase()))) {
    state.bankTypes = [];
  }
}

function normalizeChildShortNames(value) {
  if (Array.isArray(value)) {
    const seen = new Set();
    return value
      .map(v => String(v || '').trim())
      .filter(Boolean)
      .filter(v => {
        const k = v.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }
  const txt = String(value || '').trim();
  if (!txt) return [];
  return normalizeChildShortNames(txt.split(/[;,|]/g));
}

function sortSettingsLists() {
  const sortAZ = arr => {
    if (!Array.isArray(arr)) return;
    arr.sort((a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' }));
  };

  sortAZ(state.parentCompanies);
  sortAZ(state.regions);
  sortAZ(state.companies);
  sortAZ(state.bankTypes);
  sortAZ(state.currencies);
  sortAZ(state.beginningBalanceKeywords);

  const banks = Array.isArray(state.banks) ? state.banks : [];
  const shorts = Array.isArray(state.bankShortNameList) ? state.bankShortNameList : [];
  const children = Array.isArray(state.bankChildShortNamesList) ? state.bankChildShortNamesList : [];
  const bankRows = banks.map((bank, i) => ({
    bank: String(bank || '').trim(),
    short: String(shorts[i] || '').trim(),
    children: normalizeChildShortNames(children[i]),
  }));

  bankRows.sort((a, b) => a.bank.localeCompare(b.bank, undefined, { sensitivity: 'base' }));

  state.banks = bankRows.map(r => r.bank);
  state.bankShortNameList = bankRows.map(r => r.short);
  state.bankChildShortNamesList = bankRows.map(r => r.children);

  const accountCompanies = Array.isArray(state.accountCompanyList) ? state.accountCompanyList : [];
  const accountBanks = Array.isArray(state.bankForAccountList) ? state.bankForAccountList : [];
  const accountTypes = Array.isArray(state.bankTypeList) ? state.bankTypeList : [];
  const accounts = Array.isArray(state.bankAccountList) ? state.bankAccountList : [];
  const accountRegions = Array.isArray(state.accountRegionList) ? state.accountRegionList : [];
  const accountCurrencies = Array.isArray(state.bankCurrencyList) ? state.bankCurrencyList : [];
  const accountRows = accountBanks.map((bank, i) => ({
    company: String(accountCompanies[i] || '').trim(),
    bank: String(bank || '').trim(),
    type: String(accountTypes[i] || '').trim(),
    account: String(accounts[i] || '').trim(),
    region: String(accountRegions[i] || '').trim(),
    currency: String(accountCurrencies[i] || '').trim(),
  }));

  accountRows.sort((a, b) => {
    const aIsMerchant = isMerchantBankType(a.type);
    const bIsMerchant = isMerchantBankType(b.type);

    // Keep merchant-style accounts grouped by their requested sort shape.
    if (aIsMerchant !== bIsMerchant) return aIsMerchant ? -1 : 1;

    if (aIsMerchant) {
      const accCmp = a.account.localeCompare(b.account, undefined, { sensitivity: 'base', numeric: true });
      if (accCmp !== 0) return accCmp;
      const bankCmp = a.bank.localeCompare(b.bank, undefined, { sensitivity: 'base', numeric: true });
      if (bankCmp !== 0) return bankCmp;
    } else {
      const bankCmp = a.bank.localeCompare(b.bank, undefined, { sensitivity: 'base', numeric: true });
      if (bankCmp !== 0) return bankCmp;
      const accCmp = a.account.localeCompare(b.account, undefined, { sensitivity: 'base', numeric: true });
      if (accCmp !== 0) return accCmp;
    }

    const companyCmp = a.company.localeCompare(b.company, undefined, { sensitivity: 'base', numeric: true });
    if (companyCmp !== 0) return companyCmp;
    const regionCmp = a.region.localeCompare(b.region, undefined, { sensitivity: 'base', numeric: true });
    if (regionCmp !== 0) return regionCmp;
    return a.currency.localeCompare(b.currency, undefined, { sensitivity: 'base', numeric: true });
  });

  state.accountCompanyList = accountRows.map(r => r.company);
  state.bankForAccountList = accountRows.map(r => r.bank);
  state.bankTypeList = accountRows.map(r => r.type);
  state.bankAccountList = accountRows.map(r => r.account);
  state.accountRegionList = accountRows.map(r => r.region);
  state.bankCurrencyList = accountRows.map(r => r.currency);
}

function syncBankAccountState() {
  if (!Array.isArray(state.banks)) state.banks = [];
  if (!Array.isArray(state.regions)) state.regions = [];
  if (!Array.isArray(state.bankTypes)) state.bankTypes = [];
  if (!Array.isArray(state.bankShortNameList)) state.bankShortNameList = [];
  if (!Array.isArray(state.bankChildShortNamesList)) state.bankChildShortNamesList = [];
  if (!Array.isArray(state.accountCompanyList)) state.accountCompanyList = [];
  if (!Array.isArray(state.bankForAccountList)) state.bankForAccountList = [];
  if (!Array.isArray(state.bankTypeList)) state.bankTypeList = [];
  if (!Array.isArray(state.bankAccountList)) state.bankAccountList = [];
  if (!Array.isArray(state.accountRegionList)) state.accountRegionList = [];
  if (!Array.isArray(state.bankCurrencyList)) state.bankCurrencyList = [];

  state.banks = state.banks.map(b => String(b || '').trim()).filter(Boolean);
  state.regions = state.regions.map(r => String(r || '').trim()).filter(Boolean);
  if (!state.regions.length) {
    state.regions = [...new Set(Object.values(state.companyRegions || {}).map(r => String(r || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
  const defaultCompany = state.companies[0] || '';
  const defaultBankType = state.bankTypes[0] || '';
  const defaultRegion = state.regions[0] || '';

  // Keep one short-name slot per bank row in settings.
  if (state.bankShortNameList.length < state.banks.length) {
    for (let i = state.bankShortNameList.length; i < state.banks.length; i++) {
      state.bankShortNameList[i] = '';
    }
  }
  if (state.bankShortNameList.length > state.banks.length) {
    state.bankShortNameList = state.bankShortNameList.slice(0, state.banks.length);
  }
  state.bankShortNameList = state.bankShortNameList.map(s => String(s || '').trim());

  if (state.bankChildShortNamesList.length < state.banks.length) {
    for (let i = state.bankChildShortNamesList.length; i < state.banks.length; i++) {
      state.bankChildShortNamesList[i] = [];
    }
  }
  if (state.bankChildShortNamesList.length > state.banks.length) {
    state.bankChildShortNamesList = state.bankChildShortNamesList.slice(0, state.banks.length);
  }
  state.bankChildShortNamesList = state.bankChildShortNamesList.map((v, i) => {
    const primary = String(state.bankShortNameList[i] || '').trim().toLowerCase();
    return normalizeChildShortNames(v).filter(s => s.toLowerCase() !== primary);
  });

  // Keep aligned account rows (bank + type + account).
  const rowCount = Math.max(state.accountCompanyList.length, state.bankForAccountList.length, state.bankTypeList.length, state.bankAccountList.length, state.accountRegionList.length, state.bankCurrencyList.length);
  if (state.accountCompanyList.length < rowCount) {
    for (let i = state.accountCompanyList.length; i < rowCount; i++) state.accountCompanyList[i] = defaultCompany;
  }
  if (state.bankForAccountList.length < rowCount) {
    for (let i = state.bankForAccountList.length; i < rowCount; i++) state.bankForAccountList[i] = '';
  }
  if (state.bankTypeList.length < rowCount) {
    for (let i = state.bankTypeList.length; i < rowCount; i++) state.bankTypeList[i] = defaultBankType;
  }
  if (state.bankAccountList.length < rowCount) {
    for (let i = state.bankAccountList.length; i < rowCount; i++) state.bankAccountList[i] = '';
  }
  if (state.accountRegionList.length < rowCount) {
    for (let i = state.accountRegionList.length; i < rowCount; i++) state.accountRegionList[i] = defaultRegion;
  }
  if (state.bankCurrencyList.length < rowCount) {
    for (let i = state.bankCurrencyList.length; i < rowCount; i++) state.bankCurrencyList[i] = (state.currencies[0] || '');
  }

  state.accountCompanyList = state.accountCompanyList.map(c => {
    const company = String(c || '').trim();
    if (!company) return defaultCompany;
    if (!state.companies.includes(company)) state.companies.push(company);
    return company;
  });
  state.bankForAccountList = state.bankForAccountList.map(b => String(b || '').trim());
  state.bankTypeList = state.bankTypeList.map(t => {
    const type = String(t || '').trim();
    return state.bankTypes.includes(type) ? type : defaultBankType;
  });
  state.bankAccountList = state.bankAccountList.map(a => String(a || '').trim());
  state.accountRegionList = state.accountRegionList.map(r => {
    const region = String(r || '').trim();
    if (!region) return defaultRegion;
    if (!state.regions.includes(region)) state.regions.push(region);
    return region;
  });
  state.bankCurrencyList = state.bankCurrencyList.map(c => {
    const cur = String(c || '').trim();
    return state.currencies.includes(cur) ? cur : (state.currencies[0] || cur);
  });

  const validBanks = new Set(state.banks);
  const compactRows = [];
  for (let i = 0; i < state.bankForAccountList.length; i++) {
    const company = state.accountCompanyList[i];
    const bank = state.bankForAccountList[i];
    const account = state.bankAccountList[i];
    if (!company) continue;
    if (!bank || !account) continue;
    if (!validBanks.has(bank)) continue;
    compactRows.push({ company, bank, type: state.bankTypeList[i] || defaultBankType, account, region: state.accountRegionList[i] || defaultRegion, currency: state.bankCurrencyList[i] || (state.currencies[0] || '') });
  }
  state.accountCompanyList = compactRows.map(r => r.company);
  state.bankForAccountList = compactRows.map(r => r.bank);
  state.bankTypeList = compactRows.map(r => r.type);
  state.bankAccountList = compactRows.map(r => r.account);
  state.accountRegionList = compactRows.map(r => r.region);
  state.bankCurrencyList = compactRows.map(r => r.currency);

  // Backward compatible map for legacy callers: first non-empty account per bank name.
  const accountMap = {};
  state.bankForAccountList.forEach((bank, idx) => {
    const acc = state.bankAccountList[idx] || '';
    if (!accountMap[bank] && acc) accountMap[bank] = acc;
  });
  state.bankAccounts = accountMap;
}

