export type Vector2 = {
  x: number;
  y: number;
};

export type Pub = {
  id: number;
  hourlyCost: number;
  maxOccupancy: number;
  location: Vector2;
  buildingId: number;
};

export type Resturant = {
  id: number;
  location: Vector2;
  buildingId: number;
  foodCost: number;
  maxOccupancy: number;
};

export type TooltipData = {
  title: string;
  details: { label: string; value: string | number }[];
};

export type BuildingType = "residential" | "commercial" | "school" | "other";

export type BuildingFeature = {
  buildingId: number;
  buildingType: string;
  typeGroup: BuildingType;
  maxOccupancy: number | null;
  units: number[] | null;
  polygon: number[][][];
  centroid: [number, number] | null;
};

export type BuildingDataset = {
  generatedAt: string;
  buildings: BuildingFeature[];
};

export type PubPoint = {
  pubId: number;
  location: Vector2;
  buildingId: number | null;
  hourlyCost: number | null;
  maxOccupancy: number | null;
};

export type RestaurantPoint = {
  restaurantId: number;
  location: Vector2;
  buildingId: number | null;
  foodCost: number | null;
  maxOccupancy: number | null;
};

export type SchoolPoint = {
  schoolId: number;
  location: Vector2;
  buildingId: number | null;
  monthlyCost: number | null;
  maxEnrollment: number | null;
};

export type EmployerPoint = {
  employerId: number;
  location: Vector2;
  buildingId: number | null;
};

export type MapLayers = {
  generatedAt: string;
  buildings: BuildingFeature[];
  pubs: PubPoint[];
  restaurants: RestaurantPoint[];
  schools: SchoolPoint[];
  employers: EmployerPoint[];
};

export type BusinessTrafficPoint = {
  date: string;
  checkins: number;
};

export type BusinessTrafficSummary = {
  date: string;
  total: number;
  pubs: number;
  restaurants: number;
};

export type BusinessTrafficVenue = {
  venueId: number;
  venueType: "Pub" | "Restaurant";
  location: Vector2 | null;
  buildingId: number | null;
  maxOccupancy: number | null;
  totalCheckins: number;
  history: BusinessTrafficPoint[];
};

export type BusinessTrafficDataset = {
  generatedAt: string;
  summary: BusinessTrafficSummary[];
  venues: BusinessTrafficVenue[];
};

export type TimeRangeDropdown = "day" | "week" | "month";
