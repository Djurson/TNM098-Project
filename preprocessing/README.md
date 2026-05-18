# VAST 2022 Mini-Challenge 3: Question 1 Methodology

**Objective:** Over the period covered by the dataset, which businesses appear to be more prosperous? Which appear to be struggling? Describe your rationale for your answers.

## Phase 1: Define Metrics for Businesses

- **Focus Entities:** Pubs (`Pubs.csv`) and Restaurants (`Restaurants.csv`).
- **Success Metrics:**
  - **Foot Traffic:** Absolute check-in volume.
  - **True Revenue:** Actual money spent by patrons.

## Phase 2: Python Preprocessing & Relational Linking

Using the Journals makes this process computationally efficient compared to parsing the 18GB activity logs.

- [x] **Link Check-ins to Venues:** Use `CheckinJournal.csv` to match `venueId` and `venueType` ("Pub", "Restaurant") to aggregate daily/weekly foot traffic.
- [x] **Calculate True Revenue:** Process the `FinancialJournal.csv`. Filter for expenses categorized as `"Food"` and `"Recreation"`. Match the `timestamp` and `participantId` of these transactions with the `CheckinJournal.csv` to attribute exact spending to specific venues.
- [ ] **Establish Demographic Profiles:** Link the `participantId` from the check-ins to `Participants.csv` to understand the customer base (e.g., `educationLevel`, `haveKids`, `joviality`).
- [ ] **Spatial Context:** Merge the geographic `location` from `Pubs.csv` and `Restaurants.csv` to map business hotspots.

## Phase 3: JSON Export for Next.js

Export a `business_health.json` file structured for D3.js:

- [ ] Array of business objects (`venueId`, `venueType`, `location`).
- [ ] Nested `history` array containing time-series data (e.g., monthly foot traffic, monthly revenue).
- [ ] Nested `demographics` object summarizing the primary customer types.

## Phase 4: Visualization Strategy (Next.js + D3)

- [ ] **Trend Analysis:** A D3 multi-line chart showing revenue over time. Highlight the steepest positive slopes (prosperous) in green and negative slopes (struggling) in red.
- [ ] **Geospatial View:** Render the city map and place scaled circles on business locations based on total revenue.
- [ ] **Rationale Building:** Use the demographic tooltips to explain _why_ a business is succeeding or failing based on who is spending money there.

# VAST 2022 Mini-Challenge 3: Question 2 Methodology

**Objective:** How does the financial health of the residents change over the period? How do wages compare to the overall cost of living? Are there groups that appear to exhibit similar patterns?

## Phase 1: Define Financial Health & Cost of Living

1. **Financial Health:** A resident's ability to maintain or grow their net wealth (Income minus Expenses).
2. **Wages vs. Cost of Living:** Comparing income against fixed costs (Rent/Shelter, Education) and variable costs (Food, Recreation).
3. **Groups:** Cohorts of residents based on shared attributes (e.g., families vs. singles, education levels).

## Phase 2: Python Preprocessing & Relational Linking

- [ ] **Extract Income & Expenses:** Group data in `FinancialJournal.csv` by `participantId` and month. Sum the positive cash flow (`category: "Wage"`) and negative cash flows (`category: "Shelter"`, `"Food"`, `"Education"`, `"Recreation"`, `"RentAdjustment"`).
- [ ] **Calculate Net Growth:** Subtract monthly expenses from monthly wages to find the monthly savings rate or deficit.
- [ ] **Group by Demographics:** Merge this financial summary with `Participants.csv`. Group the aggregated financial data by:
  - `educationLevel` ("Low", "HighSchoolOrCollege", "Bachelors", "Graduate")
  - `haveKids` (boolean) and `householdSize`
  - `age` brackets
- [ ] **Base Cost Baseline:** Use `Apartments.csv` (`rentalCost`) and `Schools.csv` (`monthlyFees`) to establish the baseline minimum cost of living in Engagement to contrast against minimum wage earners.

## Phase 3: JSON Export for Next.js

Export a `resident_health.json` file:

- [ ] Array of demographic group objects (e.g., "Graduate_NoKids", "Low_WithKids").
- [ ] Nested `timeline` array containing the average `wage`, `costOfLiving` (sum of expenses), and `netSavings` per month for that specific group.

## Phase 4: Visualization Strategy (Next.js + D3)

- [ ] **Wages vs. Cost Line Chart:** A D3 chart showing two main lines over time: Average City Wage vs. Average City Living Cost.
- [ ] **Group Comparison:** A stacked area chart or parallel coordinates plot allowing you to filter by `educationLevel` or `haveKids`. This will visually expose which specific groups are falling into debt while others build wealth.
- [ ] **Rationale Building:** Identify the divergence points. If the cost of living spikes but wages stagnate, which demographic group hits zero balance first?

# VAST 2022 Mini-Challenge 3: Question 3 Methodology

**Objective:** Describe the health of the various employers within the city limits. What employment patterns do you observe? Do you notice any areas of particularly high or low turnover?

## Phase 1: Define Employer Health & Turnover

1. **Employer Health:** Consistent workforce size, ability to fill required education levels, and total wages paid out.
2. **Turnover:** The rate at which participants leave a job and are replaced. High turnover implies instability; low turnover implies stability.

## Phase 2: Python Preprocessing & Relational Linking

Because Journals do not explicitly log job changes, we must extract this from the activity logs or infer it.

- [ ] **Extract Job Transitions:** Write a highly optimized Python script to do a single pass over the `ParticipantStatusLogs<n>.csv`. Track each `participantId` and record a timestamp only when their `jobId` changes.
- [ ] **Map Jobs to Employers:** Merge the extracted job transitions with `Jobs.csv`. This links the `jobId` to the specific `employerId`, `hourlyRate`, and `educationRequirement`.
- [ ] **Calculate Turnover Rates:** Group by `employerId` and month. Count:
  - **Active Employees:** Unique participants holding jobs tied to this employer.
  - **Hires:** Participants adopting a `jobId` tied to this employer.
  - **Quits:** Participants dropping a `jobId` tied to this employer.
- [ ] **Link to Locations:** Merge with `Employers.csv` to get the `buildingId` and `location`.

## Phase 3: JSON Export for Next.js

Export an `employer_health.json` file:

- [ ] Array of employer objects (`employerId`, `location`).
- [ ] Properties for `totalTurnoverRate` and `averageWagePaid`.
- [ ] Nested `monthlyStats` array tracking the number of active employees, hires, and quits per month.

## Phase 4: Visualization Strategy (Next.js + D3)

- [ ] **Turnover Bar Chart:** A sorted bar chart ranking employers by their overall turnover rate.
- [ ] **Employment Timeline:** A stacked D3 bar chart showing the aggregate flow of the workforce (number of people employed vs. unemployed or switching jobs) across the 15 months.
- [ ] **Spatial/Geographic View:** Map the employers using their `location`. Color-code them by turnover rate (e.g., hot spots for high turnover) to see if location or building type correlates with job stability.
- [ ] **Rationale Building:** Look for anomalies. Does a specific employer have a massive quit event in a single month? Are jobs with `"Low"` education requirements experiencing higher turnover than `"Graduate"` jobs?
