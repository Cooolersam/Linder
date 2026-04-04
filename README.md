# Linder

Measuring orthographic and phonetic similarity between English and 43 languages across 17 language families.

Each English word is paired with its translation, romanized if needed, and scored on how alike the two look and sound in Latin script.

## Live Site

**[View the interactive explorer →](https://cooolersam.github.io/Linder/)**

## Key Findings

| Family | Avg Score | Languages |
|--------|-----------|-----------|
| Romance | 0.53 | French, Spanish, Italian, Portuguese, Romanian, Catalan |
| Germanic | 0.48 | German, Dutch, Swedish, Danish, Norwegian, Afrikaans |
| Slavic | 0.36 | Russian, Polish, Czech, Croatian, Bulgarian, etc. |
| Semitic | 0.19 | Arabic, Hebrew |

- **53% of German-English** translation pairs score ≥0.7 (high similarity)
- **Vietnamese** ranks highest overall (0.69) due to heavy Latin-script borrowing
- **Arabic** and **Hebrew** rank lowest — almost no orthographic overlap
- **Chinese** is bimodal: words are either phonetically borrowed (high) or completely different (low)

## How It Works

1. **Translation pairs** from the [MUSE bilingual dictionaries](https://github.com/facebookresearch/MUSE) (Meta Research)
2. **Romanization** for non-Latin scripts: Pinyin (Chinese), IAST (Hindi/Bengali), Hepburn (Japanese), Unidecode (Cyrillic, Arabic, Greek, etc.)
3. **Composite score** — weighted blend of 7 metrics:
   - Normalized Levenshtein (30%) — edit distance
   - Jaro-Winkler (25%) — prefix-weighted similarity
   - Metaphone (15%) — English phonetic encoding
   - Soundex (10%) — coarse phonetic encoding
   - Bigram Jaccard (10%) — character pair overlap
   - Trigram Jaccard (5%) — character triple overlap
   - Length similarity (5%)

## Usage

```bash
# Compare two words
python main.py temperature temperatur

# Run a single language (10k pairs)
python batch.py --lang fr

# Run all 43 languages
python batch.py --lang all --limit 10000

# Generate charts
python visualize.py

# Export data for the website
python export_web_data.py
```

### Supported Languages

```bash
python batch.py --list
```

Afrikaans, Albanian, Arabic, Bengali, Bosnian, Bulgarian, Catalan, Chinese, Croatian, Czech, Danish, Dutch, Estonian, Filipino, Finnish, French, German, Greek, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Latvian, Lithuanian, Macedonian, Malay, Norwegian, Persian, Polish, Portuguese, Romanian, Russian, Slovak, Slovenian, Spanish, Swedish, Tamil, Thai, Turkish, Ukrainian, Vietnamese

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Download MUSE dictionaries (run once)
mkdir -p data
for lang in af ar bg bn bs ca cs da de el es et fa fi fr he hi hr hu id it ja ko lt lv mk ms nl no pl pt ro ru sk sl sq sv ta th tl tr uk vi zh; do
    curl -sL -o "data/en-${lang}.txt" "https://dl.fbaipublicfiles.com/arrival/dictionaries/en-${lang}.txt"
done
```

## Project Structure

```
├── main.py              # Single word-pair comparison
├── batch.py             # Batch processing (all languages)
├── visualize.py         # Generate matplotlib charts
├── export_web_data.py   # Export JSON for web frontend
├── web/                 # Static website
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── data/            # JSON data files
└── requirements.txt
```
