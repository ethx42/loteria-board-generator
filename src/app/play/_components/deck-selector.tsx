"use client";

/**
 * Deck Selector Component
 *
 * Displays a grid of available decks from the catalog with thumbnails.
 * Supports deck selection, upload option, and graceful error handling.
 *
 * Features:
 * - Grid layout with deck cards
 * - Loading and error states
 * - Retry logic for failed loads
 * - Upload option for custom decks
 * - Fully accessible (keyboard navigation, ARIA labels)
 * - Responsive design
 *
 * @see ENTERPRISE_IMPLEMENTATION_PLAN.md Fase 2
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  loadDeckCatalog,
  getDeckEntry,
  loadDeckFromManifestUrl,
  type DeckCatalogEntry,
} from "@/lib/game/deck-catalog";
import { loadDeckFromFile } from "@/lib/game/deck-loader";
import type { DeckDefinition } from "@/lib/types/game";
import { resolveImageUrl } from "@/lib/storage/image-url";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, RefreshCw, AlertCircle } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export interface DeckSelectorProps {
  /**
   * Callback when a deck is selected.
   * @param deck - The loaded deck definition
   * @param manifestUrl - URL to the manifest.json (for loading boards.json)
   */
  onDeckSelect: (deck: DeckDefinition, manifestUrl?: string) => void;
  /** Optional callback for upload action */
  onUpload?: () => void;
  /** Whether to show upload option */
  showUploadOption?: boolean;
  /** Default deck ID to highlight */
  defaultDeckId?: string;
  /** Additional CSS classes */
  className?: string;
}

type DeckSelectorState =
  | { status: "loading" }
  | { status: "error"; error: string; retry: () => void }
  | { status: "empty"; message: string }
  | { status: "ready"; decks: readonly DeckCatalogEntry[] }
  | { status: "selecting"; selectedDeckId: string };

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_THUMBNAIL = "/decks/demo/placeholder.svg";

// ============================================================================
// COMPONENT
// ============================================================================

export function DeckSelector({
  onDeckSelect,
  onUpload,
  showUploadOption = false,
  defaultDeckId,
  className = "",
}: DeckSelectorProps) {
  const [state, setState] = useState<DeckSelectorState>({ status: "loading" });
  const [uploading, setUploading] = useState(false);

  // Load catalog on mount
  const loadCatalog = useCallback(async (forceRefresh = false) => {
    try {
      setState({ status: "loading" });
      const catalog = await loadDeckCatalog({ forceRefresh });

      if (catalog.decks.length === 0) {
        setState({
          status: "empty",
          message: "No decks available. Please check back later.",
        });
        return;
      }

      setState({ status: "ready", decks: catalog.decks });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load deck catalog. Please try again.";

      setState({
        status: "error",
        error: errorMessage,
        retry: () => loadCatalog(true),
      });
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Handle deck selection
  const handleDeckSelect = useCallback(
    async (deckId: string) => {
      setState({ status: "selecting", selectedDeckId: deckId });

      try {
        // Get the catalog entry to access manifestUrl
        const entry = await getDeckEntry(deckId);
        if (!entry) {
          throw new Error(`Deck "${deckId}" not found in catalog`);
        }

        const deck = await loadDeckFromManifestUrl(entry.manifestUrl);
        // Pass manifestUrl for boards.json loading
        onDeckSelect(deck, entry.manifestUrl);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load deck. Please try again.";

        setState({
          status: "error",
          error: errorMessage,
          retry: () => loadCatalog(true),
        });
      }
    },
    [onDeckSelect, loadCatalog]
  );

  // Handle file upload
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);

      try {
        const deck = await loadDeckFromFile(file);
        onDeckSelect(deck);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load deck file. Please check the file format.";

        setState({
          status: "error",
          error: errorMessage,
          retry: () => loadCatalog(true),
        });
      } finally {
        setUploading(false);
        // Reset input
        event.target.value = "";
      }
    },
    [onDeckSelect, loadCatalog]
  );

  // Render based on state
  return (
    <div className={`deck-selector ${className}`}>
      {/* Upload Option */}
      {showUploadOption && (
        <div className="mb-6 flex justify-end">
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={uploading}
              className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Upload deck file"
              id="deck-upload-input"
            />
            <Button
              asChild
              variant="outline"
              disabled={uploading}
              className="pointer-events-none"
            >
              <label htmlFor="deck-upload-input" className="cursor-pointer">
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Deck
                  </>
                )}
              </label>
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && (
          <ErrorState error={state.error} onRetry={state.retry} />
        )}
        {state.status === "empty" && <EmptyState message={state.message} />}
        {state.status === "ready" && (
          <DeckGrid
            decks={state.decks}
            defaultDeckId={defaultDeckId}
            onSelect={handleDeckSelect}
            selecting={false}
          />
        )}
        {state.status === "selecting" && (
          <SelectingState selectedDeckId={state.selectedDeckId} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="mt-4 text-sm text-muted-foreground">Loading decks...</p>
    </motion.div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </motion.div>
  );
}

function SelectingState({ selectedDeckId }: { selectedDeckId: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="mt-4 text-sm text-muted-foreground">Loading deck...</p>
    </motion.div>
  );
}

interface DeckGridProps {
  decks: readonly DeckCatalogEntry[];
  defaultDeckId?: string;
  onSelect: (deckId: string) => void;
  selecting: boolean;
}

function DeckGrid({
  decks,
  defaultDeckId,
  onSelect,
  selecting,
}: DeckGridProps) {
  // Sort decks: default first, then by name
  const sortedDecks = useMemo(() => {
    const sorted = [...decks].sort((a, b) => {
      if (a.id === defaultDeckId) return -1;
      if (b.id === defaultDeckId) return 1;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [decks, defaultDeckId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      role="list"
      aria-label="Available decks"
    >
      <AnimatePresence>
        {sortedDecks.map((deck, index) => (
          <DeckCard
            key={deck.id}
            deck={deck}
            isDefault={deck.id === defaultDeckId}
            onSelect={onSelect}
            disabled={selecting}
            index={index}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

interface DeckCardProps {
  deck: DeckCatalogEntry;
  isDefault: boolean;
  onSelect: (deckId: string) => void;
  disabled: boolean;
  index: number;
}

function DeckCard({
  deck,
  isDefault,
  onSelect,
  disabled,
  index,
}: DeckCardProps) {
  const thumbnailUrl = deck.thumbnailUrl
    ? resolveImageUrl(deck.thumbnailUrl)
    : DEFAULT_THUMBNAIL;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => !disabled && onSelect(deck.id)}
      disabled={disabled}
      className="group relative flex flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`Select deck: ${deck.name}`}
      role="listitem"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <Image
          src={thumbnailUrl}
          alt={`${deck.name} thumbnail`}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          priority={index === 0}
        />
        {isDefault && (
          <div className="absolute right-2 top-2 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            Default
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-foreground group-hover:text-primary">
          {deck.name}
        </h3>
        {deck.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {deck.description}
          </p>
        )}

        {/* Metadata */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{deck.itemCount} cards</span>
          {deck.category && (
            <>
              <span aria-hidden="true">•</span>
              <span>{deck.category}</span>
            </>
          )}
          {deck.region && (
            <>
              <span aria-hidden="true">•</span>
              <span>{deck.region}</span>
            </>
          )}
        </div>

        {/* Tags */}
        {deck.tags && deck.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {deck.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.button>
  );
}
