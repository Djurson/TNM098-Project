import csv

import shared

results = []

with open(shared.DATA_BASE_DIR / "Journals" / "TravelJournal.csv", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            diff = abs(float(row["startingBalance"]) - float(row["endingBalance"]))
        except ValueError:
            continue
        if diff > 1000:
            results.append((diff, row["participantId"], row["travelStartTime"]))

results.sort(reverse=True)

print(f"{'Difference':>12}  {'ParticipantId':>13}  {'TravelStartTime'}")
for diff, pid, t in results:
    print(f"{diff:>12.2f}  {pid:>13}  {t}")
