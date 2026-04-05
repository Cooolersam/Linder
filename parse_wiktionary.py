#!/usr/bin/env python3
"""
Parse kaikki.org Wiktionary English dump into en-XX.txt word pair files.

Downloads and processes the full English Wiktionary JSONL dump, extracting
single-word translations for languages we want to add.

Usage:
    python parse_wiktionary.py
"""

import gzip
import json
import os
import re
import sys
from collections import defaultdict

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
DUMP_PATH = "/tmp/wiktionary-en.jsonl.gz"

# Languages to extract — code: (iso2 code for our system, name, family, romanize method)
# Only languages we DON'T already have
WANTED = {
    # Wiktionary code -> (our code, name, family, romanize)
    "gl":  ("gl",  "Galician",          "Romance",       None),
    "eo":  ("eo",  "Esperanto",         "Constructed",   None),
    "be":  ("be",  "Belarusian",        "Slavic",        "unidecode"),
    "ka":  ("ka",  "Georgian",          "Kartvelian",    "unidecode"),
    "hy":  ("hy",  "Armenian",          "Armenian",      "unidecode"),
    "az":  ("az",  "Azerbaijani",       "Turkic",        None),
    "is":  ("is",  "Icelandic",         "Germanic",      None),
    "gd":  ("gd",  "Scottish Gaelic",   "Celtic",        None),
    "kk":  ("kk",  "Kazakh",            "Turkic",        "unidecode"),
    "mn":  ("mn",  "Mongolian",         "Mongolic",      "unidecode"),
    "mi":  ("mi",  "Maori",             "Austronesian",  None),
    "nb":  ("nb",  "Norwegian Bokmal",  "Germanic",      None),
    "km":  ("km",  "Khmer",             "Austroasiatic",  "unidecode"),
    "mr":  ("mr",  "Marathi",           "Indo-Iranian",  "iast"),
    "my":  ("my",  "Burmese",           "Sino-Tibetan",  "unidecode"),
    "oc":  ("oc",  "Occitan",           "Romance",       None),
    "sh":  ("sh",  "Serbo-Croatian",    "Slavic",        None),
    "yi":  ("yi",  "Yiddish",           "Germanic",      "unidecode"),
    "uz":  ("uz",  "Uzbek",             "Turkic",        None),
    "lo":  ("lo",  "Lao",               "Tai-Kadai",     "unidecode"),
    "ky":  ("ky",  "Kyrgyz",            "Turkic",        "unidecode"),
    "tg":  ("tg",  "Tajik",             "Indo-Iranian",  "unidecode"),
}


def main():
    if not os.path.exists(DUMP_PATH):
        print(f"Error: Wiktionary dump not found at {DUMP_PATH}")
        print("Download it: curl -sL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz -o /tmp/wiktionary-en.jsonl.gz")
        sys.exit(1)

    # Collect pairs per language
    pairs = defaultdict(set)  # wikt_code -> set of (english, foreign)

    print("Parsing Wiktionary dump...")
    with gzip.open(DUMP_PATH, "rt", encoding="utf-8") as f:
        for i, line in enumerate(f):
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            en_word = entry.get("word", "").lower().strip()
            if not en_word or " " in en_word or len(en_word) < 2:
                continue

            for t in entry.get("translations", []):
                code = t.get("code", "")
                if code not in WANTED:
                    continue
                foreign = t.get("word", "").strip()
                if not foreign or len(foreign) < 1:
                    continue
                # Clean: remove parenthetical notes, skip multi-word
                foreign = re.sub(r"\([^)]*\)", "", foreign).strip()
                if " " in foreign or len(foreign) < 2:
                    continue
                pairs[code].add((en_word, foreign.lower()))

            if (i + 1) % 100000 == 0:
                print(f"  Processed {i+1} entries...")

    print(f"Done. Writing files...")

    for wikt_code, (our_code, name, family, rom) in WANTED.items():
        word_pairs = sorted(pairs.get(wikt_code, set()))
        if len(word_pairs) < 200:
            print(f"  {name} ({our_code}): only {len(word_pairs)} pairs, skipping")
            continue

        out_path = os.path.join(DATA_DIR, f"en-{our_code}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            for en, foreign in word_pairs:
                f.write(f"{en}\t{foreign}\n")

        print(f"  {name} ({our_code}): {len(word_pairs)} pairs -> {out_path}")


if __name__ == "__main__":
    main()
