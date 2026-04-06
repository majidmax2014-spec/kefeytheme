/**
 * Kefey Testimonials Carousel
 * Handles carousel functionality with autoplay, arrows, and dots
 */
class KefeyTestimonialsCarousel {
  constructor(section) {
    this.section = section;
    this.viewport = section.querySelector('.kefey-testimonials-grid__viewport');
    this.track = section.querySelector('.kefey-testimonials-grid__track');
    this.slides = Array.from(section.querySelectorAll('.kefey-testimonials-grid__slide'));
    this.prevBtn = section.querySelector('.kefey-testimonials-grid__arrow--prev');
    this.nextBtn = section.querySelector('.kefey-testimonials-grid__arrow--next');
    this.dotsContainer = section.querySelector('.kefey-testimonials-grid__dots');
    
    this.currentIndex = 0;
    this.autoplay = section.dataset.autoplay === 'true';
    this.autoplaySpeed = parseInt(section.dataset.speed) || 5000;
    this.autoplayTimer = null;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartTranslate = 0;
    this._translatePx = 0;
    
    this.slidesPerView = this.getSlidesPerView();
    this.maxIndex = Math.max(0, this.slides.length - this.slidesPerView);
    
    this.init();
  }
  
  getSlidesPerView() {
    const width = window.innerWidth;
    if (width >= 1024) return 3;
    if (width >= 750) return 2;
    return 1;
  }
  
  init() {
    if (!this.track || this.slides.length === 0) return;
    
    this.updateSlidesPerView();
    this.createDots();
    this.attachEvents();
    this.updateCarousel();
    requestAnimationFrame(() => this.updateCarousel());

    if (this.autoplay) {
      this.startAutoplay();
    }
    
    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.updateSlidesPerView();
        this.createDots();
        this.updateCarousel();
      }, 250);
    });
  }
  
  updateSlidesPerView() {
    this.slidesPerView = this.getSlidesPerView();
    this.maxIndex = Math.max(0, this.slides.length - this.slidesPerView);
    if (this.currentIndex > this.maxIndex) {
      this.currentIndex = this.maxIndex;
    }
  }
  
  createDots() {
    if (!this.dotsContainer) return;
    
    this.dotsContainer.innerHTML = '';
    const totalPages = Math.ceil(this.slides.length / this.slidesPerView);
    
    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'kefey-testimonials-grid__dot';
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => this.goToPage(i));
      this.dotsContainer.appendChild(dot);
    }
  }
  
  attachEvents() {
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.prev());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.next());
    }
    
    // Keyboard navigation
    if (this.track) {
      this.track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.prev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.next();
        }
      });
    }
    
    // Touch/drag support
    if (this.viewport) {
      this.viewport.addEventListener('pointerdown', this.handlePointerDown.bind(this));
      this.viewport.addEventListener('pointermove', this.handlePointerMove.bind(this));
      this.viewport.addEventListener('pointerup', this.handlePointerUp.bind(this));
      this.viewport.addEventListener('pointercancel', this.handlePointerUp.bind(this));
    }
    
    // Pause autoplay on hover
    if (this.autoplay) {
      this.section.addEventListener('mouseenter', () => this.stopAutoplay());
      this.section.addEventListener('mouseleave', () => this.startAutoplay());
      this.section.addEventListener('focusin', () => this.stopAutoplay());
      this.section.addEventListener('focusout', () => this.startAutoplay());
    }
  }
  
  isMobilePeekLayout() {
    return window.innerWidth < 750 && this.slidesPerView === 1;
  }

  handlePointerDown(e) {
    if (!this.viewport || window.innerWidth >= 750) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartTranslate = this._translatePx;
    this.track.style.transition = 'none';
    this.viewport.style.cursor = 'grabbing';
    this.stopAutoplay();
    try {
      this.viewport.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  handlePointerMove(e) {
    if (!this.isDragging || !this.track || !this.slides[0] || !this.viewport) return;
    e.preventDefault();
    const firstSlide = this.slides[0];
    const gapStyle = getComputedStyle(this.track).gap || '0';
    const gap = parseFloat(gapStyle) || 0;
    const slideWidth = firstSlide.getBoundingClientRect().width;
    const step = slideWidth + gap;
    const vw = this.viewport.clientWidth;
    const n = this.slides.length;
    const delta = e.clientX - this.dragStartX;
    let newT = this.dragStartTranslate - delta;

    if (this.isMobilePeekLayout()) {
      const TMin = slideWidth / 2 - vw / 2;
      const TMax = (n - 1) * step + slideWidth / 2 - vw / 2;
      newT = Math.max(TMin, Math.min(newT, TMax));
    } else {
      const trackWidth = this.track.scrollWidth;
      const maxTranslate = Math.max(0, trackWidth - vw);
      newT = Math.max(0, Math.min(newT, maxTranslate));
    }

    this.track.style.transform = `translateX(-${newT}px)`;
  }

  handlePointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.viewport.style.cursor = 'grab';
    try {
      if (e.pointerId != null) this.viewport.releasePointerCapture(e.pointerId);
    } catch (_) {}

    const firstSlide = this.slides[0];
    if (!firstSlide || !this.viewport) return;

    const gapStyle = getComputedStyle(this.track).gap || '0';
    const gap = parseFloat(gapStyle) || 0;
    const slideWidth = firstSlide.getBoundingClientRect().width;
    const step = slideWidth + gap;
    const vw = this.viewport.clientWidth;
    const n = this.slides.length;

    const m = this.track.style.transform.match(/translateX\(-([\d.]+)px\)/);
    let currentT = m ? parseFloat(m[1]) : this._translatePx;

    const mobilePeek = this.isMobilePeekLayout();
    let bestIndex = 0;
    let bestDiff = Infinity;

    for (let i = 0; i < n; i++) {
      let ideal;
      if (mobilePeek) {
        ideal = i * step + slideWidth / 2 - vw / 2;
        const TMin = slideWidth / 2 - vw / 2;
        const TMax = (n - 1) * step + slideWidth / 2 - vw / 2;
        ideal = Math.max(TMin, Math.min(ideal, TMax));
      } else {
        ideal = i * step;
      }
      const d = Math.abs(currentT - ideal);
      if (d < bestDiff) {
        bestDiff = d;
        bestIndex = i;
      }
    }

    this.goTo(bestIndex);

    if (this.autoplay) {
      this.startAutoplay();
    }
  }
  
  prev() {
    if (this.currentIndex > 0) {
      this.goTo(this.currentIndex - 1);
    }
  }
  
  next() {
    if (this.currentIndex < this.maxIndex) {
      this.goTo(this.currentIndex + 1);
    }
  }
  
  goTo(index) {
    this.currentIndex = Math.max(0, Math.min(index, this.maxIndex));
    this.updateCarousel();
    this.resetAutoplay();
  }
  
  goToPage(pageIndex) {
    this.goTo(pageIndex * this.slidesPerView);
  }
  
  updateCarousel() {
    if (!this.track) return;

    const firstSlide = this.slides[0];
    if (!firstSlide || !this.viewport) return;

    const gapStyle = getComputedStyle(this.track).gap || getComputedStyle(this.track).columnGap || '0';
    const gap = parseFloat(gapStyle) || 0;
    const slideWidth = firstSlide.getBoundingClientRect().width;
    const step = slideWidth + gap;
    const viewportWidth = this.viewport.clientWidth;
    const trackWidth = this.track.scrollWidth;

    const mobilePeek = viewportWidth < 750 && this.slidesPerView === 1;

    let translatePx;
    if (mobilePeek) {
      const T = this.currentIndex * step + slideWidth / 2 - viewportWidth / 2;
      const TMax = (this.slides.length - 1) * step + slideWidth / 2 - viewportWidth / 2;
      const TMin = slideWidth / 2 - viewportWidth / 2;
      translatePx = Math.max(TMin, Math.min(T, TMax));
    } else {
      const maxTranslate = Math.max(0, trackWidth - viewportWidth);
      const target = this.currentIndex * step;
      translatePx = Math.max(0, Math.min(target, maxTranslate));
    }

    this._translatePx = translatePx;
    this.track.style.transition = '';
    this.track.style.transform = `translateX(-${translatePx}px)`;
    
    // Update arrows - disable at ends (non-looping)
    if (this.prevBtn) {
      this.prevBtn.disabled = this.currentIndex === 0;
      this.prevBtn.setAttribute('aria-disabled', this.currentIndex === 0 ? 'true' : 'false');
    }
    if (this.nextBtn) {
      this.nextBtn.disabled = this.currentIndex >= this.maxIndex;
      this.nextBtn.setAttribute('aria-disabled', this.currentIndex >= this.maxIndex ? 'true' : 'false');
    }
    
    // Update dots
    if (this.dotsContainer) {
      const dots = this.dotsContainer.querySelectorAll('.kefey-testimonials-grid__dot');
      const currentPage = Math.floor(this.currentIndex / this.slidesPerView);
      dots.forEach((dot, i) => {
        dot.setAttribute('aria-current', i === currentPage ? 'true' : 'false');
      });
    }
  }
  
  startAutoplay() {
    this.stopAutoplay();
    if (this.autoplay && this.slides.length > this.slidesPerView) {
      this.autoplayTimer = setInterval(() => {
        this.next();
      }, this.autoplaySpeed);
    }
  }
  
  stopAutoplay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }
  
  resetAutoplay() {
    this.stopAutoplay();
    if (this.autoplay) {
      this.startAutoplay();
    }
  }
}

// Initialize carousels when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.kefey-testimonials-grid');
  sections.forEach(section => {
    new KefeyTestimonialsCarousel(section);
  });
});

// Re-initialize on section load (for theme editor)
if (Shopify && Shopify.designMode) {
  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target.querySelector('.kefey-testimonials-grid');
    if (section) {
      new KefeyTestimonialsCarousel(section);
    }
  });
}
