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
    this.startX = 0;
    this.scrollLeft = 0;
    
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
  
  handlePointerDown(e) {
    this.isDragging = true;
    this.startX = e.pageX - this.viewport.offsetLeft;
    this.scrollLeft = this.viewport.scrollLeft;
    this.viewport.style.cursor = 'grabbing';
    this.stopAutoplay();
  }
  
  handlePointerMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    const x = e.pageX - this.viewport.offsetLeft;
    const walk = (x - this.startX) * 2;
    this.viewport.scrollLeft = this.scrollLeft - walk;
  }
  
  handlePointerUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.viewport.style.cursor = 'grab';
    
    // Snap to nearest slide
    const slideWidth = this.slides[0].offsetWidth + 24; // 24px gap
    const scrollPos = this.viewport.scrollLeft;
    const newIndex = Math.round(scrollPos / slideWidth);
    this.goTo(newIndex);
    
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
