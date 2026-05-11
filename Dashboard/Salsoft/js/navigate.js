// ============================================================
// NAVIGATION
// ============================================================
function navigate(page) {
  state.currentPage = page;
  if (page !== 'dashboard') state._dashboardSubnavOpen = false;
  // update account dropdown active state
  document.querySelectorAll('.acct-item').forEach(n => n.classList.remove('active'));
  const acctEl = document.getElementById('acct-' + page);
  if (acctEl) acctEl.classList.add('active');
  // update nav sidebar active state
  document.querySelectorAll('.nsb-item').forEach(n => n.classList.remove('active'));
  const nsbEl = document.getElementById('nsb-' + page);
  if (nsbEl) nsbEl.classList.add('active');
  // Legacy right company sidebar is intentionally disabled.
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = 'none';
  renderPage(page);
  renderDashboardSubnav();
}

function toggleNavSidebar() {
  // Sidebar collapse is intentionally disabled.
}

function toggleDarkMode(on) {
  // Dark mode is intentionally disabled.
  document.body.classList.remove('dark-mode');
}

// Restore sidebar + dark mode state from localStorage
(function initNavState() {
  state._dashboardSubnavOpen = true;
})();

function onDashboardNavClick() {
  if (state.currentPage === 'dashboard') {
    state._dashboardSubnavOpen = !state._dashboardSubnavOpen;
  } else {
    state._dashboardSubnavOpen = true;
  }
  navigate('dashboard');
}

function navigateDashboardParent(encodedParent) {
  const parent = decodeURIComponent(encodedParent || '');
  state.filters.parentCompany = parent || 'All';
  state.filters.company = 'All';
  state.page = 1;
  state.currentPage = 'dashboard';
  renderCompanyChips();
  renderDashboard(document.getElementById('content-area'));
  renderDashboardSubnav();
}

// Backward-compatible alias
function navigateDashboardCompany(encodedCompany) {
  navigateDashboardParent(encodedCompany);
}

function getDashboardParentCompanies() {
  const configured = Array.isArray(state.parentCompanies)
    ? state.parentCompanies.map(v => String(v || '').trim()).filter(Boolean)
    : [];
  if (configured.length) return [...new Set(configured)];

  const mapped = Object.values(state.companyParents || {})
    .map(v => String(v || '').trim())
    .filter(Boolean);
  return [...new Set(mapped)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function renderDashboardSubnav() {
  const wrap = document.getElementById('nsb-dashboard-subnav');
  if (!wrap) return;

  if (!state._dashboardSubnavOpen || state.currentPage !== 'dashboard') {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }

  const parents = getDashboardParentCompanies();
  if (!parents.length) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }

  const activeParent = state.filters.parentCompany || 'All';
  const rows = [
    `<div class="nsb-sub-item ${activeParent === 'All' ? 'active' : ''}" onclick="navigateDashboardParent('')">All Parent Companies</div>`,
    ...parents.map(p => {
      const isActive = activeParent === p;
      return `<div class="nsb-sub-item ${isActive ? 'active' : ''}" onclick="navigateDashboardParent('${encodeURIComponent(p)}')">${p}</div>`;
    }),
  ];

  wrap.innerHTML = rows.join('');
  wrap.style.display = 'flex';
}

function navigateAcct(page) {
  closeAccountMenu();
  navigate(page);
}

function toggleAccountMenu() {
  const el = document.getElementById('account-wrap');
  if (el) el.classList.toggle('open');
}

function closeAccountMenu() {
  const el = document.getElementById('account-wrap');
  if (el) el.classList.remove('open');
}

function normalizeFilterLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/technologies|technology|group|solution|solutions|company|holdings/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getCompaniesForParent(parent) {
  if (!parent || parent === 'All') return state.companies.slice();
  const direct = state.companies.filter(c => (state.companyParents[c] || '') === parent);
  if (direct.length) return direct;

  const normalizedParent = normalizeFilterLabel(parent);
  if (!normalizedParent) return [];
  const parentTokens = normalizedParent.split(' ').filter(Boolean);

  return state.companies.filter(company => {
    const normalizedCompany = normalizeFilterLabel(company);
    const normalizedMappedParent = normalizeFilterLabel(state.companyParents[company] || '');
    if (normalizedMappedParent && (normalizedMappedParent === normalizedParent || normalizedMappedParent.includes(normalizedParent) || normalizedParent.includes(normalizedMappedParent))) {
      return true;
    }
    if (normalizedCompany === normalizedParent || normalizedCompany.includes(normalizedParent) || normalizedParent.includes(normalizedCompany)) {
      return true;
    }
    return parentTokens.some(token => token.length >= 3 && normalizedCompany.includes(token));
  });
}

// Close account dropdown on outside click
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('account-wrap');
  if (wrap && !wrap.contains(e.target)) closeAccountMenu();
});

function renderCompanyChips() {
  const activeParent = state.filters.parentCompany || 'All';
  const activeCompany = state.filters.company || 'All';

  // Use settings-defined parent companies list
  const parents = (state.parentCompanies || []);

  // Show/hide "All" badge (shown when no parent filter active)
  const allBadge = document.getElementById('sidebar-all-badge');
  if (allBadge) allBadge.style.display = activeParent === 'All' ? 'flex' : 'none';

  // Build parent chips; when a parent is active, inject its sub-chips directly below it
  let html = '';
  parents.forEach(p => {
    const isActive = activeParent === p;
    const bg = isActive ? '#1a1a2e' : 'transparent';
    const textColor = isActive ? 'white' : '#6b7280';
    const shadow = isActive ? ';box-shadow:0 2px 8px rgba(0,0,0,.12)' : '';
    html += `<div class="company-chip${isActive ? ' active' : ''}" style="background:${bg};color:${textColor}${shadow}" onclick="filterByParentChip('${p}')">${p}</div>`;

    // If this is the active parent, render its sub-companies immediately below
    if (isActive) {
      const subs = getCompaniesForParent(p);
      subs.forEach(c => {
        const color = getCompanyColor(c, 'primary');
        const isSubActive = activeCompany === c;
        const subBg = isSubActive ? color + '28' : 'transparent';
        const subShadow = isSubActive ? `;box-shadow:inset 0 0 0 1.5px ${color}` : '';
        html += `<div class="company-sub-chip${isSubActive ? ' active' : ''}" style="background:${subBg};color:${color}${subShadow}" onclick="filterByCompanyChip('${c}')">${c}</div>`;
      });
    }
  });
  document.getElementById('company-chips').innerHTML = html;

  // Hide the separate sub-chips container (no longer used)
  const subEl = document.getElementById('company-sub-chips');
  const subDivider = document.getElementById('sidebar-sub-divider');
  if (subEl) { subEl.style.display = 'none'; subEl.innerHTML = ''; }
  if (subDivider) subDivider.style.display = 'none';
}

function filterByParentChip(parent) {
  // Clicking active parent again resets to All
  if (state.filters.parentCompany === parent) {
    state.filters.parentCompany = 'All';
  } else {
    state.filters.parentCompany = parent;
  }
  state.filters.company = 'All';
  state.page = 1;
  renderCompanyChips();
  if (state.currentPage === 'dashboard') renderDashboard(document.getElementById('content-area'));
}

function filterByCompanyChip(company) {
  // Clicking active sub-chip toggles it off
  state.filters.company = (state.filters.company === company) ? 'All' : company;
  state.page = 1;
  renderCompanyChips();
  if (state.currentPage === 'dashboard') {
    renderDashboard(document.getElementById('content-area'));
  }
}

function selectAvatar(el, encodedName, encodedCompany) {
  document.querySelectorAll('.p-avatar-wrap').forEach(w => w.classList.remove('p-active'));
  el.classList.add('p-active');
  const row = document.getElementById('people-avatar-scroll');
  const savedScroll = row ? row.scrollLeft : 0;
  openPersonDashboard(encodedName, encodedCompany, savedScroll, encodedName);
}

function scrollAvatars(dir) {
  const row = document.getElementById('people-avatar-scroll');
  if (!row) return;
  row.scrollBy({ left: dir * 260, behavior: 'smooth' });
}

function openPersonDashboard(encodedName, encodedCompany, savedScroll, activeEncodedName) {
  const personName = decodeURIComponent(encodedName || '');
  const personCompany = decodeURIComponent(encodedCompany || 'All') || 'All';
  state.filters.company = personCompany;
  state.page = 1;
  state.currentPage = 'dashboard';
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.display = 'none';
  renderCompanyChips();
  renderDashboard(document.getElementById('content-area'));
  if (typeof showToast === 'function') {
    showToast(`Dashboard filtered for ${personName || 'person'}`, 'info');
  }
  // Restore scroll position and re-apply active class after re-render
  requestAnimationFrame(() => {
    const row = document.getElementById('people-avatar-scroll');
    if (row && savedScroll) row.scrollLeft = savedScroll;
    if (activeEncodedName) {
      const wraps = document.querySelectorAll('.p-avatar-wrap');
      wraps.forEach(w => {
        if (w.getAttribute('onclick') && w.getAttribute('onclick').includes(activeEncodedName)) {
          w.classList.add('p-active');
        }
      });
    }
  });
}

function renderPage(page) {
  const area = document.getElementById('content-area');
  if (page === 'dashboard') renderDashboard(area);
  else if (page === 'transactions') renderTransactions(area);
  else if (page === 'import') renderImportPage(area);
  else if (page === 'people') renderPeople(area);
  else if (page === 'audit') renderAudit(area);
  else if (page === 'settings') renderSettings(area);
}

