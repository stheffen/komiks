"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getComicWithChapters } from "@/data/comics";

export default function ComicDetailDialog({
  comic,
  isOpen,
  onClose,
  onStartReading,
  onToggleLibrary,
  isInLibrary,
}) {
  const [comicWithChapters, setComicWithChapters] = useState(null);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Load chapters when dialog opens
  useEffect(() => {
    let isCancelled = false;

    if (!isOpen || !comic) {
      setComicWithChapters(null);
      return () => {
        isCancelled = true;
      };
    }

    async function loadChapters() {
      if (comic.chapters && comic.chapters.length > 0) {
        setComicWithChapters(comic);
        return;
      }

      setChaptersLoading(true);
      try {
        const comicData = await getComicWithChapters(comic.id);
        if (!isCancelled) {
          setComicWithChapters(comicData || { ...comic, chapters: [] });
        }
      } catch (error) {
        console.error("Error loading chapters:", error);
        if (!isCancelled) {
          setComicWithChapters({ ...comic, chapters: [] });
        }
      } finally {
        if (!isCancelled) {
          setChaptersLoading(false);
        }
      }
    }

    loadChapters();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, comic]);

  if (!isOpen || !comic) return null;

  const displayComic = comicWithChapters || comic;
  const chapters = displayComic.chapters || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 px-4 py-8 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-black/5 px-3 py-1 text-sm font-semibold text-zinc-600 transition hover:bg-black/10 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/20"
        >
          Tutup
        </button>
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto md:grid-cols-[220px,1fr]">
          <div className="relative h-full min-h-[320px] overflow-hidden bg-zinc-100 md:min-h-full dark:bg-zinc-800/60">
            <Image
              src={comic.cover}
              alt={comic.title}
              width={440}
              height={660}
              sizes="(max-width: 768px) 50vw, 220px"
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="flex flex-1 flex-col gap-4 px-6 pb-6 pt-8 md:pt-6">
            <header className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {comic.origin}
              </p>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {comic.title}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {comic.synopsis}
              </p>
            </header>
            <section className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {comic.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-zinc-200 px-3 py-1 dark:border-zinc-700"
                >
                  {genre}
                </span>
              ))}
            </section>
            <section className="mt-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Daftar Chapter
                </h3>
                <button
                  type="button"
                  onClick={() => onToggleLibrary?.(comic.id)}
                  className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                    isInLibrary
                      ? "bg-emerald-500 text-white hover:bg-emerald-400"
                      : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  }`}
                >
                  {isInLibrary ? "Tersimpan" : "Tambahkan"}
                </button>
              </div>
              <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1 text-sm">
                {chaptersLoading ? (
                  <li className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Memuat daftar chapter...
                  </li>
                ) : chapters.length === 0 ? (
                  <li className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Tidak ada chapter tersedia
                  </li>
                ) : (
                  chapters.map((chapter) => {
                    const chapterKey =
                      chapter.id ||
                      chapter.chapter_id ||
                      `${chapter.number || chapter.chapter_number}-${
                        chapter.title || "chapter"
                      }`;
                    return (
                      <li key={chapterKey}>
                      <button
                        type="button"
                        onClick={() =>
                          onStartReading?.(chapter.id || chapter.chapter_id)
                        }
                        className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-4 py-2 text-left transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          Chapter {chapter.number || chapter.chapter_number}
                          {chapter.title &&
                            chapter.title !==
                              `Chapter ${
                                chapter.number || chapter.chapter_number
                              }` && (
                              <span className="ml-2 text-xs text-zinc-500">
                                - {chapter.title}
                              </span>
                            )}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {chapter.pages?.length
                            ? `${chapter.pages.length} halaman`
                            : "Tersedia"}
                        </span>
                      </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                >
                  Tutup
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
