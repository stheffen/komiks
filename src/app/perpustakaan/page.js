"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ComicCard from "@/components/ComicCard";
import ComicDetailDialog from "@/components/ComicDetailDialog";
import { useComics } from "@/context/ComicsContext";

export default function PerpustakaanPage() {
  const router = useRouter();
  const {
    isReady,
    libraryComics,
    libraryIds,
    toggleLibrary,
    getLastProgress,
  } = useComics();
  const [selectedComic, setSelectedComic] = useState(null);

  const orderedLibrary = useMemo(() => {
    return [...libraryComics].sort((a, b) => a.title.localeCompare(b.title));
  }, [libraryComics]);

  const handleOpenReader = (comic) => {
    const progress = getLastProgress(comic.id);
    const chapterNumber = progress?.chapterNumber ?? 1;
    router.push(`/baca/${comic.id}/${chapterNumber}`);
  };

  const handleStartFromDialog = (chapterNumber) => {
    if (!selectedComic) return;
    router.push(`/baca/${selectedComic.id}/${chapterNumber}`);
    setSelectedComic(null);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Perpustakaan</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Simpan komik favoritmu dan lanjutkan membaca dari chapter terakhir.
        </p>
      </header>

      {!isReady ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          Memuat perpustakaan...
        </div>
      ) : orderedLibrary.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            Perpustakaanmu masih kosong
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Jelajahi komik di halaman <strong>Jelajahi</strong> dan tambahkan yang kamu suka.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {orderedLibrary.map((comic) => {
            const progress = getLastProgress(comic.id);
            const progressText = progress
              ? `Terakhir: Chapter ${progress.chapterNumber}`
              : "Belum dibaca";
            const primaryActionLabel = progress ? "Lanjutkan" : "Mulai Baca";
            return (
              <ComicCard
                key={comic.id}
                comic={comic}
                onPrimaryAction={handleOpenReader}
                primaryActionLabel={primaryActionLabel}
                onSecondaryAction={setSelectedComic}
                secondaryActionLabel="Detail"
                progressText={progressText}
                showLibraryAction={false}
              />
            );
          })}
        </div>
      )}

      <ComicDetailDialog
        comic={selectedComic}
        isOpen={Boolean(selectedComic)}
        onClose={() => setSelectedComic(null)}
        onStartReading={handleStartFromDialog}
        onToggleLibrary={(comicId) => toggleLibrary(comicId)}
        isInLibrary={selectedComic ? libraryIds.includes(selectedComic.id) : false}
      />
    </div>
  );
}

