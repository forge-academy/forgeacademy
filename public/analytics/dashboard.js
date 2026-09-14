/* ==========================================================================
   Forge Academy — Analytics dashboard logic

   Two pages, same pattern as the enrollments admin (public/src/js/pages/admin.js):
   index.html is the login gate, dashboard.html is the data view. A successful
   sign-in redirects from one to the other.

   Deliberately reuses admin.js's sessionStorage key (fga_admin_key) — it's
   the same ADMIN_KEY secret, so signing into one dashboard signs into both.

   Endpoint used:
     GET /api/analytics?days=N   (admin-key gated)
   ========================================================================== */

(function () {
  "use strict";

  var API_BASE =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:8000"
      : "https://forgeacademy.onrender.com";

  var STORAGE_KEY = "fga_admin_key";

  var $ = function (sel) { return document.querySelector(sel); };

  var adminKey = null;

  /* ---------------- Formatting helpers ---------------- */

  var escapeHtml = function (str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

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

  async function apiFetch(path, options) {
    options = options || {};
    return fetch(API_BASE + path, {
      ...options,
      headers: Object.assign({}, options.headers || {}, { "X-Admin-Key": adminKey }),
    });
  }

  // Fetches analytics with the given key. Touches no DOM — safe to call from
  // the login page (just to validate a key) or the dashboard page (to get
  // real data to render).
  async function fetchAnalytics(key, days) {
    adminKey = key;
    var res;
    try {
      res = await apiFetch("/api/analytics?days=" + (days || 30));
    } catch (err) {
      return { ok: false, networkError: true };
    }
    if (!res.ok) return { ok: false, status: res.status };
    var data = await res.json();
    return { ok: true, data: data };
  }

  /* ================================================================
     LOGIN PAGE  (index.html)
     ================================================================ */

  function initLoginPage() {
    var form = $("#login-form");
    var keyInput = $("#admin-key");
    var loginBtn = $("#login-btn");
    var loginError = $("#login-error");

    var params = new URLSearchParams(location.search);
    if (params.get("reason") === "expired") {
      loginError.textContent = "Your session expired — sign in again.";
      loginError.hidden = false;
    }

    // Already signed in this tab (e.g. via the enrollments admin)? Skip
    // straight to the dashboard instead of asking again.
    var stored = getStoredKey();
    if (stored) {
      fetchAnalytics(stored, 1).then(function (result) {
        if (result.ok) location.href = "dashboard.html";
        else clearStoredKey();
      });
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      loginError.hidden = true;
      var candidate = keyInput.value.trim();
      if (!candidate) return;

      loginBtn.disabled = true;
      loginBtn.textContent = "Checking…";

      var result = await fetchAnalytics(candidate, 1);

      loginBtn.disabled = false;
      loginBtn.textContent = "Sign in";

      if (result.ok) {
        setStoredKey(candidate);
        location.href = "dashboard.html";
      } else {
        loginError.textContent = "That key was not accepted. Check it and try again.";
        loginError.hidden = false;
      }
    });
  }

  /* ================================================================
     DASHBOARD PAGE  (dashboard.html)
     ================================================================ */

  function initDashboardPage() {
    var DAYS = 30;

    var els = {
      meta: $("#dashboard-meta"),
      dashError: $("#dashboard-error"),
      dashStatus: $("#dashboard-status"),
      totalViews: $("#stat-total-views"),
      uniqueVisitors: $("#stat-unique-visitors"),
      dailyChart: $("#daily-chart"),
      topPagesList: $("#top-pages-list"),
      topReferrersList: $("#top-referrers-list"),
      sessionActions: $("#session-actions"),
    };

    function redirectToLogin(reason) {
      location.href = reason ? "index.html?reason=" + reason : "index.html";
    }

    function showError(message) {
      els.dashError.textContent = message;
      els.dashError.hidden = false;
    }

    function renderStats(data) {
      els.totalViews.textContent = data.total_views.toLocaleString();
      els.uniqueVisitors.textContent = data.unique_visitors.toLocaleString();
      els.meta.textContent = "Last " + DAYS + " days";
    }

    // Renders a ranked list (top pages / top referrers) with a proportional
    // bar next to each row so the biggest items are visually obvious.
    function renderList(el, items, labelKey) {
      if (!items.length) {
        el.innerHTML = '<li class="analytics-list__empty">No data yet.</li>';
        return;
      }
      var max = items.reduce(function (m, i) { return Math.max(m, i.views); }, 1);
      el.innerHTML = items
        .map(function (item) {
          var pct = Math.round((item.views / max) * 100);
          var label = escapeHtml(item[labelKey]);
          return (
            '<li class="analytics-list__row">' +
              '<div class="analytics-list__bar-track"><div class="analytics-list__bar" style="width:' + pct + '%"></div></div>' +
              '<span class="analytics-list__name" title="' + label + '">' + label + "</span>" +
              '<span class="analytics-list__count">' + item.views.toLocaleString() + "</span>" +
            "</li>"
          );
        })
        .join("");
    }

    // views_by_day from the API only includes days with at least one view —
    // this fills in the zero days so the chart covers a continuous range.
    function buildDailySeries(viewsByDay, days) {
      var map = {};
      viewsByDay.forEach(function (d) { map[d.date] = d.views; });

      var series = [];
      var today = new Date();
      for (var i = days - 1; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var key = d.toISOString().slice(0, 10);
        series.push({ date: key, views: map[key] || 0 });
      }
      return series;
    }

    function renderDailyChart(el, viewsByDay, days) {
      var series = buildDailySeries(viewsByDay, days);
      var max = series.reduce(function (m, d) { return Math.max(m, d.views); }, 1);

      el.innerHTML = series
        .map(function (d) {
          var pct = Math.round((d.views / max) * 100);
          var tooltip = d.date + ": " + d.views + " view" + (d.views === 1 ? "" : "s");
          return (
            '<div class="daily-chart__col" title="' + escapeHtml(tooltip) + '">' +
              '<div class="daily-chart__bar" style="height:' + Math.max(pct, 2) + '%"></div>' +
            "</div>"
          );
        })
        .join("");
    }

    async function refresh() {
      els.dashError.hidden = true;
      var result = await fetchAnalytics(adminKey, DAYS);

      if (!result.ok) {
        if (result.status === 403) {
          // Key no longer valid — no point staying on a dashboard that
          // can't load anything.
          clearStoredKey();
          redirectToLogin("expired");
          return;
        }
        showError(
          result.networkError
            ? "Could not reach the server. Is the backend running?"
            : "Failed to load analytics (HTTP " + result.status + ")."
        );
        return;
      }

      renderStats(result.data);
      renderDailyChart(els.dailyChart, result.data.views_by_day, DAYS);
      renderList(els.topPagesList, result.data.views_by_page, "path");
      renderList(els.topReferrersList, result.data.top_referrers, "referrer");
    }

    els.sessionActions.addEventListener("click", function (e) {
      var target = e.target.closest("[data-action]");
      var action = target && target.dataset.action;
      if (action === "refresh") refresh();
      if (action === "signout") {
        clearStoredKey();
        redirectToLogin();
      }
    });

    /* ---- Boot ---- */
    var stored = getStoredKey();
    if (!stored) {
      redirectToLogin();
      return;
    }
    adminKey = stored;
    refresh();
  }

  /* ---------------- Boot: pick the right page ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    if ($("#login-form")) initLoginPage();
    if ($("#analytics-dashboard")) initDashboardPage();
  });
})();
