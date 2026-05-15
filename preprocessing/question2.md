# VAST 2022 Mini-Challenge 3: Question 2 Methodology

**Objective:** How does the financial health of the residents change over the period? How do wages compare to the overall cost of living? Are there groups that appear to exhibit similar patterns?

## Phase 1: Define Financial Health & Cost of Living

1. **Financial Health:** A resident's ability to maintain or grow their net wealth (Income minus Expenses).
2. **Wages vs. Cost of Living:** Comparing income against fixed costs (Rent/Shelter, Education) and variable costs (Food, Recreation).
3. **Groups:** Cohorts of residents based on shared attributes (e.g., families vs. singles, education levels).

## Phase 2: Python Preprocessing & Relational Linking

1. **Extract Income & Expenses:** Group data in `FinancialJournal.csv` by `participantId` and month. Sum the positive cash flow (`category: "Wage"`) and negative cash flows (`category: "Shelter"`, `"Food"`, `"Education"`, `"Recreation"`, `"RentAdjustment"`).
2. **Calculate Net Growth:** Subtract monthly expenses from monthly wages to find the monthly savings rate or deficit.
3. **Group by Demographics:** Merge this financial summary with `Participants.csv`. Group the aggregated financial data by:
   - `educationLevel` ("Low", "HighSchoolOrCollege", "Bachelors", "Graduate")
   - `haveKids` (boolean) and `householdSize`
   - `age` brackets
4. **Base Cost Baseline:** Use `Apartments.csv` (`rentalCost`) and `Schools.csv` (`monthlyFees`) to establish the baseline minimum cost of living in Engagement to contrast against minimum wage earners.

## Phase 3: JSON Export for Next.js

Export a `resident_health.json` file:

- Array of demographic group objects (e.g., "Graduate_NoKids", "Low_WithKids").
- Nested `timeline` array containing the average `wage`, `costOfLiving` (sum of expenses), and `netSavings` per month for that specific group.

## Phase 4: Visualization Strategy (Next.js + D3)

- **Wages vs. Cost Line Chart:** A D3 chart showing two main lines over time: Average City Wage vs. Average City Living Cost.
- **Group Comparison:** A stacked area chart or parallel coordinates plot allowing you to filter by `educationLevel` or `haveKids`. This will visually expose which specific groups are falling into debt while others build wealth.
- **Rationale Building:** Identify the divergence points. If the cost of living spikes but wages stagnate, which demographic group hits zero balance first?
