"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

  // Auto-scroll state + refs
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1); // multiplier (pixels/frame @60fps normalized)
  const [showSpeedControl, setShowSpeedControl] = useState(false);

  // Controls visibility state (toggle all floating controls with one click/tap)
  const [controlsVisible, setControlsVisible] = useState(true);

  // Realtime refs
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef(null);
  const isAutoScrollingRef = useRef(false);
  const autoScrollFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const controlsWrapperRef = useRef(null);
  const clickCounterRef = useRef(0);

  const chapterNumbers = useMemo(
    () =>
      comic.chapters
        .map((chapter) => toNumber(chapter.number ?? chapter.chapter_number))
        .filter((num) => typeof num === "number" && !Number.isNaN(num))
        .sort((a, b) => a - b),
    [comic.chapters]
  );

  // basic helpers to support element or document scrolling
  const getRootForScroll = useCallback(() => {
    const c = containerRef.current;
    // If container exists and is scrollable, use it. Otherwise fall back to document scrolling element
    if (c && c.scrollHeight - c.clientHeight > 8) return c;
    return document.scrollingElement || document.documentElement || window;
  }, []);

  const getScrollTop = useCallback((root) => {
    if (!root) return 0;
    if (root === window)
      return window.scrollY || document.documentElement.scrollTop || 0;
    if (
      root === document.scrollingElement ||
      root === document.documentElement
    ) {
      return document.documentElement.scrollTop || document.body.scrollTop || 0;
    }
    return root.scrollTop;
  }, []);

  const setScrollTop = useCallback((root, value) => {
    if (!root) return;
    if (root === window) {
      window.scrollTo({ top: value });
      return;
    }
    if (
      root === document.scrollingElement ||
      root === document.documentElement
    ) {
      document.documentElement.scrollTop = value;
      document.body.scrollTop = value;
      return;
    }
    root.scrollTop = value;
  }, []);

  const getMaxScroll = useCallback((root) => {
    if (!root) return 0;
    if (root === window) {
      const dh =
        document.documentElement.scrollHeight ||
        document.body.scrollHeight ||
        0;
      const wh =
        window.innerHeight || document.documentElement.clientHeight || 0;
      return Math.max(0, dh - wh);
    }
    if (
      root === document.scrollingElement ||
      root === document.documentElement
    ) {
      const dh =
        document.documentElement.scrollHeight ||
        document.body.scrollHeight ||
        0;
      const wh =
        window.innerHeight || document.documentElement.clientHeight || 0;
      return Math.max(0, dh - wh);
    }
    return Math.max(0, root.scrollHeight - root.clientHeight);
  }, []);

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
  const loadChapterPages = useCallback(
    async (chapterNumber) => {
      const chapter = findChapter(chapterNumber);
      if (!chapter) return;
      const chapterId = chapter.id || chapter.chapter_id;
      if (!chapterId) return;
      if (
        chaptersWithPages[chapterNumber] ||
        loadingChapters.has(chapterNumber)
      ) {
        return;
      }
      setLoadingChapters((prev) => {
        const next = new Set(prev);
        next.add(chapterNumber);
        return next;
      });
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
    },
    [findChapter, chaptersWithPages, loadingChapters]
  );

  // Load pages for visible chapters
  useEffect(() => {
    visibleChapters.forEach((number) => {
      loadChapterPages(number);
    });
  }, [visibleChapters, loadChapterPages]);

  useEffect(() => {
    if (!containerRef.current) return;
    if ((initialPageNumber ?? 1) <= 1) {
      try {
        containerRef.current.scrollTo({ top: 0, behavior: "auto" });
      } catch (e) {
        containerRef.current.scrollTop = 0;
      }
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

  // handleScroll: use canonical root for scroll calculations
  const handleScroll = useCallback(
    (event) => {
      // Use canonical root instead of event target
      const root = getRootForScroll();
      const scrollTop = getScrollTop(root);
      const max = getMaxScroll(root);
      const clientHeight =
        root === window
          ? window.innerHeight || document.documentElement.clientHeight || 0
          : root?.clientHeight ?? 0;

      // If auto-scroll running via ref, this scroll might be from auto-scroll; otherwise treat as user scroll
      if (!isAutoScrollingRef.current) {
        if (!isUserScrollingRef.current) {
          isUserScrollingRef.current = true;
          if (userScrollTimeoutRef.current)
            clearTimeout(userScrollTimeoutRef.current);
          userScrollTimeoutRef.current = setTimeout(() => {
            isUserScrollingRef.current = false;
          }, 1000);
          if (isAutoScrollingRef.current) {
            isAutoScrollingRef.current = false;
            setIsAutoScrolling(false);
          }
        }
      }

      // If we're near the bottom, load next chapter
      if (max - scrollTop <= BOTTOM_BUFFER) {
        loadNextChapter();
      }

      // update which page/chapter is active
      updateActiveFromScroll();
    },
    [
      getRootForScroll,
      getScrollTop,
      getMaxScroll,
      loadNextChapter,
      updateActiveFromScroll,
    ]
  );

  // add wheel/touch listeners to both container and window (to detect user interrupt)
  useEffect(() => {
    const container = containerRef.current;
    const handleWheel = () => {
      if (isAutoScrollingRef.current) {
        isAutoScrollingRef.current = false;
        setIsAutoScrolling(false);
        isUserScrollingRef.current = true;
      }
    };
    const handleTouchStart = () => {
      if (isAutoScrollingRef.current) {
        isAutoScrollingRef.current = false;
        setIsAutoScrolling(false);
        isUserScrollingRef.current = true;
      }
    };

    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: true });
      container.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
    }
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
        container.removeEventListener("touchstart", handleTouchStart);
      }
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  // Ensure we listen for window scroll as well (when container isn't scrollable)
  useEffect(() => {
    const onWindowScroll = (e) => {
      // delegate to the same handler so logic stays centralized
      handleScroll(e);
    };

    window.addEventListener("scroll", onWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, [handleScroll]);

  // Auto-scroll effect: supports both container and window/document
  useEffect(() => {
    const root = getRootForScroll();

    if (!root) {
      isAutoScrollingRef.current = false;
      return;
    }

    if (!isAutoScrolling) {
      isAutoScrollingRef.current = false;
      if (autoScrollFrameRef.current) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
      return;
    }

    const maxScroll = getMaxScroll(root);
    if (maxScroll <= 5) {
      loadNextChapter();
      setShowSpeedControl(true);
      isAutoScrollingRef.current = false;
      setIsAutoScrolling(false);
      return;
    }

    isAutoScrollingRef.current = true;
    isUserScrollingRef.current = false;
    lastTimeRef.current = performance.now();

    const step = (time) => {
      const currentRoot = getRootForScroll();
      if (!isAutoScrollingRef.current || isUserScrollingRef.current) {
        if (autoScrollFrameRef.current) {
          cancelAnimationFrame(autoScrollFrameRef.current);
          autoScrollFrameRef.current = null;
        }
        isAutoScrollingRef.current = false;
        setIsAutoScrolling(false);
        return;
      }

      const max = getMaxScroll(currentRoot);
      const cur = getScrollTop(currentRoot);

      if (cur >= max - 5) {
        isAutoScrollingRef.current = false;
        setIsAutoScrolling(false);
        loadNextChapter();
        return;
      }

      const delta = Math.min(time - lastTimeRef.current, 100);
      const amount = (scrollSpeed * delta) / 16;
      const newTop = Math.min(cur + amount, max);
      setScrollTop(currentRoot, newTop);

      lastTimeRef.current = time;
      autoScrollFrameRef.current = requestAnimationFrame(step);
    };

    autoScrollFrameRef.current = requestAnimationFrame(step);

    return () => {
      isAutoScrollingRef.current = false;
      if (autoScrollFrameRef.current) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    };
  }, [
    isAutoScrolling,
    scrollSpeed,
    getRootForScroll,
    loadNextChapter,
    getMaxScroll,
    getScrollTop,
    setScrollTop,
  ]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoScrollFrameRef.current)
        cancelAnimationFrame(autoScrollFrameRef.current);
      if (userScrollTimeoutRef.current)
        clearTimeout(userScrollTimeoutRef.current);
    };
  }, []);

  // Toggle auto-scroll: choose proper root and start only if scrollable (or trigger load next)
  function toggleAutoScroll() {
    const root = getRootForScroll();
    const max = getMaxScroll(root);
    const canScroll = max > 12;

    if (!canScroll) {
      loadNextChapter();
      setShowSpeedControl(true);
      return;
    }

    const newValue = !isAutoScrollingRef.current;
    isAutoScrollingRef.current = newValue;
    setIsAutoScrolling(newValue);
    if (newValue) {
      // Starting auto-scroll: keep speed control visible if it was open
      setControlsVisible(true);
      isUserScrollingRef.current = false;
      lastTimeRef.current = performance.now();
    }
  }

  // Global click/touch handler to toggle visibility of floating controls
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;

      // Jika klik berasal dari tombol atau UI control → abaikan
      if (
        controlsWrapperRef.current &&
        controlsWrapperRef.current.contains(target)
      )
        return;

      // Jika klik berasal dari area reader → abaikan (sesuai logicmu sekarang)
      if (containerRef.current && containerRef.current.contains(target)) return;

      // == Double-click logic ==
      clickCounterRef.current += 1;

      // Reset setelah 300ms jika tidak jadi double-click
      setTimeout(() => {
        clickCounterRef.current = 0;
      }, 300);

      // Jika belum 2x klik → jangan lakukan apa pun
      if (clickCounterRef.current < 2) return;

      // Jika sudah 2x klik → toggle
      setControlsVisible((prev) => !prev);

      // Reset counter
      clickCounterRef.current = 0;
    };

    document.addEventListener("click", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    document.addEventListener("pointerdown", handler);

    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("pointerdown", handler);
    };
  }, []);

  useEffect(() => {
    if (!pendingInitialScroll.current) return;
    const chapterNodes = pageRefs.current[initialChapterNumber];
    const targetNode =
      chapterNodes?.[Math.max(0, initialPageNumber - 1)] ?? null;
    if (!targetNode) return;
    // still pending; perform scroll then mark finished
    requestAnimationFrame(() => {
      try {
        targetNode.scrollIntoView({ behavior: "auto", block: "start" });
      } catch {
        targetNode.scrollIntoView(true);
      }
      pendingInitialScroll.current = false;
      // after scrolling, force an active calc to make sure activePage matches visual
      requestAnimationFrame(() => {
        updateActiveFromScroll();
      });
    });
  }, [
    initialChapterNumber,
    initialPageNumber,
    chaptersWithPages,
    visibleChapters,
    updateActiveFromScroll,
  ]);

  useEffect(() => {
    if (!comic?.id || !onProgress) return;

    // If initial scroll hasn't been completed yet, postpone emitting progress
    if (pendingInitialScroll.current) {
      const pagesForActive = chaptersWithPages[activeChapter];
      if (!pagesForActive || !pagesForActive.pages) {
        // not ready yet — skip emitting
        return;
      }
    }

    onProgress(comic.id, activeChapter, activePage);
  }, [activeChapter, activePage, comic?.id, onProgress, chaptersWithPages]);

  const sortedVisibleChapters = useMemo(
    () =>
      [...visibleChapters]
        .map((number) => {
          const chapter = findChapter(number);
          if (!chapter) return null;
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

  // Ensure we recalc active page after new pages are rendered
  useEffect(() => {
    // run on next frame so DOM nodes exist
    requestAnimationFrame(() => {
      updateActiveFromScroll();
    });
  }, [chaptersWithPages, visibleChapters, updateActiveFromScroll]);

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
                  <span>
                    Chapter {chapter.number || chapter.chapter_number}
                  </span>
                  <span>
                    {loadingChapters.has(normalizedNumber)
                      ? "Memuat..."
                      : chapter.pages
                      ? `${chapter.pages.length} halaman`
                      : "Memuat halaman..."}
                  </span>
                </div>
                <div className="flex flex-col">
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
                        className="overflow-hidden dark:bg-zinc-900"
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
                          unoptimized
                        />
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

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {controlsVisible && (
          <div
            ref={controlsWrapperRef}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="flex flex-col items-end gap-3"
          >
            {showSpeedControl && (
              <div className="flex items-center gap-3 rounded-full bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  Kecepatan:
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={scrollSpeed}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                  className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-zinc-300 dark:bg-zinc-700"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                      ((scrollSpeed - 0.5) / 10) * 100
                    }%, #d1d5db ${
                      ((scrollSpeed - 0.5) / 4.5) * 100
                    }%, #d1d5db 100%)`,
                  }}
                />
                <span className="min-w-10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 text-center">
                  {scrollSpeed.toFixed(1)}x
                </span>
                {!isAutoScrolling && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSpeedControl(false);
                    }}
                    className="ml-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    title="Tutup"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              {!showSpeedControl && !isAutoScrolling && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedControl(true);
                  }}
                  className="flex items-center justify-center rounded-full bg-zinc-800/90 px-3 py-2.5 text-xs font-medium text-white shadow-lg transition-all hover:scale-105 active:scale-95 dark:bg-white/90 dark:text-zinc-900"
                  title="Pengaturan kecepatan"
                >
                  ⚙️
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAutoScroll();
                }}
                className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition-all hover:scale-105 active:scale-95 ${
                  isAutoScrolling
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                }`}
                title={
                  isAutoScrolling ? "Hentikan auto-scroll" : "Mulai auto-scroll"
                }
              >
                <span className="text-lg">{isAutoScrolling ? "⏸" : "▶"}</span>
                <span>{isAutoScrolling ? "Pause" : "Auto Scroll"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
