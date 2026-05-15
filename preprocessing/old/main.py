import pandas as pd

# Load your processed data
df = pd.read_csv('company_prosperity_data.csv')
df['timestamp'] = pd.to_datetime(df['timestamp'])

# 1. Create a 'date' column
df['date'] = df['timestamp'].dt.date

# 2. Group by Date and Employer
daily_prosperity = df.groupby(['date', 'employerId']).agg({
    'wage_expense': 'sum',             # Total money spent on wages that day
    'employee_count': 'max'            # The "Peak" workforce seen that day
}).reset_index()

# 3. Save as a much smaller, cleaner file
daily_prosperity.to_csv('daily_company_prosperity.csv', index=False)