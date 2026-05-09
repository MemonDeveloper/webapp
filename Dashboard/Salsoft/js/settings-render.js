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

