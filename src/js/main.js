// Forge Academy — main.js

// ---- FAQ accordion ----
function initFaq() {
  const items = document.querySelectorAll('.faq-item');

  items.forEach((item) => {
    const trigger = item.querySelector('.faq-item__trigger');
    const panel = item.querySelector('.faq-item__panel');

    trigger.addEventListener('click', () => {
      const isOpen = item.getAttribute('data-open') === 'true';

      // close all others
      items.forEach((other) => {
        if (other !== item) {
          other.setAttribute('data-open', 'false');
          other.querySelector('.faq-item__panel').style.maxHeight = null;
          other.querySelector('.faq-item__trigger').setAttribute('aria-expanded', 'false');
        }
      });

      const next = !isOpen;
      item.setAttribute('data-open', String(next));
      trigger.setAttribute('aria-expanded', String(next));
      panel.style.maxHeight = next ? panel.scrollHeight + 'px' : null;
    });
  });

  // open first item by default
  if (items[0]) {
    items[0].setAttribute('data-open', 'true');
    const panel = items[0].querySelector('.faq-item__panel');
    panel.style.maxHeight = panel.scrollHeight + 'px';
    items[0].querySelector('.faq-item__trigger').setAttribute('aria-expanded', 'true');
  }
}

// ---- Testimonial carousel (dot navigation only, single active card shown on mobile) ----
function initTestimonials() {
  const dots = document.querySelectorAll('.testimonial-dots .dot');
  const quote = document.querySelector('[data-testimonial-quote]');
  const name = document.querySelector('[data-testimonial-name]');
  const role = document.querySelector('[data-testimonial-role]');

  if (!dots.length || !window.forgeTestimonials) return;

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      dots.forEach((d) => d.setAttribute('aria-current', 'false'));
      dot.setAttribute('aria-current', 'true');

      const data = window.forgeTestimonials[i];
      if (data && quote) {
        quote.textContent = data.quote;
        name.textContent = data.name;
        role.textContent = data.role;
      }
    });
  });
}

// ---- Mobile nav toggle ----
function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('site-nav--open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initFaq();
  initTestimonials();
  initNav();
});