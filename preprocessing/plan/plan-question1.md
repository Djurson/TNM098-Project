# Plan: Question 1 - Business Prosperity

Goal: Identify which pubs and restaurants are prospering or struggling over time.

Data inputs (columns observed):

- Journals/CheckinJournal.csv: participantId, timestamp, venueId, venueType
- Journals/FinancialJournal.csv: participantId, timestamp, category, amount
- Attributes/Pubs.csv: pubId, hourlyCost, maxOccupancy, location, buildingId
- Attributes/Restaurants.csv: restaurantId, foodCost, maxOccupancy, location, buildingId

Step-by-step plan:

1. Normalize business metadata
   - Load Pubs and Restaurants, rename id columns to venueId, add venueType.
   - Trim trailing spaces in column names (maxOccupancy ) and coerce types.
2. Compute foot traffic per venue
   - From CheckinJournal, bucket timestamps by day.
   - Count unique participantId per venueId per day.
3. Attribute spending to venues
   - Filter FinancialJournal to expense categories that occur at venues (Food, Recreation).
   - Confirm sign of amount; convert to positive spend.
   - Join to checkins by participantId and nearest timestamp (exact or within a time window).
4. Build daily revenue per venue
   - Sum attributed spending per venueId per day.
   - Flag days with missing spending attribution for QA.
5. Normalize and score prosperity
   - Normalize traffic by maxOccupancy.
   - Compute trend slope, percent change, and rolling averages for revenue and traffic.
   - Combine into a prosperity score; flag consistent declines as struggling.
6. Export JSON for Next.js
   - frontend/public/business_health.json
   - Structure: { venueId, venueType, location, buildingId, history: [{date, checkins, revenue, utilization}] }

Visualization ideas:

- Multi-line chart of revenue over time with green (growth) vs red (decline) highlight.
- Map of venue locations sized by total revenue.
