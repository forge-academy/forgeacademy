// Forge Academy — main.js

// ---- FAQ accordion ----
function initFaq() {
  const items = document.querySelectorAll('.faq-item');

  items.forEach((item) => {
    const trigger = item.querySelector('.faq-item__trigger');
    const panel = item.querySelector('.faq-item__panel');

    trigger.addEventListener('click', () => {
      const isOpen = item.getAttribute('data-open') === 'true';

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

  if (items[0]) {
    items[0].setAttribute('data-open', 'true');
    const panel = items[0].querySelector('.faq-item__panel');
    panel.style.maxHeight = panel.scrollHeight + 'px';
    items[0].querySelector('.faq-item__trigger').setAttribute('aria-expanded', 'true');
  }
}

// ---- Testimonial carousel ----
const forgeTestimonials = [
  { quote: "I came in with very little coding experience, but the classes were easy to follow and the instructors were supportive.", name: "Tobi A.", role: "UI/UX Design Student" },
  { quote: "The mentorship made all the difference — I finally understood how real projects come together.", name: "Chiamaka N.", role: "UI/UX Design Student" },
  { quote: "Forge Academy gave me the confidence to start my journey in UI/UX Design. The practical projects made learning easier, and I loved being able to apply what I learned.", name: "Amaka O.", role: "UI/UX Design Student" },
  { quote: "Hands-on projects from week one. I left with a portfolio, not just certificates.", name: "David E.", role: "UI/UX Design Student" },
  { quote: "The community kept me accountable. I never felt like I was learning alone.", name: "Ifeoma K.", role: "UI/UX Design Student" },
];

function initTestimonials() {
  const dotsWrap = document.querySelector('.testimonial-dots');
  const track = document.querySelector('.testimonial-track');
  const prevBtn = document.querySelector('[data-testimonial-prev]');
  const nextBtn = document.querySelector('[data-testimonial-next]');

  if (!dotsWrap || !track) return;

  let activeIndex = 2;
  let isAnimating = false;
  const TRANSITION_MS = 220; // keep in sync with the CSS transition duration

  function render() {
    const total = forgeTestimonials.length;
    const prevIndex = (activeIndex - 1 + total) % total;
    const nextIndex = (activeIndex + 1) % total;

    const active = forgeTestimonials[activeIndex];
    const prev = forgeTestimonials[prevIndex];
    const next = forgeTestimonials[nextIndex];

    track.innerHTML = `
      <div class="testimonial-card testimonial-card--side">
        <p class="testimonial-card__quote">${prev.quote}</p>
      </div>
      <div class="testimonial-card testimonial-card--active">
        <p class="testimonial-card__quote">${active.quote}</p>
        <div class="testimonial-card__person">
          <img src="https://randomuser.me/api/portraits/women/45.jpg" alt="" />
          <span>
            <strong>${active.name}</strong>
            <span>${active.role}</span>
          </span>
        </div>
      </div>
      <div class="testimonial-card testimonial-card--side">
        <p class="testimonial-card__quote">${next.quote}</p>
      </div>
    `;

    dotsWrap.innerHTML = forgeTestimonials
      .map((_, i) => `<button class="dot" aria-current="${i === activeIndex}" data-index="${i}"></button>`)
      .join('');

    dotsWrap.querySelectorAll('.dot').forEach((dot) => {
      dot.addEventListener('click', () => goTo(Number(dot.dataset.index)));
    });
  }

  // Fades the track out, swaps the DOM, fades it back in.
  function goTo(newIndex) {
    if (isAnimating || newIndex === activeIndex) return;
    isAnimating = true;

    track.classList.add('is-transitioning');

    window.setTimeout(() => {
      activeIndex = newIndex;
      render();

      requestAnimationFrame(() => {
        track.classList.remove('is-transitioning');
        isAnimating = false;
      });
    }, TRANSITION_MS);
  }

  prevBtn?.addEventListener('click', () => {
    goTo((activeIndex - 1 + forgeTestimonials.length) % forgeTestimonials.length);
  });

  nextBtn?.addEventListener('click', () => {
    goTo((activeIndex + 1) % forgeTestimonials.length);
  });

  render(); // initial paint, no animation needed
}

// ---- Typing effect (hero highlight) ----
function initTypingEffect() {
  const el = document.getElementById('typing-text');
  if (!el) return;

  const phrases = [
    'Create Your Future',
    'Launch Your Career',
    'Master In-Demand Skills',
    'Build Real Projects',
    'Join a Thriving Community',
    'Get Forged',
  ];

  // Respect users who've asked for less motion — just show the first phrase, static.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = phrases[0];
    return;
  }

  const TYPE_SPEED = 65;    // ms per character while typing
  const DELETE_SPEED = 35;  // ms per character while deleting
  const HOLD_TIME = 1600;   // pause once a phrase is fully typed
  const GAP_TIME = 300;     // pause after deleting, before the next phrase starts

  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  function tick() {
    const current = phrases[phraseIndex];

    if (!isDeleting) {
      charIndex++;
      el.textContent = current.slice(0, charIndex);
      fitHighlightWidth();

      if (charIndex === current.length) {
        isDeleting = true;
        setTimeout(tick, HOLD_TIME);
        return;
      }
      setTimeout(tick, TYPE_SPEED);
    } else {
      charIndex--;
      el.textContent = current.slice(0, charIndex);
      fitHighlightWidth();

      if (charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setTimeout(tick, GAP_TIME);
        return;
      }
      setTimeout(tick, DELETE_SPEED);
    }
  }

  tick();
  window.addEventListener('resize', fitHighlightWidth);
}


function fitHighlightWidth() {
  const highlight = document.querySelector('.highlight');
  const intro = document.querySelector('.hero__intro');
  if (!highlight || !intro) return;

  highlight.style.fontSize = ''; // reset to CSS default before measuring
  const available = intro.clientWidth;
  const natural = highlight.scrollWidth;

  if (natural > available) {
    const base = parseFloat(getComputedStyle(highlight).fontSize);
    highlight.style.fontSize = (base * (available / natural)) + 'px';
  }
}

// ---- Process zigzag line (measures actual circle positions, no guessing) ----
function initProcessCurve() {
  const container = document.getElementById('process');
  const svg = document.getElementById('process-curve');
  const badges = container ? Array.from(container.querySelectorAll('.process-badge')) : [];
  if (!container || !svg || badges.length < 2) return;

  function draw() {
    // Mobile switches to a stacked column layout — no diagonal line needed there
    if (window.innerWidth <= 780) {
      svg.innerHTML = '';
      return;
    }

    const containerRect = container.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const points = badges.map((badge) => {
      const r = badge.getBoundingClientRect();
      const x = r.left - containerRect.left + r.width / 2;
      const y = r.top - containerRect.top + r.height / 2;
      return `${x},${y}`;
    });

    svg.innerHTML = `<path d="M ${points.join(' L ')}" fill="none" stroke="#F97316" stroke-width="2" />`;
  }

  draw();
  window.addEventListener('resize', draw);
  window.addEventListener('load', draw); // re-measure once fonts/images finish settling
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
  initTypingEffect(); //
  initProcessCurve(); // 

});