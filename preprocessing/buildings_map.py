from __future__ import annotations

from pathlib import Path
import json
from typing import Any

import pandas as pd

import shared

OUTPUT_PATH = shared.OUTPUT_DIR / "buildings.json"


def _normalize_building_type(raw_value: Any) -> tuple[str, str]:
    raw = str(raw_value).strip()
    lowered = raw.lower()
    if lowered in {"residential", "residental"}:
        return "Residential", "residential"
    if lowered == "commercial":
        return "Commercial", "commercial"
    if lowered == "school":
        return "School", "school"
    if raw:
        return raw, "other"
    return "Other", "other"


def _parse_units(raw_value: Any) -> list[int] | None:
    if pd.isna(raw_value):
        return None
    text = str(raw_value).strip()
    if not text:
        return None
    if text.startswith("[") and text.endswith("]"):
        inner = text[1:-1].strip()
    else:
        inner = text
    if not inner:
        return []
    units: list[int] = []
    for part in inner.split(","):
        token = part.strip()
        if not token:
            continue
        try:
            units.append(int(token))
        except ValueError:
            continue
    return units


def _parse_polygon(wkt: Any) -> list[list[list[float]]]:
    if not isinstance(wkt, str):
        return []
    text = wkt.strip()
    if not text.upper().startswith("POLYGON"):
        return []
    start = text.find("((")
    end = text.rfind("))")
    if start == -1 or end == -1 or end <= start:
        return []

    inner = text[start + 2 : end]
    rings: list[list[list[float]]] = []
    for ring in inner.split("), ("):
        points: list[list[float]] = []
        for pair in ring.split(","):
            parts = pair.strip().split()
            if len(parts) < 2:
                continue
            try:
                x_val = float(parts[0])
                y_val = float(parts[1])
            except ValueError:
                continue
            points.append([x_val, y_val])
        if points:
            rings.append(points)
    return rings


def _polygon_centroid(rings: list[list[list[float]]]) -> list[float] | None:
    xs: list[float] = []
    ys: list[float] = []
    for ring in rings:
        for x_val, y_val in ring:
            xs.append(x_val)
            ys.append(y_val)
    if not xs:
        return None
    return [sum(xs) / len(xs), sum(ys) / len(ys)]


def main() -> None:
    buildings_path = shared.ATTRIBUTES_DIR / "Buildings.csv"
    df = pd.read_csv(buildings_path)
    df.columns = df.columns.map(lambda name: str(name).strip())

    records: list[dict[str, object]] = []
    for _, row in df.iterrows():
        building_id = int(row.get("buildingId"))
        polygon = _parse_polygon(row.get("location"))
        if not polygon:
            continue

        building_type, type_group = _normalize_building_type(row.get("buildingType"))
        max_occupancy = row.get("maxOccupancy")
        max_occupancy_value = None
        if not pd.isna(max_occupancy):
            try:
                max_occupancy_value = int(max_occupancy)
            except ValueError:
                max_occupancy_value = None

        centroid = _polygon_centroid(polygon)
        units = _parse_units(row.get("units"))

        records.append(
            {
                "buildingId": building_id,
                "buildingType": building_type,
                "typeGroup": type_group,
                "maxOccupancy": max_occupancy_value,
                "units": units,
                "polygon": polygon,
                "centroid": centroid,
            }
        )

    payload = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "buildings": records,
    }

    shared.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=True)

    print(f"Saved buildings to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
