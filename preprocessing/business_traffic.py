from __future__ import annotations

import json
import re
from typing import Any

import pandas as pd

import shared

OUTPUT_PATH = shared.OUTPUT_DIR / "business_traffic.json"


def _parse_point(wkt: Any) -> dict[str, float] | None:
    if not isinstance(wkt, str):
        return None
    text = wkt.strip()
    match = re.match(r"^POINT\s*\(\s*([\-\d.]+)\s+([\-\d.]+)\s*\)\s*$", text, re.IGNORECASE)
    if not match:
        return None
    try:
        return {"x": float(match.group(1)), "y": float(match.group(2))}
    except ValueError:
        return None


def _normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    frame.columns = frame.columns.map(lambda name: str(name).strip())
    return frame


def _load_businesses() -> list[dict[str, object]]:
    pubs = _normalize_columns(pd.read_csv(shared.ATTRIBUTES_DIR / "Pubs.csv"))
    pubs = pubs.rename(columns={"pubId": "venueId"})
    pubs["venueType"] = "Pub"

    restaurants = _normalize_columns(pd.read_csv(shared.ATTRIBUTES_DIR / "Restaurants.csv"))
    restaurants = restaurants.rename(columns={"restaurantId": "venueId"})
    restaurants["venueType"] = "Restaurant"

    combined = pd.concat([pubs, restaurants], ignore_index=True, sort=False)

    records: list[dict[str, object]] = []
    for _, row in combined.iterrows():
        location = _parse_point(row.get("location"))
        venue_id = int(row.get("venueId"))
        venue_type = str(row.get("venueType"))
        max_occupancy = row.get("maxOccupancy")
        max_occupancy_value = None
        if not pd.isna(max_occupancy):
            try:
                max_occupancy_value = int(max_occupancy)
            except ValueError:
                max_occupancy_value = None

        building_id = row.get("buildingId")
        building_id_value = None
        if not pd.isna(building_id):
            try:
                building_id_value = int(building_id)
            except ValueError:
                building_id_value = None

        records.append(
            {
                "venueId": venue_id,
                "venueType": venue_type,
                "location": location,
                "buildingId": building_id_value,
                "maxOccupancy": max_occupancy_value,
            }
        )

    return records


def _load_daily_checkins() -> pd.DataFrame:
    checkins_path = shared.JOURNALS_DIR / "CheckinJournal.csv"
    checkins = pd.read_csv(checkins_path, usecols=["participantId", "timestamp", "venueId", "venueType"])
    checkins = _normalize_columns(checkins)
    checkins["timestamp"] = pd.to_datetime(checkins["timestamp"], utc=True, errors="coerce")
    checkins = checkins.dropna(subset=["timestamp", "participantId", "venueId", "venueType"])

    checkins["venueType"] = checkins["venueType"].astype(str).str.strip().str.title()
    checkins = checkins[checkins["venueType"].isin({"Pub", "Restaurant"})]

    checkins["date"] = checkins["timestamp"].dt.floor("D").dt.strftime("%Y-%m-%d")
    checkins["participantId"] = pd.to_numeric(checkins["participantId"], errors="coerce")
    checkins["venueId"] = pd.to_numeric(checkins["venueId"], errors="coerce")
    checkins = checkins.dropna(subset=["participantId", "venueId"])

    daily = (
        checkins.groupby(["venueType", "venueId", "date"])["participantId"]
        .nunique()
        .reset_index(name="checkins")
    )

    daily["venueId"] = daily["venueId"].astype("int64")
    daily["checkins"] = daily["checkins"].astype("int64")
    return daily


def _build_summary(daily: pd.DataFrame) -> list[dict[str, int | str]]:
    summary = daily.groupby(["date", "venueType"])["checkins"].sum().unstack(fill_value=0)
    summary["total"] = summary.sum(axis=1)

    summary_records: list[dict[str, int | str]] = []
    for date, row in summary.sort_index().iterrows():
        summary_records.append(
            {
                "date": str(date),
                "total": int(row.get("total", 0)),
                "pubs": int(row.get("Pub", 0)),
                "restaurants": int(row.get("Restaurant", 0)),
            }
        )
    return summary_records


def _build_venue_history(daily: pd.DataFrame) -> dict[tuple[str, int], list[dict[str, int | str]]]:
    history: dict[tuple[str, int], list[dict[str, int | str]]] = {}
    for _, row in daily.sort_values("date").iterrows():
        key = (str(row["venueType"]), int(row["venueId"]))
        history.setdefault(key, []).append(
            {
                "date": str(row["date"]),
                "checkins": int(row["checkins"]),
            }
        )
    return history


def main() -> None:
    venues = _load_businesses()
    daily = _load_daily_checkins()

    summary = _build_summary(daily)
    history_lookup = _build_venue_history(daily)

    venue_records: list[dict[str, object]] = []
    for venue in venues:
        venue_type = str(venue["venueType"])
        venue_id = int(venue["venueId"])
        history = history_lookup.get((venue_type, venue_id), [])
        total_checkins = sum(item["checkins"] for item in history)

        venue_records.append(
            {
                "venueId": venue_id,
                "venueType": venue_type,
                "location": venue.get("location"),
                "buildingId": venue.get("buildingId"),
                "maxOccupancy": venue.get("maxOccupancy"),
                "totalCheckins": int(total_checkins),
                "history": history,
            }
        )

    payload = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "summary": summary,
        "venues": venue_records,
    }

    shared.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=True)

    print(f"Saved business traffic data to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
