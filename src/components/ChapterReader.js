"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TOP_BUFFER = 180;
const BOTTOM_BUFFER = 180;

export default function ChapterReader({ comic, startChapterNumber = 1, onProgress }) {
  const containerRef = useRef(null);
  const pageRefs = useRef({});
  const [visibleChapters, setVisibleChapters] = useState(() => [startChapterNumber]);
  const [activeChapter, setActiveChapter] = useState(startChapterNumber);
  const [activePage, setActivePage] = useState(1);

  const chapterNumbers = useMemo(
    () => comic.chapters.map((chapter) => chapter.number),
    [comic.chapters]
  );

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  const loadNextChapter = useCallback(() => {
    setVisibleChapters((chapters) => {
      const currentMax = Math.max(...chapters);
      const availableNext = chapterNumbers.find((number) => number > currentMax);
      if (!availableNext) return chapters;
      if (chapters.includes(availableNext)) return chapters;
      return [...chapters, availableNext].sort((a, b) => b - a);
    });
  }, [chapterNumbers]);

  const loadPreviousChapter = useCallback(() => {
    setVisibleChapters((chapters) => {
      const currentMin = Math.min(...chapters);
      const reversed = [...chapterNumbers].reverse();
      const availablePrev = reversed.find((number) => number < currentMin);
      if (!availablePrev) return chapters;
      if (chapters.includes(availablePrev)) return chapters;
      return [...chapters, availablePrev].sort((a, b) => b - a);
    });
  }, [chapterNumbers]);

  const handleScroll = useCallback(
    (event) => {
      const element = event.currentTarget;
      if (element.scrollTop <= TOP_BUFFER) {
        loadNextChapter();
      }
      if (element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_BUFFER) {
        loadPreviousChapter();
      }
    },
    [loadNextChapter, loadPreviousChapter]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        visible.sort(
          (a, b) =>
            a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top
        );
        const primary = visible[0];
        const chapter = Number(primary.target.dataset.chapter);
        const page = Number(primary.target.dataset.page);
        setActiveChapter(chapter);
        setActivePage(page);
      },
      {
        root: containerRef.current,
        threshold: 0.55,
      }
    );

    visibleChapters.forEach((number) => {
      const nodes = pageRefs.current[number] || [];
      nodes.forEach((node) => {
        if (node) observer.observe(node);
      });
    });

    return () => observer.disconnect();
  }, [visibleChapters]);

  useEffect(() => {
    if (!comic?.id || !onProgress) return;
    onProgress(comic.id, activeChapter, activePage);
  }, [activeChapter, activePage, comic?.id, onProgress]);

  const sortedVisibleChapters = useMemo(
    () =>
      [...visibleChapters]
        .map((number) => comic.chapters.find((chapter) => chapter.number === number))
        .filter(Boolean)
        .sort((a, b) => b.number - a.number),
    [visibleChapters, comic.chapters]
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/5 px-4 py-3 text-sm font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
        <div className="flex flex-col">
          <span className="uppercase tracking-wide text-xs text-zinc-500 dark:text-zinc-400">
            Sedang dibaca
          </span>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            {comic.title} • Chapter {activeChapter}
          </h1>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Halaman {activePage}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900">
            Scroll ke atas untuk chapter berikutnya
          </span>
          <span className="rounded-full border border-zinc-300 px-3 py-1 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">
            Scroll ke bawah untuk chapter sebelumnya
          </span>
        </div>
      </header>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto rounded-3xl border border-zinc-200 bg-white shadow-inner dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-col gap-12 px-4 py-10 sm:px-8">
          {sortedVisibleChapters.map((chapter) => (
            <section
              key={chapter.id}
              data-chapter={chapter.number}
              className="space-y-6"
            >
              <div className="sticky top-4 z-20 flex items-center justify-between rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-700 shadow dark:bg-zinc-900/90 dark:text-zinc-200">
                <span>Chapter {chapter.number}</span>
                <span>{chapter.pages.length} halaman</span>
              </div>
              <div className="flex flex-col gap-4">
                {chapter.pages.map((pageUrl, index) => (
                  <figure
                    key={pageUrl}
                    ref={(node) => {
                      if (!pageRefs.current[chapter.number]) {
                        pageRefs.current[chapter.number] = [];
                      }
                      if (node) {
                        pageRefs.current[chapter.number][index] = node;
                      }
                    }}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    data-chapter={chapter.number}
                    data-page={index + 1}
                  >
                    <Image
                      src={pageUrl}
                      alt={`Halaman ${index + 1} Chapter ${chapter.number}`}
                      width={900}
                      height={1400}
                      className="h-auto w-full bg-zinc-100 object-cover dark:bg-zinc-800"
                      loading="lazy"
                      sizes="(max-width: 768px) 90vw, 60vw"
                    />
                    <figcaption className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Halaman {index + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

