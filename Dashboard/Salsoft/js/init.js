// ============================================================
// INIT
// ============================================================
function renderBootstrapView() {
  updateSidebarBalances();
  const txnCountEl = document.getElementById('txn-count');
  if (txnCountEl) txnCountEl.textContent = String(state.transactions.length || 0);
  renderCompanyChips();
  renderDashboard(document.getElementById('content-area'));
}

async function bootApp() {
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
