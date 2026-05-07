// ============================================================
// PEOPLE MODULE
// ============================================================
function renderPeople(area) {
  const f = state._peopleFilter || 'All';
  const activeParent = state.filters.parentCompany || 'All';
  // Companies to show in tabs: filter by parent if one is selected
  const visibleCompanies = activeParent === 'All'
    ? state.companies
    : state.companies.filter(c => (state.companyParents[c] || '') === activeParent);
  // Base pool respects parent filter (reuse dashboard logic)
  const parentPool = getFilteredPeople();
  area.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div class="tabs" style="margin-bottom:0">
        <div class="tab ${f==='All'?'active':''}" onclick="filterPeople('All')">All</div>
        ${visibleCompanies.map(c=>`<div class="tab ${f===c?'active':''}" onclick="filterPeople('${c}')">${c}</div>`).join('')}
      </div>
      <div style="flex:1"></div>
      <button class="btn btn-primary btn-sm" onclick="openAddPersonModal()">+ Add Person</button>
    </div>
    <div class="people-grid" id="people-grid">
      ${renderPeopleCards(f, parentPool)}
    </div>
  `;
}

function renderPeopleCards(filter, pool) {
  const src = pool || state.people;
  const list = filter === 'All' ? src : src.filter(p=>p.company===filter);
  if (!list.length) return `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><h3>No people found</h3><p>Add team members for this company</p></div>`;
  return list.map(p => `
    <div class="person-card">
      <div class="person-avatar" style="background:#ef4444">${p.image ? `<img src="${p.image}" alt="${p.name}">` : p.name.split(' ').map(n=>n[0]).join('')}</div>
      <div class="person-name">${p.name}</div>
      <span class="company-badge" style="background:${(getCompanyColor(p.company,'primary')||'#888')+'18'};color:${getCompanyColor(p.company,'secondary')||'#888'};margin-bottom:10px;display:inline-block">${p.company}</span>
      <div style="font-size:12px;color:var(--text2)">${p.email}</div>
      <div style="display:flex;justify-content:center;margin-top:12px">
        <button class="btn btn-secondary btn-sm" onclick="openEditPersonModal(${p.id})">Edit</button>
      </div>
    </div>
  `).join('');
}

function filterPeople(f) {
  state._peopleFilter = f;
  renderPeople(document.getElementById('content-area'));
}

// ============================================================
// ADD PERSON
// ============================================================
function openAddPersonModal() {
  _editingPersonId = null;
  const titleEl = document.getElementById('add-person-modal-title');
  const btnEl = document.getElementById('add-person-submit-btn');
  const nameEl = document.getElementById('person-name');
  const companyEl = document.getElementById('person-company');
  const emailEl = document.getElementById('person-email');
  const imageEl = document.getElementById('person-image');
  if (companyEl) companyEl.innerHTML = state.companies.map(c => `<option>${c}</option>`).join('');
  if (titleEl) titleEl.textContent = 'Add Person';
  if (btnEl) btnEl.textContent = 'Add Person';
  if (nameEl) nameEl.value = '';
  if (companyEl) companyEl.value = state.companies[0] || '';
  if (emailEl) emailEl.value = '';
  if (imageEl) imageEl.value = '';
  const preview = document.getElementById('person-image-preview');
  if (preview) preview.innerHTML = '';
  openModal('addPersonModal');
}

function openEditPersonModal(id) {
  const person = state.people.find(p => p.id === id);
  if (!person) return;
  _editingPersonId = id;
  const titleEl = document.getElementById('add-person-modal-title');
  const btnEl = document.getElementById('add-person-submit-btn');
  const nameEl = document.getElementById('person-name');
  const companyEl = document.getElementById('person-company');
  const emailEl = document.getElementById('person-email');
  const imageEl = document.getElementById('person-image');
  if (companyEl) companyEl.innerHTML = state.companies.map(c => `<option>${c}</option>`).join('');
  if (titleEl) titleEl.textContent = 'Edit Person';
  if (btnEl) btnEl.textContent = 'Update Person';
  if (nameEl) nameEl.value = person.name || '';
  if (companyEl) companyEl.value = person.company || (state.companies[0] || '');
  if (emailEl) emailEl.value = person.email || '';
  if (imageEl) imageEl.value = '';
  const preview = document.getElementById('person-image-preview');
  if (preview) preview.innerHTML = person.image ? `<img src="${person.image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : '';
  openModal('addPersonModal');
}

function previewPersonImage(input) {
  const preview = document.getElementById('person-image-preview');
  if (!preview) return;
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => { preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; };
    reader.readAsDataURL(file);
  }
}

async function addPerson() {
  const name = document.getElementById('person-name').value.trim();
  if (!name) { toast('Name is required','error'); return; }
  const imgInput = document.getElementById('person-image');
  const imgFile = imgInput && imgInput.files ? imgInput.files[0] : null;
  const image = imgFile ? await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(imgFile);
  }) : '';
  const company = document.getElementById('person-company').value;
  const email = document.getElementById('person-email').value;

  if (_editingPersonId) {
    const idx = state.people.findIndex(x => x.id === _editingPersonId);
    if (idx === -1) { toast('Person not found','error'); return; }
    const prev = state.people[idx];
    const p = {
      ...prev,
      name,
      company,
      email,
      image: image || prev.image || '',
      color: '#ef4444'
    };
    state.people[idx] = p;
    dbPut('people', p);
    addAuditEntry('Person Updated', `${name} · ${p.company}`, '#06b6d4');
    closeModal('addPersonModal');
    toast(`${name} updated`, 'success');
    _editingPersonId = null;
    renderPeople(document.getElementById('content-area'));
    return;
  }

  const p = {
    id: Date.now(),
    name,
    company,
    email,
    image,
    color: '#ef4444'
  };
  state.people.push(p);
  dbPut('people', p);
  addAuditEntry('Person Added', `${name} · ${p.company}`, '#06b6d4');
  closeModal('addPersonModal');
  toast(`${name} added`, 'success');
  renderPeople(document.getElementById('content-area'));
}

