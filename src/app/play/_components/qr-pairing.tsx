"use client";

/**
 * QR Pairing Component
 *
 * Displays a QR code and manual room code for controller pairing.
 * The QR encodes the full join URL for one-scan connection.
 *
 * @see SRD §5.9 Session Entry & QR Pairing UI
 * @see FR-002 Host shall display a QR Code containing the Controller URL
 */

import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Smartphone } from "lucide-react";
import { useState, useCallback } from "react";

interface QRPairingProps {
  /** The 4-character room code */
  roomCode: string;

  /** Callback when user wants to skip pairing and play standalone */
  onPlayStandalone?: () => void;

  /** Whether controller is connected */
  isControllerConnected?: boolean;
}

export function QRPairing({
  roomCode,
  onPlayStandalone,
  isControllerConnected = false,
}: QRPairingProps) {
  const [copied, setCopied] = useState(false);

  // Build the join URL
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/play/join?room=${roomCode}`
      : `/play/join?room=${roomCode}`;

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      console.warn("Clipboard API not available");
    }
  }, [roomCode]);

  if (isControllerConnected) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-green-900/30 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
          <Smartphone className="h-8 w-8 text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-green-100">
            Controller Connected!
          </h2>
          <p className="mt-1 text-sm text-green-300/70">
            Use your phone to control the game
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* QR Code */}
      <div className="rounded-2xl bg-white p-4 shadow-2xl">
        <QRCodeSVG
          value={joinUrl}
          size={180}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#1a1a1a"
        />
      </div>

      {/* Instructions */}
      <div className="text-center">
        <p className="text-lg font-medium text-amber-100">
          Scan to connect your phone
        </p>
        <p className="mt-1 text-sm text-amber-300/60">
          Or enter the code manually
        </p>
      </div>

      {/* Room Code Display */}
      <button
        onClick={handleCopyCode}
        className="group flex items-center gap-3 rounded-xl bg-amber-900/50 px-6 py-3 transition-colors hover:bg-amber-800/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
      >
        <span className="font-mono text-3xl font-bold tracking-[0.3em] text-amber-100">
          {roomCode}
        </span>
        {copied ? (
          <Check className="h-5 w-5 text-green-400" />
        ) : (
          <Copy className="h-5 w-5 text-amber-400 opacity-50 transition-opacity group-hover:opacity-100" />
        )}
      </button>

      {/* Manual URL */}
      <p className="text-xs text-amber-400/50">
        Go to{" "}
        <span className="font-mono text-amber-300/70">
          {typeof window !== "undefined" ? window.location.host : ""}/play/join
        </span>
      </p>

      {/* Skip option */}
      {onPlayStandalone && (
        <button
          onClick={onPlayStandalone}
          className="mt-4 rounded-full border border-amber-600/30 px-6 py-2 text-sm text-amber-300/70 transition-colors hover:border-amber-500 hover:text-amber-200"
        >
          Play without controller →
        </button>
      )}
    </div>
  );
}

