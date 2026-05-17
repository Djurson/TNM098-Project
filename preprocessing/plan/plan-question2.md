# Plan: Question 2 - Resident Financial Health

Goal: Track how resident financial health changes over time and compare wages vs cost of living.

Data inputs (columns observed):

- Journals/FinancialJournal.csv: participantId, timestamp, category, amount
- Attributes/Participants.csv: participantId, householdSize, haveKids, age, educationLevel, interestGroup, joviality
- Attributes/Apartments.csv: apartmentId, rentalCost, maxOccupancy, numberOfRooms, location, buildingId
- Attributes/Schools.csv: schoolId, monthlyCost, maxEnrollment, location, buildingId

Step-by-step plan:

1. Define income and expense categories
   - Income: category == Wage.
   - Expenses: Shelter, Food, Education, Recreation, RentAdjustment (confirm from data).
   - Convert sign so expenses are positive outflows.
2. Aggregate monthly finances per participant
   - Sum wages and expenses by participantId and month.
   - Compute netSavings = wages - expenses.
3. Estimate baseline cost of living
   - Use apartment rentalCost and school monthlyCost as baseline markers.
   - Compare participant expenses to baseline ranges.
4. Build demographic cohorts
   - Join Participants to monthly financials.
   - Group by educationLevel, haveKids, householdSize, age bands.
5. Compare trends and similarity
   - Compute time series per cohort for wages, expenses, netSavings.
   - Use clustering or correlation to find cohorts with similar trajectories.
6. Export JSON for Next.js
   - frontend/public/resident_health.json
   - Structure: { cohortId, cohortLabel, timeline: [{month, wages, expenses, netSavings}] }

Visualization ideas:

- Dual-line chart of wages vs expenses over time.
- Small multiples for cohorts to highlight diverging trajectories.
