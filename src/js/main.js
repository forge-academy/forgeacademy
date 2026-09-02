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
  { quote: "I came in with very little coding experience, but the classes were easy to follow and the instructors were supportive.", name: "Tobi A.", role: "Software Engineering Student" },
  { quote: "The mentorship made all the difference — I finally understood how real projects come together.", name: "Chiamaka N.", role: "Data Analytics Student" },
  { quote: "Forge Academy gave me the confidence to start my journey in UI/UX Design. The practical projects made learning easier, and I loved being able to apply what I learned.", name: "Amaka O.", role: "UI/UX Design Student" },
  { quote: "Hands-on projects from week one. I left with a portfolio, not just certificates.", name: "David E.", role: "Software Engineering Student" },
  { quote: "The community kept me accountable. I never felt like I was learning alone.", name: "Ifeoma K.", role: "AI & Automation Student" },
];

function initTestimonials() {
  const dotsWrap = document.querySelector('.testimonial-dots');
  const track = document.querySelector('.testimonial-track');
  const prevBtn = document.querySelector('[data-testimonial-prev]');
  const nextBtn = document.querySelector('[data-testimonial-next]');

  if (!dotsWrap || !track) return;

  let activeIndex = 2;

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
      dot.addEventListener('click', () => {
        activeIndex = Number(dot.dataset.index);
        render();
      });
    });
  }

  prevBtn?.addEventListener('click', () => {
    activeIndex = (activeIndex - 1 + forgeTestimonials.length) % forgeTestimonials.length;
    render();
  });

  nextBtn?.addEventListener('click', () => {
    activeIndex = (activeIndex + 1) % forgeTestimonials.length;
    render();
  });

  render();
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