"use client";

/**
 * Play Landing Content
 *
 * Client component for the play landing page.
 * Offers two paths: Host a Game or Join a Game.
 *
 * @see SRD §5.9 Session Entry Options
 */

import { Monitor, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function PlayLandingContent() {
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 p-6">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4a574' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 w-full max-w-lg text-center">
        {/* Logo */}
        <h1 className="mb-2 font-serif text-6xl font-bold text-amber-100 drop-shadow-lg">
          {t("game.title")}
        </h1>
        <p className="mb-12 text-lg text-amber-300/70">
          Your digital Tabula companion
        </p>

        {/* Options */}
        <div className="space-y-4">
          {/* Host a Game */}
          <Link
            href="/play/host"
            className="group flex w-full items-center gap-4 rounded-2xl border-2 border-amber-600/30 bg-amber-900/50 p-6 text-left transition-all hover:border-amber-500 hover:bg-amber-800/50 focus:outline-none focus:ring-4 focus:ring-amber-500/30"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500 text-amber-950 transition-transform group-hover:scale-110">
              <Monitor className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-100">Host a Game</h2>
              <p className="text-sm text-amber-300/70">
                Display on TV/laptop • Optional mobile controller
              </p>
            </div>
          </Link>

          {/* Join a Game */}
          <Link
            href="/play/join"
            className="group flex w-full items-center gap-4 rounded-2xl border-2 border-amber-600/30 bg-amber-900/50 p-6 text-left transition-all hover:border-amber-500 hover:bg-amber-800/50 focus:outline-none focus:ring-4 focus:ring-amber-500/30"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-amber-700 text-amber-200 transition-transform group-hover:scale-110">
              <Smartphone className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-100">Join a Game</h2>
              <p className="text-sm text-amber-300/70">
                Control from your phone • Enter room code
              </p>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-12 text-xs text-amber-400/40">
          Host displays the cards • Controller draws them
        </p>
      </div>
    </div>
  );
}

