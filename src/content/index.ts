// Content script to intercept magnet links and inject instant routing buttons
(function () {
  // Inject visual CSS styles for the button accent
  function injectStyles() {
    if (document.getElementById('smart-router-content-style')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'smart-router-content-style';
    style.textContent = `
      .smart-router-download-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 18px !important;
        height: 18px !important;
        margin-left: 6px !important;
        margin-right: 2px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #6366f1, #4f46e5) !important;
        color: white !important;
        border: none !important;
        cursor: pointer !important;
        padding: 0 !important;
        vertical-align: middle !important;
        transition: all 0.2s ease-in-out !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15) !important;
        position: relative !important;
        z-index: 9999 !important;
      }

      .smart-router-download-btn:hover {
        transform: scale(1.15) !important;
        box-shadow: 0 3px 6px rgba(99, 102, 241, 0.4) !important;
        background: linear-gradient(135deg, #4f46e5, #4338ca) !important;
      }

      .smart-router-download-btn svg {
        width: 10px !important;
        height: 10px !important;
        fill: currentColor !important;
        pointer-events: none !important;
      }

      .smart-router-download-btn.loading {
        background: #9ca3af !important;
        cursor: not-allowed !important;
        animation: smart-router-spin 1s linear infinite !important;
      }

      .smart-router-download-btn.success {
        background: linear-gradient(135deg, #10b981, #059669) !important;
        box-shadow: 0 3px 6px rgba(16, 185, 129, 0.4) !important;
      }

      .smart-router-download-btn.error {
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
        box-shadow: 0 3px 6px rgba(239, 68, 68, 0.4) !important;
      }

      @keyframes smart-router-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .smart-router-tooltip {
        position: absolute !important;
        bottom: 135% !important;
        left: 50% !important;
        transform: translateX(-50%) scale(0.8) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        background-color: #1f2937 !important;
        color: white !important;
        text-align: center !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        font-size: 10px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        white-space: nowrap !important;
        transition: all 0.15s ease-in-out !important;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
        z-index: 100000 !important;
      }

      .smart-router-download-btn:hover .smart-router-tooltip {
        opacity: 1 !important;
        transform: translateX(-50%) scale(1) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // Inject helper buttons inline next to magnet links
  function injectMagnetButtons() {
    const links = document.querySelectorAll('a[href^="magnet:"]');
    links.forEach((link) => {
      if (link.getAttribute('data-smart-router-injected') === 'true') {
        return;
      }
      link.setAttribute('data-smart-router-injected', 'true');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'smart-router-download-btn';
      btn.title = 'Send to qBittorrent';

      // Cloud download SVG
      btn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
        </svg>
        <span class="smart-router-tooltip">Send to qBittorrent</span>
      `;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const magnetUrl = link.getAttribute('href');
        if (!magnetUrl) return;

        // Set loading state
        btn.classList.add('loading');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8z"/>
          </svg>
          <span class="smart-router-tooltip">Sending...</span>
        `;

        // Send to background
        browser.runtime.sendMessage({
          action: 'addMagnet',
          url: magnetUrl
        }).then((response) => {
          if (response && response.success) {
            btn.classList.remove('loading');
            btn.classList.add('success');
            btn.innerHTML = `
              <svg viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span class="smart-router-tooltip">Sent!</span>
            `;

            setTimeout(() => {
              btn.className = 'smart-router-download-btn';
              btn.innerHTML = `
                <svg viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
                </svg>
                <span class="smart-router-tooltip">Send to qBittorrent</span>
              `;
            }, 3000);
          } else {
            btn.classList.remove('loading');
            btn.classList.add('error');
            btn.innerHTML = `
              <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              <span class="smart-router-tooltip">Failed!</span>
            `;

            setTimeout(() => {
              btn.className = 'smart-router-download-btn';
              btn.innerHTML = `
                <svg viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
                </svg>
                <span class="smart-router-tooltip">Send to qBittorrent</span>
              `;
            }, 3000);
          }
        }).catch((err) => {
          console.error('[SmartTorrentRouter] Failed to send magnet link:', err);
          btn.classList.remove('loading');
          btn.classList.add('error');
          btn.innerHTML = `
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            <span class="smart-router-tooltip">Error!</span>
          `;
          setTimeout(() => {
            btn.className = 'smart-router-download-btn';
            btn.innerHTML = `
              <svg viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
              </svg>
              <span class="smart-router-tooltip">Send to qBittorrent</span>
            `;
          }, 3000);
        });
      });

      // Insert button inline right after the link
      link.parentNode?.insertBefore(btn, link.nextSibling);
    });
  }

  let isEnabled = true;

  // Intercept normal clicks on magnet links as fallback/intercept
  document.addEventListener(
    'click',
    (event) => {
      if (!isEnabled) return;
      const target = (event.target as HTMLElement).closest('a');
      if (target && target.href && target.href.startsWith('magnet:')) {
        event.preventDefault();
        event.stopPropagation();

        const magnetUrl = target.href;
        console.log('[SmartTorrentRouter] Intercepted magnet link click:', magnetUrl);

        browser.runtime.sendMessage({
          action: 'addMagnet',
          url: magnetUrl,
        }).then((response) => {
          if (response && response.success) {
            console.log('[SmartTorrentRouter] Magnet successfully sent to router.');
          } else {
            console.warn('[SmartTorrentRouter] Failed to send magnet:', response?.error);
          }
        }).catch((error) => {
          console.error('[SmartTorrentRouter] Message transmission error:', error);
        });
      }
    },
    true
  );

  // Initialize script safely (handles document_start injection)
  function init() {
    injectStyles();
    injectMagnetButtons();

    const body = document.body;
    if (body) {
      const observer = new MutationObserver(() => {
        injectMagnetButtons();
      });
      observer.observe(body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        injectMagnetButtons();
        const observer = new MutationObserver(() => {
          injectMagnetButtons();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  // Get settings and initialize if enabled
  browser.runtime.sendMessage({ action: 'getSettings' }).then((response) => {
    if (response && response.success) {
      isEnabled = response.settings.enabled !== false;
      if (isEnabled) {
        init();
      }
    } else {
      init();
    }
  }).catch(() => {
    init(); // Fallback if background script is unready
  });
})();
