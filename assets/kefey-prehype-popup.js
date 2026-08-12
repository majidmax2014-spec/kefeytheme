(function () {
  if (!window.prehypeSettings || !window.prehypeSettings.enabled) return;

  var popup = document.getElementById('PrehypePopup');
  if (!popup) return;

  var backdrop = popup.querySelector('.prehype-popup__backdrop');
  var closeBtn = popup.querySelector('.prehype-popup__close');
  var form = popup.querySelector('#PrehypeNotifyForm') || popup.querySelector('.prehype-popup__form');
  var emailInput = popup.querySelector('.prehype-popup__input');
  var submitBtn = popup.querySelector('.prehype-popup__submit');
  var messageEl = popup.querySelector('#PrehypePopupMessage') || popup.querySelector('.prehype-popup__message');
  var iframe = document.getElementById('PrehypeNotifyFrame');
  var lastFocus = null;
  var awaitingSignup = false;

  function isInsideNotifyForm(target) {
    return Boolean(target && target.closest && target.closest('#PrehypeNotifyForm'));
  }

  function isCheckoutTrigger(target) {
    if (!target || isInsideNotifyForm(target)) return false;

    var checkoutBtn = target.closest('[name="checkout"]');
    if (checkoutBtn) return true;

    var checkoutLink = target.closest('a[href*="/checkout"]');
    if (checkoutLink) return true;

    return false;
  }

  function setMessage(text, type) {
    if (!messageEl) return;
    messageEl.hidden = !text;
    messageEl.textContent = text || '';
    messageEl.classList.remove('prehype-popup__message--error', 'prehype-popup__message--success');
    if (type) messageEl.classList.add('prehype-popup__message--' + type);
  }

  function showSuccess() {
    awaitingSignup = false;
    if (form) form.hidden = true;
    if (submitBtn) submitBtn.disabled = false;
    setMessage(window.prehypeSettings.successMessage || "You're on the list!", 'success');
  }

  function openPopup(trigger, options) {
    lastFocus = trigger || document.activeElement;
    var keepState = options && options.keepState;

    if (!keepState) {
      if (form) form.hidden = false;
      if (emailInput) emailInput.value = '';
      if (submitBtn) submitBtn.disabled = false;
      setMessage('');
    }

    popup.hidden = false;
    requestAnimationFrame(function () {
      popup.classList.add('is-visible');
    });
    document.body.classList.add('prehype-popup-open');

    if (typeof trapFocus === 'function') {
      trapFocus(popup.querySelector('.prehype-popup__panel'), closeBtn);
    } else if (emailInput) {
      emailInput.focus();
    }
  }

  function closePopup() {
    popup.classList.remove('is-visible');
    document.body.classList.remove('prehype-popup-open');

    window.setTimeout(function () {
      popup.hidden = true;
      if (typeof removeTrapFocus === 'function') {
        removeTrapFocus(lastFocus);
      } else if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }, 250);
  }

  function handleCheckoutAttempt(event) {
    if (!isCheckoutTrigger(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    openPopup(event.target);
  }

  function handleFormSubmit(event) {
    if (event.target && event.target.id === 'PrehypeNotifyForm') return;
    if (!event.submitter || event.submitter.name !== 'checkout') return;
    event.preventDefault();
    event.stopPropagation();
    openPopup(event.submitter);
  }

  function handleNotifySubmit(event) {
    if (!emailInput) return;

    var email = emailInput.value.trim();
    if (!email) {
      event.preventDefault();
      setMessage('Please enter your email address.', 'error');
      emailInput.focus();
      return;
    }

    awaitingSignup = true;
    if (submitBtn) submitBtn.disabled = true;
    setMessage('');
  }

  function handleIframeLoad() {
    if (!awaitingSignup) return;

    var posted = false;
    try {
      var href = iframe && iframe.contentWindow && iframe.contentWindow.location.href;
      posted = Boolean(
        href && (href.indexOf('customer_posted=true') !== -1 || href.indexOf('contact_posted=true') !== -1)
      );
    } catch (err) {
      posted = true;
    }

    if (posted) {
      showSuccess();
      return;
    }

    showSuccess();
  }

  document.addEventListener('click', handleCheckoutAttempt, true);
  document.addEventListener('submit', handleFormSubmit, true);

  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (backdrop) backdrop.addEventListener('click', closePopup);

  popup.addEventListener('keydown', function (event) {
    if (event.code === 'Escape') {
      event.preventDefault();
      closePopup();
    }
  });

  if (form) {
    if (iframe) form.setAttribute('target', 'PrehypeNotifyFrame');
    form.addEventListener('submit', handleNotifySubmit);
  }

  if (iframe) iframe.addEventListener('load', handleIframeLoad);

  document.body.classList.add('prehype-active');

  if (window.prehypeSettings.postedSuccessfully) {
    showSuccess();
    openPopup(null, { keepState: true });
  } else if (popup.querySelector('.prehype-popup__message--error:not([hidden])')) {
    openPopup(null, { keepState: true });
  }
})();
