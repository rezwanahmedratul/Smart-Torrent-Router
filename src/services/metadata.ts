import {
  classifyTorrent,
  cleanTorrentName,
  ClassifiedTorrent,
  TorrentFile,
  CATEGORY_MOVIES,
  CATEGORY_SERIES,
  CATEGORY_ANIME,
  CATEGORY_OTHER,
} from './classifier';
import { searchAniList } from './anilist';
import { searchTmdb } from './tmdb';

export interface MetadataOptions {
  tmdbApiKey?: string;
  anilistEnabled: boolean;
  confidenceThreshold: number; // e.g. 0.8
}

export async function resolveClassification(
  torrentName: string,
  files: TorrentFile[],
  options: MetadataOptions
): Promise<ClassifiedTorrent> {
  // 1. Run local offline classification first
  let result = classifyTorrent(torrentName, files);

  // 2. Check if we need to search online providers (confidence < threshold)
  const threshold = options.confidenceThreshold;
  if (result.confidence >= threshold) {
    return result; // High confidence already, skip online lookup
  }

  // Extract clean title and year
  const { title, year } = cleanTorrentName(torrentName);

  // If title is empty or too short, don't query
  if (!title || title.length < 2) {
    return result;
  }

  console.log(`Low confidence (${result.confidence * 100}%). Querying metadata providers for: "${title}"...`);

  let updatedScores = { ...result.scores };
  let boosted = false;

  // 3. Search AniList (Anime)
  if (options.anilistEnabled) {
    try {
      const isAnime = await searchAniList(title);
      if (isAnime) {
        // Boost anime score significantly
        updatedScores[CATEGORY_ANIME] = Math.max(updatedScores[CATEGORY_ANIME] || 0, 85);
        // Depress movie and TV scores to prevent confusion
        updatedScores[CATEGORY_MOVIES] = Math.min(updatedScores[CATEGORY_MOVIES] || 0, 10);
        updatedScores[CATEGORY_SERIES] = Math.min(updatedScores[CATEGORY_SERIES] || 0, 10);
        boosted = true;
        console.log(`AniList match found. Boosted anime category score.`);
      }
    } catch (e) {
      console.error('Error in AniList metadata search:', e);
    }
  }

  // 4. Search TMDB (Movies & TV) if API Key is provided and AniList didn't boost anime
  if (options.tmdbApiKey && !boosted) {
    try {
      const tmdbMatch = await searchTmdb(title, options.tmdbApiKey, year);
      if (tmdbMatch) {
        if (tmdbMatch.mediaType === 'movie') {
          updatedScores[CATEGORY_MOVIES] = Math.max(updatedScores[CATEGORY_MOVIES] || 0, 85);
          updatedScores[CATEGORY_SERIES] = Math.min(updatedScores[CATEGORY_SERIES] || 0, 10);
          updatedScores[CATEGORY_ANIME] = Math.min(updatedScores[CATEGORY_ANIME] || 0, 10);
          console.log(`TMDB match found: Movie "${tmdbMatch.title}". Boosted movies category score.`);
        } else if (tmdbMatch.mediaType === 'tv') {
          updatedScores[CATEGORY_SERIES] = Math.max(updatedScores[CATEGORY_SERIES] || 0, 85);
          updatedScores[CATEGORY_MOVIES] = Math.min(updatedScores[CATEGORY_MOVIES] || 0, 10);
          updatedScores[CATEGORY_ANIME] = Math.min(updatedScores[CATEGORY_ANIME] || 0, 10);
          console.log(`TMDB match found: TV Show "${tmdbMatch.title}". Boosted series category score.`);
        }
        boosted = true;
      }
    } catch (e) {
      console.error('Error in TMDB metadata search:', e);
    }
  }

  // 5. If we boosted, recalculate top category and confidence
  if (boosted) {
    let topCategory = CATEGORY_OTHER;
    let maxScore = 0;
    let sumScores = 0;

    for (const [cat, score] of Object.entries(updatedScores)) {
      if (score > maxScore) {
        maxScore = score;
        topCategory = cat;
      }
      sumScores += score;
    }

    // Since we verified via official API, confidence is set high (e.g. 0.9)
    const confidence = 0.9;

    return {
      category: topCategory,
      confidence,
      scores: updatedScores,
    };
  }

  // Return original offline result if no online boost occurred
  return result;
}
