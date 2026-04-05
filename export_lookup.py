#!/usr/bin/env python3
"""Export compact word lookup dictionaries for the compare tool.

For each language, creates a JSON mapping: english_word -> { foreign, romanized }
Only includes the first translation per English word to keep files small.
"""

import csv
import json
import os

BASE_DIR = os.path.dirname(__file__)
WEB_DATA = os.path.join(BASE_DIR, "web", "data")
LOOKUP_DIR = os.path.join(WEB_DATA, "lookup")
os.makedirs(LOOKUP_DIR, exist_ok=True)

# Get all language codes from results CSVs
lang_codes = set()
for f in os.listdir(BASE_DIR):
    if f.startswith("results_") and f.endswith(".csv") and "full" not in f:
        code = f.replace("results_", "").replace(".csv", "")
        if len(code) <= 3:
            lang_codes.add(code)

print(f"Exporting lookup dictionaries for {len(lang_codes)} languages...")

for code in sorted(lang_codes):
    csv_path = os.path.join(BASE_DIR, f"results_{code}.csv")
    if not os.path.exists(csv_path):
        continue

    lookup = {}
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            en = row["english"]
            if en in lookup:
                continue  # keep first (highest-scored) translation
            lookup[en] = {
                "f": row["foreign"],
                "r": row.get("romanized", row["foreign"]),
                "s": round(float(row["composite"]), 4),
            }

    out_path = os.path.join(LOOKUP_DIR, f"{code}.json")
    with open(out_path, "w") as f:
        json.dump(lookup, f, separators=(",", ":"))

    print(f"  {code}: {len(lookup)} words")

print("Done.")
