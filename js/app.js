/* =========================================================
   ALTURA — shared front-end behaviour
   - preloader (home)
   - hero intro choreography
   - giant marquee
   - Our Selection overlay
   - menu panel
   - split-line text reveals
   ========================================================= */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const hasGsap = typeof window.gsap !== 'undefined';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isHome = document.body.classList.contains('home');
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

  if (hasGsap) {
    gsap.defaults({ ease: 'power3.out', duration: 0.85 });
    if (window.CustomEase) {
      CustomEase.create('wipe', '0.73,0.15,0.17,0.99');
      CustomEase.create('soft', '0.18,0.13,0,0.99');
    }
  }
  const EASE_WIPE = window.CustomEase ? 'wipe' : 'power3.inOut';

  /* ---------- cross-document view transitions (shared hero image) ---------- */
  const supportsVT = 'onpagereveal' in window && typeof document.startViewTransition === 'function' && !reduceMotion;
  window.addEventListener('pagereveal', (e) => {
    if (e.viewTransition) {
      window.__vt = true;
      document.documentElement.classList.add('vt-arrival');
    }
  });
  /** Name the elements that should morph into the next page's hero, then navigate.
   *  A view-transition name must be unique on the page, so the current hero gives its name up first. */
  function navigateWithMorph(href, { visual, bg } = {}) {
    if (supportsVT) {
      $$('.hero-visual, .hero-sticky').forEach((el) => { el.style.viewTransitionName = 'none'; });
      if (visual) visual.style.viewTransitionName = 'hero-visual';
      if (bg) bg.style.viewTransitionName = 'hero-bg';
    }
    window.location.href = href;
  }

  /* ---------- fonts ready (bounded) ---------- */
  const fontsReady = Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    wait(1.5),
  ]);

  /* ---------- media loading helper (images and videos) ---------- */
  function loadImage(media, timeout = 6) {
    if (!media) return Promise.resolve();
    if (media.tagName === 'VIDEO') {
      if (media.readyState >= 2) return Promise.resolve();
      return Promise.race([
        new Promise((res) => {
          media.addEventListener('loadeddata', res, { once: true });
          media.addEventListener('error', res, { once: true });
        }),
        wait(timeout),
      ]);
    }
    if (media.complete && media.naturalWidth) return Promise.resolve();
    return Promise.race([
      new Promise((res) => {
        media.addEventListener('load', res, { once: true });
        media.addEventListener('error', res, { once: true });
      }),
      wait(timeout),
    ]);
  }
  const heroMedia = () => $('.hero-visual > img') || $('.hero-visual > video');

  /* =========================================================
     Split text into lines (own implementation, no plugin)
     ========================================================= */
  function splitLines(el) {
    if (!el) return [];
    if (el.dataset.split === '1') return $$('.split-line > span', el);
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    const words = text.split(' ');
    el.textContent = '';
    const probes = words.map((w) => {
      const s = document.createElement('span');
      s.textContent = w;
      s.style.display = 'inline-block';
      el.appendChild(s);
      el.appendChild(document.createTextNode(' '));
      return s;
    });
    const lines = [];
    let lastTop = null;
    probes.forEach((s) => {
      const top = s.offsetTop;
      if (top !== lastTop) { lines.push([]); lastTop = top; }
      lines[lines.length - 1].push(s.textContent);
    });
    el.textContent = '';
    const inners = lines.map((l) => {
      const line = document.createElement('span');
      line.className = 'split-line';
      line.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.textContent = l.join(' ');
      line.appendChild(inner);
      el.appendChild(line);
      return inner;
    });
    el.dataset.split = '1';
    el.classList.add('is-split');
    return inners;
  }

  function unsplit(el) {
    if (!el || el.dataset.split !== '1') return;
    const text = el.getAttribute('aria-label') || el.textContent;
    el.textContent = text;
    el.removeAttribute('aria-label');
    delete el.dataset.split;
  }

  /** Reveal an element's lines from below, clip-masked, slight skew. */
  function revealLines(el, { stagger = 0.09, duration = 0.8, ease = 'power2.out' } = {}) {
    const inners = splitLines(el);
    const lines = inners.map((i) => i.parentElement);
    const tl = gsap.timeline();
    if (!inners.length) return tl;
    gsap.set(lines, { clipPath: 'inset(0% 0% 100% 0%)' });
    gsap.set(inners, { yPercent: 100, skewY: -1, transformOrigin: '0 100%' });
    tl.to(lines, { clipPath: 'inset(-40% 0% -28% 0%)', duration, ease, stagger }, 0)
      .to(inners, { yPercent: 0, skewY: 0, duration, ease, stagger }, 0);
    return tl;
  }

  function hideLines(el) {
    const inners = splitLines(el);
    const lines = inners.map((i) => i.parentElement);
    gsap.set(lines, { clipPath: 'inset(0% 0% 100% 0%)' });
    gsap.set(inners, { yPercent: 100, skewY: -1 });
  }

  /* =========================================================
     Marquee
     ========================================================= */
  function initMarquee(el) {
    const scroll = $('.marquee-scroll', el);
    const base = $('.marquee-collection', el);
    if (!scroll || !base) return;
    $$('.marquee-collection', scroll).slice(1).forEach((c) => c.remove());
    const w = base.getBoundingClientRect().width;
    if (!w) return;
    const copies = Math.ceil((window.innerWidth * 2) / w) + 1;
    for (let i = 0; i < copies; i++) scroll.appendChild(base.cloneNode(true));
    el._marqueeWidth = w;
    if (!hasGsap || reduceMotion) return;
    const speed = parseFloat(el.dataset.marqueeSpeed || '80'); // px / s
    if (el._marqueeTween) el._marqueeTween.kill();
    gsap.set(scroll, { x: 0 });
    el._marqueeTween = gsap.to(scroll, { x: -w, duration: w / speed, ease: 'none', repeat: -1 });
  }

  function initMarquees(root = document) {
    $$('.marquee', root).forEach(initMarquee);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => initMarquees(), 200);
  });

  /* =========================================================
     Hero intro
     ========================================================= */
  function heroIntro({ withVisual = true, delay = 0 } = {}) {
    const tl = gsap.timeline({ paused: true, delay });
    const visual = $('.hero-visual');
    const img = heroMedia();
    const h1 = $('.hero-content [data-lines]') || $('.hero-content h1');
    const price = $('.hero-price');
    const marquee = $('.marquee-reveal');
    const chrome = ['.logo', '.about-btn', '.contact-btn'].map((s) => $(s)).filter(Boolean);
    const footer = ['[data-hero-eyebrow]', '.site-footer [data-copyright]', '.scroll-hint'].map((s) => $(s)).filter(Boolean);
    const actions = $('.site-actions');

    // prime hidden states before revealing the layer
    if (h1) hideLines(h1);
    if (withVisual && visual) {
      gsap.set(visual, { clipPath: 'inset(50% 50% 50% 50%)', visibility: 'visible' });
      gsap.set(img, { scale: 1.5 });
    } else if (visual) {
      gsap.set(visual, { visibility: 'visible' });
    }
    if (marquee) gsap.set(marquee, { yPercent: 28, autoAlpha: 0 });
    gsap.set(chrome, { y: -10, autoAlpha: 0 });
    gsap.set(footer, { y: 10, autoAlpha: 0 });
    if (actions) gsap.set(actions, { yPercent: 60, autoAlpha: 0 });
    if (price) gsap.set(price, { autoAlpha: 0, '--bt': 0, '--br': 0, '--bb': 0, '--bl': 0 });

    document.body.classList.add('is-ready');

    if (withVisual && visual) {
      tl.to(visual, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'power4.out' }, 0.2)
        .to(img, { scale: 1, duration: 1.5, ease: 'power4.out' }, 0.2);
    }
    if (marquee) tl.to(marquee, { yPercent: 0, autoAlpha: 1, duration: 1.3, ease: 'power3.out' }, 0.35);
    tl.to(chrome, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.45);
    if (h1) tl.add(revealLines(h1), 0.6);
    if (price) {
      tl.to(price, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' }, 1.0)
        .to(price, { '--bt': 1, duration: 0.35, ease: 'power1.inOut' }, 1.05)
        .to(price, { '--br': 1, duration: 0.25, ease: 'power1.inOut' }, '>')
        .to(price, { '--bb': 1, duration: 0.35, ease: 'power1.inOut' }, '>')
        .to(price, { '--bl': 1, duration: 0.25, ease: 'power1.inOut' }, '>');
    }
    tl.to(footer, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out' }, 0.9);
    if (actions) tl.to(actions, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 1.0);
    tl.call(() => { window.__introDone = true; document.dispatchEvent(new CustomEvent('altura:introdone')); }, null, '>-0.2');
    tl.play();
    return tl;
  }

  function showEverythingInstantly() {
    document.body.classList.add('is-ready', 'preloader-done');
    document.documentElement.classList.remove('preloading');
    $$('.hero-visual, .marquee-reveal, .logo, .about-btn, .contact-btn, .hero-content, [data-copyright], .scroll-hint, .site-actions').forEach((el) => {
      el.style.visibility = 'visible';
      el.style.opacity = '';
      el.style.clipPath = 'none';
    });
    window.__introDone = true;
    document.dispatchEvent(new CustomEvent('altura:introdone'));
  }

  /* =========================================================
     Preloader (home page)
     ========================================================= */
  async function runPreloader() {
    const pre = $('#site-preloader');
    if (!pre) return false;
    if (!hasGsap || reduceMotion) {
      pre.remove();
      showEverythingInstantly();
      return true;
    }
    const frames = $$('.site-preloader__frame', pre);
    const imgs = frames.map((f) => f.querySelector('img'));
    const box = $('.site-preloader__frames', pre);
    const bg = $('.site-preloader__bg', pre);
    const wrapper = $('.site-preloader__number-wrapper', pre);
    const tens = $('.site-preloader__digit--tens .site-preloader__digit-inner', pre);
    const ones = $('.site-preloader__digit--ones .site-preloader__digit-inner', pre);
    const steps = frames.length >= 5 ? [27, 42, 68, 92, 99] : [27, 48, 72, 99];
    const heroImg = heroMedia();

    const tick = (n, animate = true) => {
      const v = Math.min(99, Math.max(0, Math.round(n)));
      const t = Math.floor(v / 10);
      const o = v % 10;
      if (!animate) {
        gsap.set(tens, { yPercent: -t * 10 });
        gsap.set(ones, { yPercent: -o * 10 });
        return;
      }
      gsap.to(tens, { yPercent: -t * 10, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
      gsap.to(ones, { yPercent: -o * 10, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
    };

    // the square keeps its final (hero) size; each new image pops from the centre and fills it
    const revealFrame = (i) => {
      gsap.fromTo(frames[i],
        { scale: 0.06, autoAlpha: 1, transformOrigin: 'center center' },
        { scale: 1, duration: 0.85, ease: 'back.out(1.1)', overwrite: 'auto' });
    };

    // initial state
    gsap.set(frames, { scale: 0.06, autoAlpha: 0, transformOrigin: 'center center' });
    gsap.set(imgs, { scale: 1 });
    const brand = $$('.site-preloader__logo, .site-preloader__caption', pre);
    // put the loader logo exactly where the page logo will appear, so the brand does not move during the hand-off
    const loaderLogo = $('.site-preloader__logo', pre);
    const pageLogo = $('.logo__img--dark');
    if (loaderLogo && pageLogo) {
      const lr = pageLogo.getBoundingClientRect();
      if (lr.height) gsap.set(loaderLogo, { top: lr.top, left: lr.left, height: lr.height, x: 0, xPercent: 0, transform: 'none' });
    }
    gsap.fromTo(brand, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 0.15 });
    tick(0, false);
    gsap.set(wrapper, { yPercent: 100 });
    gsap.to(wrapper, { yPercent: 0, duration: 0.85, ease: 'power4.out', delay: 0.1 });

    await wait(0.4);
    for (let i = 0; i < frames.length; i++) {
      await loadImage(imgs[i]);
      revealFrame(i);
      tick(steps[i] ?? 99);
      await wait(i === frames.length - 1 ? 0.55 : 0.45);
    }
    tick(99);
    await Promise.all([loadImage(heroImg, 4), fontsReady]);
    await wait(0.2);

    // ---- exit: counter leaves, blue wipes upward, frame morphs into the hero slot
    document.body.classList.add('preloader-exit');
    const slot = $('.hero-visual-slot');
    const from = box.getBoundingClientRect();
    const to = slot.getBoundingClientRect();
    // pin the square to viewport coordinates so shrinking it does not let the grid re-centre it mid-flight
    gsap.set(box, { position: 'fixed', left: from.left, top: from.top, width: from.width, height: from.height, margin: 0, zIndex: 3 });

    const exit = gsap.timeline();
    exit.to(wrapper, { yPercent: -110, duration: 0.5, ease: 'power3.in' }, 0);
    exit.to($$('.site-preloader__caption', pre), { autoAlpha: 0, y: -6, duration: 0.4, ease: 'power2.in' }, 0);
    // the white loader logo hands over to the page logo in the same spot as the wipe passes
    exit.to($('.site-preloader__logo', pre), { autoAlpha: 0, duration: 0.35, ease: 'power1.inOut' }, 0.55);
    exit.to(bg, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.0, ease: EASE_WIPE }, 0.2);
    exit.to(box, {
      left: to.left,
      top: to.top,
      width: to.width,
      height: to.height,
      duration: 0.9,
      ease: 'power2.inOut',
      overwrite: 'auto',
    }, 0.3);

    // page chrome starts while the image is still travelling
    exit.call(() => {
      document.documentElement.classList.remove('preloading');
      heroIntro({ withVisual: false });
    }, null, 0.55);

    exit.call(() => {
      // hand-off: real hero image takes over at the same rect
      gsap.set($('.hero-visual'), { clipPath: 'none', visibility: 'visible' });
      gsap.set(heroImg, { scale: 1 });
      if (heroImg && heroImg.tagName === 'VIDEO') heroImg.play().catch(() => {});
      document.body.classList.add('preloader-done');
      document.body.classList.remove('preloader-exit');
      pre.remove();
    }, null, 1.25);

    return true;
  }

  /* =========================================================
     Our Selection overlay
     ========================================================= */
  function initSelection() {
    const triggers = $$('[data-open-selection]');
    const btn = $('.site-actions [data-open-selection]') || triggers[0];
    const menu = $('#selection-menu');
    const stage = $('#page-stage');
    const actions = $('.site-actions');
    const cards = $$('.selection-card', menu);
    if (!btn || !menu || !stage) return;
    let open = false;
    let busy = false;

    const pageScale = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--page-scale');
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0.38;
    };

    const emit = (phase) => document.dispatchEvent(new CustomEvent('altura:selection', { detail: { phase } }));

    const openMenu = () => {
      if (busy || open) return;
      busy = true; open = true;
      emit('open-start');
      document.body.classList.add('selection-open');
      menu.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      if (!hasGsap || reduceMotion) {
        gsap && gsap.set(stage, { scale: pageScale(), yPercent: 50 });
        busy = false;
        cards[0] && cards[0].focus();
        return;
      }
      gsap.timeline({ onComplete: () => { busy = false; cards[0] && cards[0].focus(); } })
        .to(stage, { scale: pageScale(), yPercent: 50, duration: 1.15, ease: 'expo.inOut' }, 0)
        .to(actions, { autoAlpha: 0, duration: 0.3 }, 0)
        .fromTo(cards, { yPercent: -125 }, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.07 }, 0.3);
    };

    const closeMenu = () => {
      if (busy || !open) return;
      busy = true;
      btn.setAttribute('aria-expanded', 'false');
      const done = () => {
        document.body.classList.remove('selection-open');
        menu.setAttribute('aria-hidden', 'true');
        gsap.set(stage, { clearProps: 'transform' });
        open = false; busy = false;
        emit('close-end');
        btn.focus();
      };
      if (!hasGsap || reduceMotion) { done(); return; }
      gsap.timeline({ onComplete: done })
        .to(cards, { yPercent: -125, duration: 0.8, ease: 'expo.in', stagger: { each: 0.05, from: 'end' } }, 0)
        .to(stage, { scale: 1, yPercent: 0, duration: 1.0, ease: 'expo.inOut' }, 0.15)
        .to(actions, { autoAlpha: 1, duration: 0.4 }, 0.8);
    };

    triggers.forEach((t) => t.addEventListener('click', (e) => {
      e.preventDefault();
      if (t.closest('#nav-menu') && window.ALTURA && window.ALTURA.menu) {
        // from the menu panel: close the panel first, then reveal the residences
        window.ALTURA.menu.hide();
        setTimeout(() => { if (!open) openMenu(); }, 420);
        return;
      }
      open ? closeMenu() : openMenu();
    }));
    stage.addEventListener('click', () => { if (open) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeMenu(); });
    window.ALTURA = window.ALTURA || {};
    window.ALTURA.selection = { open: () => openMenu(), close: () => closeMenu(), isOpen: () => open, isBusy: () => busy };

    cards.forEach((card) => {
      card.addEventListener('click', (e) => {
        if (!hasGsap || reduceMotion || busy) return;
        e.preventDefault();
        busy = true;
        const href = card.getAttribute('href');
        const others = cards.filter((c) => c !== card);
        // the other cards jump off and the page fades; then the chosen card's cover morphs into the next hero
        gsap.timeline({
          onComplete: () => navigateWithMorph(href, { visual: $('.selection-card__cover', card), bg: $('.selection-card__panel', card) }),
        })
          .to(others, { autoAlpha: 0, yPercent: -12, duration: 0.45, ease: 'power2.in', stagger: 0.05 }, 0)
          .to(stage, { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0)
          .to(card, { scale: 1.03, duration: 0.6, ease: 'power2.inOut' }, 0);
      });
    });
  }

  /* =========================================================
     Menu panel
     ========================================================= */
  function initNavMenu() {
    const menu = $('#nav-menu');
    const panel = $('.nav-menu__panel', menu);
    const overlay = $('.nav-menu__overlay', menu);
    const openBtn = $('[data-open-menu]');
    const closeBtns = $$('[data-close-menu]', menu);
    const items = [...$$('.nav-menu__links a', menu), ...$$('.nav-menu__contact a', menu)];
    if (!menu || !panel || !openBtn) return;
    let open = false;
    let busy = false;

    const show = () => {
      if (open || busy) return;
      open = true; busy = true;
      document.body.classList.add('nav-menu-open');
      menu.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      if (!hasGsap || reduceMotion) {
        panel.style.clipPath = 'inset(0 0 0 0)';
        overlay.style.opacity = '1';
        busy = false;
        items[0] && items[0].focus();
        return;
      }
      gsap.timeline({ onComplete: () => { busy = false; items[0] && items[0].focus(); } })
        .to(overlay, { opacity: 1, duration: 0.5 }, 0)
        .fromTo(panel, { clipPath: 'inset(100% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' }, 0)
        .fromTo(items, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.06, ease: 'power3.out' }, 0.35);
    };

    const hide = () => {
      if (!open || busy) return;
      busy = true;
      const done = () => {
        document.body.classList.remove('nav-menu-open');
        menu.setAttribute('aria-hidden', 'true');
        openBtn.setAttribute('aria-expanded', 'false');
        open = false; busy = false;
        openBtn.focus();
      };
      if (!hasGsap || reduceMotion) {
        panel.style.clipPath = '';
        overlay.style.opacity = '';
        done();
        return;
      }
      gsap.timeline({ onComplete: done })
        .to(items, { y: 14, autoAlpha: 0, duration: 0.35, stagger: { each: 0.03, from: 'end' }, ease: 'power2.in' }, 0)
        .to(panel, { clipPath: 'inset(100% 0% 0% 100%)', duration: 0.75, ease: 'expo.inOut' }, 0.1)
        .to(overlay, { opacity: 0, duration: 0.45 }, 0.3);
    };

    openBtn.addEventListener('click', () => (open ? hide() : show()));
    closeBtns.forEach((b) => b.addEventListener('click', hide));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });
    window.ALTURA = window.ALTURA || {};
    window.ALTURA.menu = { show, hide, isOpen: () => open };
  }

  /* =========================================================
     Home: scrolling down reveals the residences (same move as the button)
     ========================================================= */
  function initHomeScrollReveal() {
    if (!isHome) return;
    const sel = () => window.ALTURA && window.ALTURA.selection;
    const ready = () => window.__introDone && sel() && !sel().isBusy() && !(window.ALTURA.menu && window.ALTURA.menu.isOpen());
    let lastAt = 0;
    const act = (dir) => {
      const now = Date.now();
      if (!ready() || now - lastAt < 900) return;
      const s = sel();
      if (dir > 0 && !s.isOpen()) { lastAt = now; s.open(); }
      else if (dir < 0 && s.isOpen()) { lastAt = now; s.close(); }
    };
    window.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > 12) act(Math.sign(e.deltaY)); }, { passive: true });
    let touchY = null;
    window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchend', (e) => {
      if (touchY === null) return;
      const dy = touchY - e.changedTouches[0].clientY;
      touchY = null;
      if (Math.abs(dy) > 40) act(Math.sign(dy));
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); act(1); }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); act(-1); }
    });
  }

  /* =========================================================
     Custom cursor: dot + lagging ring, labels on drag/view targets
     ========================================================= */
  function initCursor() {
    const el = $('.cursor');
    if (!el || !hasGsap || reduceMotion) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const dot = $('.cursor__dot', el);
    const ring = $('.cursor__ring', el);
    const label = $('.cursor__label', el);
    document.documentElement.classList.add('has-cursor');
    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' });
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.38, ease: 'power3.out' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.38, ease: 'power3.out' });
    let shown = false;
    const move = (e) => {
      dotX(e.clientX); dotY(e.clientY); ringX(e.clientX); ringY(e.clientY);
      if (!shown) { shown = true; gsap.set([dot, ring], { x: e.clientX, y: e.clientY }); gsap.to(el, { autoAlpha: 1, duration: 0.3 }); }
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', () => { shown = false; gsap.to(el, { autoAlpha: 0, duration: 0.25 }); });
    const interactive = 'a, button, [role="button"], input, select, textarea, label';
    const setState = (target) => {
      const labelled = target && target.closest('[data-cursor]');
      const text = labelled ? labelled.getAttribute('data-cursor') : '';
      el.classList.toggle('cursor--label', !!text);
      el.classList.toggle('cursor--hover', !text && !!(target && target.closest(interactive)));
      if (text) label.textContent = text;
    };
    document.addEventListener('pointerover', (e) => setState(e.target));
    document.addEventListener('pointerdown', () => el.classList.add('cursor--down'));
    document.addEventListener('pointerup', () => el.classList.remove('cursor--down'));
  }

  /* =========================================================
     Lightbox (floor plans, room renders)
     ========================================================= */
  function initLightbox() {
    const box = $('#lightbox');
    if (!box) return;
    const img = $('.lightbox__img', box);
    const text = $('.lightbox__text', box);
    const count = $('.lightbox__count', box);
    let open = false;
    let lastFocus = null;
    let items = [];   // [{ src, caption, alt }]
    let index = 0;

    const itemFrom = (el) => {
      const image = el.querySelector('img');
      return { src: el.getAttribute('data-lightbox'), caption: el.getAttribute('data-caption') || '', alt: image ? image.alt : '' };
    };
    const render = (animate = true) => {
      const it = items[index];
      if (!it) return;
      img.src = it.src; img.alt = it.alt || it.caption || '';
      text.textContent = it.caption;
      count.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
      if (animate && hasGsap && !reduceMotion) gsap.fromTo(img, { autoAlpha: 0.4, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
    };
    const show = (list, start = 0) => {
      items = list; index = start;
      box.classList.toggle('lightbox--gallery', items.length > 1);
      render(false);
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
      open = true;
      if (hasGsap && !reduceMotion) {
        gsap.fromTo(box, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' });
        gsap.fromTo(img, { scale: 0.96 }, { scale: 1, duration: 0.6, ease: 'power3.out' });
      } else box.style.visibility = 'visible';
      $('[data-close-lightbox]', box).focus();
    };
    const step = (dir) => { if (items.length < 2) return; index = (index + dir + items.length) % items.length; render(); };
    const hide = () => {
      if (!open) return;
      open = false;
      const done = () => { box.setAttribute('aria-hidden', 'true'); document.body.classList.remove('lightbox-open'); img.src = ''; lastFocus && lastFocus.focus(); };
      if (hasGsap && !reduceMotion) gsap.to(box, { autoAlpha: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
      else { box.style.visibility = 'hidden'; done(); }
    };

    document.addEventListener('click', (e) => {
      // "View all photos": every image of that slider, starting with the first
      const galleryBtn = e.target.closest('[data-gallery-open]');
      if (galleryBtn) {
        e.preventDefault();
        const scope = $(galleryBtn.getAttribute('data-gallery-open')) || document;
        const list = $$('.slider [data-lightbox]', scope).map(itemFrom);
        if (list.length) { lastFocus = galleryBtn; show(list, 0); }
        return;
      }
      const t = e.target.closest('[data-lightbox]');
      if (t) {
        e.preventDefault();
        lastFocus = t;
        // a slide opens the whole slider as a gallery at its own position; a lone link opens just itself
        const slider = t.closest('.slider');
        const list = slider ? $$('[data-lightbox]', slider).map(itemFrom) : [itemFrom(t)];
        const start = slider ? Math.max(0, $$('[data-lightbox]', slider).indexOf(t)) : 0;
        show(list, start);
        return;
      }
      if (!open) return;
      if (e.target.closest('[data-lightbox-prev]')) { step(-1); return; }
      if (e.target.closest('[data-lightbox-next]')) { step(1); return; }
      if (e.target.closest('[data-close-lightbox]') || e.target === box) hide();
    });
    document.addEventListener('keydown', (e) => {
      if (!open) return;
      if (e.key === 'Escape') hide();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
  }

  /* =========================================================
     Enquiry form → pre-filled email (no backend yet)
     ========================================================= */
  function initEnquiryForm() {
    const form = $('[data-enquiry-form]');
    if (!form) return;
    const note = $('[data-form-note]', form);
    // "?subject=One Bed Suite" from a residence page preselects the subject
    const wanted = new URLSearchParams(location.search).get('subject');
    const select = form.querySelector('[name="subject"]');
    if (wanted && select) {
      const opt = [...select.options].find((o) => o.value.toLowerCase() === wanted.toLowerCase());
      if (opt) select.value = opt.value;
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const required = ['name', 'phone', 'email'];
      const missing = required.filter((k) => !String(data.get(k) || '').trim());
      if (missing.length) {
        missing.forEach((k) => { const f = form.querySelector(`[name="${k}"]`); f && f.classList.add('is-invalid'); });
        if (note) note.textContent = 'Please add your name, phone number and email so we can get back to you.';
        const first = form.querySelector(`[name="${missing[0]}"]`); first && first.focus();
        return;
      }
      const subject = `Enquiry: ${data.get('subject') || 'Homeland Global Park'}`;
      const body = [`Name: ${data.get('name')}`, `Phone: ${data.get('phone')}`, `Email: ${data.get('email')}`, `Subject: ${data.get('subject') || ''}`, '', String(data.get('message') || '')].join('\n');
      window.location.href = `mailto:${form.dataset.mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (note) note.textContent = 'Your email app should now open with the enquiry pre-filled. If it did not, write to ' + form.dataset.mail + '.';
    });
    form.addEventListener('input', (e) => { if (e.target.classList) e.target.classList.remove('is-invalid'); });
  }

  /* =========================================================
     Soft page transitions for internal links
     ========================================================= */
  function initTransitions() {
    if (!hasGsap || reduceMotion) return;
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      if (a.closest('.selection-card')) return; // has its own exit
      if (a.hasAttribute('data-open-selection') || a.hasAttribute('data-lightbox')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || a.target === '_blank') return;
      if (/^https?:/i.test(href) && !href.startsWith(location.origin)) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      document.body.classList.add('is-leaving');
      const next = a.closest('.cat-next');
      if (next) {
        // the teaser photo hands over to the next page's hero; everything else fades first
        gsap.timeline({ onComplete: () => navigateWithMorph(href, { visual: $('.cat-next__viewport', next), bg: next }) })
          .to($$('#page-stage main > *:not(.cat-next)'), { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0)
          .to('.site-actions', { autoAlpha: 0, duration: 0.3 }, 0)
          .to($('.cat-next__body', next), { autoAlpha: 0, y: -16, duration: 0.35, ease: 'power2.in' }, 0);
        return;
      }
      gsap.to('#page-stage, .site-actions', { autoAlpha: 0, duration: 0.45, ease: 'power2.in', onComplete: () => navigateWithMorph(href) });
    });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        document.body.classList.remove('is-leaving');
        gsap.set('#page-stage, .site-actions', { clearProps: 'opacity,visibility' });
      }
    });
  }

  /* =========================================================
     Boot
     ========================================================= */
  async function boot() {
    initNavMenu();
    initSelection();
    initHomeScrollReveal();
    initCursor();
    initLightbox();
    initEnquiryForm();
    initTransitions();
    await fontsReady;
    initMarquees();

    const viaMorph = !!window.__vt;
    if (isHome && !viaMorph) {
      const ran = await runPreloader();
      if (!ran) {
        document.documentElement.classList.remove('preloading');
        document.body.classList.add('preloader-done');
        if (hasGsap && !reduceMotion) heroIntro({ withVisual: true });
        else showEverythingInstantly();
      }
    } else {
      // arriving through a page morph (or a page without a loader): no loader, the hero image is already in place
      const pre = $('#site-preloader');
      if (pre) pre.remove();
      document.documentElement.classList.remove('preloading');
      document.body.classList.add('preloader-done');
      if ($('.hero-visual') && hasGsap && !reduceMotion) heroIntro({ withVisual: !viaMorph, delay: viaMorph ? 0.35 : 0.1 });
      else showEverythingInstantly(); // pages without the square hero (The Experience) still need is-ready + introdone
    }
  }

  window.ALTURA = { splitLines, unsplit, revealLines, hideLines, initMarquee, initMarquees, heroIntro, reduceMotion, hasGsap, fontsReady, loadImage };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
