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

  const highlight = el.closest('.highlight');
  const intro = document.querySelector('.hero__intro');

  const phrases = [
    'Create Your Future',
    'Launch Your Career',
    'Master In-Demand Skills',
    'Build Real Projects',
    'Join a Thriving Community',
    'Get Forged',
  ];

  const longest = phrases.reduce((a, b) => (b.length >= a.length ? b : a));

  // Size the highlight to the LONGEST phrase once (and on resize), so its
  // font-size is fixed for the whole animation and the text just flows
  // horizontally. The old code re-fitted on every keystroke, so a short
  // phrase rendered big and a long one rendered small — that changing line
  // height is what made the page bounce up and down while typing.
  function fitHighlight() {
    if (!highlight || !intro) return;

    const typed = el.textContent;
    highlight.style.fontSize = '';
    el.textContent = longest;

    const available = intro.clientWidth;
    const natural = highlight.scrollWidth;
    if (natural > available) {
      const base = parseFloat(getComputedStyle(highlight).fontSize);
      highlight.style.fontSize = (base * (available / natural)) + 'px';
    }

    el.textContent = typed;
  }

  fitHighlight();
  window.addEventListener('resize', fitHighlight);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitHighlight);
  }

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

      if (charIndex === current.length) {
        isDeleting = true;
        setTimeout(tick, HOLD_TIME);
        return;
      }
      setTimeout(tick, TYPE_SPEED);
    } else {
      charIndex--;
      el.textContent = current.slice(0, charIndex);

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

// ---- Curriculum modal ----
const forgeCurricula = {
  uiux: {
    label: "UI/UX Design",
    tags: "8 weeks • Live online • Beginner friendly",
    weeks: [
      { title: "Foundations of UX & Design Thinking", points: ["Design thinking process", "The product design lifecycle", "Intro to Figma"] },
      { title: "User Research & Personas", points: ["Interviews & surveys", "Building personas", "Empathy mapping"] },
      { title: "Information Architecture & Wireframing", points: ["User flows & sitemaps", "Low-fidelity wireframes", "Content structure"] },
      { title: "Visual Design & Design Systems", points: ["Typography & color theory", "Components & design tokens", "Building a mini design system"] },
      { title: "Prototyping in Figma", points: ["Interactive prototypes", "Micro-interactions", "Developer handoff basics"] },
      { title: "Usability Testing & Iteration", points: ["Running usability tests", "Synthesizing feedback", "Iterating on designs"] },
      { title: "Portfolio Case Study Project", points: ["End-to-end case study", "Mentor feedback", "Polish & documentation"] },
      { title: "Presentation & Career Prep", points: ["Portfolio review", "Interview prep", "Certification"] },
    ],
  },
  swe: {
    label: "Software Engineering",
    tags: "8 weeks • Live online • Beginner friendly",
    weeks: [
      { title: "Programming Fundamentals", points: ["HTML, CSS & JavaScript basics", "Logic & control flow", "Problem-solving practice"] },
      { title: "Git, GitHub & Developer Tooling", points: ["Version control workflows", "Branching & pull requests", "Dev environment setup"] },
      { title: "Frontend Development", points: ["Component-based UI", "State & props", "Building responsive interfaces"] },
      { title: "Backend Development & APIs", points: ["Server basics", "REST API design", "Connecting frontend to backend"] },
      { title: "Databases & Data Modeling", points: ["Relational databases", "Schema design", "CRUD operations"] },
      { title: "Authentication, Testing & Debugging", points: ["User auth basics", "Writing tests", "Debugging techniques"] },
      { title: "Capstone Project Build", points: ["Full-stack project", "Code reviews", "Mentor check-ins"] },
      { title: "Deployment & Career Prep", points: ["Deploying to production", "Portfolio & GitHub polish", "Interview prep"] },
    ],
  },
  data: {
    label: "Data Science",
    tags: "8 weeks • Live online • Beginner friendly",
    weeks: [
      { title: "Data Fundamentals & Statistics", points: ["Descriptive statistics", "Data types", "Analytical thinking"] },
      { title: "Data Analysis with Python & Excel", points: ["Pandas basics", "Excel functions & pivot tables", "Cleaning real datasets"] },
      { title: "Data Wrangling", points: ["Handling missing data", "Merging datasets", "Outlier detection"] },
      { title: "SQL & Databases", points: ["Writing SQL queries", "Joins & aggregations", "Querying real datasets"] },
      { title: "Data Visualization", points: ["Power BI / Tableau basics", "Building dashboards", "Telling a story with charts"] },
      { title: "Intro to Machine Learning", points: ["Core ML concepts", "Simple predictive models", "Model evaluation basics"] },
      { title: "Capstone Analytics Project", points: ["End-to-end analysis project", "Insights & recommendations", "Mentor feedback"] },
      { title: "Storytelling & Career Prep", points: ["Presenting insights", "Portfolio polish", "Interview prep"] },
    ],
  },
  ai: {
    label: "AI & Automation",
    tags: "Coming soon",
    comingSoon: true,
  },
};

function initCurriculumModal() {
  const modal = document.getElementById('curriculum-modal');
  const triggers = document.querySelectorAll('[data-curriculum-trigger]');
  if (!modal || !triggers.length) return;

  const dialog = modal.querySelector('.curriculum-modal__dialog');
  const titleEl = document.getElementById('curriculum-modal-title');
  const tagsEl = document.getElementById('curriculum-modal-tags');
  const bodyEl = document.getElementById('curriculum-modal-body');
  let lastFocused = null;

  function renderCurriculum(key) {
    const data = forgeCurricula[key];
    if (!data) return;

    titleEl.textContent = data.label;
    tagsEl.textContent = data.tags;

    if (data.comingSoon) {
      bodyEl.innerHTML = `
        <div class="curriculum-modal__coming-soon">
          <p>We're putting the finishing touches on this curriculum. Join the community to be first to know when it's ready.</p>
        </div>`;
      return;
    }

    bodyEl.innerHTML = data.weeks
      .map(
        (week, i) => `
        <div class="curriculum-week">
          <span class="curriculum-week__index">${i + 1}</span>
          <div class="curriculum-week__content">
            <h4>${week.title}</h4>
            <ul>${week.points.map((p) => `<li>${p}</li>`).join('')}</ul>
          </div>
        </div>`
      )
      .join('');
  }

  function openModal(key, trigger) {
    lastFocused = trigger;
    renderCurriculum(key);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    dialog.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused) lastFocused.focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openModal(trigger.dataset.curriculumTrigger, trigger));
  });

  modal.querySelectorAll('[data-curriculum-close]').forEach((el) => {
    el.addEventListener('click', closeModal);
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
  initTypingEffect(); //
  initProcessCurve(); //
  initCurriculumModal();

});