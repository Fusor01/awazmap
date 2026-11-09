import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORIES = [
  "ROADS", "WATER", "SANITATION", "ELECTRICITY", "SAFETY", "TRANSPORT", "OTHER",
] as const;

export function label(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replace("_", " ");
}

export function timeAgo(date: Date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export type CategoryKey = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  ROADS: "Roads & Potholes",
  WATER: "Water Supply",
  SANITATION: "Sanitation & Garbage",
  ELECTRICITY: "Electricity",
  SAFETY: "Public Safety",
  TRANSPORT: "Public Transport",
  OTHER: "Other",
};
export const categoryLabel = (c: string) => CATEGORY_LABELS[c as CategoryKey] ?? label(c);

export const DURATION_UNITS = ["hours", "days", "weeks", "months"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export function durationToDays(value: number | null, unit: DurationUnit | null): number | null {
  if (!value || !unit || !(value > 0)) return null;
  const perUnit = { hours: 1 / 24, days: 1, weeks: 7, months: 30 }[unit];
  return Math.floor(value * perUnit);
}

export function durationText(value: number | null, unit: DurationUnit | null): string | null {
  if (!value || !unit || !(value > 0)) return null;
  return `${value} ${value === 1 ? unit.slice(0, -1) : unit}`;
}
