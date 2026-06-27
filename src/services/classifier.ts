export interface ClassifiedTorrent {
  category: string;
  confidence: number;
  scores: Record<string, number>;
}

export interface TorrentFile {
  path: string; // Relative path, e.g., "Movie (2025)/movie.mkv"
  size: number; // File size in bytes
}

// Category Constants
export const CATEGORY_MOVIES = 'movies';
export const CATEGORY_SERIES = 'series';
export const CATEGORY_ANIME = 'anime';
export const CATEGORY_MUSIC = 'music';
export const CATEGORY_GAMES = 'games';
export const CATEGORY_BOOKS = 'books';
export const CATEGORY_ISO = 'iso';
export const CATEGORY_SOFTWARE = 'software';
export const CATEGORY_OTHER = 'other';

// File Extensions Groups
const EXT_MUSIC = new Set(['mp3', 'flac', 'm4a', 'wav', 'ogg', 'alac', 'ape', 'aac', 'wma']);
const EXT_BOOKS = new Set(['pdf', 'epub', 'mobi', 'cbz', 'cbr', 'fb2', 'azw3', 'djvu']);
const EXT_VIDEO = new Set(['mkv', 'mp4', 'avi', 'mov', 'wmv', 'm4v', 'flv', 'ts']);
const EXT_ISO = new Set(['iso', 'img']);
const EXT_SOFTWARE = new Set(['exe', 'msi', 'deb', 'rpm', 'pkg', 'dmg', 'appimage', 'msix']);

// Keywords / Patterns
const ANIME_GROUPS = [
  'SubsPlease',
  'Erai-raws',
  'Anime Time',
  'EMBER',
  'Judas',
  'HorribleSubs',
  'ASW',
  'Yameii',
  'PAS',
  'Kametsu',
  'Cleo',
  'Tsundere',
  'Vivid',
  'Dual-Audio',
  'Kira-raws',
  'SallySubs',
];

const GAME_GROUPS = [
  'FitGirl',
  'DODI',
  'SteamRip',
  'ElAmigos',
  'GOG',
  'SKIDROW',
  'CODEX',
  'PLAZA',
  'FLT',
  'EMPRESS',
  'Razor1911',
  'RELOADED',
  'HOODLUM',
  'PROPHET',
  'DARKZER0',
  'tinyiso',
  'CUSA', // PS4 games
];

const LINUX_DISTROS = [
  'ubuntu',
  'debian',
  'fedora',
  'archlinux',
  'centos',
  'mint',
  'manjaro',
  'kali',
  'gentoo',
  'pop_os',
  'pop-os',
  'rocky',
  'alma',
  'rhel',
  'slackware',
  'tails',
];

const MOVIE_KEYWORDS = [
  'bluray',
  'blu-ray',
  'web-dl',
  'webrip',
  'brrip',
  'bdrip',
  'dvdrip',
  'remux',
  '2160p',
  '1080p',
  '720p',
  'uhd',
  'imax',
];

const SOFTWARE_KEYWORDS = [
  'crack',
  'patch',
  'keygen',
  'license',
  'activator',
  'serial',
  'keygen.exe',
  'patch.exe',
  'crack.exe',
];

// Helper to check file extensions
const getExtension = (path: string): string => {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
};

// Main classification function
export function classifyTorrent(
  torrentName: string,
  files: TorrentFile[]
): ClassifiedTorrent {
  const scores: Record<string, number> = {
    [CATEGORY_MOVIES]: 0,
    [CATEGORY_SERIES]: 0,
    [CATEGORY_ANIME]: 0,
    [CATEGORY_MUSIC]: 0,
    [CATEGORY_GAMES]: 0,
    [CATEGORY_BOOKS]: 0,
    [CATEGORY_ISO]: 0,
    [CATEGORY_SOFTWARE]: 0,
    [CATEGORY_OTHER]: 10, // Base fallback score for Other
  };

  const nameLower = torrentName.toLowerCase();
  const totalFiles = files.length;
  let totalSize = 0;

  let musicFileCount = 0;
  let musicFileSize = 0;
  let bookFileCount = 0;
  let bookFileSize = 0;
  let videoFileCount = 0;
  let videoFileSize = 0;
  let softwareFileCount = 0;
  let softwareFileSize = 0;
  let isoFileCount = 0;
  let isoFileSize = 0;

  let largestVideoSize = 0;
  let largestVideoName = '';

  const gameIndicators = {
    steamApi: false,
    repackFiles: false,
    largeBinFiles: 0,
  };

  // 1. Analyze individual files
  for (const file of files) {
    totalSize += file.size;
    const ext = getExtension(file.path);
    const fileNameLower = file.path.split('/').pop()!.toLowerCase();

    // Check sizes
    if (EXT_VIDEO.has(ext)) {
      videoFileCount++;
      videoFileSize += file.size;
      if (file.size > largestVideoSize) {
        largestVideoSize = file.size;
        largestVideoName = fileNameLower;
      }
    } else if (EXT_MUSIC.has(ext)) {
      musicFileCount++;
      musicFileSize += file.size;
    } else if (EXT_BOOKS.has(ext)) {
      bookFileCount++;
      bookFileSize += file.size;
    } else if (EXT_SOFTWARE.has(ext)) {
      softwareFileCount++;
      softwareFileSize += file.size;
    } else if (EXT_ISO.has(ext)) {
      isoFileCount++;
      isoFileSize += file.size;
    }

    // Check game files
    if (fileNameLower.includes('steam_api.dll') || fileNameLower.includes('steam_api64.dll')) {
      gameIndicators.steamApi = true;
    }
    if (fileNameLower.endsWith('.bin') && file.size > 500 * 1024 * 1024) {
      gameIndicators.largeBinFiles++;
    }
    if (fileNameLower.includes('fitgirl') || fileNameLower.includes('dodi')) {
      gameIndicators.repackFiles = true;
    }
  }

  // 2. Compute ratios
  const videoSizeRatio = totalSize > 0 ? videoFileSize / totalSize : 0;
  const musicSizeRatio = totalSize > 0 ? musicFileSize / totalSize : 0;
  const bookSizeRatio = totalSize > 0 ? bookFileSize / totalSize : 0;
  const softwareSizeRatio = totalSize > 0 ? softwareFileSize / totalSize : 0;
  const isoSizeRatio = totalSize > 0 ? isoFileSize / totalSize : 0;

  // 3. APPLY RULES PER CATEGORY

  // --- MUSIC ---
  if (musicFileCount > 0) {
    scores[CATEGORY_MUSIC] += 25;
    if (musicSizeRatio > 0.6) scores[CATEGORY_MUSIC] += 50;
    if (musicFileCount / totalFiles > 0.5) scores[CATEGORY_MUSIC] += 20;
  }
  if (nameLower.includes('ost') || nameLower.includes('soundtrack') || nameLower.includes('discography') || nameLower.includes('flac')) {
    scores[CATEGORY_MUSIC] += 25;
  }
  if (files.some(f => {
    const fn = f.path.toLowerCase();
    return fn.endsWith('.cue') || fn.endsWith('.log') || fn.includes('scans') || fn.includes('artwork');
  })) {
    scores[CATEGORY_MUSIC] += 15;
  }

  // --- BOOKS ---
  if (bookFileCount > 0) {
    scores[CATEGORY_BOOKS] += 20;
    if (bookSizeRatio > 0.6) scores[CATEGORY_BOOKS] += 50;
    // Strong signals for non-pdf book extensions (epub, mobi, cbz, cbr)
    const hasSpecialBookExt = files.some(f => {
      const ext = getExtension(f.path);
      return ext === 'epub' || ext === 'mobi' || ext === 'cbz' || ext === 'cbr' || ext === 'fb2' || ext === 'azw3';
    });
    if (hasSpecialBookExt) {
      scores[CATEGORY_BOOKS] += 40;
    }
  }
  if (nameLower.includes('ebook') || nameLower.includes('epub') || nameLower.includes('pdf book') || nameLower.includes('manga') || nameLower.includes('novel')) {
    scores[CATEGORY_BOOKS] += 30;
  }

  // --- ISO ---
  if (isoFileCount > 0) {
    if (isoSizeRatio > 0.8 && totalFiles <= 5) {
      scores[CATEGORY_ISO] += 50;
    }
  }
  const isMatchLinuxDistro = LINUX_DISTROS.some(d => nameLower.includes(d));
  if (isMatchLinuxDistro) {
    scores[CATEGORY_ISO] += 40;
    if (nameLower.includes('.iso') || nameLower.includes('desktop-amd64') || nameLower.includes('live-server')) {
      scores[CATEGORY_ISO] += 30;
    }
  }

  // --- ANIME ---
  // Anime release group matches are extremely strong indicators
  const matchesAnimeGroup = ANIME_GROUPS.some(g => nameLower.includes(g.toLowerCase()) || nameLower.includes(`[${g.toLowerCase()}]`));
  if (matchesAnimeGroup) {
    scores[CATEGORY_ANIME] += 70;
  }
  // Bracketed prefix indicator like [SubsPlease] or [HorribleSubs]
  if (/^\[[a-z0-9\s-_]+\]/i.test(torrentName)) {
    scores[CATEGORY_ANIME] += 20;
  }
  if (nameLower.includes('dual-audio') || nameLower.includes('dual audio') || nameLower.includes('multi-sub') || nameLower.includes('multi-subs')) {
    if (videoFileCount > 0) {
      scores[CATEGORY_ANIME] += 15;
    }
  }
  // Anime episode formats e.g. "Name - 01 (1080p)" or "Name - 01.mkv"
  if (videoFileCount > 0 && /\s-\s\d{2,3}(v\d)?\s/.test(torrentName)) {
    scores[CATEGORY_ANIME] += 25;
  }
  // Japanese characters
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(torrentName)) {
    scores[CATEGORY_ANIME] += 20;
  }

  // --- SERIES ---
  // TV regex matches
  const hasTvSeasonEpisode = /s\d{2}e\d{2}/i.test(nameLower) || /\d+x\d+/.test(nameLower);
  const hasTvSeasonOnly = /season\s\d+/i.test(nameLower) || /s\d{1(2)}/i.test(nameLower) || /complete\sseason/i.test(nameLower);
  const hasTvEpisodeOnly = /ep[isode]*\s\d+/i.test(nameLower);

  if (hasTvSeasonEpisode) {
    scores[CATEGORY_SERIES] += 75;
  } else if (hasTvSeasonOnly) {
    scores[CATEGORY_SERIES] += 60;
  } else if (hasTvEpisodeOnly) {
    scores[CATEGORY_SERIES] += 40;
  }

  // Check file directories (e.g., files in "Season 1/" folders)
  const hasSeasonFolders = files.some(f => {
    const parts = f.path.toLowerCase().split('/');
    return parts.length > 1 && (parts[0].includes('season') || /^s\d+$/.test(parts[0]));
  });
  if (hasSeasonFolders) {
    scores[CATEGORY_SERIES] += 30;
  }

  // Multiple video files are common in TV/Anime, less common in Movies
  if (videoFileCount > 2 && videoFileCount < 50) {
    scores[CATEGORY_SERIES] += 20;
  }

  // --- MOVIES ---
  // Large video file that accounts for almost the whole size
  const hasSingleLargeVideo = videoFileCount > 0 && (largestVideoSize / totalSize) > 0.75;
  if (hasSingleLargeVideo && videoFileCount <= 3) {
    scores[CATEGORY_MOVIES] += 45;
  }

  // Check for movie release year (e.g. (2025) or 2025)
  const yearMatch = nameLower.match(/\b(19\d{2}|20[0-2]\d)\b/);
  const hasYear = !!yearMatch;
  if (hasYear) {
    scores[CATEGORY_MOVIES] += 20;
  }

  const hasMovieKeywords = MOVIE_KEYWORDS.some(kw => nameLower.includes(kw));
  if (hasMovieKeywords) {
    scores[CATEGORY_MOVIES] += 15;
  }

  // Adjust Movie vs TV if it's single file vs multiple episodes
  if (scores[CATEGORY_MOVIES] > 0 && hasTvSeasonEpisode) {
    // If it has S01E01, it is almost certainly TV and not a Movie, even if it's a single video file
    scores[CATEGORY_MOVIES] -= 40;
  }

  // Anime vs TV adjustments
  if (scores[CATEGORY_ANIME] > 40 && scores[CATEGORY_SERIES] > 0) {
    // Anime is TV-like, but if it has anime signals, raise anime and depress general TV
    scores[CATEGORY_SERIES] -= 15;
  }

  // --- GAMES ---
  const matchesGameGroup = GAME_GROUPS.some(g => nameLower.includes(g.toLowerCase()));
  if (matchesGameGroup || gameIndicators.repackFiles) {
    scores[CATEGORY_GAMES] += 70;
  }
  if (gameIndicators.steamApi) {
    scores[CATEGORY_GAMES] += 60;
  }
  if (gameIndicators.largeBinFiles > 0) {
    scores[CATEGORY_GAMES] += 20 + gameIndicators.largeBinFiles * 5;
  }
  if (nameLower.includes('repack') || nameLower.includes('cracked-') || nameLower.includes('cracked_') || nameLower.includes('multi21') || nameLower.includes('pc game')) {
    scores[CATEGORY_GAMES] += 15;
  }

  // --- SOFTWARE ---
  if (softwareFileCount > 0) {
    scores[CATEGORY_SOFTWARE] += 20;
    if (softwareSizeRatio > 0.5) scores[CATEGORY_SOFTWARE] += 20;
  }
  const hasSoftwareKeywords = SOFTWARE_KEYWORDS.some(kw => nameLower.includes(kw));
  if (hasSoftwareKeywords) {
    scores[CATEGORY_SOFTWARE] += 30;
  }
  if (nameLower.includes('patch') || nameLower.includes('keygen') || nameLower.includes('crack') || nameLower.includes('activator')) {
    scores[CATEGORY_SOFTWARE] += 15;
  }

  // Software vs Games adjustments
  if (scores[CATEGORY_GAMES] > 30) {
    // If we have game repackers or steam_api, software score is depressed
    scores[CATEGORY_SOFTWARE] -= 25;
  } else if (scores[CATEGORY_SOFTWARE] > 30 && gameIndicators.largeBinFiles > 0) {
    // If it has setup files and big bins, but no specific steam_api, might be a game
    scores[CATEGORY_GAMES] += 15;
  }

  // Ensure scores are non-negative
  for (const cat in scores) {
    if (scores[cat] < 0) {
      scores[cat] = 0;
    }
  }

  // Determine top category
  let topCategory = CATEGORY_OTHER;
  let maxScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topCategory = cat;
    }
  }

  // If top score is very low (e.g. <= 15), classify as Other
  if (maxScore <= 15) {
    topCategory = CATEGORY_OTHER;
    maxScore = 15; // Set base other score
  }

  // Calculate confidence score (normalized between 0 and 1)
  // Confidence formula: Top Score relative to the sum of positive scores, or cap based on evidence.
  let sumScores = 0;
  for (const s of Object.values(scores)) {
    sumScores += s;
  }

  let confidence = 0;
  if (sumScores > 0) {
    if (topCategory === CATEGORY_OTHER) {
      confidence = 0.5; // Other is always moderate confidence by default
    } else {
      // Relative strength of the top category vs others, scaled
      confidence = maxScore / (sumScores - maxScore + maxScore * 0.5);
      if (confidence > 1) confidence = 1;

      // Limit confidence if there is no strong absolute signal (maxScore)
      if (maxScore < 30) {
        confidence = Math.min(confidence, 0.4);
      } else if (maxScore < 50) {
        confidence = Math.min(confidence, 0.7);
      }
    }
  } else {
    confidence = 0.1;
  }

  // Round confidence to 2 decimal places
  confidence = Math.round(confidence * 100) / 100;

  return {
    category: topCategory,
    confidence,
    scores,
  };
}

// Clean torrent name to get queryable title for TMDB / AniList
export function cleanTorrentName(name: string): { title: string; year?: string } {
  let cleaned = name.replace(/_/g, ' '); // replace underscores
  cleaned = cleaned.replace(/\./g, ' '); // replace dots

  // Extract year if present
  const yearMatch = cleaned.match(/\b(19\d{2}|20[0-2]\d)\b/);
  const year = yearMatch ? yearMatch[0] : undefined;

  if (year) {
    cleaned = cleaned.replace(new RegExp('\\b' + year + '\\b', 'g'), ' ');
  }

  // Clean tags like [Group], (2020), etc.
  cleaned = cleaned.replace(/\[[^\]]+\]/g, ' ');
  cleaned = cleaned.replace(/\([^)]+\)/g, ' ');

  // Cut-off at first known tag or formatting
  const cutOffTags = [
    '2160p', '1080p', '720p', '480p', '4k', '8k',
    'bluray', 'blu-ray', 'web-dl', 'webrip', 'brrip', 'bdrip', 'dvdrip', 'remux',
    'x264', 'x265', 'h264', 'h265', 'hevc', 'av1',
    'aac', 'dts', 'dd5', 'ac3', 'flac', 'mp3',
    'season', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9',
    'fitgirl', 'dodi', 'gog', 'steamrip',
  ];

  const words = cleaned.split(/\s+/);
  const titleWords: string[] = [];

  for (const word of words) {
    if (cutOffTags.includes(word.toLowerCase())) {
      break;
    }
    titleWords.push(word);
  }

  let title = titleWords.join(' ').trim();

  // Remove TV episode designations at the end
  title = title.replace(/\s+s\d+e\d+.*/i, '');
  title = title.replace(/\s+ep\d+.*/i, '');
  title = title.replace(/\s+-\s+\d+.*/i, '');

  return {
    title: title || name,
    year,
  };
}
