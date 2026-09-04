/* ==========================================================================
   Forge Academy — Register page logic
   ========================================================================== */

(function () {
  const VALID_REFERRAL_CODES = { "FCYW612": 0.25 }; // code -> discount %

  const state = {
    step: 1,
    programme: null, // { key, label, tags, price, icon }
    details: {},
    referralCode: null,
    discountPct: 0,
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
        icon: $(".programme-option__icon", option).textContent,
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
      return;
    }

    empty.hidden = true;
    filled.hidden = false;
    $("#os-icon").textContent = state.programme.icon;
    $("#os-label").textContent = state.programme.label;
    $("#os-tags").textContent = state.programme.tags;
    $("#os-price").textContent = nairaFmt(state.programme.price);

    const discount = currentDiscountAmount();
    $("#os-discount-row").hidden = discount <= 0;
    if (discount > 0) $("#os-discount").textContent = "−" + nairaFmt(discount);

    $("#os-total").textContent = nairaFmt(currentTotal());

    // keep step-3 price breakdown and step-4 pay button in sync too
    updatePriceBreakdown();
    updatePayButton();
  }

  function updatePriceBreakdown() {
    if (!state.programme) return;
    $("#pb-programme-price").textContent = nairaFmt(state.programme.price);
    const discount = currentDiscountAmount();
    $("#pb-discount-row").hidden = discount <= 0;
    if (discount > 0) $("#pb-discount").textContent = "−" + nairaFmt(discount);
    $("#pb-total").textContent = nairaFmt(currentTotal());
  }

  function updatePayButton() {
    const btn = $("#pay-btn");
    if (btn) btn.textContent = `Pay ${nairaFmt(currentTotal())} →`;
  }

  /* ---------------- Step 3: Referral code ---------------- */

  function initReferral() {
    const applyBtn = $("#apply-referral");
    if (!applyBtn) return;

    applyBtn.addEventListener("click", () => {
      const input = $("#referral-code");
      const code = input.value.trim().toUpperCase();
      const pct = VALID_REFERRAL_CODES[code];

      if (pct) {
        state.referralCode = code;
        state.discountPct = pct;
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
    const cardFields = $("#card-fields");
    if (!radios.length) return;

    function sync() {
      const selected = radios.find((r) => r.checked);
      cardFields.classList.toggle("is-visible", selected?.value === "card");
    }

    radios.forEach((r) => r.addEventListener("change", sync));
    sync();
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

    $("#pay-btn")?.addEventListener("click", () => {
      // Hook this up to your real payment/checkout endpoint.
      alert(`Demo checkout — would charge ${nairaFmt(currentTotal())} for ${state.programme?.label}.`);
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
    initNav();
    updateStepper();
    updateOrderSummary();
  });
})();