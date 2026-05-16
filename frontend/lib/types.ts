type Vector2 = {
  x: number
  y: number
}

export type Pub = {
  id: number
  hourlyCost: number
  maxOccupancy: number
  location: Vector2
  buildingId: number
}

export type Resturant = {
  id: number
  location: Vector2
  buildingId: number
  foodCost: number
  maxOccupancy: number
}
