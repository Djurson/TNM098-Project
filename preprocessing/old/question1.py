import pandas as pd
from typing import Any
import json

import shared


def _prepare_checkins(checkins: pd.DataFrame) -> pd.DataFrame:
    checkins = checkins.copy()
    checkins["timestamp"] = pd.to_datetime(checkins["timestamp"], utc=True, errors="coerce")
    checkins["participantId"] = pd.to_numeric(checkins["participantId"], errors="coerce")
    checkins["venueId"] = pd.to_numeric(checkins["venueId"], errors="coerce")
    checkins["venueType"] = checkins["venueType"].astype(str)
    checkins = checkins.dropna(subset=["timestamp", "participantId", "venueId", "venueType"])
    return checkins[checkins["venueType"].isin({"Pub", "Restaurant"})]


def aggregate_foot_traffic(checkins: pd.DataFrame, freq: str) -> pd.DataFrame:
    """Aggregate check-in counts by venue and time bucket (e.g., D or W)."""
    checkins = _prepare_checkins(checkins)
    return (
        checkins.groupby(["venueType", "venueId", pd.Grouper(key="timestamp", freq=freq)])
        .size()
        .reset_index(name="checkins")
        .sort_values(["venueType", "venueId", "timestamp"], ignore_index=True)
    )


def buisness_json_dump(pub_lookup: dict[int, dict[str, Any]], restaurant_lookup: dict[int, dict[str, Any]]):
    businesses: dict[int, dict[str, Any]] = {}

    for venue_id, details in pub_lookup.items():
        businesses[int(venue_id)] = {**details}

    for venue_id, details in restaurant_lookup.items():
        businesses[int(venue_id)] = {**details}

    shared.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(shared.OUTPUT_DIR / "businesses.json", "w", encoding="utf-8") as fp:
        json.dump(businesses, fp, ensure_ascii=True)


def print_section(title: str, width: int = 56) -> None:
    """Print a centered section header with a consistent width."""
    print("=" * width)
    print(title.center(width))
    print("=" * width)


def main():
    pub_lookup, restaurant_lookup, check_in_journal = shared.load_question1_data()
    _ = (pub_lookup, restaurant_lookup)

    journals = shared.load_journals()

    # Phase 2 step 1:
    daily_traffic = aggregate_foot_traffic(check_in_journal, "D")
    weekly_traffic = aggregate_foot_traffic(check_in_journal, "W")

    print_section("Phase 2: Step 1")

    print("\n")
    print("Daily traffic".center(56))
    print(daily_traffic)
    print("\n")

    print("Weekly traffic".center(56))
    print(weekly_traffic)

    print("\n")
    buisness_json_dump(pub_lookup, restaurant_lookup)
    print("Businesses dumped to: ", shared.OUTPUT_DIR / "businesses.json")

    # Phase 2 step 2:
    financial_journal = journals["FinancialJournal"]

if __name__ == "__main__":
    main()