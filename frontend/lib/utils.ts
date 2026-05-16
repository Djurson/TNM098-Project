import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import businesses from "@/public/businesses.json"
import { Pub, Resturant } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ParseBusinessJSON(): Record<number, Pub | Resturant> {
  const parsedData: Record<number, Pub | Resturant> = {}

  Object.entries(businesses).forEach(([id, business]) => {
    const match = business.location.match(
      /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/
    )
    const x = match ? parseFloat(match[1]) : 0
    const y = match ? parseFloat(match[2]) : 0

    if ("hourlyCost" in business) {
      parsedData[Number(id)] = {
        id: Number(id),
        hourlyCost: Number(business.hourlyCost ?? 0),
        maxOccupancy: Number(business.maxOccupancy ?? 0),
        location: { x, y },
        buildingId: Number(business.buildingId ?? 0),
      }
    } else {
      parsedData[Number(id)] = {
        id: Number(id),
        foodCost: Number(business.foodCost ?? 0),
        maxOccupancy: Number(business.maxOccupancy ?? 0),
        location: { x, y },
        buildingId: Number(business.buildingId ?? 0),
      }
    }
  })

  return parsedData
}
