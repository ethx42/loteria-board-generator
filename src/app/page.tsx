import Link from "next/link";
import { Grid3X3, Play, Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Optimally distributed boards
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-amber-900 mb-4">
            Tabula
          </h1>

          <p className="text-xl text-amber-700 max-w-2xl mx-auto">
            Create beautifully distributed game boards and play the traditional
            Mexican game with friends and family.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Generator Card */}
          <Link
            href="/generator"
            className="group relative bg-white rounded-2xl p-8 shadow-xl shadow-amber-900/5 border border-amber-100 hover:border-amber-300 transition-all hover:shadow-2xl hover:shadow-amber-200/20 hover:-translate-y-1"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-100 to-orange-100 rounded-bl-[100px] rounded-tr-2xl -z-10" />

            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
              <Grid3X3 className="w-7 h-7 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-amber-900 mb-2">
              Board Generator
            </h2>

            <p className="text-amber-600 mb-6">
              Create custom game boards with optimal distribution. Configure
              items, board size, and let our algorithm do the magic.
            </p>

            <div className="flex items-center gap-2 text-amber-600 font-medium group-hover:text-amber-800 transition-colors">
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Play Card */}
          <Link
            href="/play"
            className="group relative bg-white rounded-2xl p-8 shadow-xl shadow-amber-900/5 border border-amber-100 hover:border-amber-300 transition-all hover:shadow-2xl hover:shadow-amber-200/20 hover:-translate-y-1"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-100 to-pink-100 rounded-bl-[100px] rounded-tr-2xl -z-10" />

            <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
              <Play className="w-7 h-7 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-amber-900 mb-2">
              Play Game
            </h2>

            <p className="text-amber-600 mb-6">
              Start a game session with your generated boards. Call cards, track
              progress, and declare winners.
            </p>

            <div className="flex items-center gap-2 text-amber-600 font-medium group-hover:text-amber-800 transition-colors">
              Coming Soon
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { label: "Unique Boards", value: "∞" },
            { label: "Optimization", value: "HiGHS" },
            { label: "Export Formats", value: "4+" },
            { label: "Open Source", value: "✓" },
          ].map((item, i) => (
            <div key={i} className="bg-white/50 rounded-xl p-4 border border-amber-100">
              <div className="text-2xl font-bold text-amber-600">{item.value}</div>
              <div className="text-sm text-amber-700">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-amber-500 text-sm">
          <p>Built with Next.js, TypeScript, and ❤️</p>
        </footer>
      </div>
    </main>
  );
}
