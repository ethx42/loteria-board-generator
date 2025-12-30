"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Download,
  Copy,
  Check,
  FileText,
  Printer,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useResult, useConfig } from "@/stores/generator-store";
import { cn } from "@/lib/utils";

export function StepExport() {
  const t = useTranslations("generator.export");
  const result = useResult();
  const config = useConfig();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Empty state
  if (!result || !result.success) {
    return (
      <div className="max-w-md mx-auto py-8 text-center text-gray-500">
        {t("noBoards")}
      </div>
    );
  }

  const { boards, stats } = result;

  // ══════════════════════════════════════════════════════════════════════
  // EXPORT HANDLERS
  // ══════════════════════════════════════════════════════════════════════

  const handleDownloadJSON = () => {
    const data = {
      game: "Tabula",
      generatedAt: new Date().toISOString(),
      config: {
        totalItems: config.items.length,
        numBoards: config.numBoards,
        boardSize: `${config.boardConfig.rows}×${config.boardConfig.cols}`,
      },
      stats: {
        maxOverlap: stats.maxOverlap,
        avgOverlap: stats.avgOverlap,
        solver: stats.solverUsed,
        seed: stats.seedUsed,
        generationTimeMs: stats.generationTimeMs,
      },
      boards: boards.map((b) => ({
        id: b.id,
        number: b.boardNumber,
        items: b.items.map((item) => item.name),
        grid: b.grid.map((row) => row.map((item) => item.name)),
      })),
    };

    downloadFile(
      JSON.stringify(data, null, 2),
      `tabula-${boards.length}-boards.json`,
      "application/json"
    );
  };

  const handleDownloadCSV = () => {
    const headers = [
      "Board",
      ...Array.from({ length: boards[0].items.length }, (_, i) => `Item ${i + 1}`),
    ];
    const rows = boards.map((b) => [
      b.boardNumber,
      ...b.items.map((item) => `"${item.name}"`),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    downloadFile(csv, `tabula-${boards.length}-boards.csv`, "text/csv");
  };

  const handleCopyToClipboard = async () => {
    const text = boards
      .map(
        (b) =>
          `Board #${b.boardNumber}\n${b.grid
            .map((row) => row.map((item) => item.name).join(" | "))
            .join("\n")}`
      )
      .join("\n\n---\n\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = generatePrintHTML(boards);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleSaveToLocalStorage = () => {
    const data = {
      savedAt: new Date().toISOString(),
      config: {
        numBoards: config.numBoards,
        boardSize: `${config.boardConfig.rows}×${config.boardConfig.cols}`,
      },
      boards: boards.map((b) => ({
        id: b.id,
        number: b.boardNumber,
        items: b.items.map((item) => ({ id: item.id, name: item.name })),
        grid: b.grid.map((row) =>
          row.map((item) => ({ id: item.id, name: item.name }))
        ),
      })),
    };
    localStorage.setItem("tabula-boards", JSON.stringify(data));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO: Success + Summary
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          {t("ready")}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t("title")}
        </h2>

        <p className="text-gray-500 text-sm">
          {boards.length} {t("boards")} · {config.boardConfig.rows}×{config.boardConfig.cols} · {config.items.length} {t("items")}
        </p>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          PRIMARY CTA: Download JSON
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <button
          onClick={handleDownloadJSON}
          className="w-full p-5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white transition-all hover:shadow-lg hover:shadow-amber-200/50 active:scale-[0.99]"
        >
          <div className="flex items-center justify-center gap-3">
            <Download className="w-5 h-5" />
            <span className="font-semibold text-lg">{t("downloadJSON")}</span>
          </div>
          <p className="text-white/70 text-sm mt-1">{t("jsonDescription")}</p>
        </button>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECONDARY OPTIONS: Row of compact buttons
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3"
      >
        <SecondaryButton
          icon={FileText}
          label={t("csv")}
          onClick={handleDownloadCSV}
        />
        <SecondaryButton
          icon={Printer}
          label={t("print")}
          onClick={handlePrint}
        />
        <SecondaryButton
          icon={copied ? Check : Copy}
          label={copied ? t("copied") : t("copy")}
          onClick={handleCopyToClipboard}
          success={copied}
        />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          MORE OPTIONS: Progressive disclosure
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="border-t border-gray-100 pt-4"
      >
        <button
          onClick={() => setShowMore(!showMore)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-2"
        >
          <span>{showMore ? t("hideMore") : t("showMore")}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              showMore && "rotate-180"
            )}
          />
        </button>

        {showMore && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="pt-4"
          >
            <button
              onClick={handleSaveToLocalStorage}
              className="w-full p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 text-sm">
                    {t("saveToBrowser")}
                  </div>
                  <div className="text-xs text-gray-400">
                    {t("browserDescription")}
                  </div>
                </div>
                {saved ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Download className="w-5 h-5 text-gray-300" />
                )}
              </div>
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ============================================================================
// SECONDARY BUTTON
// ============================================================================

function SecondaryButton({
  icon: Icon,
  label,
  onClick,
  success = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  success?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-4 rounded-lg border transition-colors text-center",
        success
          ? "border-emerald-200 bg-emerald-50"
          : "border-gray-100 hover:border-gray-200 bg-white"
      )}
    >
      <Icon
        className={cn(
          "w-5 h-5 mx-auto mb-2",
          success ? "text-emerald-500" : "text-gray-400"
        )}
      />
      <div
        className={cn(
          "text-sm font-medium",
          success ? "text-emerald-700" : "text-gray-700"
        )}
      >
        {label}
      </div>
    </button>
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generatePrintHTML(boards: { boardNumber: number; grid: { name: string }[][] }[]) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Tabula Boards</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #92400e; margin-bottom: 20px; }
          .boards { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
          .board { 
            border: 2px solid #d97706;
            border-radius: 8px;
            padding: 12px;
            page-break-inside: avoid;
          }
          .board-title { 
            text-align: center; 
            font-weight: 600; 
            margin-bottom: 8px;
            color: #92400e;
            font-size: 14px;
          }
          .grid { display: grid; gap: 4px; }
          .cell { 
            padding: 6px 4px; 
            text-align: center; 
            font-size: 9px;
            background: #fef3c7;
            border-radius: 4px;
            line-height: 1.2;
          }
          @media print {
            body { padding: 10px; }
            .board { margin: 4px; padding: 8px; }
          }
        </style>
      </head>
      <body>
        <h1>Tabula</h1>
        <div class="boards">
          ${boards
            .map(
              (b) => `
            <div class="board">
              <div class="board-title">#${b.boardNumber}</div>
              <div class="grid" style="grid-template-columns: repeat(${b.grid[0].length}, 1fr);">
                ${b.grid
                  .flat()
                  .map((item) => `<div class="cell">${item.name}</div>`)
                  .join("")}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </body>
    </html>
  `;
}
