"use client";

import Link from "next/link";
import { useEffect } from "react";
import ChapterReader from "@/components/ChapterReader";
import { useComics } from "@/context/ComicsContext";

export default function ReaderClient({ comic, startChapterNumber }) {
  const { recordHistory, toggleLibrary, libraryIds } = useComics();
  const isInLibrary = libraryIds.includes(comic.id);

  useEffect(() => {
    recordHistory(comic.id, startChapterNumber, 1);
  }, [comic.id, startChapterNumber, recordHistory]);

  const handleProgress = (comicId, chapterNumber, pageNumber) => {
    recordHistory(comicId, chapterNumber, pageNumber);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {comic.title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Chapter awal: {startChapterNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleLibrary(comic.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              isInLibrary
                ? "bg-emerald-500 text-white hover:bg-emerald-400"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {isInLibrary ? "Ada di Perpustakaan" : "Simpan ke Perpustakaan"}
          </button>
          <Link
            href="/perpustakaan"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Kembali
          </Link>
        </div>
      </header>

      <ChapterReader
        key={`${comic.id}-${startChapterNumber}`}
        comic={comic}
        startChapterNumber={startChapterNumber}
        onProgress={handleProgress}
      />
    </div>
  );
}
