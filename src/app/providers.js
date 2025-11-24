"use client";

import NavigationBar from "@/components/NavigationBar";
import { ComicsProvider } from "@/context/ComicsContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

export default function Providers({ children }) {
  const router = useRouter();
  const [resumePayload, setResumePayload] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const timeoutRef = useRef(null);

  // NEW: navVisible state controls whether NavigationBar is shown
  // default true so desktop & initial view shows it
  const [navVisible, setNavVisible] = useState(true);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const flag = window.localStorage.getItem(
        "komik:shouldRedirectToJelajahi"
      );
      const last = window.localStorage.getItem("komik:lastProgress");
      if (flag) {
        if (last) {
          try {
            const parsed = JSON.parse(last);
            setResumePayload(parsed);
            setShowBanner(true);
            // auto-dismiss after 6s and redirect to jelajahi as fallback
            const t = setTimeout(() => {
              try {
                window.localStorage.removeItem(
                  "komik:shouldRedirectToJelajahi"
                );
              } catch (e) {}
              setShowBanner(false);
              router.replace("/jelajahi");
              timeoutRef.current = null;
            }, 6000);
            timeoutRef.current = t;
            return () => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
            };
          } catch (e) {
            // parse error: fallback to redirect
            window.localStorage.removeItem("komik:shouldRedirectToJelajahi");
            router.replace("/jelajahi");
          }
        } else {
          // no lastProgress -> just redirect to jelajahi
          window.localStorage.removeItem("komik:shouldRedirectToJelajahi");
          router.replace("/jelajahi");
        }
      }
    } catch (e) {
      // ignore
    }
  }, [router]);

  const handleResume = () => {
    try {
      if (!resumePayload) return;
      // clear flags
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      window.localStorage.removeItem("komik:shouldRedirectToJelajahi");
      // remove persisted lastProgress because we're about to resume
      window.localStorage.removeItem("komik:lastProgress");
      setShowBanner(false);
      const { comicId, chapterId, chapterNumber } = resumePayload;
      const page = resumePayload?.page ?? resumePayload?.pageNumber ?? 1;
      if (comicId) {
        let url = `/baca/${encodeURIComponent(comicId)}?`;
        if (chapterId) url += `chapterId=${encodeURIComponent(chapterId)}&`;
        else if (chapterNumber)
          url += `chapter=${encodeURIComponent(chapterNumber)}&`;
        url += `page=${encodeURIComponent(page || 1)}`;
        router.push(url);
      }
    } catch (e) {
      // fallback
      setShowBanner(false);
      router.replace("/jelajahi");
    }
  };

  const handleGoJelajahi = () => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // user chose to go to Jelajahi — clear only the redirect flag, keep lastProgress
      try {
        window.localStorage.removeItem("komik:shouldRedirectToJelajahi");
      } catch (e) {}
      setShowBanner(false);
    } catch (e) {
      // ignore
    }
    router.replace("/jelajahi");
  };

  // ---------------------------
  // NEW: Listen for reader:controls events to toggle nav visibility
  // Event detail: { visible: boolean, mobileOnly?: boolean }
  // If mobileOnly is true, we only honor the event when window width < breakpoint
  // ---------------------------
  useEffect(() => {
    const handleReaderControls = (e) => {
      const detail = e?.detail || {};
      if (typeof detail.visible !== "boolean") return;
      const mobileOnly = Boolean(detail.mobileOnly);
      const isMobileViewport = window.innerWidth < 768;
      if (mobileOnly && !isMobileViewport) return;
      setNavVisible(Boolean(detail.visible));
    };
    window.addEventListener("reader:controls", handleReaderControls);
    return () =>
      window.removeEventListener("reader:controls", handleReaderControls);
  }, []);

  return (
    <ComicsProvider>
      <div className="min-h-screen bg-linear-to-br from-zinc-100 via-white to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
        {showBanner && resumePayload && (
          <div className="fixed left-1/2 top-4 z-50 w-full max-w-3xl -translate-x-1/2 px-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm dark:bg-zinc-900/95">
              <div className="flex-1 text-sm">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Lanjutkan membaca?
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Posisi terakhir disimpan — pilih lanjutkan untuk kembali ke
                  pembacaan terakhir atau Jelajahi untuk melihat daftar.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGoJelajahi}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700"
                >
                  Jelajahi
                </button>
                <button
                  onClick={handleResume}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white"
                >
                  Lanjutkan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pass navVisible into NavigationBar so it can hide when false */}
        {/* If your NavigationBar component accepts a prop like "visible", use it.
            Otherwise we conditionally render it below. */}
        {navVisible ? <NavigationBar /> : null}

        <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </ComicsProvider>
  );
}
