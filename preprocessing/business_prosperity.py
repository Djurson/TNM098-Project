from __future__ import annotations

import json
import re
from typing import Any

import numpy as np
import pandas as pd

import shared

OUTPUT_PATH = shared.OUTPUT_DIR / "business_prosperity.json"

CATEGORY_TO_VENUE_TYPE = {"Food": "Restaurant", "Recreation": "Pub"}
ATTRIBUTION_TOLERANCE = pd.Timedelta("4h")


def _parse_point(wkt: Any) -> dict[str, float] | None:
    if not isinstance(wkt, str):
        return None
    match = re.match(r"^POINT\s*\(\s*([\-\d.]+)\s+([\-\d.]+)\s*\)\s*$", wkt.strip(), re.IGNORECASE)
    if not match:
        return None
    try:
        return {"x": float(match.group(1)), "y": float(match.group(2))}
    except ValueError:
        return None


def _normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    frame.columns = frame.columns.map(lambda n: str(n).strip())
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
        max_occ = row.get("maxOccupancy")
        try:
            max_occ_val: int | None = int(max_occ) if not pd.isna(max_occ) else None
        except (ValueError, TypeError):
            max_occ_val = None

        bld = row.get("buildingId")
        try:
            bld_val: int | None = int(bld) if not pd.isna(bld) else None
        except (ValueError, TypeError):
            bld_val = None

        records.append({
            "venueId": int(row["venueId"]),
            "venueType": str(row["venueType"]),
            "location": _parse_point(row.get("location")),
            "buildingId": bld_val,
            "maxOccupancy": max_occ_val,
        })

    return records


def _load_checkins() -> pd.DataFrame:
    df = pd.read_csv(
        shared.JOURNALS_DIR / "CheckinJournal.csv",
        usecols=["participantId", "timestamp", "venueId", "venueType"],
    )
    df = _normalize_columns(df)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df["participantId"] = pd.to_numeric(df["participantId"], errors="coerce")
    df["venueId"] = pd.to_numeric(df["venueId"], errors="coerce")
    df = df.dropna(subset=["timestamp", "participantId", "venueId"])
    df["participantId"] = df["participantId"].astype("int64")
    df["venueId"] = df["venueId"].astype("int64")
    df["venueType"] = df["venueType"].astype(str).str.strip().str.title()
    return df[df["venueType"].isin({"Pub", "Restaurant"})].sort_values(["participantId", "timestamp"])


def _load_financial() -> pd.DataFrame:
    df = pd.read_csv(
        shared.JOURNALS_DIR / "FinancialJournal.csv",
        usecols=["participantId", "timestamp", "category", "amount"],
    )
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df["participantId"] = pd.to_numeric(df["participantId"], errors="coerce")
    df = df.dropna(subset=["timestamp", "participantId"])
    df["participantId"] = df["participantId"].astype("int64")
    return df[df["category"].isin(CATEGORY_TO_VENUE_TYPE)].sort_values(["participantId", "timestamp"])


def _attribute_revenue(checkins: pd.DataFrame, financial: pd.DataFrame) -> pd.DataFrame:
    """Join financial transactions to venue check-ins by participantId + nearest timestamp."""
    parts: list[pd.DataFrame] = []

    for category, venue_type in CATEGORY_TO_VENUE_TYPE.items():
        cat_fin = financial[financial["category"] == category].copy()
        cat_checkins = (
            checkins[checkins["venueType"] == venue_type][["participantId", "timestamp", "venueId"]]
            .copy()
            .rename(columns={"timestamp": "checkin_ts"})
            .sort_values(["participantId", "checkin_ts"])
        )

        merged = pd.merge_asof(
            cat_fin.sort_values("timestamp"),
            cat_checkins.sort_values("checkin_ts"),
            left_on="timestamp",
            right_on="checkin_ts",
            by="participantId",
            tolerance=ATTRIBUTION_TOLERANCE,
            direction="nearest",
        )

        parts.append(merged.dropna(subset=["venueId"]))

    if not parts:
        return pd.DataFrame(columns=["venueId", "date", "revenue"])

    attributed = pd.concat(parts, ignore_index=True)
    attributed["revenue"] = -attributed["amount"]  # expenses are negative
    attributed["date"] = attributed["timestamp"].dt.floor("D").dt.strftime("%Y-%m-%d")
    attributed["venueId"] = attributed["venueId"].astype("int64")

    return (
        attributed.groupby(["venueId", "date"])["revenue"]
        .sum()
        .reset_index()
    )


def _daily_checkins(checkins: pd.DataFrame) -> pd.DataFrame:
    checkins = checkins.copy()
    checkins["date"] = checkins["timestamp"].dt.floor("D").dt.strftime("%Y-%m-%d")
    daily = (
        checkins.groupby(["venueType", "venueId", "date"])["participantId"]
        .nunique()
        .reset_index(name="checkins")
    )
    daily["checkins"] = daily["checkins"].astype("int64")
    return daily


def _rolling7(values: list[float]) -> list[float]:
    arr = np.array(values, dtype=float)
    result = []
    for i in range(len(arr)):
        window = arr[max(0, i - 6): i + 1]
        result.append(round(float(window.mean()), 2))
    return result


def _compute_prosperity(checkin_vals: list[int], revenue_vals: list[float]) -> dict[str, Any]:
    n = len(checkin_vals)
    if n < 7:
        return {"checkinTrendSlope": 0.0, "revenueTrendSlope": 0.0, "prosperityScore": 0.0, "status": "insufficient_data"}

    x = np.arange(n, dtype=float)
    c = np.array(checkin_vals, dtype=float)
    r = np.array(revenue_vals, dtype=float)

    c_slope = float(np.polyfit(x, c, 1)[0])
    r_slope = float(np.polyfit(x, r, 1)[0])

    c_mean = c.mean() or 1.0
    r_mean = r.mean() or 1.0

    # Normalised daily slope as fraction of mean — dimensionless trend rate
    nc = c_slope / c_mean
    nr = r_slope / r_mean
    score = round(float((nc + nr) / 2), 6)

    if score > 0.001:
        status = "growing"
    elif score < -0.001:
        status = "struggling"
    else:
        status = "stable"

    return {
        "checkinTrendSlope": round(c_slope, 4),
        "revenueTrendSlope": round(r_slope, 4),
        "prosperityScore": score,
        "status": status,
    }


def main() -> None:
    print("Loading data...")
    venues = _load_businesses()
    checkins = _load_checkins()
    financial = _load_financial()

    print("Attributing revenue to venues...")
    daily_revenue = _attribute_revenue(checkins, financial)
    daily_traffic = _daily_checkins(checkins)

    # Build lookup: venueId → {date → checkins}
    traffic_lookup: dict[int, dict[str, int]] = {}
    for _, row in daily_traffic.iterrows():
        traffic_lookup.setdefault(int(row["venueId"]), {})[str(row["date"])] = int(row["checkins"])

    # Build lookup: venueId → {date → revenue}
    revenue_lookup: dict[int, dict[str, float]] = {}
    for _, row in daily_revenue.iterrows():
        revenue_lookup.setdefault(int(row["venueId"]), {})[str(row["date"])] = float(row["revenue"])

    print("Building venue records...")
    venue_records: list[dict[str, object]] = []

    for venue in venues:
        vid = int(venue["venueId"])
        max_occ = venue.get("maxOccupancy") or 1

        t_by_date = traffic_lookup.get(vid, {})
        r_by_date = revenue_lookup.get(vid, {})

        all_dates = sorted(set(t_by_date) | set(r_by_date))

        checkin_vals = [t_by_date.get(d, 0) for d in all_dates]
        revenue_vals = [r_by_date.get(d, 0.0) for d in all_dates]
        utilization_vals = [round(min(c / max_occ, 1.0), 4) for c in checkin_vals]
        checkins_r7 = _rolling7([float(c) for c in checkin_vals])
        revenue_r7 = _rolling7(revenue_vals)

        history = [
            {
                "date": d,
                "checkins": checkin_vals[i],
                "revenue": round(revenue_vals[i], 2),
                "utilization": utilization_vals[i],
                "checkinsRolling7": checkins_r7[i],
                "revenueRolling7": revenue_r7[i],
            }
            for i, d in enumerate(all_dates)
        ]

        prosperity = _compute_prosperity(checkin_vals, revenue_vals)

        venue_records.append({
            "venueId": vid,
            "venueType": venue["venueType"],
            "location": venue.get("location"),
            "buildingId": venue.get("buildingId"),
            "maxOccupancy": venue.get("maxOccupancy"),
            "totalCheckins": sum(checkin_vals),
            "totalRevenue": round(sum(revenue_vals), 2),
            **prosperity,
            "history": history,
        })

    payload = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "venues": venue_records,
    }

    shared.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=True)

    print(f"Saved {len(venue_records)} venue records to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
