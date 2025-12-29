"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  Copy,
  Check,
  FileJson,
  FileText,
  Printer,
  Share2,
} from "lucide-react";
import { useResult, useConfig } from "@/stores/generator-store";

export function StepExport() {
  const result = useResult();
  const config = useConfig();
  const [copied, setCopied] = useState(false);

  if (!result || !result.success) {
    return (
      <div className="text-center py-12 text-amber-600">
        No boards to export. Go back and generate boards first.
      </div>
    );
  }

  const { boards, stats } = result;

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
        generationTimeMs: stats.generationTimeMs,
      },
      boards: boards.map((b) => ({
        id: b.id,
        number: b.boardNumber,
        items: b.items.map((item) => item.name),
        grid: b.grid.map((row) => row.map((item) => item.name)),
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabula-boards-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const headers = ["Board", ...Array.from({ length: boards[0].items.length }, (_, i) => `Item ${i + 1}`)];
    const rows = boards.map((b) => [
      b.boardNumber,
      ...b.items.map((item) => `"${item.name}"`),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabula-boards-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    // Create a printable version
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tabula Boards</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; }
            .board { 
              display: inline-block; 
              margin: 10px; 
              padding: 10px; 
              border: 2px solid #d97706;
              border-radius: 8px;
              page-break-inside: avoid;
            }
            .board-title { 
              text-align: center; 
              font-weight: bold; 
              margin-bottom: 8px;
              color: #92400e;
            }
            .grid { 
              display: grid; 
              gap: 4px;
            }
            .cell { 
              padding: 8px 4px; 
              text-align: center; 
              font-size: 10px;
              background: #fef3c7;
              border-radius: 4px;
            }
            @media print {
              .board { margin: 5px; }
            }
          </style>
        </head>
        <body>
          <h1 style="text-align: center; color: #92400e;">Tabula Boards</h1>
          <div style="display: flex; flex-wrap: wrap; justify-content: center;">
            ${boards
              .map(
                (b) => `
              <div class="board">
                <div class="board-title">Board #${b.boardNumber}</div>
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

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleSaveToLocalStorage = () => {
    const data = {
      savedAt: new Date().toISOString(),
      boards: boards.map((b) => ({
        id: b.id,
        number: b.boardNumber,
        items: b.items.map((item) => ({ id: item.id, name: item.name })),
        grid: b.grid.map((row) => row.map((item) => ({ id: item.id, name: item.name }))),
      })),
    };
    localStorage.setItem("tabula-boards", JSON.stringify(data));
    alert("Boards saved to browser storage!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-amber-900 mb-1">
          Export Boards
        </h2>
        <p className="text-amber-600 text-sm">
          Download or share your generated boards
        </p>
      </div>

      {/* Summary */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertDescription className="text-amber-700">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-amber-200 text-amber-800">
              {boards.length} boards
            </Badge>
            <Badge className="bg-amber-200 text-amber-800">
              {boards[0].items.length} items each
            </Badge>
            <Badge className="bg-amber-200 text-amber-800">
              Max overlap: {stats.maxOverlap}
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      {/* Export Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ExportCard
          icon={FileJson}
          title="Download JSON"
          description="Complete data with metadata"
          onClick={handleDownloadJSON}
        />
        <ExportCard
          icon={FileText}
          title="Download CSV"
          description="Spreadsheet-compatible format"
          onClick={handleDownloadCSV}
        />
        <ExportCard
          icon={copied ? Check : Copy}
          title={copied ? "Copied!" : "Copy to Clipboard"}
          description="Plain text format"
          onClick={handleCopyToClipboard}
        />
        <ExportCard
          icon={Printer}
          title="Print Boards"
          description="Print-ready layout"
          onClick={handlePrint}
        />
        <ExportCard
          icon={Download}
          title="Save to Browser"
          description="Store for later use"
          onClick={handleSaveToLocalStorage}
        />
        <ExportCard
          icon={Share2}
          title="Play Game"
          description="Start playing with these boards"
          onClick={() => alert("Game mode coming soon!")}
          variant="primary"
        />
      </div>
    </div>
  );
}

function ExportCard({
  icon: Icon,
  title,
  description,
  onClick,
  variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  const isPrimary = variant === "primary";

  return (
    <button
      onClick={onClick}
      className={`
        p-4 rounded-xl border-2 text-left transition-all
        hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
        ${
          isPrimary
            ? "bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400 text-white"
            : "bg-white border-amber-100 hover:border-amber-300"
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            ${isPrimary ? "bg-white/20" : "bg-amber-100"}
          `}
        >
          <Icon className={`w-5 h-5 ${isPrimary ? "text-white" : "text-amber-600"}`} />
        </div>
        <div>
          <div className={`font-medium ${isPrimary ? "text-white" : "text-amber-900"}`}>
            {title}
          </div>
          <div className={`text-sm ${isPrimary ? "text-white/80" : "text-amber-600"}`}>
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}

