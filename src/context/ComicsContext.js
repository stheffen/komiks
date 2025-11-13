"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { comics, getComicById, searchComics } from "@/data/comics";

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
    case "RECORD_HISTORY": {
      const existing = state.history.find((item) => item.comicId === action.payload.comicId);
      const nextHistoryEntry = {
        comicId: action.payload.comicId,
        chapterNumber: action.payload.chapterNumber,
        pageNumber: action.payload.pageNumber,
        updatedAt: new Date().toISOString(),
      };
      let history;

      if (existing) {
        history = state.history
          .map((item) => (item.comicId === action.payload.comicId ? nextHistoryEntry : item))
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
  const hasHydrated = useRef(false);

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

  const recordHistory = useCallback((comicId, chapterNumber, pageNumber = 1) => {
    dispatch({
      type: "RECORD_HISTORY",
      payload: { comicId, chapterNumber, pageNumber },
    });
  }, []);

  const libraryComics = useMemo(
    () => state.library.map((comicId) => getComicById(comicId)).filter(Boolean),
    [state.library]
  );

  const historyComics = useMemo(() => {
    return state.history
      .map((entry) => {
        const comic = getComicById(entry.comicId);
        if (!comic) return null;
        return {
          ...entry,
          comic,
        };
      })
      .filter(Boolean);
  }, [state.history]);

  const getLastProgress = useCallback(
    (comicId) => {
      return state.history.find((entry) => entry.comicId === comicId);
    },
    [state.history]
  );

  const value = useMemo(
    () => ({
      isReady,
      comics,
      searchComics,
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

  return <ComicsContext.Provider value={value}>{children}</ComicsContext.Provider>;
}

export function useComics() {
  const context = useContext(ComicsContext);
  if (!context) {
    throw new Error("useComics harus digunakan di dalam ComicsProvider");
  }
  return context;
}

