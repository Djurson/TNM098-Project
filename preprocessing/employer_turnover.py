from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import json
from typing import Dict, Tuple
import re
import pandas as pd

import shared

ACTIVITY_DIR = shared.DATA_BASE_DIR / "Activity Logs"
OUTPUT_PATH = shared.OUTPUT_DIR / "employer_turnover_daily.json"


def load_job_employer_map() -> dict[int, int]:
    jobs = pd.read_csv(shared.ATTRIBUTES_DIR / "Jobs.csv", usecols=["jobId", "employerId"])
    jobs = jobs.dropna(subset=["jobId", "employerId"])
    return dict(zip(jobs["jobId"].astype("int64"), jobs["employerId"].astype("int64")))


def load_employer_lookup() -> dict[int, dict[str, object]]:
    employers = pd.read_csv(shared.ATTRIBUTES_DIR / "Employers.csv")
    employers = employers.dropna(subset=["employerId"])
    return employers.set_index("employerId").to_dict(orient="index")


def iter_log_files(activity_dir: Path) -> list[Path]:
    files = activity_dir.glob("ParticipantStatusLogs*.csv")
    return sorted(files, key=lambda p: int(m.group()) if (m := re.search(r"\d+", p.name)) else 0)


def load_daily_jobs(log_files: list[Path]) -> dict[int, dict[str, int]]:
    """
    Reads each log file exactly once (one at a time, ~230 MB per file).
    Files are split by time period (all participants appear in each file).
    For every participant in the file, records the last job they held each day.

    After all files are processed the returned dict looks like:
        { participantId: { "2022-03-01": jobId, "2022-03-02": jobId, ... }, ... }
    """
    participant_daily: dict[int, dict[str, int]] = defaultdict(dict)

    for i, path in enumerate(log_files, 1):
        print(f"  [{i}/{len(log_files)}] {path.name}", flush=True)

        df = pd.read_csv(
            path,
            usecols=["timestamp", "participantId", "jobId"],
            dtype={"timestamp": "string", "participantId": "Int64", "jobId": "float32"},  # type: ignore[call-overload]
        )
        df = df.dropna(subset=["timestamp", "participantId"])
        df["participantId"] = df["participantId"].astype("int32")
        df["jobId"] = pd.to_numeric(df["jobId"], errors="coerce").fillna(-1).astype("int32")
        df = df[df["jobId"] != -1]
        df["date"] = df["timestamp"].str.slice(0, 10)

        # Within this file keep the last job per (participant, day)
        daily = (
            df.sort_values("timestamp")
            .groupby(["participantId", "date"])["jobId"]
            .last()
        )

        # Files are processed in chronological order so a later file's entry
        # for the same (participant, date) is always the more recent one.
        daily_df = daily.reset_index()
        for pid, date, job in zip(
            daily_df["participantId"].tolist(),
            daily_df["date"].tolist(),
            daily_df["jobId"].tolist(),
        ):
            participant_daily[int(pid)][str(date)] = int(job)

    return dict(participant_daily)


# --- Step 1+2: job-change events per employer per day ---

def extract_daily_turnover(
    participant_daily: dict[int, dict[str, int]],
    job_to_employer: dict[int, int],
) -> tuple[Dict[Tuple[str, int], int], Dict[Tuple[str, int], int]]:
    """
    Process participants one at a time, checking day by day whether the job changed.
    A change on day D → one quit for the old employer, one hire for the new employer.
    The first observation per participant is not counted as a hire.
    """
    hires_counts: Dict[Tuple[str, int], int] = {}
    quits_counts: Dict[Tuple[str, int], int] = {}

    for participant_id in sorted(participant_daily.keys()):
        days = sorted(participant_daily[participant_id].items())  # [(date, jobId), ...]

        for i in range(1, len(days)):
            date, current_job = days[i]
            _, prev_job = days[i - 1]

            if current_job == prev_job:
                continue

            old_employer = job_to_employer.get(prev_job)
            new_employer = job_to_employer.get(current_job)

            if old_employer is not None:
                key = (date, old_employer)
                quits_counts[key] = quits_counts.get(key, 0) + 1

            if new_employer is not None:
                key = (date, new_employer)
                hires_counts[key] = hires_counts.get(key, 0) + 1

    return hires_counts, quits_counts


# --- Step 3: daily headcount per employer ---

def compute_daily_headcount(
    participant_daily: dict[int, dict[str, int]],
    job_to_employer: dict[int, int],
) -> Dict[Tuple[str, int], int]:
    """
    For each (date, employer), count unique participants whose last recorded
    job that day maps to that employer.
    """
    headcount: Dict[Tuple[str, int], int] = {}

    for daily_jobs in participant_daily.values():
        for date, job_id in daily_jobs.items():
            employer = job_to_employer.get(job_id)
            if employer is not None:
                key = (date, employer)
                headcount[key] = headcount.get(key, 0) + 1

    return headcount


# --- Step 4: build output records with turnover metrics ---

def build_employer_records(
    hires_counts: Dict[Tuple[str, int], int],
    quits_counts: Dict[Tuple[str, int], int],
    headcount_counts: Dict[Tuple[str, int], int],
    employer_lookup: dict[int, dict[str, object]],
) -> list[dict[str, object]]:
    # Include every day where an employer had turnover activity
    keys = sorted(set(hires_counts) | set(quits_counts))
    if not keys:
        return []

    records = []
    for date, employer_id in keys:
        hires = hires_counts.get((date, employer_id), 0)
        quits = quits_counts.get((date, employer_id), 0)
        headcount = headcount_counts.get((date, employer_id), 0)
        turnover = hires + quits
        records.append({
            "date": date,
            "employerId": employer_id,
            "hires": hires,
            "quits": quits,
            "headcount": headcount,
            "netChange": hires - quits,
            "turnover": turnover,
            "turnoverRate": round(turnover / headcount, 4) if headcount > 0 else 0.0,
        })

    stats_df = pd.DataFrame(records)

    employer_records: list[dict[str, object]] = []
    for employer_id, group in stats_df.groupby("employerId"):
        eid = int(float(str(employer_id)))
        meta = employer_lookup.get(eid, {})

        location_raw = meta.get("location")
        location = None if (location_raw is None or location_raw != location_raw) else location_raw

        building_raw = meta.get("buildingId")
        building_id: int | None = None if (building_raw is None or building_raw != building_raw) else int(float(str(building_raw)))

        history = (
            group.sort_values("date")
            .drop(columns=["employerId"])
            .to_dict(orient="records")
        )
        employer_records.append({
            "employerId": eid,
            "location": location,
            "buildingId": building_id,
            "history": history,
        })

    return employer_records


def main() -> None:
    job_to_employer = load_job_employer_map()
    employer_lookup = load_employer_lookup()
    log_files = iter_log_files(ACTIVITY_DIR)

    print(f"Loading daily jobs from {len(log_files)} log files (one at a time)...")
    participant_daily = load_daily_jobs(log_files)
    print(f"  {len(participant_daily)} participants loaded")

    print("Step 1+2: Extracting turnover events participant by participant...")
    hires_counts, quits_counts = extract_daily_turnover(participant_daily, job_to_employer)

    print("Step 3: Computing daily headcount per employer...")
    headcount_counts = compute_daily_headcount(participant_daily, job_to_employer)

    print("Step 4: Deriving turnover metrics and building employer records...")
    employer_records = build_employer_records(
        hires_counts, quits_counts, headcount_counts, employer_lookup
    )

    payload = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "employers": employer_records,
    }

    shared.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=True, indent=2)

    print(f"Saved {len(employer_records)} employer records to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
