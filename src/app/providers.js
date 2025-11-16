"use client";

import NavigationBar from "@/components/NavigationBar";
import { ComicsProvider } from "@/context/ComicsContext";

export default function Providers({ children }) {
  return (
    <ComicsProvider>
      <div className="min-h-screen bg-linear-to-br from-zinc-100 via-white to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
        <NavigationBar />
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </ComicsProvider>
  );
}
