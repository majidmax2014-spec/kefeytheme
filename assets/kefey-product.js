(function () {
  function initIngredientsCarousels(scope) {
    var carousels = (scope || document).querySelectorAll('[data-kefey-ingredients]');
    carousels.forEach(function (carousel) {
      var track = carousel.querySelector('[data-kefey-ingredients-track]');
      if (!track) return;
      var prev = carousel.querySelector('[data-kefey-prev]');
      var next = carousel.querySelector('[data-kefey-next]');
      var step = function () {
        return Math.max(220, Math.floor(track.clientWidth * 0.9));
      };

      if (prev) {
        prev.addEventListener('click', function () {
          track.scrollBy({ left: -step(), behavior: 'smooth' });
        });
      }
      if (next) {
        next.addEventListener('click', function () {
          track.scrollBy({ left: step(), behavior: 'smooth' });
        });
      }
    });
  }

  function initFaqAria(scope) {
    var items = (scope || document).querySelectorAll('.kefey-product-faq__item');
    items.forEach(function (item) {
      var summary = item.querySelector('.kefey-product-faq__summary');
      if (!summary) return;
      summary.setAttribute('aria-expanded', item.hasAttribute('open') ? 'true' : 'false');
      item.addEventListener('toggle', function () {
        summary.setAttribute('aria-expanded', item.hasAttribute('open') ? 'true' : 'false');
      });
    });
  }

  function initQty(scope) {
    var wrappers = (scope || document).querySelectorAll('.kefey-product-main__qty');
    wrappers.forEach(function (wrapper) {
      var input = wrapper.querySelector('input[type="number"]');
      if (!input) return;
      var down = wrapper.querySelector('[data-kefey-qty="down"]');
      var up = wrapper.querySelector('[data-kefey-qty="up"]');

      if (down) {
        down.addEventListener('click', function () {
          var val = parseInt(input.value || '1', 10);
          input.value = Math.max(1, val - 1);
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
      if (up) {
        up.addEventListener('click', function () {
          var val = parseInt(input.value || '1', 10);
          input.value = Math.max(1, val + 1);
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    });
  }

  function initPlanToggle(scope) {
    var wraps = (scope || document).querySelectorAll('[data-kefey-plan-toggle]');
    wraps.forEach(function (wrap) {
      var buttons = wrap.querySelectorAll('.kefey-product-main__plan-btn');
      var compare = wrap.querySelector('[data-kefey-compare]');
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          buttons.forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          if (compare) {
            compare.textContent = btn.getAttribute('data-save') || compare.textContent;
          }
        });
      });
    });
  }

  function init(scope) {
    initIngredientsCarousels(scope);
    initFaqAria(scope);
    initQty(scope);
    initPlanToggle(scope);
  }

  document.addEventListener('DOMContentLoaded', function () { init(document); });
  document.addEventListener('shopify:section:load', function (evt) { init(evt.target); });
})();
