# VAST 2022 Mini-Challenge 3: Question 1 Methodology

**Objective:** Over the period covered by the dataset, which businesses appear to be more prosperous? Which appear to be struggling? Describe your rationale for your answers.

## Phase 1: Define Metrics for Businesses

- [x] **Focus Entities:** Pubs (`Pubs.csv`) and Restaurants (`Restaurants.csv`).
- [ ] **Success Metrics:**
  - **Foot Traffic:** Absolute check-in volume.
  - **True Revenue:** Actual money spent by patrons.

## Phase 2: Python Preprocessing & Relational Linking

Using the Journals makes this process computationally efficient compared to parsing the 18GB activity logs.

1. **Link Check-ins to Venues:** Use `CheckinJournal.csv` to match `venueId` and `venueType` ("Pub", "Restaurant") to aggregate daily/weekly foot traffic.
2. **Calculate True Revenue (The Fast Way):** Process the `FinancialJournal.csv`. Filter for expenses categorized as `"Food"` and `"Recreation"`. Match the `timestamp` and `participantId` of these transactions with the `CheckinJournal.csv` to attribute exact spending to specific venues.
3. **Establish Demographic Profiles:** Link the `participantId` from the check-ins to `Participants.csv` to understand the customer base (e.g., `educationLevel`, `haveKids`, `joviality`).
4. **Spatial Context:** Merge the geographic `location` from `Pubs.csv` and `Restaurants.csv` to map business hotspots.

## Phase 3: JSON Export for Next.js

Export a `business_health.json` file structured for D3.js:

- Array of business objects (`venueId`, `venueType`, `location`).
- Nested `history` array containing time-series data (e.g., monthly foot traffic, monthly revenue).
- Nested `demographics` object summarizing the primary customer types.

## Phase 4: Visualization Strategy (Next.js + D3)

- **Trend Analysis:** A D3 multi-line chart showing revenue over time. Highlight the steepest positive slopes (prosperous) in green and negative slopes (struggling) in red.
- **Geospatial View:** Render the city map and place scaled circles on business locations based on total revenue.
- **Rationale Building:** Use the demographic tooltips to explain _why_ a business is succeeding or failing based on who is spending money there.
