(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    if (!root) return;
    const viewport = root.querySelector('.angled-carousel__viewport');
    const track = root.querySelector('.angled-carousel__track');
    let originals = Array.from(track.querySelectorAll('.angled-carousel__card'));
    if (!viewport || originals.length === 0) return;

    const showDots = root.dataset.showDots === 'true';
    const showArrows = root.dataset.showArrows === 'true';
    const autoplayEnabled = root.dataset.autoplay === 'true' && !prefersReduced;
    const speed = parseInt(root.dataset.speed || '5000', 10);

    // If fewer than 3, duplicate to reach 3
    while (originals.length < 3) {
      const clone = originals[originals.length - 1].cloneNode(true);
      track.appendChild(clone);
      originals = Array.from(track.querySelectorAll('.angled-carousel__card'));
    }

    originals.forEach((el, i) => el.dataset.logicalIndex = String(i));
    let items = [];
    let logicalCount = originals.length;
    let clonesCount = 0;
    let currentPhysicalIndex = 0;
    let activeLogicalIndex = 0;
    let timer = null;
    let isHovered = false;
    let isFocused = false;
    let dragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let dragDelta = 0;
    let rafId = null;
    let scrollEndTimer = null;

    // Dots for logical items
    const dotsWrap = root.querySelector('.angled-carousel__dots');
    if (dotsWrap && showDots) {
      dotsWrap.innerHTML = '';
      for (let i = 0; i < logicalCount; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'angled-carousel__dot';
        dot.setAttribute('aria-label', `Go to item ${i + 1}`);
        dot.addEventListener('click', () => scrollToLogical(i));
        dotsWrap.appendChild(dot);
      }
    }

    // Arrows
    const prevBtn = root.querySelector('.angled-carousel__arrow--prev');
    const nextBtn = root.querySelector('.angled-carousel__arrow--next');
    if (prevBtn) prevBtn.addEventListener('click', () => scrollToLogical(activeLogicalIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollToLogical(activeLogicalIndex + 1));

    // Dragging with Pointer Events
    viewport.addEventListener('pointerdown', (e) => {
      dragging = true;
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture(e.pointerId);
      dragStartX = e.clientX;
      dragStartScroll = viewport.scrollLeft;
      dragDelta = 0;
      stop();
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      dragDelta = dx;
      viewport.scrollLeft = dragStartScroll - dx;
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('is-dragging');
      if (Math.abs(dragDelta) > 8) {
        // Prevent click on links shortly after drag
        disableClicksTemporarily(viewport, 300);
      }
      snapToClosest();
      maybeStart();
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', endDrag);

    // Hover/focus pause
    root.addEventListener('mouseenter', () => { isHovered = true; stop(); });
    root.addEventListener('mouseleave', () => { isHovered = false; maybeStart(); });
    root.addEventListener('focusin', () => { isFocused = true; stop(); });
    root.addEventListener('focusout', () => { isFocused = false; maybeStart(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else maybeStart(); });

    // Scroll events
    viewport.addEventListener('scroll', () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(onScrollRaf);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        normalizeIfNeeded();
        snapToClosest();
      }, 120);
    }, { passive: true });

    // Responsive cloning
    const mql = window.matchMedia('(min-width: 990px)');
    mql.addEventListener('change', rebuild);
    window.addEventListener('resize', () => {
      // Maintain current logical position on resize
      rebuild();
    });

    function rebuild() {
      const isDesktop = mql.matches;
      clonesCount = Math.min(isDesktop ? 5 : 3, logicalCount);
      // Clear current children and rebuild
      track.innerHTML = '';
      // Build before clones
      const before = originals.slice(-clonesCount).map((el) => {
        const c = el.cloneNode(true);
        c.dataset.clone = 'true';
        c.dataset.logicalIndex = el.dataset.logicalIndex;
        return c;
      });
      // Build after clones
      const after = originals.slice(0, clonesCount).map((el) => {
        const c = el.cloneNode(true);
        c.dataset.clone = 'true';
        c.dataset.logicalIndex = el.dataset.logicalIndex;
        return c;
      });
      // Append all
      before.forEach((n) => track.appendChild(n));
      originals.forEach((n) => track.appendChild(n));
      after.forEach((n) => track.appendChild(n));
      items = Array.from(track.querySelectorAll('.angled-carousel__card'));
      // Start centered at first logical (index 0) -> physical index = clonesCount
      currentPhysicalIndex = clonesCount;
      scrollToPhysical(currentPhysicalIndex, { smooth: false });
      updateActiveFromPhysical(currentPhysicalIndex);
      updateDots();
      maybeStart();
    }

    function onScrollRaf() {
      const idx = nearestPhysicalIndex();
      if (idx !== currentPhysicalIndex) {
        currentPhysicalIndex = idx;
        updateActiveFromPhysical(idx);
        updateDots();
      }
      updateEdgeClasses();
    }

    function nearestPhysicalIndex() {
      const viewportCenter = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      items.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const d = Math.abs(center - viewportCenter);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }

    function updateActiveFromPhysical(physIdx) {
      const logical = Number(items[physIdx].dataset.logicalIndex);
      activeLogicalIndex = logical;
      items.forEach((c) =>
        c.classList.remove('is-active', 'is-prev', 'is-next', 'is-far-prev', 'is-far-next', 'is-edge-left', 'is-edge-right')
      );
      // Apply relative classes using physical positions
      [0,1,2].forEach((offset) => {
        const left = items[physIdx - offset];
        const right = items[physIdx + offset];
        if (offset === 0) {
          if (items[physIdx]) items[physIdx].classList.add('is-active');
        } else if (offset === 1) {
          if (left) left.classList.add('is-prev');
          if (right) right.classList.add('is-next');
        } else if (offset === 2) {
          if (left) left.classList.add('is-far-prev');
          if (right) right.classList.add('is-far-next');
        }
      });
      updateEdgeClasses();
    }

    function updateDots() {
      if (!dotsWrap || !showDots) return;
      const dots = Array.from(dotsWrap.querySelectorAll('.angled-carousel__dot'));
      dots.forEach((d, i) => {
        if (i === activeLogicalIndex) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }

    function normalizeIfNeeded() {
      // If near the cloned edges, jump to the corresponding real item
      const total = items.length;
      const logicalStart = clonesCount;
      const logicalEnd = clonesCount + logicalCount - 1;
      if (currentPhysicalIndex < logicalStart) {
        // Jump forward by logicalCount
        currentPhysicalIndex = currentPhysicalIndex + logicalCount;
        scrollToPhysical(currentPhysicalIndex, { smooth: false });
      } else if (currentPhysicalIndex > logicalEnd) {
        currentPhysicalIndex = currentPhysicalIndex - logicalCount;
        scrollToPhysical(currentPhysicalIndex, { smooth: false });
      }
    }

    function targetLeftForIndex(physIdx) {
      const el = items[physIdx];
      return el.offsetLeft + el.offsetWidth / 2 - viewport.clientWidth / 2;
    }

    function scrollToPhysical(physIdx, opts = {}) {
      const left = targetLeftForIndex(physIdx);
      viewport.scrollTo({ left, behavior: opts.smooth === false || prefersReduced ? 'auto' : 'smooth' });
    }

    function getNearestPhysicalForLogical(logIdx) {
      // Choose the physical item with matching logical index closest to current physical index
      let best = null;
      let bestDist = Infinity;
      items.forEach((el, i) => {
        if (Number(el.dataset.logicalIndex) === ((logIdx % logicalCount) + logicalCount) % logicalCount) {
          const d = Math.abs(i - currentPhysicalIndex);
          if (d < bestDist) { bestDist = d; best = i; }
        }
      });
      return best != null ? best : clonesCount + logIdx;
    }

    function scrollToLogical(logIdx, opts = {}) {
      const phys = getNearestPhysicalForLogical(logIdx);
      currentPhysicalIndex = phys;
      scrollToPhysical(phys, opts);
      activeLogicalIndex = ((logIdx % logicalCount) + logicalCount) % logicalCount;
      updateDots();
    }

    function snapToClosest() {
      const idx = nearestPhysicalIndex();
      currentPhysicalIndex = idx;
      normalizeIfNeeded();
      scrollToPhysical(currentPhysicalIndex);
      updateEdgeClasses();
    }

    function updateEdgeClasses() {
      const viewportRect = viewport.getBoundingClientRect();
      let firstVisible = null;
      let lastVisible = null;

      items.forEach((el) => {
        el.classList.remove('is-edge-left', 'is-edge-right');
        const rect = el.getBoundingClientRect();
        const overlap = Math.min(rect.right, viewportRect.right) - Math.max(rect.left, viewportRect.left);
        if (overlap > 0) {
          if (!firstVisible) firstVisible = el;
          lastVisible = el;
        }
      });

      if (firstVisible) firstVisible.classList.add('is-edge-left');
      if (lastVisible && lastVisible !== firstVisible) lastVisible.classList.add('is-edge-right');
    }

    function start() {
      if (!autoplayEnabled || timer || logicalCount < 2) return;
      timer = setInterval(() => {
        scrollToLogical(activeLogicalIndex + 1);
      }, Math.max(2000, speed));
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function maybeStart() { if (!isHovered && !isFocused) start(); }

    // prevent accidental clicks after drag
    function disableClicksTemporarily(container, ms) {
      const handler = (e) => { e.preventDefault(); e.stopPropagation(); };
      container.addEventListener('click', handler, true);
      setTimeout(() => container.removeEventListener('click', handler, true), ms);
    }

    // Initialize
    rebuild();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.angled-carousel').forEach(init);
  });
})();


