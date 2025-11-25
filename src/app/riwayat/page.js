"use client";

import Image from "next/image";
import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useComics } from "@/context/ComicsContext";

export default function RiwayatPage() {
  const router = useRouter();
  const { historyEntries } = useComics();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const orderedHistory = useMemo(() => {
    return [...historyEntries].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [historyEntries, isVisible]);

  const handleContinue = (entry) => {
    const params = new URLSearchParams();
    if (entry.chapterNumber) {
      params.set("chapter", entry.chapterNumber);
    }
    if (entry.pageNumber && entry.pageNumber > 0) {
      params.set("page", entry.pageNumber);
    }
    const query = params.toString();
    router.push(`/baca/${entry.comic.id}${query ? `?${query}` : ""}`);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Riwayat
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Lihat komik yang terakhir kamu baca dan lanjutkan dari chapter serta
          halaman terakhir.
        </p>
      </header>

      {orderedHistory.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            Belum ada riwayat bacaan
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Baca komik dari perpustakaan atau jelajahi untuk mulai mengisi
            riwayat.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orderedHistory.map((entry) => (
            <article
              key={`${entry.comic.id}-${entry.chapterNumber}`}
              className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-4">
                  <Image
                    src={entry.comic.cover || "/placeholder.svg"}
                    alt={entry.comic.title}
                    width={96}
                    height={144}
                    className="h-24 w-16 rounded-2xl object-cover"
                    unoptimized
                  />
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {entry.comic.title}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Terakhir dibaca: Chapter {entry.chapterNumber} • Halaman{" "}
                      {entry.pageNumber}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {new Date(entry.updatedAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleContinue(entry)}
                  className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Lanjutkan Baca
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
