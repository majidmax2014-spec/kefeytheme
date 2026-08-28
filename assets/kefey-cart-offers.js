(() => {
  const CART_ADD_URL = (window.routes && window.routes.cart_add_url) || '/cart/add.js';
  const CART_CHANGE_URL = (window.routes && window.routes.cart_change_url) || '/cart/change.js';
  const CART_URL = (window.routes && window.routes.cart_url) || '/cart';
  const CART_UPDATE_URL = (window.routes && window.routes.cart_update_url) || '/cart/update.js';
  const DISCOUNT_SYNC_KEY = 'kefey_discount_sync';
  const BUY_AGAIN_RESTORE_KEY = 'kefey_buy_again_restore';

  function parseInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  function getDiscountRedirectUrl(code) {
    if (!code) return CART_URL;
    return `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(CART_URL)}`;
  }

  function normalizeDiscountName(value) {
    return String(value || '')
      .trim()
      .toUpperCase();
  }

  function normalizeSellingPlanId(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
    const text = String(raw).trim();
    const gid = /SellingPlan\/(\d+)/.exec(text);
    if (gid) return Number(gid[1]);
    const parsed = Number.parseInt(text, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function readRestoreConfig() {
    const el = document.getElementById('kefey-cart-restore-config');
    if (!el) return { bundles: [], upsell: null, packImages: {} };
    try {
      return JSON.parse(el.textContent);
    } catch (error) {
      console.error('[Kefey Cart] Invalid restore config:', error);
      return { bundles: [], upsell: null, packImages: {} };
    }
  }

  async function fetchCart() {
    const response = await fetch('/cart.js', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to load cart');
    return response.json();
  }

  async function fetchProduct(handle) {
    if (!handle) return null;
    const response = await fetch(`/products/${encodeURIComponent(handle)}.js`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return response.json();
  }

  function findVariant(product, variantId) {
    if (!product || !Array.isArray(product.variants)) return null;
    return product.variants.find(function (variant) {
      return Number(variant.id) === Number(variantId);
    }) || null;
  }

  function allocationPlanId(allocation) {
    if (!allocation) return null;
    return normalizeSellingPlanId(
      allocation.selling_plan_id != null
        ? allocation.selling_plan_id
        : allocation.selling_plan && allocation.selling_plan.id != null
          ? allocation.selling_plan.id
          : null
    );
  }

  function pickSellingPlanId(variant) {
    if (!variant || !Array.isArray(variant.selling_plan_allocations) || !variant.selling_plan_allocations.length) {
      return null;
    }

    const preferred =
      variant.selling_plan_allocations.find(function (allocation) {
        const plan = allocation && allocation.selling_plan;
        if (!plan) return false;
        if (plan.recurring_deliveries === true) return true;
        return String(plan.category || '').toUpperCase() === 'SUBSCRIPTION';
      }) || variant.selling_plan_allocations[0];

    return allocationPlanId(preferred);
  }

  function inferPackSize(variant, item) {
    const sources = [
      variant && variant.title,
      item && item.variant_title,
      item && item.product_title,
      item && item.title,
    ];

    for (let i = 0; i < sources.length; i += 1) {
      const match = String(sources[i] || '').match(/(\d+)\s*packs?/i);
      if (match) return parseInteger(match[1], 0);
    }

    return parseInteger(item && item.quantity, 0);
  }

  function lineHasSellingPlan(item) {
    return Boolean(item && (item.selling_plan_allocation || item.selling_plan));
  }

  function copyPublicProperties(properties) {
    const next = {};
    Object.keys(properties || {}).forEach(function (key) {
      if (!key || key.charAt(0) === '_') return;
      next[key] = properties[key];
    });
    return next;
  }

  function matchBundleConfig(item, config) {
    const bundles = (config && config.bundles) || [];
    const variantId = Number(item.variant_id);
    const title = String(item.variant_title || item.product_title || item.title || '').toLowerCase();

    const byId = bundles.find(function (bundle) {
      return Number(bundle.variantId) === variantId;
    });
    if (byId) return byId;

    return (
      bundles.find(function (bundle) {
        return (bundle.aliasTitles || []).some(function (alias) {
          return alias && title.indexOf(String(alias).toLowerCase()) !== -1;
        });
      }) || null
    );
  }

  /**
   * Native Shopify Buy Again re-adds variant + qty only (no selling_plan, no Kefey props).
   * Rebuild subscription lines via remove + /cart/add.js with selling_plan, and attach
   * bundle properties so cart display, thumbnails, and discount sync work seamlessly.
   */
  async function restoreBuyAgainPurchaseConfig() {
    try {
      const config = readRestoreConfig();
      const cart = await fetchCart();
      if (!cart.items || !cart.items.length) return false;

      // Skip one load after we just restored (prevents reload loops), then clear.
      const guardKey = `${BUY_AGAIN_RESTORE_KEY}:${cart.token || 'cart'}`;
      if (sessionStorage.getItem(guardKey) === '1') {
        sessionStorage.removeItem(guardKey);
        return false;
      }

      const productCache = {};
      const subscriptionReplacements = [];
      const propertyUpdates = [];

      for (let index = 0; index < cart.items.length; index += 1) {
        const item = cart.items[index];
        const props = item.properties || {};
        const handle = item.handle;

        if (!productCache[handle]) {
          productCache[handle] = await fetchProduct(handle);
        }

        const product = productCache[handle];
        const variant = findVariant(product, item.variant_id);
        const alreadyConfigured =
          props._kefey_purchase_type === 'sub' ||
          props._kefey_purchase_type === 'bundle' ||
          props._kefey_bundle ||
          props._kefey_upsell;

        // Subscription packs: variant has selling plans but Buy Again omitted them.
        if (!lineHasSellingPlan(item) && variant) {
          const planId = pickSellingPlanId(variant);
          if (planId) {
            const packSize = inferPackSize(variant, item) || parseInteger(item.quantity, 1);
            const packImage =
              (config.packImages && config.packImages[String(packSize)]) ||
              (variant.featured_image && variant.featured_image.src) ||
              props._kefey_pack_image ||
              '';

            const properties = copyPublicProperties(props);
            properties._kefey_purchase_type = 'sub';
            properties._kefey_pack_size = String(packSize);
            properties._kefey_plan_id = String(planId);
            if (packImage) properties._kefey_pack_image = packImage;

            subscriptionReplacements.push({
              removeKey: item.key,
              add: {
                id: Number(item.variant_id),
                quantity: Number(item.quantity),
                selling_plan: planId,
                properties: properties,
              },
            });
            continue;
          }
        }

        // One-time bundles (SAVE15 / SAVE25): restore line properties for display + discount sync.
        const bundle = matchBundleConfig(item, config);
        if (bundle && !props._kefey_bundle && !lineHasSellingPlan(item)) {
          const properties = Object.assign({}, props, {
            _kefey_bundle: bundle.key,
            _kefey_bundle_line: String(Date.now() + index),
            _kefey_purchase_type: 'bundle',
            _kefey_bundle_discount: String(bundle.discount || ''),
            _kefey_bundle_discount_label: String(bundle.code || ''),
            _kefey_pack_size: String(bundle.packSize || item.quantity || ''),
          });
          if (bundle.packImage) properties._kefey_pack_image = bundle.packImage;

          propertyUpdates.push({
            id: item.key,
            quantity: item.quantity,
            properties: properties,
          });
          continue;
        }

        // Extra-tube upsell without properties.
        const upsell = config.upsell;
        if (
          upsell &&
          Number(upsell.variantId) === Number(item.variant_id) &&
          !props._kefey_upsell &&
          !alreadyConfigured &&
          !lineHasSellingPlan(item)
        ) {
          propertyUpdates.push({
            id: item.key,
            quantity: item.quantity,
            properties: Object.assign({}, props, {
              _kefey_upsell: 'extra-tube',
              _kefey_upsell_line: String(Date.now() + index),
              _kefey_upsell_discount: String(upsell.discount || '10'),
              _kefey_upsell_discount_label: String(upsell.code || 'SAVE10'),
              _kefey_purchase_type: 'one',
            }),
          });
        }
      }

      if (!subscriptionReplacements.length && !propertyUpdates.length) {
        return false;
      }

      sessionStorage.setItem(guardKey, '1');

      // Apply bundle/upsell properties while original line keys are still valid.
      for (let i = 0; i < propertyUpdates.length; i += 1) {
        const changeResponse = await fetch(CART_CHANGE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify(propertyUpdates[i]),
        });
        if (!changeResponse.ok) throw new Error('Failed restoring bundle properties');
      }

      if (subscriptionReplacements.length) {
        const updates = {};
        subscriptionReplacements.forEach(function (entry) {
          updates[entry.removeKey] = 0;
        });

        const updateResponse = await fetch(CART_UPDATE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({ updates: updates }),
        });
        if (!updateResponse.ok) throw new Error('Failed removing Buy Again subscription stubs');

        const addResponse = await fetch(CART_ADD_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            items: subscriptionReplacements.map(function (entry) {
              return entry.add;
            }),
          }),
        });
        if (!addResponse.ok) {
          const body = await addResponse.json().catch(function () {
            return {};
          });
          throw new Error((body && (body.description || body.message)) || 'Failed restoring selling plans');
        }
      }

      window.location.reload();
      return true;
    } catch (error) {
      console.error('[Kefey Cart] Buy Again restore failed:', error);
    }

    return false;
  }

  function collectAppliedDiscountNames(cart) {
    const names = new Set();

    (cart.cart_level_discount_applications || []).forEach(function (discount) {
      const title = normalizeDiscountName(discount.title || discount.code);
      if (title) names.add(title);
    });

    (cart.items || []).forEach(function (item) {
      (item.discounts || []).forEach(function (discount) {
        const title = normalizeDiscountName(discount.title);
        if (title) names.add(title);
      });
      (item.line_level_discount_allocations || []).forEach(function (allocation) {
        const app = allocation.discount_application || {};
        const title = normalizeDiscountName(app.title || app.code);
        if (title) names.add(title);
      });
    });

    return names;
  }

  function collectNeededDiscountCodes(cart) {
    const codes = [];
    const seen = new Set();

    (cart.items || []).forEach(function (item) {
      const props = item.properties || {};
      const code = (props._kefey_bundle_discount_label || props._kefey_upsell_discount_label || '').trim();
      const key = normalizeDiscountName(code);
      if (!key || seen.has(key)) return;
      seen.add(key);
      codes.push(code);
    });

    return codes;
  }

  /**
   * Apply the first missing bundle/upsell discount code via Shopify's /discount/URL
   * so checkout gets a real discount (cart Liquid display is not enough).
   */
  async function syncBundleDiscountCodes() {
    try {
      if (sessionStorage.getItem(DISCOUNT_SYNC_KEY) === '1') {
        sessionStorage.removeItem(DISCOUNT_SYNC_KEY);
        return;
      }

      const cartResponse = await fetch('/cart.js', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!cartResponse.ok) return;

      const cart = await cartResponse.json();
      const needed = collectNeededDiscountCodes(cart);
      if (!needed.length) return;

      const applied = collectAppliedDiscountNames(cart);
      const missing = needed.find(function (code) {
        return !applied.has(normalizeDiscountName(code));
      });

      if (!missing) return;

      sessionStorage.setItem(DISCOUNT_SYNC_KEY, '1');
      window.location.href = getDiscountRedirectUrl(missing);
    } catch (error) {
      console.error('[Kefey Cart] Discount sync failed:', error);
    }
  }

  /**
   * No quantity inflation needed since variants are priced per pack total.
   */
  async function syncSubscriptionPackQuantities() {
    return false;
  }

  async function addVariantToCart(variantId, quantity, properties) {
    const item = {
      id: parseInteger(variantId, 0),
      quantity: parseInteger(quantity, 1),
    };

    if (properties && Object.keys(properties).length > 0) {
      item.properties = properties;
    }

    const payload = {
      items: [item],
    };

    const response = await fetch(CART_ADD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Cart add failed');
    }
  }

  async function handleOfferButton(button) {
    if (button.dataset.loading === 'true') return;
    button.dataset.loading = 'true';
    button.disabled = true;

    try {
      const variantId = (button.dataset.variantId || '').trim();
      const fallbackUrl = button.dataset.fallbackUrl || CART_URL;
      const discountCode = (button.dataset.discountCode || '').trim();
      const quantity = parseInteger(button.dataset.quantity, 1);

      if (button.hasAttribute('data-upsell-add')) {
        const cartResponse = await fetch('/cart.js', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });

        if (cartResponse.ok) {
          const cart = await cartResponse.json();
          const hasQualifyingItem = cart.items.some(
            (item) => !(item.properties && item.properties._kefey_upsell)
          );

          if (!hasQualifyingItem) {
            const errors = document.getElementById('cart-errors');
            if (errors) {
              errors.textContent =
                'Add at least one Mood Gummies item to your cart before using the 10% extra tube offer.';
            }
            return;
          }
        }
      }

      if (!variantId) {
        window.location.href = fallbackUrl;
        return;
      }

      const bundleKey = (button.dataset.bundleKey || '').trim();
      const bundleDiscount = (button.dataset.bundleDiscount || '').trim();
      const isUpsellAdd = button.hasAttribute('data-upsell-add');
      const properties = {};

      if (bundleKey) {
        properties._kefey_bundle = bundleKey;
        properties._kefey_bundle_line = String(Date.now());
        properties._kefey_purchase_type = 'bundle';

        const packImage = (button.dataset.packImage || '').trim();
        const packSize = (button.dataset.packSize || '').trim();
        if (packImage) properties._kefey_pack_image = packImage;
        if (packSize) properties._kefey_pack_size = packSize;

        if (bundleDiscount) {
          properties._kefey_bundle_discount = bundleDiscount;
        }

        if (discountCode) {
          properties._kefey_bundle_discount_label = discountCode;
        }
      } else if (isUpsellAdd) {
        properties._kefey_upsell = 'extra-tube';
        properties._kefey_upsell_line = String(Date.now());
        properties._kefey_upsell_discount = '10';

        if (discountCode) {
          properties._kefey_upsell_discount_label = discountCode;
        }
      }

      await addVariantToCart(variantId, quantity, properties);

      // Always apply the real Shopify discount code so checkout matches cart display.
      if (discountCode) {
        window.location.href = getDiscountRedirectUrl(discountCode);
      } else {
        window.location.href = CART_URL;
      }
    } catch (error) {
      console.error(error);
      window.location.href = CART_URL;
    } finally {
      button.dataset.loading = 'false';
      button.disabled = false;
    }
  }

  async function initCartPricingFixes() {
    // Buy Again lands as bare variant+qty — restore selling plans + bundle props first.
    const didRestore = await restoreBuyAgainPurchaseConfig();
    if (didRestore) return;

    const didReload = await syncSubscriptionPackQuantities();
    if (didReload) return;
    await syncBundleDiscountCodes();
  }

  document.addEventListener('click', (event) => {
    const offerButton = event.target.closest('[data-cart-offer-button]');
    if (offerButton) {
      handleOfferButton(offerButton);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCartPricingFixes);
  } else {
    initCartPricingFixes();
  }
})();
