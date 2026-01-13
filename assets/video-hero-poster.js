(() => {
  function init(section) {
    const posterBtn = section.querySelector('.vhp__poster');
    const modal = section.querySelector('.vhp__modal');
    const closeBtn = modal.querySelector('.vhp__close');
    const backdrop = modal.querySelector('.vhp__backdrop');
    const videoWrap = modal.querySelector('.vhp__video');

    const videoType = section.getAttribute('data-video-type');
    const externalUrl = section.getAttribute('data-external-url') || '';
    let sources = [];
    try {
      sources = JSON.parse(section.getAttribute('data-shopify-sources') || '[]');
    } catch(e) { sources = []; }

    let lastFocused = null;

    function openModal() {
      lastFocused = document.activeElement;
      modal.hidden = false;
      buildVideo();
      // focus trap start
      closeBtn.focus();
      document.addEventListener('keydown', onKeyDown);
    }
    function closeModal() {
      destroyVideo();
      modal.hidden = true;
      document.removeEventListener('keydown', onKeyDown);
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      if (e.key === 'Tab') { // trap focus inside modal
        const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function buildVideo() {
      destroyVideo();
      if (videoType === 'shopify' && sources.length) {
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('controls', '');
        video.autoplay = true;
        sources.forEach(s => {
          const src = document.createElement('source');
          src.src = s.url;
          src.type = s.mime_type || 'video/mp4';
          video.appendChild(src);
        });
        videoWrap.appendChild(video);
      } else if (videoType === 'youtube_vimeo' && externalUrl) {
        const src = toEmbedUrl(externalUrl);
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;
        videoWrap.appendChild(iframe);
      }
    }
    function destroyVideo() {
      videoWrap.innerHTML = '';
    }
    function toEmbedUrl(url) {
      try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '');
        if (host.includes('youtube.com') || host.includes('youtu.be')) {
          let id = '';
          if (host === 'youtu.be') id = u.pathname.slice(1);
          else id = u.searchParams.get('v') || '';
          return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
        } else if (host.includes('vimeo.com')) {
          const parts = u.pathname.split('/').filter(Boolean);
          const id = parts.pop();
          return `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0`;
        }
      } catch(e) {}
      return url;
    }

    posterBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.vhp').forEach(init);
  });
})();


