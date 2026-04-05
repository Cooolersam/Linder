#!/usr/bin/env python3
"""
Extract bilingual word pairs from PanLex via HuggingFace dataset.

Uses pandas for fast joins instead of row-by-row iteration.

Usage:
    python parse_panlex.py
"""

import os
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# panlex_code -> (our_iso2, name, family, romanize)
TARGETS = {
    "amh": ("am",  "Amharic",     "Semitic",       "unidecode"),
    "hau": ("ha",  "Hausa",       "Chadic",        None),
    "yor": ("yo",  "Yoruba",      "Niger-Congo",   None),
    "ibo": ("ig",  "Igbo",        "Niger-Congo",   None),
    "zul": ("zu",  "Zulu",        "Niger-Congo",   None),
    "som": ("so",  "Somali",      "Cushitic",      None),
    "npi": ("ne",  "Nepali",      "Indo-Iranian",  "iast"),
    "pan": ("pa",  "Punjabi",     "Indo-Iranian",  "unidecode"),
    "guj": ("gu",  "Gujarati",    "Indo-Iranian",  "unidecode"),
    "kan": ("kn",  "Kannada",     "Dravidian",     "unidecode"),
    "tel": ("te",  "Telugu",      "Dravidian",     "unidecode"),
    "mal": ("ml",  "Malayalam",   "Dravidian",     "unidecode"),
    "sin": ("si",  "Sinhala",     "Indo-Iranian",  "unidecode"),
    "pbt": ("ps",  "Pashto",      "Indo-Iranian",  "unidecode"),
    "eus": ("eu",  "Basque",      "Basque",        None),
    "mlt": ("mt",  "Maltese",     "Semitic",       None),
    "haw": ("haw", "Hawaiian",    "Austronesian",  None),
    "smo": ("sm",  "Samoan",      "Austronesian",  None),
    "srd": ("sc",  "Sardinian",   "Romance",       None),
    "tir": ("ti",  "Tigrinya",    "Semitic",       "unidecode"),
    "kin": ("rw",  "Kinyarwanda", "Niger-Congo",   None),
    "sna": ("sn",  "Shona",       "Niger-Congo",   None),
    "nya": ("ny",  "Chichewa",    "Niger-Congo",   None),
    "ory": ("or",  "Odia",        "Indo-Iranian",  "unidecode"),
}


def main():
    from datasets import load_dataset
    import pandas as pd

    # Load English as pandas — fast columnar access
    print("Loading English PanLex data as DataFrame...")
    eng_ds = load_dataset("cointegrated/panlex-meanings", "eng", split="train")
    eng_df = eng_ds.to_pandas()[["meaning", "txt_degr", "txt"]]
    # Use degraded text (ASCII-safe) if available, else txt
    eng_df["word"] = eng_df["txt_degr"].fillna(eng_df["txt"]).str.strip().str.lower()
    # Filter: single words, len >= 2
    eng_df = eng_df[eng_df["word"].notna() & ~eng_df["word"].str.contains(" ", na=True) & (eng_df["word"].str.len() >= 2)]
    # Keep first English word per meaning
    eng_df = eng_df.drop_duplicates(subset="meaning", keep="first")[["meaning", "word"]]
    print(f"  {len(eng_df)} English meanings loaded.")

    for panlex_code, (our_code, name, family, rom) in TARGETS.items():
        out_path = os.path.join(DATA_DIR, f"en-{our_code}.txt")
        if os.path.exists(out_path):
            existing = sum(1 for _ in open(out_path))
            if existing > 2000:
                print(f"  {name} ({our_code}): already have {existing} pairs, skipping")
                continue

        print(f"  Loading {name} ({panlex_code})...", end=" ", flush=True)
        try:
            tgt_ds = load_dataset("cointegrated/panlex-meanings", panlex_code, split="train")
        except Exception as e:
            print(f"FAILED: {e}")
            continue

        tgt_df = tgt_ds.to_pandas()[["meaning", "txt"]]
        tgt_df["foreign"] = tgt_df["txt"].str.strip().str.lower()
        tgt_df = tgt_df[tgt_df["foreign"].notna() & ~tgt_df["foreign"].str.contains(" ", na=True) & (tgt_df["foreign"].str.len() >= 2)]
        tgt_df = tgt_df.drop_duplicates(subset=["meaning", "foreign"])[["meaning", "foreign"]]

        # Join on meaning
        merged = eng_df.merge(tgt_df, on="meaning", how="inner")
        pairs = merged[["word", "foreign"]].drop_duplicates()

        if len(pairs) < 200:
            print(f"only {len(pairs)} pairs, skipping")
            continue

        pairs.to_csv(out_path, sep="\t", header=False, index=False)
        print(f"{len(pairs)} pairs -> {out_path}")


if __name__ == "__main__":
    main()
