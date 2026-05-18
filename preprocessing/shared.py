import pandas as pd
from pathlib import Path
from typing import Any, cast

# Base directory for the data (data/Datasets)
DATA_BASE_DIR   = Path(__file__).resolve().parent.parent / "data" / "Datasets"
ATTRIBUTES_DIR  = DATA_BASE_DIR / "Attributes"
JOURNALS_DIR    = DATA_BASE_DIR / "Journals"
OUTPUT_DIR      = Path(__file__).resolve().parent.parent / "frontend" / "public"

def print_section(title: str, width: int = 56) -> None:
    """Print a centered section header with a consistent width."""
    print("=" * width)
    print(title.center(width))
    print("=" * width)