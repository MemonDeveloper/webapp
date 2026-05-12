// ============================================================
// INIT
// ============================================================
function renderBootstrapView() {
  updateSidebarBalances();
  const txnCountEl = document.getElementById('txn-count');
  if (txnCountEl) txnCountEl.textContent = String(state.transactions.length || 0);
  applyCurrentUserToNav();
  if (typeof renderDashboardSubnav === 'function') renderDashboardSubnav();
  renderDashboard(document.getElementById('content-area'));
}

function getUserInitials(name, email) {
  const text = String(name || '').trim();
  if (text) {
    return text
      .split(/\s+/)
      .map(part => part[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  const fallback = String(email || '').trim();
  return (fallback.slice(0, 2) || 'US').toUpperCase();
}

function applyCurrentUserToNav() {
  const user = state.currentUser || {};
  const name = String(user.name || '').trim() || 'User';
  const role = String(user.role || '').trim() || 'Signed In User';
  const image = String(user.image || '').trim();

  const nameEl = document.getElementById('nsb-name');
  const roleEl = document.getElementById('nsb-role');
  const avatarEl = document.getElementById('nsb-avatar');

  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = role;
  if (avatarEl) {
    if (image) {
      avatarEl.innerHTML = `<img src="${image}" alt="${name}">`;
    } else {
      avatarEl.textContent = getUserInitials(name, user.email);
    }
  }
}

async function doLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (_) {}
  window.location.href = '/login';
}

async function bootApp() {
  // Guard: verify session before loading the app
  try {
    const sessionRes = await fetch('/api/session');
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      if (!sessionData.authenticated) {
        window.location.href = '/login';
        return;
      }
      state.currentUser = sessionData.user || null;
    }
  } catch (_) {
    // If we can't reach the server, let the app try to load anyway
  }

  try {
    await initDB();
    await loadFromDB();
    renderBootstrapView();
  } catch (err) {
    console.error('DB init failed:', err);
    renderBootstrapView();

    // Retry once after a short delay for transient backend reload races.
    setTimeout(async () => {
      try {
        await loadFromDB();
        renderBootstrapView();
      } catch (retryErr) {
        console.error('DB reload retry failed:', retryErr);
      }
    }, 800);
  }
}

bootApp();
