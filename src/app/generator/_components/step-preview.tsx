"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Check,
  Copy,
  Sparkles,
} from "lucide-react";
import { useResult, useGeneratorStore, useError } from "@/stores/generator-store";
import { cn } from "@/lib/utils";
import type { GeneratedBoard } from "@/lib/types";

const BOARDS_PER_PAGE = 12;

export function StepPreview() {
  const t = useTranslations("generator.preview");
  const result = useResult();
  const error = useError();
  const { regenerate } = useGeneratorStore();
  const [page, setPage] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<GeneratedBoard | null>(null);

  // Error state
  if (error) {
    return (
      <div className="max-w-md mx-auto py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={regenerate}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  // Empty state
  if (!result || !result.success) {
    return (
      <div className="max-w-md mx-auto py-8 text-center text-gray-500">
        {t("noBoards")}
      </div>
    );
  }

  const { boards, stats } = result;
  const totalPages = Math.ceil(boards.length / BOARDS_PER_PAGE);
  const startIdx = page * BOARDS_PER_PAGE;
  const visibleBoards = boards.slice(startIdx, startIdx + BOARDS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO: Success message + regenerate
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          {t("success")}
        </div>

        <div className="flex items-baseline justify-center gap-2 mb-2">
          <span className="text-4xl font-bold text-gray-900">{boards.length}</span>
          <span className="text-lg text-gray-500">{t("boardsReady")}</span>
        </div>

        <button
          onClick={regenerate}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t("regenerate")}
        </button>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOARDS GRID: Clean, scannable
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2"
      >
        {visibleBoards.map((board, idx) => (
          <BoardCard
            key={board.id}
            board={board}
            index={startIdx + idx}
            isSelected={selectedBoard?.id === board.id}
            onSelect={() => setSelectedBoard(selectedBoard?.id === board.id ? null : board)}
          />
        ))}
      </motion.div>

      {/* Pagination - minimal */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="p-1 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected board detail */}
      <AnimatePresence>
        {selectedBoard && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-gray-900">
                  {t("board")} #{selectedBoard.boardNumber}
                </span>
                <button
                  onClick={() => setSelectedBoard(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  {t("close")}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedBoard.items.map((item, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border border-gray-100"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          STATS: Progressive disclosure
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-2"
        >
          <span>{showStats ? t("hideStats") : t("showStats")}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              showStats && "rotate-180"
            )}
          />
        </button>

        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                <div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {stats.generationTimeMs.toFixed(0)}
                    <span className="text-sm font-normal text-gray-400">ms</span>
                  </div>
                  <div className="text-xs text-gray-400">{t("stats.time")}</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {stats.maxOverlap}
                  </div>
                  <div className="text-xs text-gray-400">{t("stats.maxOverlap")}</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {stats.avgOverlap.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-400">{t("stats.avgOverlap")}</div>
                </div>
                <SeedDisplay seed={stats.seedUsed} t={t} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================================
// BOARD CARD - Minimal, clean
// ============================================================================

function BoardCard({
  board,
  index,
  isSelected,
  onSelect,
}: {
  board: GeneratedBoard;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const cols = board.grid[0]?.length || 4;
  const items = board.grid.flat();

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: (index % BOARDS_PER_PAGE) * 0.02 }}
      onClick={onSelect}
      className={cn(
        "relative rounded-lg border-2 p-2 transition-all text-left",
        isSelected
          ? "border-amber-400 bg-amber-50/50"
          : "border-gray-100 bg-white hover:border-gray-200"
      )}
    >
      {/* Board number */}
      <div className="text-[10px] text-gray-400 text-center mb-1.5 font-medium">
        #{board.boardNumber}
      </div>

      {/* Grid with content */}
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="aspect-square bg-gradient-to-br from-amber-50 to-orange-50 rounded-sm flex items-center justify-center text-[9px] text-amber-700 font-medium border border-amber-100/50"
            title={item.name}
          >
            {item.id}
          </div>
        ))}
      </div>
    </motion.button>
  );
}

// ============================================================================
// SEED DISPLAY - Copiable
// ============================================================================

function SeedDisplay({ 
  seed, 
  t 
}: { 
  seed: number; 
  t: ReturnType<typeof useTranslations<"generator.preview">>; 
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(seed.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = seed.toString();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <button
        onClick={handleCopy}
        className="group inline-flex items-center gap-1.5"
      >
        <span className="text-lg font-mono font-semibold text-gray-900">
          {seed}
        </span>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
        )}
      </button>
      <div className="text-xs text-gray-400">{t("stats.seed")}</div>
    </div>
  );
}
