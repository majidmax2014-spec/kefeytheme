(() => {
  const R = (sel, el = document) => el.querySelector(sel);
  const RA = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    if (!root) return;
    const viewport = R('.happy-reviews__viewport', root);
    const track = R('.happy-reviews__track', root);
    let slides = RA('.happy-reviews__slide', track);
    if (!viewport || slides.length === 0) return;

    const showDots = root.dataset.showDots === 'true';
    const showArrows = root.dataset.showArrows === 'true';
    const autoplayEnabled = root.dataset.autoplay === 'true' && !prefersReduced;
    const speed = parseInt(root.dataset.speed || '5000', 10);

    // Duplicate to ensure min 3
    while (slides.length < 3) {
      const clone = slides[slides.length - 1].cloneNode(true);
      track.appendChild(clone);
      slides = RA('.happy-reviews__slide', track);
    }

    slides.forEach((s, i) => s.dataset.logicalIndex = String(i % slides.length));
    const logicalCount = slides.length;
    let items = [];
    let clonesPerSide = Math.min(2, logicalCount);
    let current = clonesPerSide; // physical index
    let timer = null;
    let isHovered = false, isFocused = false;
    let startX = 0, startT = 0, curT = 0, dragging = false, moved = false;

    // Build dots
    const dotsWrap = R('.happy-reviews__dots', root);
    if (dotsWrap && showDots) {
      dotsWrap.innerHTML = '';
      for (let i = 0; i < logicalCount; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'happy-reviews__dot';
        b.setAttribute('aria-label', `Go to review ${i + 1}`);
        b.addEventListener('click', () => goLogical(i));
        dotsWrap.appendChild(b);
      }
    }

    // Arrows
    const prevBtn = R('.happy-reviews__arrow--prev', root);
    const nextBtn = R('.happy-reviews__arrow--next', root);
    if (prevBtn) prevBtn.addEventListener('click', () => goLogical(activeLogical() - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goLogical(activeLogical() + 1));

    // Hover/focus pause
    root.addEventListener('mouseenter', () => { isHovered = true; stop(); });
    root.addEventListener('mouseleave', () => { isHovered = false; maybeStart(); });
    root.addEventListener('focusin', () => { isFocused = true; stop(); });
    root.addEventListener('focusout', () => { isFocused = false; maybeStart(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else maybeStart(); });

    // Pointer drag
    viewport.addEventListener('pointerdown', (e) => {
      dragging = true; moved = false;
      viewport.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startT = curT;
      track.style.transition = 'none';
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) moved = true;
      curT = startT + dx;
      applyTransform(curT);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      snapToClosest();
      if (moved) {
        viewport.addEventListener('click', cancelOnce, true);
        setTimeout(() => viewport.removeEventListener('click', cancelOnce, true), 250);
      }
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', endDrag);

    function cancelOnce(e) { e.preventDefault(); e.stopPropagation(); }

    // Rebuild on resize
    window.addEventListener('resize', rebuild);
    rebuild();

    function rebuild() {
      // Build clones
      track.style.transition = 'none';
      track.innerHTML = '';
      const originals = [];
      for (const s of slides) originals.push(s.cloneNode(true));
      const before = originals.slice(-clonesPerSide).map(n => (n.dataset.clone = 'true', n));
      const after = originals.slice(0, clonesPerSide).map(n => (n.dataset.clone = 'true', n));
      before.forEach(n => track.appendChild(n.cloneNode(true)));
      originals.forEach(n => track.appendChild(n.cloneNode(true)));
      after.forEach(n => track.appendChild(n.cloneNode(true)));
      items = RA('.happy-reviews__slide', track);
      // Restore centers
      current = clonesPerSide;
      curT = -offsetToCenter(current);
      applyTransform(curT);
      updateStates();
      updateDots();
      // Restore transition
      setTimeout(() => { track.style.transition = prefersReduced ? 'none' : 'transform 500ms ease'; }, 0);
      maybeStart();
    }

    function slideRect(i) { return items[i].getBoundingClientRect(); }
    function offsetToCenter(i) {
      const el = items[i];
      const left = el.offsetLeft + el.offsetWidth / 2 - viewport.clientWidth / 2;
      return left;
    }
    function applyTransform(x) { track.style.transform = `translate3d(${x}px,0,0)`; }
    function targetTransformFor(i) { return -offsetToCenter(i); }
    function activeLogical() { return Number(items[current].dataset.logicalIndex || 0); }

    function updateStates() {
      items.forEach(s => s.classList.remove('is-active','is-prev','is-next','is-far-prev','is-far-next'));
      const idx = current;
      if (items[idx]) items[idx].classList.add('is-active');
      if (items[idx-1]) items[idx-1].classList.add('is-prev');
      if (items[idx+1]) items[idx+1].classList.add('is-next');
      if (items[idx-2]) items[idx-2].classList.add('is-far-prev');
      if (items[idx+2]) items[idx+2].classList.add('is-far-next');
    }
    function updateDots() {
      if (!dotsWrap || !showDots) return;
      const a = activeLogical();
      RA('.happy-reviews__dot', dotsWrap).forEach((d,i) => {
        if (i === a) d.setAttribute('aria-current','true');
        else d.removeAttribute('aria-current');
      });
    }
    function normalize() {
      const logicalStart = clonesPerSide;
      const logicalEnd = clonesPerSide + logicalCount - 1;
      if (current < logicalStart) {
        current += logicalCount;
        curT = targetTransformFor(current);
        track.style.transition = 'none';
        applyTransform(curT);
        // next frame restore transition
        requestAnimationFrame(() => { track.style.transition = prefersReduced ? 'none' : 'transform 500ms ease'; });
      } else if (current > logicalEnd) {
        current -= logicalCount;
        curT = targetTransformFor(current);
        track.style.transition = 'none';
        applyTransform(curT);
        requestAnimationFrame(() => { track.style.transition = prefersReduced ? 'none' : 'transform 500ms ease'; });
      }
    }
    function snapToClosest() {
      // find nearest
      let best = 0, bestD = Infinity;
      const center = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(c - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      goPhysical(best);
    }
    function goPhysical(i) {
      current = i;
      curT = targetTransformFor(i);
      track.style.transition = prefersReduced ? 'none' : 'transform 500ms ease';
      applyTransform(curT);
      track.addEventListener('transitionend', normalize, { once: true });
      updateStates();
      updateDots();
    }
    function findNearestPhysicalForLogical(logIdx) {
      let best = current, bestDist = Infinity;
      items.forEach((el, i) => {
        if (Number(el.dataset.logicalIndex) === ((logIdx % logicalCount)+logicalCount)%logicalCount) {
          const d = Math.abs(i - current);
          if (d < bestDist) { bestDist = d; best = i; }
        }
      });
      return best;
    }
    function goLogical(logIdx) {
      const phys = findNearestPhysicalForLogical(logIdx);
      goPhysical(phys);
    }
    function start() {
      if (!autoplayEnabled || timer) return;
      timer = setInterval(() => { goLogical(activeLogical() + 1); }, Math.max(2000, speed));
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function maybeStart() { if (!isHovered && !isFocused) start(); }

    // Kickoff
    updateStates(); updateDots(); maybeStart();
  }

  document.addEventListener('DOMContentLoaded', () => {
    RA('.happy-reviews').forEach(init);
  });
})();


