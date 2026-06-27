interface AniListMedia {
  id: number;
  title: {
    romaji: string | null;
    english: string | null;
  };
  format: string | null;
}

export async function searchAniList(title: string): Promise<boolean> {
  const query = `
    query ($search: String) {
      Page (perPage: 3) {
        media (search: $search, type: ANIME) {
          id
          title {
            romaji
            english
          }
          format
        }
      }
    }
  `;

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { search: title },
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const mediaList = data?.data?.Page?.media as AniListMedia[] | undefined;

    if (!mediaList || mediaList.length === 0) {
      return false;
    }

    // Verify similarity of the returned titles
    const cleanSearch = title.toLowerCase().trim();
    for (const media of mediaList) {
      const romaji = media.title.romaji?.toLowerCase() || '';
      const english = media.title.english?.toLowerCase() || '';

      if (
        romaji.includes(cleanSearch) ||
        cleanSearch.includes(romaji) ||
        english.includes(cleanSearch) ||
        cleanSearch.includes(english)
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('AniList API error:', error);
    return false;
  }
}
