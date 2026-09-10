/* ==========================================================================
   Forge Academy — Admin dashboard logic

   Login gate -> enrollments table. The admin key is kept in sessionStorage
   (cleared on tab close / sign out) and sent as the X-Admin-Key header on
   every request. Endpoints used:
     GET   /api/enrollments                  (list, admin-key gated)
     PATCH /api/enrollments/{id}/verify      (existing verify endpoint)
   ========================================================================== */

(function () {
  const API_BASE =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:8000"
      : "https://forgeacademy.onrender.com";

  const STORAGE_KEY = "fga_admin_key";

  const $ = (sel) => document.querySelector(sel);

  const els = {
    gate: $("#login-gate"),
    dashboard: $("#dashboard"),
    sessionActions: $("#session-actions"),
    loginForm: $("#login-form"),
    keyInput: $("#admin-key"),
    loginBtn: $("#login-btn"),
    loginError: $("#login-error"),
    body: $("#enrollments-body"),
    meta: $("#dashboard-meta"),
    dashError: $("#dashboard-error"),
    dashStatus: $("#dashboard-status"),
  };

  let adminKey = null;

  /* ---------------- Formatting helpers ---------------- */

  const naira = (n) => "₦" + Math.round(Number(n) || 0).toLocaleString("en-NG");

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
  };

  const escapeHtml = (str) =>
    String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const prettyStatus = (s) => String(s || "").replace(/_/g, " ");

  /* ---------------- API ---------------- */

  async function apiFetch(path, options = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), "X-Admin-Key": adminKey },
    });
  }

  /* ---------------- Auth flow ---------------- */

  function showGate(message) {
    els.gate.hidden = false;
    els.dashboard.hidden = true;
    els.sessionActions.hidden = true;
    if (message) {
      els.loginError.textContent = message;
      els.loginError.hidden = false;
    }
  }

  function showDashboard() {
    els.gate.hidden = true;
    els.dashboard.hidden = false;
    els.sessionActions.hidden = false;
  }

  function signOut() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    adminKey = null;
    els.keyInput.value = "";
    showGate();
  }

  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.loginError.hidden = true;
    const candidate = els.keyInput.value.trim();
    if (!candidate) return;

    els.loginBtn.disabled = true;
    els.loginBtn.textContent = "Checking…";

    adminKey = candidate;
    const ok = await loadEnrollments({ silent: true });

    els.loginBtn.disabled = false;
    els.loginBtn.textContent = "Sign in";

    if (ok) {
      try { sessionStorage.setItem(STORAGE_KEY, candidate); } catch (e) { /* ignore */ }
      showDashboard();
    } else {
      adminKey = null;
      showGate("That key was not accepted. Check it and try again.");
    }
  });

  /* ---------------- Enrollments table ---------------- */

  async function loadEnrollments({ silent = false } = {}) {
    if (!silent) {
      els.body.innerHTML = `<tr><td colspan="8" class="admin-table__empty">Loading…</td></tr>`;
    }
    els.dashError.hidden = true;

    let res;
    try {
      res = await apiFetch("/api/enrollments");
    } catch (err) {
      if (!silent) showError("Could not reach the server. Is the backend running?");
      return false;
    }

    if (res.status === 403) return false; // bad key — caller decides what to show
    if (!res.ok) {
      if (!silent) showError(`Failed to load enrollments (HTTP ${res.status}).`);
      return false;
    }

    const rows = await res.json();
    renderRows(rows);
    return true;
  }

  function showError(message) {
    els.dashError.textContent = message;
    els.dashError.hidden = false;
  }

  function flashStatus(message) {
    els.dashStatus.textContent = message;
    els.dashStatus.hidden = false;
    setTimeout(() => { els.dashStatus.hidden = true; }, 4000);
  }

  function renderRows(rows) {
    const pending = rows.filter((r) => r.status === "pending_verification").length;
    els.meta.textContent =
      `${rows.length} enrollment${rows.length === 1 ? "" : "s"} · ${pending} awaiting verification`;

    if (!rows.length) {
      els.body.innerHTML = `<tr><td colspan="8" class="admin-table__empty">No enrollments yet.</td></tr>`;
      return;
    }

    els.body.innerHTML = rows.map(rowHtml).join("");

    els.body.querySelectorAll("[data-confirm-id]").forEach((btn) => {
      btn.addEventListener("click", () => confirmEnrollment(btn));
    });
  }

  function rowHtml(r) {
    const isPending = r.status === "pending_verification";
    const action = isPending
      ? `<button type="button" class="btn btn--primary confirm-btn" data-confirm-id="${r.id}">Confirm</button>`
      : "";

    return `
      <tr data-row-id="${r.id}">
        <td>${escapeHtml(r.full_name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.programme_label)}</td>
        <td>${naira(r.amount_expected)}</td>
        <td class="admin-ref">${escapeHtml(r.transfer_reference)}</td>
        <td><span class="status-badge status-badge--${escapeHtml(r.status)}">${escapeHtml(prettyStatus(r.status))}</span></td>
        <td>${formatDate(r.created_at)}</td>
        <td data-cell="action">${action}</td>
      </tr>`;
  }

  async function confirmEnrollment(btn) {
    const id = btn.dataset.confirmId;
    if (!confirm("Confirm this payment? This marks the student as paid and emails them.")) return;

    btn.disabled = true;
    btn.textContent = "Confirming…";

    let res;
    try {
      res = await apiFetch(`/api/enrollments/${id}/verify`, { method: "PATCH" });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Confirm";
      showError("Could not reach the server. Try again.");
      return;
    }

    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = "Confirm";
      showError(
        res.status === 404
          ? "Enrollment not found — try refreshing."
          : `Confirm failed (HTTP ${res.status}).`
      );
      return;
    }

    const updated = await res.json();
    const row = els.body.querySelector(`tr[data-row-id="${id}"]`);
    if (row) {
      row.querySelector(".status-badge").outerHTML =
        `<span class="status-badge status-badge--${escapeHtml(updated.status)}">${escapeHtml(prettyStatus(updated.status))}</span>`;
      row.querySelector('[data-cell="action"]').innerHTML = "";
    }
    flashStatus(`${updated.full_name} marked as paid — confirmation email sent.`);
  }

  /* ---------------- Header actions ---------------- */

  els.sessionActions.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "refresh") loadEnrollments();
    if (action === "signout") signOut();
  });

  /* ---------------- Boot ---------------- */

  (async function init() {
    let stored = null;
    try { stored = sessionStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }

    if (!stored) {
      showGate();
      return;
    }

    adminKey = stored;
    if (await loadEnrollments({ silent: true })) {
      showDashboard();
    } else {
      signOut();
    }
  })();
})();
