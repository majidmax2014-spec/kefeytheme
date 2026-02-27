(function () {
  function initIngredientsCarousels(scope) {
    var carousels = (scope || document).querySelectorAll('[data-kefey-ingredients]');
    carousels.forEach(function (carousel) {
      var track = carousel.querySelector('[data-kefey-ingredients-track]');
      if (!track) return;
      var prev = carousel.querySelector('[data-kefey-prev]');
      var next = carousel.querySelector('[data-kefey-next]');
      var step = function () {
        var firstCard = track.querySelector(':scope > *');
        if (!firstCard) return Math.max(220, Math.floor(track.clientWidth * 0.9));
        var gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || '0');
        return Math.floor(firstCard.getBoundingClientRect().width + gap);
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

  function formatMoney(cents, moneyFormat) {
    var value = (Number(cents || 0) / 100).toFixed(2);
    if (!moneyFormat) return '$' + value;
    if (moneyFormat.indexOf('{{amount}}') !== -1) return moneyFormat.replace('{{amount}}', value);
    if (moneyFormat.indexOf('{{ amount }}') !== -1) return moneyFormat.replace('{{ amount }}', value);
    return '$' + value;
  }

  function getPackFromVariant(variant) {
    var source = [];
    if (variant && variant.title) source.push(String(variant.title));
    if (variant && Array.isArray(variant.options)) source = source.concat(variant.options.map(String));
    var haystack = source.join(' ').toLowerCase();

    if (/5\s*[- ]?\s*pack|pack\s*5|\b5\b/.test(haystack)) return 5;
    if (/3\s*[- ]?\s*pack|pack\s*3|\b3\b/.test(haystack)) return 3;
    if (/1\s*[- ]?\s*pack|pack\s*1|\b1\b/.test(haystack)) return 1;
    return null;
  }

  function firstSellingPlanId(variant) {
    if (!variant || !Array.isArray(variant.selling_plan_allocations) || !variant.selling_plan_allocations.length) {
      return null;
    }
    var allocation = variant.selling_plan_allocations[0];
    if (!allocation || !allocation.selling_plan_id) return null;
    return allocation.selling_plan_id;
  }

  function initPurchaseModule(scope) {
    var modules = (scope || document).querySelectorAll('[data-kefey-purchase]');
    modules.forEach(function (module) {
      var jsonEl = module.querySelector('[data-kefey-product-json]');
      if (!jsonEl) return;

      var product;
      try {
        product = JSON.parse(jsonEl.textContent);
      } catch (err) {
        return;
      }
      if (!product || !Array.isArray(product.variants) || !product.variants.length) return;

      var variants = product.variants;
      var map = {};
      variants.forEach(function (variant) {
        var pack = getPackFromVariant(variant);
        if (pack && !map[pack]) map[pack] = variant;
      });

      var fallbackVariant = variants[0];
      if (!map[1] && !map[3] && !map[5]) {
        map[1] = fallbackVariant;
        map[3] = fallbackVariant;
        map[5] = fallbackVariant;
      } else {
        if (!map[1]) map[1] = map[3] || map[5] || fallbackVariant;
        if (!map[3]) map[3] = map[1] || map[5] || fallbackVariant;
        if (!map[5]) map[5] = map[3] || map[1] || fallbackVariant;
      }

      var defaultPack = parseInt(module.getAttribute('data-default-pack') || '1', 10);
      if (![1, 3, 5].includes(defaultPack)) defaultPack = 1;
      var defaultType = module.getAttribute('data-default-purchase-type') === 'one' ? 'one' : 'sub';
      var displayDiscount = parseInt(module.getAttribute('data-discount-percent') || '10', 10);
      if (isNaN(displayDiscount)) displayDiscount = 10;
      var moneyFormat = module.getAttribute('data-money-format') || '${{amount}}';
      var displayCompareFallback = module.getAttribute('data-display-compare') || '';

      var state = {
        pack: defaultPack,
        type: defaultType
      };

      var subPlan = module.querySelector('[data-plan="sub"]');
      var onePlan = module.querySelector('[data-plan="one"]');
      var packButtons = module.querySelectorAll('.kefey-purchase__pack');
      var variantInput = module.querySelector('[data-selected-variant-id]');
      var subEachEl = module.querySelector('[data-sub-each]');
      var subTotalEl = module.querySelector('[data-sub-total]');
      var subCompareEl = module.querySelector('[data-sub-compare]');
      var oneEachEl = module.querySelector('[data-one-each]');
      var cta = module.querySelector('[data-kefey-checkout]');

      function render() {
        var variant = map[state.pack] || fallbackVariant;
        if (!variant) return;

        var basePrice = Number(variant.price || 0);
        var baseCompare = Number(variant.compare_at_price || 0);
        var packQty = state.pack;
        var sellingPlanId = firstSellingPlanId(variant);
        var hasSubscriptionPlan = Boolean(sellingPlanId);

        var subEach = basePrice;
        var subCompareEach = baseCompare > 0 ? baseCompare : basePrice;

        if (hasSubscriptionPlan) {
          var allocation = variant.selling_plan_allocations[0];
          if (allocation && allocation.price) subEach = Number(allocation.price);
          if (allocation && allocation.compare_at_price) subCompareEach = Number(allocation.compare_at_price);
        } else if (displayDiscount > 0) {
          subEach = Math.max(0, Math.round(basePrice * (100 - displayDiscount) / 100));
        }

        var subTotal = subEach * packQty;
        var subCompareTotal = (subCompareEach > 0 ? subCompareEach : basePrice) * packQty;
        var oneEach = basePrice;

        if (variantInput) variantInput.value = String(variant.id);
        if (subEachEl) subEachEl.textContent = formatMoney(subEach, moneyFormat);
        if (subTotalEl) subTotalEl.textContent = formatMoney(subTotal, moneyFormat);
        if (oneEachEl) oneEachEl.textContent = formatMoney(oneEach, moneyFormat);

        if (subCompareEl) {
          if (subCompareTotal > subTotal) {
            subCompareEl.textContent = formatMoney(subCompareTotal, moneyFormat);
            subCompareEl.style.display = '';
          } else if (displayCompareFallback) {
            subCompareEl.textContent = displayCompareFallback;
            subCompareEl.style.display = '';
          } else {
            subCompareEl.style.display = 'none';
          }
        }

        packButtons.forEach(function (btn) {
          var btnPack = parseInt(btn.getAttribute('data-pack') || '1', 10);
          btn.classList.toggle('is-selected', btnPack === state.pack);
          btn.setAttribute('aria-pressed', btnPack === state.pack ? 'true' : 'false');
        });

        if (subPlan) subPlan.classList.toggle('is-selected', state.type === 'sub');
        if (onePlan) onePlan.classList.toggle('is-selected', state.type === 'one');
        if (cta) cta.disabled = !variant.available;
      }

      if (subPlan) {
        subPlan.addEventListener('click', function () {
          state.type = 'sub';
          render();
        });
      }
      if (onePlan) {
        onePlan.addEventListener('click', function () {
          state.type = 'one';
          render();
        });
      }
      packButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var next = parseInt(btn.getAttribute('data-pack') || '1', 10);
          if (![1, 3, 5].includes(next)) return;
          state.pack = next;
          render();
        });
      });

      if (cta) {
        cta.addEventListener('click', function () {
          var variant = map[state.pack] || fallbackVariant;
          if (!variant || !variant.id) return;

          var payload = { id: Number(variant.id), quantity: 1 };
          var sellingPlanId = firstSellingPlanId(variant);
          if (state.type === 'sub' && sellingPlanId) payload.selling_plan = Number(sellingPlanId);

          cta.disabled = true;
          fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload)
          })
            .then(function (res) {
              if (!res.ok) throw new Error('Failed to add item');
              return res.json();
            })
            .then(function () {
              window.location.href = '/cart';
            })
            .catch(function () {
              cta.disabled = false;
            });
        });
      }

      render();
    });
  }

  function init(scope) {
    initIngredientsCarousels(scope);
    initFaqAria(scope);
    initPurchaseModule(scope);
  }

  document.addEventListener('DOMContentLoaded', function () { init(document); });
  document.addEventListener('shopify:section:load', function (evt) { init(evt.target); });
})();
