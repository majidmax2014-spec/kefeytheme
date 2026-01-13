(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    const viewport = root.querySelector('.ccc__viewport');
    const track = root.querySelector('.ccc__track');
    let slides = Array.from(root.querySelectorAll('.ccc__slide'));
    if (!viewport || slides.length === 0) return;

    const showDots = root.dataset.showDots === 'true';
    const showArrows = root.dataset.showArrows === 'true';
    const infinite = root.dataset.infinite === 'true';
    const autoplayEnabled = root.dataset.autoplay === 'true' && !prefersReduced;
    const speed = parseInt(root.dataset.speed || '5000', 10);

    // Ensure minimum for loop UX
    if (infinite) {
      while (slides.length < 3) {
        const clone = slides[slides.length - 1].cloneNode(true);
        track.appendChild(clone);
        slides = Array.from(root.querySelectorAll('.ccc__slide'));
      }
    }

    let logicalCount = slides.length;
    let items = [];
    let clonesPerSide = infinite ? Math.min(3, logicalCount) : 0;
    let current = clonesPerSide;
    let isHovered = false, isFocused = false;
    let timer = null;
    let startX = 0, startScroll = 0, dragging = false, delta = 0, moved = false;

    // Dots
    const dotsWrap = root.querySelector('.ccc__dots');
    if (dotsWrap && showDots) {
      dotsWrap.innerHTML = '';
      for (let i = 0; i < logicalCount; i++) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ccc__dot';
        b.setAttribute('aria-label', `Go to slide ${i + 1}`);
        b.addEventListener('click', () => goLogical(i));
        dotsWrap.appendChild(b);
      }
    }

    // Arrows
    const prevBtn = root.querySelector('.ccc__arrow--prev');
    const nextBtn = root.querySelector('.ccc__arrow--next');
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
      viewport.classList.add('is-dragging');
      startX = e.clientX;
      startScroll = viewport.scrollLeft;
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      delta = e.clientX - startX;
      if (Math.abs(delta) > 4) moved = true;
      viewport.scrollLeft = startScroll - delta;
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('is-dragging');
      if (moved) {
        viewport.addEventListener('click', cancelOnce, true);
        setTimeout(() => viewport.removeEventListener('click', cancelOnce, true), 250);
      }
      snapToClosest();
      maybeStart();
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', endDrag);

    function cancelOnce(e) { e.preventDefault(); e.stopPropagation(); }

    // Rebuild structure for infinite loop
    rebuild();
    window.addEventListener('resize', rebuild);

    function rebuild() {
      if (!infinite) {
        items = Array.from(root.querySelectorAll('.ccc__slide'));
        setupSnap();
        updateStates();
        updateDots();
        maybeStart();
        return;
      }
      track.innerHTML = '';
      const originals = slides.map(s => s.cloneNode(true));
      const before = originals.slice(-clonesPerSide).map(n => (n.dataset.clone = 'true', n));
      const after = originals.slice(0, clonesPerSide).map(n => (n.dataset.clone = 'true', n));
      before.forEach(n => track.appendChild(n.cloneNode(true)));
      originals.forEach(n => track.appendChild(n.cloneNode(true)));
      after.forEach(n => track.appendChild(n.cloneNode(true)));
      items = Array.from(track.querySelectorAll('.ccc__slide'));
      // Convert to center via scrollLeft to the first logical item
      setTimeout(() => {
        centerPhysical(clonesPerSide);
        current = clonesPerSide;
        updateStates();
        updateDots();
        maybeStart();
      }, 0);
    }

    function setupSnap() {
      // Using native scroll to center by left calc
      setTimeout(() => {
        centerPhysical(0);
      }, 0);
    }

    function cardCenter(el) {
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    }
    function nearestPhysicalIndex() {
      const viewportCenter = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
      let best = 0, bestD = Infinity;
      items.forEach((el, i) => {
        const d = Math.abs(cardCenter(el) - viewportCenter);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }
    function activeLogical() {
      if (!infinite) return nearestPhysicalIndex();
      const idx = current;
      const logicalIndex = ((idx - clonesPerSide) % logicalCount + logicalCount) % logicalCount;
      return logicalIndex;
    }
    function centerPhysical(i, smooth = true) {
      const el = items[i];
      const left = el.offsetLeft + el.offsetWidth / 2 - viewport.clientWidth / 2;
      viewport.scrollTo({ left, behavior: smooth && !prefersReduced ? 'smooth' : 'auto' });
    }
    function normalize() {
      if (!infinite) return;
      const logicalStart = clonesPerSide;
      const logicalEnd = clonesPerSide + logicalCount - 1;
      if (current < logicalStart) {
        current += logicalCount;
        centerPhysical(current, false);
      } else if (current > logicalEnd) {
        current -= logicalCount;
        centerPhysical(current, false);
      }
    }
    function snapToClosest() {
      current = nearestPhysicalIndex();
      centerPhysical(current);
      updateStates();
      updateDots();
      normalize();
    }
    function goLogical(logIdx) {
      if (!infinite) {
        const target = Math.max(0, Math.min(items.length - 1, logIdx));
        current = target;
        centerPhysical(target);
        updateStates(); updateDots();
        return;
      }
      // choose nearest physical with same logical
      let best = current, bestD = Infinity;
      items.forEach((el, i) => {
        const li = ((i - clonesPerSide) % logicalCount + logicalCount) % logicalCount;
        if (li === ((logIdx % logicalCount) + logicalCount) % logicalCount) {
          const d = Math.abs(i - current);
          if (d < bestD) { bestD = d; best = i; }
        }
      });
      current = best;
      centerPhysical(current);
      updateStates(); updateDots();
      normalize();
    }
    function updateStates() {
      items.forEach(el => el.classList.remove('is-active', 'is-prev', 'is-next'));
      const idx = nearestPhysicalIndex();
      if (items[idx]) items[idx].classList.add('is-active');
      if (items[idx - 1]) items[idx - 1].classList.add('is-prev');
      if (items[idx + 1]) items[idx + 1].classList.add('is-next');
    }
    function updateDots() {
      if (!dotsWrap || !showDots) return;
      const a = activeLogical();
      Array.from(dotsWrap.querySelectorAll('.ccc__dot')).forEach((d, i) => {
        if (i === a) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }
    function start() {
      if (!autoplayEnabled || timer) return;
      timer = setInterval(() => { goLogical(activeLogical() + 1); }, Math.max(2000, speed));
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function maybeStart() { if (!isHovered && !isFocused) start(); }

    // initial state
    updateStates(); updateDots(); maybeStart();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.ccc').forEach(init);
  });
})();


