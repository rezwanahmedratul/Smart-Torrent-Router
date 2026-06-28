import { ActiveJob, RouterSettings } from '../background/index';

// DOM Elements
const elements = {
  connBadge: document.getElementById('conn-badge') as HTMLDivElement,
  connDot: document.getElementById('conn-dot') as HTMLSpanElement,
  connText: document.getElementById('conn-text') as HTMLSpanElement,
  connWarn: document.getElementById('conn-warn') as HTMLDivElement,
  btnGoSettings: document.getElementById('btn-go-settings') as HTMLButtonElement,

  magnetUrl: document.getElementById('magnet-url') as HTMLTextAreaElement,
  btnSendMagnet: document.getElementById('btn-send-magnet') as HTMLButtonElement,
  sendResult: document.getElementById('send-result') as HTMLDivElement,

  jobsContainer: document.getElementById('jobs-container') as HTMLDivElement,
  btnClearHistory: document.getElementById('btn-clear-history') as HTMLSpanElement,
  btnOpenOptions: document.getElementById('btn-open-options') as HTMLSpanElement,

  dropZone: document.getElementById('drop-zone') as HTMLDivElement,
  torrentFileInput: document.getElementById('torrent-file-input') as HTMLInputElement,
  uploadResult: document.getElementById('upload-result') as HTMLDivElement,
  extensionToggle: document.getElementById('extension-toggle') as HTMLInputElement,
};

let settings: RouterSettings | null = null;
let currentJobs: ActiveJob[] = [];
let pollIntervalId: any = null;
let lastJobsState = '';
let connCheckCounter = 0;

// Categories for dropdown
const CATEGORY_OPTIONS = [
  { value: 'movies', label: 'Movies' },
  { value: 'series', label: 'Series' },
  { value: 'anime', label: 'Anime' },
  { value: 'music', label: 'Music' },
  { value: 'games', label: 'Games' },
  { value: 'books', label: 'Books' },
  { value: 'iso', label: 'ISO' },
  { value: 'software', label: 'Software' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'other', label: 'Other' },
];

async function init() {
  setupEventListeners();
  await refreshState();
  
  // Start polling state every 1.5 seconds while popup is open
  pollIntervalId = setInterval(refreshState, 1500);
}

function updateExtensionActiveLabel(enabled: boolean) {
  const label = document.querySelector('.switch-label');
  if (label) {
    label.textContent = enabled ? 'Active' : 'Disabled';
  }
}

function setupEventListeners() {
  // Extension toggle checkbox
  elements.extensionToggle.addEventListener('change', async () => {
    if (!settings) return;
    settings.enabled = elements.extensionToggle.checked;
    try {
      await browser.runtime.sendMessage({
        action: 'saveSettings',
        settings: settings
      });
      updateExtensionActiveLabel(settings.enabled);
    } catch (e) {
      console.error('Failed to toggle extension:', e);
    }
  });

  // Clear history button
  elements.btnClearHistory.addEventListener('click', async () => {
    try {
      await browser.runtime.sendMessage({ action: 'clearHistory' });
      await refreshState();
    } catch (e) {
      console.error(e);
    }
  });

  // Open settings buttons
  elements.btnOpenOptions.addEventListener('click', openOptionsPage);
  elements.btnGoSettings.addEventListener('click', openOptionsPage);

  // Send magnet link
  elements.btnSendMagnet.addEventListener('click', sendMagnetLink);

  // File drop zone clicks
  elements.dropZone.addEventListener('click', () => {
    elements.torrentFileInput.click();
  });

  elements.torrentFileInput.addEventListener('change', () => {
    const files = elements.torrentFileInput.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  });

  // Drag and drop events
  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
  });

  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragover');
  });

  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  });
}

function handleFileSelect(file: File) {
  if (!file.name.endsWith('.torrent')) {
    showUploadResult('Only .torrent files are allowed!', false);
    return;
  }

  showUploadResult('Processing file...', true);
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        throw new Error('Could not read file data.');
      }
      
      const buffer = new Uint8Array(arrayBuffer);
      const res = await browser.runtime.sendMessage({
        action: 'addTorrentFile',
        buffer: buffer,
        filename: file.name,
      });

      if (res && res.success) {
        showUploadResult(`Successfully uploaded: ${file.name}`, true);
        await refreshState();
      } else {
        showUploadResult(`Upload failed: ${res.error || 'Unknown error'}`, false);
      }
    } catch (err: any) {
      showUploadResult(`Error uploading: ${err.message}`, false);
    }
  };
  
  reader.onerror = () => {
    showUploadResult('Error reading file.', false);
  };
  
  reader.readAsArrayBuffer(file);
}

function showUploadResult(text: string, isSuccess: boolean) {
  elements.uploadResult.style.display = 'block';
  elements.uploadResult.textContent = text;
  elements.uploadResult.style.color = isSuccess ? 'var(--success)' : 'var(--danger)';
  
  // Reset drop zone text or result after 4 seconds
  setTimeout(() => {
    elements.uploadResult.style.display = 'none';
  }, 4000);
}

function openOptionsPage() {
  browser.runtime.openOptionsPage().then(() => window.close());
}

async function refreshState() {
  try {
    // 1. Fetch settings (we need mapping, URL)
    const settingsResponse = await browser.runtime.sendMessage({ action: 'getSettings' });
    if (settingsResponse && settingsResponse.success) {
      settings = settingsResponse.settings;
      if (settings) {
        elements.extensionToggle.checked = settings.enabled !== false;
        updateExtensionActiveLabel(settings.enabled);
      }
    }

    // 2. Test qBittorrent connection (throttled every 10 refresh cycles to avoid overhead)
    if (settings) {
      if (connCheckCounter === 0 || connCheckCounter % 10 === 0) {
        const res = await browser.runtime.sendMessage({
          action: 'testConnection',
          config: {
            url: settings.qbUrl,
            username: settings.qbUsername,
            password: settings.qbPassword,
            apiKey: settings.qbApiKey,
          },
        });

        if (res && res.success) {
          updateConnectionBadge('connected', 'Connected');
          elements.connWarn.style.display = 'none';
        } else {
          updateConnectionBadge('error', 'Offline');
          elements.connWarn.style.display = 'block';
        }
      }
      connCheckCounter++;
    } else {
      updateConnectionBadge('error', 'Unconfigured');
      elements.connWarn.style.display = 'block';
    }

    // 3. Get active jobs list
    const jobsResponse = await browser.runtime.sendMessage({ action: 'getJobs' });
    if (jobsResponse && jobsResponse.success) {
      currentJobs = jobsResponse.jobs;
      renderJobs();
    }
  } catch (err) {
    console.error('Popup refresh error:', err);
    updateConnectionBadge('error', 'Error');
  }
}

function updateConnectionBadge(status: 'connected' | 'error', text: string) {
  elements.connDot.className = 'status-dot';
  if (status === 'connected') {
    elements.connDot.classList.add('connected');
  } else if (status === 'error') {
    elements.connDot.classList.add('error');
  }
  elements.connText.textContent = text;
}

// Render the active and historical jobs list
function renderJobs() {
  // Capture current dropdown values in UI before wipe-out so user doesn't lose current selects
  const selectedCategories = new Map<string, string>();
  document.querySelectorAll('.select-control').forEach((selectEl) => {
    const hash = (selectEl as HTMLSelectElement).dataset.hash;
    if (hash) {
      selectedCategories.set(hash, (selectEl as HTMLSelectElement).value);
    }
  });

  // Capture open file lists
  const openFileLists = new Set<string>();
  document.querySelectorAll('.file-list-container.open').forEach((container) => {
    const hash = (container as HTMLDivElement).dataset.hash;
    if (hash) {
      openFileLists.add(hash);
    }
  });

  if (currentJobs.length === 0) {
    if (lastJobsState !== '') {
      elements.jobsContainer.innerHTML = '<div class="no-jobs">No recent router activity</div>';
      lastJobsState = '';
    }
    return;
  }

  // Sort: pending actions first, then active polling, then newest first
  const sortedJobs = [...currentJobs].sort((a, b) => {
    const scoreMap = {
      pending_user: 4,
      pending_metadata: 3,
      classifying: 2,
      completed: 1,
      failed: 0,
    };
    const diff = scoreMap[b.status] - scoreMap[a.status];
    if (diff !== 0) return diff;
    return b.addedTime - a.addedTime;
  });

  // Keep only the 5 most recent entries
  const recentJobs = sortedJobs.slice(0, 5);

  // Check if jobs state changed to avoid blinking/reflows
  const jobsState = recentJobs.map(j => `${j.hash}:${j.status}:${j.name}:${j.category || ''}`).join('|');
  if (jobsState === lastJobsState) {
    return; // Skip rendering to preserve local dropdown/collapsible states and prevent flashes
  }
  lastJobsState = jobsState;

  elements.jobsContainer.innerHTML = '';

  recentJobs.forEach((job) => {
    const card = document.createElement('div');
    card.className = 'job-card';
    card.dataset.hash = job.hash;

    // Use a static, safe HTML skeleton literal
    card.innerHTML = `
      <div class="header-row">
        <div class="title-col">
          <div class="name"></div>
          <div class="meta">
            <span class="badge"></span>
            <span>•</span>
            <span class="type-label"></span>
          </div>
        </div>
        <div class="status-col"></div>
      </div>
      <div class="extra-panel"></div>
    `;

    // 1. Populate details safely
    const nameEl = card.querySelector('.name') as HTMLDivElement;
    nameEl.textContent = job.name;
    nameEl.title = job.name;

    const badgeEl = card.querySelector('.badge') as HTMLSpanElement;
    const typeLabelEl = card.querySelector('.type-label') as HTMLSpanElement;
    typeLabelEl.textContent = job.type === 'magnet' ? 'magnet' : 'torrent file';

    const statusCol = card.querySelector('.status-col') as HTMLDivElement;

    // Status styling
    let badgeClass = 'badge-info';
    let statusText = '';

    if (job.status === 'pending_metadata') {
      badgeClass = 'badge-info';
      statusText = 'Polling Metadata';
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      statusCol.appendChild(spinner);
    } else if (job.status === 'classifying') {
      badgeClass = 'badge-info';
      statusText = 'Classifying';
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      statusCol.appendChild(spinner);
    } else if (job.status === 'completed') {
      badgeClass = 'badge-success';
      statusText = job.category || 'completed';
      const checkSpan = document.createElement('span');
      checkSpan.style.color = 'var(--success)';
      checkSpan.style.fontWeight = 'bold';
      checkSpan.style.fontSize = '0.9rem';
      checkSpan.textContent = '✓';
      statusCol.appendChild(checkSpan);
    } else if (job.status === 'failed') {
      badgeClass = 'badge-danger';
      statusText = 'Failed';
      const crossSpan = document.createElement('span');
      crossSpan.style.color = 'var(--danger)';
      crossSpan.style.fontSize = '0.8rem';
      crossSpan.textContent = '✕';
      statusCol.appendChild(crossSpan);
    } else if (job.status === 'pending_user') {
      badgeClass = 'badge-warning';
      statusText = 'Needs Category';
    }

    badgeEl.textContent = statusText;
    badgeEl.className = `badge ${badgeClass}`;

    // 2. Extra panels (low confidence selectors / errors)
    const extraPanel = card.querySelector('.extra-panel') as HTMLDivElement;

    if (job.status === 'pending_user') {
      const suggestedVal = job.suggestedCategory || 'other';
      const selectedVal = selectedCategories.get(job.hash) || suggestedVal;

      const resolvePanel = document.createElement('div');
      resolvePanel.className = 'resolve-panel';

      const descP = document.createElement('p');
      descP.innerHTML = 'Confidence was low. Suggested: <strong></strong>';
      descP.querySelector('strong')!.textContent = `${suggestedVal} (${Math.round((job.confidence || 0) * 100)}%)`;
      resolvePanel.appendChild(descP);

      const selectRow = document.createElement('div');
      selectRow.className = 'select-row';

      const selectEl = document.createElement('select');
      selectEl.className = 'select-control';
      selectEl.dataset.hash = job.hash;

      CATEGORY_OPTIONS.forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === selectedVal) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });
      selectRow.appendChild(selectEl);

      const btnResolve = document.createElement('button');
      btnResolve.className = 'btn btn-primary btn-small btn-resolve';
      btnResolve.dataset.hash = job.hash;
      btnResolve.textContent = 'Resume';
      selectRow.appendChild(btnResolve);

      resolvePanel.appendChild(selectRow);

      // Build file tree list if cached
      if (job.files && job.files.length > 0) {
        const isOpen = openFileLists.has(job.hash);
        
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'file-list-toggle';
        toggleDiv.dataset.hash = job.hash;
        toggleDiv.textContent = `📁 View Torrent Files (${job.files.length})`;
        resolvePanel.appendChild(toggleDiv);

        const containerDiv = document.createElement('div');
        containerDiv.className = `file-list-container ${isOpen ? 'open' : ''}`;
        containerDiv.dataset.hash = job.hash;
        if (isOpen) {
          containerDiv.style.display = 'block';
        }

        job.files.forEach((f) => {
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          fileItem.title = f.path;
          const fileName = f.path.split('/').pop() || '';
          fileItem.textContent = `${fileName} (${formatSize(f.size)})`;
          containerDiv.appendChild(fileItem);
        });

        resolvePanel.appendChild(containerDiv);
      }

      extraPanel.appendChild(resolvePanel);
    }

    if (job.status === 'failed' && job.error) {
      const errDiv = document.createElement('div');
      errDiv.style.fontSize = '0.75rem';
      errDiv.style.color = 'var(--danger)';
      errDiv.style.borderTop = '1px solid rgba(255,255,255,0.05)';
      errDiv.style.paddingTop = '0.4rem';
      errDiv.style.marginTop = '0.4rem';
      errDiv.textContent = `Error: ${job.error}`;
      extraPanel.appendChild(errDiv);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      let selectedVal = 'other';
      if (settings && settings.categoryMapping) {
        for (const [key, val] of Object.entries(settings.categoryMapping)) {
          if (val === job.category || key === job.category) {
            selectedVal = key;
            break;
          }
        }
      }

      const selectRow = document.createElement('div');
      selectRow.className = 'category-select-row';
      selectRow.style.display = 'flex';
      selectRow.style.gap = '0.5rem';
      selectRow.style.alignItems = 'center';
      selectRow.style.marginTop = '0.4rem';
      selectRow.style.paddingTop = '0.4rem';
      selectRow.style.borderTop = '1px solid rgba(255,255,255,0.05)';

      const labelSpan = document.createElement('span');
      labelSpan.style.fontSize = '0.75rem';
      labelSpan.style.color = 'var(--text-secondary)';
      labelSpan.textContent = 'Category:';
      selectRow.appendChild(labelSpan);

      const selectEl = document.createElement('select');
      selectEl.className = 'select-control popup-select-category';
      selectEl.dataset.hash = job.hash;
      selectEl.style.padding = '0.15rem 0.4rem';
      selectEl.style.fontSize = '0.75rem';
      selectEl.style.width = '100%';

      CATEGORY_OPTIONS.forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === selectedVal) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });
      selectRow.appendChild(selectEl);

      extraPanel.appendChild(selectRow);
    }

    elements.jobsContainer.appendChild(card);
  });

  // Re-bind click event listeners on newly generated list items
  // 1. "Route & Resume" button click
  document.querySelectorAll('.btn-resolve').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const hash = (e.currentTarget as HTMLButtonElement).dataset.hash;
      if (!hash) return;

      const selectEl = document.querySelector(`.select-control[data-hash="${hash}"]`) as HTMLSelectElement;
      if (!selectEl) return;

      const category = selectEl.value;
      (e.currentTarget as HTMLButtonElement).disabled = true;
      (e.currentTarget as HTMLButtonElement).textContent = 'Routing...';

      try {
        const res = await browser.runtime.sendMessage({
          action: 'resolveJob',
          hash,
          category,
        });

        if (res && res.success) {
          await refreshState();
        } else {
          alert('Failed to resolve job.');
        }
      } catch (err: any) {
        alert(`Error resolving: ${err.message}`);
      }
    });
  });

  // 2. "View files" collapsible toggle
  document.querySelectorAll('.file-list-toggle').forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      const hash = (e.currentTarget as HTMLDivElement).dataset.hash;
      if (!hash) return;

      const container = document.querySelector(`.file-list-container[data-hash="${hash}"]`) as HTMLDivElement;
      if (!container) return;

      const isCurrentlyOpen = container.classList.contains('open');
      if (isCurrentlyOpen) {
        container.classList.remove('open');
        container.style.display = 'none';
      } else {
        container.classList.add('open');
        container.style.display = 'block';
      }
    });
  });

  // 3. Category Override select change
  document.querySelectorAll('.popup-select-category').forEach((select) => {
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
          await refreshState();
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

// Send manually pasted magnet link
async function sendMagnetLink() {
  const magnet = elements.magnetUrl.value.trim();
  if (!magnet) {
    showSendResult('Magnet link is empty!', false);
    return;
  }

  if (!magnet.startsWith('magnet:?')) {
    showSendResult('Invalid link format. Must start with magnet:?', false);
    return;
  }

  elements.btnSendMagnet.disabled = true;
  elements.btnSendMagnet.textContent = 'Sending...';
  elements.sendResult.style.display = 'none';

  try {
    const res = await browser.runtime.sendMessage({
      action: 'addMagnet',
      url: magnet,
    });

    if (res && res.success) {
      showSendResult('Magnet successfully sent to client!', true);
      elements.magnetUrl.value = '';
      await refreshState();
    } else {
      showSendResult(`Failed to add: ${res.error || 'Server error'}`, false);
    }
  } catch (err: any) {
    showSendResult(`Transmission error: ${err.message}`, false);
  } finally {
    elements.btnSendMagnet.disabled = false;
    elements.btnSendMagnet.textContent = 'Analyze & Send';
  }
}

// Display result message for magnet send action
function showSendResult(text: string, isSuccess: boolean) {
  elements.sendResult.style.display = 'block';
  elements.sendResult.textContent = text;
  if (isSuccess) {
    elements.sendResult.style.color = 'var(--success)';
  } else {
    elements.sendResult.style.color = 'var(--danger)';
  }

  // Clear notice after 4 seconds
  setTimeout(() => {
    elements.sendResult.style.display = 'none';
  }, 4000);
}

// Format bytes size to human readable text
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run
document.addEventListener('DOMContentLoaded', init);
