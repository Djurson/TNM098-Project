from __future__ import annotations

from pathlib import Path
import json
from typing import Dict, Iterable, Tuple

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


def accumulate_counts(
    counter: Dict[Tuple[str, int], int],
    events: pd.DataFrame,
) -> None:
    grouped = events.groupby(["date", "employerId"]).size()
    for (date, employer_id), count in grouped.items():
        key = (str(date), int(employer_id))
        counter[key] = counter.get(key, 0) + int(count)


def iter_log_files(activity_dir: Path) -> Iterable[Path]:
    return sorted(activity_dir.glob("ParticipantStatusLogs*.csv"))


def extract_daily_turnover(
    log_files: Iterable[Path],
    job_to_employer: dict[int, int],
    chunk_size: int = 500_000,
) -> tuple[Dict[Tuple[str, int], int], Dict[Tuple[str, int], int]]:
    hires_counts: Dict[Tuple[str, int], int] = {}
    quits_counts: Dict[Tuple[str, int], int] = {}
    last_job_by_participant: Dict[int, int] = {}

    usecols = ["timestamp", "participantId", "jobId"]
    dtypes = {"timestamp": "string", "participantId": "Int64", "jobId": "float32"}

    for path in log_files:
        for chunk in pd.read_csv(path, usecols=usecols, dtype=dtypes, chunksize=chunk_size):
            chunk = chunk.dropna(subset=["timestamp", "participantId"])
            chunk["participantId"] = chunk["participantId"].astype("int32")
            if chunk.empty:
                continue

            chunk["jobId"] = pd.to_numeric(chunk["jobId"], errors="coerce").fillna(-1).astype("int32")
            chunk["date"] = chunk["timestamp"].astype(str).str.slice(0, 10)

            prev_job = chunk.groupby("participantId")["jobId"].shift()
            prev_job = prev_job.fillna(chunk["participantId"].map(last_job_by_participant))

            # Avoid counting the first observation for a participant as a change event.
            prev_job = prev_job.fillna(chunk["jobId"]).astype("int32")
            chunk["prev_jobId"] = prev_job

            changed = chunk[chunk["jobId"] != chunk["prev_jobId"]]
            if not changed.empty:
                hires = changed[changed["jobId"] != -1][["date", "jobId"]].copy()
                if not hires.empty:
                    hires["employerId"] = hires["jobId"].map(job_to_employer)
                    hires = hires.dropna(subset=["employerId"])
                    accumulate_counts(hires_counts, hires)

                quits = changed[changed["prev_jobId"] != -1][["date", "prev_jobId"]].copy()
                if not quits.empty:
                    quits["employerId"] = quits["prev_jobId"].map(job_to_employer)
                    quits = quits.dropna(subset=["employerId"])
                    accumulate_counts(quits_counts, quits)

            last_jobs = chunk.groupby("participantId")["jobId"].last()
            last_job_by_participant.update(last_jobs.to_dict())

    return hires_counts, quits_counts


def build_employer_records(
    hires_counts: Dict[Tuple[str, int], int],
    quits_counts: Dict[Tuple[str, int], int],
    employer_lookup: dict[int, dict[str, object]],
) -> list[dict[str, object]]:
    keys = sorted(set(hires_counts) | set(quits_counts))
    if not keys:
        return []

    records = []
    for date, employer_id in keys:
        hires = hires_counts.get((date, employer_id), 0)
        quits = quits_counts.get((date, employer_id), 0)
        records.append(
            {
                "date": date,
                "employerId": employer_id,
                "hires": hires,
                "quits": quits,
                "net": hires - quits,
                "turnover": hires + quits,
            }
        )

    stats_df = pd.DataFrame(records)

    employer_records: list[dict[str, object]] = []
    for employer_id, group in stats_df.groupby("employerId"):
        meta = employer_lookup.get(int(employer_id), {})
        location = meta.get("location")
        if pd.isna(location):
            location = None
        building_id = meta.get("buildingId")
        if pd.isna(building_id):
            building_id = None
        else:
            building_id = int(building_id)
        history = (
            group.sort_values("date")
            .drop(columns=["employerId"])
            .to_dict(orient="records")
        )
        employer_records.append(
            {
                "employerId": int(employer_id),
                "location": location,
                "buildingId": building_id,
                "history": history,
            }
        )

    return employer_records


def main() -> None:
    job_to_employer = load_job_employer_map()
    employer_lookup = load_employer_lookup()
    log_files = iter_log_files(ACTIVITY_DIR)

    hires_counts, quits_counts = extract_daily_turnover(log_files, job_to_employer)
    employer_records = build_employer_records(hires_counts, quits_counts, employer_lookup)

    payload = {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "employers": employer_records,
    }

    shared.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=True, indent=2)

    print(f"Saved daily turnover data to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
