interface TmdbResult {
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
}

export interface TmdbMatch {
  mediaType: 'movie' | 'tv';
  title: string;
  releaseYear?: string;
}

export async function searchTmdb(
  title: string,
  apiKey: string,
  year?: string
): Promise<TmdbMatch | null> {
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  const isBearer = apiKey.length > 50;
  const cleanTitle = encodeURIComponent(title);
  let url = `https://api.themoviedb.org/3/search/multi?query=${cleanTitle}`;
  if (!isBearer) {
    url += `&api_key=${apiKey}`;
  }
  if (year) {
    url += `&year=${year}`;
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (isBearer) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const results = data.results as TmdbResult[] | undefined;
    if (!results || results.length === 0) {
      return null;
    }

    const cleanSearch = title.toLowerCase().trim();

    // Loop through results and find the first matching movie/tv show
    for (const item of results) {
      if (item.media_type !== 'movie' && item.media_type !== 'tv') {
        continue;
      }

      const name = (item.title || item.name || '').toLowerCase();
      const date = item.release_date || item.first_air_date || '';
      const releaseYear = date.split('-')[0];

      // Match name
      if (
        name.includes(cleanSearch) ||
        cleanSearch.includes(name)
      ) {
        return {
          mediaType: item.media_type,
          title: item.title || item.name || '',
          releaseYear,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('TMDB API error:', error);
    return null;
  }
}
