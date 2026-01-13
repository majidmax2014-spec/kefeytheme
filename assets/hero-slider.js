(() => {
  function initSlider(root) {
    if (!root) return;
    const viewport = root.querySelector('.hero-slider__viewport');
    const track = root.querySelector('.hero-slider__track');
    const slides = Array.from(root.querySelectorAll('.hero-slider__slide'));
    if (!track || slides.length === 0) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const autoplayEnabled = root.dataset.autoplay === 'true' && !prefersReduced;
    const showDots = root.dataset.showDots === 'true';
    const showArrows = root.dataset.showArrows === 'true';
    const speed = parseInt(root.dataset.speed || '5000', 10);

    let current = 0;
    let timer = null;
    let isHovered = false;
    let isFocused = false;

    // Build dots
    let dotsWrapper = root.querySelector('.hero-slider__dots');
    if (dotsWrapper && showDots) {
      dotsWrapper.innerHTML = '';
      slides.forEach((_, idx) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'hero-slider__dot';
        dot.setAttribute('aria-label', `Go to slide ${idx + 1}`);
        dot.addEventListener('click', () => goTo(idx));
        dotsWrapper.appendChild(dot);
      });
    }

    // Arrows
    const prevBtn = root.querySelector('.hero-slider__arrow--prev');
    const nextBtn = root.querySelector('.hero-slider__arrow--next');
    if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

    // Accessibility keyboard
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
    });

    // Hover/focus pause
    root.addEventListener('mouseenter', () => { isHovered = true; stop(); });
    root.addEventListener('mouseleave', () => { isHovered = false; maybeStart(); });
    root.addEventListener('focusin', () => { isFocused = true; stop(); });
    root.addEventListener('focusout', () => { isFocused = false; maybeStart(); });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else maybeStart();
    });

    function updateDots() {
      if (!dotsWrapper) return;
      const dots = Array.from(dotsWrapper.querySelectorAll('.hero-slider__dot'));
      dots.forEach((d, i) => {
        if (i === current) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }

    function goTo(index) {
      const total = slides.length;
      current = (index + total) % total;
      const x = -current * 100;
      track.style.transform = `translateX(${x}%)`;
      lazyLoadSlide(current);
      updateDots();
    }

    function start() {
      if (!autoplayEnabled || timer) return;
      timer = setInterval(() => {
        goTo(current + 1);
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

    function lazyLoadSlide(i) {
      const slide = slides[i];
      if (!slide) return;
      // Images already present use loading="lazy" for non-initial slides; nothing else needed.
      // If needed in future, hook up data-src swapping here.
    }

    // Initial
    goTo(0);
    maybeStart();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.hero-slider').forEach(initSlider);
  });
})();


