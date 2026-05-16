"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { Pub, Resturant } from "@/lib/types"

export default function CityMap({
  data,
}: {
  data: Record<number, Pub | Resturant>
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const width = 1076
    const height = 1144

    const svg = d3
      .select(svgRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")

    svg.selectAll("*").remove()

    const values = Object.values(data)

    const mapBounds = {
      minX: -5000,
      minY: -200,
      maxX: 2800,
      maxY: 8000,
    }

    svg
      .append("image")
      .attr("href", "/BaseMap.png")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)

    // 3. Create the Scales (The Mathematical Translation)
    const xScale = d3
      .scaleLinear()
      .domain([mapBounds.minX, mapBounds.maxX])
      .range([0, width])

    const yScale = d3
      .scaleLinear()
      .domain([mapBounds.minY, mapBounds.maxY])
      .range([height, 0])

    // 4. Draw the Dots
    // Group element to hold all circles
    const g = svg.append("g")

    g.selectAll("circle")
      .data(values)
      .join("circle")
      .attr("cx", (d) => xScale(d.location.x))
      .attr("cy", (d) => yScale(d.location.y))
      .attr("r", 6)
      // Color code by type (e.g., Pubs vs Restaurants)
      .attr("fill", (d) => ("hourlyCost" in d ? "#f59e0b" : "#3b82f6"))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.8)
      // Enable pointer events on the dots so hover works, even if SVG is pointer-events-none
      .style("pointer-events", "all")
      .append("title") // Simple native browser tooltip
      .text((d) => `${"hourlyCost" in d ? "Pub" : "Restaurant"} ID: ${d.id}`)
  }, [data])

  return (
    <div className="relative mx-auto aspect-square w-full max-w-4xl overflow-hidden rounded-lg border bg-slate-50">
      {/* The D3 Overlay */}
      {/* pointer-events-none ensures you can still drag/interact with the map if you add zoom later,
          while pointer-events: 'all' on the circles ensures tooltips still work */}
      <svg
        ref={svgRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  )
}
