(() => {
  const CART_ADD_URL = (window.routes && window.routes.cart_add_url) || '/cart/add.js';
  const CART_URL = (window.routes && window.routes.cart_url) || '/cart';

  function parseInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  function getDiscountRedirectUrl(code) {
    if (!code) return CART_URL;
    return `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(CART_URL)}`;
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

      if (bundleKey || isUpsellAdd) {
        window.location.href = CART_URL;
      } else {
        window.location.href = getDiscountRedirectUrl(discountCode);
      }
    } catch (error) {
      console.error(error);
      window.location.href = CART_URL;
    } finally {
      button.dataset.loading = 'false';
      button.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    const offerButton = event.target.closest('[data-cart-offer-button]');
    if (offerButton) {
      handleOfferButton(offerButton);
    }
  });
})();
