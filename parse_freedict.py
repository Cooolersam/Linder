#!/usr/bin/env python3
"""
Parse FreeDict dictd files into simple en-XX.txt word pair format.

FreeDict distributes .dict.dz (gzip compressed) + .index files.
The dict file contains definitions, and we extract the simplest
single-word translations from them.
"""

import gzip
import os
import re
import sys
import base64

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

FREEDICT_LANGS = {
    "eng-cym": "cy",  # Welsh
    "eng-gle": "ga",  # Irish
    "eng-kur": "ku",  # Kurdish
    "eng-lat": "la",  # Latin
    "eng-srp": "sr",  # Serbian
    "eng-swh": "sw",  # Swahili
}


def decode_b64_offset(s):
    """Decode a dictd base64-encoded offset/size."""
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    result = 0
    for c in s:
        result = result * 64 + chars.index(c)
    return result


def parse_dictd(dict_path, index_path):
    """Parse a dictd dictionary and return (english, translation) pairs."""
    # Read the compressed dict
    with gzip.open(dict_path, "rb") as f:
        dict_data = f.read()

    # Read the index
    pairs = []
    with open(index_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 3:
                continue
            headword, offset_b64, size_b64 = parts

            # Skip database metadata entries
            if headword.startswith("00database"):
                continue

            offset = decode_b64_offset(offset_b64)
            size = decode_b64_offset(size_b64)

            # Extract the definition
            try:
                definition = dict_data[offset:offset + size].decode("utf-8", errors="ignore")
            except Exception:
                continue

            # Parse translations from the definition block
            # Definitions typically have the headword on the first line
            # and translations in subsequent lines
            translations = extract_translations(headword, definition)
            for trans in translations:
                pairs.append((headword.lower().strip(), trans.lower().strip()))

    return pairs


def extract_translations(headword, definition):
    """Extract single-word translations from a definition block."""
    translations = []
    lines = definition.strip().split("\n")

    for line in lines:
        line = line.strip()
        # Skip empty lines and the headword itself
        if not line or line.lower() == headword.lower():
            continue
        # Skip metadata lines
        if line.startswith("00-database") or line.startswith("From "):
            continue
        # Skip lines that are clearly grammatical notes only
        if line.startswith("[") or line.startswith("("):
            continue
        # Skip pronunciation lines
        if line.startswith("/") and line.endswith("/"):
            continue

        # Remove angle-bracket tags like <n, s, m>, <a>, <v> etc.
        line = re.sub(r"<[^>]*>", "", line).strip()
        # Remove pronunciation in slashes
        line = re.sub(r"/[^/]*/", "", line).strip()

        # Try to extract clean words - split on commas/semicolons for multiple translations
        for part in re.split(r"[;,]", line):
            word = part.strip()
            # Remove parenthetical notes
            word = re.sub(r"\([^)]*\)", "", word).strip()
            # Remove leading numbers/bullets
            word = re.sub(r"^\d+\.\s*", "", word).strip()
            # Remove curly braces content
            word = re.sub(r"\{[^}]*\}", "", word).strip()
            # Only keep single words or simple two-word phrases
            if word and len(word.split()) <= 2 and len(word) > 1:
                # Skip if it's just English or metadata
                if word.lower() != headword.lower() and not word.startswith("{"):
                    translations.append(word)

    return translations


def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/freedict"

    for dirname, lang_code in FREEDICT_LANGS.items():
        dict_dir = os.path.join(src_dir, dirname)
        dict_file = os.path.join(dict_dir, f"{dirname}.dict.dz")
        index_file = os.path.join(dict_dir, f"{dirname}.index")

        if not os.path.exists(dict_file):
            print(f"  {dirname}: not found, skipping")
            continue

        pairs = parse_dictd(dict_file, index_file)

        # Deduplicate
        seen = set()
        unique = []
        for en, foreign in pairs:
            # Only keep single-word entries
            if " " in en or " " in foreign:
                continue
            if len(en) < 2 or len(foreign) < 2:
                continue
            key = (en, foreign)
            if key not in seen:
                seen.add(key)
                unique.append((en, foreign))

        out_path = os.path.join(DATA_DIR, f"en-{lang_code}.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            for en, foreign in unique:
                f.write(f"{en}\t{foreign}\n")

        print(f"  {dirname} -> {lang_code}: {len(unique)} pairs -> {out_path}")


if __name__ == "__main__":
    main()
