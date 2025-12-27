"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Grid3X3, LayoutGrid, Hash } from "lucide-react";
import { useGeneratorStore, useConfig } from "@/stores/generator-store";
import { cn } from "@/lib/utils";
import { getBoardSize } from "@/lib/types";

interface Preset {
  name: string;
  rows: number;
  cols: number;
}

const presets: Preset[] = [
  { name: "3×3", rows: 3, cols: 3 },
  { name: "4×4", rows: 4, cols: 4 },
  { name: "5×5", rows: 5, cols: 5 },
];

export function StepBoard() {
  const config = useConfig();
  const { setBoardConfig, setNumBoards } = useGeneratorStore();

  const boardSize = getBoardSize(config.boardConfig);
  const totalSlots = config.numBoards * boardSize;
  const minBoards = Math.ceil(config.items.length / boardSize);

  const handlePresetClick = (preset: Preset) => {
    setBoardConfig({ rows: preset.rows, cols: preset.cols });
  };

  const handleRowsChange = (value: string) => {
    const rows = Math.max(1, Math.min(10, parseInt(value) || 1));
    setBoardConfig({ ...config.boardConfig, rows });
  };

  const handleColsChange = (value: string) => {
    const cols = Math.max(1, Math.min(10, parseInt(value) || 1));
    setBoardConfig({ ...config.boardConfig, cols });
  };

  const handleBoardsChange = (value: string) => {
    const num = Math.max(1, Math.min(100, parseInt(value) || 1));
    setNumBoards(num);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-amber-900 mb-1">
          Board Configuration
        </h2>
        <p className="text-amber-600 text-sm">
          Set the board dimensions and quantity
        </p>
      </div>

      {/* Grid Size */}
      <div className="space-y-4">
        <Label className="text-amber-800 font-medium flex items-center gap-2">
          <Grid3X3 className="w-4 h-4" />
          Grid Size
        </Label>

        {/* Presets */}
        <div className="flex gap-2">
          {presets.map((preset) => {
            const isActive =
              config.boardConfig.rows === preset.rows &&
              config.boardConfig.cols === preset.cols;
            return (
              <Button
                key={preset.name}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  isActive
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "border-amber-200 text-amber-700 hover:bg-amber-50"
                )}
              >
                {preset.name}
              </Button>
            );
          })}
        </div>

        {/* Custom inputs */}
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <Label htmlFor="rows" className="text-xs text-amber-600">
              Rows
            </Label>
            <Input
              id="rows"
              type="number"
              min={1}
              max={10}
              value={config.boardConfig.rows}
              onChange={(e) => handleRowsChange(e.target.value)}
              className="border-amber-200 focus:border-amber-400"
            />
          </div>
          <span className="text-amber-400 mt-5">×</span>
          <div className="flex-1">
            <Label htmlFor="cols" className="text-xs text-amber-600">
              Columns
            </Label>
            <Input
              id="cols"
              type="number"
              min={1}
              max={10}
              value={config.boardConfig.cols}
              onChange={(e) => handleColsChange(e.target.value)}
              className="border-amber-200 focus:border-amber-400"
            />
          </div>
          <div className="mt-5">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              {boardSize} items/board
            </Badge>
          </div>
        </div>

        {/* Visual preview */}
        <div className="flex justify-center py-4">
          <div
            className="inline-grid gap-1 p-3 bg-amber-50 rounded-lg border border-amber-200"
            style={{
              gridTemplateColumns: `repeat(${config.boardConfig.cols}, 1fr)`,
            }}
          >
            {Array.from({ length: boardSize }).map((_, i) => (
              <div
                key={i}
                className="w-6 h-6 bg-amber-200 rounded-sm flex items-center justify-center text-[10px] text-amber-600 font-medium"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Number of Boards */}
      <div className="space-y-4">
        <Label className="text-amber-800 font-medium flex items-center gap-2">
          <LayoutGrid className="w-4 h-4" />
          Number of Boards
        </Label>

        <div className="flex gap-4 items-end">
          <div className="w-32">
            <Input
              type="number"
              min={1}
              max={100}
              value={config.numBoards}
              onChange={(e) => handleBoardsChange(e.target.value)}
              className="border-amber-200 focus:border-amber-400 text-lg font-medium"
            />
          </div>
          <p className="text-amber-600 text-sm pb-2">
            boards to generate
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-amber-100/80 to-orange-100/80 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-800">
          <Hash className="w-4 h-4" />
          <span className="font-medium">Summary</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-amber-600">Items available:</span>
            <span className="ml-2 font-medium text-amber-900">
              {config.items.length}
            </span>
          </div>
          <div>
            <span className="text-amber-600">Items per board:</span>
            <span className="ml-2 font-medium text-amber-900">{boardSize}</span>
          </div>
          <div>
            <span className="text-amber-600">Total boards:</span>
            <span className="ml-2 font-medium text-amber-900">
              {config.numBoards}
            </span>
          </div>
          <div>
            <span className="text-amber-600">Total slots:</span>
            <span className="ml-2 font-medium text-amber-900">{totalSlots}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

