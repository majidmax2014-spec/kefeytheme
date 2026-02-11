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
    this.startY = 0;
    this.startScroll = 0;
    this.isDragging = false;
    this.blockClick = false;
    this.clickBlockTimer = null;
    this.activeCard = null;
    this.autoplayEnabled = root.getAttribute("data-autoplay") === "true";
    this.autoplaySpeed = parseInt(root.getAttribute("data-speed"), 10) || 4000;
    this.autoplayTimer = null;
    this.isHovered = false;
    this.isFocused = false;

    if (!this.viewport || !this.track || this.slides.length === 0) return;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.debounce(this.onResize.bind(this), 120);
    this.onTrackClick = this.onTrackClick.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onFocusIn = this.onFocusIn.bind(this);
    this.onFocusOut = this.onFocusOut.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);

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
    this.track.addEventListener("click", this.onTrackClick);
    this.root.addEventListener("mouseenter", this.onMouseEnter);
    this.root.addEventListener("mouseleave", this.onMouseLeave);
    this.root.addEventListener("focusin", this.onFocusIn);
    this.root.addEventListener("focusout", this.onFocusOut);
    document.addEventListener("visibilitychange", this.onVisibilityChange);

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
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.destroy = function () {
    if (!this.viewport) return;
    this.viewport.removeEventListener("pointerdown", this.onPointerDown);
    this.viewport.removeEventListener("pointermove", this.onPointerMove);
    this.viewport.removeEventListener("pointerup", this.onPointerUp);
    this.viewport.removeEventListener("pointercancel", this.onPointerUp);
    this.viewport.removeEventListener("scroll", this.onScroll);
    this.track.removeEventListener("click", this.onTrackClick);
    this.root.removeEventListener("mouseenter", this.onMouseEnter);
    this.root.removeEventListener("mouseleave", this.onMouseLeave);
    this.root.removeEventListener("focusin", this.onFocusIn);
    this.root.removeEventListener("focusout", this.onFocusOut);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("resize", this.onResize);
    if (this.clickBlockTimer) window.clearTimeout(this.clickBlockTimer);
    this.clearAutoplay();
    this.stopActivePlayer();
  };

  KefeyReelsCarousel.prototype.extractYouTubeId = function (value) {
    if (!value) return "";
    if (typeof value === "object") {
      if (value.id) return String(value.id);
      if (value.url) value = value.url;
    }
    var url = String(value).trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
    var match = url.match(/[?&]v=([^&#]+)/);
    if (match && match[1]) return match[1];
    match = url.match(/youtu\.be\/([^?&#/]+)/);
    if (match && match[1]) return match[1];
    match = url.match(/youtube\.com\/embed\/([^?&#/]+)/);
    if (match && match[1]) return match[1];
    match = url.match(/youtube\.com\/shorts\/([^?&#/]+)/);
    if (match && match[1]) return match[1];
    return "";
  };

  KefeyReelsCarousel.prototype.clearAutoplay = function () {
    if (this.autoplayTimer) {
      window.clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  };

  KefeyReelsCarousel.prototype.shouldAutoplay = function () {
    if (!this.autoplayEnabled) return false;
    if (this.pages <= 1) return false;
    if (this.isHovered || this.isFocused) return false;
    if (this.isDown || this.activeCard) return false;
    if (document.hidden) return false;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  };

  KefeyReelsCarousel.prototype.updateAutoplay = function () {
    if (!this.shouldAutoplay()) {
      this.clearAutoplay();
      return;
    }
    if (this.autoplayTimer) return;

    this.autoplayTimer = window.setInterval(
      function () {
        if (!this.shouldAutoplay()) return;
        this.goToPage((this.page + 1) % this.pages);
      }.bind(this),
      this.autoplaySpeed
    );
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

  KefeyReelsCarousel.prototype.getCardNodes = function (card) {
    return {
      player: card.querySelector(".kefey-reels-carousel__player"),
      close: card.querySelector(".kefey-reels-carousel__close")
    };
  };

  KefeyReelsCarousel.prototype.stopCard = function (card) {
    if (!card) return;
    var nodes = this.getCardNodes(card);
    if (!nodes.player) return;

    var video = nodes.player.querySelector("video");
    if (video && !video.paused) video.pause();

    nodes.player.innerHTML = "";
    nodes.player.hidden = true;
    if (nodes.close) nodes.close.hidden = true;
    card.classList.remove("is-playing");
    if (this.activeCard === card) this.activeCard = null;
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.stopActivePlayer = function () {
    if (this.activeCard) this.stopCard(this.activeCard);
  };

  KefeyReelsCarousel.prototype.playCard = function (card) {
    if (!card) return;
    var sourceType = card.getAttribute("data-source-type") || "none";
    if (sourceType === "none") return;

    var nodes = this.getCardNodes(card);
    if (!nodes.player) return;

    this.stopActivePlayer();
    nodes.player.innerHTML = "";

    if (sourceType === "shopify") {
      var template = card.querySelector(".kefey-reels-carousel__shopify-video-template");
      if (template && template.innerHTML.trim() !== "") {
        nodes.player.innerHTML = template.innerHTML;
        var shopifyVideo = nodes.player.querySelector("video");
        if (shopifyVideo) {
          shopifyVideo.setAttribute("playsinline", "");
          shopifyVideo.setAttribute("autoplay", "");
          shopifyVideo.controls = true;
          var playPromise = shopifyVideo.play();
          if (playPromise && typeof playPromise.catch === "function") playPromise.catch(function () {});
        }
      }
    } else if (sourceType === "youtube") {
      var youtubeId = card.getAttribute("data-youtube-id") || "";
      if (!youtubeId) {
        var youtubeUrl = card.getAttribute("data-youtube-url") || "";
        youtubeId = this.extractYouTubeId(youtubeUrl);
      }
      if (youtubeId) {
        nodes.player.innerHTML =
          '<iframe src="https://www.youtube-nocookie.com/embed/' +
          youtubeId +
          '?autoplay=1&mute=0&playsinline=1&rel=0" title="YouTube video player" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      }
    } else if (sourceType === "embed") {
      var embedSource = card.querySelector(".kefey-reels-carousel__embed-source");
      if (embedSource && embedSource.innerHTML.trim() !== "") {
        nodes.player.innerHTML = embedSource.innerHTML;
        if (window.instgrm && window.instgrm.Embeds && typeof window.instgrm.Embeds.process === "function") {
          window.instgrm.Embeds.process();
        }
      }
    }

    if (nodes.player.innerHTML.trim() === "") return;

    nodes.player.hidden = false;
    if (nodes.close) nodes.close.hidden = false;
    card.classList.add("is-playing");
    this.activeCard = card;
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.onTrackClick = function (event) {
    if (this.blockClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    var closeButton = event.target.closest(".kefey-reels-carousel__close");
    if (closeButton) {
      event.preventDefault();
      var closeCard = closeButton.closest(".kefey-reels-carousel__card");
      this.stopCard(closeCard);
      return;
    }

    var playButton = event.target.closest(".kefey-reels-carousel__play");
    if (playButton) {
      event.preventDefault();
      var card = playButton.closest(".kefey-reels-carousel__card");
      this.playCard(card);
    }
  };

  KefeyReelsCarousel.prototype.onPointerDown = function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (
      event.target &&
      event.target.closest(
        'button, a, input, textarea, select, label, [role="button"], .krc-play, .kefey-reels-carousel__play'
      )
    ) {
      return;
    }
    this.isDown = true;
    this.isDragging = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startScroll = this.viewport.scrollLeft;
    this.viewport.classList.add("is-dragging");
    if (this.viewport.setPointerCapture) this.viewport.setPointerCapture(event.pointerId);
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.onPointerMove = function (event) {
    if (!this.isDown) return;
    var deltaX = event.clientX - this.startX;
    var dx = Math.abs(deltaX);
    var dy = Math.abs(event.clientY - this.startY);

    if (!this.isDragging) {
      if (dx > 8 && dx > dy) {
        this.isDragging = true;
      } else {
        return;
      }
    }

    this.viewport.scrollLeft = this.startScroll - deltaX;
    event.preventDefault();
  };

  KefeyReelsCarousel.prototype.onPointerUp = function () {
    if (!this.isDown) return;
    this.isDown = false;
    this.viewport.classList.remove("is-dragging");
    this.page = this.getNearestPageFromScroll();
    this.updateUI();
    this.snapToNearest();

    if (this.isDragging) {
      this.blockClick = true;
      if (this.clickBlockTimer) window.clearTimeout(this.clickBlockTimer);
      this.clickBlockTimer = window.setTimeout(
        function () {
          this.blockClick = false;
        }.bind(this),
        180
      );
    }
    this.isDragging = false;
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.onScroll = function () {
    this.page = this.getNearestPageFromScroll();
    this.updateUI();
  };

  KefeyReelsCarousel.prototype.onResize = function () {
    this.buildPages();
    this.renderDots();
    this.goToPage(this.page);
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.onMouseEnter = function () {
    this.isHovered = true;
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.onMouseLeave = function () {
    this.isHovered = false;
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.onFocusIn = function () {
    this.isFocused = true;
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.onFocusOut = function () {
    var active = document.activeElement;
    this.isFocused = !!(active && this.root.contains(active));
    this.updateAutoplay();
  };

  KefeyReelsCarousel.prototype.onVisibilityChange = function () {
    this.updateAutoplay();
  };

  function initWithin(container) {
    if (!container) return;
    if (container === document) container = document.documentElement;
    if (!(container instanceof Element)) return;
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

