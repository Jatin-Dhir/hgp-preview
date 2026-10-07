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

    // phones grow over about one screen of swiping (tablets 1.5, desktop 2) so the story starts sooner
    const mult = () => (vw() <= 650 ? 1.15 : vw() <= 1024 ? 1.5 : 2);
    const grow = () => (1.1 * vh() + 0.052 * vw()) * mult();
    const hold = () => 0.05 * vh();
    const setSpacer = () => { spacer.style.height = `${Math.round(grow() + hold())}px`; };
    setSpacer();
    ScrollTrigger.addEventListener('refreshInit', setSpacer);

    // colour theme flips once the white sections arrive (with reduced motion too: it is colour, not motion)
    const gallery = $('.cat-gallery') || $('.xp-services');
    if (gallery) {
      ScrollTrigger.create({
        trigger: gallery,
        start: 'top 65%',
        onEnter: () => body.classList.add('past-hero'),
        onLeaveBack: () => body.classList.remove('past-hero'),
      });
      // the Our Residences pill sits near the bottom: it turns solid when the white reaches its own line,
      // otherwise its white outline crosses the white page unseen until the 65% flip
      const actions = $('.site-actions');
      if (actions) {
        ScrollTrigger.create({
          trigger: gallery,
          start: () => `top ${Math.round(actions.offsetTop + actions.offsetHeight / 2)}px`,
          onEnter: () => body.classList.add('actions-light'),
          onLeaveBack: () => body.classList.remove('actions-light'),
        });
      }
    }

    if (reduce) return;

    const slotRel = () => {
      const s = slot.getBoundingClientRect();
      const h = sticky.getBoundingClientRect();
      return { left: s.left - h.left, top: s.top - h.top, w: s.width, h: s.height };
    };
    const shade = $('.hero-visual__shade', visual);
    const fading = ['.hero-section .marquee', '.hero-content', '.scroll-hint'].map((s) => $(s)).filter(Boolean);

    // GPU path: the photo is laid out once at its final full-bleed size (100vw x 110svh) and only *transformed*
    // while the box grows, so the browser never re-rasterises the large image on every scroll frame
    const media = $('.hero-opening-media', visual);
    const baseScale = () => { const s = slotRel(); return Math.max(s.h / (1.1 * vh()), s.w / vw()); };
    if (media) {
      stage.classList.add('hero-stage--gpu');
      const prime = () => { const k = baseScale(); media.dataset.baseScale = String(k); return k; };
      gsap.set(media, { x: 0, y: 0, xPercent: -50, yPercent: -50, scale: prime() });
      ScrollTrigger.addEventListener('refreshInit', prime);
      // the blurred placeholder moves to the box so the photo stays a clean, directly-composited image (sharp while scaling)
      if (media.style.background) { visual.style.background = media.style.background; media.style.background = ''; }
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: () => `+=${grow()}`,
        scrub: 0.5, // a short catch-up smooths wheel steps and touch momentum alike
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          body.classList.toggle('hero-grown', self.progress > 0.42);
          // scrolled before the entrance finished: hand the photo to the scroll story at once instead of fighting it
          if (self.progress > 0.002 && !window.__introDone) {
            if (media) gsap.killTweensOf(media, 'scale');
            gsap.killTweensOf(visual, 'clipPath');
            gsap.set(visual, { clipPath: 'inset(0% 0% 0% 0%)' });
          }
        },
      },
    })
      // the box keeps its slot-sized layout and is only translated/scaled: no layout or paint per scroll frame
      .fromTo(visual,
        { x: 0, y: 0, scaleX: 1, scaleY: 1, transformOrigin: '0 0' },
        { x: () => -slotRel().left, y: () => -(0.05 * vh()) - slotRel().top, scaleX: () => vw() / slotRel().w, scaleY: () => (1.1 * vh()) / slotRel().h, ease: 'none', immediateRender: false },
        0)
      .to(fading, { autoAlpha: 0, duration: 0.3, ease: 'none' }, 0)
      .to(shade, { opacity: 1, duration: 0.5, ease: 'none' }, 0.25);
    if (media) {
      // the photo counter-scales per axis, so it never distorts and simply zooms from its base scale to 1
      const sync = () => {
        const b = baseScale();
        const k = b + (1 - b) * tl.progress();
        gsap.set(media, { scaleX: k / gsap.getProperty(visual, 'scaleX'), scaleY: k / gsap.getProperty(visual, 'scaleY') });
      };
      tl.eventCallback('onUpdate', sync);
    }
  }

  /* ---------- reveals ---------- */
  // reveals start as a block enters the screen and stay short, so content never feels late (was 'top 85%', ~1 s)
  const once = (el, extra = {}) => ({ trigger: el, start: 'top 95%', once: true, ...extra });

  // Blocks still waiting for their scroll position. Content is hidden by opacity only, never visibility, so the links
  // inside stay in the tab order and the accessibility tree; keyboard focus landing in a block plays it at once.
  const pending = new Set();
  const conceal = (targets, vars) => gsap.set(targets, { opacity: 0, pointerEvents: 'none', ...vars });
  const release = (targets) => gsap.utils.toArray(targets).forEach((t) => { t.style.pointerEvents = ''; });
  function revealOn(el, play, extra) {
    let st = null;
    const entry = {
      el,
      run(quick) {
        if (!pending.delete(entry)) return;
        if (quick && st) st.kill();
        play(quick);
      },
    };
    pending.add(entry);
    st = ScrollTrigger.create({ ...once(el, extra), onEnter: () => entry.run(false) });
  }
  const revealFocused = (target) => {
    if (!target || target === body) return;
    pending.forEach((entry) => { if (entry.el.contains(target)) entry.run(true); });
  };

  function initReveals() {
    body.classList.add('reveals-ready');

    if (reduce) { showAll(); return; }

    $$('[data-lines]').forEach((el) => {
      if (el.closest('.hero-content')) return; // handled by the hero intro
      A.hideLines(el);
      el.classList.add('is-split');
      revealOn(el, () => A.revealLines(el, { stagger: 0.06, duration: 0.65 }));
    });

    // quick = reached by keyboard: a short fade so the focused link and its ring show straight away
    $$('[data-fade]').forEach((el) => {
      conceal(el, { y: 18 });
      revealOn(el, (quick) => gsap.to(el, { opacity: 1, y: 0, duration: quick ? 0.35 : 0.6, ease: 'power3.out', onStart: () => release(el) }));
    });

    $$('[data-clip]').forEach((el) => {
      const img = el.querySelector('img');
      gsap.set(el, { clipPath: 'inset(0% 0% 100% 0%)' });
      const scaleIt = img && !img.hasAttribute('data-parallax-figure');
      if (scaleIt) gsap.set(img, { scale: 1.12 });
      revealOn(el, (quick) => {
        gsap.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: quick ? 0.45 : 0.8, ease: 'power4.out' });
        if (scaleIt) gsap.to(img, { scale: 1, duration: quick ? 0.55 : 0.95, ease: 'power4.out' });
      }, { start: 'top 92%' });
    });

    $$('[data-line]').forEach((el) => {
      gsap.set(el, { scaleY: 0 });
      revealOn(el, () => gsap.to(el, { scaleY: 1, duration: 0.7, ease: 'power3.out' }));
    });

    $$('.cat-intro__line').forEach((el) => {
      gsap.set(el, { scaleY: 0 });
      revealOn(el, () => gsap.to(el, { scaleY: 1, duration: 0.7, ease: 'power3.out' }));
    });

    $$('[data-slider]').forEach((s) => {
      const items = $$('.slider__item', s);
      conceal(items, { y: 36 });
      revealOn(s, (quick) => gsap.to(items, { opacity: 1, y: 0, duration: quick ? 0.4 : 0.7, ease: 'power3.out', stagger: quick ? 0.03 : 0.05, onStart: () => release(items) }), { start: 'top 90%' });
    });

    $$('.marquee--outro .marquee-reveal').forEach((el) => {
      gsap.set(el, { yPercent: 30, autoAlpha: 0 });
      revealOn(el, () => gsap.to(el, { yPercent: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out' }), { start: 'top 98%' });
    });

    $$('.cat-next__body').forEach((el) => {
      const kids = Array.from(el.children);
      conceal(kids, { y: 24 });
      revealOn(el.closest('.cat-next'), (quick) => gsap.to(kids, { y: 0, opacity: 1, duration: quick ? 0.35 : 0.6, stagger: quick ? 0.04 : 0.06, ease: 'power3.out', onStart: () => release(kids) }), { start: 'top 88%' });
    });

    document.addEventListener('focusin', (e) => revealFocused(e.target));
    revealFocused(document.activeElement); // focus that arrived while the fonts were still loading
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
    const gap = () => parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
    const step = () => items[0].offsetWidth + gap();
    const measure = () => {
      const w = items.reduce((n, it) => n + it.offsetWidth, 0) + gap() * (items.length - 1);
      max = Math.max(0, w - track.offsetWidth);
    };
    const clamp = (v) => Math.min(0, Math.max(-max, v));
    const setX = reduce
      ? (v) => gsap.set(track, { x: v })
      : gsap.quickTo(track, 'x', { duration: 0.6, ease: 'power3.out' });
    const updateArrows = () => {
      if (prev) prev.disabled = target >= -1;
      if (next) next.disabled = target <= -max + 1;
    };
    const show = (x) => { target = clamp(x); setX(target); updateArrows(); };
    measure();
    updateArrows();
    viewport.setAttribute('tabindex', '0');
    const onKeys = (fn) => viewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); fn(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); fn(-1); }
    });

    if (reduce || max <= 0) {
      // no pinning (reduced motion, or everything already fits): drag and arrows move the strip directly
      let offset = 0;
      let dragging = false;
      let startX = 0;
      let startOffset = 0;
      viewport.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true; startX = e.clientX; startOffset = offset;
        try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ }
      });
      viewport.addEventListener('pointermove', (e) => { if (dragging) { offset = clamp(startOffset + (e.clientX - startX)); show(offset); } });
      const end = () => { dragging = false; offset = target; };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => viewport.addEventListener(t, end));
      const by = (dir) => { offset = clamp(target - dir * step()); show(offset); };
      if (prev) prev.addEventListener('click', () => by(-1));
      if (next) next.addEventListener('click', () => by(1));
      onKeys(by);
      return;
    }

    // pinned scroll-through: the strip parks in view and the page scroll plays every photo before the page moves on
    const travel = () => Math.round(max * 0.85);
    const st = ScrollTrigger.create({
      trigger: root,
      start: () => `top ${Math.max(0, Math.round((vh() - root.offsetHeight) / 2))}px`,
      end: () => `+=${travel()}`,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefreshInit: measure,
      onUpdate: (self) => show(-max * self.progress),
    });

    // drag, arrows and keys move the page scroll itself, so the strip and the pin always agree
    const scrollFor = (x) => st.start + (Math.min(max, Math.max(0, -x)) / max) * travel();
    const goTo = (y, immediate = false) => {
      const to = Math.min(st.end, Math.max(st.start, y));
      if (window.lenis) window.lenis.scrollTo(to, immediate ? { immediate: true, force: true } : { duration: 0.8 });
      else window.scrollTo({ top: to, behavior: immediate ? 'auto' : 'smooth' });
    };
    let dragging = false;
    let startX = 0;
    let startY = 0;
    viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; startX = e.clientX; startY = window.scrollY;
      try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ }
      viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove', (e) => {
      if (dragging) goTo(startY + (startX - e.clientX) * (travel() / max) * 1.2, true);
    });
    const end = () => { dragging = false; viewport.classList.remove('is-dragging'); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => viewport.addEventListener(t, end));
    const by = (dir) => goTo(scrollFor(target - dir * step()));
    if (prev) prev.addEventListener('click', () => by(-1));
    if (next) next.addEventListener('click', () => by(1));
    onKeys(by);
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
    initParallax();
    $$('[data-slider]').forEach(initSlider);
    initSelectionFreeze();
    ScrollTrigger.refresh();
    // split text only once the web fonts are in, so the line breaks match the final typesetting (fontsReady is capped at 1.5 s)
    A.fontsReady.then(() => { initReveals(); ScrollTrigger.refresh(); });
    window.addEventListener('load', () => ScrollTrigger.refresh());
    document.addEventListener('altura:introdone', () => ScrollTrigger.refresh(), { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
