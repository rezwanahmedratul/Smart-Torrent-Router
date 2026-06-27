(function(){"use strict";(function(){function d(){if(document.getElementById("smart-router-content-style"))return;const r=document.createElement("style");r.id="smart-router-content-style",r.textContent=`
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
    `,(document.head||document.documentElement).appendChild(r)}function n(){document.querySelectorAll('a[href^="magnet:"]').forEach(e=>{var o;if(e.getAttribute("data-smart-router-injected")==="true")return;e.setAttribute("data-smart-router-injected","true");const t=document.createElement("button");t.type="button",t.className="smart-router-download-btn",t.title="Send to qBittorrent",t.innerHTML=`
        <svg viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
        </svg>
        <span class="smart-router-tooltip">Send to qBittorrent</span>
      `,t.addEventListener("click",l=>{l.preventDefault(),l.stopPropagation();const m=e.getAttribute("href");m&&(t.classList.add("loading"),t.innerHTML=`
          <svg viewBox="0 0 24 24">
            <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8z"/>
          </svg>
          <span class="smart-router-tooltip">Sending...</span>
        `,browser.runtime.sendMessage({action:"addMagnet",url:m}).then(a=>{a&&a.success?(t.classList.remove("loading"),t.classList.add("success"),t.innerHTML=`
              <svg viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span class="smart-router-tooltip">Sent!</span>
            `,setTimeout(()=>{t.className="smart-router-download-btn",t.innerHTML=`
                <svg viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
                </svg>
                <span class="smart-router-tooltip">Send to qBittorrent</span>
              `},3e3)):(t.classList.remove("loading"),t.classList.add("error"),t.innerHTML=`
              <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              <span class="smart-router-tooltip">Failed!</span>
            `,setTimeout(()=>{t.className="smart-router-download-btn",t.innerHTML=`
                <svg viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
                </svg>
                <span class="smart-router-tooltip">Send to qBittorrent</span>
              `},3e3))}).catch(a=>{console.error("[SmartTorrentRouter] Failed to send magnet link:",a),t.classList.remove("loading"),t.classList.add("error"),t.innerHTML=`
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            <span class="smart-router-tooltip">Error!</span>
          `,setTimeout(()=>{t.className="smart-router-download-btn",t.innerHTML=`
              <svg viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
              </svg>
              <span class="smart-router-tooltip">Send to qBittorrent</span>
            `},3e3)}))}),(o=e.parentNode)==null||o.insertBefore(t,e.nextSibling)})}let s=!0;document.addEventListener("click",r=>{if(!s)return;const e=r.target.closest("a");if(e&&e.href&&e.href.startsWith("magnet:")){r.preventDefault(),r.stopPropagation();const t=e.href;console.log("[SmartTorrentRouter] Intercepted magnet link click:",t),browser.runtime.sendMessage({action:"addMagnet",url:t}).then(o=>{o&&o.success?console.log("[SmartTorrentRouter] Magnet successfully sent to router."):console.warn("[SmartTorrentRouter] Failed to send magnet:",o==null?void 0:o.error)}).catch(o=>{console.error("[SmartTorrentRouter] Message transmission error:",o)})}},!0);function i(){d(),n();const r=document.body;r?new MutationObserver(()=>{n()}).observe(r,{childList:!0,subtree:!0}):document.addEventListener("DOMContentLoaded",()=>{d(),n(),new MutationObserver(()=>{n()}).observe(document.body,{childList:!0,subtree:!0})})}browser.runtime.sendMessage({action:"getSettings"}).then(r=>{r&&r.success?(s=r.settings.enabled!==!1,s&&i()):i()}).catch(()=>{i()})})()})();
