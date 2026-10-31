export const CATEGORY_IDS = [
  "lies",
  "trajectory",
  "short-game",
  "bunkers",
  "rough-and-trouble",
  "putting",
  "conditions",
  "mental",
  "strategy",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  id: CategoryId;
  title: string;
  description: string;
}

/** Fixed list, in display order. Keep in sync with the table in AGENTS.md. */
export const CATEGORIES: readonly Category[] = [
  { id: "lies", title: "Lies", description: "Slopes, ball above or below your feet, divots, hardpan and tight lies." },
  { id: "trajectory", title: "Trajectory", description: "Hitting it high, low, drawing, fading, punching and stingers." },
  { id: "short-game", title: "Short game", description: "Chips, pitches, lobs, bump-and-runs, and when to chip or putt." },
  { id: "bunkers", title: "Bunkers", description: "Greenside, fairway, plugged lies and wet sand." },
  { id: "rough-and-trouble", title: "Rough & trouble", description: "Thick grass, trees, recovery shots and hazards." },
  { id: "putting", title: "Putting", description: "Reading greens, lag putting, short putts and speed." },
  { id: "conditions", title: "Conditions", description: "Wind, rain, cold, heat, and firm or soft ground." },
  { id: "mental", title: "Mental game", description: "Nerves, routine, focus and bouncing back from a bad hole." },
  { id: "strategy", title: "Strategy", description: "Course management, club selection and aiming." },
];

export function getCategory(id: CategoryId): Category {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Unknown category: ${id}`);
  return category;
}
