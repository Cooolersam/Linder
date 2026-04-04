#!/usr/bin/env python3
"""
Language Similarity Measurer

This script measures the similarity between words from different languages
using various metrics including edit distance, length difference, phonetic
similarity, and n-gram overlap.
"""

import sys
from difflib import SequenceMatcher
import jellyfish
from collections import Counter

def levenshtein_distance(s1, s2):
    """
    Calculate the Levenshtein (edit) distance between two strings.
    Lower values indicate higher similarity.
    """
    return jellyfish.levenshtein_distance(s1.lower(), s2.lower())

def normalized_levenshtein(s1, s2):
    """
    Normalized Levenshtein distance (0 to 1, where 1 is identical).
    """
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    return 1 - (levenshtein_distance(s1, s2) / max_len)

def length_difference(s1, s2):
    """
    Absolute difference in string lengths.
    Lower values indicate higher similarity.
    """
    return abs(len(s1) - len(s2))

def normalized_length_similarity(s1, s2):
    """
    Normalized length similarity (0 to 1).
    """
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    return 1 - (length_difference(s1, s2) / max_len)

def soundex_similarity(s1, s2):
    """
    Phonetic similarity using Soundex.
    Returns 1 if Soundex codes are identical, 0 otherwise.
    """
    return 1.0 if jellyfish.soundex(s1) == jellyfish.soundex(s2) else 0.0

def metaphone_similarity(s1, s2):
    """
    Phonetic similarity using Metaphone.
    Returns 1 if Metaphone codes are identical, 0 otherwise.
    """
    return 1.0 if jellyfish.metaphone(s1) == jellyfish.metaphone(s2) else 0.0

def ngram_similarity(s1, s2, n=2):
    """
    Jaccard similarity of n-grams.
    """
    def get_ngrams(text, n):
        text = text.lower()
        return [text[i:i+n] for i in range(len(text)-n+1)]
    
    ngrams1 = set(get_ngrams(s1, n))
    ngrams2 = set(get_ngrams(s2, n))
    
    if not ngrams1 and not ngrams2:
        return 1.0
    
    intersection = len(ngrams1 & ngrams2)
    union = len(ngrams1 | ngrams2)
    
    return intersection / union if union > 0 else 0.0

def jaro_winkler_similarity(s1, s2):
    """
    Jaro-Winkler similarity (0 to 1).
    """
    return jellyfish.jaro_winkler_similarity(s1.lower(), s2.lower())

def hamming_distance(s1, s2):
    """
    Hamming distance for strings of equal length.
    Returns -1 if lengths differ.
    """
    if len(s1) != len(s2):
        return -1
    return sum(c1 != c2 for c1, c2 in zip(s1.lower(), s2.lower()))

def composite_score(word1, word2):
    """
    Weighted composite similarity score (0 to 1).
    Blends orthographic, phonetic, and structural metrics.
    """
    weights = {
        'norm_lev': 0.30,
        'jaro_winkler': 0.25,
        'metaphone': 0.15,
        'soundex': 0.10,
        'bigram': 0.10,
        'trigram': 0.05,
        'length': 0.05,
    }
    scores = {
        'norm_lev': normalized_levenshtein(word1, word2),
        'jaro_winkler': jaro_winkler_similarity(word1, word2),
        'metaphone': metaphone_similarity(word1, word2),
        'soundex': soundex_similarity(word1, word2),
        'bigram': ngram_similarity(word1, word2, 2),
        'trigram': ngram_similarity(word1, word2, 3),
        'length': normalized_length_similarity(word1, word2),
    }
    return sum(weights[k] * scores[k] for k in weights)


def measure_similarity(word1, word2):
    """
    Compute all similarity metrics for two words.
    """
    metrics = {
        'Composite Score': composite_score(word1, word2),
        'Levenshtein Distance': levenshtein_distance(word1, word2),
        'Normalized Levenshtein Similarity': normalized_levenshtein(word1, word2),
        'Length Difference': length_difference(word1, word2),
        'Normalized Length Similarity': normalized_length_similarity(word1, word2),
        'Soundex Similarity': soundex_similarity(word1, word2),
        'Metaphone Similarity': metaphone_similarity(word1, word2),
        '2-gram Similarity': ngram_similarity(word1, word2, 2),
        '3-gram Similarity': ngram_similarity(word1, word2, 3),
        'Jaro-Winkler Similarity': jaro_winkler_similarity(word1, word2),
    }

    hamming = hamming_distance(word1, word2)
    if hamming != -1:
        metrics['Hamming Distance'] = hamming

    return metrics

def main():
    if len(sys.argv) != 3:
        print("Usage: python main.py <word1> <word2>")
        sys.exit(1)
    
    word1 = sys.argv[1]
    word2 = sys.argv[2]
    
    print(f"Comparing '{word1}' and '{word2}':\n")
    
    similarities = measure_similarity(word1, word2)
    
    for metric, value in similarities.items():
        if isinstance(value, float):
            print(f"{metric}: {value:.4f}")
        else:
            print(f"{metric}: {value}")

if __name__ == "__main__":
    main()