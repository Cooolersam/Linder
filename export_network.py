#!/usr/bin/env python3
"""Export network graph data for D3.js force-directed visualization."""

import json
import os

BASE_DIR = os.path.dirname(__file__)

with open(os.path.join(BASE_DIR, "web", "data", "cross_matrix.json")) as f:
    data = json.load(f)

# Filter out Bengali (unreliable due to small sample sizes)
EXCLUDE = {"bn"}
langs = [l for l in data["languages"] if l["code"] not in EXCLUDE]
matrix = data["matrix"]

# Compute centrality for each language (avg similarity to all others)
centrality = {}
for l in langs:
    total, n = 0, 0
    for l2 in langs:
        if l["code"] == l2["code"]:
            continue
        key = f"{l['code']}-{l2['code']}"
        val = matrix.get(key)
        if val is not None:
            total += val
            n += 1
    centrality[l["code"]] = total / n if n else 0

# Build edges: top 3 nearest neighbors per language (deduplicated)
edge_set = set()
edge_scores = {}
for l in langs:
    scores = []
    for l2 in langs:
        if l["code"] == l2["code"]:
            continue
        key = f"{l['code']}-{l2['code']}"
        val = matrix.get(key)
        if val is not None:
            scores.append((l2["code"], val))
    scores.sort(key=lambda x: -x[1])
    for code2, score in scores[:3]:
        edge = tuple(sorted([l["code"], code2]))
        edge_set.add(edge)
        edge_scores[edge] = score

# Also add strong edges (> 0.55) that might not be in top-3
for l in langs:
    for l2 in langs:
        if l["code"] >= l2["code"]:
            continue
        key = f"{l['code']}-{l2['code']}"
        val = matrix.get(key)
        if val is not None and val >= 0.55:
            edge = tuple(sorted([l["code"], l2["code"]]))
            edge_set.add(edge)
            edge_scores[edge] = val

# Build output
nodes = []
for l in langs:
    nodes.append({
        "id": l["code"],
        "name": l["name"],
        "family": l["family"],
        "centrality": round(centrality[l["code"]], 4),
    })

edges = []
for a, b in edge_set:
    edges.append({
        "source": a,
        "target": b,
        "score": round(edge_scores[(a, b)], 4),
    })

network = {"nodes": nodes, "edges": edges}

out_path = os.path.join(BASE_DIR, "web", "data", "network.json")
with open(out_path, "w") as f:
    json.dump(network, f)

print(f"Network: {len(nodes)} nodes, {len(edges)} edges -> {out_path}")
