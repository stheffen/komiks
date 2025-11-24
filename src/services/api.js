// Normalize API base URL from env: trim whitespace and remove trailing slashes
const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const API_BASE_URL = rawApiBase.trim().replace(/\/+$|\s+/g, "");

/**
 * Fetch latest updated comics (Terupdate)
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Items per page (default: 24)
 * @returns {Promise<Array>} Array of mapped comics
 */
export async function getLatestUpdatedComics(page = 1, pageSize = 3) {
  const url = `${API_BASE_URL}/manga/list?type=project&page=${page}&page_size=${pageSize}&is_update=true&sort=latest&sort_order=desc`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (Array.isArray(data.data)) {
      return data.data.map(mapApiMangaToComic);
    }
    return [];
  } catch (error) {
    console.error("Error fetching latest updated comics:", error);
    return [];
  }
}

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

  console.debug("[api.searchComics] url:", url);

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

  console.debug("[api.getComicsList] url:", url);

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

  console.debug("[api.getTopComics] url:", url);

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
 * Try to fetch single manga detail by id using several candidate paths.
 * This is useful when the server-side needs a single comic and the list endpoints
 * don't include the item.
 */
export async function getMangaDetail(mangaId) {
  const candidates = [
    `${API_BASE_URL}/manga/detail/${mangaId}`,
    `${API_BASE_URL}/manga/${mangaId}/detail`,
    `${API_BASE_URL}/manga/${mangaId}`,
    `${API_BASE_URL}/manga/detail?manga_id=${encodeURIComponent(mangaId)}`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      console.debug("[api.getMangaDetail] trying url:", url);
      const response = await fetch(url);
      if (!response.ok) {
        console.debug(
          "[api.getMangaDetail] non-ok response:",
          response.status,
          url
        );
        if (response.status === 404) {
          lastError = new Error(`HTTP 404 at ${url}`);
          continue;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const body = await response.json();
      // prefer body.data if present
      return body.data ?? body;
    } catch (err) {
      console.error("[api.getMangaDetail] failed for candidate:", url, err);
      lastError = err;
    }
  }
  throw (
    lastError || new Error("Failed to fetch manga detail: no candidates tried")
  );
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

  console.debug("[api.getComicChapters] url:", url);

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
// services/api.js
export async function getChapterDetail(chapterId) {
  // Try multiple URL patterns to be resilient against API path differences
  const candidates = [
    `${API_BASE_URL}/chapter/detail/${chapterId}`,
    `${API_BASE_URL}/chapter/${chapterId}/detail`,
    `${API_BASE_URL}/chapter/${chapterId}`,
    `${API_BASE_URL}/chapter/detail?chapter_id=${encodeURIComponent(
      chapterId
    )}`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      console.debug("[api.getChapterDetail] trying url:", url);
      const response = await fetch(url);
      const text = await response.text();

      // Try to parse JSON if possible
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        body = text;
      }

      if (!response.ok) {
        console.debug(
          "[api.getChapterDetail] non-ok response:",
          response.status,
          url,
          body
        );
        // If 404, try next candidate; otherwise throw
        if (response.status === 404) {
          lastError = new Error(`HTTP 404 at ${url}`);
          continue;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // If body is an object and has .data, return it; otherwise return body
      if (body && typeof body === "object") {
        return body.data ?? body;
      }

      // if not JSON, return raw text
      return body;
    } catch (error) {
      console.error("[api.getChapterDetail] failed for candidate:", url, error);
      lastError = error;
      // try next candidate
    }
  }

  // If all candidates failed, throw the last error
  throw (
    lastError ||
    new Error("Failed to fetch chapter detail: no candidates tried")
  );
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
    id: String(apiManga.manga_id ?? ""),
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
