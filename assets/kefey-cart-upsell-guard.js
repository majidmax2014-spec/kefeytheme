(() => {
  const CART_JS_URL = '/cart.js';
  const CART_CHANGE_URL = (window.routes && window.routes.cart_change_url) || '/cart/change.js';
  const CART_URL = (window.routes && window.routes.cart_url) || '/cart';

  function isUpsellItem(item) {
    return Boolean(item && item.properties && item.properties._kefey_upsell);
  }

  function hasQualifyingItem(items) {
    return items.some((item) => !isUpsellItem(item));
  }

  async function fetchCart() {
    const response = await fetch(CART_JS_URL, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to load cart');
    }

    return response.json();
  }

  async function removeUpsellLines(items) {
    const upsellItems = items.filter(isUpsellItem);

    for (const item of upsellItems) {
      await fetch(CART_CHANGE_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          id: item.key,
          quantity: 0,
        }),
      });
    }
  }

  function showUpsellRemovedMessage() {
    const errors = document.getElementById('cart-errors');
    if (!errors) return;

    errors.textContent =
      'The 10% extra tube offer was removed because it requires at least one other item in your cart.';
  }

  async function validateUpsellCart(options = {}) {
    if (!document.querySelector('cart-items')) return false;

    const cart = await fetchCart();
    const upsellItems = cart.items.filter(isUpsellItem);

    if (!upsellItems.length) return false;

    if (hasQualifyingItem(cart.items)) return false;

    await removeUpsellLines(cart.items);

    if (options.reload !== false) {
      sessionStorage.setItem('kefey_upsell_removed', '1');
      window.location.href = CART_URL;
    }

    return true;
  }

  function initUpsellRemovedNotice() {
    if (sessionStorage.getItem('kefey_upsell_removed') !== '1') return;
    sessionStorage.removeItem('kefey_upsell_removed');
    showUpsellRemovedMessage();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initUpsellRemovedNotice();
    validateUpsellCart().catch((error) => console.error(error));
  });

  if (typeof subscribe !== 'undefined' && typeof PUB_SUB_EVENTS !== 'undefined') {
    subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (!event || event.source !== 'cart-items') return;
      validateUpsellCart().catch((error) => console.error(error));
    });
  }

  window.KefeyCartUpsellGuard = {
    fetchCart,
    hasQualifyingItem,
    isUpsellItem,
    validateUpsellCart,
  };
})();
