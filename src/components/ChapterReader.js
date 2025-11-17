"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChapterWithPages } from "@/data/comics";

const BOTTOM_BUFFER = 180;

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

export default function ChapterReader({
  comic,
  startChapterNumber = 1,
  startPage = 1,
  onProgress,
}) {
  const containerRef = useRef(null);
  const pageRefs = useRef({});
  const initialChapterNumber = toNumber(startChapterNumber) ?? 1;
  const initialPageNumber = toNumber(startPage) ?? 1;
  const [visibleChapters, setVisibleChapters] = useState(() => [
    initialChapterNumber,
  ]);
  const [activeChapter, setActiveChapter] = useState(initialChapterNumber);
  const [activePage, setActivePage] = useState(initialPageNumber);
  const [chaptersWithPages, setChaptersWithPages] = useState({});
  const [loadingChapters, setLoadingChapters] = useState(new Set());
  const pendingInitialScroll = useRef(true);

  const chapterNumbers = useMemo(
    () =>
      comic.chapters
        .map((chapter) =>
          toNumber(chapter.number ?? chapter.chapter_number)
        )
        .filter((num) => typeof num === "number" && !Number.isNaN(num))
        .sort((a, b) => a - b),
    [comic.chapters]
  );

  // Find chapter by number
  const findChapter = useCallback(
    (number) => {
      const target = toNumber(number);
      if (target === null) return null;
      return comic.chapters.find(
        (ch) => toNumber(ch.number ?? ch.chapter_number) === target
      );
    },
    [comic.chapters]
  );

  // Load chapter pages
  const loadChapterPages = useCallback(async (chapterNumber) => {
    const chapter = findChapter(chapterNumber);
    if (!chapter) return;

    const chapterId = chapter.id || chapter.chapter_id;
    if (!chapterId) return;

    // If already loaded or loading, skip
    if (chaptersWithPages[chapterNumber] || loadingChapters.has(chapterNumber)) {
      return;
    }

    setLoadingChapters((prev) => new Set(prev).add(chapterNumber));

    try {
      const chapterData = await getChapterWithPages(chapterId);
      if (chapterData && chapterData.pages) {
        setChaptersWithPages((prev) => ({
          ...prev,
          [chapterNumber]: {
            ...chapter,
            pages: chapterData.pages,
          },
        }));
      }
    } catch (error) {
      console.error(`Error loading chapter ${chapterNumber}:`, error);
    } finally {
      setLoadingChapters((prev) => {
        const next = new Set(prev);
        next.delete(chapterNumber);
        return next;
      });
    }
  }, [findChapter, chaptersWithPages, loadingChapters]);

  // Load pages for visible chapters
  useEffect(() => {
    visibleChapters.forEach((number) => {
      loadChapterPages(number);
    });
  }, [visibleChapters, loadChapterPages]);

  useEffect(() => {
    if (!containerRef.current) return;
    if ((initialPageNumber ?? 1) <= 1) {
      containerRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [initialPageNumber]);

  useEffect(() => {
    pendingInitialScroll.current = true;
  }, [initialChapterNumber, initialPageNumber]);

  const loadNextChapter = useCallback(() => {
    setVisibleChapters((chapters) => {
      if (chapters.length === 0) return chapters;
      const currentMax = Math.max(...chapters);
      const availableNext = chapterNumbers.find(
        (number) => number > currentMax
      );
      if (!availableNext) return chapters;
      if (chapters.includes(availableNext)) return chapters;
      return [...chapters, availableNext].sort((a, b) => a - b);
    });
  }, [chapterNumbers]);

  const updateActiveFromScroll = useCallback(() => {
    const root = containerRef.current;
    const hasScrollableContainer =
      root && root.scrollHeight - root.clientHeight > 8;
    const viewportHeight =
      typeof window !== "undefined"
        ? window.innerHeight || document.documentElement.clientHeight || 0
        : 0;
    const rootRect = root
      ? root.getBoundingClientRect()
      : { top: 0, bottom: viewportHeight };
    const effectiveTop = hasScrollableContainer ? rootRect.top : 0;
    const effectiveBottom = hasScrollableContainer
      ? rootRect.bottom
      : viewportHeight;

    let bestMatch = null;

    Object.entries(pageRefs.current).forEach(([chapterKey, nodes]) => {
      nodes.forEach((node, index) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, effectiveTop);
        const visibleBottom = Math.min(rect.bottom, effectiveBottom);
        const visibleHeight = visibleBottom - visibleTop;
        if (visibleHeight <= 0) return;
        const ratio = visibleHeight / rect.height;
        if (!bestMatch || ratio > bestMatch.ratio) {
          bestMatch = {
            ratio,
            chapter: Number(chapterKey),
            page: index + 1,
          };
        }
      });
    });

    if (bestMatch) {
      if (!Number.isNaN(bestMatch.chapter)) {
        setActiveChapter(bestMatch.chapter);
      }
      if (!Number.isNaN(bestMatch.page)) {
        setActivePage(bestMatch.page);
      }
    }
  }, []);

  const handleScroll = useCallback(
    (event) => {
      const element = event.currentTarget;
      if (
        element.scrollHeight - element.scrollTop - element.clientHeight <=
        BOTTOM_BUFFER
      ) {
        loadNextChapter();
      }
      updateActiveFromScroll();
    },
    [loadNextChapter, updateActiveFromScroll]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let ticking = false;
    const handleWindowScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const scrollTop =
          window.scrollY ?? document.documentElement.scrollTop ?? 0;
        const docHeight =
          document.documentElement.scrollHeight ||
          document.body.scrollHeight ||
          0;
        const windowHeight = window.innerHeight || 0;

        if (docHeight - (scrollTop + windowHeight) <= BOTTOM_BUFFER) {
          loadNextChapter();
        }
        updateActiveFromScroll();
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, [loadNextChapter, updateActiveFromScroll]);

  useEffect(() => {
    if (!containerRef.current) return;
    const rootEl = containerRef.current;
    const useContainerAsRoot =
      rootEl.scrollHeight - rootEl.clientHeight > 8;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => {
          if (b.intersectionRatio !== a.intersectionRatio) {
            return b.intersectionRatio - a.intersectionRatio;
          }
          return (
            a.target.getBoundingClientRect().top -
            b.target.getBoundingClientRect().top
          );
        });
        const primary = visible[0];
        const chapter = Number(primary.target.dataset.chapter);
        const page = Number(primary.target.dataset.page);
        if (!Number.isNaN(chapter)) {
          setActiveChapter(chapter);
        }
        if (!Number.isNaN(page)) {
          setActivePage(page);
        }
      },
      {
        root: useContainerAsRoot ? rootEl : null,
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
  }, [visibleChapters, chaptersWithPages]);

  useEffect(() => {
    if (!pendingInitialScroll.current) return;
    const chapterNodes = pageRefs.current[initialChapterNumber];
    const targetNode =
      chapterNodes?.[Math.max(0, initialPageNumber - 1)] ?? null;
    if (!targetNode) return;

    pendingInitialScroll.current = false;
    requestAnimationFrame(() => {
      targetNode.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }, [initialChapterNumber, initialPageNumber, chaptersWithPages, visibleChapters]);

  useEffect(() => {
    if (!comic?.id || !onProgress) return;
    onProgress(comic.id, activeChapter, activePage);
  }, [activeChapter, activePage, comic?.id, onProgress]);

  const sortedVisibleChapters = useMemo(
    () =>
      [...visibleChapters]
        .map((number) => {
          const chapter = findChapter(number);
          if (!chapter) return null;
          // Use chapter with pages if available, otherwise use original
          return chaptersWithPages[number] || chapter;
        })
        .filter(Boolean)
        .sort((a, b) => {
          const numA = toNumber(a.number ?? a.chapter_number) ?? 0;
          const numB = toNumber(b.number ?? b.chapter_number) ?? 0;
          return numA - numB;
        }),
    [visibleChapters, findChapter, chaptersWithPages]
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
            Scroll ke bawah untuk chapter berikutnya
          </span>
        </div>
      </header>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto rounded-3xl border border-zinc-200 bg-white shadow-inner dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-col gap-12 px-4 py-10 sm:px-8">
          {sortedVisibleChapters.map((chapter) => {
            const normalizedNumber =
              toNumber(chapter.number ?? chapter.chapter_number) ?? 0;
            return (
              <section
                key={chapter.id || chapter.chapter_id || normalizedNumber}
                data-chapter={normalizedNumber}
                className="space-y-6"
              >
                <div className="sticky top-4 z-20 flex items-center justify-between rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-700 shadow dark:bg-zinc-900/90 dark:text-zinc-200">
                  <span>Chapter {chapter.number || chapter.chapter_number}</span>
                  <span>
                    {loadingChapters.has(normalizedNumber)
                      ? "Memuat..."
                      : chapter.pages
                      ? `${chapter.pages.length} halaman`
                      : "Memuat halaman..."}
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  {loadingChapters.has(normalizedNumber) ? (
                    <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Memuat halaman chapter...
                    </div>
                  ) : chapter.pages && chapter.pages.length > 0 ? (
                    chapter.pages.map((pageUrl, index) => (
                      <figure
                        key={pageUrl}
                        ref={(node) => {
                          if (!pageRefs.current[normalizedNumber]) {
                            pageRefs.current[normalizedNumber] = [];
                          }
                          if (node) {
                            pageRefs.current[normalizedNumber][index] = node;
                          }
                        }}
                        className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                        data-chapter={normalizedNumber}
                        data-page={index + 1}
                      >
                        <Image
                          src={pageUrl}
                          alt={`Halaman ${index + 1} Chapter ${
                            chapter.number || chapter.chapter_number
                          }`}
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
                    ))
                  ) : (
                    <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Tidak ada halaman tersedia
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

