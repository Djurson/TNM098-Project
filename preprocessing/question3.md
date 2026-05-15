# VAST 2022 Mini-Challenge 3: Question 3 Methodology

**Objective:** Describe the health of the various employers within the city limits. What employment patterns do you observe? Do you notice any areas of particularly high or low turnover?

## Phase 1: Define Employer Health & Turnover

1. **Employer Health:** Consistent workforce size, ability to fill required education levels, and total wages paid out.
2. **Turnover:** The rate at which participants leave a job and are replaced. High turnover implies instability; low turnover implies stability.

## Phase 2: Python Preprocessing & Relational Linking

Because Journals do not explicitly log job changes, we must extract this from the activity logs or infer it.

1. **Extract Job Transitions:** Write a highly optimized Python script to do a single pass over the `ParticipantStatusLogs<n>.csv`. Track each `participantId` and record a timestamp only when their `jobId` changes.
2. **Map Jobs to Employers:** Merge the extracted job transitions with `Jobs.csv`. This links the `jobId` to the specific `employerId`, `hourlyRate`, and `educationRequirement`.
3. **Calculate Turnover Rates:** Group by `employerId` and month. Count:
   - **Active Employees:** Unique participants holding jobs tied to this employer.
   - **Hires:** Participants adopting a `jobId` tied to this employer.
   - **Quits:** Participants dropping a `jobId` tied to this employer.
4. **Link to Locations:** Merge with `Employers.csv` to get the `buildingId` and `location`.

## Phase 3: JSON Export for Next.js

Export an `employer_health.json` file:

- Array of employer objects (`employerId`, `location`).
- Properties for `totalTurnoverRate` and `averageWagePaid`.
- Nested `monthlyStats` array tracking the number of active employees, hires, and quits per month.

## Phase 4: Visualization Strategy (Next.js + D3)

- **Turnover Bar Chart:** A sorted bar chart ranking employers by their overall turnover rate.
- **Employment Timeline:** A stacked D3 bar chart showing the aggregate flow of the workforce (number of people employed vs. unemployed or switching jobs) across the 15 months.
- **Spatial/Geographic View:** Map the employers using their `location`. Color-code them by turnover rate (e.g., hot spots for high turnover) to see if location or building type correlates with job stability.
- **Rationale Building:** Look for anomalies. Does a specific employer have a massive quit event in a single month? Are jobs with `"Low"` education requirements experiencing higher turnover than `"Graduate"` jobs?
