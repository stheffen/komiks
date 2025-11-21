import {
  getTopComics,
  getComicsList,
  searchComics as apiSearchComics,
  getMangaDetail,
  getComicChapters,
  getChapterDetail,
  mapApiMangaToComic,
  mapApiChapterToChapter,
} from "@/services/api";

// Cache for comics data
let cachedComics = [];
let comicsCacheInitialized = false;

/**
 * Initialize comics cache with top comics
 */
export async function initializeComics() {
  if (comicsCacheInitialized) {
    return cachedComics;
  }

  try {
    const response = await getTopComics(1, 50);
    if (response.retcode === 0 && response.data) {
      cachedComics = response.data.map(mapApiMangaToComic);
      comicsCacheInitialized = true;
    }
  } catch (error) {
    console.error("Error initializing comics:", error);
    cachedComics = [];
  }
  return cachedComics;
}

/**
 * Get all comics (from cache or fetch)
 */
export async function getComics() {
  if (!comicsCacheInitialized) {
    await initializeComics();
  }
  return cachedComics;
}

/**
 * Get comic by ID
 * @param {string} id - Comic ID
 * @returns {Promise<Object|null>} Comic object or null
 */
export async function getComicById(id) {
  // First check cache
  const cached = cachedComics.find((comic) => String(comic.id) === String(id));
  if (cached) {
    return cached;
  }

  // If not in cache, try to fetch from list
  try {
    const response = await getComicsList(1, 100);
    if (response.retcode === 0 && response.data) {
      const comics = response.data.map(mapApiMangaToComic);
      // ensure ids are strings and merge into cache without duplicates
      const existingIds = new Set(cachedComics.map((c) => String(c.id)));
      const toAdd = comics.filter((c) => !existingIds.has(String(c.id)));
      if (toAdd.length > 0) cachedComics = [...cachedComics, ...toAdd];
      const found = cachedComics.find(
        (comic) => String(comic.id) === String(id)
      );
      if (found) return found;
    }
  } catch (error) {
    console.error("Error fetching comic by ID:", error);
  }

  // As a last resort, try fetching single manga detail directly
  // Validate id shape before attempting single-detail endpoint.
  // Some parts of the app may accidentally pass a chapter number (e.g. "781")
  // instead of a manga UUID; avoid calling getMangaDetail with such values
  // because it results in requests like /manga/781 which return 404 and are noisy.
  const looksLikeUuid = (val) =>
    typeof val === "string" && val.includes("-") && val.length > 10;
  if (looksLikeUuid(id)) {
    try {
      const single = await getMangaDetail(id);
      if (single) {
        const mapped = mapApiMangaToComic(single);
        // merge into cache
        cachedComics.push(mapped);
        return mapped;
      }
    } catch (err) {
      console.debug("getMangaDetail failed:", err.message || err);
    }
  } else {
    // skip calling single-detail endpoint for obvious non-UUID ids
    console.debug("Skipping getMangaDetail for id (not UUID):", id);
  }

  return null;
}

/**
 * Search comics
 * @param {string} term - Search term
 * @returns {Promise<Array>} Array of comics
 */
export async function searchComics(term) {
  if (!term || term.trim() === "") {
    return await getComics();
  }

  try {
    const response = await apiSearchComics(term.trim());
    if (response.retcode === 0 && response.data) {
      const results = response.data.map(mapApiMangaToComic);

      // Merge search results into cache so subsequent lookups (e.g., getComicById)
      // can find comics that were returned by search but not present in cachedComics.
      try {
        const existingIds = new Set(cachedComics.map((c) => c.id));
        const toAdd = results.filter((c) => !existingIds.has(c.id));
        if (toAdd.length > 0) {
          cachedComics = [...cachedComics, ...toAdd];
        }
      } catch (e) {
        // ignore cache merge errors — still return results
        console.warn("Failed to merge search results into cache:", e);
      }

      return results;
    }
    return [];
  } catch (error) {
    console.error("Error searching comics:", error);
    return [];
  }
}

/**
 * Get comic with chapters loaded
 * @param {string} id - Comic ID
 * @returns {Promise<Object|null>} Comic with chapters
 */
export async function getComicWithChapters(idOrComic) {
  // Accept either an id string or a comic object (from search results)
  const isObject = typeof idOrComic === "object" && idOrComic !== null;
  const id = isObject ? idOrComic.id : idOrComic;

  // Try to get comic from cache first
  let comic = null;
  try {
    comic = await getComicById(id);
  } catch (e) {
    comic = null;
  }

  // If not found in cache, but caller provided a comic object, use it as base
  if (!comic && isObject) {
    comic = idOrComic;
  }

  if (!comic) return null;

  try {
    const response = await getComicChapters(id);
    if (response && response.retcode === 0 && response.data) {
      const chapters = response.data.map((ch) =>
        mapApiChapterToChapter(ch, id)
      );
      return {
        ...comic,
        chapters: chapters,
      };
    }
  } catch (error) {
    console.error("Error fetching comic chapters:", error);
  }

  // Return comic with empty chapters if fetch fails
  return {
    ...comic,
    chapters: [],
  };
}

/**
 * Get chapter with pages for reading
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<Object|null>} Chapter with pages
 */
// export async function getChapterWithPages(chapterId) {
//   try {
//     const response = await getChapterDetail(chapterId);
//     if (response.retcode === 0 && response.data) {
//       const chapterData = response.data;
//       const baseUrl = chapterData.base_url_low || chapterData.base_url;
//       const path = chapterData.chapter?.path || "";
//       const pages = (chapterData.chapter?.data || []).map(
//         (page) => `${baseUrl}${path}${page}`
//       );
//       console.log(response.data);
//       return {
//         id: chapterData.chapter_id,
//         mangaId: chapterData.manga_id,
//         number: chapterData.chapter_number,
//         title:
//           chapterData.chapter_title || `Chapter ${chapterData.chapter_number}`,
//         pages: pages,
//         prevChapterId: chapterData.prev_chapter_id,
//         prevChapterNumber: chapterData.prev_chapter_number,
//         nextChapterId: chapterData.next_chapter_id,
//         nextChapterNumber: chapterData.next_chapter_number,
//       };
//     }
//   } catch (error) {
//     console.error("Error fetching chapter detail:", error);
//   }

//   return null;
// }
// data/comics.js
export async function getChapterWithPages(chapterId) {
  try {
    const chapterData = await getChapterDetail(chapterId); // sekarang langsung data
    if (!chapterData) return null;

    // Prioritaskan base_url_low jika ada (lebih kecil/dioptimalkan)
    const baseUrl = chapterData.base_url_low || chapterData.base_url || "";
    const path = chapterData.chapter?.path || "";
    const files = Array.isArray(chapterData.chapter?.data)
      ? chapterData.chapter.data
      : [];

    const pages = files.map((filename) => {
      // jika filename sudah absolute (jarang), kembalikan langsung
      if (/^https?:\/\//i.test(filename)) return filename;
      try {
        // new URL menggabungkan baseUrl + path + filename dengan benar
        return new URL(`${path}${filename}`, baseUrl).toString();
      } catch (e) {
        // fallback aman bila new URL gagal
        return `${baseUrl.replace(/\/$/, "")}/${path
          .replace(/^\//, "")
          .replace(/\/$/, "")}/${filename.replace(/^\//, "")}`;
      }
    });

    // Debug: periksa hasil (hapus/log level nanti)
    console.log("[getChapterWithPages] chapterId:", chapterId);
    console.log("[getChapterWithPages] pages:", pages.slice(0, 5)); // tampilkan beberapa saja

    return {
      id: chapterData.chapter_id,
      mangaId: chapterData.manga_id,
      number: chapterData.chapter_number,
      title:
        chapterData.chapter_title || `Chapter ${chapterData.chapter_number}`,
      pages,
      prevChapterId: chapterData.prev_chapter_id,
      prevChapterNumber: chapterData.prev_chapter_number,
      nextChapterId: chapterData.next_chapter_id,
      nextChapterNumber: chapterData.next_chapter_number,
    };
  } catch (error) {
    console.error("Error in getChapterWithPages:", error);
    return null;
  }
}

// For backward compatibility, export empty array initially
export const comics = [];
