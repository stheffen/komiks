import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getComicById,
  getComicWithChapters,
  getChapterWithPages,
} from "@/data/comics";
import ReaderClient from "./reader-client";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const comic = await getComicById(resolvedParams.comicId);
  if (!comic) {
    return { title: "Komik tidak ditemukan" };
  }
  return {
    title: `${comic.title} • Baca | KomikKu`,
  };
}

function renderMissingChapter(message, debugPayload = {}) {
  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Chapter tidak ditemukan
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
      </header>

      <pre className="overflow-auto rounded-2xl bg-zinc-100 p-4 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {JSON.stringify(debugPayload, null, 2)}
      </pre>

      <Link
        href={`/perpustakaan`}
        className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Kembali ke Perpustakaan
      </Link>
    </div>
  );
}

export default async function ComicReaderPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const comicId = resolvedParams?.comicId;

  if (!comicId) notFound();

  const comic = await getComicById(comicId);
  if (!comic) notFound();

  const comicWithChapters = await getComicWithChapters(comic.id);
  if (!comicWithChapters) notFound();

  const chapters = comicWithChapters.chapters || [];
  const chapterNumbers = chapters
    .map((ch) => ch.number ?? ch.chapter_number)
    .filter((num) => typeof num === "number" && !Number.isNaN(num));

  const requestedChapterId =
    resolvedSearchParams.chapterId ??
    resolvedSearchParams.chapter_id ??
    resolvedSearchParams.chapterID;
  const rawChapterNumber =
    resolvedSearchParams.chapter ??
    resolvedSearchParams.chapterNumber ??
    resolvedSearchParams.chapter_index;
  const rawPageNumber =
    resolvedSearchParams.page ??
    resolvedSearchParams.pageNumber ??
    resolvedSearchParams.page_index;

  let hydratedComic = comicWithChapters;
  let startChapterNumber = null;

  const includeDirectChapter = (chapter) => {
    hydratedComic = {
      ...comicWithChapters,
      chapters: [
        {
          id: chapter.id,
          chapter_id: chapter.id,
          number: chapter.number,
          chapter_number: chapter.number,
          title: chapter.title,
          pages: chapter.pages,
          _raw: chapter,
        },
        ...chapters,
      ],
    };
    startChapterNumber = chapter.number;
  };

  if (requestedChapterId) {
    const foundById = chapters.find(
      (ch) =>
        ch.id === requestedChapterId || ch.chapter_id === requestedChapterId
    );
    if (foundById) {
      startChapterNumber = foundById.number ?? foundById.chapter_number;
    } else {
      try {
        const directChapter = await getChapterWithPages(requestedChapterId);
        if (
          directChapter &&
          Array.isArray(directChapter.pages) &&
          directChapter.pages.length > 0
        ) {
          includeDirectChapter(directChapter);
        }
      } catch (error) {
        console.error("Gagal memuat chapter spesifik:", error);
      }
    }
  }

  if (!startChapterNumber && rawChapterNumber) {
    const numericChapter = Number(rawChapterNumber);
    if (!Number.isNaN(numericChapter)) {
      const exists = chapterNumbers.includes(numericChapter);
      if (exists) {
        startChapterNumber = numericChapter;
      }
    }

    if (!startChapterNumber) {
      return renderMissingChapter(
        `Chapter ${rawChapterNumber} tidak tersedia untuk komik ini.`,
        {
          params: resolvedParams,
          searchParams: resolvedSearchParams,
          availableSamples: chapterNumbers.slice(0, 50),
        }
      );
    }
  }

  if (!startChapterNumber) {
    if (chapterNumbers.length === 0) {
      return renderMissingChapter(
        "Komik ini belum memiliki chapter yang bisa dibaca.",
        {
          params: resolvedParams,
          searchParams: resolvedSearchParams,
        }
      );
    }
    startChapterNumber = Math.min(...chapterNumbers);
  }

  if (!startChapterNumber) {
    return renderMissingChapter("Tidak ada chapter yang bisa dimuat.", {
      params: resolvedParams,
      searchParams: resolvedSearchParams,
    });
  }

  const startPageNumber = (() => {
    if (!rawPageNumber) return null;
    const numeric = Number(rawPageNumber);
    if (Number.isNaN(numeric) || numeric < 1) return null;
    return Math.floor(numeric);
  })();

  return (
    <ReaderClient
      comic={hydratedComic}
      startChapterNumber={startChapterNumber}
      startPage={startPageNumber ?? 1}
    />
  );
}
