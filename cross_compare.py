#!/usr/bin/env python3
"""
Cross-language similarity comparison.

Uses English as a pivot: for any two languages, finds English words
that have translations in both, then compares the romanized translations.

Outputs a 43x43 similarity matrix as JSON for the web frontend.

Usage:
    python cross_compare.py [--limit N] [--min-overlap N]
"""

import argparse
import json
import os
import sys
import time
from itertools import combinations

from batch import LANGUAGES, DATA_DIR, get_romanizer, load_dictionary

BASE_DIR = os.path.dirname(__file__)


def build_pivot_index(limit=None):
    """
    Build an index: english_word -> { lang_code: romanized_translation }

    For each language, loads its dictionary, romanizes the foreign word,
    and stores it keyed by the English word.

    When a word has multiple translations, keeps the first one.
    """
    index = {}  # en_word -> { code: romanized }
    lang_codes = []

    for code in sorted(LANGUAGES.keys()):
        dict_file = os.path.join(DATA_DIR, f"en-{code}.txt")
        if not os.path.exists(dict_file):
            continue

        romanizer = get_romanizer(LANGUAGES[code])
        pairs = load_dictionary(dict_file, limit=limit)

        count = 0
        for en, foreign in pairs:
            rom = romanizer(foreign)
            if not rom or len(rom) < 1:
                continue
            if en not in index:
                index[en] = {}
            # Keep first translation per language per English word
            if code not in index[en]:
                index[en][code] = rom
                count += 1

        lang_codes.append(code)
        print(f"  {LANGUAGES[code]['name']:15} ({code}): {count} words indexed")

    return index, lang_codes


def compare_pair(index, code_a, code_b, max_pairs=5000):
    """
    Compare two languages via the English pivot.
    Returns (avg_score, n_compared) or (None, 0) if insufficient overlap.
    """
    from main import composite_score

    scores = []
    for en_word, translations in index.items():
        if code_a in translations and code_b in translations:
            rom_a = translations[code_a]
            rom_b = translations[code_b]
            if rom_a and rom_b:
                scores.append(composite_score(rom_a, rom_b))
                if len(scores) >= max_pairs:
                    break

    if len(scores) < 20:
        return None, len(scores)

    return sum(scores) / len(scores), len(scores)


def main():
    parser = argparse.ArgumentParser(description="Cross-language similarity matrix")
    parser.add_argument("--limit", type=int, default=15000,
                        help="Max dictionary entries per language (default: 15000)")
    parser.add_argument("--max-pairs", type=int, default=5000,
                        help="Max word pairs to compare per language pair (default: 5000)")
    parser.add_argument("--min-overlap", type=int, default=50,
                        help="Min overlapping words to include a pair (default: 50)")
    args = parser.parse_args()

    print("Building English pivot index...")
    start = time.time()
    index, lang_codes = build_pivot_index(limit=args.limit)
    elapsed = time.time() - start
    print(f"\nIndexed {len(index)} English words across {len(lang_codes)} languages in {elapsed:.1f}s\n")

    # Compute pairwise similarities
    n_pairs = len(lang_codes) * (len(lang_codes) - 1) // 2
    print(f"Computing {n_pairs} language pair comparisons...")

    matrix = {}  # "code_a-code_b" -> avg_score
    pair_details = []
    start = time.time()
    done = 0

    for code_a, code_b in combinations(lang_codes, 2):
        avg, n = compare_pair(index, code_a, code_b, max_pairs=args.max_pairs)
        done += 1

        if avg is not None:
            key_ab = f"{code_a}-{code_b}"
            key_ba = f"{code_b}-{code_a}"
            matrix[key_ab] = avg
            matrix[key_ba] = avg
            pair_details.append({
                "a": code_a, "b": code_b,
                "a_name": LANGUAGES[code_a]["name"],
                "b_name": LANGUAGES[code_b]["name"],
                "score": round(avg, 4),
                "n": n,
            })

        if done % 50 == 0:
            elapsed = time.time() - start
            rate = done / elapsed
            remaining = (n_pairs - done) / rate if rate > 0 else 0
            print(f"  {done}/{n_pairs} pairs ({rate:.0f}/sec, ~{remaining:.0f}s remaining)")

    elapsed = time.time() - start
    print(f"\nCompleted {done} pairs in {elapsed:.1f}s")

    # Self-similarity = 1.0
    for code in lang_codes:
        matrix[f"{code}-{code}"] = 1.0

    # Build output structure
    lang_info = []
    for code in lang_codes:
        lang_info.append({
            "code": code,
            "name": LANGUAGES[code]["name"],
            "family": LANGUAGES[code]["family"],
        })

    output = {
        "languages": lang_info,
        "matrix": matrix,
        "pairs": sorted(pair_details, key=lambda x: x["score"], reverse=True),
    }

    # Write JSON for web
    web_path = os.path.join(BASE_DIR, "web", "data", "cross_matrix.json")
    with open(web_path, "w") as f:
        json.dump(output, f)
    print(f"\nMatrix written to {web_path}")

    # Also write to repo root for analysis
    root_path = os.path.join(BASE_DIR, "cross_matrix.json")
    with open(root_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Matrix written to {root_path}")

    # Print top/bottom pairs
    print(f"\n{'='*70}")
    print("TOP 30 MOST SIMILAR LANGUAGE PAIRS")
    print(f"{'='*70}")
    print(f"{'Language A':<15} {'Language B':<15} {'Score':>8} {'Pairs':>7}")
    print(f"{'-'*50}")
    for p in output["pairs"][:30]:
        print(f"{p['a_name']:<15} {p['b_name']:<15} {p['score']:>8.4f} {p['n']:>7}")

    print(f"\n{'='*70}")
    print("BOTTOM 20 LEAST SIMILAR LANGUAGE PAIRS")
    print(f"{'='*70}")
    print(f"{'Language A':<15} {'Language B':<15} {'Score':>8} {'Pairs':>7}")
    print(f"{'-'*50}")
    for p in output["pairs"][-20:]:
        print(f"{p['a_name']:<15} {p['b_name']:<15} {p['score']:>8.4f} {p['n']:>7}")


if __name__ == "__main__":
    main()
