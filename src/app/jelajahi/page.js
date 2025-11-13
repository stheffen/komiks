"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ComicCard from "@/components/ComicCard";
import ComicDetailDialog from "@/components/ComicDetailDialog";
import { useComics } from "@/context/ComicsContext";

const PAGE_SIZE = 8;

export default function JelajahiPage() {
  const router = useRouter();
  const { searchComics, toggleLibrary, libraryIds } = useComics();
  const [query, setQuery] = useState("");
  const [chunkCount, setChunkCount] = useState(1);
  const [selectedComic, setSelectedComic] = useState(null);
  const scrollContainerRef = useRef(null);

  const filteredComics = useMemo(() => searchComics(query), [query, searchComics]);
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
    if (event.deltaY < 0 && scrollContainerRef.current?.scrollTop <= 0 && hasMore) {
      loadMore();
    }
  };

  const handleStartReading = (chapterNumber) => {
    if (!selectedComic) return;
    router.push(`/baca/${selectedComic.id}/${chapterNumber}`);
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
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Jelajahi</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Cari komik berdasarkan judul, genre, atau asal negara. Scroll ke atas di daftar untuk
          memunculkan 8 komik berikutnya.
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

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className="max-h-[70vh] overflow-y-auto rounded-3xl border border-zinc-200 bg-white/70 p-6 shadow-inner dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        {visibleComics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            Tidak ada komik yang sesuai dengan pencarianmu.
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
        {hasMore && (
          <div className="mt-6 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Scroll ke atas atau bawah untuk memuat komik lainnya...
          </div>
        )}
      </div>

      <ComicDetailDialog
        comic={selectedComic}
        isOpen={Boolean(selectedComic)}
        onClose={() => setSelectedComic(null)}
        onStartReading={handleStartReading}
        onToggleLibrary={(comicId) => toggleLibrary(comicId)}
        isInLibrary={selectedComic ? libraryIds.includes(selectedComic.id) : false}
      />
    </div>
  );
}

