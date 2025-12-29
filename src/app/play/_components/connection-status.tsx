"use client";

/**
 * ConnectionStatus Component
 *
 * Displays WebSocket connection status with visual indicators.
 * Shows connected/reconnecting/lost states with appropriate UI.
 *
 * @see SRD §5.2 Remote Controller Layout
 * @see SRD §5.11 Error States
 * @see FR-007 Reconnection behavior
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected" | "error";

interface ConnectionStatusProps {
  /** Current connection status */
  status: ConnectionStatus;

  /** Room/session ID to display when connected */
  roomId?: string;

  /** Callback to retry connection */
  onRetry?: () => void;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_CONFIG = {
  connected: {
    icon: Wifi,
    label: "Connected",
    bgColor: "bg-green-900/80",
    textColor: "text-green-300",
    iconColor: "text-green-400",
  },
  reconnecting: {
    icon: Loader2,
    label: "Reconnecting...",
    bgColor: "bg-yellow-900/80",
    textColor: "text-yellow-300",
    iconColor: "text-yellow-400",
  },
  disconnected: {
    icon: WifiOff,
    label: "Disconnected",
    bgColor: "bg-amber-900/80",
    textColor: "text-amber-300",
    iconColor: "text-amber-400",
  },
  error: {
    icon: AlertCircle,
    label: "Connection Lost",
    bgColor: "bg-red-900/80",
    textColor: "text-red-300",
    iconColor: "text-red-400",
  },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function ConnectionStatusIndicator({
  status,
  roomId,
  onRetry,
  reducedMotion = false,
  className = "",
}: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        flex items-center gap-3 rounded-full px-4 py-2
        backdrop-blur-sm ${config.bgColor} ${className}
      `}
    >
      {/* Icon with pulse animation for connected state */}
      <div className="relative">
        <Icon
          className={`h-5 w-5 ${config.iconColor} ${
            status === "reconnecting" && !reducedMotion ? "animate-spin" : ""
          }`}
        />
        {status === "connected" && !reducedMotion && (
          <motion.div
            className="absolute -inset-1 rounded-full bg-green-400/30"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${config.textColor}`}>
          {status === "connected" && roomId
            ? `Connected to ${roomId}`
            : config.label}
        </span>
      </div>

      {/* Retry button for error state */}
      <AnimatePresence>
        {status === "error" && onRetry && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onRetry}
            className="ml-2 rounded-full bg-red-700/50 px-3 py-1 text-xs font-medium text-red-200 transition-colors hover:bg-red-600/60"
          >
            Retry
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// CONNECTION STATUS HOOK
// ============================================================================

interface UseConnectionStatusOptions {
  /** Initial status */
  initialStatus?: ConnectionStatus;

  /** Reconnection timeout in ms before showing error (default: 10000) */
  reconnectTimeout?: number;
}

/**
 * Hook to manage connection status with automatic timeout handling
 */
export function useConnectionStatus(options: UseConnectionStatusOptions = {}) {
  const { initialStatus = "disconnected", reconnectTimeout = 10000 } = options;

  const [status, setStatus] = useState<ConnectionStatus>(initialStatus);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Handle reconnection timeout (FR-007)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (status === "reconnecting") {
      timeoutId = setTimeout(() => {
        setStatus("error");
      }, reconnectTimeout);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [status, reconnectTimeout]);

  const connect = (id: string) => {
    setRoomId(id);
    setStatus("connected");
  };

  const disconnect = () => {
    setStatus("disconnected");
  };

  const startReconnecting = () => {
    setStatus("reconnecting");
  };

  const setError = () => {
    setStatus("error");
  };

  return {
    status,
    roomId,
    connect,
    disconnect,
    startReconnecting,
    setError,
  };
}

export default ConnectionStatusIndicator;

