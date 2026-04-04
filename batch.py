#!/usr/bin/env python3
"""
Batch cognate detection between English and another language.

Loads a bilingual translation dictionary, romanizes non-Latin scripts,
computes a composite similarity score for each pair, and outputs ranked
results to CSV.

Usage:
    python batch.py --lang fr [--limit N] [--output FILE] [--min-score FLOAT]
    python batch.py --lang zh --limit 0          # full dictionary
    python batch.py --lang all --limit 10000      # run every language

Supported languages: use --list to see all available.
"""

import argparse
import csv
import json
import os
import sys
import time
import unicodedata

from main import (
    composite_score,
    normalized_levenshtein,
    jaro_winkler_similarity,
    soundex_similarity,
    metaphone_similarity,
    ngram_similarity,
    normalized_length_similarity,
)

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")

# ---------------------------------------------------------------------------
# Language registry
# ---------------------------------------------------------------------------
# romanize: None = Latin script, "pinyin" / "iast" / "kakasi" / "unidecode"
# family: for grouping in visualizations

LANGUAGES = {
    # ---- Germanic ----
    "de": {"name": "German",      "family": "Germanic",   "romanize": None},
    "nl": {"name": "Dutch",       "family": "Germanic",   "romanize": None},
    "sv": {"name": "Swedish",     "family": "Germanic",   "romanize": None},
    "da": {"name": "Danish",      "family": "Germanic",   "romanize": None},
    "no": {"name": "Norwegian",   "family": "Germanic",   "romanize": None},
    "af": {"name": "Afrikaans",   "family": "Germanic",   "romanize": None},
    # ---- Romance ----
    "fr": {"name": "French",      "family": "Romance",    "romanize": None},
    "es": {"name": "Spanish",     "family": "Romance",    "romanize": None},
    "it": {"name": "Italian",     "family": "Romance",    "romanize": None},
    "pt": {"name": "Portuguese",  "family": "Romance",    "romanize": None},
    "ro": {"name": "Romanian",    "family": "Romance",    "romanize": None},
    "ca": {"name": "Catalan",     "family": "Romance",    "romanize": None},
    # ---- Slavic ----
    "pl": {"name": "Polish",      "family": "Slavic",     "romanize": None},
    "cs": {"name": "Czech",       "family": "Slavic",     "romanize": None},
    "sk": {"name": "Slovak",      "family": "Slavic",     "romanize": None},
    "hr": {"name": "Croatian",    "family": "Slavic",     "romanize": None},
    "sl": {"name": "Slovenian",   "family": "Slavic",     "romanize": None},
    "bs": {"name": "Bosnian",     "family": "Slavic",     "romanize": None},
    "ru": {"name": "Russian",     "family": "Slavic",     "romanize": "unidecode"},
    "uk": {"name": "Ukrainian",   "family": "Slavic",     "romanize": "unidecode"},
    "bg": {"name": "Bulgarian",   "family": "Slavic",     "romanize": "unidecode"},
    "mk": {"name": "Macedonian",  "family": "Slavic",     "romanize": "unidecode"},
    # ---- Baltic ----
    "lt": {"name": "Lithuanian",  "family": "Baltic",     "romanize": None},
    "lv": {"name": "Latvian",     "family": "Baltic",     "romanize": None},
    # ---- Uralic ----
    "fi": {"name": "Finnish",     "family": "Uralic",     "romanize": None},
    "hu": {"name": "Hungarian",   "family": "Uralic",     "romanize": None},
    "et": {"name": "Estonian",    "family": "Uralic",     "romanize": None},
    # ---- Turkic ----
    "tr": {"name": "Turkish",     "family": "Turkic",     "romanize": None},
    # ---- Hellenic ----
    "el": {"name": "Greek",       "family": "Hellenic",   "romanize": "unidecode"},
    # ---- Albanian ----
    "sq": {"name": "Albanian",    "family": "Albanian",   "romanize": None},
    # ---- Semitic ----
    "ar": {"name": "Arabic",      "family": "Semitic",    "romanize": "unidecode"},
    "he": {"name": "Hebrew",      "family": "Semitic",    "romanize": "unidecode"},
    # ---- Indo-Iranian ----
    "hi": {"name": "Hindi",       "family": "Indo-Iranian", "romanize": "iast"},
    "bn": {"name": "Bengali",     "family": "Indo-Iranian", "romanize": "iast"},
    "fa": {"name": "Persian",     "family": "Indo-Iranian", "romanize": "unidecode"},
    # ---- Dravidian ----
    "ta": {"name": "Tamil",       "family": "Dravidian",  "romanize": "unidecode"},
    # ---- Sino-Tibetan ----
    "zh": {"name": "Chinese",     "family": "Sino-Tibetan", "romanize": "pinyin"},
    # ---- Japonic ----
    "ja": {"name": "Japanese",    "family": "Japonic",    "romanize": "kakasi"},
    # ---- Koreanic ----
    "ko": {"name": "Korean",      "family": "Koreanic",   "romanize": "unidecode"},
    # ---- Austronesian ----
    "id": {"name": "Indonesian",  "family": "Austronesian", "romanize": None},
    "ms": {"name": "Malay",       "family": "Austronesian", "romanize": None},
    "tl": {"name": "Filipino",    "family": "Austronesian", "romanize": None},
    # ---- Tai-Kadai ----
    "th": {"name": "Thai",        "family": "Tai-Kadai",  "romanize": "unidecode"},
    # ---- Austroasiatic ----
    "vi": {"name": "Vietnamese",  "family": "Austroasiatic", "romanize": None},
    # ---- Celtic ----
    "cy": {"name": "Welsh",       "family": "Celtic",     "romanize": None},
    "ga": {"name": "Irish",       "family": "Celtic",     "romanize": None},
    # ---- Iranian (Kurdish) ----
    "ku": {"name": "Kurdish",     "family": "Indo-Iranian", "romanize": None},
    # ---- Italic (Latin) ----
    "la": {"name": "Latin",       "family": "Italic",     "romanize": None},
    # ---- Niger-Congo (Swahili) ----
    "sw": {"name": "Swahili",     "family": "Niger-Congo", "romanize": None},
    # ---- Indo-Iranian (Urdu) ----
    "ur": {"name": "Urdu",        "family": "Indo-Iranian", "romanize": "unidecode"},
}


# ---------------------------------------------------------------------------
# Romanization
# ---------------------------------------------------------------------------

def romanize_pinyin(word):
    from pypinyin import lazy_pinyin
    return "".join(lazy_pinyin(word))


def romanize_iast(word):
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import transliterate
    replacements = {"\u0949": "o", "\u0945": "e"}
    for char, repl in replacements.items():
        word = word.replace(char, repl)
    iast = transliterate(word, sanscript.DEVANAGARI, sanscript.IAST)
    normalized = unicodedata.normalize("NFD", iast)
    stripped = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    stripped = "".join(c for c in stripped if c.isascii() and c.isalpha())
    return stripped.lower()


def romanize_kakasi(word):
    from pykakasi import kakasi
    kks = kakasi()
    result = kks.convert(word)
    return "".join(item["hepburn"] for item in result).lower()


def romanize_unidecode(word):
    from unidecode import unidecode
    result = unidecode(word).lower().strip()
    result = "".join(c for c in result if c.isascii() and c.isalpha())
    return result


def strip_diacriticals(word):
    """For Latin-script languages: remove accents for fairer comparison."""
    normalized = unicodedata.normalize("NFD", word.lower())
    stripped = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    stripped = "".join(c for c in stripped if c.isascii() and c.isalpha())
    return stripped


ROMANIZERS = {
    "pinyin": romanize_pinyin,
    "iast": romanize_iast,
    "kakasi": romanize_kakasi,
    "unidecode": romanize_unidecode,
}


def get_romanizer(lang_config):
    method = lang_config["romanize"]
    if method is None:
        return strip_diacriticals  # still strip accents for Latin scripts
    return ROMANIZERS[method]


# ---------------------------------------------------------------------------
# Dictionary loading
# ---------------------------------------------------------------------------

def load_dictionary(path, limit=None):
    pairs = []
    seen = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if "\t" in line:
                parts = line.strip().split("\t")
            else:
                parts = line.strip().split()
            if len(parts) != 2:
                continue
            en, foreign = parts[0].strip().lower(), parts[1].strip().lower()
            if len(en) < 2 or len(foreign) < 1:
                continue
            key = (en, foreign)
            if key in seen:
                continue
            seen.add(key)
            pairs.append((en, foreign))
            if limit and len(pairs) >= limit:
                break
    return pairs


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_pair(en, foreign, romanized, lang_key):
    return {
        "english": en,
        "foreign": foreign,
        "romanized": romanized,
        "composite": composite_score(en, romanized),
        "norm_levenshtein": normalized_levenshtein(en, romanized),
        "jaro_winkler": jaro_winkler_similarity(en, romanized),
        "metaphone": metaphone_similarity(en, romanized),
        "soundex": soundex_similarity(en, romanized),
        "bigram": ngram_similarity(en, romanized, 2),
        "trigram": ngram_similarity(en, romanized, 3),
        "norm_length": normalized_length_similarity(en, romanized),
    }


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------

def print_results(results, lang_name, has_romanization):
    identical = [r for r in results if r["english"] == r["romanized"]]
    cognates = [r for r in results if r["english"] != r["romanized"]]

    if identical:
        print(f"\n{'='*70}")
        print(f"IDENTICAL (romanized = English): {len(identical)}")
        print(f"{'='*70}")
        for row in identical[:10]:
            extra = f" ({row['foreign']})" if has_romanization else ""
            print(f"  {row['english']}{extra}")
        if len(identical) > 10:
            print(f"  ... and {len(identical)-10} more")

    print(f"\n{'='*70}")
    print(f"TOP 30 COGNATES (similar but not identical)")
    print(f"{'='*70}")
    if has_romanization:
        print(f"{'English':<18} {'Original':<16} {'Romanized':<18} {'Score':<8}")
        print(f"{'-'*64}")
        for row in cognates[:30]:
            print(f"{row['english']:<18} {row['foreign']:<16} {row['romanized']:<18} {row['composite']:.4f}")
    else:
        print(f"{'English':<20} {'Translation':<20} {'Score':<10}")
        print(f"{'-'*50}")
        for row in cognates[:30]:
            print(f"{row['english']:<20} {row['romanized']:<20} {row['composite']:.4f}")

    print(f"\n{'='*70}")
    print(f"BOTTOM 15 (least similar)")
    print(f"{'='*70}")
    if has_romanization:
        print(f"{'English':<18} {'Original':<16} {'Romanized':<18} {'Score':<8}")
        print(f"{'-'*64}")
        for row in results[-15:]:
            print(f"{row['english']:<18} {row['foreign']:<16} {row['romanized']:<18} {row['composite']:.4f}")
    else:
        print(f"{'English':<20} {'Translation':<20} {'Score':<10}")
        print(f"{'-'*50}")
        for row in results[-15:]:
            print(f"{row['english']:<20} {row['romanized']:<20} {row['composite']:.4f}")


def print_summary(results, lang_name):
    if not results:
        print("\nNo results.")
        return {}
    scores = [r["composite"] for r in results]
    avg = sum(scores) / len(scores)
    high = len([s for s in scores if s >= 0.7])
    mid = len([s for s in scores if 0.4 <= s < 0.7])
    low = len([s for s in scores if s < 0.4])
    n = len(results)
    print(f"\n{'='*70}")
    print(f"SUMMARY — English vs {lang_name}")
    print(f"{'='*70}")
    print(f"Total pairs:             {n}")
    print(f"Average score:           {avg:.4f}")
    print(f"High similarity (>=0.7): {high} ({100*high/n:.1f}%)")
    print(f"Medium (0.4-0.7):        {mid} ({100*mid/n:.1f}%)")
    print(f"Low (<0.4):              {low} ({100*low/n:.1f}%)")
    return {"lang": lang_name, "n": n, "avg": avg,
            "high_pct": 100*high/n, "mid_pct": 100*mid/n, "low_pct": 100*low/n}


# ---------------------------------------------------------------------------
# Process a single language
# ---------------------------------------------------------------------------

def process_language(lang_code, limit, min_score, output):
    lang = LANGUAGES[lang_code]
    lang_name = lang["name"]
    dict_file = os.path.join(DATA_DIR, f"en-{lang_code}.txt")

    if not os.path.exists(dict_file):
        print(f"  Skipping {lang_name} — dictionary not found")
        return None

    romanizer = get_romanizer(lang)
    has_romanization = lang["romanize"] is not None

    print(f"\n{'#'*70}")
    print(f"# {lang_name} ({lang_code}) — family: {lang['family']}")
    print(f"{'#'*70}")

    pairs = load_dictionary(dict_file, limit=limit)
    print(f"Loaded {len(pairs)} pairs.")

    results = []
    skipped = 0
    start = time.time()
    for i, (en, foreign) in enumerate(pairs):
        romanized = romanizer(foreign)
        if not romanized or len(romanized) < 1:
            skipped += 1
            continue
        row = score_pair(en, foreign, romanized, lang_code)
        if row["composite"] >= min_score:
            results.append(row)
        if (i + 1) % 5000 == 0:
            elapsed = time.time() - start
            rate = (i + 1) / elapsed
            print(f"  {i+1}/{len(pairs)} ({rate:.0f} pairs/sec)")

    elapsed = time.time() - start
    print(f"Scored {len(pairs)} pairs in {elapsed:.1f}s")
    if skipped:
        print(f"Skipped {skipped} (romanization empty)")

    results.sort(key=lambda x: x["composite"], reverse=True)

    # Write CSV
    fieldnames = ["english", "foreign", "romanized", "composite",
                  "norm_levenshtein", "jaro_winkler", "metaphone",
                  "soundex", "bigram", "trigram", "norm_length"]
    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in results:
            out = {k: (f"{v:.4f}" if isinstance(v, float) else v) for k, v in row.items()}
            writer.writerow(out)

    print(f"{len(results)} pairs -> {output}")
    print_results(results, lang_name, has_romanization)
    summary = print_summary(results, lang_name)
    if summary:
        summary["code"] = lang_code
        summary["family"] = lang["family"]
    return summary


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Batch cognate detection: English vs any language")
    parser.add_argument("--lang", type=str, required=True,
                        help="Language code (e.g. fr, zh) or 'all' to run every language")
    parser.add_argument("--limit", type=int, default=10000,
                        help="Max word pairs (default: 10000, 0=all)")
    parser.add_argument("--output", type=str, default=None,
                        help="Output CSV (default: results_<lang>.csv)")
    parser.add_argument("--min-score", type=float, default=0.0,
                        help="Minimum composite score to include")
    parser.add_argument("--list", action="store_true",
                        help="List all supported languages and exit")
    args = parser.parse_args()

    if args.list:
        print(f"{'Code':<6} {'Language':<15} {'Family':<18} {'Romanize':<12} {'Dict'}")
        print("-" * 70)
        for code, cfg in sorted(LANGUAGES.items(), key=lambda x: x[1]["family"]):
            dfile = os.path.join(DATA_DIR, f"en-{code}.txt")
            exists = "yes" if os.path.exists(dfile) else "no"
            rom = cfg["romanize"] or "latin"
            print(f"{code:<6} {cfg['name']:<15} {cfg['family']:<18} {rom:<12} {exists}")
        return

    limit = args.limit if args.limit > 0 else None

    if args.lang == "all":
        summaries = []
        for code in sorted(LANGUAGES.keys()):
            output = os.path.join(BASE_DIR, f"results_{code}.csv")
            summary = process_language(code, limit, args.min_score, output)
            if summary:
                summaries.append(summary)

        # Write summary JSON for visualize.py
        summary_file = os.path.join(BASE_DIR, "summary.json")
        with open(summary_file, "w") as f:
            json.dump(summaries, f, indent=2)
        print(f"\n\nSummary data written to {summary_file}")

        # Print comparison table
        print(f"\n{'='*80}")
        print(f"CROSS-LANGUAGE COMPARISON")
        print(f"{'='*80}")
        print(f"{'Language':<15} {'Family':<18} {'Pairs':>7} {'Avg':>7} {'High%':>7} {'Mid%':>7} {'Low%':>7}")
        print(f"{'-'*80}")
        for s in sorted(summaries, key=lambda x: x["avg"], reverse=True):
            print(f"{s['lang']:<15} {s['family']:<18} {s['n']:>7} {s['avg']:>7.4f} "
                  f"{s['high_pct']:>6.1f}% {s['mid_pct']:>6.1f}% {s['low_pct']:>6.1f}%")
    else:
        if args.lang not in LANGUAGES:
            print(f"Unknown language: {args.lang}")
            print(f"Use --list to see available languages")
            sys.exit(1)
        output = args.output or os.path.join(BASE_DIR, f"results_{args.lang}.csv")
        process_language(args.lang, limit, args.min_score, output)


if __name__ == "__main__":
    main()
