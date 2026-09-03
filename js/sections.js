/* =========================================================
   ALTURA — scroll story for inner pages
   Lenis smooth scroll + GSAP ScrollTrigger:
   - sticky hero whose image grows to full screen
   - tilted draggable project slider
   - line / fade / clip reveals, parallax figures
   ========================================================= */
(() => {
  'use strict';
  const A = window.ALTURA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const body = document.body;

  const showAll = () => {
    body.classList.add('reveals-ready');
    $$('[data-lines], [data-fade], [data-clip], [data-line], .slider__item, .marquee-reveal').forEach((el) => {
      el.style.visibility = 'visible';
      el.style.opacity = '';
      el.style.clipPath = '';
      el.style.transform = '';
    });
  };

  if (!A || !A.hasGsap || typeof ScrollTrigger === 'undefined') { showAll(); return; }
  gsap.registerPlugin(ScrollTrigger);
  const reduce = A.reduceMotion;

  /* ---------- smooth scroll (single engine: Lenis) ---------- */
  let lenis = null;
  if (!reduce && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis;
    // no scrolling while the loader / intro runs
    if (document.documentElement.classList.contains('preloading')) {
      lenis.stop();
      document.addEventListener('altura:introdone', () => lenis.start(), { once: true });
    }
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;

  /* ---------- hero grows to full screen ---------- */
  function initHeroGrow() {
    const stage = $('.hero-stage');
    const sticky = $('.hero-sticky');
    const slot = $('.hero-visual-slot');
    const visual = $('.hero-visual');
    const spacer = $('.hero-spacer');
    if (!stage || !sticky || !slot || !visual || !spacer) return;

    const grow = () => (1.1 * vh() + 0.052 * vw()) * 2;
    const hold = () => 0.05 * vh();
    const setSpacer = () => { spacer.style.height = `${Math.round(grow() + hold())}px`; };
    setSpacer();
    ScrollTrigger.addEventListener('refreshInit', setSpacer);

    if (reduce) return;

    const slotRel = () => {
      const s = slot.getBoundingClientRect();
      const h = sticky.getBoundingClientRect();
      return { left: s.left - h.left, top: s.top - h.top, w: s.width, h: s.height };
    };
    const shade = $('.hero-visual__shade', visual);
    const fading = ['.hero-section .marquee', '.hero-content', '.scroll-hint'].map((s) => $(s)).filter(Boolean);

    gsap.timeline({
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: () => `+=${grow()}`,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => body.classList.toggle('hero-grown', self.progress > 0.42),
      },
    })
      .fromTo(visual,
        { left: 0, top: 0, width: () => slotRel().w, height: () => slotRel().h },
        { left: () => -slotRel().left, top: () => -(0.05 * vh()) - slotRel().top, width: () => vw(), height: () => 1.1 * vh(), ease: 'none', immediateRender: false },
        0)
      .to(fading, { autoAlpha: 0, duration: 0.3, ease: 'none' }, 0)
      .to(shade, { opacity: 1, duration: 0.5, ease: 'none' }, 0.25);

    // colour theme flips once the white sections arrive
    const gallery = $('.cat-gallery') || $('.home-collections') || $('.xp-services') || $('.about-intro') || $('.contact-grid');
    if (gallery) {
      ScrollTrigger.create({
        trigger: gallery,
        start: 'top 65%',
        onEnter: () => body.classList.add('past-hero'),
        onLeaveBack: () => body.classList.remove('past-hero'),
      });
    }
  }

  /* ---------- reveals ---------- */
  const once = (el, extra = {}) => ({ trigger: el, start: 'top 85%', once: true, ...extra });

  function initReveals() {
    body.classList.add('reveals-ready');

    if (reduce) { showAll(); return; }

    $$('[data-lines]').forEach((el) => {
      if (el.closest('.hero-content')) return; // handled by the hero intro
      A.hideLines(el);
      el.classList.add('is-split');
      ScrollTrigger.create({ ...once(el), onEnter: () => A.revealLines(el, { stagger: 0.09, duration: 0.9 }) });
    });

    $$('[data-fade]').forEach((el) => {
      gsap.set(el, { autoAlpha: 0, y: 26 });
      ScrollTrigger.create({ ...once(el), onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.95, ease: 'power3.out' }) });
    });

    $$('[data-clip]').forEach((el) => {
      const img = el.querySelector('img');
      gsap.set(el, { clipPath: 'inset(0% 0% 100% 0%)' });
      const scaleIt = img && !img.hasAttribute('data-parallax-figure');
      if (scaleIt) gsap.set(img, { scale: 1.12 });
      ScrollTrigger.create({
        ...once(el, { start: 'top 82%' }),
        onEnter: () => {
          gsap.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.15, ease: 'power4.out' });
          if (scaleIt) gsap.to(img, { scale: 1, duration: 1.35, ease: 'power4.out' });
        },
      });
    });

    $$('[data-line]').forEach((el) => {
      gsap.set(el, { scaleY: 0 });
      ScrollTrigger.create({ ...once(el), onEnter: () => gsap.to(el, { scaleY: 1, duration: 1, ease: 'power3.out' }) });
    });

    $$('.cat-intro__line').forEach((el) => {
      gsap.set(el, { scaleY: 0 });
      ScrollTrigger.create({ ...once(el), onEnter: () => gsap.to(el, { scaleY: 1, duration: 1, ease: 'power3.out' }) });
    });

    $$('[data-slider]').forEach((s) => {
      const items = $$('.slider__item', s);
      gsap.set(items, { autoAlpha: 0, y: 48 });
      ScrollTrigger.create({
        ...once(s, { start: 'top 78%' }),
        onEnter: () => gsap.to(items, { autoAlpha: 1, y: 0, duration: 1.05, ease: 'power3.out', stagger: 0.08 }),
      });
    });

    $$('.marquee--outro .marquee-reveal').forEach((el) => {
      gsap.set(el, { yPercent: 30, autoAlpha: 0 });
      ScrollTrigger.create({ ...once(el, { start: 'top 90%' }), onEnter: () => gsap.to(el, { yPercent: 0, autoAlpha: 1, duration: 1.2, ease: 'power3.out' }) });
    });

    $$('.cat-next__body').forEach((el) => {
      const kids = Array.from(el.children);
      gsap.set(kids, { y: 24, autoAlpha: 0 });
      ScrollTrigger.create({ ...once(el.closest('.cat-next'), { start: 'top 75%' }), onEnter: () => gsap.to(kids, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.09, ease: 'power3.out' }) });
    });
  }

  /* ---------- parallax ---------- */
  function initParallax() {
    if (reduce) return;
    $$('.cat-parallax').forEach((sec) => {
      const img = $('img', sec);
      if (!img) return;
      gsap.set(img, { scale: 1.2 });
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 8, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
      });
    });
    $$('[data-parallax-figure]').forEach((img) => {
      const fig = img.closest('figure') || img.parentElement;
      gsap.set(img, { scale: 1.12 });
      gsap.fromTo(img, { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: 0.4, invalidateOnRefresh: true },
      });
    });
    $$('.about-figure img, .home-story__figure img:not([data-parallax-figure])').forEach((img) => {
      gsap.set(img, { scale: 1.12 });
      gsap.fromTo(img, { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.4, invalidateOnRefresh: true },
      });
    });
    $$('.cat-next').forEach((sec) => {
      const p = $('.cat-next__parallax', sec);
      if (!p) return;
      gsap.set(p, { scale: 1.15 });
      gsap.fromTo(p, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
      });
    });
  }

  /* ---------- pinned strip: vertical scroll moves the row sideways ---------- */
  function initStrip(root) {
    const viewport = $('.strip__viewport', root);
    const track = $('.strip__track', root);
    if (!viewport || !track || reduce) return;
    const pad = () => parseFloat(getComputedStyle(viewport).paddingLeft) || 0;
    const dist = () => Math.max(0, track.scrollWidth + pad() * 2 - vw());
    gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: () => `+=${dist()}`,
        pin: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
  }

  /* ---------- tilted slider: driven by the page scroll, drag and arrows add an offset ---------- */
  function initSlider(root) {
    const viewport = $('.slider__viewport', root);
    const track = $('.slider__track', root);
    const items = $$('.slider__item', root);
    const prev = $('[data-prev]', root);
    const next = $('[data-next]', root);
    if (!viewport || !track || !items.length) return;

    let target = 0;
    let max = 0;
    let scrollX = 0;
    let offset = 0;
    let dragging = false;
    let startX = 0;
    let startOffset = 0;

    const gap = () => parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
    const step = () => items[0].offsetWidth + gap();
    const measure = () => {
      const w = items.reduce((n, it) => n + it.offsetWidth, 0) + gap() * (items.length - 1);
      max = Math.max(0, w - track.offsetWidth);
    };
    const setX = reduce
      ? (v) => gsap.set(track, { x: v })
      : gsap.quickTo(track, 'x', { duration: 0.9, ease: 'power3.out' });
    const clamp = (v) => Math.min(0, Math.max(-max, v));
    const updateArrows = () => {
      if (prev) prev.disabled = target >= -1;
      if (next) next.disabled = target <= -max + 1;
    };
    const apply = () => { target = clamp(scrollX + offset); setX(target); updateArrows(); };

    // scroll drive: the strip travels most of its length while the section passes through the viewport
    if (!reduce) {
      ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => { scrollX = -max * 0.85 * self.progress; apply(); },
        invalidateOnRefresh: true,
      });
    }

    viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startOffset = offset;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      offset = startOffset + (e.clientX - startX) * 1.35;
      apply();
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('is-dragging');
      offset = target - scrollX; // keep the clamped position
    };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);
    viewport.addEventListener('lostpointercapture', end);

    if (prev) prev.addEventListener('click', () => { offset += step(); apply(); offset = target - scrollX; });
    if (next) next.addEventListener('click', () => { offset -= step(); apply(); offset = target - scrollX; });
    viewport.setAttribute('tabindex', '0');
    viewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); offset -= step(); apply(); offset = target - scrollX; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); offset += step(); apply(); offset = target - scrollX; }
    });

    const ro = new ResizeObserver(() => { measure(); apply(); });
    ro.observe(track);
    measure();
    updateArrows();
  }

  /* ---------- selection overlay: freeze the scrolled page while it is open ---------- */
  function initSelectionFreeze() {
    const stage = $('#page-stage');
    const main = $('#page-stage > main');
    const sticky = $('.hero-sticky');
    let frozenY = 0;
    document.addEventListener('altura:selection', (e) => {
      const phase = e.detail && e.detail.phase;
      if (phase === 'open-start') {
        frozenY = window.scrollY;
        lenis && lenis.stop();
        body.style.height = `${document.documentElement.scrollHeight}px`;
        main.style.transform = `translateY(${-frozenY}px)`;
        if (sticky) {
          const stageH = sticky.parentElement.offsetHeight;
          sticky.style.position = 'relative';
          sticky.style.top = `${Math.max(0, Math.min(frozenY, stageH - vh()))}px`;
        }
      }
      if (phase === 'close-end') {
        main.style.transform = '';
        body.style.height = '';
        if (sticky) { sticky.style.position = ''; sticky.style.top = ''; }
        window.scrollTo(0, frozenY);
        lenis && lenis.start();
        ScrollTrigger.refresh();
      }
      void stage;
    });
  }

  /* ---------- in-page anchors (menu: Floor Plans, Housekeeping, …) ---------- */
  function initAnchors() {
    const scrollToEl = (el) => {
      if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
      else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute('data-open-selection') || a.hasAttribute('data-lightbox')) return;
      const id = a.getAttribute('href').slice(1);
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      if (A.menu) A.menu.hide();
      setTimeout(() => scrollToEl(el), A.menu ? 350 : 0);
    });
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) document.addEventListener('altura:introdone', () => scrollToEl(el), { once: true });
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    initAnchors();
    initHeroGrow();
    initReveals();
    initParallax();
    $$('[data-slider]').forEach(initSlider);
    $$('[data-strip]').forEach(initStrip);
    initSelectionFreeze();
    ScrollTrigger.refresh();
    A.fontsReady.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
    document.addEventListener('altura:introdone', () => ScrollTrigger.refresh(), { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
