"use client";

/**
 * Generator Page Client
 *
 * Client component wrapper for the board generator wizard.
 */

import { useTranslations } from "next-intl";
import { Wizard } from "@/app/generator/_components/wizard";

export default function GeneratorPageClient() {
  const t = useTranslations("generator");

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-amber-900 mb-2">
            {t("title")}
          </h1>
          <p className="text-amber-700/80 text-lg">
            Create optimally distributed game boards
          </p>
        </header>

        <Wizard />
      </div>
    </main>
  );
}

