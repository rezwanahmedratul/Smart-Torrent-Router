import { QbittorrentClient, QbittorrentTorrent } from '../services/qbittorrent';
import { resolveClassification } from '../services/metadata';
import { parseTorrent } from '../utils/bencode';
import { TorrentFile, ClassifiedTorrent } from '../services/classifier';

// Settings interface
export interface RouterSettings {
  enabled: boolean;
  qbUrl: string;
  qbUsername?: string;
  qbPassword?: string;
  qbApiKey?: string;
  tempCategory: string;
  confidenceThreshold: number;
  pollInterval: number;
  pollTimeout: number;
  devLogs: boolean;
  notifyAuto: boolean;
  notifyPending: boolean;
  notifyError: boolean;
  categoryMapping: Record<string, string>;
  tmdbApiKey?: string;
  anilistEnabled: boolean;
}

// Active Job interface
export interface ActiveJob {
  hash: string;
  name: string;
  type: 'magnet' | 'file';
  status: 'pending_metadata' | 'classifying' | 'pending_user' | 'completed' | 'failed';
  addedTime: number;
  category?: string;
  suggestedCategory?: string;
  confidence?: number;
  error?: string;
  scores?: Record<string, number>;
  files?: { path: string; size: number }[];
}

const DEFAULT_SETTINGS: RouterSettings = {
  enabled: true,
  qbUrl: 'http://localhost:8080',
  qbUsername: 'admin',
  qbPassword: 'adminadmin',
  qbApiKey: '',
  tempCategory: '__pending__',
  confidenceThreshold: 0.8,
  pollInterval: 2,
  pollTimeout: 300,
  devLogs: true,
  notifyAuto: true,
  notifyPending: true,
  notifyError: true,
  categoryMapping: {
    movies: 'movies',
    series: 'series',
    anime: 'anime',
    music: 'music',
    games: 'games',
    books: 'books',
    iso: 'iso',
    software: 'software',
    other: 'other',
  },
  tmdbApiKey: '',
  anilistEnabled: true,
};

let settings: RouterSettings = { ...DEFAULT_SETTINGS };
let activeJobs: Map<string, ActiveJob> = new Map();
let pollIntervalId: any = null;
const allowedDownloads = new Set<string>();

// Initialize Background Script
async function init() {
  console.log('[Background] Initializing Smart Torrent Router...');
  await loadSettings();
  await loadJobs();

  setupContextMenus();
  setupListeners();
  startPollingLoop();
}

// Load settings from storage
async function loadSettings() {
  try {
    const data = await browser.storage.local.get('settings');
    if (data && data.settings) {
      settings = { ...DEFAULT_SETTINGS, ...data.settings };
      settings.enabled = settings.enabled !== false;
      // Migrate old categories to new ones if they exist in categoryMapping
      if (settings.categoryMapping) {
        let migrated = false;
        if ('tv' in settings.categoryMapping) {
          settings.categoryMapping.series = settings.categoryMapping.tv;
          delete settings.categoryMapping.tv;
          migrated = true;
        }
        if ('linux' in settings.categoryMapping) {
          settings.categoryMapping.iso = settings.categoryMapping.linux;
          delete settings.categoryMapping.linux;
          migrated = true;
        }
        if (migrated) {
          await browser.storage.local.set({ settings });
          logDev('Migrated legacy category mapping keys to series/iso:', settings.categoryMapping);
        }
      }
      logDev('Settings loaded:', settings);
    } else {
      await browser.storage.local.set({ settings });
      logDev('Default settings saved:', settings);
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Save settings to storage
async function saveSettings(newSettings: RouterSettings) {
  // Preserve enabled field if not explicitly provided in newSettings
  const wasEnabled = settings.enabled;
  settings = { ...DEFAULT_SETTINGS, ...newSettings };
  if (newSettings.enabled === undefined) {
    settings.enabled = wasEnabled;
  }
  await browser.storage.local.set({ settings });
  logDev('Settings updated:', settings);
  setupContextMenus();
  // Restart polling loop to pick up new intervals
  startPollingLoop();
}

// Load jobs from storage (for persistence)
async function loadJobs() {
  try {
    const data = await browser.storage.local.get('activeJobs');
    if (data && data.activeJobs) {
      activeJobs = new Map(Object.entries(data.activeJobs));
      logDev(`Loaded ${activeJobs.size} jobs from storage.`);
    }
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

// Save jobs to storage
async function saveJobs() {
  try {
    const obj = Object.fromEntries(activeJobs);
    await browser.storage.local.set({ activeJobs: obj });
  } catch (err) {
    console.error('Failed to save jobs:', err);
  }
}

// Developer Logging
function logDev(...args: any[]) {
  if (settings.devLogs) {
    console.log('[SmartTorrentRouter Dev]', ...args);
  }
}

// Setup right-click context menu
function setupContextMenus() {
  browser.contextMenus.removeAll().then(() => {
    if (!settings.enabled) {
      logDev('Context menus cleared (extension disabled).');
      return;
    }
    browser.contextMenus.create({
      id: 'smart-download',
      title: 'Smart Download with Torrent Router',
      contexts: ['link'],
      targetUrlPatterns: ['*://*/*.torrent*', 'magnet:*'],
    });
    logDev('Context menus registered.');
  });
}

// Start polling loop
function startPollingLoop() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
  }

  const intervalMs = settings.pollInterval * 1000;
  pollIntervalId = setInterval(pollJobs, intervalMs);
  logDev(`Polling loop started (interval: ${settings.pollInterval}s).`);
}

// Get qBittorrent Client Instance
function getQbClient(): QbittorrentClient {
  return new QbittorrentClient({
    url: settings.qbUrl,
    username: settings.qbUsername,
    password: settings.qbPassword,
    apiKey: settings.qbApiKey,
  });
}

// Polling Logic
async function pollJobs() {
  const pendingJobs = Array.from(activeJobs.values()).filter(
    (j) => j.status === 'pending_metadata'
  );
  if (pendingJobs.length === 0) return;

  logDev(`Polling ${pendingJobs.length} jobs for metadata...`);
  const client = getQbClient();

  for (const job of pendingJobs) {
    try {
      // 1. Get torrent info from qBittorrent
      const torrentInfo = await client.getTorrentInfo(job.hash);
      if (!torrentInfo) {
        // Torrent was deleted from client
        job.status = 'failed';
        job.error = 'Torrent not found in qBittorrent (possibly deleted).';
        await saveJobs();
        showNotification(job.hash, 'Error', `Torrent "${job.name}" deleted from server.`, settings.notifyError);
        continue;
      }

      // Update name if it changed from the hash to the actual torrent name
      if (torrentInfo.name && torrentInfo.name !== job.hash && job.name === 'Retrieving Name...') {
        job.name = torrentInfo.name;
        await saveJobs();
      }

      // 2. Try fetching the file list to check if metadata exists
      let filesList: any[] = [];
      try {
        filesList = await client.getTorrentFiles(job.hash);
      } catch (fileErr) {
        logDev(`Could not read files for ${job.hash} (no metadata yet).`);
      }

      const hasMetadata = filesList && filesList.length > 0;

      if (hasMetadata) {
        logDev(`Metadata downloaded for: ${job.name}. Starting classification...`);
        job.status = 'classifying';
        await saveJobs();

        // Convert file list for classifier
        const classifierFiles: TorrentFile[] = filesList.map((f) => ({
          path: f.name,
          size: f.size,
        }));

        // 3. Resolve classification (offline + optional online lookup)
        const classification = await resolveClassification(job.name, classifierFiles, {
          tmdbApiKey: settings.tmdbApiKey,
          anilistEnabled: settings.anilistEnabled,
          confidenceThreshold: settings.confidenceThreshold,
        });

        // Save file cache inside job
        job.files = classifierFiles;
        job.scores = classification.scores;
        job.confidence = classification.confidence;

        const mappedCategory = settings.categoryMapping[classification.category] || classification.category;

        if (classification.confidence >= settings.confidenceThreshold) {
          // AUTO CLASSIFY & RESUME
          logDev(`High confidence (${classification.confidence * 100}%) for ${classification.category}. Auto routing.`);
          
          await client.setCategory(job.hash, mappedCategory);
          await client.resume(job.hash);

          job.status = 'completed';
          job.category = mappedCategory;
          await saveJobs();

          showNotification(
            job.hash,
            'Success',
            `Routed "${job.name}" to category "${mappedCategory}" and resumed.`,
            settings.notifyAuto
          );
        } else {
          // LOW CONFIDENCE - HOLD FOR USER
          logDev(`Low confidence (${classification.confidence * 100}%) for ${classification.category}. Holding.`);
          
          job.status = 'pending_user';
          job.suggestedCategory = classification.category;
          await saveJobs();

          showNotification(
            job.hash,
            'Pending Action',
            `Low confidence (${Math.round(classification.confidence * 100)}%) routing "${job.name}". Click to choose category.`,
            settings.notifyPending
          );
        }
      } else {
        // No metadata yet. Check for timeout
        const elapsed = (Date.now() - job.addedTime) / 1000;
        if (elapsed > settings.pollTimeout) {
          logDev(`Metadata polling timed out for ${job.name} after ${elapsed}s.`);
          job.status = 'failed';
          job.error = 'Metadata download timed out.';
          await saveJobs();

          showNotification(
            job.hash,
            'Error',
            `Failed to download metadata for "${job.name}" (Timeout).`,
            settings.notifyError
          );
        }
      }
    } catch (err: any) {
      console.error(`Error polling job ${job.hash}:`, err);
    }
  }
}

// Display Browser Notification
function showNotification(id: string, title: string, message: string, enabled: boolean) {
  if (!enabled) return;

  browser.notifications.create(id, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('icons/icon-48.png'),
    title: `Torrent Router - ${title}`,
    message: message,
  });
}

// Track newly added torrent hashes by diffing qBittorrent list before/after
async function addTorrentWithDiffTracking(
  client: QbittorrentClient,
  addFn: () => Promise<boolean>,
  type: 'magnet' | 'file',
  tempName = 'Retrieving Name...'
): Promise<string> {
  // 1. Get all hashes before
  let hashesBefore = new Set<string>();
  try {
    const listResponse = await fetch(`${settings.qbUrl}/api/v2/torrents/info`, { credentials: 'include' });
    if (listResponse.ok) {
      const list = await listResponse.json();
      hashesBefore = new Set(list.map((t: any) => t.hash));
    }
  } catch (e) {
    logDev('Could not fetch initial list for diff tracking:', e);
  }

  // 2. Perform the add command
  await addFn();

  // 3. Poll for the new hash (give qBittorrent a moment to register)
  for (let attempt = 1; attempt <= 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    try {
      const listResponse = await fetch(`${settings.qbUrl}/api/v2/torrents/info`, { credentials: 'include' });
      if (listResponse.ok) {
        const list = await listResponse.json();
        const newTorrent = list.find((t: any) => !hashesBefore.has(t.hash));
        if (newTorrent) {
          logDev(`Detected new torrent hash via diff: ${newTorrent.hash}`);
          
          // Create the job record
          const job: ActiveJob = {
            hash: newTorrent.hash,
            name: newTorrent.name || tempName,
            type,
            status: 'pending_metadata',
            addedTime: Date.now(),
          };
          activeJobs.set(newTorrent.hash, job);
          await saveJobs();

          return newTorrent.hash;
        }
      }
    } catch (e) {
      logDev('Diff tracking listing attempt failed:', e);
    }
  }

  throw new Error('Torrent added successfully, but router was unable to find its hash on the server.');
}

// Helper to convert base32 to hex (for legacy magnet links)
function base32ToHex(base32: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = '';
  let hex = '';
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i].toLowerCase());
    if (val === -1) return base32; // return original if invalid
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substring(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex;
}

// Handle magnet link add
async function handleAddMagnet(magnetUrl: string): Promise<string> {
  logDev('Adding magnet link:', magnetUrl);
  const client = getQbClient();

  // Extract hash from magnet if possible to see if we already track it
  let hashFromMagnet = '';
  const hashMatch = magnetUrl.match(/xt=urn:btih:([a-fA-F0-9]{32,40}|[a-zA-Z2-9]{32})/);
  if (hashMatch) {
    let rawHash = hashMatch[1].toLowerCase();
    if (rawHash.length === 32) {
      rawHash = base32ToHex(rawHash);
    }
    hashFromMagnet = rawHash;

    // 1. Check if we already track it in activeJobs
    if (activeJobs.has(hashFromMagnet)) {
      const job = activeJobs.get(hashFromMagnet)!;
      if (job.status !== 'failed') {
        logDev('Torrent is already tracked by the router.');
        return hashFromMagnet;
      }
    }

    // 2. Check if the server already has this torrent (prevents duplicate adding error)
    try {
      const info = await client.getTorrentInfo(hashFromMagnet);
      if (info) {
        logDev('Magnet link is already present on the qBittorrent server.');
        if (!activeJobs.has(hashFromMagnet)) {
          const job: ActiveJob = {
            hash: hashFromMagnet,
            name: info.name || 'Magnet Link',
            type: 'magnet',
            status: 'completed',
            addedTime: Date.now(),
            category: info.category,
          };
          activeJobs.set(hashFromMagnet, job);
          await saveJobs();
        }
        return hashFromMagnet;
      }
    } catch (e) {
      logDev('Error checking server for existing magnet hash:', e);
    }
  }

  const addFn = () =>
    client.addTorrent(magnetUrl, '', {
      paused: true,
      category: settings.tempCategory,
      tags: 'autoclassify',
      ratioLimit: 0,
      seedingTimeLimit: 0,
    });

  // If we could extract a hash, we can also query it directly, but diff is safe
  return await addTorrentWithDiffTracking(client, addFn, 'magnet');
}

// Handle downloaded .torrent file
async function handleTorrentFile(fileBuffer: Uint8Array, filename: string, requestUrl?: string): Promise<string> {
  logDev(`Processing downloaded torrent file: ${filename}`);

  // 1. Parse torrent file locally!
  let parsed;
  let shouldSeed = false;
  try {
    parsed = parseTorrent(fileBuffer);
    shouldSeed = isTorrentBd(requestUrl || '', parsed.announce, parsed.announceList);
  } catch (err) {
    console.error('Failed to parse torrent file buffer:', err);
    // If parsing fails, upload anyway and track via diff
    const client = getQbClient();
    const shouldSeedFallback = isTorrentBd(requestUrl || '');
    return await addTorrentWithDiffTracking(
      client,
      () =>
        client.addTorrent(fileBuffer, filename, {
          paused: true,
          category: settings.tempCategory,
          tags: 'autoclassify',
          ratioLimit: shouldSeedFallback ? -1 : 0,
          seedingTimeLimit: shouldSeedFallback ? -1 : 0,
        }),
      'file',
      filename
    );
  }

  const infoHash = await parsed.infoHashPromise;
  logDev(`Parsed infohash locally: ${infoHash}`);

  // Check if we are already tracking it
  if (activeJobs.has(infoHash)) {
    const job = activeJobs.get(infoHash)!;
    if (job.status !== 'failed') {
      logDev('Torrent file is already tracked.');
      return infoHash;
    }
  }

  // Check if the server already has this torrent (prevents duplicate adding error)
  const client = getQbClient();
  try {
    const info = await client.getTorrentInfo(infoHash);
    if (info) {
      logDev('Torrent file is already present on the qBittorrent server.');
      if (!activeJobs.has(infoHash)) {
        const job: ActiveJob = {
          hash: infoHash,
          name: info.name || parsed.name,
          type: 'file',
          status: 'completed',
          addedTime: Date.now(),
          category: info.category,
        };
        activeJobs.set(infoHash, job);
        await saveJobs();
      }
      return infoHash;
    }
  } catch (e) {
    logDev('Error checking server for existing torrent file hash:', e);
  }

  // Convert files list for classifier
  const classifierFiles: TorrentFile[] = parsed.files.map((f) => ({
    path: f.path.join('/'),
    size: f.length,
  }));

  // 2. Classify instantly! (No need to poll metadata!)
  const classification = await resolveClassification(parsed.name, classifierFiles, {
    tmdbApiKey: settings.tmdbApiKey,
    anilistEnabled: settings.anilistEnabled,
    confidenceThreshold: settings.confidenceThreshold,
  });

  const mappedCategory = settings.categoryMapping[classification.category] || classification.category;


  if (classification.confidence >= settings.confidenceThreshold) {
    // High confidence - upload directly to target category and start!
    logDev(`Parsed torrent classified instantly as "${classification.category}" with high confidence. Adding.`);
    
    // We upload with paused=false, category=mapped, tag=autoclassify
    await client.addTorrent(fileBuffer, filename, {
      paused: false,
      category: mappedCategory,
      tags: 'autoclassify',
      ratioLimit: shouldSeed ? -1 : 0,
      seedingTimeLimit: shouldSeed ? -1 : 0,
    });

    const job: ActiveJob = {
      hash: infoHash,
      name: parsed.name,
      type: 'file',
      status: 'completed',
      addedTime: Date.now(),
      category: mappedCategory,
      confidence: classification.confidence,
      scores: classification.scores,
      files: classifierFiles,
    };
    activeJobs.set(infoHash, job);
    await saveJobs();

    showNotification(
      infoHash,
      'Success',
      `Routed "${parsed.name}" to category "${mappedCategory}" instantly.`,
      settings.notifyAuto
    );
  } else {
    // Low confidence - upload paused to __pending__ and hold for user
    logDev(`Parsed torrent classified instantly as "${classification.category}" with LOW confidence. Holding.`);

    await client.addTorrent(fileBuffer, filename, {
      paused: true,
      category: settings.tempCategory,
      tags: 'autoclassify',
      ratioLimit: shouldSeed ? -1 : 0,
      seedingTimeLimit: shouldSeed ? -1 : 0,
    });

    const job: ActiveJob = {
      hash: infoHash,
      name: parsed.name,
      type: 'file',
      status: 'pending_user',
      addedTime: Date.now(),
      suggestedCategory: classification.category,
      confidence: classification.confidence,
      scores: classification.scores,
      files: classifierFiles,
    };
    activeJobs.set(infoHash, job);
    await saveJobs();

    showNotification(
      infoHash,
      'Pending Action',
      `Low confidence (${Math.round(classification.confidence * 100)}%) routing "${parsed.name}". Click to choose category.`,
      settings.notifyPending
    );
  }

  return infoHash;
}

// Check if server is online via a lightweight ping
async function checkServerOnline(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/v2/app/webapiVersion`, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'omit',
    });
    clearTimeout(timeoutId);
    return true; // Responding means online, even with 401/403
  } catch (err: any) {
    clearTimeout(timeoutId);
    return false;
  }
}



// Helper to identify if a response is a torrent
function isTorrentRequest(details: any): boolean {
  // Check URL ending
  const urlPath = details.url.split('?')[0];
  if (urlPath.endsWith('.torrent')) return true;

  // Check headers
  if (details.responseHeaders) {
    for (const header of details.responseHeaders) {
      const name = header.name.toLowerCase();
      const val = (header.value || '').toLowerCase();
      if (name === 'content-type' && (
        val.includes('application/x-bittorrent') ||
        val.includes('application/x-torrent') ||
        val.includes('application/torrent')
      )) {
        return true;
      }
      if (name === 'content-disposition' && val.includes('.torrent')) {
        return true;
      }
    }
  }
  return false;
}

// Helper to determine if a torrent comes from TorrentBD
function isTorrentBd(url: string, announce?: string, announceList?: string[]): boolean {
  const urlLower = (url || '').toLowerCase();
  if (urlLower.includes('torrentbd.net') || urlLower.includes('torrentbd.org') || urlLower.includes('torrentbd.me')) {
    return true;
  }
  const announceLower = (announce || '').toLowerCase();
  if (announceLower.includes('torrentbd.net') || announceLower.includes('torrentbd.org') || announceLower.includes('torrentbd.me')) {
    return true;
  }
  if (announceList) {
    for (const tracker of announceList) {
      const trackerLower = tracker.toLowerCase();
      if (trackerLower.includes('torrentbd.net') || trackerLower.includes('torrentbd.org') || trackerLower.includes('torrentbd.me')) {
        return true;
      }
    }
  }
  return false;
}

// User override callback from popup
async function handleUserResolve(hash: string, category: string): Promise<boolean> {
  const job = activeJobs.get(hash);
  if (!job) return false;

  logDev(`User resolved job ${job.name} to category "${category}"`);
  const client = getQbClient();

  try {
    const mappedCategory = settings.categoryMapping[category] || category;
    await client.setCategory(hash, mappedCategory);
    await client.resume(hash);

    job.status = 'completed';
    job.category = mappedCategory;
    await saveJobs();

    showNotification(hash, 'Success', `Routed "${job.name}" to category "${mappedCategory}" and resumed.`, settings.notifyAuto);
    return true;
  } catch (err) {
    console.error('Failed to set category from user resolve:', err);
    return false;
  }
}

// Clear Completed & Failed Job History
async function handleClearHistory(clearAll = false) {
  const keysToRemove: string[] = [];
  for (const [hash, job] of activeJobs.entries()) {
    if (clearAll) {
      // Keep actively processing ones
      if (job.status === 'pending_metadata' || job.status === 'classifying') {
        continue;
      }
      keysToRemove.push(hash);
    } else if (job.status === 'completed' || job.status === 'failed') {
      keysToRemove.push(hash);
    }
  }

  for (const hash of keysToRemove) {
    activeJobs.delete(hash);
  }

  await saveJobs();
  logDev(`Cleared ${keysToRemove.length} jobs. (clearAll: ${clearAll})`);
}

// Setup Event Listeners
// Setup Event Listeners
function setupListeners() {
  // Listen to runtime messages (Popup / Content Scripts)
  browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    logDev('Received message:', message);

    if (message.action === 'getSettings') {
      sendResponse({ success: true, settings });
    } else if (message.action === 'saveSettings') {
      saveSettings(message.settings)
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true; // Keep channel open async
    } else if (message.action === 'getJobs') {
      sendResponse({ success: true, jobs: Array.from(activeJobs.values()) });
    } else if (message.action === 'addMagnet') {
      handleAddMagnet(message.url)
        .then((hash) => sendResponse({ success: true, hash }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    } else if (message.action === 'addTorrentFile') {
      const buffer = message.buffer instanceof Uint8Array ? message.buffer : new Uint8Array(message.buffer);
      handleTorrentFile(buffer, message.filename)
        .then((hash) => sendResponse({ success: true, hash }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    } else if (message.action === 'resolveJob') {
      handleUserResolve(message.hash, message.category)
        .then((success) => sendResponse({ success }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    } else if (message.action === 'clearHistory') {
      handleClearHistory(!!message.clearAll)
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    } else if (message.action === 'testConnection') {
      const client = new QbittorrentClient({
        url: message.config.url,
        username: message.config.username,
        password: message.config.password,
        apiKey: message.config.apiKey,
      });
      client
        .testConnection()
        .then((res) => sendResponse(res))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    }
  });

  // Context menus clicks are still handled
  // Intercept context menu clicks
  browser.contextMenus.onClicked.addListener((info: any) => {
    if (info.menuItemId === 'smart-download' && info.linkUrl) {
      const linkUrl = info.linkUrl;
      if (linkUrl.startsWith('magnet:')) {
        handleAddMagnet(linkUrl).catch((err) => console.error('Context menu add magnet failed:', err));
      } else {
        logDev('Triggering browser download for context menu link:', linkUrl);
        browser.downloads
          .download({
            url: linkUrl,
            conflictAction: 'uniquify',
            saveAs: false,
          })
          .catch((err) => {
            console.error('Context menu trigger download failed:', err);
          });
      }
    }
  });

  // Handle notification click: Open the extension UI in a browser tab
  browser.notifications.onClicked.addListener((notificationId) => {
    logDev(`Notification clicked: ${notificationId}. Opening control center...`);
    const popupUrl = browser.runtime.getURL('src/popup/index.html');
    
    // Check if tab is already open
    browser.tabs.query({ url: popupUrl }).then((tabs) => {
      if (tabs.length > 0) {
        // Highlight active tab
        browser.tabs.update(tabs[0].id!, { active: true });
      } else {
        // Create new tab
        browser.tabs.create({ url: popupUrl });
      }
    });

    // Clear notification
    browser.notifications.clear(notificationId);
  });



  // Helper to convert Uint8Array to Data URI
  function uint8ArrayToDataUri(arr: Uint8Array, mimeType: string): string {
    let binary = '';
    const len = arr.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    const base64 = btoa(binary);
    return `data:${mimeType};base64,${base64}`;
  }

  // Intercept response headers to filter and grab torrent files in transit
  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (!settings.enabled) return;
      // Ignore requests that are triggered by the extension's own background page fetch
      const headers = details.responseHeaders || [];
      let isExtensionRequest = false;
      for (const header of headers) {
        if (header.name.toLowerCase() === 'x-router-fetch') {
          isExtensionRequest = true;
          break;
        }
      }
      if (isExtensionRequest) return;

      if (isTorrentRequest(details)) {
        const isXmlHttpRequest = details.type === 'xmlhttprequest';
        logDev(
          `Response is a torrent file. Type: ${details.type}. Starting stream filter for request ID:`,
          details.requestId
        );

        let modifiedHeaders = details.responseHeaders ? [...details.responseHeaders] : [];
        if (!isXmlHttpRequest) {
          logDev('Modifying headers to inline HTML to bypass download manager takeover.');
          // Remove existing content-type and content-disposition, and replace them
          modifiedHeaders = modifiedHeaders.filter(
            (h) => {
              const name = h.name.toLowerCase();
              return name !== 'content-type' && name !== 'content-disposition';
            }
          );
          modifiedHeaders.push({ name: 'Content-Type', value: 'text/html; charset=utf-8' });
          modifiedHeaders.push({ name: 'Content-Disposition', value: 'inline' });
        }

        try {
          const filter = browser.webRequest.filterResponseData(details.requestId);
          const chunks: ArrayBuffer[] = [];

          filter.ondata = (event) => {
            chunks.push(event.data);
            if (isXmlHttpRequest) {
              filter.write(event.data); // Pass bytes to site script normally
            }
          };

          filter.onstop = () => {
            if (!isXmlHttpRequest) {
              // Write a tiny HTML script that redirects/history back or closes the page
              const encoder = new TextEncoder();
              const html = `<!DOCTYPE html>
<html>
<head>
  <script>
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  </script>
</head>
<body>
</body>
</html>`;
              filter.write(encoder.encode(html));
            }
            filter.close();

            if (chunks.length === 0) {
              logDev('Stream filter stopped but no chunks were received.');
              return;
            }

            // Combine chunks
            let totalLength = 0;
            for (const chunk of chunks) {
              totalLength += chunk.byteLength;
            }
            const fileBuffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              fileBuffer.set(new Uint8Array(chunk), offset);
              offset += chunk.byteLength;
            }

            // Determine filename
            let filename = 'torrent.torrent';
            if (details.responseHeaders) {
              for (const header of details.responseHeaders) {
                if (header.name.toLowerCase() === 'content-disposition') {
                  const match = header.value?.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
                  if (match && match[1]) {
                    filename = decodeURIComponent(match[1]);
                    break;
                  }
                  const simpleMatch = header.value?.match(/filename=["']?([^"';\n]+)["']?/i);
                  if (simpleMatch && simpleMatch[1]) {
                    filename = simpleMatch[1];
                    break;
                  }
                }
              }
            }
            if (filename === 'torrent.torrent') {
              const urlPath = details.url.split('?')[0];
              const pathFilename = urlPath.split('/').pop();
              if (pathFilename && pathFilename.endsWith('.torrent')) {
                filename = pathFilename;
              }
            }

            logDev(`Intercepted torrent file: ${filename} (${totalLength} bytes). Processing...`);

            // Always trigger local download of the original file bytes if it was not XHR
            if (!isXmlHttpRequest) {
              try {
                const dataUri = uint8ArrayToDataUri(fileBuffer, 'application/x-bittorrent');
                browser.downloads
                  .download({
                    url: dataUri,
                    filename: filename,
                    conflictAction: 'uniquify',
                    saveAs: false,
                  })
                  .catch((err) => {
                    console.error('Failed to trigger local download of intercepted file:', err);
                  });
              } catch (err) {
                console.error('Failed to encode dataUri or download:', err);
              }
            }

            // Check server status online
            checkServerOnline(settings.qbUrl).then((isOnline) => {
              if (isOnline) {
                handleTorrentFile(fileBuffer, filename, details.url).catch((err) => {
                  console.error('Error handling filtered torrent file:', err);
                });
              } else {
                logDev('qBittorrent is offline. Streamed torrent saved natively by browser, skipping upload.');
                showNotification(
                  'server-offline-' + Date.now(),
                  'Server Offline',
                  `qBittorrent is offline. Torrent downloaded locally.`,
                  settings.notifyError
                );
              }
            });
          };

          filter.onerror = (err) => {
            console.error('Stream filter failed:', err);
          };
        } catch (e) {
          console.error('Failed to create stream filter:', e);
        }

        if (!isXmlHttpRequest) {
          return { responseHeaders: modifiedHeaders };
        }
      }
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'responseHeaders']
  );
}

// Start
init().catch((err) => console.error('Failed to initialize background page:', err));
