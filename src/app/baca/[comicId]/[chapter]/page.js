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
    title: `${comic.title} • Chapter ${resolvedParams.chapter} | KomikKu`,
  };
}

export default async function ComicReaderPage({ params }) {
  const resolvedParams = await params;
  const comicId = resolvedParams?.comicId;
  const chapterParam = resolvedParams?.chapter;

  // basic sanity
  if (!comicId) notFound();

  const comic = await getComicById(comicId);
  if (!comic) notFound();

  const comicWithChapters = await getComicWithChapters(comic.id);
  if (!comicWithChapters) notFound();

  // 1) jika chapterParam adalah angka (mis. "1165"), pakai number
  const tryNumber = Number(chapterParam);
  if (!Number.isNaN(tryNumber)) {
    const hasChapter = (comicWithChapters.chapters || []).some(
      (ch) => (ch.number ?? ch.chapter_number) === tryNumber
    );
    if (hasChapter) {
      return (
        <ReaderClient
          comic={comicWithChapters}
          startChapterNumber={tryNumber}
        />
      );
    }
    // jika number tapi tidak ada di list -> notFound (atau fallback jika mau)
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Chapter tidak ditemukan
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Chapter {tryNumber} tidak tersedia untuk komik ini.
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

  // 2) chapterParam bukan angka -> coba cari sebagai chapter id (UUID) di daftar chapters
  const foundById = (comicWithChapters.chapters || []).find(
    (ch) => ch.id === chapterParam || ch.chapter_id === chapterParam
  );
  if (foundById) {
    const resolvedNumber = foundById.number ?? foundById.chapter_number;
    return (
      <ReaderClient
        comic={comicWithChapters}
        startChapterNumber={resolvedNumber}
      />
    );
  }

  // 3) Jika tidak ditemukan di daftar, coba langsung fetch detail chapter dari API (fallback)
  //    ini akan memanggil endpoint chapter/detail/:chapterId dan mengembalikan pages
  try {
    const directChapter = await getChapterWithPages(chapterParam);
    if (
      directChapter &&
      Array.isArray(directChapter.pages) &&
      directChapter.pages.length > 0
    ) {
      // buat temporary comic object dengan chapter hasil fetch agar ReaderClient bisa pakai
      const tempComic = {
        ...comicWithChapters,
        chapters: [
          {
            id: directChapter.id,
            chapter_id: directChapter.id,
            number: directChapter.number,
            chapter_number: directChapter.number,
            title: directChapter.title,
            pages: directChapter.pages,
            _raw: directChapter,
          },
          ...(comicWithChapters.chapters || []),
        ],
      };
      return (
        <ReaderClient
          comic={tempComic}
          startChapterNumber={directChapter.number}
        />
      );
    }
  } catch (err) {
    console.error("Error fetching chapter detail directly:", err);
  }

  // 4) jika semua gagal, tampilkan pesan informatif + debug kecil
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Chapter tidak ditemukan</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Chapter {String(chapterParam)} tidak tersedia untuk komik ini.
      </p>

      <h2 className="mt-4 text-lg font-medium">Debug: params</h2>
      <pre className="mt-2 p-3 bg-zinc-100 rounded">
        {JSON.stringify(resolvedParams, null, 2)}
      </pre>

      <h2 className="mt-4 text-lg font-medium">Daftar chapter (sample 50)</h2>
      <ul className="mt-2 space-y-2">
        {(comicWithChapters.chapters || []).slice(0, 50).map((ch) => (
          <li key={ch.id} className="text-sm">
            id: <code>{ch.id}</code> — number:{" "}
            <strong>{ch.number ?? ch.chapter_number}</strong>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Link
          href={`/perpustakaan`}
          className="inline-block rounded-full bg-zinc-900 px-4 py-2 text-white"
        >
          Kembali ke Perpustakaan
        </Link>
      </div>
    </div>
  );
}
