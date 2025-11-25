"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ComicCard from "@/components/ComicCard";
import ComicDetailDialog from "@/components/ComicDetailDialog";
import { useComics } from "@/context/ComicsContext";
import { getLatestUpdatedComics } from "@/services/api";

const PAGE_SIZE = 8;
const LATEST_PAGE_SIZE = 12;

export default function JelajahiPage() {
  const router = useRouter();
  const {
    searchComics: apiSearchComics,
    toggleLibrary,
    libraryIds,
    comicsLoading,
  } = useComics();
  const [query, setQuery] = useState("");
  const [chunkCount, setChunkCount] = useState(1);
  const [selectedComic, setSelectedComic] = useState(null);
  const [filteredComics, setFilteredComics] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [latestComics, setLatestComics] = useState([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const scrollContainerRef = useRef(null);

  // Now using chunking approach like Results section

  // Terupdate section: chunked loading
  const [latestChunkCount, setLatestChunkCount] = useState(1);
  const latestScrollRef = useRef(null);
  const [latestPage, setLatestPage] = useState(1);
  const [latestHasMore, setLatestHasMore] = useState(true);
  const [latestLoadingMore, setLatestLoadingMore] = useState(false);

  // Initial fetch for latest comics
  const fetchInitialLatest = () => {
    setLatestLoading(true);
    getLatestUpdatedComics(1, LATEST_PAGE_SIZE)
      .then((results) => {
        console.log("[v0] Initial latest comics loaded:", results.length);
        setLatestComics(results);
        setLatestPage(1);
        setLatestHasMore(results.length === LATEST_PAGE_SIZE);
      })
      .catch((error) => {
        console.error("Error loading latest updated comics:", error);
        setLatestComics([]);
        setLatestHasMore(false);
      })
      .finally(() => {
        setLatestLoading(false);
      });
  };

  useEffect(() => {
    fetchInitialLatest();
  }, []);

  const loadMoreLatestFromApi = useCallback(async () => {
    if (latestLoadingMore || !latestHasMore) return;

    const nextPage = latestPage + 1;
    console.log("[v0] Fetching latest page:", nextPage);
    setLatestLoadingMore(true);
    try {
      const more = await getLatestUpdatedComics(nextPage, LATEST_PAGE_SIZE);
      console.log(
        "[v0] Fetched from API - page:",
        nextPage,
        "count:",
        more.length
      );
      if (more.length > 0) {
        setLatestComics((prev) => [...prev, ...more]);
        setLatestPage(nextPage);
        setLatestHasMore(more.length === LATEST_PAGE_SIZE);
      } else {
        setLatestHasMore(false);
      }
    } catch (e) {
      console.error("[v0] Error fetching latest:", e);
      setLatestHasMore(false);
    } finally {
      setLatestLoadingMore(false);
    }
  }, [latestPage, latestHasMore, latestLoadingMore]);

  const visibleLatestComics = latestComics.slice(
    0,
    latestChunkCount * LATEST_PAGE_SIZE
  );
  const latestHasMoreToDisplay =
    visibleLatestComics.length < latestComics.length;

  const loadMoreLatestComics = useCallback(() => {
    // Only proceed if we're not searching
    if (query) return;

    // Calculate how many we're about to show
    const nextChunk = latestChunkCount + 1;
    const itemsWillDisplay = nextChunk * LATEST_PAGE_SIZE;

    console.log(
      "[v0] Current visible:",
      visibleLatestComics.length,
      "Total comics:",
      latestComics.length,
      "Items after load more:",
      itemsWillDisplay
    );

    // If we need more data from API and haven't loaded it yet, fetch it
    if (
      itemsWillDisplay > latestComics.length &&
      latestHasMore &&
      !latestLoadingMore
    ) {
      console.log("[v0] Need more data - fetching from API");
      loadMoreLatestFromApi();
    }

    // Always increment chunk count to display next batch
    setLatestChunkCount(nextChunk);
  }, [
    latestChunkCount,
    latestComics.length,
    latestHasMore,
    latestLoadingMore,
    query,
    visibleLatestComics.length,
    loadMoreLatestFromApi,
  ]);

  const handleLatestScroll = (event) => {
    const el = event.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    // Trigger load more when within 120px of bottom
    if (
      distanceFromBottom <= 120 &&
      (latestHasMoreToDisplay || latestHasMore)
    ) {
      console.log(
        "[v0] Scroll threshold reached - distance:",
        distanceFromBottom
      );
      loadMoreLatestComics();
    }
  };

  // Scroll to top when query changes
  useEffect(() => {
    if (latestScrollRef.current) {
      latestScrollRef.current.scrollTo({ top: 0 });
    }
    setLatestChunkCount(1);
  }, [query]);

  useEffect(() => {
    const fetchInitialComics = async () => {
      setSearchLoading(true);
      try {
        const results = await apiSearchComics("");
        console.log("[v0] Initial search results loaded:", results.length);
        setFilteredComics(results || []);
      } catch (error) {
        console.error("[v0] Error loading initial comics:", error);
        setFilteredComics([]);
      } finally {
        setSearchLoading(false);
      }
    };

    fetchInitialComics();
  }, [apiSearchComics]);

  useEffect(() => {
    if (!query) {
      // If query is empty, it will be handled by initial useEffect
      return;
    }

    const fetchSearchResults = async () => {
      setSearchLoading(true);
      try {
        const results = await apiSearchComics(query);
        console.log(
          "[v0] Search results for query:",
          query,
          "count:",
          results.length
        );
        setFilteredComics(results || []);
      } catch (error) {
        console.error("[v0] Error searching:", error);
        setFilteredComics([]);
      } finally {
        setSearchLoading(false);
      }
    };

    fetchSearchResults();
  }, [query, apiSearchComics]);

  const visibleComics = filteredComics.slice(0, chunkCount * PAGE_SIZE);
  const hasMore = visibleComics.length < filteredComics.length;

  const loadMore = () => {
    setChunkCount((count) => {
      const next = count + 1;
      if (next * PAGE_SIZE >= filteredComics.length) {
        return Math.ceil(filteredComics.length / PAGE_SIZE);
      }
      return next;
    });
  };

  const handleScroll = (event) => {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 120 && hasMore) {
      loadMore();
    }
  };

  const handleStartReading = (chapterId) => {
    if (!selectedComic) return;
    const query = chapterId
      ? `?chapterId=${encodeURIComponent(chapterId)}&page=1`
      : "";
    router.push(`/baca/${selectedComic.id}${query}`);
    setSelectedComic(null);
  };

  const handleSearchChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setChunkCount(1);
    setLatestChunkCount(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0 });
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Jelajahi
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Cari komik berdasarkan judul, genre, atau asal negara. Scroll ke atas
          di daftar untuk memunculkan 8 komik berikutnya.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={query}
            onChange={handleSearchChange}
            placeholder="Cari komik favoritmu..."
            className="w-full rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
          />
        </div>
      </header>

      {/* Terupdate Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
          Komik Terupdate
        </h2>
        {latestLoading ? (
          <div className="rounded-2xl border border-dashed border-emerald-300 p-8 text-center text-sm text-emerald-600 dark:border-emerald-700 dark:text-emerald-300">
            Memuat komik terupdate...
          </div>
        ) : latestComics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-300 p-8 text-center text-sm text-emerald-600 dark:border-emerald-700 dark:text-emerald-300">
            Tidak ada komik terupdate.
          </div>
        ) : (
          <div
            ref={latestScrollRef}
            onScroll={handleLatestScroll}
            className="max-h-[50vh] overflow-y-auto rounded-3xl border border-emerald-200 bg-white/70 p-6 shadow-inner dark:border-emerald-800 dark:bg-zinc-900/60"
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleLatestComics.map((comic) => (
                <ComicCard
                  key={comic.id}
                  comic={comic}
                  onPrimaryAction={setSelectedComic}
                  primaryActionLabel="Detail"
                  onToggleLibrary={toggleLibrary}
                  isInLibrary={libraryIds.includes(comic.id)}
                  showLibraryAction
                />
              ))}
            </div>
            {(latestHasMoreToDisplay || latestHasMore) && !query && (
              <div className="mt-6 text-center text-xs font-semibold uppercase tracking-wide text-emerald-500 dark:text-emerald-400">
                {latestLoadingMore
                  ? "Memuat komik terupdate berikutnya..."
                  : "Scroll ke bawah untuk memuat lebih banyak..."}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Search Results Section */}
      <section>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="max-h-[70vh] overflow-y-auto rounded-3xl border border-zinc-200 bg-white/70 p-6 shadow-inner dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          {comicsLoading || searchLoading ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              Memuat komik...
            </div>
          ) : visibleComics.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {query
                ? "Tidak ada komik yang sesuai dengan pencarianmu."
                : "Memuat komik..."}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleComics.map((comic) => (
                <ComicCard
                  key={comic.id}
                  comic={comic}
                  onPrimaryAction={setSelectedComic}
                  primaryActionLabel="Detail"
                  onToggleLibrary={toggleLibrary}
                  isInLibrary={libraryIds.includes(comic.id)}
                  showLibraryAction
                />
              ))}
            </div>
          )}
          {hasMore && !searchLoading && (
            <div className="mt-6 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Scroll ke atas atau bawah untuk memuat komik lainnya...
            </div>
          )}
        </div>
      </section>

      <ComicDetailDialog
        comic={selectedComic}
        isOpen={Boolean(selectedComic)}
        onClose={() => setSelectedComic(null)}
        onStartReading={handleStartReading}
        onToggleLibrary={(comicId) => toggleLibrary(comicId)}
        isInLibrary={
          selectedComic ? libraryIds.includes(selectedComic.id) : false
        }
      />
    </div>
  );
}
