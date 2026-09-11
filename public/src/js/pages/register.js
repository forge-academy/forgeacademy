/* ==========================================================================
   Forge Academy — Register page logic
   ========================================================================== */

(function () {
  const VALID_REFERRAL_CODES = { "VICTORIA": 0.067, "OYIN22": 0.067 }; // code -> discount %

  // Ambassador codes carry no discount — they exist purely so the academy can
  // see, on the admin dashboard, who registered through which ambassador.
  const AMBASSADOR_CODES = [
    "BLK", "ADEK", "DORA", "LIYYAA", "MELO", "TANWA", "TORIA",
    "DAN05", "MARVEL", "AECH", "ASIWAJU", "AKIN", "OAT05",
  ];

  const API_BASE = "https://forgeacademy.onrender.com";

  const state = {
    step: 1,
    programme: null, // { key, label, tags, price, icon }
    details: {},
    referralCode: null,
    discountPct: 0,
    ambassadorCode: null,
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const nairaFmt = (n) => "₦" + Math.round(n).toLocaleString("en-NG");

  /* ---------------- Step navigation ---------------- */

  function goToStep(step) {
    $$(".reg-card[data-step]").forEach((card) => {
      card.hidden = Number(card.dataset.step) !== step;
    });
    state.step = step;
    updateStepper();
    if (step === 4) fillStudentSummary();
    $(".reg-main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateStepper() {
    // Steps 3 and 4 both belong to the visual "Referral & price" indicator (3rd circle)
    const visualStep = Math.min(state.step, 3);
    $$(".stepper__step").forEach((el, i) => {
      const idx = i + 1;
      el.classList.toggle("is-done", idx < visualStep);
      el.classList.toggle("is-active", idx === visualStep);
    });
    $$(".stepper__line").forEach((el, i) => {
      el.classList.toggle("is-filled", i + 1 < visualStep);
    });
  }

  /* ---------------- Step 1: Programme ---------------- */

  function initProgrammeList() {
    const list = $("#programme-list");
    if (!list) return;

    list.addEventListener("click", (e) => {
      const option = e.target.closest(".programme-option");
      if (!option) return;

      $$(".programme-option", list).forEach((el) => el.classList.remove("is-selected"));
      option.classList.add("is-selected");

      state.programme = {
        key: option.dataset.programme,
        label: option.dataset.label,
        tags: option.dataset.tags,
        price: Number(option.dataset.price),
        icon: $(".programme-option__icon", option).innerHTML,
      };

      $('[data-step="1"] [data-action="next"]').disabled = false;
      updateOrderSummary();
    });
  }

  /* ---------------- Order summary + pricing ---------------- */

  function currentDiscountAmount() {
    if (!state.programme) return 0;
    return state.programme.price * state.discountPct;
  }

  function currentTotal() {
    if (!state.programme) return 0;
    return state.programme.price - currentDiscountAmount();
  }

  function updateOrderSummary() {
    const empty = $("#os-empty");
    const filled = $("#os-filled");

    if (!state.programme) {
      empty.hidden = false;
      filled.hidden = true;
      $("#os-price").textContent = "₦0";
      $("#os-total").textContent = "₦0";
      $("#os-discount-row").hidden = true;
      $("#os-original-total").hidden = true;
      return;
    }

    empty.hidden = true;
    filled.hidden = false;
    $("#os-icon").innerHTML = state.programme.icon;
    $("#os-label").textContent = state.programme.label;
    $("#os-tags").textContent = state.programme.tags;
    $("#os-price").textContent = nairaFmt(state.programme.price);

    const discount = currentDiscountAmount();
    $("#os-discount-row").hidden = discount <= 0;
    if (discount > 0) $("#os-discount").textContent = "−" + nairaFmt(discount);

    const osOriginal = $("#os-original-total");
    osOriginal.hidden = discount <= 0;
    if (discount > 0) osOriginal.textContent = nairaFmt(state.programme.price);

    $("#os-total").textContent = nairaFmt(currentTotal());

    // keep step-3 price breakdown and step-4 transfer amount in sync too
    updatePriceBreakdown();
    updatePayButton();
  }

  function updatePriceBreakdown() {
    if (!state.programme) return;
    $("#pb-programme-price").textContent = nairaFmt(state.programme.price);
    const discount = currentDiscountAmount();
    $("#pb-discount-row").hidden = discount <= 0;
    if (discount > 0) $("#pb-discount").textContent = "−" + nairaFmt(discount);

    const pbOriginal = $("#pb-original-total");
    pbOriginal.hidden = discount <= 0;
    if (discount > 0) pbOriginal.textContent = nairaFmt(state.programme.price);

    $("#pb-total").textContent = nairaFmt(currentTotal());
  }

  function updatePayButton() {
    const amountEl = $("#transfer-amount");
    if (amountEl) amountEl.textContent = nairaFmt(currentTotal());
  }

  /* ---------------- Step 3: Referral code ---------------- */

  function initReferral() {
    const applyBtn = $("#apply-referral");
    if (!applyBtn) return;

    applyBtn.addEventListener("click", () => {
      const input = $("#referral-code");
      const code = input.value.trim().toUpperCase();
      const pct = VALID_REFERRAL_CODES[code];
      const successText = $("#referral-success-text");

      if (pct) {
        state.referralCode = code;
        state.discountPct = pct;
        state.ambassadorCode = null;
        successText.textContent = `Code applied — ${(pct * 100).toFixed(1).replace(/\.0$/, "")}% off, courtesy of a Forge partner.`;
        $("#referral-success").hidden = false;
        input.disabled = true;
        applyBtn.textContent = "Applied";
        applyBtn.disabled = true;
      } else if (AMBASSADOR_CODES.includes(code)) {
        state.ambassadorCode = code;
        state.referralCode = null;
        state.discountPct = 0;
        successText.textContent = "Ambassador code applied — thanks for the support! This doesn't change your price.";
        $("#referral-success").hidden = false;
        input.disabled = true;
        applyBtn.textContent = "Applied";
        applyBtn.disabled = true;
      } else {
        input.style.borderColor = "var(--color-orange-600)";
        setTimeout(() => (input.style.borderColor = ""), 1200);
      }
      updateOrderSummary();
    });
  }

  /* ---------------- Step 2 -> 4: student summary ---------------- */

  function fillStudentSummary() {
    const form = $("#details-form");
    if (!form) return;
    const data = new FormData(form);
    state.details = Object.fromEntries(data.entries());

    $("#sum-name").textContent = state.details.fullName || "—";
    $("#sum-email").textContent = state.details.email || "—";
    $("#sum-phone").textContent = state.details.phone || "—";
    $("#sum-status").textContent = state.details.status
      ? state.details.status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "—";
  }

  /* ---------------- Step 4: payment method ---------------- */

  function initPaymentMethods() {
    const radios = $$('input[name="payment"]');
    const bankFields = $("#bank-fields");
    if (!radios.length || !bankFields) return;

    function sync() {
      const selected = radios.find((r) => r.checked);
      bankFields.classList.toggle("is-visible", selected?.value === "bank");
    }

    radios.forEach((r) => r.addEventListener("change", sync));
    sync();
  }

  /* ---------------- Step 4: submit bank transfer claim ---------------- */

  function initTransferSubmit() {
    const btn = $("#confirm-transfer-btn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const statusEl = $("#transfer-status");
      const referenceInput = $("#transfer-reference");
      const reference = referenceInput.value.trim();

      statusEl.hidden = true;

      if (!state.programme) return;
      if (!reference) {
        referenceInput.style.borderColor = "var(--color-orange-600)";
        referenceInput.focus();
        return;
      }

      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.innerHTML = '<span class="btn__spinner" aria-hidden="true"></span>Submitting…';

      try {
        const res = await fetch(`${API_BASE}/api/enrollments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: state.details.fullName,
            email: state.details.email,
            phone: state.details.phone,
            programme_key: state.programme.key,
            programme_label: state.programme.label,
            amount_expected: currentTotal(),
            referral_code: state.referralCode,
            discount_pct: state.discountPct,
            ambassador_code: state.ambassadorCode,
            transfer_reference: reference,
          }),
        });

        if (!res.ok) throw new Error("Request failed");

        const created = await res.json();
        btn.classList.remove("is-loading");
        btn.textContent = "Submitted ✓";
        openSuccessModal(created.id);
      } catch (err) {
        statusEl.textContent = "Something went wrong submitting this — please try again or contact support.";
        statusEl.className = "transfer-status transfer-status--error";
        statusEl.hidden = false;
        btn.disabled = false;
        btn.classList.remove("is-loading");
        btn.textContent = "I've made this transfer →";
      }
    });
  }

  /* ---------------- Step 4: success popup ---------------- */

  // The academy's new-enrollment heads-up is deliberately its own request,
  // triggered here instead of being queued alongside the student's
  // confirmation email on the backend — the two weren't both reliably
  // landing when bundled together. Best-effort: nothing to show the student
  // if this fails, the enrollment itself already succeeded.
  function notifyAcademy(enrollmentId) {
    fetch(`${API_BASE}/api/enrollments/${enrollmentId}/notify-academy`, { method: "POST" }).catch(() => {});
  }

  function openSuccessModal(enrollmentId) {
    const modal = $("#success-modal");
    if (!modal) return;
    modal.dataset.enrollmentId = enrollmentId;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    $("#success-modal-ok")?.focus();
  }

  function initSuccessModal() {
    const modal = $("#success-modal");
    const okBtn = $("#success-modal-ok");
    if (!modal || !okBtn) return;

    okBtn.addEventListener("click", () => {
      modal.hidden = true;
      document.body.classList.remove("modal-open");
      const enrollmentId = modal.dataset.enrollmentId;
      if (enrollmentId) notifyAcademy(enrollmentId);
    });
  }

  /* ---------------- Mobile nav toggle (header hamburger) ---------------- */

  function initMobileNav() {
    const toggle = $(".nav-toggle");
    const nav = $(".site-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("site-nav--open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  /* ---------------- Generic next/back buttons ---------------- */

  function initNav() {
    document.addEventListener("click", (e) => {
      const nextBtn = e.target.closest('[data-action="next"]');
      const backBtn = e.target.closest('[data-action="back"]');
      const editBtn = e.target.closest('[data-action="edit-details"]');

      if (nextBtn) {
        if (state.step === 2 && !validateDetailsForm()) return;
        goToStep(state.step + 1);
      }
      if (backBtn) goToStep(state.step - 1);
      if (editBtn) goToStep(2);
    });
  }

  function validateDetailsForm() {
    const form = $("#details-form");
    if (form.reportValidity()) return true;
    return false;
  }

  /* ---------------- Init ---------------- */

  document.addEventListener("DOMContentLoaded", () => {
    initProgrammeList();
    initReferral();
    initPaymentMethods();
    initTransferSubmit();
    initSuccessModal();
    initMobileNav();
    initNav();
    updateStepper();
    updateOrderSummary();
  });
})();