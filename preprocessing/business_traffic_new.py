import pandas as pd

import shared

OUTPUT_PATH = shared.OUTPUT_DIR / "business" / "business_prosperity.json"

def load_pubs() -> pd.DataFrame:                return pd.read_csv(shared.DATA_BASE_DIR / "Attributes" / "Pubs.csv")
def load_resturants() -> pd.DataFrame:          return pd.read_csv(shared.DATA_BASE_DIR / "Attributes" / "Restaurants.csv")
def load_check_in_journal() -> pd.DataFrame:    return pd.read_csv(shared.DATA_BASE_DIR / "Journals" / "CheckinJournal.csv")
def load_travel_journal() -> pd.DataFrame:      return pd.read_csv(shared.DATA_BASE_DIR / "Journals" / "TravelJournal.csv")

def load_venues() -> pd.DataFrame:
    pubs = load_pubs().rename(columns={"pubId": "venueId", "hourlyCost": "cost"})
    pubs["type"] = "pub"

    restaurants = load_resturants().rename(columns={"maxOccupancy ": "maxOccupancy", "restaurantId": "venueId", "foodCost": "cost"})
    restaurants["type"] = "restaurant"

    venues = pd.concat([pubs, restaurants], ignore_index=True)
    venues[['x', 'y']] = venues['location'].str.extract(r"POINT\s*\(\s*([\-\d.]+)\s+([\-\d.]+)\s*\)").astype(float)
    return venues.drop("location", axis=1)

def main() -> None:
    venues = load_venues()
    travel_journal = load_travel_journal()

    # Matching when a participant arrives at a bar and checks the ammount spent
    merged_df = pd.merge(left=venues, right=travel_journal, left_on="venueId", right_on="travelEndLocationId", how="inner")
    merged_df["amount_spent"] = merged_df["startingBalance"] - merged_df["endingBalance"]

    # NOTE: IF A PARTICIPANTS COMES TO A BAR AT 2022-03-01T23:30 AND LEAVES 2022-03-02T01:30 THE SPEDNING WILL BE COUNTED ON 2022-03-01
    merged_df['date'] = merged_df['checkInTime'].str[:10]
    daily_revenue = merged_df.groupby(["date", "venueId"])["amount_spent"].sum()
    print(daily_revenue)

    # check_in_journal = load_check_in_journal()

if __name__ == "__main__":
    main()