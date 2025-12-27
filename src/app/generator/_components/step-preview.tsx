"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RefreshCw,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { useResult, useGeneratorStore, useError } from "@/stores/generator-store";
import { cn } from "@/lib/utils";
import type { GeneratedBoard } from "@/lib/types";

const BOARDS_PER_PAGE = 12;

export function StepPreview() {
  const result = useResult();
  const error = useError();
  const { regenerate } = useGeneratorStore();
  const [page, setPage] = useState(0);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!result || !result.success) {
    return (
      <div className="text-center py-12 text-amber-600">
        No boards generated yet.
      </div>
    );
  }

  const { boards, stats } = result;
  const totalPages = Math.ceil(boards.length / BOARDS_PER_PAGE);
  const startIdx = page * BOARDS_PER_PAGE;
  const visibleBoards = boards.slice(startIdx, startIdx + BOARDS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-amber-900 mb-1">
            Generated Boards
          </h2>
          <p className="text-amber-600 text-sm">
            {boards.length} unique boards created
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={regenerate}
          className="border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Regenerate
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Clock}
          label="Time"
          value={`${stats.generationTimeMs.toFixed(0)}ms`}
        />
        <StatCard
          icon={Zap}
          label="Solver"
          value={stats.solverUsed === "highs" ? "HiGHS (Optimal)" : "Greedy"}
        />
        <StatCard
          icon={BarChart3}
          label="Max Overlap"
          value={`${stats.maxOverlap} items`}
        />
        <StatCard
          icon={BarChart3}
          label="Avg Overlap"
          value={`${stats.avgOverlap.toFixed(1)} items`}
        />
      </div>

      {/* Board Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {visibleBoards.map((board, idx) => (
          <BoardCard key={board.id} board={board} index={startIdx + idx} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="border-amber-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn(
                  "w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  page === i
                    ? "bg-amber-600 text-white"
                    : "text-amber-600 hover:bg-amber-100"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="border-amber-200"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100">
      <div className="flex items-center gap-1.5 text-amber-600 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-sm font-medium text-amber-900">{value}</div>
    </div>
  );
}

function BoardCard({ board, index }: { board: GeneratedBoard; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: (index % BOARDS_PER_PAGE) * 0.02 }}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "bg-white rounded-lg border-2 p-2 transition-all cursor-pointer",
          isHovered
            ? "border-amber-400 shadow-lg shadow-amber-200/50"
            : "border-amber-100"
        )}
      >
        {/* Board number */}
        <div className="text-center mb-1.5">
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 text-xs"
          >
            #{board.boardNumber}
          </Badge>
        </div>

        {/* Grid */}
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${board.grid[0]?.length || 4}, 1fr)`,
          }}
        >
          {board.grid.flat().map((item, i) => (
            <div
              key={i}
              className="aspect-square bg-gradient-to-br from-amber-50 to-orange-50 rounded-sm flex items-center justify-center text-[8px] text-amber-700 font-medium p-0.5 text-center leading-tight border border-amber-100/50"
              title={item.name}
            >
              {item.id}
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip with item names */}
      {isHovered && (
        <div className="absolute z-10 left-full ml-2 top-0 w-48 bg-white rounded-lg shadow-xl border border-amber-200 p-2 text-xs">
          <div className="font-medium text-amber-900 mb-1">
            Board #{board.boardNumber}
          </div>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {board.items.map((item, i) => (
              <div key={i} className="text-amber-600 truncate">
                {item.id}. {item.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

