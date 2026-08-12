(function () {
  if (!window.prehypeSettings || !window.prehypeSettings.enabled) return;

  var popup = document.getElementById('PrehypePopup');
  if (!popup) return;

  var backdrop = popup.querySelector('.prehype-popup__backdrop');
  var closeBtn = popup.querySelector('.prehype-popup__close');
  var form = popup.querySelector('.prehype-popup__form');
  var emailInput = popup.querySelector('.prehype-popup__input');
  var submitBtn = popup.querySelector('.prehype-popup__submit');
  var messageEl = popup.querySelector('.prehype-popup__message');
  var lastFocus = null;

  function isCheckoutTrigger(target) {
    if (!target) return false;

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

  function openPopup(trigger) {
    lastFocus = trigger || document.activeElement;
    if (form) form.hidden = false;
    if (emailInput) emailInput.value = '';
    setMessage('');
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
    setMessage('');
    openPopup(event.target);
  }

  function handleFormSubmit(event) {
    if (!event.submitter || event.submitter.name !== 'checkout') return;
    event.preventDefault();
    event.stopPropagation();
    setMessage('');
    openPopup(event.submitter);
  }

  function submitNotifyForm(event) {
    event.preventDefault();
    if (!emailInput || !submitBtn) return;

    var email = emailInput.value.trim();
    if (!email) {
      setMessage('Please enter your email address.', 'error');
      emailInput.focus();
      return;
    }

    submitBtn.disabled = true;
    setMessage('');

    var body = new URLSearchParams();
    body.set('form_type', 'customer');
    body.set('utf8', '\u2713');
    body.set('contact[email]', email);
    body.set('contact[tags]', window.prehypeSettings.tags || 'pre-launch, notify-me');

    fetch((window.shopUrl || '') + '/contact', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      credentials: 'same-origin',
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Request failed');
        setMessage(window.prehypeSettings.successMessage || "You're on the list!", 'success');
        if (form) form.hidden = true;
      })
      .catch(function () {
        setMessage('Something went wrong. Please try again.', 'error');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
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

  if (form) form.addEventListener('submit', submitNotifyForm);

  document.body.classList.add('prehype-active');
})();
