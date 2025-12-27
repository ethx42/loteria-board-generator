"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Info, BarChart3 } from "lucide-react";
import { useConfig, useValidations } from "@/stores/generator-store";
import { autoDistribute, computeConstraints } from "@/lib/constraints/engine";
import { getBoardSize } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StepDistribution() {
  const config = useConfig();
  const validations = useValidations();

  const boardSize = getBoardSize(config.boardConfig);
  const constraints = useMemo(() => computeConstraints(config), [config]);
  const distribution = useMemo(
    () => autoDistribute(config.items.length, config.numBoards, boardSize),
    [config.items.length, config.numBoards, boardSize]
  );

  const errors = validations.filter((v) => !v.isValid && v.severity === "error");
  const isValid = errors.length === 0;

  // Group items by frequency for display
  const frequencyGroups = useMemo(() => {
    const groups: { frequency: number; count: number; indices: number[] }[] = [];
    const freqMap = new Map<number, number[]>();

    distribution.frequencies.forEach((freq, idx) => {
      if (!freqMap.has(freq)) {
        freqMap.set(freq, []);
      }
      freqMap.get(freq)!.push(idx);
    });

    freqMap.forEach((indices, frequency) => {
      groups.push({ frequency, count: indices.length, indices });
    });

    return groups.sort((a, b) => b.frequency - a.frequency);
  }, [distribution.frequencies]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-amber-900 mb-1">
          Distribution Preview
        </h2>
        <p className="text-amber-600 text-sm">
          Review how items will be distributed across boards
        </p>
      </div>

      {/* Status */}
      {isValid ? (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700">
            Configuration is valid. Ready to generate boards.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            <div className="font-medium mb-1">Cannot generate boards:</div>
            <ul className="list-disc list-inside text-sm">
              {errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Constraints */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {validations.map((v, i) => (
          <div
            key={i}
            className={cn(
              "p-3 rounded-lg border text-sm",
              v.isValid
                ? "bg-emerald-50 border-emerald-200"
                : v.severity === "error"
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-200"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {v.isValid ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle
                  className={cn(
                    "w-3.5 h-3.5",
                    v.severity === "error" ? "text-red-600" : "text-amber-600"
                  )}
                />
              )}
              <span
                className={cn(
                  "font-medium text-xs uppercase tracking-wide",
                  v.isValid
                    ? "text-emerald-700"
                    : v.severity === "error"
                    ? "text-red-700"
                    : "text-amber-700"
                )}
              >
                {v.constraint.replace("_", " ")}
              </span>
            </div>
            <p
              className={cn(
                "text-xs",
                v.isValid ? "text-emerald-600" : "text-gray-600"
              )}
            >
              {v.message}
            </p>
          </div>
        ))}
      </div>

      {/* Frequency distribution */}
      {distribution.isValid && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-800">
            <BarChart3 className="w-4 h-4" />
            <span className="font-medium">Item Frequencies</span>
          </div>

          <div className="bg-amber-50/50 rounded-lg border border-amber-100 p-4">
            <div className="space-y-3">
              {frequencyGroups.map((group, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Badge className="bg-amber-200 text-amber-800 min-w-[60px] justify-center">
                    ×{group.frequency}
                  </Badge>
                  <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${(group.count / config.items.length) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-amber-600 min-w-[80px]">
                    {group.count} items
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-amber-200 text-sm text-amber-600">
              <div className="flex justify-between">
                <span>Total item appearances:</span>
                <span className="font-medium text-amber-800">
                  {constraints.sumFrequencies}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Required slots (B × S):</span>
                <span className="font-medium text-amber-800">{constraints.T}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggestion */}
      {distribution.suggestion && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            {distribution.suggestion}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

