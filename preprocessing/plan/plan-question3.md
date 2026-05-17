# Plan: Question 3 - Employer Health and Turnover

Goal: Describe employer stability and turnover patterns across the city.

Data inputs (columns observed):

- Activity Logs/ParticipantStatusLogs\*.csv: timestamp, participantId, jobId
- Attributes/Jobs.csv: jobId, employerId, hourlyRate, startTime, endTime, daysToWork, educationRequirement
- Attributes/Employers.csv: employerId, location, buildingId

Step-by-step plan:

1. Extract job changes from activity logs
   - Parse logs in chunks; keep participantId, timestamp, jobId.
   - Track previous jobId per participant to detect changes.
   - Ignore the first observation per participant to avoid false hires.
2. Map jobs to employers
   - Join jobId to employerId via Jobs.csv.
   - Record hires (new jobId) and quits (previous jobId) per employer per day.
3. Compute daily headcount
   - For each day, count unique participants assigned to an employer.
   - Handle jobId == -1 as unemployed.
4. Derive turnover metrics
   - turnover = hires + quits.
   - turnoverRate = turnover / averageHeadcount.
   - netChange = hires - quits.
5. Add wage and skill context
   - Compute average hourlyRate per employer and educationRequirement mix.
6. Export JSON for Next.js
   - frontend/public/employer_health.json
   - Structure: { employerId, location, buildingId, history: [{date, hires, quits, headcount, netChange, turnoverRate}] }

Visualization ideas:

- Ranked bar chart of turnoverRate by employer.
- Timeline of hires vs quits across the city.
- Map view color-coded by turnoverRate.
