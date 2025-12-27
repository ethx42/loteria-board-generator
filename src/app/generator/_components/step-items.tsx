"use client";

import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wand2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useGeneratorStore, useConfig } from "@/stores/generator-store";
import { parseItemsFromText, itemsToText } from "@/lib/parser/items-parser";
import { DEFAULT_ITEMS } from "@/lib/types";

export function StepItems() {
  const config = useConfig();
  const { setItemsFromStrings, loadDefaults } = useGeneratorStore();

  // Convert current items to text for the textarea
  const initialText = useMemo(
    () => config.items.map((item) => item.name).join("\n"),
    [config.items]
  );

  const [text, setText] = useState(initialText);
  const [isDirty, setIsDirty] = useState(false);

  // Parse and validate in real-time
  const parseResult = useMemo(() => parseItemsFromText(text), [text]);

  const handleTextChange = (value: string) => {
    setText(value);
    setIsDirty(true);

    // Auto-apply valid changes
    const result = parseItemsFromText(value);
    if (result.success && result.items.length > 0) {
      setItemsFromStrings(result.items);
    }
  };

  const handleLoadDefaults = () => {
    const defaultText = DEFAULT_ITEMS.map((item) => item.name).join("\n");
    setText(defaultText);
    setIsDirty(false);
    loadDefaults();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-amber-900 mb-1">
          Game Items
        </h2>
        <p className="text-amber-600 text-sm">
          Enter your Lotería items, one per line or separated by commas
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadDefaults}
          className="border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          <Wand2 className="w-4 h-4 mr-1" />
          Load Default Items
        </Button>
      </div>

      {/* Text input */}
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={`Enter items here...

Examples:
El Gallo
La Dama, El Sol, La Luna
"Item with, comma"`}
          className="min-h-[200px] font-mono text-sm resize-y border-amber-200 focus:border-amber-400 focus:ring-amber-400"
        />
      </div>

      {/* Status */}
      <div className="flex flex-wrap gap-3 items-center">
        {parseResult.success ? (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 border-emerald-200"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {parseResult.uniqueCount} items
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Invalid input
          </Badge>
        )}

        {parseResult.rawCount !== parseResult.uniqueCount && parseResult.rawCount > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-200">
            {parseResult.rawCount - parseResult.uniqueCount} duplicates removed
          </Badge>
        )}
      </div>

      {/* Warnings */}
      {parseResult.warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-700 text-sm">
            {parseResult.warnings.map((w, i) => (
              <div key={i}>{w.message}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Errors */}
      {parseResult.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            {parseResult.errors.map((e, i) => (
              <div key={i}>{e.message}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Item preview */}
      {parseResult.items.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-700 mb-2">
            Preview ({parseResult.items.length} items)
          </h3>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-3 bg-amber-50/50 rounded-lg border border-amber-100">
            {parseResult.items.slice(0, 50).map((item, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="bg-white text-amber-800 border border-amber-200 text-xs"
              >
                {item.length > 25 ? item.slice(0, 25) + "..." : item}
              </Badge>
            ))}
            {parseResult.items.length > 50 && (
              <Badge variant="outline" className="text-amber-500">
                +{parseResult.items.length - 50} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

