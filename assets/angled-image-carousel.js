(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    if (!root) return;
    const viewport = root.querySelector('.angled-carousel__viewport');
    const cards = Array.from(root.querySelectorAll('.angled-carousel__card'));
    if (!viewport || cards.length === 0) return;

    const showDots = root.dataset.showDots === 'true';
    const showArrows = root.dataset.showArrows === 'true';
    const autoplayEnabled = root.dataset.autoplay === 'true' && !prefersReduced;
    const speed = parseInt(root.dataset.speed || '5000', 10);

    let activeIndex = 0;
    let rafId = null;
    let scrollTimeout = null;
    let timer = null;
    let isHovered = false;
    let isFocused = false;

    // Build dots
    const dotsWrap = root.querySelector('.angled-carousel__dots');
    if (dotsWrap && showDots) {
      dotsWrap.innerHTML = '';
      cards.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'angled-carousel__dot';
        dot.setAttribute('aria-label', `Go to item ${i + 1}`);
        dot.addEventListener('click', () => scrollToIndex(i));
        dotsWrap.appendChild(dot);
      });
    }

    // Arrows
    const prevBtn = root.querySelector('.angled-carousel__arrow--prev');
    const nextBtn = root.querySelector('.angled-carousel__arrow--next');
    if (prevBtn) prevBtn.addEventListener('click', () => scrollToIndex(activeIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollToIndex(activeIndex + 1));

    // Hover / focus pause
    root.addEventListener('mouseenter', () => { isHovered = true; stop(); });
    root.addEventListener('mouseleave', () => { isHovered = false; maybeStart(); });
    root.addEventListener('focusin', () => { isFocused = true; stop(); });
    root.addEventListener('focusout', () => { isFocused = false; maybeStart(); });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else maybeStart();
    });

    // Scroll handling
    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      updateActive();
      // Re-center on resized active for stability
      requestAnimationFrame(() => scrollToIndex(activeIndex, { smooth: false }));
    });

    function onScroll() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateActive);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => snapToClosest(), 100);
    }

    function centerOf(el) {
      const rect = el.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }

    function updateActive() {
      const viewportCenter = centerOf(viewport);
      let bestIdx = 0;
      let bestDist = Infinity;
      cards.forEach((card, i) => {
        const dist = Math.abs(centerOf(card) - viewportCenter);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      setActive(bestIdx);
    }

    function setActive(index) {
      activeIndex = ((index % cards.length) + cards.length) % cards.length;
      cards.forEach((c, i) => {
        c.classList.remove('is-active', 'is-prev', 'is-next', 'is-far-prev', 'is-far-next');
        const diff = i - activeIndex;
        if (diff === 0) c.classList.add('is-active');
        else if (diff === -1) c.classList.add('is-prev');
        else if (diff === 1) c.classList.add('is-next');
        else if (diff <= -2) c.classList.add('is-far-prev');
        else if (diff >= 2) c.classList.add('is-far-next');
      });
      updateDots();
    }

    function updateDots() {
      if (!dotsWrap || !showDots) return;
      const dots = Array.from(dotsWrap.querySelectorAll('.angled-carousel__dot'));
      dots.forEach((d, i) => {
        if (i === activeIndex) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }

    function snapToClosest() {
      scrollToIndex(activeIndex);
    }

    function scrollToIndex(index, opts = {}) {
      const total = cards.length;
      if (total === 0) return;
      const targetIndex = ((index % total) + total) % total;
      const target = cards[targetIndex];
      const left = target.offsetLeft + target.offsetWidth / 2 - viewport.clientWidth / 2;
      viewport.scrollTo({
        left,
        behavior: opts.smooth === false || prefersReduced ? 'auto' : 'smooth'
      });
      setActive(targetIndex);
    }

    function start() {
      if (!autoplayEnabled || timer || cards.length < 2) return;
      timer = setInterval(() => {
        scrollToIndex(activeIndex + 1);
      }, Math.max(2000, speed));
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function maybeStart() {
      if (!isHovered && !isFocused) start();
    }

    // Init
    setTimeout(() => {
      updateActive();
      maybeStart();
    }, 0);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.angled-carousel').forEach(init);
  });
})();


