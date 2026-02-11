(function () {
  var instances = new WeakMap();

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function KefeyReelsCarousel(root) {
    this.root = root;
    this.viewport = root.querySelector(".kefey-reels-carousel__viewport");
    this.track = root.querySelector(".kefey-reels-carousel__track");
    this.slides = Array.prototype.slice.call(root.querySelectorAll(".kefey-reels-carousel__slide"));
    this.dots = root.querySelector(".kefey-reels-carousel__dots");
    this.prev = root.querySelector(".kefey-reels-carousel__arrow--prev");
    this.next = root.querySelector(".kefey-reels-carousel__arrow--next");
    this.page = 0;
    this.pages = 1;
    this.snapPoints = [0];
    this.isDown = false;
    this.startX = 0;
    this.startScroll = 0;
    this.didDrag = false;
    this.blockClick = false;
    this.clickBlockTimer = null;

    if (!this.viewport || !this.track || this.slides.length === 0) return;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.debounce(this.onResize.bind(this), 120);

    this.setup();
  }

  KefeyReelsCarousel.prototype.setup = function () {
    this.buildPages();
    this.renderDots();
    this.updateUI();

    this.viewport.addEventListener("pointerdown", this.onPointerDown);
    this.viewport.addEventListener("pointermove", this.onPointerMove);
    this.viewport.addEventListener("pointerup", this.onPointerUp);
    this.viewport.addEventListener("pointercancel", this.onPointerUp);
    this.viewport.addEventListener("scroll", this.onScroll, { passive: true });

    this.track.addEventListener(
      "click",
      function (event) {
        if (this.blockClick) {
          event.preventDefault();
          event.stopPropagation();
        }
      }.bind(this),
      true
    );

    if (this.prev) {
      this.prev.addEventListener(
        "click",
        function () {
          this.goToPage(this.page - 1);
        }.bind(this)
      );
    }

    if (this.next) {
      this.next.addEventListener(
        "click",
        function () {
          this.goToPage(this.page + 1);
        }.bind(this)
      );
    }

    window.addEventListener("resize", this.onResize);
  };

  KefeyReelsCarousel.prototype.destroy = function () {
    if (!this.viewport) return;
    this.viewport.removeEventListener("pointerdown", this.onPointerDown);
    this.viewport.removeEventListener("pointermove", this.onPointerMove);
    this.viewport.removeEventListener("pointerup", this.onPointerUp);
    this.viewport.removeEventListener("pointercancel", this.onPointerUp);
    this.viewport.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onResize);
    if (this.clickBlockTimer) window.clearTimeout(this.clickBlockTimer);
  };

  KefeyReelsCarousel.prototype.debounce = function (fn, delay) {
    var timer = null;
    return function () {
      var args = arguments;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(null, args);
      }, delay);
    };
  };

  KefeyReelsCarousel.prototype.getMetrics = function () {
    var firstSlide = this.slides[0];
    if (!firstSlide) return null;
    var styles = window.getComputedStyle(this.track);
    var gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
    var slideWidth = firstSlide.getBoundingClientRect().width;
    var perView = Math.max(1, Math.floor((this.viewport.clientWidth + gap) / (slideWidth + gap)));
    return { gap: gap, slideWidth: slideWidth, perView: perView };
  };

  KefeyReelsCarousel.prototype.buildPages = function () {
    var metrics = this.getMetrics();
    if (!metrics) return;

    var perView = metrics.perView;
    var total = this.slides.length;
    var maxStart = Math.max(0, total - perView);
    var starts = [];
    var i;

    for (i = 0; i <= maxStart; i += perView) {
      starts.push(i);
    }
    if (starts[starts.length - 1] !== maxStart) {
      starts.push(maxStart);
    }

    this.snapPoints = starts.map(
      function (slideIndex) {
        return this.slides[slideIndex].offsetLeft;
      }.bind(this)
    );
    this.pages = Math.max(1, this.snapPoints.length);
    this.page = clamp(this.page, 0, this.pages - 1);
  };

  KefeyReelsCarousel.prototype.renderDots = function () {
    if (!this.dots) return;
    this.dots.innerHTML = "";

    if (this.pages <= 1) {
      this.dots.hidden = true;
      return;
    }

    this.dots.hidden = false;
    for (var i = 0; i < this.pages; i++) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "kefey-reels-carousel__dot";
      dot.setAttribute("aria-label", "Go to slide " + (i + 1));
      dot.setAttribute("aria-current", i === this.page ? "true" : "false");
      dot.addEventListener(
        "click",
        function (index) {
          this.goToPage(index);
        }.bind(this, i)
      );
      this.dots.appendChild(dot);
    }
  };

  KefeyReelsCarousel.prototype.getNearestPageFromScroll = function () {
    var left = this.viewport.scrollLeft;
    var nearest = 0;
    var smallest = Infinity;

    for (var i = 0; i < this.snapPoints.length; i++) {
      var dist = Math.abs(left - this.snapPoints[i]);
      if (dist < smallest) {
        smallest = dist;
        nearest = i;
      }
    }
    return nearest;
  };

  KefeyReelsCarousel.prototype.goToPage = function (index) {
    this.page = clamp(index, 0, this.pages - 1);
    var target = this.snapPoints[this.page] || 0;
    this.viewport.scrollTo({ left: target, behavior: "smooth" });
    this.updateUI();
  };

  KefeyReelsCarousel.prototype.snapToNearest = function () {
    this.goToPage(this.getNearestPageFromScroll());
  };

  KefeyReelsCarousel.prototype.updateUI = function () {
    var dots = this.dots ? this.dots.querySelectorAll(".kefey-reels-carousel__dot") : [];
    for (var i = 0; i < dots.length; i++) {
      dots[i].setAttribute("aria-current", i === this.page ? "true" : "false");
    }
    if (this.prev) this.prev.disabled = this.page <= 0;
    if (this.next) this.next.disabled = this.page >= this.pages - 1;
  };

  KefeyReelsCarousel.prototype.onPointerDown = function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    this.isDown = true;
    this.didDrag = false;
    this.startX = event.clientX;
    this.startScroll = this.viewport.scrollLeft;
    this.viewport.classList.add("is-dragging");
    if (this.viewport.setPointerCapture) this.viewport.setPointerCapture(event.pointerId);
  };

  KefeyReelsCarousel.prototype.onPointerMove = function (event) {
    if (!this.isDown) return;
    var dx = event.clientX - this.startX;
    if (Math.abs(dx) > 6) this.didDrag = true;
    this.viewport.scrollLeft = this.startScroll - dx;
    event.preventDefault();
  };

  KefeyReelsCarousel.prototype.onPointerUp = function () {
    if (!this.isDown) return;
    this.isDown = false;
    this.viewport.classList.remove("is-dragging");
    this.page = this.getNearestPageFromScroll();
    this.updateUI();
    this.snapToNearest();

    if (this.didDrag) {
      this.blockClick = true;
      if (this.clickBlockTimer) window.clearTimeout(this.clickBlockTimer);
      this.clickBlockTimer = window.setTimeout(
        function () {
          this.blockClick = false;
        }.bind(this),
        180
      );
    }
  };

  KefeyReelsCarousel.prototype.onScroll = function () {
    this.page = this.getNearestPageFromScroll();
    this.updateUI();
  };

  KefeyReelsCarousel.prototype.onResize = function () {
    this.buildPages();
    this.renderDots();
    this.goToPage(this.page);
  };

  function initWithin(container) {
    if (!container) return;
    var sections = container.matches(".kefey-reels-carousel")
      ? [container]
      : container.querySelectorAll(".kefey-reels-carousel");

    for (var i = 0; i < sections.length; i++) {
      var root = sections[i];
      var existing = instances.get(root);
      if (existing) existing.destroy();
      instances.set(root, new KefeyReelsCarousel(root));
    }
  }

  function destroyWithin(container) {
    if (!container) return;
    var sections = container.matches(".kefey-reels-carousel")
      ? [container]
      : container.querySelectorAll(".kefey-reels-carousel");

    for (var i = 0; i < sections.length; i++) {
      var root = sections[i];
      var instance = instances.get(root);
      if (instance) {
        instance.destroy();
        instances.delete(root);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initWithin(document);
  });

  document.addEventListener("shopify:section:load", function (event) {
    initWithin(event.target);
  });

  document.addEventListener("shopify:section:select", function (event) {
    initWithin(event.target);
  });

  document.addEventListener("shopify:section:unload", function (event) {
    destroyWithin(event.target);
  });
})();

