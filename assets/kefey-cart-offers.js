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

  async function addVariantToCart(variantId, quantity) {
    const payload = {
      items: [
        {
          id: parseInteger(variantId, 0),
          quantity: parseInteger(quantity, 1),
        },
      ],
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

  function updateUpsellCounter(counterElement, delta) {
    const min = parseInteger(counterElement.dataset.min, 0);
    const max = parseInteger(counterElement.dataset.max, 10);
    const current = parseInteger(counterElement.dataset.qty, 0);
    const next = Math.max(min, Math.min(max, current + delta));

    counterElement.dataset.qty = String(next);
    const display = counterElement.querySelector('[data-upsell-qty-display]');
    if (display) display.textContent = String(next);
  }

  async function handleOfferButton(button) {
    if (button.dataset.loading === 'true') return;
    button.dataset.loading = 'true';
    button.disabled = true;

    try {
      const variantId = (button.dataset.variantId || '').trim();
      const fallbackUrl = button.dataset.fallbackUrl || CART_URL;
      const discountCode = (button.dataset.discountCode || '').trim();
      let quantity = parseInteger(button.dataset.quantity, 1);

      if (button.hasAttribute('data-upsell-add')) {
        const counter = document.querySelector('[data-upsell-counter]');
        if (counter) {
          const selectedQty = parseInteger(counter.dataset.qty, 0);
          quantity = selectedQty > 0 ? selectedQty : 1;
        }
      }

      if (!variantId) {
        window.location.href = fallbackUrl;
        return;
      }

      await addVariantToCart(variantId, quantity);
      window.location.href = getDiscountRedirectUrl(discountCode);
    } catch (error) {
      console.error(error);
      window.location.href = CART_URL;
    } finally {
      button.dataset.loading = 'false';
      button.disabled = false;
    }
  }

  document.addEventListener('click', (event) => {
    const counterButton = event.target.closest('[data-upsell-change]');
    if (counterButton) {
      const counterElement = counterButton.closest('[data-upsell-counter]');
      if (counterElement) {
        const delta = parseInteger(counterButton.dataset.upsellChange, 0);
        updateUpsellCounter(counterElement, delta);
      }
      return;
    }

    const offerButton = event.target.closest('[data-cart-offer-button]');
    if (offerButton) {
      handleOfferButton(offerButton);
    }
  });
})();
