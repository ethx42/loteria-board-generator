"use client";

import { Wizard } from "./_components/wizard";

export default function GeneratorPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-amber-900 mb-2">
            Lotería Board Generator
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

