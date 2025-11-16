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

function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload };
    case "ADD_TO_LIBRARY":
      if (state.library.includes(action.payload)) return state;
      return { ...state, library: [...state.library, action.payload] };
    case "REMOVE_FROM_LIBRARY":
      return {
        ...state,
        library: state.library.filter((id) => id !== action.payload),
      };
    // case "RECORD_HISTORY": {
    //   const existing = state.history.find(
    //     (item) => item.comicId === action.payload.comicId
    //   );
    //   const nextHistoryEntry = {
    //     comicId: action.payload.comicId,
    //     chapterNumber: action.payload.chapterNumber,
    //     pageNumber: action.payload.pageNumber,
    //     updatedAt: new Date().toISOString(),
    //   };
    //   let history;

    //   if (existing) {
    //     history = state.history
    //       .map((item) =>
    //         item.comicId === action.payload.comicId ? nextHistoryEntry : item
    //       )
    //       .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    //   } else {
    //     history = [nextHistoryEntry, ...state.history].slice(0, 50);
    //   }

    //   return { ...state, history };
    // }
    case "RECORD_HISTORY": {
      const payload = action.payload || {};
      const { comicId, chapterNumber, pageNumber } = payload;
      if (!comicId) return state;

      const existing = state.history.find((item) => item.comicId === comicId);

      // Jika ada dan chapter/page sama -> tidak perlu update (hindari loop)
      if (
        existing &&
        (existing.chapterNumber === chapterNumber ?? existing.chapterNumber) &&
        existing.pageNumber === (pageNumber ?? existing.pageNumber)
      ) {
        return state; // tidak mengubah state
      }

      const nextHistoryEntry = {
        comicId,
        chapterNumber: chapterNumber ?? existing?.chapterNumber ?? null,
        pageNumber: pageNumber ?? existing?.pageNumber ?? 1,
        updatedAt: new Date().toISOString(),
      };

      let history;
      if (existing) {
        history = state.history
          .map((item) => (item.comicId === comicId ? nextHistoryEntry : item))
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      } else {
        history = [nextHistoryEntry, ...state.history].slice(0, 50);
      }

      return { ...state, history };
    }
    case "CLEAR_HISTORY":
      return { ...state, history: [] };
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

  // Initialize comics on mount
  useEffect(() => {
    async function loadComics() {
      try {
        await initializeComics();
        const loadedComics = await getComics();
        setComics(loadedComics);
      } catch (error) {
        console.error("Error loading comics:", error);
      } finally {
        setComicsLoading(false);
      }
    }
    loadComics();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasHydrated.current) return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        dispatch({ type: "HYDRATE", payload: parsed });
      }
    } catch (error) {
      console.warn("Gagal memuat data pembaca komik dari localStorage", error);
    } finally {
      hasHydrated.current = true;
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Gagal menyimpan data pembaca komik ke localStorage", error);
    }
  }, [state]);

  const addToLibrary = useCallback((comicId) => {
    dispatch({ type: "ADD_TO_LIBRARY", payload: comicId });
  }, []);

  const removeFromLibrary = useCallback((comicId) => {
    dispatch({ type: "REMOVE_FROM_LIBRARY", payload: comicId });
  }, []);

  const toggleLibrary = useCallback(
    (comicId) => {
      if (state.library.includes(comicId)) {
        dispatch({ type: "REMOVE_FROM_LIBRARY", payload: comicId });
      } else {
        dispatch({ type: "ADD_TO_LIBRARY", payload: comicId });
      }
    },
    [state.library]
  );

  // const recordHistory = useCallback(
  //   (comicId, chapterNumber, pageNumber = 1) => {
  //     dispatch({
  //       type: "RECORD_HISTORY",
  //       payload: { comicId, chapterNumber, pageNumber },
  //     });
  //   },
  //   []
  // );
  const recordHistory = useCallback(
    (comicId, chapterNumber, pageNumber = 1) => {
      if (!comicId) return;

      // normalisasi key sederhana
      const key = `${String(comicId)}@${String(chapterNumber ?? "")}@${String(
        pageNumber ?? 1
      )}`;

      // jika sama dengan lastRecorded, skip dispatch (mencegah dispatch duplikat)
      if (lastRecordedRef.current === key) return;

      // set lastRecordedRef sebelum dispatch agar pemanggilan cepat berikutnya tidak mem-dispatch lagi
      lastRecordedRef.current = key;

      dispatch({
        type: "RECORD_HISTORY",
        payload: { comicId, chapterNumber, pageNumber },
      });
    },
    []
  );
  useEffect(() => {
    // sinkronkan lastRecordedRef dengan entry teratas di history saat state berubah dari sumber lain
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

  // Load library comics
  useEffect(() => {
    async function loadLibraryComics() {
      const loaded = await Promise.all(
        state.library.map(async (comicId) => {
          const comic = await getComicById(comicId);
          return comic;
        })
      );
      setLibraryComics(loaded.filter(Boolean));
    }
    if (state.library.length > 0) {
      loadLibraryComics();
    } else {
      setLibraryComics([]);
    }
  }, [state.library]);

  // Load history comics
  // useEffect(() => {
  //   async function loadHistoryComics() {
  //     const loaded = await Promise.all(
  //       state.history.map(async (entry) => {
  //         const comic = await getComicById(entry.comicId);
  //         if (!comic) return null;
  //         return {
  //           ...entry,
  //           comic,
  //         };
  //       })
  //     );
  //     setHistoryComics(loaded.filter(Boolean));
  //   }
  //   if (state.history.length > 0) {
  //     loadHistoryComics();
  //   } else {
  //     setHistoryComics([]);
  //   }
  // }, [state.history]);
  const lastHistoryKeyRef = useRef(null);

  useEffect(() => {
    async function loadHistoryComics() {
      try {
        if (!Array.isArray(state.history) || state.history.length === 0) {
          // hanya set jika berbeda untuk menghindari update tak perlu
          setHistoryComics((prev) => (prev.length === 0 ? prev : []));
          lastHistoryKeyRef.current = null;
          return;
        }

        // buat key sederhana dari history (order-aware)
        const key = state.history
          .map(
            (entry) =>
              `${entry.comicId ?? ""}@${entry.chapterNumber ?? ""}@${
                entry.pageNumber ?? ""
              }`
          )
          .join("|");

        // jika key sama dengan terakhir, abaikan (menghindari loop)
        if (lastHistoryKeyRef.current === key) return;

        // proses load
        const loaded = await Promise.all(
          state.history.map(async (entry) => {
            try {
              if (!entry || !entry.comicId) return null;
              const comic = await getComicById(entry.comicId);
              if (!comic) return null;
              return {
                ...entry,
                comic,
              };
            } catch (err) {
              console.error("[loadHistoryComics] entry failed:", entry, err);
              return null;
            }
          })
        );

        const filtered = loaded.filter(Boolean);

        // hanya update state jika hasil berbeda dari sebelumnya
        setHistoryComics((prev) => {
          try {
            const prevJson = JSON.stringify(prev);
            const newJson = JSON.stringify(filtered);
            if (prevJson === newJson) {
              // simpan key agar efek tidak berjalan lagi untuk key yang sama
              lastHistoryKeyRef.current = key;
              return prev;
            }
          } catch (e) {
            // kalau stringify error, tetap update
          }
          lastHistoryKeyRef.current = key;
          return filtered;
        });
      } catch (err) {
        console.error("[loadHistoryComics] unexpected error:", err);
        setHistoryComics([]);
        lastHistoryKeyRef.current = null;
      }
    }

    loadHistoryComics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.history]);

  const getLastProgress = useCallback(
    (comicId) => {
      return state.history.find((entry) => entry.comicId === comicId);
    },
    [state.history]
  );

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
    ]
  );

  return (
    <ComicsContext.Provider value={value}>{children}</ComicsContext.Provider>
  );
}

export function useComics() {
  const context = useContext(ComicsContext);
  if (!context) {
    throw new Error("useComics harus digunakan di dalam ComicsProvider");
  }
  return context;
}
