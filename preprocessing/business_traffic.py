import pandas as pd
import numpy as np
from pathlib import Path

import shared

BUSINESSES_OUTPUT_PATH = shared.OUTPUT_DIR / "business" / "businesses.json"
DAILY_OUTPUT_PATH      = shared.OUTPUT_DIR / "business" / "business_daily.json"
SUMMARY_OUTPUT_PATH    = shared.OUTPUT_DIR / "business" / "business_summary.json"


def load_venues() -> pd.DataFrame:
    pubs = pd.read_csv(shared.DATA_BASE_DIR / "Attributes" / "Pubs.csv")
    pubs = pubs.rename(columns={"pubId": "venueId", "hourlyCost": "cost"})
    pubs["type"] = "pub"

    restaurants = pd.read_csv(shared.DATA_BASE_DIR / "Attributes" / "Restaurants.csv")
    restaurants = restaurants.rename(columns={"maxOccupancy ": "maxOccupancy", "restaurantId": "venueId", "foodCost": "cost"})
    restaurants["type"] = "restaurant"

    venues = pd.concat([pubs, restaurants], ignore_index=True)
    venues[["x", "y"]] = venues["location"].str.extract(r"POINT\s*\(\s*([\-\d.]+)\s+([\-\d.]+)\s*\)").astype(float)
    return venues.drop(columns=["location"])


def load_travel_journal() -> pd.DataFrame:
    return pd.read_csv(shared.DATA_BASE_DIR / "Journals" / "TravelJournal.csv")


def build_daily_revenue(visits: pd.DataFrame) -> pd.DataFrame:
    return visits.groupby(["date", "venueId"])["amount_spent"].sum().reset_index()


def build_daily_occupancy(visits: pd.DataFrame) -> pd.DataFrame:
    # Simulate concurrent occupancy by treating check-ins as +1 and check-outs as -1 events,
    # then taking the peak cumulative sum. Both events use the check-in date so overnight
    # stays don't split across two days.
    arrivals = visits[["venueId", "date", "checkInTime"]].copy().rename(columns={"checkInTime": "timestamp"})
    arrivals["occupancy_change"] = 1

    departures = visits[["venueId", "date", "checkOutTime"]].copy().rename(columns={"checkOutTime": "timestamp"})
    departures["occupancy_change"] = -1

    events = pd.concat([arrivals, departures]).sort_values(["venueId", "date", "timestamp"])
    events["current_occupancy"] = events.groupby(["venueId", "date"])["occupancy_change"].cumsum()

    return events.groupby(["venueId", "date"])["current_occupancy"].max().reset_index(name="max_occupants")


def build_daily_stats(venues: pd.DataFrame, travel_journal: pd.DataFrame) -> pd.DataFrame:
    visits = pd.merge(venues, travel_journal, left_on="venueId", right_on="travelEndLocationId")
    visits["amount_spent"] = visits["startingBalance"] - visits["endingBalance"]
    visits["date"] = pd.to_datetime(visits["checkInTime"]).dt.normalize()

    daily_revenue   = build_daily_revenue(visits)
    daily_occupancy = build_daily_occupancy(visits)

    stats = pd.merge(daily_revenue, daily_occupancy, on=["venueId", "date"])
    stats = pd.merge(stats, venues[["venueId", "maxOccupancy"]], on="venueId")
    stats["occupancy_rate"] = stats["max_occupants"] / stats["maxOccupancy"]
    return stats.drop(columns=["maxOccupancy"]).rename(columns={"amount_spent": "daily_amount_spent"})


def compute_trend(group: pd.DataFrame) -> np.float64:
    x = np.arange(len(group))
    slope, _ = np.polyfit(x, group["daily_amount_spent"], 1)
    return slope


def build_summary(daily_stats: pd.DataFrame) -> pd.DataFrame:
    monthly_revenue = (
        daily_stats
        .assign(year_month=daily_stats["date"].dt.to_period("M"))
        .groupby(["venueId", "year_month"])["daily_amount_spent"]
        .sum()
        .reset_index()
    )

    trends  = monthly_revenue.groupby("venueId").apply(compute_trend).reset_index(name="trend_slope")
    summary = daily_stats.groupby("venueId").agg(
        total_revenue = ("daily_amount_spent", "sum"),
        avg_occupancy = ("occupancy_rate",     "mean"),
    ).reset_index()

    return pd.merge(summary, trends, on="venueId")


def export_json(data: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data.to_json(path, orient="records", date_format="iso")


def main() -> None:
    venues         = load_venues()
    travel_journal = load_travel_journal()

    export_json(venues[["venueId", "x", "y", "type", "maxOccupancy", "cost"]], BUSINESSES_OUTPUT_PATH)

    daily_stats = build_daily_stats(venues, travel_journal)
    export_json(daily_stats, DAILY_OUTPUT_PATH)

    summary = build_summary(daily_stats)
    export_json(summary, SUMMARY_OUTPUT_PATH)


if __name__ == "__main__":
    main()
