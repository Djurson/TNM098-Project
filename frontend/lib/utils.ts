import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BuildingType } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GRAPH_MARGIN_TOP = 20;
export const GRAPH_MARGIN_RIGHT = 40;
export const GRAPH_MARGIN_BOTTOM = 50;
export const GRAPH_MARGIN_LEFT = 35;

export const COLORS = [
  // Teals / Greens (Based on Residential #2f8f83)
  "#2f8f83",
  "#1f6a61",
  "#43ab9d",
  "#205c54",
  "#60c4b7",

  // Ambers / Oranges (Based on Commercial #d9822b)
  "#d9822b",
  "#b8681b",
  "#f29e4c",
  "#965111",
  "#fcb46f",

  // Blues / Indigos (Based on School #4c7bd9)
  "#4c7bd9",
  "#3760b0",
  "#6b95e8",
  "#27488a",
  "#8db1fa",

  // Slates / Grays (Based on Other #8a8f98)
  "#8a8f98",
  "#6b707a",
  "#a9aeb8",
  "#50545c",
  "#c4c9d4",

  // Complementary Architectural Tones (Matched Saturation)
  "#8468b0", // Muted Purple
  "#c95d63", // Muted Rose/Red
  "#c29a36", // Muted Gold
  "#52a3b5", // Soft Cyan
  "#a87860", // Warm Clay/Brown
];

export type LayerKey = "pubs" | "restaurants" | "schools" | "employers";

export const COLOR_BY_TYPE: Record<BuildingType, string> = {
  residential: COLORS[0],
  commercial: COLORS[5],
  school: COLORS[10],
  other: COLORS[15],
};

export const LAYER_STYLES: Record<LayerKey, { label: string; color: string; radius: number }> = {
  pubs: { label: "Pubs", color: COLORS[20], radius: 4.5 },
  restaurants: { label: "Restaurants", color: COLORS[21], radius: 4.5 },
  schools: { label: "Schools", color: COLORS[23], radius: 5 },
  employers: { label: "Employers", color: COLORS[22], radius: 3.5 },
};
