function normalizeRows(rawHeaders, rawRows) {
  const headers = rawHeaders.map(h => HEADER_MAP[normalizeHeader(h)] || normalizeHeader(h));
  return rawRows.map(vals => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = vals[i];
      obj[h] = (v === undefined || v === null) ? '' : String(v).trim();
    });
    return obj;
  });
}

// CSV parser (handles quoted fields)
function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return [];
  const rawHeaders = splitCSVLine(lines[0]);
  const rawRows = lines.slice(1).map(line => splitCSVLine(line));
  return normalizeRows(rawHeaders, rawRows);
}

// XLSX parser using SheetJS
function parseXLSX(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // Use header:1 to get raw 2D array
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (data.length < 2) return [];
  const rawHeaders = data[0].map(h => String(h));
  const rawRows = data.slice(1).filter(r => r.some(c => c !== '' && c !== null && c !== undefined));
  // For date cells SheetJS gives JS Date objects when cellDates:true
  // We pass them through normalizeRows as strings after converting
  const processedRows = rawRows.map(row =>
    row.map(cell => {
      if (cell instanceof Date) return cell.toISOString().split('T')[0];
      return cell;
    })
  );
  return normalizeRows(rawHeaders, processedRows);
}

function splitCSVLine(line) {
  const vals = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      vals.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  vals.push(cur.trim());
  return vals;
}

function safeFloat(val) {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseFloat(String(val).replace(/[,$\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseOptionalFloat(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  const n = parseFloat(String(val).replace(/[,$\s]/g, ''));
  return isNaN(n) ? null : n;
}

// Normalize a header: lowercase, strip underscores/spaces/dashes/special chars
function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/[_\s\-]+/g, '').replace(/[^a-z0-9]/g, '');
}

// Normalize a date value to YYYY-MM-DD
function normalizeDate(val) {
  if (!val && val !== 0) return new Date().toISOString().split('T')[0];
  // JS Date object (SheetJS cellDates:true gives these)
  if (val instanceof Date) return val.toISOString().split('T')[0];
  // String already in YYYY-MM-DD
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try generic date parse
  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
  return s;
}

// Map of normalized key -> standard field name
const HEADER_MAP = {
  transactionid:          'transaction_id',
  company:                'company',
  bank:                   'bank',
  currency:               'currency',
  date:                   'date',
  date2:                  'date_2',
  status:                 'status',
  people:                 'people',
  person:                 'people',
  name:                   'name',
  category:               'category',
  referenceid:            'reference_id',
  reference:              'reference',
  transactionreference:   'transaction_reference',
  description:            'description',
  interdivision:          'inter_division',
  netamount:              'net_amount',
  fee:                    'fee',
  vat:                    'vat',
  amount:                 'amount',
  openingbalance:         'opening_balance',
  beginningbalance:       'opening_balance',
  issplit:                'is_split',
};

function makeId(row) {
  // deterministic hash from row content so re-import doesn't create duplicates
  const raw = Object.values(row).join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
  return `IMP-${Math.abs(hash).toString(36)}`;
}

function mapRow(row, defaultCompany, defaultCurrency, fileName, uploadDate, defaultBank, defaultBankType, defaultAccountNumber, defaultPeople) {
  // Pick best ID: transaction_id > reference_id > transaction_reference > hash
  const id = (row.transaction_id||'').trim()
          || (row.reference_id||'').trim()
          || (row.transaction_reference||'').trim()
          || makeId(row);

  // Amount: prefer `amount`, fall back to `net_amount`
  const amt = (row.amount !== undefined && row.amount !== '') ? safeFloat(row.amount) : safeFloat(row.net_amount);

  // Name: prefer `name`, fall back to `description`, then `category`
  const name = (row.name||'').trim() || (row.description||'').trim() || (row.category||'').trim() || 'Imported';
  const people = (row.people||'').trim() || (defaultPeople||'').trim();

  // Description: if name used `description`, put `category` here instead
  const desc = (row.name||'').trim()
    ? ((row.description||'').trim() || (row.category||'').trim())
    : (row.category||'').trim();

  const resolvedCurrency = (row.currency||'').trim() || defaultCurrency;

  // Currency rate: prefer value from file, then look up from live rates
  let currency_rate = parseOptionalFloat(row.currency_rate !== undefined ? row.currency_rate : row.currencyrate);
  if (currency_rate == null && typeof _currencyRateState !== 'undefined' && _currencyRateState.byCurrency) {
    const rateKey = resolvedCurrency.toUpperCase();
    const looked = _currencyRateState.byCurrency[rateKey];
    if (Number.isFinite(Number(looked))) currency_rate = Number(looked);
  }

  const nowIso = new Date().toISOString();

  return {
    id,
    transaction_id:       (row.transaction_id||'').trim(),
    fileName:             fileName || '',
    uploadDate:           uploadDate || new Date().toISOString().split('T')[0],
    people,
    date:                 normalizeDate(row.date || ''),
    date_2:               normalizeDate(row.date_2 || '') || '',
    status:               (row.status||'').trim() || 'Completed',
    name,
    description:          desc,
    category:             (row.category||'').trim(),
    amount:               amt,
    balance:              null,
    net_amount:           safeFloat(row.net_amount),
    fee:                  safeFloat(row.fee),
    vat:                  safeFloat(row.vat),
    currency:             resolvedCurrency,
    currency_rate,
    company:              (row.company||'').trim() || defaultCompany,
    bank:                 defaultBank || (row.bank||'').trim(),
    accountNumber:        defaultAccountNumber || (row.account_number||'').trim(),
    bankType:             defaultBankType || '',
    isSplit:              ['1','true','yes'].includes((row.is_split||'').toLowerCase()),
    interDivision:        (row.inter_division||'').trim(),
    transactionReference: (row.transaction_reference||'').trim(),
    referenceId:          (row.reference_id||'').trim(),
    reference:            (row.reference||'').trim(),
    createdDate:          nowIso,
    updatedDate:          nowIso,
    lastModification:     nowIso,
  };
}

// ============================================================
// IMPORT PAGE
// ============================================================
function renderImportPage(area) {
  const fields = ['transaction_id','company','bank','currency','currency_rate','date','date_2','status','name','category','reference_id','reference','transaction_reference','description','inter_division','net_amount','fee','vat','amount','is_split'];
  area.innerHTML = `
    <div style="max-width:700px;margin:0 auto">
      <div class="table-card" style="padding:28px">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:6px">Import Bank Statement Data</h2>
        <p style="color:var(--text2);font-size:13.5px;margin-bottom:24px">Upload a CSV file. Column order doesn't matter — headers are auto-detected and mapped automatically.</p>
        <button class="btn btn-primary" onclick="openModal('importModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Open Import Wizard
        </button>

        <div style="margin-top:32px">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:10px">Supported Columns</h3>
          <p style="font-size:12.5px;color:var(--text2);margin-bottom:12px">All columns are optional. Headers can use spaces, dashes, or underscores — they are normalized automatically.</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${fields.map(f=>`<span style="font-family:'Aptos Narrow','Arial Narrow',Arial,sans-serif,monospace;font-size:11.5px;background:var(--surface2);border:1px solid var(--border);padding:3px 10px;border-radius:20px;color:var(--text2)">${f}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// IMPORT LOGIC
// ============================================================
function autoFillImportAccountNumber() {
  const bankEl = document.getElementById('imp-bank');
  const bankTypeEl = document.getElementById('imp-banktype');
  const acctEl = document.getElementById('imp-account-number');
  if (!bankEl || !bankTypeEl || !acctEl) return;
  const selectedBank = bankEl.value;
  const prevAccount = acctEl.value || '';

  const options = [];
  if (!selectedBank) {
    options.push('<option value="">— Select Bank First —</option>');
  } else {
    const accountsForBank = getAccountsForBank(selectedBank, bankTypeEl.value);
    if (accountsForBank.length) {
      accountsForBank.forEach(acc => options.push(`<option value="${acc}">${acc}</option>`));
    } else {
      options.push('<option value="">— No Account Configured —</option>');
    }
  }
  acctEl.innerHTML = options.join('');
  if (prevAccount && Array.from(acctEl.options).some(o => o.value === prevAccount)) {
    acctEl.value = prevAccount;
  }
  applyImportSelectionFromAccount();
}

function applyImportSelectionFromAccount() {
  const bankEl = document.getElementById('imp-bank');
  const accountEl = document.getElementById('imp-account-number');
  const companyEl = document.getElementById('imp-company');
  const currencyEl = document.getElementById('imp-currency');
  const bankTypeEl = document.getElementById('imp-banktype');
  const peopleEl = document.getElementById('imp-people');
  if (!bankEl || !accountEl || !companyEl || !currencyEl || !bankTypeEl || !peopleEl) return;

  const bank = String(bankEl.value || '').trim();
  const account = String(accountEl.value || '').trim();
  if (!bank || !account) return;

  const idx = (state.bankForAccountList || []).findIndex((b, i) => (
    String(b || '').trim() === bank &&
    String((state.bankAccountList && state.bankAccountList[i]) || '').trim() === account
  ));
  if (idx === -1) return;

  const company = String((state.accountCompanyList && state.accountCompanyList[idx]) || '').trim();
  const bankType = String((state.bankTypeList && state.bankTypeList[idx]) || '').trim();
  const currency = String((state.bankCurrencyList && state.bankCurrencyList[idx]) || '').trim();
  const linkedPerson = String((state.accountPeopleList && state.accountPeopleList[idx]) || '').trim();

  if (company && Array.from(companyEl.options).some(o => o.value === company)) companyEl.value = company;
  if (bankType && Array.from(bankTypeEl.options).some(o => o.value === bankType)) bankTypeEl.value = bankType;
  if (currency && Array.from(currencyEl.options).some(o => o.value === currency)) currencyEl.value = currency;

  // Auto-select the linked person from the account configuration
  if (linkedPerson && Array.from(peopleEl.options).some(o => o.value === linkedPerson)) {
    peopleEl.value = linkedPerson;
  }

  syncImportAccountFieldUI();
}

function refreshImportBankOptions() {
  const bankTypeEl = document.getElementById('imp-banktype');
  const bankEl = document.getElementById('imp-bank');
  if (!bankTypeEl || !bankEl) return;

  const seen = new Set();
  const banksWithAccount = [];
  state.banks.forEach(b => {
    if (seen.has(b)) return;
    const accounts = getAccountsForBank(b, bankTypeEl.value);
    if (!accounts.length) return;
    seen.add(b);
    banksWithAccount.push(b);
  });

  bankEl.innerHTML = [''].concat(banksWithAccount).map(b => `<option value="${b}">${b || '— Select Bank —'}</option>`).join('');
  autoFillImportAccountNumber();
}

function handleFileSelect(input) {
  if (!input.files[0]) return;
  _importFile = input.files[0];
  const name = _importFile.name;
  document.querySelector('.upload-title').textContent = name;
  document.querySelector('.upload-sub').textContent = `${(_importFile.size/1024).toFixed(1)} KB · Ready to validate`;
  showValidationPreview(name);
  if (_importMode === 'auto') applyAutoImportSelectionFromFilename(name);
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragging');
  const f = e.dataTransfer.files[0];
  if (f) {
    _importFile = f;
    document.querySelector('.upload-title').textContent = f.name;
    document.querySelector('.upload-sub').textContent = `${(f.size/1024).toFixed(1)} KB · Ready to validate`;
    showValidationPreview(f.name);
    if (_importMode === 'auto') applyAutoImportSelectionFromFilename(f.name);
  }
}

function showValidationPreview(name) {
  document.getElementById('validation-results').innerHTML = `
    <div class="validation-result">
      <div style="font-size:12.5px;font-weight:700;margin-bottom:8px">Pre-validation Check</div>
      <div class="validation-row ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>File format recognized (.${name.split('.').pop()})</div>
      <div class="validation-row ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Whitespace trimming enabled</div>
      <div class="validation-row ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Date format standardization: YYYY-MM-DD</div>
      <div class="validation-row ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Numeric field validation active</div>
      <div class="validation-row ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Duplicate transaction ID detection</div>
      <div class="validation-row warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>File not yet read · Click "Import & Validate" to proceed</div>
    </div>
  `;
}

async function runImport() {
  const company  = document.getElementById('imp-company').value;
  const currency = document.getElementById('imp-currency').value;
  const importPeople = (document.getElementById('imp-people').value || '').trim();
  const bankType = document.getElementById('imp-banktype').value;
  const bank          = document.getElementById('imp-bank').value;
  const accountNumber = (document.getElementById('imp-account-number').value || '').trim();
  const configuredCurrency = String(getAccountCurrency(bank, bankType, accountNumber) || '').trim();
  const effectiveCurrency = String(currency || configuredCurrency || '').trim();

  if (!bank) {
    toast('Please select a bank with configured account', 'error');
    return;
  }

  if (!accountNumber) {
    toast('Selected bank does not have a configured account', 'error');
    return;
  }

  if (!effectiveCurrency) {
    toast('Currency missing for selected account. Please configure account currency in settings.', 'error');
    return;
  }

  if (!_importFile) {
    toast('Please select a file first', 'error');
    return;
  }

  let rows;
  try {
    const ext = _importFile.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const buf = await _importFile.arrayBuffer();
      rows = parseXLSX(buf);
    } else {
      const text = await _importFile.text();
      rows = parseCSV(text);
    }
  } catch(e) {
    toast('Could not read file: ' + e.message, 'error');
    return;
  }

  if (!rows.length) {
    toast('No valid data found in file', 'error');
    return;
  }

  // Auto-detect beginning balance rows using keywords — only check description & name columns
  const keywords = (state.beginningBalanceKeywords || []).map(k => k.trim().toLowerCase()).filter(Boolean);
  const isBankType = String(bankType || '').trim().toLowerCase() === 'bank';

  const isBalanceRow = r => {
    if (!keywords.length) return false;
    // Only check description and name fields (not all columns)
    const desc = (
      String(r.description || '').trim() + ' ' +
      String(r.name || '').trim()
    ).toLowerCase();
    return keywords.some(kw => desc.includes(kw));
  };

  let detectedOpening = null;
  if (isBankType) {
    const balanceRows = rows.filter(isBalanceRow);
    if (balanceRows.length) {
      // Pick amount from the balance row (prefer explicit opening_balance col, then amount, then net_amount)
      const balRaw = balanceRows[0].opening_balance ?? balanceRows[0].amount ?? balanceRows[0].net_amount;
      detectedOpening = parseOptionalFloat(balRaw);
    }
    // Fallback: any row that has a dedicated opening_balance column with a value
    if (detectedOpening == null) {
      const rowWithOpeningCol = rows.find(r => parseOptionalFloat(r.opening_balance) != null);
      if (rowWithOpeningCol) detectedOpening = parseOptionalFloat(rowWithOpeningCol.opening_balance);
    }
  }
  const finalOpening = isBankType ? detectedOpening : null;

  if (isBankType && finalOpening == null) {
    toast('Import blocked: opening balance keyword row not found in file. Add the keyword in Settings → Beginning Balance Keywords.', 'error');
    return;
  }

  // Exclude balance rows from transaction data
  const dataRows = (isBankType && keywords.length) ? rows.filter(r => !isBalanceRow(r)) : rows;

  const existing = new Set(state.transactions.map(t => t.id));
  const fileName = _importFile.name;
  const uploadDate = new Date().toISOString().split('T')[0];
  const mapped = dataRows
    .map(r => mapRow(r, company, effectiveCurrency, fileName, uploadDate, bank, bankType, accountNumber, importPeople))
    .map(t => ({ ...t, currency: String(t.currency || effectiveCurrency).trim() || effectiveCurrency }))
    .filter(t => t.id && !existing.has(t.id));

  // Compute running balance in original file order (no sorting)
  let openingToSave = null;
  let closingToSave = null;
  if (isBankType && finalOpening != null) {
    openingToSave = finalOpening;

    // Walk dataRows in file order to assign each row its cumulative running balance
    let running = finalOpening;
    const balByRowId = {};
    dataRows.forEach(r => {
      const rowId = (r.transaction_id||'').trim()
                 || (r.reference_id||'').trim()
                 || (r.transaction_reference||'').trim()
                 || makeId(r);
      const amt = safeFloat(r.amount !== undefined && r.amount !== '' ? r.amount : r.net_amount);
      running += amt;
      balByRowId[rowId] = running;
    });
    closingToSave = running;

    mapped.forEach(t => {
      if (balByRowId[t.id] !== undefined) t.balance = balByRowId[t.id];
    });
  }

  try {
    await dbPutAll('settings', [
      { key: 'openingBalance', value: openingToSave },
      { key: 'closingBalance', value: closingToSave },
    ]);
  } catch (e) {
    toast(`Import failed while saving balances: ${e.message || e}`, 'error');
    return;
  }

  state.openingBalance = openingToSave;
  state.closingBalance = closingToSave;

  if (!mapped.length) {
    toast('No new records (duplicates skipped)', 'info');
    return;
  }

  try {
    await dbPutAll('transactions', mapped);
  } catch (e) {
    toast(`Import failed while saving transactions to Access: ${e.message || e}`, 'error');
    return;
  }

  state.transactions.unshift(...mapped);
  const balMsg = finalOpening != null ? ` · Opening: ${fmt(finalOpening)}` : '';
  addAuditEntry('Data Imported', `${mapped.length} records · ${company} · ${bank||'(from file)'} · ${currency}${balMsg}`, '#10b981');
  document.getElementById('txn-count').textContent = state.transactions.length;
  updateSidebarBalances();
  _importFile = null;
  closeModal('importModal');
  toast(`${mapped.length} transactions imported & saved to DB`, 'success');

  if (state.currentPage === 'transactions') renderFilteredTable();
  else if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

// ============================================================
// EXPORT
// ============================================================
function runExport() {
  const filtered = getFiltered();
  const format = (document.getElementById('exp-format')?.value || 'csv').toLowerCase();
  const stamp = getExportTimestamp();
  const exportCols = ALL_COLS.filter(c => state.visibleCols.has(c.key));

  const valueByKey = (t, key) => {
    switch (key) {
      case 'transaction_id': return t.transaction_id || t.id || '';
      case 'parentCompanies': return t.parentCompany || state.companyParents[t.company] || '';
      case 'regions': return t.region || state.companyRegions[t.company] || '';
      case 'bankTypes': return t.bankType || '';
      case 'reference_id': return t.referenceId || t.reference_id || '';
      case 'transaction_reference': return t.transactionReference || t.transaction_reference || '';
      case 'inter_division': return t.interDivision || t.inter_division || '';
      case 'is_split': return t.isSplit ? 'Yes' : 'No';
      case 'currency_rate': return t.currency_rate ?? '';
      case 'net_amount_usd': return t.net_amount_usd ?? '';
      case 'fee_usd': return t.fee_usd ?? '';
      case 'vat_usd': return t.vat_usd ?? '';
      case 'amount_usd': return t.amount_usd ?? '';
      default: return t[key] ?? '';
    }
  };

  const headers = exportCols.map(c => c.label);
  const rows = filtered.map(t => exportCols.map(c => valueByKey(t, c.key)));

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `Salsoft-export-${stamp}.xlsx`);
    addAuditEntry('Data Exported', `XLSX · ${filtered.length} records`, '#f59e0b');
  } else {
    const csvRows = [headers, ...rows];
    const csv = csvRows.map(r=>r.map(c=>`"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Salsoft-export-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addAuditEntry('Data Exported', `CSV · ${filtered.length} records`, '#f59e0b');
  }

  closeModal('exportModal');
  toast(`${filtered.length} records exported`, 'success');
}

