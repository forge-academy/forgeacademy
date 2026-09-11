/* ==========================================================================
   Forge Academy — Admin dashboard logic

   Two real pages now, not one page toggling sections: admin.html is the
   login gate, admin-dashboard.html is the table. A successful sign-in
   redirects (location.href) from one to the other, and the dashboard page
   redirects back to the login page if there's no valid session key — so the
   table is never present in the same document as the password field.

   The admin key is kept in sessionStorage (cleared on tab close / sign out)
   and sent as the X-Admin-Key header on every request. Endpoints used:
     GET    /api/enrollments                  (list, admin-key gated)
     PATCH  /api/enrollments/{id}/verify       (mark paid)
     DELETE /api/enrollments/{id}              (permanently remove a pending one)
   ========================================================================== */

(function () {
  const API_BASE =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:8000"
      : "https://forgeacademy.onrender.com";

  const STORAGE_KEY = "fga_admin_key";

  const $ = (sel) => document.querySelector(sel);

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

  /* ---------------- Session storage ---------------- */

  function getStoredKey() {
    try { return sessionStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function setStoredKey(key) {
    try { sessionStorage.setItem(STORAGE_KEY, key); } catch (e) { /* ignore */ }
  }

  function clearStoredKey() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------------- API ---------------- */

  async function apiFetch(path, options = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), "X-Admin-Key": adminKey },
    });
  }

  // Fetches the enrollments list with the given key. Touches no DOM — safe to
  // call from the login page (just to validate a key) or the dashboard page
  // (to actually get data to render).
  async function fetchEnrollments(key) {
    adminKey = key;
    let res;
    try {
      res = await apiFetch("/api/enrollments");
    } catch (err) {
      return { ok: false, networkError: true };
    }
    if (!res.ok) return { ok: false, status: res.status };
    const rows = await res.json();
    return { ok: true, rows };
  }

  /* ================================================================
     LOGIN PAGE  (admin.html)
     ================================================================ */

  function initLoginPage() {
    const form = $("#login-form");
    const keyInput = $("#admin-key");
    const loginBtn = $("#login-btn");
    const loginError = $("#login-error");

    const params = new URLSearchParams(location.search);
    if (params.get("reason") === "expired") {
      loginError.textContent = "Your session expired — sign in again.";
      loginError.hidden = false;
    }

    // Already signed in this tab? Skip straight to the dashboard instead of
    // making them re-enter the key.
    const stored = getStoredKey();
    if (stored) {
      fetchEnrollments(stored).then(({ ok }) => {
        if (ok) location.href = "admin-dashboard.html";
        else clearStoredKey();
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginError.hidden = true;
      const candidate = keyInput.value.trim();
      if (!candidate) return;

      loginBtn.disabled = true;
      loginBtn.textContent = "Checking…";

      const { ok } = await fetchEnrollments(candidate);

      loginBtn.disabled = false;
      loginBtn.textContent = "Sign in";

      if (ok) {
        setStoredKey(candidate);
        location.href = "admin-dashboard.html";
      } else {
        loginError.textContent = "That key was not accepted. Check it and try again.";
        loginError.hidden = false;
      }
    });
  }

  /* ================================================================
     DASHBOARD PAGE  (admin-dashboard.html)
     ================================================================ */

  function initDashboardPage() {
    const els = {
      dashboard: $("#dashboard"),
      sessionActions: $("#session-actions"),
      body: $("#enrollments-body"),
      meta: $("#dashboard-meta"),
      dashError: $("#dashboard-error"),
      dashStatus: $("#dashboard-status"),
      ambassadorPanel: $("#ambassador-panel"),
      ambassadorGrid: $("#ambassador-grid"),
    };

    function redirectToLogin(reason) {
      location.href = reason ? `admin.html?reason=${reason}` : "admin.html";
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

    function rowHtml(r) {
      const isPending = r.status === "pending_verification";
      // Delete is scoped to pending rows only — the decline email it sends
      // says "your payment wasn't confirmed", which would be false for an
      // already-paid enrollment (the backend also refuses this at the API level).
      const action = isPending
        ? `<div class="row-actions">
             <button type="button" class="btn btn--primary confirm-btn" data-confirm-id="${r.id}">Confirm</button>
             <button type="button" class="btn btn--danger delete-btn" data-delete-id="${r.id}">Delete</button>
           </div>`
        : "";

      const ambassadorCell = r.ambassador_code
        ? `<span class="ambassador-tag">${escapeHtml(r.ambassador_code)}</span>`
        : `<span class="admin-table__dash">—</span>`;

      // data-label drives the stacked "card" layout on narrow screens (admin.css)
      return `
        <tr data-row-id="${r.id}">
          <td data-label="Name">${escapeHtml(r.full_name)}</td>
          <td data-label="Email">${escapeHtml(r.email)}</td>
          <td data-label="Programme">${escapeHtml(r.programme_label)}</td>
          <td data-label="Amount">${naira(r.amount_expected)}</td>
          <td data-label="Transfer reference" class="admin-ref">${escapeHtml(r.transfer_reference)}</td>
          <td data-label="Ambassador">${ambassadorCell}</td>
          <td data-label="Status"><span class="status-badge status-badge--${escapeHtml(r.status)}">${escapeHtml(prettyStatus(r.status))}</span></td>
          <td data-label="Date">${formatDate(r.created_at)}</td>
          <td data-cell="action">${action}</td>
        </tr>`;
    }

    function renderRows(rows) {
      const pending = rows.filter((r) => r.status === "pending_verification").length;
      els.meta.textContent =
        `${rows.length} enrollment${rows.length === 1 ? "" : "s"} · ${pending} awaiting verification`;

      if (!rows.length) {
        els.body.innerHTML = `<tr><td colspan="9" class="admin-table__empty">No enrollments yet.</td></tr>`;
        return;
      }

      els.body.innerHTML = rows.map(rowHtml).join("");

      els.body.querySelectorAll("[data-confirm-id]").forEach((btn) => {
        btn.addEventListener("click", () => confirmEnrollment(btn));
      });
      els.body.querySelectorAll("[data-delete-id]").forEach((btn) => {
        btn.addEventListener("click", () => deleteEnrollment(btn));
      });
    }

    function renderAmbassadorSummary(rows) {
      const counts = {};
      rows.forEach((r) => {
        if (!r.ambassador_code) return;
        counts[r.ambassador_code] = (counts[r.ambassador_code] || 0) + 1;
      });

      const codes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

      if (!codes.length) {
        els.ambassadorPanel.hidden = true;
        return;
      }

      els.ambassadorPanel.hidden = false;
      els.ambassadorGrid.innerHTML = codes
        .map(
          (code) => `
          <div class="ambassador-card">
            <span class="ambassador-card__code">${escapeHtml(code)}</span>
            <span class="ambassador-card__count">${counts[code]}</span>
            <span class="ambassador-card__label">signup${counts[code] === 1 ? "" : "s"}</span>
          </div>`
        )
        .join("");
    }

    async function refresh({ silent = false } = {}) {
      if (!silent) {
        els.body.innerHTML = `<tr><td colspan="9" class="admin-table__empty">Loading…</td></tr>`;
      }
      els.dashError.hidden = true;

      const result = await fetchEnrollments(adminKey);

      if (!result.ok) {
        if (result.status === 403) {
          // Key no longer valid (rotated, revoked, or never was) — no point
          // staying on a dashboard that can't load anything.
          clearStoredKey();
          redirectToLogin("expired");
          return false;
        }
        showError(
          result.networkError
            ? "Could not reach the server. Is the backend running?"
            : `Failed to load enrollments (HTTP ${result.status}).`
        );
        return false;
      }

      renderRows(result.rows);
      renderAmbassadorSummary(result.rows);
      return true;
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
          res.status === 404 ? "Enrollment not found — try refreshing." : `Confirm failed (HTTP ${res.status}).`
        );
        return;
      }

      const updated = await res.json();
      flashStatus(`${updated.full_name} marked as paid — confirmation email sent.`);
      refresh({ silent: true });
    }

    async function deleteEnrollment(btn) {
      const id = btn.dataset.deleteId;
      const row = els.body.querySelector(`tr[data-row-id="${id}"]`);
      const name = row?.querySelector('[data-label="Name"]')?.textContent || "this student";

      if (
        !confirm(
          `Permanently delete ${name}'s enrollment? This can't be undone. They'll be emailed that their payment wasn't confirmed and that they're welcome to re-apply.`
        )
      ) return;

      btn.disabled = true;
      btn.textContent = "Deleting…";
      const confirmBtn = row?.querySelector(".confirm-btn");
      if (confirmBtn) confirmBtn.disabled = true;

      let res;
      try {
        res = await apiFetch(`/api/enrollments/${id}`, { method: "DELETE" });
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Delete";
        if (confirmBtn) confirmBtn.disabled = false;
        showError("Could not reach the server. Try again.");
        return;
      }

      if (!res.ok) {
        btn.disabled = false;
        btn.textContent = "Delete";
        if (confirmBtn) confirmBtn.disabled = false;
        showError(
          res.status === 404 ? "Enrollment not found — try refreshing." :
          res.status === 400 ? "Only pending enrollments can be deleted this way." :
          `Delete failed (HTTP ${res.status}).`
        );
        return;
      }

      const deleted = await res.json();
      flashStatus(`${deleted.full_name} deleted — they've been emailed that their payment wasn't confirmed.`);
      refresh({ silent: true });
    }

    els.sessionActions.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "refresh") refresh();
      if (action === "signout") {
        clearStoredKey();
        redirectToLogin();
      }
    });

    /* ---- Boot ---- */
    const stored = getStoredKey();
    if (!stored) {
      redirectToLogin();
      return;
    }
    adminKey = stored;
    refresh({ silent: true });
  }

  /* ---------------- Boot: pick the right page ---------------- */

  document.addEventListener("DOMContentLoaded", () => {
    if ($("#login-form")) initLoginPage();
    if ($("#enrollments-body")) initDashboardPage();
  });
})();
