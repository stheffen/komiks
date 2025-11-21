"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    name: "Perpustakaan",
    href: "/perpustakaan",
  },
  {
    name: "Jelajahi",
    href: "/jelajahi",
  },
  {
    name: "Riwayat",
    href: "/riwayat",
  },
];

export default function NavigationBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur supports-backdrop-filter:bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <Link href="/jelajahi">StheKo</Link>
        </span>
        <div className="flex gap-2 text-sm font-medium">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/perpustakaan" &&
                pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
