"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import ChapterReader from "@/components/ChapterReader";
import { useComics } from "@/context/ComicsContext";

export default function ReaderClient({
  comic,
  startChapterNumber,
  startPage = 1,
}) {
  const { recordHistory, toggleLibrary, libraryIds, forceRecordHistory } =
    useComics();
  const isInLibrary = libraryIds.includes(comic.id);
  const lastProgressRef = useRef({
    chapter: startChapterNumber,
    page: startPage ?? 1,
  });

  useEffect(() => {
    recordHistory(comic.id, startChapterNumber, startPage ?? 1);
  }, [comic.id, startChapterNumber, startPage, recordHistory]);

  const handleProgress = (comicId, chapterNumber, pageNumber) => {
    recordHistory(comicId, chapterNumber, pageNumber);
    // keep last progress in ref for unload handler
    // try to resolve chapterId from comic.chapters if available
    const chapterObj = (comic.chapters || []).find(
      (c) => Number(c.number ?? c.chapter_number) === Number(chapterNumber)
    );
    const chapterId = chapterObj
      ? chapterObj.id || chapterObj.chapter_id
      : null;
    lastProgressRef.current = {
      chapter: chapterNumber,
      chapterId,
      page: pageNumber,
    };
  };

  // Save last progress on unload and mark for redirect to Jelajahi on next load
  useEffect(() => {
    const saveAndFlag = () => {
      try {
        const p = lastProgressRef.current || {
          chapter: startChapterNumber,
          chapterId: null,
          page: startPage ?? 1,
        };
        recordHistory(comic.id, p.chapter, p.page);
        // store detailed last progress for resume
        if (typeof window !== "undefined") {
          const now = new Date().toISOString();
          try {
            const payload = {
              comicId: comic.id,
              chapterNumber: p.chapter,
              chapterId: p.chapterId || null,
              // write both keys so consumers using either name can read it
              page: p.page,
              pageNumber: p.page,
              updatedAt: now,
            };
            // force in-memory update so the context doesn't later overwrite
            // the merged value with a stale state (race condition).
            try {
              forceRecordHistory(comic.id, p.chapter, p.page);
            } catch (e) {
              // fallback to normal recordHistory
              recordHistory(comic.id, p.chapter, p.page);
            }
            window.localStorage.setItem(
              "komik:lastProgress",
              JSON.stringify(payload)
            );
          } catch (e) {
            // ignore serialization errors
          }
          // set flag so next app load can show resume banner (and fallback redirect)
          window.localStorage.setItem("komik:shouldRedirectToJelajahi", "1");

          // ALSO merge this progress into the main app storage so Riwayat shows latest
          try {
            const STORAGE_KEY = "komik-reader-state";
            const raw = window.localStorage.getItem(STORAGE_KEY);
            let base = {};
            if (raw) {
              try {
                base = JSON.parse(raw) || {};
              } catch (e) {
                base = {};
              }
            }
            const nextEntry = {
              comicId: String(comic.id),
              chapterNumber: p.chapter,
              pageNumber: p.page,
              updatedAt: now,
            };
            console.debug(
              "[reader-client] Unload: updating komik-reader-state.history[0]:",
              nextEntry
            );
            const prevHistory = Array.isArray(base.history) ? base.history : [];
            const filtered = prevHistory.filter(
              (h) => String(h.comicId) !== String(nextEntry.comicId)
            );
            const merged = [nextEntry, ...filtered].slice(0, 50);
            base.history = merged;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
            // notify app that local state was updated so context can re-hydrate
            try {
              // include merged payload in event.detail to avoid races
              const detail = { merged: base };
              window.dispatchEvent(
                new CustomEvent("komik:localstate-updated", { detail })
              );
            } catch (e) {
              // ignore
            }
          } catch (e) {
            // ignore merge errors
          }
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener("beforeunload", saveAndFlag);
    window.addEventListener("pagehide", saveAndFlag);

    return () => {
      window.removeEventListener("beforeunload", saveAndFlag);
      window.removeEventListener("pagehide", saveAndFlag);
    };
  }, [comic.id, recordHistory, startChapterNumber, startPage]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {comic.title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Chapter awal: {startChapterNumber} • Halaman {startPage ?? 1}
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
        key={`${comic.id}-${startChapterNumber}-${startPage ?? 1}`}
        comic={comic}
        startChapterNumber={startChapterNumber}
        startPage={startPage ?? 1}
        onProgress={handleProgress}
      />
    </div>
  );
}
