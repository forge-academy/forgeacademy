/* ==========================================================================
   Forge Academy — pageview tracking beacon

   Include this once, at the end of <body>, on any public page:
     <script src="analytics/track.js"></script>          (from public/ root)
     <script src="../../analytics/track.js"></script>     (from src/pages/*)

   Fires a single fire-and-forget POST to /api/track after the page has
   loaded. Wrapped so it can never throw into the calling page or block/slow
   down anything — worst case, a pageview silently goes unrecorded.
   ========================================================================== */

(function () {
  "use strict";

  var API_BASE =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:8000"
      : "https://forgeacademy.onrender.com";

  var VISITOR_KEY = "fga_visitor_id";

  // Reuses a random id from localStorage across visits so /api/analytics can
  // approximate unique visitors. Falls back to a per-load id (or none) if
  // localStorage is blocked (private browsing, etc.) — tracking still works,
  // it just can't be tied to a returning visitor.
  function getVisitorId() {
    try {
      var existing = localStorage.getItem(VISITOR_KEY);
      if (existing) return existing;
      var id =
        window.crypto && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem(VISITOR_KEY, id);
      return id;
    } catch (e) {
      return null;
    }
  }

  function track() {
    try {
      var payload = JSON.stringify({
        path: location.pathname,
        referrer: document.referrer || null,
        visitor_id: getVisitorId(),
      });

      var url = API_BASE + "/api/track";

      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(function () {
          /* best-effort — never surface a tracking failure */
        });
      }
    } catch (e) {
      /* analytics must never break the page */
    }
  }

  if (document.readyState === "complete") {
    track();
  } else {
    window.addEventListener("load", track);
  }
})();
