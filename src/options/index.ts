import { RouterSettings } from '../background/index';

let globalSettings: RouterSettings | null = null;

// DOM Elements
const elements = {
  // Navigation
  navItems: document.querySelectorAll('.nav-item'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  themeToggle: document.getElementById('theme-toggle') as HTMLButtonElement,

  // Connection
  qbUrl: document.getElementById('qb-url') as HTMLInputElement,
  qbUsername: document.getElementById('qb-username') as HTMLInputElement,
  qbPassword: document.getElementById('qb-password') as HTMLInputElement,
  qbApiKey: document.getElementById('qb-apikey') as HTMLInputElement,
  btnTestConn: document.getElementById('btn-test-conn') as HTMLButtonElement,
  btnOpenQb: document.getElementById('btn-open-qb') as HTMLButtonElement,
  btnSslHelp: document.getElementById('btn-ssl-help') as HTMLButtonElement,
  connTestResult: document.getElementById('conn-test-result') as HTMLDivElement,
  connBadge: document.getElementById('conn-badge') as HTMLDivElement,
  connDot: document.getElementById('conn-dot') as HTMLSpanElement,
  connText: document.getElementById('conn-text') as HTMLSpanElement,

  // Behavior
  confidenceThreshold: document.getElementById('confidence-threshold') as HTMLInputElement,
  thresholdVal: document.getElementById('threshold-val') as HTMLSpanElement,
  pollInterval: document.getElementById('poll-interval') as HTMLInputElement,
  pollTimeout: document.getElementById('poll-timeout') as HTMLInputElement,
  tempCategory: document.getElementById('temp-category') as HTMLInputElement,
  notifyAuto: document.getElementById('notify-auto') as HTMLInputElement,
  notifyPending: document.getElementById('notify-pending') as HTMLInputElement,
  notifyError: document.getElementById('notify-error') as HTMLInputElement,
  devLogs: document.getElementById('dev-logs') as HTMLInputElement,

  // Mappings
  mapMovies: document.getElementById('map-movies') as HTMLInputElement,
  mapSeries: document.getElementById('map-series') as HTMLInputElement,
  mapAnime: document.getElementById('map-anime') as HTMLInputElement,
  mapMusic: document.getElementById('map-music') as HTMLInputElement,
  mapGames: document.getElementById('map-games') as HTMLInputElement,
  mapBooks: document.getElementById('map-books') as HTMLInputElement,
  mapIso: document.getElementById('map-iso') as HTMLInputElement,
  mapSoftware: document.getElementById('map-software') as HTMLInputElement,
  mapOther: document.getElementById('map-other') as HTMLInputElement,

  // Integrations
  tmdbKey: document.getElementById('tmdb-key') as HTMLInputElement,
  anilistEnabled: document.getElementById('anilist-enabled') as HTMLInputElement,

  // Backup
  btnExport: document.getElementById('btn-export') as HTMLButtonElement,
  btnTriggerImport: document.getElementById('btn-trigger-import') as HTMLButtonElement,
  importFile: document.getElementById('import-file') as HTMLInputElement,
  importResult: document.getElementById('import-result') as HTMLDivElement,

  // History
  historyContainer: document.getElementById('history-container') as HTMLDivElement,
  btnClearAllHistory: document.getElementById('btn-clear-all-history') as HTMLButtonElement,

  // Footer Actions
  btnSave: document.getElementById('btn-save') as HTMLButtonElement,
  btnReset: document.getElementById('btn-reset') as HTMLButtonElement,
};

// Default mappings
const DEFAULT_MAPPING = {
  movies: 'movies',
  series: 'series',
  anime: 'anime',
  music: 'music',
  games: 'games',
  books: 'books',
  iso: 'iso',
  software: 'software',
  other: 'other',
};



// Initialize Options Page
async function init() {
  setupTabs();
  setupTheme();
  setupEventListeners();
  await loadCurrentSettings();
  await testCurrentConnectionSilent();
}

// Setup Sidebar Tabs
function setupTabs() {
  elements.navItems.forEach((item) => {
    item.addEventListener('click', () => {
      elements.navItems.forEach((nav) => nav.classList.remove('active'));
      elements.tabPanels.forEach((panel) => panel.classList.remove('active'));

      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      if (tabId) {
        document.getElementById(tabId)?.classList.add('active');
        if (tabId === 'tab-history') {
          loadHistory();
        }
      }
    });
  });
}

// Setup theme switcher (Dark/Light)
function setupTheme() {
  // Load saved theme or match system
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'light');
  }

  elements.themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

// Bind event listeners
function setupEventListeners() {
  // Confidence slider value label
  elements.confidenceThreshold.addEventListener('input', () => {
    elements.thresholdVal.textContent = `${elements.confidenceThreshold.value}%`;
  });

  // Save Settings button
  elements.btnSave.addEventListener('click', saveSettings);

  // Restore Defaults button
  elements.btnReset.addEventListener('click', restoreDefaults);

  // Connection Test button
  elements.btnTestConn.addEventListener('click', testConnection);

  // Open Web UI helper
  elements.btnOpenQb.addEventListener('click', () => {
    window.open(elements.qbUrl.value, '_blank');
  });

  // Accept SSL Exception help button
  elements.btnSslHelp.addEventListener('click', () => {
    window.open(elements.qbUrl.value, '_blank');
  });

  // Export settings trigger
  elements.btnExport.addEventListener('click', exportSettings);

  // Import settings trigger
  elements.btnTriggerImport.addEventListener('click', () => {
    elements.importFile.click();
  });
  elements.importFile.addEventListener('change', importSettings);

  // Clear All History trigger
  elements.btnClearAllHistory.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all routing history? Active downloads will not be affected.')) {
      try {
        const response = await browser.runtime.sendMessage({
          action: 'clearHistory',
          clearAll: true
        });
        if (response && response.success) {
          await loadHistory();
        } else {
          alert('Failed to clear history.');
        }
      } catch (err: any) {
        alert(`Error clearing history: ${err.message}`);
      }
    }
  });
}

// Load configurations from storage
async function loadCurrentSettings() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'getSettings' });
    if (response && response.success && response.settings) {
      const s = response.settings as RouterSettings;
      globalSettings = s;

      // Connection
      elements.qbUrl.value = s.qbUrl || '';
      elements.qbUsername.value = s.qbUsername || '';
      elements.qbPassword.value = s.qbPassword || '';
      elements.qbApiKey.value = s.qbApiKey || '';
      if (s.qbUrl) {
        elements.btnOpenQb.style.display = 'inline-flex';
      }

      // Behavior
      elements.confidenceThreshold.value = String(Math.round(s.confidenceThreshold * 100));
      elements.thresholdVal.textContent = `${elements.confidenceThreshold.value}%`;
      elements.pollInterval.value = String(s.pollInterval || 2);
      elements.pollTimeout.value = String(s.pollTimeout || 300);
      elements.tempCategory.value = s.tempCategory || '__pending__';

      elements.notifyAuto.checked = s.notifyAuto !== false;
      elements.notifyPending.checked = s.notifyPending !== false;
      elements.notifyError.checked = s.notifyError !== false;
      elements.devLogs.checked = !!s.devLogs;

      // Category Mapping
      const map = s.categoryMapping || DEFAULT_MAPPING;
      elements.mapMovies.value = map.movies || 'movies';
      elements.mapSeries.value = map.series || 'series';
      elements.mapAnime.value = map.anime || 'anime';
      elements.mapMusic.value = map.music || 'music';
      elements.mapGames.value = map.games || 'games';
      elements.mapBooks.value = map.books || 'books';
      elements.mapIso.value = map.iso || 'iso';
      elements.mapSoftware.value = map.software || 'software';
      elements.mapOther.value = map.other || 'other';

      // Integrations
      elements.tmdbKey.value = s.tmdbApiKey || '';
      elements.anilistEnabled.checked = s.anilistEnabled !== false;


    }
  } catch (err) {
    console.error('Failed to load settings in options page:', err);
    showResultBanner(elements.connTestResult, 'Failed to fetch settings from background script.', false);
  }
}

// Test current connection without flashing the alert banner (silent checks)
async function testCurrentConnectionSilent() {
  const url = elements.qbUrl.value;
  if (!url) return;

  updateConnectionBadge('connecting', 'Connecting...');

  try {
    const res = await browser.runtime.sendMessage({
      action: 'testConnection',
      config: {
        url,
        username: elements.qbUsername.value,
        password: elements.qbPassword.value,
        apiKey: elements.qbApiKey.value,
      },
    });

    if (res && res.success) {
      updateConnectionBadge('connected', 'Connected');
    } else {
      updateConnectionBadge('error', 'Offline');
    }
  } catch {
    updateConnectionBadge('error', 'Error');
  }
}

// Update upper header badge status
function updateConnectionBadge(status: 'connected' | 'connecting' | 'error', text: string) {
  elements.connDot.className = 'status-dot';
  if (status === 'connected') {
    elements.connDot.classList.add('connected');
  } else if (status === 'error') {
    elements.connDot.classList.add('error');
  }
  elements.connText.textContent = text;
}

// Perform active Web UI connectivity tests
async function testConnection() {
  const url = elements.qbUrl.value.trim();
  if (!url) {
    showResultBanner(elements.connTestResult, 'qBittorrent Web UI URL is required.', false);
    return;
  }

  elements.btnTestConn.disabled = true;
  elements.btnTestConn.textContent = 'Testing...';
  elements.connTestResult.style.display = 'none';

  try {
    const res = await browser.runtime.sendMessage({
      action: 'testConnection',
      config: {
        url,
        username: elements.qbUsername.value,
        password: elements.qbPassword.value,
        apiKey: elements.qbApiKey.value,
      },
    });

    if (res && res.success) {
      const verText = res.version ? ` (WebAPI v${res.version})` : '';
      showResultBanner(elements.connTestResult, `Connection successful! qBittorrent responds${verText}.`, true);
      updateConnectionBadge('connected', 'Connected');
      elements.btnOpenQb.style.display = 'inline-flex';
    } else {
      const err = res.error || 'Server returned empty/non-OK status.';
      showResultBanner(elements.connTestResult, `Connection failed: ${err}`, false);
      updateConnectionBadge('error', 'Offline');
    }
  } catch (err: any) {
    showResultBanner(elements.connTestResult, `Connection error: ${err.message || err}`, false);
    updateConnectionBadge('error', 'Error');
  } finally {
    elements.btnTestConn.disabled = false;
    elements.btnTestConn.textContent = 'Test Connection';
  }
}

// Compile inputs and send to storage
async function saveSettings() {
  elements.btnSave.disabled = true;
  elements.btnSave.textContent = 'Saving...';

  let currentEnabled = true;
  try {
    const settingsResponse = await browser.runtime.sendMessage({ action: 'getSettings' });
    if (settingsResponse && settingsResponse.success && settingsResponse.settings) {
      currentEnabled = settingsResponse.settings.enabled !== false;
    }
  } catch (err) {
    console.error('Failed to get current enabled status before saving settings:', err);
  }

  const newSettings: RouterSettings = {
    enabled: currentEnabled,
    qbUrl: elements.qbUrl.value.trim(),
    qbUsername: elements.qbUsername.value.trim(),
    qbPassword: elements.qbPassword.value.trim(),
    qbApiKey: elements.qbApiKey.value.trim(),
    tempCategory: elements.tempCategory.value.trim() || '__pending__',
    confidenceThreshold: parseInt(elements.confidenceThreshold.value, 10) / 100,
    pollInterval: parseInt(elements.pollInterval.value, 10) || 2,
    pollTimeout: parseInt(elements.pollTimeout.value, 10) || 300,
    notifyAuto: elements.notifyAuto.checked,
    notifyPending: elements.notifyPending.checked,
    notifyError: elements.notifyError.checked,
    devLogs: elements.devLogs.checked,
    categoryMapping: {
      movies: elements.mapMovies.value.trim() || 'movies',
      series: elements.mapSeries.value.trim() || 'series',
      anime: elements.mapAnime.value.trim() || 'anime',
      music: elements.mapMusic.value.trim() || 'music',
      games: elements.mapGames.value.trim() || 'games',
      books: elements.mapBooks.value.trim() || 'books',
      iso: elements.mapIso.value.trim() || 'iso',
      software: elements.mapSoftware.value.trim() || 'software',
      other: elements.mapOther.value.trim() || 'other',
    },
    tmdbApiKey: elements.tmdbKey.value.trim(),
    anilistEnabled: elements.anilistEnabled.checked,
  };

  try {
    const response = await browser.runtime.sendMessage({
      action: 'saveSettings',
      settings: newSettings,
    });

    if (response && response.success) {
      alert('Settings saved successfully!');
      if (newSettings.qbUrl) {
        elements.btnOpenQb.style.display = 'inline-flex';
      }
      await testCurrentConnectionSilent();
    } else {
      alert(`Failed to save settings: ${response.error || 'Unknown error'}`);
    }
  } catch (err: any) {
    alert(`Error saving settings: ${err.message}`);
  } finally {
    elements.btnSave.disabled = false;
    elements.btnSave.textContent = 'Save Settings';
  }
}

// Reset forms to defaults
async function restoreDefaults() {
  if (confirm('Are you sure you want to restore settings to defaults? This will overwrite your current connection details.')) {
    try {
      await browser.storage.local.remove('settings');
      await loadCurrentSettings();
      await testCurrentConnectionSilent();
      alert('Default settings restored.');
    } catch (err: any) {
      alert(`Failed to reset: ${err.message}`);
    }
  }
}

// Export Settings to JSON file
function exportSettings() {
  const currentSettings: RouterSettings = {
    enabled: globalSettings ? globalSettings.enabled !== false : true,
    qbUrl: elements.qbUrl.value.trim(),
    qbUsername: elements.qbUsername.value.trim(),
    qbPassword: elements.qbPassword.value.trim(),
    qbApiKey: elements.qbApiKey.value.trim(),
    tempCategory: elements.tempCategory.value.trim() || '__pending__',
    confidenceThreshold: parseInt(elements.confidenceThreshold.value, 10) / 100,
    pollInterval: parseInt(elements.pollInterval.value, 10) || 2,
    pollTimeout: parseInt(elements.pollTimeout.value, 10) || 300,
    notifyAuto: elements.notifyAuto.checked,
    notifyPending: elements.notifyPending.checked,
    notifyError: elements.notifyError.checked,
    devLogs: elements.devLogs.checked,
    categoryMapping: {
      movies: elements.mapMovies.value.trim() || 'movies',
      series: elements.mapSeries.value.trim() || 'series',
      anime: elements.mapAnime.value.trim() || 'anime',
      music: elements.mapMusic.value.trim() || 'music',
      games: elements.mapGames.value.trim() || 'games',
      books: elements.mapBooks.value.trim() || 'books',
      iso: elements.mapIso.value.trim() || 'iso',
      software: elements.mapSoftware.value.trim() || 'software',
      other: elements.mapOther.value.trim() || 'other',
    },
    tmdbApiKey: elements.tmdbKey.value.trim(),
    anilistEnabled: elements.anilistEnabled.checked,
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentSettings, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', 'torrent_router_settings.json');
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Import Settings from JSON file upload
function importSettings(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  const reader = new FileReader();
  
  reader.onload = async (event) => {
    try {
      const content = event.target?.result as string;
      const parsed = JSON.parse(content) as Partial<RouterSettings>;

      if (parsed.qbUrl === undefined || parsed.categoryMapping === undefined) {
        throw new Error('Invalid settings JSON format. Missing key parameters.');
      }

      // Save to background
      const res = await browser.runtime.sendMessage({
        action: 'saveSettings',
        settings: parsed,
      });

      if (res && res.success) {
        showResultBanner(elements.importResult, 'Settings imported successfully!', true);
        await loadCurrentSettings();
        await testCurrentConnectionSilent();
      } else {
        throw new Error(res.error || 'Failed to apply parsed configuration.');
      }
    } catch (err: any) {
      showResultBanner(elements.importResult, `Import failed: ${err.message}`, false);
    }
  };

  reader.readAsText(file);
}

// UI helper to flash results
function showResultBanner(banner: HTMLDivElement, text: string, isSuccess: boolean) {
  banner.style.display = 'block';
  banner.style.padding = '0.75rem 1rem';
  banner.style.borderRadius = '8px';
  banner.style.fontSize = '0.9rem';
  banner.style.fontWeight = '500';
  banner.style.marginTop = '1rem';
  banner.textContent = text;

  if (isSuccess) {
    banner.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
    banner.style.color = 'var(--success)';
    banner.style.border = '1px solid rgba(16, 185, 129, 0.3)';
  } else {
    banner.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
    banner.style.color = 'var(--danger)';
    banner.style.border = '1px solid rgba(244, 63, 94, 0.3)';
  }
}

// Run
document.addEventListener('DOMContentLoaded', init);

// Category options (same as popup list)
const CATEGORY_OPTIONS = [
  { value: 'movies', label: 'Movies' },
  { value: 'series', label: 'Series' },
  { value: 'anime', label: 'Anime' },
  { value: 'music', label: 'Music' },
  { value: 'games', label: 'Games' },
  { value: 'books', label: 'Books' },
  { value: 'iso', label: 'ISO' },
  { value: 'software', label: 'Software' },
  { value: 'other', label: 'Other' },
];

// Category options (same as popup list)

async function loadHistory() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'getJobs' });
    const settingsResponse = await browser.runtime.sendMessage({ action: 'getSettings' });
    if (settingsResponse && settingsResponse.success) {
      globalSettings = settingsResponse.settings;
    }
    
    if (response && response.success) {
      renderHistory(response.jobs);
    }
  } catch (err) {
    console.error('Failed to load history in options page:', err);
  }
}

function renderHistory(jobs: any[]) {
  if (!jobs || jobs.length === 0) {
    elements.historyContainer.innerHTML = `
      <div class="no-jobs" style="text-align: center; color: var(--text-muted); padding: 3rem 1rem; border: 1px dashed var(--border-color); border-radius: 12px; grid-column: 1 / -1;">
        No history entries recorded yet.
      </div>
    `;
    return;
  }

  // Sort by addedTime descending
  const sortedJobs = [...jobs].sort((a, b) => b.addedTime - a.addedTime);

  elements.historyContainer.innerHTML = '';

  sortedJobs.forEach((job) => {
    const item = document.createElement('div');
    item.className = 'activity-item';

    let badgeClass = 'badge-info';
    let statusText = job.status;
    if (job.status === 'completed') {
      badgeClass = 'badge-success';
      statusText = job.category || 'routed';
    } else if (job.status === 'failed') {
      badgeClass = 'badge-danger';
      statusText = 'failed';
    } else if (job.status === 'pending_user') {
      badgeClass = 'badge-warning';
      statusText = 'pending choice';
    } else if (job.status === 'pending_metadata') {
      badgeClass = 'badge-info';
      statusText = 'polling metadata';
    }

    const typeLabel = job.type === 'magnet' ? 'magnet' : 'torrent file';
    const dateStr = new Date(job.addedTime).toLocaleString();

    // Determine current dropdown value
    let selectedVal = 'other';
    if (globalSettings && globalSettings.categoryMapping) {
      for (const [key, val] of Object.entries(globalSettings.categoryMapping)) {
        if (val === job.category || key === job.category) {
          selectedVal = key;
          break;
        }
      }
    }

    let selectOptionsHtml = CATEGORY_OPTIONS.map((opt) => {
      const selectedAttr = opt.value === selectedVal ? 'selected' : '';
      return `<option value="${opt.value}" ${selectedAttr}>${opt.label}</option>`;
    }).join('');

    item.innerHTML = `
      <div class="info">
        <div class="title" style="font-weight: 600; color: var(--text-primary);" title="${job.name}">${job.name}</div>
        <div class="meta" style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
          <span class="badge ${badgeClass}">${statusText}</span>
          <span>•</span>
          <span>${typeLabel}</span>
          <span>•</span>
          <span>${dateStr}</span>
        </div>
      </div>
      <div class="action-col" style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
        <span style="font-size: 0.8rem; color: var(--text-secondary);">Category:</span>
        <select class="select-control history-select-category" data-hash="${job.hash}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background-color: rgba(11,15,25,0.6); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; outline: none;">
          ${selectOptionsHtml}
        </select>
      </div>
    `;

    elements.historyContainer.appendChild(item);
  });

  // Bind change listeners to history category dropdowns
  document.querySelectorAll('.history-select-category').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const hash = (e.currentTarget as HTMLSelectElement).dataset.hash;
      if (!hash) return;

      const category = (e.currentTarget as HTMLSelectElement).value;
      (e.currentTarget as HTMLSelectElement).disabled = true;

      try {
        const res = await browser.runtime.sendMessage({
          action: 'resolveJob',
          hash,
          category,
        });

        if (res && res.success) {
          await loadHistory();
        } else {
          alert('Failed to update category.');
          (e.currentTarget as HTMLSelectElement).disabled = false;
        }
      } catch (err: any) {
        alert(`Error updating category: ${err.message}`);
        (e.currentTarget as HTMLSelectElement).disabled = false;
      }
    });
  });
}
