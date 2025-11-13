const makeChapters = (seed, totalChapters = 8, pagesPerChapter = 6) => {
  return Array.from({ length: totalChapters }, (_, chapterIndex) => {
    const number = chapterIndex + 1;
    return {
      id: `${seed}-chapter-${number}`,
      number,
      title: `Chapter ${number}`,
      pages: Array.from({ length: pagesPerChapter }, (_, pageIndex) => {
        return `https://picsum.photos/seed/${seed}-${number}-${pageIndex + 1}/900/1400`;
      }),
    };
  });
};

const meta = [
  {
    id: "stellar-guardian",
    title: "Stellar Guardian",
    origin: "Korea",
    genres: ["Action", "Fantasy", "Sci-Fi"],
    synopsis:
      "Ketika sebuah kota terapung diserang oleh makhluk misterius, seorang penjaga muda menemukan rahasia kosmik yang dapat menyelamatkan semua orang.",
    totalChapters: 10,
  },
  {
    id: "aurora-melody",
    title: "Aurora Melody",
    origin: "Japan",
    genres: ["Drama", "Romance", "Music"],
    synopsis:
      "Seorang penyanyi jalanan dengan suara aurora berjuang menemukan panggung impiannya, sementara bertemu sahabat dari masa kecil yang terlupakan.",
    totalChapters: 12,
  },
  {
    id: "cyber-delinquent",
    title: "Cyber Delinquent",
    origin: "USA",
    genres: ["Cyberpunk", "Thriller"],
    synopsis:
      "Di kota futuristik, seorang peretas remaja terjebak dalam konspirasi korporasi yang mengancam memutus koneksi semua orang dari dunia maya.",
    totalChapters: 9,
  },
  {
    id: "evergreen-saga",
    title: "Evergreen Saga",
    origin: "China",
    genres: ["Adventure", "Fantasy"],
    synopsis:
      "Dua saudara menyeberangi hutan abadi mencari air kehidupan demi menyelamatkan desa mereka dari kutukan kekeringan.",
    totalChapters: 11,
  },
  {
    id: "neon-temple",
    title: "Neon Temple",
    origin: "Japan",
    genres: ["Mystery", "Supernatural"],
    synopsis:
      "Kuil modern dengan cahaya neon menyimpan pintu ke dunia roh, dan penjaganya harus menyeimbangkan kehidupan saat ini dengan masa lalu yang menghantuinya.",
    totalChapters: 8,
  },
  {
    id: "desert-riders",
    title: "Desert Riders",
    origin: "Indonesia",
    genres: ["Action", "Post-Apocalyptic"],
    synopsis:
      "Di masa depan gurun tak berujung, para pengendara motor mencari oasis legendaris sambil melawan geng yang haus kekuasaan.",
    totalChapters: 14,
  },
  {
    id: "tidebound",
    title: "Tidebound",
    origin: "Philippines",
    genres: ["Adventure", "Mythology"],
    synopsis:
      "Seorang pelaut muda dapat berbicara dengan roh laut dan harus menghentikan badai abadi yang mengancam nusantara.",
    totalChapters: 7,
  },
  {
    id: "clockwork-soul",
    title: "Clockwork Soul",
    origin: "France",
    genres: ["Steampunk", "Drama"],
    synopsis:
      "Penemu berbakat membuat replika hati mekanis untuk kakaknya, namun harus berpacu dengan waktu sebelum energi kota menghilang.",
    totalChapters: 9,
  },
  {
    id: "shadow-market",
    title: "Shadow Market",
    origin: "Singapore",
    genres: ["Crime", "Thriller"],
    synopsis:
      "Pasar malam tersembunyi menjadi tempat transaksi waktu, dan seorang broker rahasia mempertaruhkan hidupnya untuk membebaskan adiknya.",
    totalChapters: 10,
  },
  {
    id: "lunar-academy",
    title: "Lunar Academy",
    origin: "Malaysia",
    genres: ["School", "Sci-Fi"],
    synopsis:
      "Di akademi ilmiah di permukaan bulan, siswa baru menemukan misteri tentang mengapa generasi sebelumnya menghilang secara tiba-tiba.",
    totalChapters: 8,
  },
  {
    id: "forest-of-echoes",
    title: "Forest of Echoes",
    origin: "Canada",
    genres: ["Fantasy", "Mystery"],
    synopsis:
      "Hutan yang memantulkan suara hati, seorang gadis penjelajah mencoba menyembuhkan trauma masyarakatnya dengan mendengarkan gema masa lalu.",
    totalChapters: 6,
  },
  {
    id: "crimson-samurai",
    title: "Crimson Samurai",
    origin: "Japan",
    genres: ["Historical", "Action"],
    synopsis:
      "Seorang samurai wanita dengan armor merah darah berjuang menebus kesalahan klannya sambil menghadapi ancaman perang saudara.",
    totalChapters: 13,
  },
];

export const comics = meta.map((item) => ({
  ...item,
  cover: `https://picsum.photos/seed/${item.id}-cover/400/600`,
  chapters: makeChapters(item.id, item.totalChapters, 7),
}));

export const getComicById = (id) => comics.find((comic) => comic.id === id);

export const searchComics = (term) => {
  if (!term) return comics;
  const normalized = term.trim().toLowerCase();
  return comics.filter((comic) => {
    return (
      comic.title.toLowerCase().includes(normalized) ||
      comic.genres.some((genre) => genre.toLowerCase().includes(normalized)) ||
      comic.origin.toLowerCase().includes(normalized)
    );
  });
};

