import pandas as pd
import glob

# Load the Jobs mapping
BASE_DATA_URL = "../data/Datasets/"

jobs = pd.read_csv(BASE_DATA_URL + 'Attributes/Jobs.csv')
job_info = jobs[['jobId', 'employerId', 'hourlyRate']]

# Find all log files (assuming they are named ParticipantStatusLogs1.csv, etc.)
log_files = glob.glob(BASE_DATA_URL + 'Activity Logs/ParticipantStatusLogs*.csv')

all_data = []

for file in log_files:
    logs = pd.read_csv(file)
    logs['timestamp'] = pd.to_datetime(logs['timestamp'])
    
    # Merge with job info to get employerId and Pay
    merged = logs.merge(job_info, on='jobId', how='left')
    
    # Count total employees per employer at this timestamp
    workforce = merged.groupby(['timestamp', 'employerId'])['participantId'].nunique().reset_index()
    workforce.columns = ['timestamp', 'employerId', 'employee_count']
    
    # Calculate hourly labor cost (only for those actually working)
    at_work = merged[merged['currentMode'] == 'AtWork'].copy()
    at_work['wage_expense'] = at_work['hourlyRate'] / 12  # 5-min intervals
    expenses = at_work.groupby(['timestamp', 'employerId'])['wage_expense'].sum().reset_index()
    
    # Combine stats
    stats = workforce.merge(expenses, on=['timestamp', 'employerId'], how='left').fillna(0)
    all_data.append(stats)

# Combine and Save
final_df = pd.concat(all_data).sort_values(['employerId', 'timestamp'])
final_df.to_csv('company_prosperity_data.csv', index=False)



# each person has data from: 1/3 - 22 to: 24/5 - 23 (129279 rows)