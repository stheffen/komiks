"use client";

import Image from "next/image";
import { useMemo } from "react";

export default function ComicCard({
  comic,
  onPrimaryAction,
  primaryActionLabel = "Baca Detail",
  onSecondaryAction,
  secondaryActionLabel,
  onToggleLibrary,
  isInLibrary = false,
  showLibraryAction = true,
  progressText,
}) {
  const genres = useMemo(() => comic.genres.slice(0, 3).join(" • "), [comic.genres]);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800/60">
        <Image
          src={comic.cover}
          alt={comic.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-105"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-60 transition group-hover:opacity-70" />
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
              {comic.title}
            </h3>
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {comic.origin} • {comic.chapters?.length || comic.totalChapters || comic.latestChapterNumber || 0} chapter
            </p>
          </div>
          {showLibraryAction && (
            <button
              type="button"
              onClick={() => onToggleLibrary?.(comic.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                isInLibrary
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/70 dark:text-emerald-300"
                  : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
              }`}
            >
              {isInLibrary ? "Tersimpan" : "Tambah"}
            </button>
          )}
        </header>
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{comic.synopsis}</p>
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex flex-col gap-1">
            <span>{genres}</span>
            {progressText && (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {progressText}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {secondaryActionLabel && onSecondaryAction && (
              <button
                type="button"
                onClick={() => onSecondaryAction?.(comic)}
                className="rounded-full border border-zinc-300 px-3 py-1 font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
              >
                {secondaryActionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => onPrimaryAction?.(comic)}
              className="rounded-full bg-zinc-900 px-3 py-1 text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {primaryActionLabel}
            </button>
          </div>
        </footer>
      </div>
    </article>
  );
}

