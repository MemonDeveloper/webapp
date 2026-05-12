function addAuditEntry(action, meta, color) {
  const entry = { id: Date.now() + Math.random(), action, meta, time: new Date().toLocaleString(), color };
  state.auditLog.push(entry);
  dbPut('auditLog', entry);
}

// Parse a raw rows array (from CSV or XLSX) into standard field objects
// ============================================================
// AUDIT LOG
// ============================================================
function renderAudit(area) {
  area.innerHTML = `
    <div class="table-card">
      <div class="table-header">
        <div class="table-title">Audit Log</div>
        <div class="table-actions">
          <span style="font-size:12.5px;color:var(--text2)">${state.auditLog.length} entries</span>
        </div>
      </div>
      <div style="padding:8px 20px">
        ${state.auditLog.slice().reverse().map(a=>`
          <div class="audit-item">
            <div class="audit-dot" style="background:${a.color}"></div>
            <div class="audit-content">
              <div class="audit-action">${a.action}</div>
              <div class="audit-meta">${a.meta} &nbsp;·&nbsp; ${a.time}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

