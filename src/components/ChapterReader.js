"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getChapterWithPages } from "@/data/comics";
import {
  animate,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";

const BOTTOM_BUFFER = 180;
const MAX_IMAGE_WIDTH = 900;
const MOBILE_BREAKPOINT = 768;
const EAGER_PAGES = 3;
const BASE_SPEED_PX_PER_SEC = 200; // base pixels per second at scrollSpeed = 1

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

  // Auto-scroll & UI
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1); // multiplier
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  const [fpsLimit, setFpsLimit] = useState(60); // kept for UI parity

  // Controls visibility: when hidden on mobile they should be fully invisible
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Realtime refs
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef(null);
  const isAutoScrollingRef = useRef(false);

  // Framer Motion refs/values
  const motionPos = useMotionValue(0); // raw animated value
  const motionSpring = useSpring(motionPos, { stiffness: 200, damping: 30 }); // smoothing spring
  const fmAnimationRef = useRef(null); // holds current animation control (has stop)
  const continuousLoopAbortRef = useRef(false);
  const reducedMotion = useReducedMotion();

  // Intersection / observation
  const viewportObserverRef = useRef(null);
  const containerObserverRef = useRef(null);
  const lastReportedRef = useRef({ chapter: null, page: null });
  const pendingObserveQueue = useRef([]);
  const touchStartRef = useRef(null);
  const touchThreshold = { maxTime: 300, maxMove: 10 };
  const controlsWrapperRef = useRef(null);

  // helper: determine root (container vs window)
  const getRootForScroll = useCallback(() => {
    const c = containerRef.current;
    if (c && c.scrollHeight - c.clientHeight > 8) return c;
    return document.scrollingElement || document.documentElement || window;
  }, []);

  const getScrollTop = useCallback((root) => {
    if (!root) return 0;
    if (root === window)
      return window.scrollY || document.documentElement.scrollTop || 0;
    if (root === document.scrollingElement || root === document.documentElement)
      return document.documentElement.scrollTop || document.body.scrollTop || 0;
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
    if (
      root === window ||
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

  // --- chapters loading ---
  const findChapter = useCallback(
    (number) => {
      const target = toNumber(number);
      if (target === null) return null;
      return (comic?.chapters || []).find(
        (ch) => toNumber(ch.number ?? ch.chapter_number) === target
      );
    },
    [comic]
  );

  const loadChapterPages = useCallback(
    async (chapterNumber) => {
      const chapter = findChapter(chapterNumber);
      if (!chapter) return;
      const chapterId = chapter.id || chapter.chapter_id;
      if (!chapterId) return;
      if (
        chaptersWithPages[chapterNumber] ||
        loadingChapters.has(chapterNumber)
      )
        return;

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
            [chapterNumber]: { ...chapter, pages: chapterData.pages },
          }));
        }
      } catch (err) {
        console.error("Error loading chapter", chapterNumber, err);
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

  useEffect(() => {
    visibleChapters.forEach((n) => loadChapterPages(n));
  }, [visibleChapters, loadChapterPages]);

  useEffect(() => {
    if (!containerRef.current) return;
    if ((initialPageNumber ?? 1) <= 1) {
      try {
        containerRef.current.scrollTo({ top: 0, behavior: "auto" });
      } catch {
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

      // kumpulkan semua nomor chapter yang lebih besar dari currentMax
      const candidates = (comic?.chapters || [])
        .map((ch) => toNumber(ch.number ?? ch.chapter_number))
        .filter((num) => num !== null && num > currentMax);

      if (!candidates || candidates.length === 0) return chapters;

      // ambil yang terdekat (paling kecil > currentMax)
      const nextChapterNumber = Math.min(...candidates);
      if (!nextChapterNumber) return chapters;
      if (chapters.includes(nextChapterNumber)) return chapters;
      return [...chapters, nextChapterNumber].sort((a, b) => a - b);
    });
  }, [comic?.chapters]);

  // IntersectionObserver for active page
  const intersectionCallback = useCallback((entries) => {
    let best = null;
    entries.forEach((entry) => {
      const t = entry.target;
      if (!t || !t.dataset) return;
      const ch = Number(t.dataset.chapter),
        pg = Number(t.dataset.page),
        ratio = entry.intersectionRatio;
      if (entry.isIntersecting || ratio > 0) {
        if (!best || ratio > best.ratio)
          best = { ratio, chapter: ch, page: pg };
      }
    });
    if (best) {
      const last = lastReportedRef.current;
      if (last.chapter !== best.chapter || last.page !== best.page) {
        lastReportedRef.current = { chapter: best.chapter, page: best.page };
        setActiveChapter(best.chapter);
        setActivePage(best.page);
      }
    }
  }, []);

  useEffect(() => {
    if (!viewportObserverRef.current) {
      viewportObserverRef.current = new IntersectionObserver(
        intersectionCallback,
        {
          root: null,
          rootMargin: "0px 0px -40% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );
    }
    return () => {
      if (viewportObserverRef.current) {
        viewportObserverRef.current.disconnect();
        viewportObserverRef.current = null;
      }
    };
  }, [intersectionCallback]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      if (containerObserverRef.current) {
        containerObserverRef.current.disconnect();
        containerObserverRef.current = null;
      }
      return;
    }
    if (!containerObserverRef.current) {
      containerObserverRef.current = new IntersectionObserver(
        intersectionCallback,
        {
          root: container,
          rootMargin: "0px 0px -40% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );
    }
    return () => {
      if (containerObserverRef.current) {
        containerObserverRef.current.disconnect();
        containerObserverRef.current = null;
      }
    };
  }, [containerRef.current, intersectionCallback]);

  useEffect(() => {
    if (!pendingObserveQueue.current.length) return;
    while (pendingObserveQueue.current.length) {
      const node = pendingObserveQueue.current.shift();
      if (!node) continue;
      try {
        const useContainer =
          containerRef.current && containerRef.current.contains(node);
        if (useContainer && containerObserverRef.current)
          containerObserverRef.current.observe(node);
        else if (viewportObserverRef.current)
          viewportObserverRef.current.observe(node);
      } catch (e) {}
    }
  }, [chaptersWithPages, visibleChapters]);

  // fallback active calc
  const updateActiveFromScroll = useCallback(() => {
    const root = containerRef.current;
    const hasContainer = root && root.scrollHeight - root.clientHeight > 8;
    const vh =
      typeof window !== "undefined"
        ? window.innerHeight || document.documentElement.clientHeight || 0
        : 0;
    const rootRect = root
      ? root.getBoundingClientRect()
      : { top: 0, bottom: vh };
    const effTop = hasContainer ? rootRect.top : 0;
    const effBottom = hasContainer ? rootRect.bottom : vh;
    let best = null;
    Object.entries(pageRefs.current).forEach(([ch, nodes]) => {
      nodes.forEach((node, idx) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const vtop = Math.max(rect.top, effTop);
        const vbot = Math.min(rect.bottom, effBottom);
        const vhgt = vbot - vtop;
        if (vhgt <= 0) return;
        const ratio = vhgt / rect.height;
        if (!best || ratio > best.ratio)
          best = { ratio, chapter: Number(ch), page: idx + 1 };
      });
    });
    if (best) {
      if (!Number.isNaN(best.chapter)) setActiveChapter(best.chapter);
      if (!Number.isNaN(best.page)) setActivePage(best.page);
    }
  }, []);

  // lightweight scroll handler
  const handleScroll = useCallback(
    (e) => {
      const root = getRootForScroll();
      const st = getScrollTop(root);
      const max = getMaxScroll(root);
      if (!isAutoScrollingRef.current) {
        if (!isUserScrollingRef.current) {
          isUserScrollingRef.current = true;
          if (userScrollTimeoutRef.current)
            clearTimeout(userScrollTimeoutRef.current);
          userScrollTimeoutRef.current = setTimeout(() => {
            isUserScrollingRef.current = false;
          }, 800);
          if (isAutoScrollingRef.current) {
            isAutoScrollingRef.current = false;
            setIsAutoScrolling(false);
          }
        }
      }
      if (max - st <= BOTTOM_BUFFER) loadNextChapter();
    },
    [getRootForScroll, getScrollTop, getMaxScroll, loadNextChapter]
  );

  // interrupt auto-scroll on user interaction (wheel/touch)
  // We'll call stopContinuousAutoScroll() on interaction
  const stopContinuousAutoScroll = useCallback(() => {
    continuousLoopAbortRef.current = true;
    if (
      fmAnimationRef.current &&
      typeof fmAnimationRef.current.stop === "function"
    ) {
      try {
        fmAnimationRef.current.stop();
      } catch (e) {}
      fmAnimationRef.current = null;
    }
    isAutoScrollingRef.current = false;
    setIsAutoScrolling(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const onWheel = () => {
      if (isAutoScrollingRef.current) {
        stopContinuousAutoScroll();
        isUserScrollingRef.current = true;
      }
    };
    const onTouchStart = () => {
      if (isAutoScrollingRef.current) {
        stopContinuousAutoScroll();
        isUserScrollingRef.current = true;
      }
    };
    if (container) {
      container.addEventListener("wheel", onWheel, { passive: true });
      container.addEventListener("touchstart", onTouchStart, { passive: true });
    }
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      if (container) {
        container.removeEventListener("wheel", onWheel);
        container.removeEventListener("touchstart", onTouchStart);
      }
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, [stopContinuousAutoScroll]);

  useEffect(() => {
    const onWindow = (e) => handleScroll(e);
    window.addEventListener("scroll", onWindow, { passive: true });
    return () => window.removeEventListener("scroll", onWindow);
  }, [handleScroll]);

  // ---------- Framer Motion continuous auto-scroll ----------
  // Keep spring -> DOM sync
  useEffect(() => {
    const unsubscribe = motionSpring.on("change", (v) => {
      const root = getRootForScroll();
      const writeTo = Math.round(v || 0);
      try {
        if (
          root === window ||
          root === document.scrollingElement ||
          root === document.documentElement
        ) {
          window.scrollTo({ top: writeTo });
        } else {
          root.scrollTo({ top: writeTo });
        }
      } catch {
        setScrollTop(root, writeTo);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [motionSpring, getRootForScroll, setScrollTop]);

  // helper - wait until max scroll increases (new content loaded) or timeout
  const waitForScrollIncrease = useCallback(
    (prevMax, timeoutMs = 10000, pollInterval = 200) =>
      new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          const root = getRootForScroll();
          const nowMax = getMaxScroll(root);
          if (nowMax > prevMax + 2) {
            resolve(true);
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            resolve(false);
            return;
          }
          if (!isAutoScrollingRef.current) {
            // if auto-scroll was canceled externally, abort
            resolve(false);
            return;
          }
          setTimeout(check, pollInterval);
        };
        check();
      }),
    [getRootForScroll, getMaxScroll]
  );

  // continuous loop: animate to bottom, when reached loadNextChapter(), wait for new content, continue
  const startContinuousAutoScroll = useCallback(
    async ({ speedMultiplier = 1 } = {}) => {
      if (reducedMotion) {
        // respect reduced motion preference: do nothing
        return;
      }

      // cancel any existing
      continuousLoopAbortRef.current = false;
      if (
        fmAnimationRef.current &&
        typeof fmAnimationRef.current.stop === "function"
      ) {
        try {
          fmAnimationRef.current.stop();
        } catch (e) {}
        fmAnimationRef.current = null;
      }

      const root = getRootForScroll();
      let startPos = getScrollTop(root);
      let maxPos = getMaxScroll(root);

      // if not enough scrollable area, try to load next chapter and wait
      if (maxPos - startPos <= 5) {
        loadNextChapter();
        const increased = await waitForScrollIncrease(maxPos, 8000);
        if (!increased) {
          // nothing to scroll; abort
          return;
        }
        maxPos = getMaxScroll(root);
      }

      isAutoScrollingRef.current = true;
      setIsAutoScrolling(true);
      if (isMobile) setControlsVisible(false);

      // we use a loop that continues while isAutoScrollingRef true and not aborted
      while (isAutoScrollingRef.current && !continuousLoopAbortRef.current) {
        // re-evaluate root, start, max
        const currentRoot = getRootForScroll();
        startPos = getScrollTop(currentRoot);
        maxPos = getMaxScroll(currentRoot);

        // nothing to scroll => try load next and wait
        if (maxPos - startPos <= 5) {
          // If no more chapters to load, break
          loadNextChapter();
          const increased = await waitForScrollIncrease(maxPos, 10000);
          if (!increased) {
            // no new content or user stopped => break loop
            break;
          }
          // continue to next iteration to recalc start/max
          continue;
        }

        // compute duration (seconds) based on px/sec
        const distance = Math.max(0, maxPos - startPos);
        const pxPerSec = BASE_SPEED_PX_PER_SEC * Math.max(0.1, speedMultiplier);
        const durationSec = Math.max(0.2, distance / pxPerSec);

        // create a promise that resolves onComplete or rejects on stop
        const animPromise = new Promise((resolve) => {
          // cancel older animation if present
          if (
            fmAnimationRef.current &&
            typeof fmAnimationRef.current.stop === "function"
          ) {
            try {
              fmAnimationRef.current.stop();
            } catch (e) {}
            fmAnimationRef.current = null;
          }

          fmAnimationRef.current = animate(startPos, maxPos, {
            duration: durationSec,
            ease: "linear",
            onUpdate: (v) => {
              // write into motionPos; spring will smooth then write to DOM
              motionPos.set(v);
            },
            onComplete: () => {
              fmAnimationRef.current = null;
              resolve(true);
            },
          });
        });

        // await completion or abort early when user interrupts
        const finished = await Promise.race([
          animPromise,
          new Promise((resolve) => {
            const poll = () => {
              if (
                !isAutoScrollingRef.current ||
                continuousLoopAbortRef.current
              ) {
                // stopped externally: stop animation and resolve false
                if (
                  fmAnimationRef.current &&
                  typeof fmAnimationRef.current.stop === "function"
                ) {
                  try {
                    fmAnimationRef.current.stop();
                  } catch (e) {}
                  fmAnimationRef.current = null;
                }
                resolve(false);
                return;
              }
              setTimeout(poll, 100);
            };
            poll();
          }),
        ]);

        if (!finished) break;

        // reached bottom: attempt to load next chapter and continue loop
        loadNextChapter();

        // wait for scroll height to increase (new pages loaded), or timeout
        const newMax = getMaxScroll(getRootForScroll());
        const increased = await waitForScrollIncrease(newMax, 10000);
        if (!increased) {
          // no new content loaded OR user stopped => break
          break;
        }

        // loop continues automatically and will recalc start/max
      }

      // cleanup after loop
      if (
        fmAnimationRef.current &&
        typeof fmAnimationRef.current.stop === "function"
      ) {
        try {
          fmAnimationRef.current.stop();
        } catch (e) {}
        fmAnimationRef.current = null;
      }
      isAutoScrollingRef.current = false;
      setIsAutoScrolling(false);
      if (!isMobile) setControlsVisible(true);
    },
    [
      reducedMotion,
      getRootForScroll,
      getScrollTop,
      getMaxScroll,
      loadNextChapter,
      waitForScrollIncrease,
      motionPos,
      isMobile,
    ]
  );

  const stopAutoScroll = useCallback(() => {
    continuousLoopAbortRef.current = true;
    if (
      fmAnimationRef.current &&
      typeof fmAnimationRef.current.stop === "function"
    ) {
      try {
        fmAnimationRef.current.stop();
      } catch (e) {}
      fmAnimationRef.current = null;
    }
    isAutoScrollingRef.current = false;
    setIsAutoScrolling(false);
    if (!isMobile) setControlsVisible(true);
  }, [isMobile]);

  // toggle wrapper
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
    if (newValue) {
      // start continuous auto-scroll
      startContinuousAutoScroll({ speedMultiplier: scrollSpeed });
    } else {
      stopAutoScroll();
    }
  }

  // --- container touch handlers (RELIABLE while auto-scroll running) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e) => {
      const t = e.touches && e.touches[0];
      touchStartRef.current = {
        x: t ? t.clientX : 0,
        y: t ? t.clientY : 0,
        time: performance.now(),
      };
    };

    const onTouchEnd = (e) => {
      const s = touchStartRef.current;
      const t = e.changedTouches && e.changedTouches[0];
      const x = t ? t.clientX : 0,
        y = t ? t.clientY : 0;
      const dx = Math.abs(x - (s.x || 0)),
        dy = Math.abs(y - (s.y || 0));
      const dt = performance.now() - (s.time || 0);

      // criteria for tap: short duration & little movement
      if (
        dt < touchThreshold.maxTime &&
        Math.max(dx, dy) < touchThreshold.maxMove
      ) {
        // ignore taps on controls area
        const target = e.target;
        if (
          controlsWrapperRef.current &&
          controlsWrapperRef.current.contains(target)
        )
          return;

        // toggle controlsVisible (show/hide)
        setControlsVisible((prev) => !prev);

        // tapping does NOT pause auto-scroll by default (user can press Pause)
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [touchThreshold.maxMove, touchThreshold.maxTime]);

  // initial scroll into view
  useEffect(() => {
    if (!pendingInitialScroll.current) return;
    const chapterNodes = pageRefs.current[initialChapterNumber];
    const targetNode =
      chapterNodes?.[Math.max(0, initialPageNumber - 1)] ?? null;
    if (!targetNode) return;
    requestAnimationFrame(() => {
      try {
        targetNode.scrollIntoView({ behavior: "auto", block: "start" });
      } catch {
        targetNode.scrollIntoView(true);
      }
      pendingInitialScroll.current = false;
      setTimeout(() => updateActiveFromScroll(), 50);
    });
  }, [
    initialChapterNumber,
    initialPageNumber,
    chaptersWithPages,
    visibleChapters,
    updateActiveFromScroll,
  ]);

  // emit progress
  useEffect(() => {
    if (!comic?.id || !onProgress) return;
    if (pendingInitialScroll.current) {
      const pagesForActive = chaptersWithPages[activeChapter];
      if (!pagesForActive || !pagesForActive.pages) return;
    }
    onProgress(comic.id, activeChapter, activePage);
  }, [activeChapter, activePage, comic?.id, onProgress, chaptersWithPages]);

  const sortedVisibleChapters = useMemo(() => {
    return [...visibleChapters]
      .map((num) => {
        const ch = findChapter(num);
        if (!ch) return null;
        return chaptersWithPages[num] || ch;
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          (toNumber(a.number ?? a.chapter_number) ?? 0) -
          (toNumber(b.number ?? b.chapter_number) ?? 0)
      );
  }, [visibleChapters, findChapter, chaptersWithPages]);

  // attach nodes for observer after render
  useEffect(() => {
    requestAnimationFrame(() => {
      Object.values(pageRefs.current).forEach((nodes) => {
        if (!nodes) return;
        nodes.forEach((n) => {
          if (n) pendingObserveQueue.current.push(n);
        });
      });
    });
  }, [chaptersWithPages, visibleChapters]);

  // UI hide when mobile + auto-scroll OR user hid controls
  const hideUiOnMobile = isMobile && (!controlsVisible || isAutoScrolling);
  const containerPadding = isMobile ? "px-0 py-0" : "px-4 py-10 sm:px-8";

  // small effect to detect mobile width
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      if (
        fmAnimationRef.current &&
        typeof fmAnimationRef.current.stop === "function"
      )
        fmAnimationRef.current.stop();
      if (userScrollTimeoutRef.current)
        clearTimeout(userScrollTimeoutRef.current);
      if (viewportObserverRef.current) viewportObserverRef.current.disconnect();
      if (containerObserverRef.current)
        containerObserverRef.current.disconnect();
      viewportObserverRef.current = null;
      containerObserverRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <header
        className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/5 px-4 py-3 text-sm font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-200 transition-all duration-200 ${
          hideUiOnMobile
            ? "opacity-0 pointer-events-none h-0 overflow-hidden"
            : "opacity-100"
        }`}
        aria-hidden={hideUiOnMobile}
      >
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

      {/* Reader container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`relative flex-1 overflow-y-auto overflow-x-hidden ${
          hideUiOnMobile ? "h-screen" : ""
        } rounded-3xl border border-zinc-200 bg-white shadow-inner dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <div className={`flex flex-col gap-12 ${containerPadding}`}>
          {sortedVisibleChapters.map((chapter) => {
            const normalizedNumber =
              toNumber(chapter.number ?? chapter.chapter_number) ?? 0;
            return (
              <section
                key={chapter.id || chapter.chapter_id || normalizedNumber}
                data-chapter={normalizedNumber}
                className="space-y-6"
              >
                <div
                  className={`sticky top-4 z-20 flex items-center justify-between rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-700 shadow dark:bg-zinc-900/90 dark:text-zinc-200 ${
                    hideUiOnMobile ? "opacity-0 pointer-events-none" : ""
                  }`}
                >
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

                <div
                  className={`flex flex-col ${
                    isMobile ? "items-stretch" : "items-center"
                  }`}
                >
                  {loadingChapters.has(normalizedNumber) ? (
                    <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Memuat halaman chapter...
                    </div>
                  ) : chapter.pages && chapter.pages.length > 0 ? (
                    chapter.pages.map((pageUrl, index) => {
                      const isEager = index < EAGER_PAGES;
                      return (
                        <figure
                          key={pageUrl}
                          ref={(node) => {
                            if (!pageRefs.current[normalizedNumber])
                              pageRefs.current[normalizedNumber] = [];
                            if (node) {
                              pageRefs.current[normalizedNumber][index] = node;
                              pendingObserveQueue.current.push(node);
                            } else if (pageRefs.current[normalizedNumber])
                              pageRefs.current[normalizedNumber][index] =
                                undefined;
                          }}
                          data-chapter={normalizedNumber}
                          data-page={index + 1}
                          style={{ display: "block", width: "100%" }}
                        >
                          {/* Full-bleed trick on mobile to avoid cropping by parent container */}
                          <div
                            style={{
                              width: isMobile ? "100vw" : "100%",
                              maxWidth: isMobile
                                ? "100vw"
                                : `${MAX_IMAGE_WIDTH}px`,
                              marginLeft: isMobile ? "calc(50% - 50vw)" : "0",
                              marginRight: isMobile ? "calc(50% - 50vw)" : "0",
                              margin: isMobile ? "0" : "0 auto",
                              display: "block",
                            }}
                          >
                            <Image
                              src={pageUrl || "/placeholder.svg"}
                              alt={`Halaman ${index + 1} Chapter ${
                                chapter.number || chapter.chapter_number
                              }`}
                              width={900}
                              height={1400}
                              style={{
                                width: "100%",
                                height: "auto",
                                objectFit: "contain",
                                display: "block",
                                willChange: "transform",
                              }}
                              className="bg-zinc-100 dark:bg-zinc-800"
                              loading={isEager ? "eager" : "lazy"}
                              sizes={
                                isMobile
                                  ? "100vw"
                                  : "(max-width: 768px) 100vw, 80vw"
                              }
                              priority={isEager}
                              unoptimized
                            />
                          </div>
                        </figure>
                      );
                    })
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

      {/* Floating controls */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 transition-all duration-200 ${
          hideUiOnMobile ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        aria-hidden={hideUiOnMobile}
      >
        {controlsVisible && (
          <div
            ref={controlsWrapperRef}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="flex flex-col items-end gap-3"
          >
            {showSpeedControl && (
              <div className="flex flex-col gap-2 rounded-full bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Kecepatan:
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={scrollSpeed}
                    onChange={(e) =>
                      setScrollSpeed(Number.parseFloat(e.target.value))
                    }
                    className="h-2 w-40 cursor-pointer appearance-none rounded-full bg-zinc-300 dark:bg-zinc-700"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                        ((scrollSpeed - 0.5) / 10) * 100
                      }%, #d1d5db ${(((scrollSpeed - 0.5) / 4.5) * 100).toFixed(
                        2
                      )}%, #d1d5db 100%)`,
                    }}
                  />
                  <span className="min-w-10 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {scrollSpeed.toFixed(1)}x
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    FPS:
                  </label>
                  <select
                    value={fpsLimit}
                    onChange={(e) => setFpsLimit(Number(e.target.value))}
                    className="text-xs rounded-md px-2 py-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  >
                    <option value={60}>60</option>
                    <option value={45}>45</option>
                    <option value={30}>30</option>
                  </select>
                  <div className="ml-auto">
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
                </div>
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
