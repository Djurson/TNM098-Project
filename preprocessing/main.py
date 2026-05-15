import pandas as pd
from pathlib import Path
from typing import Any, cast

# Base directory for the data (data/Datasets)
DATA_BASE_DIR   = Path(__file__).resolve().parent.parent / "data" / "Datasets"
ATTRIBUTES_DIR  = DATA_BASE_DIR / "Attributes"
JOURNALS_DIR    = DATA_BASE_DIR / "Journals"


def read_csvs(directory: Path) -> dict[str, pd.DataFrame]:
    """Load all CSV files in a directory into a dict keyed by file stem."""
    return {path.stem: pd.read_csv(path) for path in directory.glob("*.csv")}


def load_attributes() -> dict[str, pd.DataFrame]:
    """Load attribute datasets (e.g., Pubs, Restaurants) from Attributes/."""
    return read_csvs(ATTRIBUTES_DIR)


def load_journals() -> dict[str, pd.DataFrame]:
    """Load journal datasets from Journals/."""
    return read_csvs(JOURNALS_DIR)


def load_venues(attributes: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Normalize pubs/restaurants into a single venues DataFrame."""
    pubs = attributes["Pubs"].rename(columns={"pubId": "venueId"}).copy()
    pubs["venueType"] = "Pub"

    restaurants = attributes["Restaurants"].rename(columns={"restaurantId": "venueId"}).copy()
    restaurants["venueType"] = "Restaurant"

    return pd.concat([pubs, restaurants], ignore_index=True, sort=False)


def build_venue_lookup(venues: pd.DataFrame) -> dict[int, dict[str, Any]]:
    """Build a venueId -> venue record lookup for fast joins in Python code."""
    venues = venues.copy()
    venues["venueId"] = venues["venueId"].astype("int64")
    venues.columns = venues.columns.map(str)
    return cast(dict[int, dict[str, Any]], venues.set_index("venueId").to_dict(orient="index"))


def main():
    """Entry point for basic data loading."""
    journals = load_journals()
    check_in_journal = journals["CheckinJournal"]
    attributes = load_attributes()
    venues = load_venues(attributes)
    venue_lookup = build_venue_lookup(venues)
    _ = (check_in_journal, venue_lookup)

if __name__ == "__main__":
    main()
