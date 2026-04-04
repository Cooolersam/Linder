#!/usr/bin/env python3
"""Export data for the web frontend. Converts CSVs to compact JSON."""

import csv
import json
import os

BASE_DIR = os.path.dirname(__file__)
WEB_DATA = os.path.join(BASE_DIR, "web", "data")
os.makedirs(WEB_DATA, exist_ok=True)

# 1. Copy summary.json
with open(os.path.join(BASE_DIR, "summary.json")) as f:
    summary = json.load(f)

# Filter out Bengali (only 316 pairs, inflated scores)
summary = [s for s in summary if s["n"] >= 1000]
summary.sort(key=lambda x: x["avg"], reverse=True)

with open(os.path.join(WEB_DATA, "summary.json"), "w") as f:
    json.dump(summary, f)

print(f"Exported summary: {len(summary)} languages")

# 2. Export top cognates + bottom pairs for each language (compact)
for entry in summary:
    code = entry["code"]
    csv_path = os.path.join(BASE_DIR, f"results_{code}.csv")
    if not os.path.exists(csv_path):
        continue

    rows = []
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "en": row["english"],
                "foreign": row["foreign"],
                "rom": row.get("romanized", row["foreign"]),
                "score": round(float(row["composite"]), 4),
                "lev": round(float(row["norm_levenshtein"]), 3),
                "jw": round(float(row["jaro_winkler"]), 3),
                "meta": round(float(row["metaphone"]), 1),
                "sound": round(float(row["soundex"]), 1),
                "bi": round(float(row["bigram"]), 3),
                "tri": round(float(row["trigram"]), 3),
            })

    # Sort by score descending (should already be)
    rows.sort(key=lambda x: x["score"], reverse=True)

    # Split into cognates (not identical) and identical
    identical = [r for r in rows if r["en"] == r["rom"]]
    cognates = [r for r in rows if r["en"] != r["rom"]]

    lang_data = {
        "info": entry,
        "identical_count": len(identical),
        "identical_sample": identical[:20],
        "top_cognates": cognates[:100],
        "bottom": cognates[-50:] if cognates else [],
        "all_count": len(rows),
    }

    # Also build histogram data (bins of 0.05)
    bins = [0] * 20
    for r in rows:
        idx = min(int(r["score"] / 0.05), 19)
        bins[idx] += 1
    lang_data["histogram"] = bins

    out_path = os.path.join(WEB_DATA, f"{code}.json")
    with open(out_path, "w") as f:
        json.dump(lang_data, f)

print(f"Exported {len(summary)} language detail files")
