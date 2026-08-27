(() => {
  const CART_ADD_URL = (window.routes && window.routes.cart_add_url) || '/cart/add.js';
  const CART_URL = (window.routes && window.routes.cart_url) || '/cart';
  const CART_UPDATE_URL = (window.routes && window.routes.cart_update_url) || '/cart/update.js';
  const DISCOUNT_SYNC_KEY = 'kefey_discount_sync';

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
   * Heal subscribe lines that used qty 1 on $39 pack variants.
   * Expected: 2-pack = qty 2 → $70.20 after 10% (not $35.10).
   */
  async function syncSubscriptionPackQuantities() {
    try {
      const cartResponse = await fetch('/cart.js', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!cartResponse.ok) return false;

      const cart = await cartResponse.json();
      if (!cart.items || !cart.items.length) return false;

      const updates = {};
      let needsUpdate = false;

      cart.items.forEach((item) => {
        const props = item.properties || {};
        if (props._kefey_purchase_type !== 'sub') return;

        const pack = parseInteger(props._kefey_pack_size, 0);
        const unitPrice = Number(item.original_price || item.price || 0);
        // Per-tube pricing (~$39). Skip if variant is already a pack total.
        if (pack <= 1 || unitPrice >= 5000) return;
        if (item.quantity === pack) return;

        updates[item.key] = pack;
        needsUpdate = true;
      });

      if (!needsUpdate) return false;

      const updateResponse = await fetch(CART_UPDATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ updates }),
      });

      if (updateResponse.ok) {
        window.location.reload();
        return true;
      }
    } catch (error) {
      console.error('[Kefey Cart] Subscription quantity sync failed:', error);
    }
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
