// Shared constants used by the calendar, the API and the analytics module.

export const CATEGORIES = [
  "Product Meeting",
  "Sales Meeting",
  "Internal",
  "Focus Time",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const TEAMS = ["Product", "Sales"] as const;
export type Team = (typeof TEAMS)[number];

// One fixed colour per category (used for calendar blocks and charts).
export const CATEGORY_COLORS: Record<Category, string> = {
  "Product Meeting": "#2a78d6",
  "Sales Meeting": "#eb6834",
  Internal: "#1baf7a",
  "Focus Time": "#eda100",
  Other: "#e87ba4",
};

// Categories that count as "meetings" for meeting count / average length.
export const MEETING_CATEGORIES: Category[] = ["Product Meeting", "Sales Meeting", "Internal"];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
