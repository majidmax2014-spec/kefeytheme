(function () {
  function initIngredientsCarousels(scope) {
    var carousels = (scope || document).querySelectorAll('[data-kefey-ingredients]');
    carousels.forEach(function (carousel) {
      var track = carousel.querySelector('[data-kefey-ingredients-track]');
      if (!track) return;
      var prev = carousel.querySelector('[data-kefey-prev]');
      var next = carousel.querySelector('[data-kefey-next]');
      var dotsRoot = carousel.parentElement ? carousel.parentElement.querySelector('[data-kefey-ingredients-dots]') : null;
      var dots = dotsRoot ? dotsRoot.querySelectorAll('[data-kefey-dot]') : [];

      function slideStep() {
        var gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || '0');
        if (isNaN(gap)) gap = 0;
        var port = track.clientWidth;
        if (port > 0) return Math.max(1, Math.floor(port + gap));
        var firstCard = track.querySelector(':scope > *');
        var cardW = firstCard ? firstCard.getBoundingClientRect().width : 0;
        if (cardW <= 0) return Math.max(220, 280);
        return Math.floor(cardW + gap);
      }

      function slideCount() {
        return track.children.length;
      }

      function currentSlide() {
        var st = slideStep();
        if (st <= 0) return 0;
        var idx = Math.round(track.scrollLeft / st);
        var max = Math.max(0, slideCount() - 1);
        return Math.max(0, Math.min(max, idx));
      }

      function goToSlide(index) {
        var st = slideStep();
        if (st <= 0) return;
        var max = Math.max(0, slideCount() - 1);
        index = Math.max(0, Math.min(max, index));
        track.scrollTo({ left: index * st, behavior: 'smooth' });
      }

      function updateDots() {
        if (!dots.length) return;
        var st = slideStep();
        if (st <= 0) return;
        var idx = currentSlide();
        dots.forEach(function (dot, i) {
          var on = i === idx;
          dot.classList.toggle('is-active', on);
          dot.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      }

      var scrollRaf = 0;
      function onTrackScroll() {
        if (scrollRaf) cancelAnimationFrame(scrollRaf);
        scrollRaf = requestAnimationFrame(function () {
          scrollRaf = 0;
          updateDots();
        });
      }

      track.addEventListener('scroll', onTrackScroll, { passive: true });

      if (prev) {
        prev.addEventListener('click', function () {
          goToSlide(currentSlide() - 1);
        });
      }
      if (next) {
        next.addEventListener('click', function () {
          goToSlide(currentSlide() + 1);
        });
      }

      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          var i = parseInt(dot.getAttribute('data-kefey-dot') || '0', 10);
          if (isNaN(i)) i = 0;
          goToSlide(i);
        });
      });

      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function () {
          updateDots();
        });
        ro.observe(track);
      }

      requestAnimationFrame(updateDots);
    });
  }

  function initCertCarousels(scope) {
    var carousels = (scope || document).querySelectorAll('[data-kefey-certs]');
    carousels.forEach(function (carousel) {
      var track = carousel.querySelector('[data-kefey-certs-track]');
      if (!track) return;

      var prev = carousel.querySelector('[data-kefey-certs-prev]');
      var next = carousel.querySelector('[data-kefey-certs-next]');
      var step = function () {
        return Math.max(240, Math.floor(track.clientWidth * 0.9));
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

  function initFinalCtaSlider(scope) {
    var sliders = (scope || document).querySelectorAll('[data-kefey-beforeafter]');
    sliders.forEach(function (slider) {
      var track = slider.querySelector('[data-kefey-ba-track]');
      var handle = slider.querySelector('[data-kefey-ba-handle]');
      if (!track || !handle) return;

      var defaultPos = parseFloat(slider.getAttribute('data-default-position') || '50');
      var value = isNaN(defaultPos) ? 50 : defaultPos;
      var dragging = false;

      function clamp(num, min, max) {
        return Math.min(max, Math.max(min, num));
      }

      function setValue(next) {
        value = clamp(next, 0, 100);
        slider.style.setProperty('--pos', value + '%');
        handle.setAttribute('aria-valuenow', String(Math.round(value)));
      }

      function pointToValue(clientX) {
        var rect = track.getBoundingClientRect();
        if (rect.width <= 0) return value;
        return ((clientX - rect.left) / rect.width) * 100;
      }

      function onPointerMove(clientX) {
        setValue(pointToValue(clientX));
      }

      function onMouseMove(evt) {
        if (!dragging) return;
        onPointerMove(evt.clientX);
      }

      function onTouchMove(evt) {
        if (!dragging || !evt.touches || !evt.touches.length) return;
        evt.preventDefault();
        onPointerMove(evt.touches[0].clientX);
      }

      function endDrag() {
        dragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', endDrag);
      }

      function startDrag(evt) {
        evt.preventDefault();
        dragging = true;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', endDrag);
      }

      slider.addEventListener('click', function (evt) {
        if (dragging) return;
        if (evt.target === handle || handle.contains(evt.target)) return;
        onPointerMove(evt.clientX);
      });

      handle.addEventListener('mousedown', startDrag);
      handle.addEventListener('touchstart', function (evt) {
        if (!evt.touches || !evt.touches.length) return;
        startDrag(evt);
      }, { passive: false });

      handle.addEventListener('keydown', function (evt) {
        if (evt.key === 'ArrowLeft') {
          evt.preventDefault();
          setValue(value - 2);
        } else if (evt.key === 'ArrowRight') {
          evt.preventDefault();
          setValue(value + 2);
        }
      });

      setValue(value);
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

  var KEFEY_PACK_SIZES = [1, 2, 3, 4, 5, 6];

  function getPackFromVariant(variant) {
    var source = [];
    if (variant && variant.title) source.push(String(variant.title));
    if (variant && Array.isArray(variant.options)) source = source.concat(variant.options.map(String));
    var haystack = source.join(' ').toLowerCase();

    for (var i = KEFEY_PACK_SIZES.length - 1; i >= 0; i -= 1) {
      var pack = KEFEY_PACK_SIZES[i];
      var pattern = new RegExp('\\b' + pack + '\\s*[- ]?\\s*pack|pack\\s*' + pack + '\\b|\\b' + pack + '\\b');
      if (pattern.test(haystack)) return pack;
    }
    return null;
  }

  /**
   * Shopify /cart/add.js expects a numeric selling plan id (Recharge uses Shopify selling plans).
   */
  function normalizeSellingPlanId(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && !isNaN(raw)) return raw;
    var s = String(raw).trim();
    var gid = /SellingPlan\/(\d+)/.exec(s);
    if (gid) return Number(gid[1]);
    var n = parseInt(s, 10);
    return isNaN(n) ? null : n;
  }

  function sellingPlanMapFromModule(module) {
    var map = {};
    KEFEY_PACK_SIZES.forEach(function (pack) {
      map[pack] = {
        planId: normalizeSellingPlanId(module.getAttribute('data-plan-pack-' + pack)),
        groupId: normalizeSellingPlanId(module.getAttribute('data-plan-group-pack-' + pack))
      };
    });
    return map;
  }

  function discountMapFromModule(module, displayDiscount) {
    var map = {};
    KEFEY_PACK_SIZES.forEach(function (pack) {
      var raw = parseInt(module.getAttribute('data-discount-pack-' + pack) || '', 10);
      map[pack] = isNaN(raw) ? displayDiscount : raw;
    });
    return map;
  }

  function buildVariantMapByPack(variants, fallbackVariant) {
    var map = {};
    variants.forEach(function (variant) {
      var pack = getPackFromVariant(variant);
      if (pack && !map[pack]) map[pack] = variant;
    });

    var hasMappedPack = KEFEY_PACK_SIZES.some(function (pack) {
      return Boolean(map[pack]);
    });

    if (!hasMappedPack) {
      KEFEY_PACK_SIZES.forEach(function (pack) {
        map[pack] = fallbackVariant;
      });
      return map;
    }

    KEFEY_PACK_SIZES.forEach(function (pack) {
      if (map[pack]) return;
      var nearest = KEFEY_PACK_SIZES.map(function (candidate) {
        return map[candidate];
      }).find(Boolean);
      map[pack] = nearest || fallbackVariant;
    });

    return map;
  }

  function usesSingleVariantForAllPacks(map) {
    var firstVariant = map[1];
    if (!firstVariant) return false;
    return KEFEY_PACK_SIZES.every(function (pack) {
      return map[pack] && map[pack].id === firstVariant.id;
    });
  }

  function updatePackImage(module, pack) {
    var packImageEl = module.querySelector('[data-kefey-pack-image]');
    if (!packImageEl) return;

    var nextSrc =
      module.getAttribute('data-pack-image-' + pack) ||
      module.getAttribute('data-pack-image-1') ||
      packImageEl.getAttribute('data-fallback-src');

    if (nextSrc && packImageEl.getAttribute('src') !== nextSrc) {
      packImageEl.setAttribute('src', nextSrc);
    }
  }

  function normalizePlanGroupId(allocation) {
    if (!allocation) return null;
    var rawGroupId =
      allocation.selling_plan_group_id != null
        ? allocation.selling_plan_group_id
        : allocation.selling_plan && allocation.selling_plan.selling_plan_group_id != null
          ? allocation.selling_plan.selling_plan_group_id
          : allocation.selling_plan && allocation.selling_plan.group_id != null
            ? allocation.selling_plan.group_id
            : null;
    return normalizeSellingPlanId(rawGroupId);
  }

  function matchAllocationByTarget(variant, target) {
    if (!variant || !Array.isArray(variant.selling_plan_allocations) || !variant.selling_plan_allocations.length) {
      return null;
    }
    var preferredPlanId = target && target.planId != null ? target.planId : null;
    var preferredGroupId = target && target.groupId != null ? target.groupId : null;
    if (preferredPlanId == null && preferredGroupId == null) return null;
    var allocations = variant.selling_plan_allocations;
    return allocations.find(function (allocation) {
      if (!allocation) return false;
      var rawId =
        allocation.selling_plan_id != null
          ? allocation.selling_plan_id
          : allocation.selling_plan && allocation.selling_plan.id != null
            ? allocation.selling_plan.id
            : null;
      var allocationPlanId = normalizeSellingPlanId(rawId);
      var allocationGroupId = normalizePlanGroupId(allocation);
      if (preferredPlanId != null && allocationPlanId === preferredPlanId) return true;
      if (preferredGroupId != null && allocationGroupId === preferredGroupId) return true;
      return false;
    }) || null;
  }

  function variantHasTarget(variant, target) {
    return Boolean(matchAllocationByTarget(variant, target));
  }

  function firstRecurringAllocation(variant) {
    if (!variant || !Array.isArray(variant.selling_plan_allocations)) return null;
    return (
      variant.selling_plan_allocations.find(function (a) {
        if (!a || !a.selling_plan) return false;
        if (a.selling_plan.recurring_deliveries === true) return true;
        var cat = String(a.selling_plan.category || '').toUpperCase();
        return cat === 'SUBSCRIPTION' || cat === 'SUBSCRIPTIONS';
      }) || variant.selling_plan_allocations[0] || null
    );
  }

  /**
   * Prefer a subscription (recurring) allocation so Recharge/Shopify Checkout gets the right plan
   * when multiple allocations exist (e.g. preorder vs subscribe).
   */
  function sellingPlanIdForCart(variant, target) {
    if (!variant || !Array.isArray(variant.selling_plan_allocations) || !variant.selling_plan_allocations.length) {
      return null;
    }
    var preferredPlanId = target && target.planId != null ? target.planId : null;
    if (preferredPlanId != null || (target && target.groupId != null)) {
      var preferredAllocation = matchAllocationByTarget(variant, target);
      if (!preferredAllocation) return null;
      return normalizeSellingPlanId(
        preferredAllocation.selling_plan_id != null
          ? preferredAllocation.selling_plan_id
          : preferredAllocation.selling_plan && preferredAllocation.selling_plan.id != null
            ? preferredAllocation.selling_plan.id
            : null
      );
    }
    var allocations = variant.selling_plan_allocations;
    function isSubscriptionAllocation(a) {
      if (!a) return false;
      var sp = a.selling_plan;
      if (!sp || typeof sp !== 'object') return false;
      if (sp.recurring_deliveries === true) return true;
      var cat = String(sp.category || '').toUpperCase();
      if (cat === 'SUBSCRIPTION' || cat === 'SUBSCRIPTIONS') return true;
      return false;
    }
    var chosen = allocations.find(isSubscriptionAllocation);
    if (!chosen) chosen = allocations[0];
    var rawId =
      chosen.selling_plan_id != null
        ? chosen.selling_plan_id
        : chosen.selling_plan && chosen.selling_plan.id != null
          ? chosen.selling_plan.id
          : null;
    return normalizeSellingPlanId(rawId);
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
      var fallbackVariant = variants[0];
      var map = buildVariantMapByPack(variants, fallbackVariant);

      var defaultPack = parseInt(module.getAttribute('data-default-pack') || '1', 10);
      if (!KEFEY_PACK_SIZES.includes(defaultPack)) defaultPack = 1;
      var defaultType = module.getAttribute('data-default-purchase-type') === 'one' ? 'one' : 'sub';
      var displayDiscount = parseInt(module.getAttribute('data-discount-percent') || '10', 10);
      if (isNaN(displayDiscount)) displayDiscount = 10;
      var discountByPack = discountMapFromModule(module, displayDiscount);
      var moneyFormat = module.getAttribute('data-money-format') || '${{amount}}';
      var displayCompareFallback = module.getAttribute('data-display-compare') || '';
      var rawBadgeText = module.getAttribute('data-badge-text') || 'OFF & Cancel Anytime';
      var badgeSuffix = rawBadgeText.replace(/^\s*\d+\s*%?\s*/i, '').trim() || 'OFF & Cancel Anytime';
      var sellingPlanByPack = sellingPlanMapFromModule(module);

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
      var subBadgeEl = module.querySelector('[data-sub-badge]');
      var oneEachEl = module.querySelector('[data-one-each]');
      var cta = module.querySelector('[data-kefey-checkout]');

      function resolveVariantForPack(pack) {
        var preferredTarget = sellingPlanByPack[pack] || null;
        var candidate = map[pack] || fallbackVariant;
        if (!preferredTarget || (preferredTarget.planId == null && preferredTarget.groupId == null)) return candidate;
        if (candidate && variantHasTarget(candidate, preferredTarget)) return candidate;
        var byPlan = variants.find(function (v) {
          return variantHasTarget(v, preferredTarget);
        });
        return byPlan || candidate;
      }

      function render() {
        var variant = resolveVariantForPack(state.pack);
        if (!variant) return;

        var basePrice = Number(variant.price || 0);
        var baseCompare = Number(variant.compare_at_price || 0);
        var packQty = state.pack;
        var preferredTarget = sellingPlanByPack[state.pack] || null;
        var packDiscount = discountByPack[state.pack];
        if (typeof packDiscount !== 'number' || isNaN(packDiscount)) packDiscount = displayDiscount;
        var sellingPlanId = sellingPlanIdForCart(variant, preferredTarget);
        if (state.pack === 1 && sellingPlanId == null && preferredTarget && preferredTarget.planId != null) {
          sellingPlanId = preferredTarget.planId;
        }
        if (sellingPlanId == null && (!preferredTarget || (preferredTarget.planId == null && preferredTarget.groupId == null))) {
          sellingPlanId = sellingPlanIdForCart(variant, null);
        }

        var subEach = basePrice;
        var subCompareEach = baseCompare > 0 ? baseCompare : basePrice;

        var allocation = null;
        if (sellingPlanId != null) {
          allocation = matchAllocationByTarget(variant, preferredTarget);
          if (!allocation && (!preferredTarget || (preferredTarget.planId == null && preferredTarget.groupId == null))) {
            allocation = variant.selling_plan_allocations[0] || null;
          }
          if (allocation) {
            var allocRawId =
              allocation.selling_plan_id != null
                ? allocation.selling_plan_id
                : allocation.selling_plan && allocation.selling_plan.id != null
                  ? allocation.selling_plan.id
                  : null;
            var allocId = normalizeSellingPlanId(allocRawId);
            if (allocId != null) sellingPlanId = allocId;
          }
          if (allocation && allocation.price) subEach = Number(allocation.price);
          if (allocation && allocation.compare_at_price) subCompareEach = Number(allocation.compare_at_price);
        }
        var hasSubscriptionPlan = preferredTarget && (preferredTarget.planId != null || preferredTarget.groupId != null)
          ? Boolean(allocation)
          : Boolean(sellingPlanId);
        if (!allocation) {
          subEach = Math.max(0, Math.round(basePrice * (100 - packDiscount) / 100));
        }

        var subTotal = subEach * packQty;
        var subCompareTotal = 0;
        if (packDiscount > 0) {
          var compareEachForDisplay =
            subCompareEach > subEach
              ? subCompareEach
              : baseCompare > subEach
                ? baseCompare
                : basePrice;
          subCompareTotal = compareEachForDisplay * packQty;
        }
        var oneEach = basePrice;

        if (variantInput) variantInput.value = String(variant.id);
        if (subEachEl) subEachEl.textContent = formatMoney(subEach, moneyFormat);
        if (subTotalEl) subTotalEl.textContent = formatMoney(subTotal, moneyFormat);
        if (oneEachEl) oneEachEl.textContent = formatMoney(oneEach, moneyFormat);

        if (subCompareEl) {
          if (packDiscount > 0 && subCompareTotal > subTotal) {
            subCompareEl.textContent = formatMoney(subCompareTotal, moneyFormat);
            subCompareEl.style.display = '';
          } else if (packDiscount > 0 && displayCompareFallback) {
            subCompareEl.textContent = displayCompareFallback;
            subCompareEl.style.display = '';
          } else {
            subCompareEl.style.display = 'none';
          }
        }

        if (subBadgeEl) {
          if (packDiscount > 0) {
            subBadgeEl.textContent = String(packDiscount) + '% ' + badgeSuffix;
            subBadgeEl.style.display = '';
          } else {
            subBadgeEl.style.display = 'none';
          }
        }

        packButtons.forEach(function (btn) {
          var btnPack = parseInt(btn.getAttribute('data-pack') || '1', 10);
          btn.classList.toggle('is-selected', btnPack === state.pack);
          btn.setAttribute('aria-pressed', btnPack === state.pack ? 'true' : 'false');
        });

        if (subPlan) subPlan.classList.toggle('is-selected', state.type === 'sub');
        if (onePlan) onePlan.classList.toggle('is-selected', state.type === 'one');
        if (subPlan) {
          var planCfg = sellingPlanByPack[state.pack] || null;
          var planConfigured = Boolean(planCfg && (planCfg.planId != null || planCfg.groupId != null));
          subPlan.classList.toggle('is-disabled', state.type === 'sub' && planConfigured && !hasSubscriptionPlan);
          subPlan.setAttribute(
            'title',
            state.type === 'sub' && planConfigured && !hasSubscriptionPlan
              ? 'Subscription plan for this pack is not available. Check selling plan ID mapping.'
              : ''
          );
        }
        if (cta) cta.disabled = !variant.available;
        updatePackImage(module, state.pack);
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
          if (!KEFEY_PACK_SIZES.includes(next)) return;
          state.pack = next;
          render();
        });
      });

      if (cta) {
        cta.addEventListener('click', function () {
          var variant = resolveVariantForPack(state.pack);
          if (!variant || !variant.id) return;

          var singleVariantPacks = usesSingleVariantForAllPacks(map);
          var qty = singleVariantPacks ? state.pack : 1;

          var payload = { id: Number(variant.id), quantity: qty };
          var preferredTarget = sellingPlanByPack[state.pack] || null;
          var packDiscount = discountByPack[state.pack];
          if (typeof packDiscount !== 'number' || isNaN(packDiscount)) packDiscount = displayDiscount;
          var sellingPlanId = sellingPlanIdForCart(variant, preferredTarget);
          if (state.pack === 1 && sellingPlanId == null && preferredTarget && preferredTarget.planId != null) {
            sellingPlanId = preferredTarget.planId;
          }
          var chosenAllocation = matchAllocationByTarget(variant, preferredTarget);
          if (!chosenAllocation && (!preferredTarget || (preferredTarget.planId == null && preferredTarget.groupId == null)) && variant.selling_plan_allocations && variant.selling_plan_allocations.length) {
            chosenAllocation = variant.selling_plan_allocations[0];
            var chosenRawId =
              chosenAllocation.selling_plan_id != null
                ? chosenAllocation.selling_plan_id
                : chosenAllocation.selling_plan && chosenAllocation.selling_plan.id != null
                  ? chosenAllocation.selling_plan.id
                  : null;
            var chosenId = normalizeSellingPlanId(chosenRawId);
            if (chosenId != null) sellingPlanId = chosenId;
          }
          if (
            state.type === 'sub' &&
            state.pack !== 1 &&
            preferredTarget &&
            (preferredTarget.planId != null || preferredTarget.groupId != null) &&
            !chosenAllocation
          ) {
            console.error('[Kefey Purchase] Missing configured subscription target on selected variant for pack', state.pack, preferredTarget);
            cta.disabled = false;
            return;
          }

          // Pack 1 special case: always prefer a valid monthly subscription add,
          // even if configured plan id/group id doesn't match this exact variant.
          if (state.type === 'sub' && state.pack === 1 && !chosenAllocation) {
            var recurringOnCurrent = firstRecurringAllocation(variant);
            if (recurringOnCurrent) {
              var recurringRawId =
                recurringOnCurrent.selling_plan_id != null
                  ? recurringOnCurrent.selling_plan_id
                  : recurringOnCurrent.selling_plan && recurringOnCurrent.selling_plan.id != null
                    ? recurringOnCurrent.selling_plan.id
                    : null;
              var recurringId = normalizeSellingPlanId(recurringRawId);
              if (recurringId != null) {
                sellingPlanId = recurringId;
                chosenAllocation = recurringOnCurrent;
              }
            }
            if (!chosenAllocation) {
              var subscriptionVariant = variants.find(function (v) {
                return Boolean(firstRecurringAllocation(v));
              });
              if (subscriptionVariant) {
                var recurringOnAlt = firstRecurringAllocation(subscriptionVariant);
                var recurringAltRawId =
                  recurringOnAlt && recurringOnAlt.selling_plan_id != null
                    ? recurringOnAlt.selling_plan_id
                    : recurringOnAlt && recurringOnAlt.selling_plan && recurringOnAlt.selling_plan.id != null
                      ? recurringOnAlt.selling_plan.id
                      : null;
                var recurringAltId = normalizeSellingPlanId(recurringAltRawId);
                if (recurringAltId != null) {
                  payload.id = Number(subscriptionVariant.id);
                  sellingPlanId = recurringAltId;
                  chosenAllocation = recurringOnAlt;
                }
              }
            }
          }
          if (state.type === 'sub' && sellingPlanId != null) {
            payload.selling_plan = sellingPlanId;
          }

          cta.disabled = true;
          fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload)
          })
            .then(function (res) {
              if (!res.ok) {
                return res
                  .json()
                  .catch(function () {
                    return {};
                  })
                  .then(function (errBody) {
                    var msg =
                      (errBody && (errBody.description || errBody.message)) ||
                      'Failed to add item';
                    throw new Error(msg);
                  });
              }
              return res.json();
            })
            .then(function () {
              window.location.href = '/cart';
            })
            .catch(function (err) {
              console.error('[Kefey Purchase] Add to cart failed:', err && err.message ? err.message : err);
              cta.disabled = false;
            });
        });
      }

      render();
    });
  }

  function initHeroScrollCta(scope) {
    var links = (scope || document).querySelectorAll('[data-kefey-scroll-cta]');
    if (!links.length) return;

    links.forEach(function (link) {
      if (link.dataset.kefeyScrollBound === 'true') return;
      link.dataset.kefeyScrollBound = 'true';

      link.addEventListener('click', function (event) {
        var href = link.getAttribute('href') || '';
        if (href.charAt(0) !== '#') return;

        var id = href.slice(1);
        var target = id ? document.getElementById(id) : null;

        if (!target) {
          target = document.getElementById('kefey-purchase') || document.querySelector('[data-kefey-purchase]');
        }

        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function init(scope) {
    initIngredientsCarousels(scope);
    initCertCarousels(scope);
    initFinalCtaSlider(scope);
    initFaqAria(scope);
    initPurchaseModule(scope);
    initHeroScrollCta(scope);
  }

  document.addEventListener('DOMContentLoaded', function () { init(document); });
  document.addEventListener('shopify:section:load', function (evt) { init(evt.target); });
})();
