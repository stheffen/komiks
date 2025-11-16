const API_BASE_URL = "https://api.shngm.io/v1";

/**
 * Search comics by query
 * @param {string} query - Search term
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Items per page (default: 24)
 * @returns {Promise<Object>} API response
 */
export async function searchComics(query, page = 1, pageSize = 24) {
  const url = `${API_BASE_URL}/manga/list?page=${page}&page_size=${pageSize}&genre_include_mode=or&genre_exclude_mode=or&sort=latest&sort_order=desc&q=${encodeURIComponent(
    query
  )}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error searching comics:", error);
    throw error;
  }
}

/**
 * Get list of comics
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Items per page (default: 50)
 * @returns {Promise<Object>} API response
 */
export async function getComicsList(page = 1, pageSize = 50) {
  const url = `${API_BASE_URL}/manga/list?page=${page}&page_size=${pageSize}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching comics list:", error);
    throw error;
  }
}

/**
 * Get top comics
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Items per page (default: 10)
 * @returns {Promise<Object>} API response
 */
export async function getTopComics(page = 1, pageSize = 10) {
  const url = `${API_BASE_URL}/manga/top?page=${page}&page_size=${pageSize}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching top comics:", error);
    throw error;
  }
}

/**
 * Get comic chapters list
 * @param {string} mangaId - Manga ID
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Items per page (default: 1000)
 * @returns {Promise<Object>} API response
 */
export async function getComicChapters(mangaId, page = 1, pageSize = 1000) {
  const url = `${API_BASE_URL}/chapter/${mangaId}/list?page=${page}&page_size=${pageSize}&sort_by=chapter_number&sort_order=desc`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching comic chapters:", error);
    throw error;
  }
}

/**
 * Get chapter detail (reading pages)
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<Object>} API response
 */
// export async function getChapterDetail(chapterId) {
//   const url = `${API_BASE_URL}/chapter/detail/${chapterId}`;

//   try {
//     const response = await fetch(url);
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     const data = await response.json();
//     console.log(data);
//     return data;
//   } catch (error) {
//     console.error("Error fetching chapter detail:", error);
//     throw error;
//   }
// }

// services/api.js
export async function getChapterDetail(chapterId) {
  const url = `${API_BASE_URL}/chapter/detail/${chapterId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const body = await response.json();
    // Kembalikan body.data agar pemanggil mendapat langsung object yang berisi chapter, base_url, dll
    return body.data ?? null;
  } catch (error) {
    console.error("Error fetching chapter detail:", error);
    throw error;
  }
}

/**
 * Map API manga data to app comic structure
 * @param {Object} apiManga - Manga data from API
 * @returns {Object} Mapped comic data
 */
export function mapApiMangaToComic(apiManga) {
  const genres = apiManga.taxonomy?.Genre?.map((g) => g.name) || [];
  const countryMap = {
    JP: "Japan",
    CN: "China",
    KR: "Korea",
    US: "USA",
    ID: "Indonesia",
    PH: "Philippines",
    MY: "Malaysia",
    SG: "Singapore",
    FR: "France",
    CA: "Canada",
  };

  return {
    id: apiManga.manga_id,
    title: apiManga.title,
    cover: apiManga.cover_image_url || apiManga.cover_portrait_url || "",
    origin: countryMap[apiManga.country_id] || apiManga.country_id,
    genres: genres,
    synopsis: apiManga.description || "",
    totalChapters: apiManga.latest_chapter_number || 0,
    latestChapterNumber: apiManga.latest_chapter_number || 0,
    latestChapterId: apiManga.latest_chapter_id || null,
    userRate: apiManga.user_rate || 0,
    viewCount: apiManga.view_count || 0,
    bookmarkCount: apiManga.bookmark_count || 0,
    releaseYear: apiManga.release_year || "",
    alternativeTitle: apiManga.alternative_title || "",
    // Store raw API data for reference
    _raw: apiManga,
  };
}

/**
 * Map API chapter data to app chapter structure
 * @param {Object} apiChapter - Chapter data from API
 * @param {string} mangaId - Manga ID
 * @returns {Object} Mapped chapter data
 */
export function mapApiChapterToChapter(apiChapter, mangaId) {
  return {
    id: apiChapter.chapter_id,
    mangaId: mangaId,
    number: apiChapter.chapter_number,
    title: apiChapter.chapter_title || `Chapter ${apiChapter.chapter_number}`,
    thumbnail: apiChapter.thumbnail_image_url || "",
    viewCount: apiChapter.view_count || 0,
    releaseDate: apiChapter.release_date || "",
    // Store raw API data for reference
    _raw: apiChapter,
  };
}
