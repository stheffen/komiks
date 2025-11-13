import Link from "next/link";
import { notFound } from "next/navigation";
import { getComicById } from "@/data/comics";
import ReaderClient from "./reader-client";

export function generateMetadata({ params }) {
  const comic = getComicById(params.comicId);
  if (!comic) {
    return {
      title: "Komik tidak ditemukan",
    };
  }
  return {
    title: `${comic.title} • Chapter ${params.chapter} | KomikKu`,
  };
}

export default function ComicReaderPage({ params }) {
  const comic = getComicById(params.comicId);
  const chapterNumber = Number(params.chapter);

  if (!comic || Number.isNaN(chapterNumber)) {
    notFound();
  }

  const hasChapter = comic.chapters.some((chapter) => chapter.number === chapterNumber);
  if (!hasChapter) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Chapter tidak ditemukan
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Chapter {chapterNumber} tidak tersedia untuk komik ini.
          </p>
        </header>
        <Link
          href={`/perpustakaan`}
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Kembali ke Perpustakaan
        </Link>
      </div>
    );
  }

  return <ReaderClient comic={comic} startChapterNumber={chapterNumber} />;
}

