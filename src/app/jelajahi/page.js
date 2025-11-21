"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ComicCard from "@/components/ComicCard";
import ComicDetailDialog from "@/components/ComicDetailDialog";
import { useComics } from "@/context/ComicsContext";
import { getLatestUpdatedComics } from "@/services/api";

const PAGE_SIZE = 8;

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
  // Fetch latest updated comics (Terupdate)
  useEffect(() => {
    setLatestLoading(true);
    getLatestUpdatedComics(1, 12)
      .then((results) => {
        setLatestComics(results);
      })
      .catch((error) => {
        console.error("Error loading latest updated comics:", error);
        setLatestComics([]);
      })
      .finally(() => {
        setLatestLoading(false);
      });
  }, []);

  // Load initial comics
  useEffect(() => {
    if (filteredComics.length === 0 && !query && !searchLoading) {
      setSearchLoading(true);
      apiSearchComics("")
        .then((results) => {
          setFilteredComics(results);
        })
        .catch((error) => {
          console.error("Error loading comics:", error);
          setFilteredComics([]);
        })
        .finally(() => {
          setSearchLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(
      async () => {
        setSearchLoading(true);
        try {
          const results = await apiSearchComics(query);
          setFilteredComics(results);
        } catch (error) {
          console.error("Error searching comics:", error);
          setFilteredComics([]);
        } finally {
          setSearchLoading(false);
          setChunkCount(1);
        }
      },
      query ? 500 : 0
    );

    return () => clearTimeout(timeoutId);
  }, [query, apiSearchComics]);

  // Komik Terupdate: search and chunked scroll
  const [latestFiltered, setLatestFiltered] = useState([]);
  const [latestChunkCount, setLatestChunkCount] = useState(1);
  const latestScrollRef = useRef(null);
  const LATEST_PAGE_SIZE = 8;

  useEffect(() => {
    if (!query) {
      setLatestFiltered(latestComics);
    } else {
      const q = query.toLowerCase();
      setLatestFiltered(
        latestComics.filter(
          (comic) =>
            comic.title.toLowerCase().includes(q) ||
            comic.alternativeTitle?.toLowerCase().includes(q) ||
            comic.genres.some((g) => g.toLowerCase().includes(q))
        )
      );
    }
    setLatestChunkCount(1);
    if (latestScrollRef.current) latestScrollRef.current.scrollTo({ top: 0 });
  }, [query, latestComics]);

  const visibleLatestComics = latestFiltered.slice(
    0,
    latestChunkCount * LATEST_PAGE_SIZE
  );
  const hasMoreLatest = visibleLatestComics.length < latestFiltered.length;

  const loadMoreLatest = () => {
    setLatestChunkCount((count) => {
      const next = count + 1;
      if (next * LATEST_PAGE_SIZE >= latestFiltered.length) {
        return Math.ceil(latestFiltered.length / LATEST_PAGE_SIZE);
      }
      return next;
    });
  };

  // Komik Terupdate: infinite scroll
  const [latestPage, setLatestPage] = useState(1);
  const [latestHasMore, setLatestHasMore] = useState(true);
  const [latestLoadingMore, setLatestLoadingMore] = useState(false);

  // Initial fetch (already exists)
  useEffect(() => {
    setLatestLoading(true);
    getLatestUpdatedComics(1, 12)
      .then((results) => {
        setLatestComics(results);
        setLatestPage(1);
        setLatestHasMore(results.length === 12);
      })
      .catch((error) => {
        console.error("Error loading latest updated comics:", error);
        setLatestComics([]);
        setLatestHasMore(false);
      })
      .finally(() => {
        setLatestLoading(false);
      });
  }, []);

  // Load more when scrolled to bottom
  const loadMoreLatestFromApi = async () => {
    if (latestLoadingMore || !latestHasMore) return;
    const nextPage = latestPage + 1;
    console.debug(`[Komik Terupdate] Fetching page ${nextPage} from API...`);
    setLatestLoadingMore(true);
    try {
      const more = await getLatestUpdatedComics(nextPage, 12);
      console.debug(
        `[Komik Terupdate] API returned ${more.length} comics for page ${nextPage}`
      );
      if (more.length > 0) {
        setLatestComics((prev) => [...prev, ...more]);
        setLatestPage(nextPage);
        setLatestHasMore(more.length === 12);
      } else {
        setLatestHasMore(false);
      }
    } catch (e) {
      setLatestHasMore(false);
    } finally {
      setLatestLoadingMore(false);
    }
  };

  // Improved infinite scroll for Komik Terupdate
  useEffect(() => {
    if (!latestScrollRef.current) return;
    const el = latestScrollRef.current;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight <= 120;
          if (atBottom) {
            if (hasMoreLatest) {
              loadMoreLatest();
            } else if (latestHasMore && !latestLoadingMore) {
              loadMoreLatestFromApi();
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [
    hasMoreLatest,
    latestHasMore,
    latestLoadingMore,
    visibleLatestComics.length,
    latestFiltered.length,
  ]);

  const handleLatestScroll = (event) => {
    const el = event.currentTarget;
    if (
      el.scrollHeight - el.scrollTop - el.clientHeight <= 120 &&
      hasMoreLatest
    ) {
      loadMoreLatest();
      // If chunked comics are exhausted, fetch more from API
      if (!hasMoreLatest && latestHasMore && !latestLoadingMore) {
        loadMoreLatestFromApi();
      }
    }
  };

  const handleLatestWheel = (event) => {
    if (
      event.deltaY < 0 &&
      latestScrollRef.current?.scrollTop <= 0 &&
      hasMoreLatest
    ) {
      loadMoreLatest();
    }
  };

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

  const handleWheel = (event) => {
    if (
      event.deltaY < 0 &&
      scrollContainerRef.current?.scrollTop <= 0 &&
      hasMore
    ) {
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
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {filteredComics.length} komik ditemukan
          </span>
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
        ) : latestFiltered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-300 p-8 text-center text-sm text-emerald-600 dark:border-emerald-700 dark:text-emerald-300">
            Tidak ada komik terupdate.
          </div>
        ) : (
          <div
            ref={latestScrollRef}
            onScroll={handleLatestScroll}
            onWheel={handleLatestWheel}
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
            {(hasMoreLatest || latestHasMore || latestLoadingMore) && (
              <div className="mt-6 text-center text-xs font-semibold uppercase tracking-wide text-emerald-500 dark:text-emerald-400">
                {latestLoadingMore
                  ? "Memuat komik terupdate berikutnya..."
                  : "Scroll ke atas atau bawah untuk memuat komik terupdate lainnya..."}
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
          onWheel={handleWheel}
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
