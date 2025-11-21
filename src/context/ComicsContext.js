"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  getComicById,
  searchComics,
  getComics,
  initializeComics,
} from "@/data/comics";

const STORAGE_KEY = "komik-reader-state";

const initialState = {
  library: [],
  history: [],
};

function normalizeHistoryArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((h) => {
      if (!h) return null;
      const comicId = h.comicId != null ? String(h.comicId) : null;
      if (!comicId) return null;
      const chapterNumber = h.chapterNumber ?? h.chapter ?? null;
      const pageNumber = h.pageNumber ?? h.page ?? h.pageNum ?? h.pageNo ?? 1;
      return {
        comicId,
        chapterNumber: chapterNumber == null ? null : Number(chapterNumber),
        pageNumber: Number(pageNumber || 1),
        updatedAt: h.updatedAt || new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function persistMergedState(nextState) {
  try {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let base = {};
    if (raw) {
      try {
        base = JSON.parse(raw) || {};
      } catch (e) {
        base = {};
      }
    }
    const merged = { ...base, ...nextState };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    // ignore
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE": {
      try {
        const payload = action.payload || {};
        const normalized = Array.isArray(payload.history)
          ? normalizeHistoryArray(payload.history)
          : state.history;
        return { ...state, ...payload, history: normalized };
      } catch (e) {
        return { ...state, ...(action.payload || {}) };
      }
    }

    case "HYDRATE_PERSIST": {
      try {
        const payload = action.payload || {};
        const normalized = Array.isArray(payload.history)
          ? normalizeHistoryArray(payload.history)
          : state.history;
        const nextState = { ...state, ...payload, history: normalized };
        persistMergedState(nextState);
        return nextState;
      } catch (e) {
        return { ...state, ...(action.payload || {}) };
      }
    }

    case "RECORD_HISTORY": {
      const payload = action.payload || {};
      const { comicId, chapterNumber, pageNumber } = payload;
      if (!comicId) return state;

      const existing = state.history.find(
        (item) => item.comicId === String(comicId)
      );

      const nextChapter = chapterNumber ?? existing?.chapterNumber ?? null;
      const nextPage = pageNumber ?? existing?.pageNumber ?? 1;

      if (
        existing &&
        existing.chapterNumber === nextChapter &&
        existing.pageNumber === nextPage
      ) {
        return state;
      }

      const nextHistoryEntry = {
        comicId: String(comicId),
        chapterNumber: nextChapter,
        pageNumber: nextPage,
        updatedAt: new Date().toISOString(),
      };

      let history;
      if (existing) {
        history = state.history
          .map((item) =>
            item.comicId === String(comicId) ? nextHistoryEntry : item
          )
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      } else {
        history = [nextHistoryEntry, ...state.history].slice(0, 50);
      }

      const nextState = { ...state, history };
      persistMergedState(nextState);
      return nextState;
    }

    case "CLEAR_HISTORY":
      return { ...state, history: [] };

    case "ADD_TO_LIBRARY":
      if (state.library.includes(action.payload)) return state;
      return { ...state, library: [...state.library, action.payload] };

    case "REMOVE_FROM_LIBRARY":
      return {
        ...state,
        library: state.library.filter((id) => id !== action.payload),
      };

    default:
      return state;
  }
}

const ComicsContext = createContext(undefined);

export function ComicsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isReady, setIsReady] = useState(false);
  const [comics, setComics] = useState([]);
  const [comicsLoading, setComicsLoading] = useState(true);
  const hasHydrated = useRef(false);
  const lastRecordedRef = useRef(null);

  // Initialize comics cache
  useEffect(() => {
    async function loadComics() {
      try {
        await initializeComics();
        const loaded = await getComics();
        setComics(loaded);
      } catch (e) {
        console.error("Error loading comics:", e);
      } finally {
        setComicsLoading(false);
      }
    }
    loadComics();
  }, []);

  // Initial hydration: prefer komik:lastProgress and persist immediately
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasHydrated.current) return;

    let parsed = {};

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) || {} : {};

      try {
        const lpRaw = window.localStorage.getItem("komik:lastProgress");
        if (lpRaw) {
          const lp = JSON.parse(lpRaw);
          if (lp && lp.comicId) {
            const normalizedTop = {
              comicId: String(lp.comicId),
              chapterNumber: lp.chapterNumber ?? lp.chapter ?? null,
              pageNumber: lp.pageNumber ?? lp.page ?? lp.pageNum ?? 1,
              updatedAt: lp.updatedAt || new Date().toISOString(),
            };
            const rest = Array.isArray(parsed.history)
              ? parsed.history.filter(
                  (h) => String(h?.comicId) !== String(lp.comicId)
                )
              : [];
            parsed = { ...parsed, history: [normalizedTop, ...rest] };
            console.debug(
              "[ComicsContext] Initial hydrate: taking lastProgress as history[0]:",
              normalizedTop
            );
            // Immediately persist the merged state to localStorage so history is updated
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
              console.debug(
                "[ComicsContext] Initial hydrate: persisted merged history to localStorage"
              );
            } catch (e) {
              console.warn(
                "Failed to persist merged history during hydrate:",
                e
              );
            }
          }
        }
      } catch (e) {
        // ignore lastProgress parse errors
      }

      dispatch({ type: "HYDRATE_PERSIST", payload: parsed });
    } catch (err) {
      console.warn("Failed to hydrate from localStorage", err);
    } finally {
      hasHydrated.current = true;
      setIsReady(true);
      console.debug(
        "[ComicsContext] Hydration complete - isReady=true, history entries:",
        parsed?.history?.length || 0
      );
    }
  }, []);

  // Listen for reader merge events; prefer event.detail.merged when present
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (ev) => {
      try {
        let parsed = null;
        if (ev && ev.detail && ev.detail.merged) {
          parsed = ev.detail.merged;
        } else {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          parsed = JSON.parse(raw) || {};
        }

        // ALWAYS prefer komik:lastProgress as top history (strongest guarantee of recency)
        try {
          const lpRaw = window.localStorage.getItem("komik:lastProgress");
          if (lpRaw) {
            const lp = JSON.parse(lpRaw);
            if (lp && lp.comicId) {
              const normalizedTop = {
                comicId: String(lp.comicId),
                chapterNumber: lp.chapterNumber ?? lp.chapter ?? null,
                pageNumber: lp.pageNumber ?? lp.page ?? lp.pageNum ?? 1,
                updatedAt: lp.updatedAt || new Date().toISOString(),
              };
              const rest = Array.isArray(parsed.history)
                ? parsed.history.filter(
                    (h) => String(h?.comicId) !== String(lp.comicId)
                  )
                : [];
              parsed = { ...parsed, history: [normalizedTop, ...rest] };
              console.debug(
                "[ComicsContext] Event: forcing lastProgress as top history:",
                normalizedTop
              );
            }
          }
        } catch (e) {
          // ignore
        }

        if (!parsed) return;
        // apply and persist
        if (ev && ev.detail && ev.detail.merged) {
          dispatch({ type: "HYDRATE_PERSIST", payload: parsed });
        } else {
          dispatch({ type: "HYDRATE", payload: parsed });
        }

        // ensure in-memory reducer has top entry (force RECORD_HISTORY)
        try {
          const top = Array.isArray(parsed.history) ? parsed.history[0] : null;
          if (top && top.comicId) {
            dispatch({
              type: "RECORD_HISTORY",
              payload: {
                comicId: top.comicId,
                chapterNumber: top.chapterNumber ?? top.chapter ?? null,
                pageNumber: top.pageNumber ?? top.page ?? 1,
              },
            });
          }
        } catch (e) {
          // ignore
        }
      } catch (err) {
        console.warn("Failed to handle komik:localstate-updated event", err);
      }
    };

    window.addEventListener("komik:localstate-updated", handler);
    return () =>
      window.removeEventListener("komik:localstate-updated", handler);
  }, []);

  // persist state changes after hydration
  useEffect(() => {
    if (!hasHydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to persist state to localStorage", e);
    }
  }, [state]);

  // After initial hydrate, ensure in-memory state also reflects komik:lastProgress
  useEffect(
    () => {
      if (typeof window === "undefined") return;
      if (!hasHydrated.current) return;

      try {
        const lpRaw = window.localStorage.getItem("komik:lastProgress");
        if (lpRaw) {
          const lp = JSON.parse(lpRaw);
          if (lp && lp.comicId) {
            const normalizedTop = {
              comicId: String(lp.comicId),
              chapterNumber: lp.chapterNumber ?? lp.chapter ?? null,
              pageNumber: lp.pageNumber ?? lp.page ?? lp.pageNum ?? 1,
              updatedAt: lp.updatedAt || new Date().toISOString(),
            };
            // Force the reducer to record this as the top-most history entry
            dispatch({
              type: "RECORD_HISTORY",
              payload: {
                comicId: normalizedTop.comicId,
                chapterNumber: normalizedTop.chapterNumber,
                pageNumber: normalizedTop.pageNumber,
              },
            });
            console.debug(
              "[ComicsContext] Post-hydrate: forced in-memory RECORD_HISTORY from komik:lastProgress",
              normalizedTop
            );
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    },
    [
      /* run once after hydrate completion */
    ]
  );

  // Listen for cross-tab localStorage changes to lastProgress or the main storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageHandler = (ev) => {
      try {
        if (!ev) return;
        if (ev.key === "komik:lastProgress" || ev.key === STORAGE_KEY) {
          // Prefer lastProgress as authoritative
          const lpRaw = window.localStorage.getItem("komik:lastProgress");
          if (lpRaw) {
            const lp = JSON.parse(lpRaw);
            if (lp && lp.comicId) {
              const normalizedTop = {
                comicId: String(lp.comicId),
                chapterNumber: lp.chapterNumber ?? lp.chapter ?? null,
                pageNumber: lp.pageNumber ?? lp.page ?? lp.pageNum ?? 1,
                updatedAt: lp.updatedAt || new Date().toISOString(),
              };
              // Persist merged state and update in-memory reducer
              try {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) || {} : {};
                const rest = Array.isArray(parsed.history)
                  ? parsed.history.filter(
                      (h) => String(h?.comicId) !== String(lp.comicId)
                    )
                  : [];
                const merged = { ...parsed, history: [normalizedTop, ...rest] };
                window.localStorage.setItem(
                  STORAGE_KEY,
                  JSON.stringify(merged)
                );
                dispatch({ type: "HYDRATE_PERSIST", payload: merged });
                // ensure in-memory reducer top entry
                dispatch({
                  type: "RECORD_HISTORY",
                  payload: {
                    comicId: normalizedTop.comicId,
                    chapterNumber: normalizedTop.chapterNumber,
                    pageNumber: normalizedTop.pageNumber,
                  },
                });
                console.debug(
                  "[ComicsContext] storage event: merged komik:lastProgress into state",
                  normalizedTop
                );
              } catch (e) {
                console.warn(
                  "Failed to merge lastProgress from storage event",
                  e
                );
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener("storage", storageHandler);
    return () => window.removeEventListener("storage", storageHandler);
  }, []);

  const addToLibrary = useCallback(
    (comicId) => dispatch({ type: "ADD_TO_LIBRARY", payload: comicId }),
    []
  );
  const removeFromLibrary = useCallback(
    (comicId) => dispatch({ type: "REMOVE_FROM_LIBRARY", payload: comicId }),
    []
  );

  const toggleLibrary = useCallback(
    (comicId) => {
      if (state.library.includes(comicId))
        dispatch({ type: "REMOVE_FROM_LIBRARY", payload: comicId });
      else dispatch({ type: "ADD_TO_LIBRARY", payload: comicId });
    },
    [state.library]
  );

  const recordHistory = useCallback(
    (comicId, chapterNumber, pageNumber = 1) => {
      if (!comicId) return;
      const key = `${String(comicId)}@${String(chapterNumber ?? "")}@${String(
        pageNumber ?? 1
      )}`;
      if (lastRecordedRef.current === key) return;
      lastRecordedRef.current = key;
      dispatch({
        type: "RECORD_HISTORY",
        payload: { comicId, chapterNumber, pageNumber },
      });
    },
    []
  );

  const forceRecordHistory = useCallback(
    (comicId, chapterNumber, pageNumber = 1) => {
      if (!comicId) return;
      dispatch({
        type: "RECORD_HISTORY",
        payload: { comicId, chapterNumber, pageNumber },
      });
    },
    []
  );

  useEffect(() => {
    if (Array.isArray(state.history) && state.history.length > 0) {
      const top = state.history[0];
      lastRecordedRef.current = `${String(top.comicId)}@${String(
        top.chapterNumber ?? ""
      )}@${String(top.pageNumber ?? 1)}`;
    } else {
      lastRecordedRef.current = null;
    }
  }, [state.history]);

  const [libraryComics, setLibraryComics] = useState([]);
  const [historyComics, setHistoryComics] = useState([]);

  useEffect(() => {
    async function loadLibraryComics() {
      const loaded = await Promise.all(
        state.library.map((id) => getComicById(id))
      );
      setLibraryComics(loaded.filter(Boolean));
    }
    if (state.library.length > 0) loadLibraryComics();
    else setLibraryComics([]);
  }, [state.library]);

  useEffect(() => {
    let mounted = true;
    async function loadHistoryComics() {
      console.debug(
        "[ComicsContext] loadHistoryComics: loading comic data for",
        state.history.length,
        "entries"
      );
      const loaded = await Promise.all(
        state.history.map(async (entry) => {
          try {
            if (!entry || !entry.comicId) return null;
            const comic = await getComicById(entry.comicId);
            if (!comic) {
              console.debug(
                "[ComicsContext] Failed to resolve comic for entry:",
                entry
              );
              return null;
            }
            return { ...entry, comic };
          } catch (e) {
            console.warn("[ComicsContext] Error loading history comic:", e);
            return null;
          }
        })
      );
      if (!mounted) return;
      const filtered = loaded.filter(Boolean);
      console.debug(
        "[ComicsContext] loadHistoryComics complete:",
        filtered.length,
        "entries loaded"
      );
      setHistoryComics(filtered);
    }
    if (state.history.length > 0) loadHistoryComics();
    else setHistoryComics([]);
    return () => {
      mounted = false;
    };
  }, [state.history]);

  const getLastProgress = useCallback(
    (comicId) => state.history.find((e) => e.comicId === String(comicId)),
    [state.history]
  );

  // Poll komik:lastProgress every second and force sync if changed
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasHydrated.current || !isReady) return;

    let lastSeen = null;
    let timer = null;

    const syncLastProgress = () => {
      try {
        const lpRaw = window.localStorage.getItem("komik:lastProgress");
        if (lpRaw && lpRaw !== lastSeen) {
          lastSeen = lpRaw;
          const lp = JSON.parse(lpRaw);
          if (lp && lp.comicId) {
            const normalizedTop = {
              comicId: String(lp.comicId),
              chapterNumber: lp.chapterNumber ?? lp.chapter ?? null,
              pageNumber: lp.pageNumber ?? lp.page ?? lp.pageNum ?? 1,
              updatedAt: lp.updatedAt || new Date().toISOString(),
            };
            // Merge into komik-reader-state
            const raw = window.localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) || {} : {};
            const rest = Array.isArray(parsed.history)
              ? parsed.history.filter(
                  (h) => String(h?.comicId) !== String(lp.comicId)
                )
              : [];
            const merged = { ...parsed, history: [normalizedTop, ...rest] };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            // Dispatch HYDRATE_PERSIST and RECORD_HISTORY
            dispatch({ type: "HYDRATE_PERSIST", payload: merged });
            dispatch({
              type: "RECORD_HISTORY",
              payload: {
                comicId: normalizedTop.comicId,
                chapterNumber: normalizedTop.chapterNumber,
                pageNumber: normalizedTop.pageNumber,
              },
            });
            console.debug(
              "[ComicsContext] Poll: forced komik:lastProgress into komik-reader-state and history",
              normalizedTop
            );
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    timer = setInterval(syncLastProgress, 1000);
    // Initial sync
    syncLastProgress();

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isReady]);

  const value = useMemo(
    () => ({
      isReady: isReady && !comicsLoading,
      comics,
      comicsLoading,
      searchComics,
      getComicById,
      libraryIds: state.library,
      libraryComics,
      historyEntries: historyComics,
      addToLibrary,
      removeFromLibrary,
      toggleLibrary,
      recordHistory,
      getLastProgress,
      forceRecordHistory,
    }),
    [
      isReady,
      comicsLoading,
      comics,
      state.library,
      libraryComics,
      historyComics,
      addToLibrary,
      removeFromLibrary,
      toggleLibrary,
      recordHistory,
      getLastProgress,
      forceRecordHistory,
    ]
  );

  return (
    <ComicsContext.Provider value={value}>{children}</ComicsContext.Provider>
  );
}

export function useComics() {
  const context = useContext(ComicsContext);
  if (!context)
    throw new Error("useComics harus digunakan di dalam ComicsProvider");
  return context;
}
