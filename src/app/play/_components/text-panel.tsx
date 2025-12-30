"use client";

/**
 * TextPanel Component - Enterprise Edition
 *
 * Premium educational content panel with sophisticated styling:
 * - Glassmorphic design with subtle backdrop blur
 * - Animated accent elements that respond to theme color
 * - Micro-animations on content entry
 * - Decorative elements connecting to the card visually
 * - Refined typography with proper hierarchy
 *
 * @see SRD §5.1 Host Display Layout
 * @see SRD §5.4 Animation Specifications
 * @see FR-032, FR-033
 */

import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import type { ItemDefinition } from "@/lib/types/game";
import { DetailedTextAccordion } from "./detailed-text-accordion";

// ============================================================================
// TYPES
// ============================================================================

interface TextPanelProps {
  /** The current item to display text for */
  item: ItemDefinition | null;

  /** Whether to show the category badge */
  showCategory?: boolean;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className for the container */
  className?: string;

  // ========================================
  // DetailedText Accordion Props (v4.0)
  // ========================================

  /** Whether the detailed text accordion is expanded */
  isDetailedExpanded?: boolean;

  /** Callback when detailed expansion state changes */
  onDetailedChange?: (isExpanded: boolean) => void;

  /** Whether this state was synced from controller */
  isDetailedSyncedFromController?: boolean;

  /** Whether spectator has locally overridden */
  isDetailedLocalOverride?: boolean;

  /** i18n texts for the accordion */
  detailedTexts?: {
    expand?: string;
    collapse?: string;
    syncedFromController?: string;
    localOverride?: string;
  };
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const panelVariants = {
  initial: {
    opacity: 0,
    x: 30,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.23, 1, 0.32, 1], // Custom easing for premium feel
      delay: 0.2,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    scale: 0.98,
    transition: {
      duration: 0.25,
      ease: "easeIn",
    },
  },
};

const reducedMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { delay: 0.2, duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// Staggered content animation for each element
const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
    },
  },
};

// Accent line animation
const accentLineVariants = {
  initial: { scaleX: 0, originX: 0 },
  animate: {
    scaleX: 1,
    transition: {
      duration: 0.6,
      delay: 0.4,
      ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
    },
  },
};

// ============================================================================
// DECORATIVE COMPONENTS
// ============================================================================

/**
 * Decorative quote marks for the short text
 */
function QuoteMark({
  position,
  themeColor,
}: {
  position: "start" | "end";
  themeColor: string;
}) {
  return (
    <span
      className={`
        absolute font-serif text-4xl leading-none opacity-20
        ${position === "start" ? "-left-2 -top-4" : "-bottom-6 -right-2"}
      `}
      style={{ color: themeColor }}
      aria-hidden="true"
    >
      {position === "start" ? "\u201C" : "\u201D"}
    </span>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TextPanel({
  item,
  showCategory = true,
  reducedMotion = false,
  className = "",
  // DetailedText props
  isDetailedExpanded = false,
  onDetailedChange,
  isDetailedSyncedFromController = false,
  isDetailedLocalOverride = false,
  detailedTexts = {},
}: TextPanelProps) {
  const t = useTranslations("textPanel");
  const variants = reducedMotion ? reducedMotionVariants : panelVariants;
  const themeColor = item?.themeColor || "#f59e0b";

  return (
    <div className={`flex flex-col ${className}`}>
      <AnimatePresence mode="wait">
        {item ? (
          <motion.div
            key={item.id}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative overflow-hidden rounded-2xl shadow-xl ring-1 ring-white/10"
            style={{
              background: `linear-gradient(160deg, 
                rgba(120, 53, 15, 0.92) 0%, 
                rgba(69, 26, 3, 0.95) 50%, 
                ${themeColor}08 100%)`,
            }}
          >
            {/* Glassmorphic overlay */}
            <div className="absolute inset-0 backdrop-blur-sm" />

            {/* Decorative gradient accent at top */}
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{
                background: `linear-gradient(90deg, 
                  transparent 0%, 
                  ${themeColor} 20%, 
                  ${themeColor} 80%, 
                  transparent 100%)`,
              }}
            />

            {/* Content Container */}
            <motion.div
              className="relative z-10 p-6 md:p-8 lg:p-10"
              variants={!reducedMotion ? contentVariants : undefined}
              initial="hidden"
              animate="visible"
            >
              {/* Header Row */}
              <motion.div
                className="mb-4 flex items-start justify-between gap-4"
                variants={!reducedMotion ? itemVariants : undefined}
              >
                {/* Card Name */}
                <h2 className="font-serif text-2xl font-bold tracking-wide text-amber-50 md:text-3xl lg:text-4xl">
                  {item.name}
                </h2>

                {/* Category Badge */}
                {showCategory && item.category && (
                  <motion.span
                    className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm"
                    style={{
                      backgroundColor: `${themeColor}25`,
                      color: themeColor,
                      border: `1px solid ${themeColor}40`,
                    }}
                    whileHover={{ scale: 1.05 }}
                  >
                    {item.category}
                  </motion.span>
                )}
              </motion.div>

              {/* Animated Accent Line */}
              <motion.div
                className="mb-6 h-0.5 w-20 rounded-full"
                style={{ backgroundColor: themeColor }}
                variants={!reducedMotion ? accentLineVariants : undefined}
                initial="initial"
                animate="animate"
              />

              {/* Educational Short Text */}
              <motion.div
                className="relative"
                variants={!reducedMotion ? itemVariants : undefined}
              >
                <QuoteMark position="start" themeColor={themeColor} />
                <p className="pl-2 font-serif text-lg leading-relaxed text-amber-50/95 md:text-xl lg:text-2xl">
                  {item.shortText}
                </p>
                <QuoteMark position="end" themeColor={themeColor} />
              </motion.div>


              {/* Detailed Text Accordion */}
              {item.detailedText && onDetailedChange && (
                <motion.div variants={!reducedMotion ? itemVariants : undefined}>
                  <DetailedTextAccordion
                    detailedText={item.detailedText}
                    isExpanded={isDetailedExpanded}
                    onToggle={() => onDetailedChange(!isDetailedExpanded)}
                    themeColor={themeColor}
                    isSyncedFromController={isDetailedSyncedFromController}
                    isLocalOverride={isDetailedLocalOverride}
                    expandText={detailedTexts.expand}
                    collapseText={detailedTexts.collapse}
                    syncedText={detailedTexts.syncedFromController}
                    overrideText={detailedTexts.localOverride}
                  />
                </motion.div>
              )}

            </motion.div>

            {/* Decorative corner element */}
            <div
              className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full opacity-5 blur-3xl"
              style={{ backgroundColor: themeColor }}
            />
          </motion.div>
        ) : (
          /* Placeholder State */
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-amber-500/20 bg-gradient-to-br from-amber-900/20 to-amber-950/30 p-6 backdrop-blur-sm"
          >
            {/* Waiting animation */}
            <motion.div
              className="mb-4 flex gap-1"
              initial="hidden"
              animate="visible"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-amber-500/40"
                  animate={{
                    y: [0, -6, 0],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>

            <p className="text-center font-serif text-lg text-amber-200/40">
              {t("drawPrompt")}
            </p>

            {/* Decorative lines */}
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-500/30" />
              <div className="h-1.5 w-1.5 rotate-45 bg-amber-500/30" />
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-500/30" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TextPanel;
