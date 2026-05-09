// ============================================================
// SETTINGS
// ============================================================
function renderSettings(area) {
  ensureDefaultBankTypes();
  const regionOptions = [...new Set((state.regions || []).map(r => String(r || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  area.innerHTML = `
    <div class="settings-grid">
      ${settingsCard('Parent Companies', state.parentCompanies, 'parentCompany', {})}
      ${settingsCardCompanies()}
      ${settingsCard('Regions', state.regions, 'region', {})}
      ${settingsCard('Bank Types', state.bankTypes, 'bankType', {})}
      ${settingsCardBanks()}
      ${settingsCardAccounts()}
      ${settingsCardCurrencies()}
      ${settingsCard('Beginning Balance Keywords', state.beginningBalanceKeywords, 'beginningBalanceKeywords', {})}
    </div>

    <div class="modal-overlay" id="addCompanyModal">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <div class="modal-title" id="add-company-modal-title">Add Company</div>
          <button class="modal-close" onclick="closeModal('addCompanyModal')">x</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Company Name <span>*</span></label>
            <input id="ac-name" class="form-input" type="text" placeholder="Enter company name">
          </div>
          <div class="form-grid">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Region <span>*</span></label>
              <select id="ac-region" class="form-select">
                <option value="">Select Region</option>
                ${regionOptions.map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
            <div></div>
          </div>
          <div class="form-group" style="margin-top:16px">
            <label class="form-label">Parent Company <span>*</span></label>
            <select id="ac-parent" class="form-select">
              <option value="">Select Parent Company</option>
              ${state.parentCompanies.map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>
          <div class="form-grid" style="margin-bottom:0">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Primary Color</label>
              <input type="color" id="ac-color1" class="form-input" value="#3b82f6" style="height:42px;padding:4px 8px;cursor:pointer">
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Secondary Color</label>
              <input type="color" id="ac-color2" class="form-input" value="#1d4ed8" style="height:42px;padding:4px 8px;cursor:pointer">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('addCompanyModal')">Cancel</button>
          <button class="btn btn-primary" id="add-company-submit-btn" onclick="submitAddCompanyModal()">Add Company</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="editSettingModal">
      <div class="modal" style="max-width:460px">
        <div class="modal-header">
          <div class="modal-title" id="edit-setting-modal-title">Add Item</div>
          <button class="modal-close" onclick="closeModal('editSettingModal')">x</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" id="edit-setting-modal-label">Value <span>*</span></label>
            <input id="es-value" class="form-input" type="text" placeholder="Enter value">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('editSettingModal')">Cancel</button>
          <button class="btn btn-primary" id="edit-setting-submit-btn" onclick="submitSettingItemModal()">Save</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="editBankModal">
      <div class="modal" style="max-width:460px">
        <div class="modal-header">
          <div class="modal-title" id="edit-bank-modal-title">Add Bank</div>
          <button class="modal-close" onclick="closeModal('editBankModal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Bank Name <span>*</span></label>
            <input id="eb-name" class="form-input" type="text" placeholder="e.g. Emirates NBD">
          </div>
          <div class="form-group">
            <label class="form-label">Primary Short Name</label>
            <input id="eb-shortname" class="form-input" type="text" placeholder="e.g. ENBD">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Child Short Names</label>
            <input id="eb-short-children" class="form-input" type="text" placeholder="e.g. ENBD-1, ENBD-2">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('editBankModal')">Cancel</button>
          <button class="btn btn-primary" id="edit-bank-submit-btn" onclick="submitBankModal()">Save</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="editAccountModal">
      <div class="modal" style="max-width:460px">
        <div class="modal-header">
          <div class="modal-title" id="edit-account-modal-title">Add Account</div>
          <button class="modal-close" onclick="closeModal('editAccountModal')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Company <span>*</span></label>
            <select id="ea-company" class="form-select"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Bank <span>*</span></label>
            <select id="ea-bank" class="form-select" onchange="syncAccountShortName()"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Bank Short Name</label>
            <input id="ea-shortname" class="form-input" type="text" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">Bank Type <span>*</span></label>
            <select id="ea-banktype" class="form-select" onchange="syncAccountModalFieldUI()"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Currency <span>*</span></label>
            <select id="ea-currency" class="form-select"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Region <span>*</span></label>
            <select id="ea-region" class="form-select"></select>
          </div>
          <div class="form-group">
            <label class="form-label" id="ea-account-label">Account Number <span>*</span></label>
            <input id="ea-account" class="form-input" type="text" placeholder="e.g. 1234567890">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Linked Person</label>
            <select id="ea-people" class="form-select">
              <option value="">— None —</option>
            </select>
            <div style="font-size:11px;color:var(--text2);margin-top:5px">Link a person from your People list to this account.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('editAccountModal')">Cancel</button>
          <button class="btn btn-primary" id="edit-account-submit-btn" onclick="submitAccountModal()">Save</button>
        </div>
      </div>
    </div>

    <div class="settings-card" style="margin-top:20px;border-color:#fecaca">
      <div class="settings-card-header" style="background:#fef2f2">
        <div class="settings-card-title" style="color:var(--red)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;display:inline;margin-right:6px;vertical-align:-2px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Danger Zone
        </div>
      </div>
      <div class="settings-card-body">
        <div class="settings-item">
          <div>
            <div class="settings-item-name">Delete All Transactions</div>
            <div class="settings-item-meta">${state.transactions.length} records will be permanently removed</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="clearStore('transactions')">Delete Transactions</button>
        </div>
        <div class="settings-item">
          <div>
            <div class="settings-item-name">Delete All People</div>
            <div class="settings-item-meta">${state.people.length} people will be permanently removed</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="clearStore('people')">Delete People</button>
        </div>
        <div class="settings-item">
          <div>
            <div class="settings-item-name">Clear Audit Log</div>
            <div class="settings-item-meta">${state.auditLog.length} entries will be permanently removed</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="clearStore('auditLog')">Clear Audit Log</button>
        </div>
        <div class="settings-item" style="border-bottom:none">
          <div>
            <div class="settings-item-name">Reset All Data</div>
            <div class="settings-item-meta">Wipe entire database — transactions, people, audit log, and settings</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="clearAllData()">Reset Everything</button>
        </div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    applySettingsRowLimit();
    setTimeout(applySettingsRowLimit, 60);
  });
  startCurrencyRefreshTicker();
  fetchUsdRatesForCurrencies();
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
  const peopleForAccount = Array.isArray(state.accountPeopleList) ? state.accountPeopleList : [];
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
                &nbsp; | &nbsp; People: ${(peopleForAccount[i] || '—')}
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
  _populateAccountPeopleDropdown('');
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
  _populateAccountPeopleDropdown((state.accountPeopleList && state.accountPeopleList[idx]) || '');
  syncAccountModalFieldUI();
  openModal('editAccountModal');
}

function _populateAccountPeopleDropdown(selectedName) {
  const el = document.getElementById('ea-people');
  if (!el) return;
  const people = Array.isArray(state.people) ? state.people : [];
  el.innerHTML = '<option value="">— None —</option>'
    + people.map(p => {
        const n = (p.name || '').trim();
        const sel = n === selectedName ? ' selected' : '';
        return `<option value="${n}"${sel}>${n}</option>`;
      }).join('');
}

function submitAccountModal() {
  const company  = (document.getElementById('ea-company')?.value  || '').trim();
  const bank     = (document.getElementById('ea-bank')?.value     || '').trim();
  const bankType = (document.getElementById('ea-banktype')?.value || '').trim();
  const currency = (document.getElementById('ea-currency')?.value || '').trim();
  const region   = (document.getElementById('ea-region')?.value   || '').trim();
  const account  = (document.getElementById('ea-account')?.value  || '').trim();
  const person   = (document.getElementById('ea-people')?.value   || '').trim();
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
    if (!Array.isArray(state.accountPeopleList)) state.accountPeopleList = [];
    state.accountPeopleList.push(person);
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
    if (!Array.isArray(state.accountPeopleList)) state.accountPeopleList = [];
    state.accountPeopleList[_editingAccountIdx] = person;
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
    if (Array.isArray(state.accountPeopleList)) state.accountPeopleList.splice(idx, 1);
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


