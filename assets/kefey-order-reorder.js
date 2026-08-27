(() => {
  const CART_ADD_URL = (window.routes && window.routes.cart_add_url) || '/cart/add.js';
  const CART_URL = (window.routes && window.routes.cart_url) || '/cart';

  function getDiscountRedirectUrl(code) {
    if (!code) return CART_URL;
    return `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(CART_URL)}`;
  }

  function uniqueDiscountCodes(rawItems) {
    const codes = [];
    const seen = new Set();
    (rawItems || []).forEach(function (item) {
      const code = String((item && item.discountCode) || '')
        .trim()
        .toUpperCase();
      if (!code || seen.has(code)) return;
      seen.add(code);
      codes.push(code);
    });
    return codes;
  }

  async function addItems(items) {
    const response = await fetch(CART_ADD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      const body = await response.json().catch(function () {
        return {};
      });
      throw new Error((body && (body.description || body.message)) || 'Failed to add items');
    }
  }

  function initOrderReorder(root) {
    const button = root.querySelector('[data-kefey-reorder-onetime]');
    const status = root.querySelector('[data-kefey-reorder-status]');
    const payloadEl = root.querySelector('[data-kefey-reorder-payload]');
    if (!button || !payloadEl) return;

    let payload;
    try {
      payload = JSON.parse(payloadEl.textContent);
    } catch (error) {
      return;
    }

    button.addEventListener('click', async function () {
      if (button.dataset.loading === 'true') return;

      const rawItems = (payload && payload.items) || [];
      // Never recreate selling-plan lines from this button — avoids duplicate subscriptions.
      const items = rawItems
        .filter(function (item) {
          return item && item.id && item.quantity > 0;
        })
        .map(function (item) {
          const next = {
            id: Number(item.id),
            quantity: Number(item.quantity),
          };
          if (item.properties && Object.keys(item.properties).length) {
            next.properties = item.properties;
          }
          return next;
        });

      if (!items.length) {
        if (status) {
          status.hidden = false;
          status.textContent = 'No one-time items available to reorder from this order.';
        }
        return;
      }

      button.dataset.loading = 'true';
      button.disabled = true;
      if (status) {
        status.hidden = false;
        status.textContent = 'Adding one-time items to your cart…';
      }

      try {
        await addItems(items);

        // Restore first code via /discount; kefey-cart-offers.js then syncs any remaining
        // SAVE15/SAVE25 labels from restored line properties on cart load.
        const codes = uniqueDiscountCodes(rawItems);
        window.location.href = codes.length ? getDiscountRedirectUrl(codes[0]) : CART_URL;
      } catch (error) {
        console.error('[Kefey Order] Reorder failed:', error);
        if (status) {
          status.hidden = false;
          status.textContent = error && error.message ? error.message : 'Reorder failed. Please try again.';
        }
        button.dataset.loading = 'false';
        button.disabled = false;
      }
    });
  }

  function boot() {
    document.querySelectorAll('[data-kefey-order-reorder]').forEach(initOrderReorder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
