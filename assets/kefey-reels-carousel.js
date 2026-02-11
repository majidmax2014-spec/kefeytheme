(function () {
  var instances = new WeakMap();

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function KefeyReelsCarousel(root) {
    this.root = root;
    this.viewport = root.querySelector(".kefey-reels-carousel__viewport");
    this.track = root.querySelector(".kefey-reels-carousel__track");
    this.dots = root.querySelector(".kefey-reels-carousel__dots");
    this.prev = root.querySelector(".kefey-reels-carousel__arrow--prev");
    this.next = root.querySelector(".kefey-reels-carousel__arrow--next");
    this.originalSlides = [];
    this.page = 0;
    this.totalPages = 1;
    this.loopWidth = 0;
    this.offset = 0;
    this.lastTick = 0;
    this.rafId = null;
    this.isDown = false;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.dragStartOffset = 0;
    this.pointerId = null;
    this.blockClick = false;
    this.clickBlockTimer = null;
    this.activeCard = null;
    this.isHovered = false;
    this.isFocused = false;
    this.resumeAt = 0;
    this.dotTween = null;

    this.autoplayEnabled = root.getAttribute("data-autoplay") === "true";
    this.autoplaySpeed = parseFloat(root.getAttribute("data-speed")) || 40;
    this.pauseOnHover = root.getAttribute("data-pause-hover") !== "false";

    if (!this.viewport || !this.track) return;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onTrackClick = this.onTrackClick.bind(this);
    this.onResize = this.debounce(this.onResize.bind(this), 120);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onFocusIn = this.onFocusIn.bind(this);
    this.onFocusOut = this.onFocusOut.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.tick = this.tick.bind(this);

    this.setup();
  }

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

  KefeyReelsCarousel.prototype.setup = function () {
    this.prepareLoop();
    this.buildPages();
    this.renderDots();
    this.setOffset(0);

    this.viewport.addEventListener("pointerdown", this.onPointerDown);
    this.viewport.addEventListener("pointermove", this.onPointerMove);
    this.viewport.addEventListener("pointerup", this.onPointerUp);
    this.viewport.addEventListener("pointercancel", this.onPointerUp);
    this.track.addEventListener("click", this.onTrackClick);
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

    if (this.pauseOnHover) {
      this.root.addEventListener("mouseenter", this.onMouseEnter);
      this.root.addEventListener("mouseleave", this.onMouseLeave);
    }
    this.root.addEventListener("focusin", this.onFocusIn);
    this.root.addEventListener("focusout", this.onFocusOut);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("resize", this.onResize);

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

    this.startLoop();
  };

  KefeyReelsCarousel.prototype.destroy = function () {
    if (!this.viewport || !this.track) return;
    this.viewport.removeEventListener("pointerdown", this.onPointerDown);
    this.viewport.removeEventListener("pointermove", this.onPointerMove);
    this.viewport.removeEventListener("pointerup", this.onPointerUp);
    this.viewport.removeEventListener("pointercancel", this.onPointerUp);
    this.track.removeEventListener("click", this.onTrackClick);
    if (this.pauseOnHover) {
      this.root.removeEventListener("mouseenter", this.onMouseEnter);
      this.root.removeEventListener("mouseleave", this.onMouseLeave);
    }
    this.root.removeEventListener("focusin", this.onFocusIn);
    this.root.removeEventListener("focusout", this.onFocusOut);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("resize", this.onResize);
    if (this.clickBlockTimer) window.clearTimeout(this.clickBlockTimer);
    this.stopActivePlayer();
    this.stopLoop();
    this.cleanupClones();
    this.track.style.transform = "";
  };

  KefeyReelsCarousel.prototype.cleanupClones = function () {
    var clones = this.track.querySelectorAll('[data-krc-clone="true"]');
    for (var i = 0; i < clones.length; i++) clones[i].remove();
  };

  KefeyReelsCarousel.prototype.prepareLoop = function () {
    this.cleanupClones();
    this.originalSlides = Array.prototype.slice.call(this.track.querySelectorAll(".kefey-reels-carousel__slide"));
    if (this.originalSlides.length === 0) return;

    for (var i = 0; i < this.originalSlides.length; i++) {
      var clone = this.originalSlides[i].cloneNode(true);
      clone.setAttribute("data-krc-clone", "true");
      clone.setAttribute("aria-hidden", "true");
      this.track.appendChild(clone);
    }
  };

  KefeyReelsCarousel.prototype.measureLoopWidth = function () {
    if (this.originalSlides.length === 0) {
      this.loopWidth = 0;
      return;
    }
    var firstClone = this.track.querySelector('.kefey-reels-carousel__slide[data-krc-clone="true"]');
    if (firstClone) {
      this.loopWidth = firstClone.offsetLeft;
    }
    if (!this.loopWidth) {
      this.loopWidth = this.track.scrollWidth / 2;
    }
  };

  KefeyReelsCarousel.prototype.buildPages = function () {
    this.measureLoopWidth();
    var viewportWidth = Math.max(1, this.viewport.clientWidth);
    this.totalPages = Math.max(1, Math.ceil(this.loopWidth / viewportWidth));
    this.page = this.getPageFromOffset(this.offset);
  };

  KefeyReelsCarousel.prototype.renderDots = function () {
    if (!this.dots) return;
    this.dots.innerHTML = "";
    if (this.totalPages <= 1) {
      this.dots.hidden = true;
      return;
    }
    this.dots.hidden = false;
    for (var i = 0; i < this.totalPages; i++) {
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

  KefeyReelsCarousel.prototype.normalizeOffset = function (value) {
    if (!this.loopWidth) return 0;
    var normalized = value % this.loopWidth;
    if (normalized < 0) normalized += this.loopWidth;
    return normalized;
  };

  KefeyReelsCarousel.prototype.getPageFromOffset = function (offset) {
    if (this.totalPages <= 1) return 0;
    var viewportWidth = Math.max(1, this.viewport.clientWidth);
    return Math.round(offset / viewportWidth) % this.totalPages;
  };

  KefeyReelsCarousel.prototype.setOffset = function (value) {
    this.offset = this.normalizeOffset(value);
    this.track.style.transform = "translate3d(" + -this.offset + "px, 0, 0)";
    this.page = this.getPageFromOffset(this.offset);
    this.updateUI();
  };

  KefeyReelsCarousel.prototype.updateUI = function () {
    var dots = this.dots ? this.dots.querySelectorAll(".kefey-reels-carousel__dot") : [];
    for (var i = 0; i < dots.length; i++) {
      dots[i].setAttribute("aria-current", i === this.page ? "true" : "false");
    }
    if (this.prev) this.prev.disabled = this.totalPages <= 1;
    if (this.next) this.next.disabled = this.totalPages <= 1;
  };

  KefeyReelsCarousel.prototype.goToPage = function (index) {
    if (this.totalPages <= 1) return;
    var targetIndex = ((index % this.totalPages) + this.totalPages) % this.totalPages;
    var target = targetIndex * this.viewport.clientWidth;
    var start = this.offset;
    var diff = target - start;

    if (this.loopWidth) {
      if (diff > this.loopWidth / 2) diff -= this.loopWidth;
      if (diff < -this.loopWidth / 2) diff += this.loopWidth;
    }

    this.dotTween = {
      start: start,
      diff: diff,
      startTime: performance.now(),
      duration: 420
    };
    this.resumeAt = performance.now() + 700;
  };

  KefeyReelsCarousel.prototype.shouldAutoplay = function () {
    if (!this.autoplayEnabled) return false;
    if (this.totalPages <= 1 || !this.loopWidth) return false;
    if (document.hidden) return false;
    if (this.pauseOnHover && this.isHovered) return false;
    if (this.isFocused || this.isDragging || this.isDown) return false;
    if (this.activeCard) return false;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (performance.now() < this.resumeAt) return false;
    return true;
  };

  KefeyReelsCarousel.prototype.startLoop = function () {
    if (this.rafId) return;
    this.lastTick = 0;
    this.rafId = window.requestAnimationFrame(this.tick);
  };

  KefeyReelsCarousel.prototype.stopLoop = function () {
    if (!this.rafId) return;
    window.cancelAnimationFrame(this.rafId);
    this.rafId = null;
  };

  KefeyReelsCarousel.prototype.tick = function (ts) {
    if (!this.lastTick) this.lastTick = ts;
    var dt = (ts - this.lastTick) / 1000;
    this.lastTick = ts;

    if (this.dotTween) {
      var progress = (ts - this.dotTween.startTime) / this.dotTween.duration;
      if (progress >= 1) {
        this.setOffset(this.dotTween.start + this.dotTween.diff);
        this.dotTween = null;
      } else {
        var eased = 1 - Math.pow(1 - progress, 3);
        this.setOffset(this.dotTween.start + this.dotTween.diff * eased);
      }
    } else if (this.shouldAutoplay()) {
      this.setOffset(this.offset + this.autoplaySpeed * dt);
    } else {
      this.updateUI();
    }

    this.rafId = window.requestAnimationFrame(this.tick);
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
      if (!youtubeId) youtubeId = this.extractYouTubeId(card.getAttribute("data-youtube-url") || "");
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
      this.stopCard(closeButton.closest(".kefey-reels-carousel__card"));
      return;
    }

    var playButton = event.target.closest(".kefey-reels-carousel__play");
    if (playButton) {
      event.preventDefault();
      event.stopPropagation();
      this.playCard(playButton.closest(".kefey-reels-carousel__card"));
    }
  };

  KefeyReelsCarousel.prototype.onPointerDown = function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (
      event.target &&
      event.target.closest(
        'button, a, input, textarea, select, label, [role="button"], .play-button, .krc-play, .kefey-reels-carousel__play'
      )
    ) {
      return;
    }

    this.isDown = true;
    this.isDragging = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.dragStartOffset = this.offset;
    this.pointerId = event.pointerId;
  };

  KefeyReelsCarousel.prototype.onPointerMove = function (event) {
    if (!this.isDown) return;
    var deltaX = event.clientX - this.startX;
    var dx = Math.abs(deltaX);
    var dy = Math.abs(event.clientY - this.startY);

    if (!this.isDragging) {
      if (dx > 8 && dx > dy) {
        this.isDragging = true;
        this.viewport.classList.add("is-dragging");
        if (this.viewport.setPointerCapture && this.pointerId != null) this.viewport.setPointerCapture(this.pointerId);
      } else {
        return;
      }
    }

    this.setOffset(this.dragStartOffset - deltaX);
    event.preventDefault();
  };

  KefeyReelsCarousel.prototype.onPointerUp = function () {
    if (!this.isDown) return;
    this.isDown = false;

    if (this.isDragging) {
      this.blockClick = true;
      if (this.clickBlockTimer) window.clearTimeout(this.clickBlockTimer);
      this.clickBlockTimer = window.setTimeout(
        function () {
          this.blockClick = false;
        }.bind(this),
        180
      );
      this.resumeAt = performance.now() + 300;
    }

    this.isDragging = false;
    this.viewport.classList.remove("is-dragging");
    this.pointerId = null;
  };

  KefeyReelsCarousel.prototype.onResize = function () {
    this.buildPages();
    this.renderDots();
    this.setOffset(this.offset);
  };

  KefeyReelsCarousel.prototype.onMouseEnter = function () {
    this.isHovered = true;
  };

  KefeyReelsCarousel.prototype.onMouseLeave = function () {
    this.isHovered = false;
  };

  KefeyReelsCarousel.prototype.onFocusIn = function () {
    this.isFocused = true;
  };

  KefeyReelsCarousel.prototype.onFocusOut = function () {
    var active = document.activeElement;
    this.isFocused = !!(active && this.root.contains(active));
  };

  KefeyReelsCarousel.prototype.onVisibilityChange = function () {};

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
    if (container === document) container = document.documentElement;
    if (!(container instanceof Element)) return;

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

