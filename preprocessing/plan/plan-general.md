# Plan: General Economic Health

Goal: Summarize city-wide economic health over time by combining business performance, job mobility, and resident financial well-being.

Data inputs (columns observed):

- Journals/FinancialJournal.csv: participantId, timestamp, category, amount
- Journals/CheckinJournal.csv: participantId, timestamp, venueId, venueType
- Attributes/Participants.csv: participantId, householdSize, haveKids, age, educationLevel, interestGroup, joviality
- Attributes/Jobs.csv: jobId, employerId, hourlyRate, startTime, endTime, daysToWork, educationRequirement
- Attributes/Employers.csv: employerId, location, buildingId
- Activity Logs/ParticipantStatusLogs\*.csv: timestamp, participantId, jobId (plus other status fields)

Step-by-step plan:

1. Define the shared timeline
   - Parse all timestamps as UTC.
   - Choose daily and monthly buckets; keep both for different questions.
   - Create a shared date dimension to align all outputs.
2. Build business growth indicators
   - Use the Q1 pipeline to compute daily revenue and foot traffic per venue.
   - Aggregate to city totals per day and compute rolling week/month averages.
   - Track growth with percent change and slope over time.
3. Build labor mobility indicators
   - Use the Q3 pipeline to compute daily hires, quits, net change, and headcount.
   - Aggregate to city totals and compute job-switch rate per day.
4. Build resident financial health indicators
   - Use the Q2 pipeline to compute monthly net savings and wage vs cost-of-living.
   - Track median and quartiles to measure inequality.
5. Synthesize the city story
   - Compare trends: business revenue vs job switching vs net savings.
   - Identify phases: growth, stagnation, contraction.
6. Export a summary dataset for Next.js
   - Create frontend/public/general_economy.json with city-level time series:
     - dates, totalRevenue, totalCheckins, totalHires, totalQuits, totalNetSavings.

Visualization ideas:

- Small-multiple line charts for the three macro indicators.
- A single narrative timeline with annotated breakpoints.
