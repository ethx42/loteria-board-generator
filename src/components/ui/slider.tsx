"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * Custom slider with properly aligned thumb
 * Uses a visual track + thumb overlay instead of native styling
 */
const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ value, onValueChange, min = 0, max = 100, step = 1, className }, ref) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    
    // Calculate position percentage
    const percent = ((value[0] - min) / (max - min)) * 100;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange([parseInt(e.target.value, 10)]);
    };

    return (
      <div ref={ref} className={cn("relative w-full", className)}>
        {/* Visual track */}
        <div 
          ref={trackRef}
          className="relative h-2 w-full rounded-full bg-gray-200"
        >
          {/* Filled portion */}
          <div 
            className="absolute inset-y-0 left-0 rounded-full bg-amber-500 transition-all duration-75"
            style={{ width: `${percent}%` }}
          />
          
          {/* Thumb - positioned to align with track edges */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-amber-500 shadow-lg pointer-events-none transition-all duration-75"
            style={{ 
              left: `calc(${percent}% - ${percent * 0.2}px)`,
            }}
          />
        </div>
        
        {/* Invisible native input for accessibility and interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Slider"
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
