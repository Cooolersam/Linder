#!/usr/bin/env python3
"""
Visualize cross-language similarity results.

Reads summary.json (produced by batch.py --lang all) and individual
results_*.csv files to generate comparison charts.

Usage:
    python visualize.py
"""

import json
import os
import sys

import matplotlib
matplotlib.use("Agg")  # non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import numpy as np

BASE_DIR = os.path.dirname(__file__)
SUMMARY_FILE = os.path.join(BASE_DIR, "summary.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "charts")

# Color palette for language families
FAMILY_COLORS = {
    "Germanic":      "#2196F3",
    "Romance":       "#E91E63",
    "Slavic":        "#9C27B0",
    "Baltic":        "#673AB7",
    "Uralic":        "#00BCD4",
    "Turkic":        "#FF9800",
    "Hellenic":      "#4CAF50",
    "Albanian":      "#8BC34A",
    "Semitic":       "#F44336",
    "Indo-Iranian":  "#FF5722",
    "Dravidian":     "#795548",
    "Sino-Tibetan":  "#607D8B",
    "Japonic":       "#E040FB",
    "Koreanic":      "#536DFE",
    "Austronesian":  "#00E676",
    "Tai-Kadai":     "#FFAB00",
    "Austroasiatic":  "#26A69A",
}


def load_summary(min_pairs=1000):
    """Load summary.json, filtering out languages with too few scored pairs."""
    with open(SUMMARY_FILE) as f:
        data = json.load(f)
    # Filter out low-pair-count outliers (like Bengali with IAST issues)
    return [d for d in data if d["n"] >= min_pairs]


def chart_avg_score_by_language(data):
    """Horizontal bar chart: average composite score per language, colored by family."""
    data = sorted(data, key=lambda x: x["avg"])
    langs = [d["lang"] for d in data]
    scores = [d["avg"] for d in data]
    colors = [FAMILY_COLORS.get(d["family"], "#999") for d in data]

    fig, ax = plt.subplots(figsize=(12, max(10, len(langs) * 0.35)))
    bars = ax.barh(langs, scores, color=colors, edgecolor="white", linewidth=0.5)

    # Add score labels
    for bar, score in zip(bars, scores):
        ax.text(bar.get_width() + 0.005, bar.get_y() + bar.get_height()/2,
                f"{score:.3f}", va="center", fontsize=8)

    ax.set_xlabel("Average Composite Similarity Score", fontsize=12)
    ax.set_title("English Similarity to 43 Languages\n(higher = more similar words)", fontsize=14)
    ax.set_xlim(0, max(scores) * 1.15)
    ax.axvline(x=0.5, color="gray", linestyle="--", alpha=0.5, label="0.5 threshold")

    # Legend for families
    families_present = sorted(set(d["family"] for d in data))
    handles = [plt.Rectangle((0,0), 1, 1, facecolor=FAMILY_COLORS.get(f, "#999"))
               for f in families_present]
    ax.legend(handles, families_present, loc="lower right", fontsize=7, ncol=2)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "avg_score_by_language.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"  -> {path}")


def chart_family_averages(data):
    """Bar chart: average score grouped by language family."""
    family_scores = {}
    for d in data:
        family_scores.setdefault(d["family"], []).append(d["avg"])

    families = sorted(family_scores.keys(),
                      key=lambda f: np.mean(family_scores[f]), reverse=True)
    means = [np.mean(family_scores[f]) for f in families]
    stds = [np.std(family_scores[f]) if len(family_scores[f]) > 1 else 0 for f in families]
    colors = [FAMILY_COLORS.get(f, "#999") for f in families]
    counts = [len(family_scores[f]) for f in families]

    fig, ax = plt.subplots(figsize=(14, 6))
    x = np.arange(len(families))
    bars = ax.bar(x, means, yerr=stds, color=colors, edgecolor="white",
                  linewidth=0.5, capsize=4, alpha=0.9)

    for i, (bar, m, n) in enumerate(zip(bars, means, counts)):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + stds[i] + 0.01,
                f"{m:.3f}\n(n={n})", ha="center", va="bottom", fontsize=8)

    ax.set_xticks(x)
    ax.set_xticklabels(families, rotation=45, ha="right", fontsize=10)
    ax.set_ylabel("Average Composite Similarity Score", fontsize=12)
    ax.set_title("Similarity to English by Language Family\n(mean ± std across member languages)", fontsize=14)
    ax.set_ylim(0, max(means) * 1.3)
    ax.axhline(y=0.5, color="gray", linestyle="--", alpha=0.5)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "family_averages.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"  -> {path}")


def chart_stacked_similarity_bands(data):
    """Stacked horizontal bar: high/medium/low % for each language."""
    data = sorted(data, key=lambda x: x["avg"])
    langs = [d["lang"] for d in data]
    highs = [d["high_pct"] for d in data]
    mids = [d["mid_pct"] for d in data]
    lows = [d["low_pct"] for d in data]

    fig, ax = plt.subplots(figsize=(12, max(10, len(langs) * 0.35)))
    y = np.arange(len(langs))

    ax.barh(y, highs, color="#4CAF50", label="High (≥0.7)")
    ax.barh(y, mids, left=highs, color="#FFC107", label="Medium (0.4–0.7)")
    lefts = [h + m for h, m in zip(highs, mids)]
    ax.barh(y, lows, left=lefts, color="#F44336", label="Low (<0.4)")

    ax.set_yticks(y)
    ax.set_yticklabels(langs, fontsize=9)
    ax.set_xlabel("Percentage of Word Pairs", fontsize=12)
    ax.set_title("Distribution of Similarity Scores by Language\n(Green = highly similar, Red = dissimilar)", fontsize=14)
    ax.legend(loc="lower right", fontsize=10)
    ax.set_xlim(0, 100)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "similarity_bands.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"  -> {path}")


def chart_score_distributions(data):
    """
    Violin/box plots for a selection of languages showing score distributions.
    Reads from individual CSV files.
    """
    import csv

    # Pick representative languages across families
    picks = ["af", "fr", "de", "es", "it", "nl", "ru", "pl", "ja", "zh",
             "hi", "ko", "ar", "tr", "fi", "el", "vi", "th", "id", "he"]
    lang_names = {d["code"]: d["lang"] for d in data}

    all_scores = {}
    for code in picks:
        csv_path = os.path.join(BASE_DIR, f"results_{code}.csv")
        if not os.path.exists(csv_path):
            continue
        scores = []
        with open(csv_path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                scores.append(float(row["composite"]))
        if scores:
            name = lang_names.get(code, code)
            all_scores[name] = scores

    if not all_scores:
        print("  (skipping distributions — no CSV files found)")
        return

    # Sort by median
    sorted_langs = sorted(all_scores.keys(),
                          key=lambda k: np.median(all_scores[k]), reverse=True)
    plot_data = [all_scores[lang] for lang in sorted_langs]

    fig, ax = plt.subplots(figsize=(14, 8))
    parts = ax.violinplot(plot_data, positions=range(len(sorted_langs)),
                          showmeans=True, showmedians=True)
    for pc in parts["bodies"]:
        pc.set_facecolor("#2196F3")
        pc.set_alpha(0.6)
    parts["cmeans"].set_color("#E91E63")
    parts["cmedians"].set_color("#4CAF50")

    ax.set_xticks(range(len(sorted_langs)))
    ax.set_xticklabels(sorted_langs, rotation=55, ha="right", fontsize=9)
    ax.set_ylabel("Composite Similarity Score", fontsize=12)
    ax.set_title("Score Distribution by Language (violin plot)\n"
                 "Pink = mean, Green = median", fontsize=14)
    ax.set_ylim(-0.05, 1.05)
    ax.axhline(y=0.7, color="#4CAF50", linestyle="--", alpha=0.4, label="High threshold (0.7)")
    ax.axhline(y=0.4, color="#FFC107", linestyle="--", alpha=0.4, label="Medium threshold (0.4)")
    ax.legend(fontsize=9)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "score_distributions.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"  -> {path}")


def chart_heatmap_by_metric(data):
    """
    Heatmap: average of each individual metric across a selection of languages.
    """
    import csv

    picks = ["af", "fr", "de", "es", "nl", "ru", "ja", "zh", "hi", "ko",
             "ar", "tr", "fi", "el", "vi", "he", "it", "pt", "pl", "th"]
    lang_names = {d["code"]: d["lang"] for d in data}
    metrics = ["norm_levenshtein", "jaro_winkler", "metaphone", "soundex",
               "bigram", "trigram", "norm_length"]
    metric_labels = ["Levenshtein", "Jaro-Winkler", "Metaphone", "Soundex",
                     "Bigram", "Trigram", "Length"]

    matrix = []
    labels = []
    for code in picks:
        csv_path = os.path.join(BASE_DIR, f"results_{code}.csv")
        if not os.path.exists(csv_path):
            continue
        avgs = {m: [] for m in metrics}
        with open(csv_path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                for m in metrics:
                    avgs[m].append(float(row[m]))
        if avgs[metrics[0]]:
            row_data = [np.mean(avgs[m]) for m in metrics]
            matrix.append(row_data)
            labels.append(lang_names.get(code, code))

    if not matrix:
        print("  (skipping heatmap — no data)")
        return

    # Sort by average across metrics
    order = sorted(range(len(matrix)), key=lambda i: np.mean(matrix[i]), reverse=True)
    matrix = [matrix[i] for i in order]
    labels = [labels[i] for i in order]

    matrix_np = np.array(matrix)

    fig, ax = plt.subplots(figsize=(10, max(8, len(labels) * 0.4)))
    im = ax.imshow(matrix_np, cmap="YlOrRd", aspect="auto", vmin=0, vmax=1)

    ax.set_xticks(range(len(metric_labels)))
    ax.set_xticklabels(metric_labels, rotation=45, ha="right", fontsize=10)
    ax.set_yticks(range(len(labels)))
    ax.set_yticklabels(labels, fontsize=10)

    # Add value labels
    for i in range(len(labels)):
        for j in range(len(metrics)):
            val = matrix_np[i, j]
            color = "white" if val > 0.5 else "black"
            ax.text(j, i, f"{val:.2f}", ha="center", va="center",
                    color=color, fontsize=7)

    fig.colorbar(im, ax=ax, label="Average Score", shrink=0.8)
    ax.set_title("Average Similarity by Metric and Language\n"
                 "(which dimensions drive similarity?)", fontsize=14)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "metric_heatmap.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"  -> {path}")


def main():
    if not os.path.exists(SUMMARY_FILE):
        print(f"Error: {SUMMARY_FILE} not found.")
        print("Run: python batch.py --lang all")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    data = load_summary(min_pairs=1000)
    print(f"Loaded summary for {len(data)} languages.\n")

    print("Generating charts...")
    chart_avg_score_by_language(data)
    chart_family_averages(data)
    chart_stacked_similarity_bands(data)
    chart_score_distributions(data)
    chart_heatmap_by_metric(data)

    print(f"\nAll charts saved to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
