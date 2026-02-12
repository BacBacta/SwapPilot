"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/* ========================================
   SEARCH INPUT - With icon and clear button
   ======================================== */
interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value = "",
  onChange,
  placeholder = "Search...",
  className,
  autoFocus = false,
}: SearchInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border bg-sp-surface2 px-3.5 py-2.5 transition-[transform,background-color,border-color,color,opacity,box-shadow] duration-fast ease-standard",
        focused ? "border-sp-borderActive shadow-glow" : "border-sp-border hover:border-sp-borderHover",
        className
      )}
    >
      <SearchIcon className="h-4 w-4 shrink-0 text-sp-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 bg-transparent text-body text-sp-text placeholder:text-sp-muted2 focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange?.("")}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-sp-surface3 text-sp-muted transition hover:bg-sp-border hover:text-sp-text"
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ========================================
   SLIDER - Range input for slippage, etc.
   ======================================== */
interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  label?: string;
  suffix?: string;
  className?: string;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  suffix = "%",
  className,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-caption text-sp-muted">{label}</span>
          <span className="text-caption font-semibold text-sp-text">
            {value}{suffix}
          </span>
        </div>
      )}
      <div className="relative">
        <div className="h-2 w-full rounded-full bg-sp-surface3">
          <div
            className="h-2 rounded-full bg-sp-accent transition-[width,background-color,opacity] duration-base ease-standard"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className="absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-sp-accent [&::-webkit-slider-thumb]:bg-sp-bg [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        />
      </div>
    </div>
  );
}

/* ========================================
   TABS - Segmented control
   ======================================== */
interface TabsProps<T extends string> {
  tabs: { value: T; label: string }[];
  value: T;
  onChange?: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  size = "md",
  className,
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-sp-border bg-sp-surface p-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange?.(tab.value)}
          className={cn(
            "rounded-lg font-semibold transition-[transform,background-color,border-color,color,opacity,box-shadow] duration-fast ease-standard",
            size === "sm" ? "px-3 py-1.5 text-micro" : "px-4 py-2 text-caption",
            value === tab.value
              ? "bg-sp-accent text-black shadow-glow"
              : "text-sp-muted hover:text-sp-text"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ========================================
   PRESET BUTTONS - Quick select options
   ======================================== */
interface PresetButtonsProps {
  options: { value: string | number; label: string }[];
  value?: string | number;
  onChange?: (value: string | number) => void;
  className?: string;
}

export function PresetButtons({
  options,
  value,
  onChange,
  className,
}: PresetButtonsProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange?.(opt.value)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-micro font-semibold transition-[transform,background-color,border-color,color,opacity,box-shadow] duration-fast ease-standard",
            value === opt.value
              ? "border-sp-accent/50 bg-sp-accent/15 text-sp-accent"
              : "border-sp-border bg-sp-surface2 text-sp-muted hover:border-sp-borderHover hover:text-sp-text"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ========================================
   ICONS
   ======================================== */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
