import pandas as pd
from pathlib import Path
from typing import Any, cast

# Base directory for the data (data/Datasets)
DATA_BASE_DIR   = Path(__file__).resolve().parent.parent / "data" / "Datasets"
ATTRIBUTES_DIR  = DATA_BASE_DIR / "Attributes"
JOURNALS_DIR    = DATA_BASE_DIR / "Journals"
OUTPUT_DIR      = Path(__file__).resolve().parent.parent / "frontend" / "public"

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


def build_venue_lookups(venues: pd.DataFrame) -> tuple[dict[int, dict[str, Any]], dict[int, dict[str, Any]]]:
    """Build separate venueId lookups for pubs and restaurants."""
    venues = venues.copy()
    venues["venueId"] = venues["venueId"].astype("int64")
    venues.columns = venues.columns.map(lambda name: str(name).strip())

    pubs = venues[venues["venueType"] == "Pub"].dropna(axis=1, how="all")
    restaurants = venues[venues["venueType"] == "Restaurant"].dropna(axis=1, how="all")

    pub_lookup = cast(dict[int, dict[str, Any]], pubs.set_index("venueId").to_dict(orient="index"))
    restaurant_lookup = cast(
        dict[int, dict[str, Any]],
        restaurants.set_index("venueId").to_dict(orient="index"),
    )
    return pub_lookup, restaurant_lookup


def load_question1_data() -> tuple[dict[int, dict[str, Any]], dict[int, dict[str, Any]], pd.DataFrame]:
    """Load shared inputs for question 1 without prop drilling."""
    journals = load_journals()
    check_in_journal = journals["CheckinJournal"]
    attributes = load_attributes()
    venues = load_venues(attributes)
    pub_lookup, restaurant_lookup = build_venue_lookups(venues)
    return pub_lookup, restaurant_lookup, check_in_journal
