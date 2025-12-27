/**
 * Generator Store
 * Zustand store for wizard state management
 */

import { create } from "zustand";
import type {
  WizardStep,
  WizardState,
  GeneratorConfig,
  GenerationResult,
  ConstraintValidation,
  Item,
  BoardConfig,
  DistributionStrategy,
} from "@/lib/types";
import {
  DEFAULT_CONFIG,
  DEFAULT_ITEMS,
  DEFAULT_BOARD_CONFIG,
  DEFAULT_NUM_BOARDS,
} from "@/lib/types";
import { validateConstraints } from "@/lib/constraints/engine";
import { generateBoards } from "@/lib/solver";

interface GeneratorStore extends WizardState {
  // Navigation
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;

  // Configuration updates
  setItems: (items: Item[]) => void;
  setItemsFromStrings: (names: string[]) => void;
  setBoardConfig: (config: BoardConfig) => void;
  setNumBoards: (num: number) => void;
  setDistribution: (strategy: DistributionStrategy) => void;

  // Generation
  generate: () => Promise<void>;
  regenerate: () => Promise<void>;

  // Reset
  reset: () => void;
  loadDefaults: () => void;
}

const STEP_ORDER: WizardStep[] = [
  "items",
  "board",
  "distribution",
  "preview",
  "export",
];

const initialState: WizardState = {
  currentStep: "items",
  config: DEFAULT_CONFIG,
  result: null,
  validations: [],
  isGenerating: false,
  error: null,
};

export const useGeneratorStore = create<GeneratorStore>((set, get) => ({
  ...initialState,

  // Navigation
  setStep: (step) => {
    set({ currentStep: step });
  },

  nextStep: () => {
    const { currentStep } = get();
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      const nextStep = STEP_ORDER[currentIndex + 1];

      // If moving to preview, trigger generation
      if (nextStep === "preview") {
        set({ currentStep: nextStep });
        get().generate();
      } else {
        set({ currentStep: nextStep });
      }
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      set({ currentStep: STEP_ORDER[currentIndex - 1] });
    }
  },

  canGoNext: () => {
    const { currentStep, config, validations, isGenerating } = get();

    if (isGenerating) return false;

    switch (currentStep) {
      case "items":
        return config.items.length >= config.boardConfig.rows * config.boardConfig.cols;
      case "board":
        return config.numBoards >= 1;
      case "distribution": {
        const errors = validations.filter((v) => !v.isValid && v.severity === "error");
        return errors.length === 0;
      }
      case "preview":
        return get().result?.success ?? false;
      case "export":
        return false; // Last step
      default:
        return true;
    }
  },

  canGoPrev: () => {
    const { currentStep, isGenerating } = get();
    return !isGenerating && STEP_ORDER.indexOf(currentStep) > 0;
  },

  // Configuration
  setItems: (items) => {
    set((state) => {
      const newConfig = { ...state.config, items };
      return {
        config: newConfig,
        validations: validateConstraints(newConfig),
        result: null, // Invalidate previous result
      };
    });
  },

  setItemsFromStrings: (names) => {
    const items: Item[] = names.map((name, index) => ({
      id: String(index + 1).padStart(2, "0"),
      name,
    }));
    get().setItems(items);
  },

  setBoardConfig: (boardConfig) => {
    set((state) => {
      const newConfig = { ...state.config, boardConfig };
      return {
        config: newConfig,
        validations: validateConstraints(newConfig),
        result: null,
      };
    });
  },

  setNumBoards: (numBoards) => {
    set((state) => {
      const newConfig = { ...state.config, numBoards };
      return {
        config: newConfig,
        validations: validateConstraints(newConfig),
        result: null,
      };
    });
  },

  setDistribution: (distribution) => {
    set((state) => {
      const newConfig = { ...state.config, distribution };
      return {
        config: newConfig,
        validations: validateConstraints(newConfig),
        result: null,
      };
    });
  },

  // Generation
  generate: async () => {
    const { config, isGenerating } = get();

    if (isGenerating) return;

    set({ isGenerating: true, error: null });

    try {
      const result = await generateBoards(config);

      if (result.success) {
        set({ result, isGenerating: false });
      } else {
        set({
          result,
          error: result.errors?.join(", ") ?? "Generation failed",
          isGenerating: false,
        });
      }
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Unknown error",
        isGenerating: false,
      });
    }
  },

  regenerate: async () => {
    set({ result: null });
    await get().generate();
  },

  // Reset
  reset: () => {
    set(initialState);
  },

  loadDefaults: () => {
    set({
      config: {
        items: DEFAULT_ITEMS,
        numBoards: DEFAULT_NUM_BOARDS,
        boardConfig: DEFAULT_BOARD_CONFIG,
        distribution: { type: "uniform" },
      },
      validations: validateConstraints(DEFAULT_CONFIG),
      result: null,
    });
  },
}));

// Selector hooks for performance
export const useCurrentStep = () => useGeneratorStore((s) => s.currentStep);
export const useConfig = () => useGeneratorStore((s) => s.config);
export const useResult = () => useGeneratorStore((s) => s.result);
export const useValidations = () => useGeneratorStore((s) => s.validations);
export const useIsGenerating = () => useGeneratorStore((s) => s.isGenerating);
export const useError = () => useGeneratorStore((s) => s.error);

