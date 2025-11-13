import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "KomikKu - Baca Komik Favorit",
  description:
    "Aplikasi pembaca komik sederhana dengan perpustakaan pribadi, jelajahi komik baru, dan riwayat bacaan.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
