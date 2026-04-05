/* ===== Linder — app.js ===== */

const DATA_BASE = "data";
let summaryData = [];
let currentSort = { key: "avg", desc: true };

// ---- Family colors (match Python) ----
const FAMILY_COLORS = {
    "Germanic":       "#2196F3",
    "Romance":        "#E91E63",
    "Slavic":         "#7B1FA2",
    "Baltic":         "#4527A0",
    "Uralic":         "#00838F",
    "Turkic":         "#EF6C00",
    "Hellenic":       "#2E7D32",
    "Albanian":       "#558B2F",
    "Semitic":        "#C62828",
    "Indo-Iranian":   "#D84315",
    "Dravidian":      "#5D4037",
    "Sino-Tibetan":   "#455A64",
    "Japonic":        "#AD1457",
    "Koreanic":       "#283593",
    "Austronesian":   "#00897B",
    "Tai-Kadai":      "#F57F17",
    "Austroasiatic":  "#00796B",
    "Celtic":         "#1B5E20",
    "Italic":         "#880E4F",
    "Niger-Congo":    "#BF360C",
    "Kartvelian":     "#33691E",
    "Armenian":       "#4E342E",
    "Constructed":    "#37474F",
    "Mongolic":       "#827717",
    "Chadic":         "#E65100",
    "Cushitic":       "#FF6D00",
    "Basque":         "#006064",
};

function familyColor(family) {
    return FAMILY_COLORS[family] || "#999";
}

function scoreColor(score) {
    if (score >= 0.7) return "var(--green)";
    if (score >= 0.4) return "var(--yellow)";
    return "var(--red)";
}

// ---- View navigation ----
const renderedViews = new Set();

function showView(viewId) {
    // Hide everything
    document.getElementById("overview").classList.add("hidden");
    document.getElementById("detail").classList.add("hidden");
    document.querySelectorAll(".view-page").forEach(p => p.classList.add("hidden"));

    // Show the requested view
    const el = document.getElementById(`view-${viewId}`);
    if (el) {
        el.classList.remove("hidden");
        window.scrollTo(0, 0);
        // Lazy-render on first visit
        if (!renderedViews.has(viewId)) {
            renderedViews.add(viewId);
            switch (viewId) {
                case "heatmap": loadAndRenderHeatmap(); break;
                case "rankings": renderMainChart(); break;
                case "families": renderFamilyChart(); break;
                case "distribution": renderBandsChart(); break;
                case "compare": initCompare(); break;
                case "data": renderTable(); break;
            }
        }
    }
}

function showOverview() {
    document.querySelectorAll(".view-page").forEach(p => p.classList.add("hidden"));
    document.getElementById("detail").classList.add("hidden");
    document.getElementById("overview").classList.remove("hidden");
    window.scrollTo(0, 0);
}

// ---- Init ----
async function init() {
    const resp = await fetch(`${DATA_BASE}/summary.json`);
    summaryData = await resp.json();
    document.getElementById("lang-count").textContent = summaryData.length;
    loadAndRenderNetwork();
}

// ---- Overview Charts ----

let mainChart = null;

function renderMainChart() {
    const sorted = [...summaryData].sort((a, b) => a.avg - b.avg);
    const ctx = document.getElementById("chartMain").getContext("2d");
    if (mainChart) mainChart.destroy();
    mainChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: sorted.map(d => d.lang),
            datasets: [{
                data: sorted.map(d => d.avg),
                backgroundColor: sorted.map(d => familyColor(d.family)),
                borderWidth: 0,
                borderRadius: 3,
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const d = sorted[ctx.dataIndex];
                            return `${d.avg.toFixed(3)} — ${d.family}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 0.8,
                    title: { display: true, text: "Average Composite Score" },
                    grid: { color: "#f0f0f0" },
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    showDetail(sorted[idx].code);
                }
            },
            onHover: (e, elements) => {
                e.native.target.style.cursor = elements.length ? "pointer" : "default";
            }
        }
    });
}

function renderFamilyChart() {
    const familyMap = {};
    summaryData.forEach(d => {
        if (!familyMap[d.family]) familyMap[d.family] = [];
        familyMap[d.family].push(d.avg);
    });

    const families = Object.keys(familyMap).sort(
        (a, b) => mean(familyMap[b]) - mean(familyMap[a])
    );

    const ctx = document.getElementById("chartFamily").getContext("2d");
    new Chart(ctx, {
        type: "bar",
        data: {
            labels: families,
            datasets: [{
                data: families.map(f => mean(familyMap[f])),
                backgroundColor: families.map(f => familyColor(f)),
                borderWidth: 0,
                borderRadius: 4,
                errorBars: families.map(f => std(familyMap[f])),
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const f = families[ctx.dataIndex];
                            const m = mean(familyMap[f]);
                            const s = std(familyMap[f]);
                            const n = familyMap[f].length;
                            return `${m.toFixed(3)} ± ${s.toFixed(3)} (${n} language${n > 1 ? "s" : ""})`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 0.8,
                    title: { display: true, text: "Average Score" },
                    grid: { color: "#f0f0f0" },
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 }, maxRotation: 45 }
                }
            }
        }
    });
}

function renderBandsChart() {
    const sorted = [...summaryData].sort((a, b) => a.avg - b.avg);
    const ctx = document.getElementById("chartBands").getContext("2d");
    new Chart(ctx, {
        type: "bar",
        data: {
            labels: sorted.map(d => d.lang),
            datasets: [
                {
                    label: "High (≥0.7)",
                    data: sorted.map(d => d.high_pct),
                    backgroundColor: "#22863a",
                    borderWidth: 0,
                },
                {
                    label: "Medium (0.4–0.7)",
                    data: sorted.map(d => d.mid_pct),
                    backgroundColor: "#d19a00",
                    borderWidth: 0,
                },
                {
                    label: "Low (<0.4)",
                    data: sorted.map(d => d.low_pct),
                    backgroundColor: "#cb2431",
                    borderWidth: 0,
                }
            ]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "top" },
            },
            scales: {
                x: {
                    stacked: true,
                    max: 100,
                    title: { display: true, text: "Percentage of Word Pairs" },
                    grid: { color: "#f0f0f0" },
                },
                y: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

// ---- Table ----

function renderTable() {
    const tbody = document.querySelector("#langTable tbody");
    const sorted = [...summaryData].sort((a, b) => {
        const va = a[currentSort.key], vb = b[currentSort.key];
        if (typeof va === "string") return currentSort.desc ? vb.localeCompare(va) : va.localeCompare(vb);
        return currentSort.desc ? vb - va : va - vb;
    });

    tbody.innerHTML = sorted.map(d => `
        <tr class="clickable" onclick="showDetail('${d.code}')">
            <td><strong>${d.lang}</strong></td>
            <td><span style="color:${familyColor(d.family)}">●</span> ${d.family}</td>
            <td class="score-cell">
                <span class="score-bar" style="width:${d.avg * 120}px; background:${scoreColor(d.avg)}"></span>
                ${d.avg.toFixed(3)}
            </td>
            <td class="score-cell" style="color:var(--green)">${d.high_pct.toFixed(1)}%</td>
            <td class="score-cell" style="color:var(--yellow)">${d.mid_pct.toFixed(1)}%</td>
            <td class="score-cell" style="color:var(--red)">${d.low_pct.toFixed(1)}%</td>
            <td class="score-cell">${d.n.toLocaleString()}</td>
        </tr>
    `).join("");
}

// Table sorting
document.querySelectorAll("#langTable th.sortable").forEach(th => {
    th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (currentSort.key === key) {
            currentSort.desc = !currentSort.desc;
        } else {
            currentSort = { key, desc: key !== "lang" && key !== "family" };
        }
        document.querySelectorAll("#langTable th").forEach(t => {
            t.classList.remove("sorted-asc", "sorted-desc");
        });
        th.classList.add(currentSort.desc ? "sorted-desc" : "sorted-asc");
        renderTable();
    });
});

// ---- Detail Page ----

let histChart = null;

async function showDetail(code) {
    const resp = await fetch(`${DATA_BASE}/${code}.json`);
    const data = await resp.json();
    const info = data.info;

    document.getElementById("overview").classList.add("hidden");
    document.querySelectorAll(".view-page").forEach(p => p.classList.add("hidden"));
    document.getElementById("detail").classList.remove("hidden");
    window.scrollTo(0, 0);

    // Header
    document.getElementById("detailTitle").textContent =
        `${info.lang} — ${info.family}`;

    document.getElementById("detailStats").innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${info.avg.toFixed(3)}</span>
            <span class="stat-label">Avg Score</span>
        </div>
        <div class="stat-item">
            <span class="stat-value stat-green">${info.high_pct.toFixed(1)}%</span>
            <span class="stat-label">High (≥0.7)</span>
        </div>
        <div class="stat-item">
            <span class="stat-value stat-yellow">${info.mid_pct.toFixed(1)}%</span>
            <span class="stat-label">Medium</span>
        </div>
        <div class="stat-item">
            <span class="stat-value stat-red">${info.low_pct.toFixed(1)}%</span>
            <span class="stat-label">Low (<0.4)</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${info.n.toLocaleString()}</span>
            <span class="stat-label">Pairs Scored</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${data.identical_count}</span>
            <span class="stat-label">Identical Words</span>
        </div>
    `;

    // Histogram
    renderHistogram(data.histogram);

    // Cognates table
    const hasRomanized = data.top_cognates.some(r => r.rom !== r.foreign);
    document.getElementById("romHeader").style.display = hasRomanized ? "" : "none";

    const cogBody = document.querySelector("#cognateTable tbody");
    cogBody.innerHTML = data.top_cognates.map(r => `
        <tr>
            <td><strong>${r.en}</strong></td>
            <td>${r.foreign}</td>
            <td style="display:${hasRomanized ? '' : 'none'}; font-family:var(--mono); color:var(--text-secondary)">${r.rom}</td>
            <td class="score-cell">
                <span class="score-bar" style="width:${r.score * 80}px; background:${scoreColor(r.score)}"></span>
                ${r.score.toFixed(4)}
            </td>
            <td class="score-cell">${r.lev.toFixed(3)}</td>
            <td class="score-cell">${r.jw.toFixed(3)}</td>
        </tr>
    `).join("");

    // Identical words cloud
    const cloud = document.getElementById("identicalCloud");
    if (data.identical_count > 0) {
        document.getElementById("identicalSection").style.display = "";
        cloud.innerHTML = data.identical_sample.map(r =>
            `<span class="tag">${r.en}</span>`
        ).join("") + (data.identical_count > 20 ?
            `<span class="tag" style="background:#e8e8e8">+${data.identical_count - 20} more</span>` : "");
    } else {
        document.getElementById("identicalSection").style.display = "none";
    }

    // Bottom table
    const btmBody = document.querySelector("#bottomTable tbody");
    btmBody.innerHTML = data.bottom.slice(-30).reverse().map(r => `
        <tr>
            <td><strong>${r.en}</strong></td>
            <td>${r.foreign}</td>
            <td style="font-family:var(--mono); color:var(--text-secondary)">${r.rom}</td>
            <td class="score-cell" style="color:var(--red)">${r.score.toFixed(4)}</td>
        </tr>
    `).join("");
}

function renderHistogram(bins) {
    const labels = [];
    for (let i = 0; i < 20; i++) {
        labels.push(`${(i * 0.05).toFixed(2)}–${((i + 1) * 0.05).toFixed(2)}`);
    }

    const colors = bins.map((_, i) => {
        const mid = (i + 0.5) * 0.05;
        if (mid >= 0.7) return "#22863a";
        if (mid >= 0.4) return "#d19a00";
        return "#cb2431";
    });

    const ctx = document.getElementById("chartHist").getContext("2d");
    if (histChart) histChart.destroy();
    histChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: bins,
                backgroundColor: colors,
                borderWidth: 0,
                borderRadius: 2,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    title: { display: true, text: "Number of Word Pairs" },
                    grid: { color: "#f0f0f0" },
                },
                x: {
                    title: { display: true, text: "Composite Score Range" },
                    grid: { display: false },
                    ticks: { maxRotation: 45, font: { size: 10 } }
                }
            }
        }
    });
}

function showOverview() {
    document.getElementById("detail").classList.add("hidden");
    document.getElementById("overview").classList.remove("hidden");
    window.scrollTo(0, 0);
}

// ---- Utils ----
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ---- Network Graph ----

async function loadAndRenderNetwork() {
    if (typeof d3 === "undefined") {
        console.warn("D3.js not loaded, skipping network graph");
        return;
    }
    try {
        const resp = await fetch(`${DATA_BASE}/network.json`);
        const data = await resp.json();
        renderNetwork(data);
    } catch (e) {
        console.warn("Network data not available:", e);
    }
}

function renderNetwork(data) {
    const container = document.getElementById("networkContainer");
    // Zoomed-out viewBox — larger coordinate space so everything is smaller
    const width = 1800;
    const height = 1200;

    const svg = d3.select("#networkSvg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "700px")
        .style("user-select", "none")
        .style("-webkit-user-select", "none");

    svg.selectAll("*").remove();

    // Zoom/pan container — all graph content goes inside this <g>
    const zoomG = svg.append("g");
    const zoom = d3.zoom()
        .scaleExtent([0.3, 5])
        .on("zoom", (event) => { zoomG.attr("transform", event.transform); });
    svg.call(zoom);

    // Fade out the zoom hint on first interaction
    const zoomHint = document.getElementById("zoomHint");
    svg.on("wheel.hint mousedown.hint", () => {
        if (zoomHint) zoomHint.classList.add("faded");
    }, { once: true });

    const tooltip = document.getElementById("networkTooltip");

    // Scale node radius — exponential: top connectors pop, average ones stay small
    const centralityExtent = d3.extent(data.nodes, d => d.centrality);
    const radiusScale = d3.scalePow().exponent(3)
        .domain(centralityExtent)
        .range([3, 14]);

    // Scale edge width — thin lines
    const scoreExtent = d3.extent(data.edges, d => d.score);
    const edgeWidthScale = d3.scaleLinear()
        .domain(scoreExtent)
        .range([0.2, 2.5]);

    // ---- Family home regions ----
    // Spread families across a wider ellipse so groups have clear gaps
    const uniqueFamilies = [...new Set(data.nodes.map(n => n.family))];
    const familyTargets = {};
    const cx = width / 2, cy = height / 2;
    const rx = width * 0.40, ry = height * 0.40;
    uniqueFamilies.forEach((fam, i) => {
        const angle = (2 * Math.PI * i) / uniqueFamilies.length - Math.PI / 2;
        familyTargets[fam] = {
            x: cx + rx * Math.cos(angle),
            y: cy + ry * Math.sin(angle),
        };
    });

    // Custom force: strong repulsion between different families
    function familyRepulsion(alpha) {
        const strength = 80;
        for (let i = 0; i < data.nodes.length; i++) {
            for (let j = i + 1; j < data.nodes.length; j++) {
                const a = data.nodes[i], b = data.nodes[j];
                if (a.family === b.family) continue;
                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                if (dist > 500) continue;
                const force = strength * alpha / dist;
                const fx = dx / dist * force, fy = dy / dist * force;
                a.vx += fx; a.vy += fy;
                b.vx -= fx; b.vy -= fy;
            }
        }
    }

    // Custom force: pull nodes toward their family's home zone
    function familyGravity(alpha) {
        const strength = 0.12;
        data.nodes.forEach(d => {
            const target = familyTargets[d.family];
            if (!target) return;
            d.vx += (target.x - d.x) * strength * alpha;
            d.vy += (target.y - d.y) * strength * alpha;
        });
    }

    // Force simulation — family-clustered, zoomed-out layout
    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.edges)
            .id(d => d.id)
            .distance(d => {
                const src = typeof d.source === "object" ? d.source : data.nodes.find(n => n.id === d.source);
                const tgt = typeof d.target === "object" ? d.target : data.nodes.find(n => n.id === d.target);
                const sameFamily = src && tgt && src.family === tgt.family;
                return sameFamily
                    ? 60 * (1 - d.score) + 15
                    : 300 * (1 - d.score) + 150;
            })
            .strength(d => {
                const src = typeof d.source === "object" ? d.source : data.nodes.find(n => n.id === d.source);
                const tgt = typeof d.target === "object" ? d.target : data.nodes.find(n => n.id === d.target);
                const sameFamily = src && tgt && src.family === tgt.family;
                return sameFamily ? d.score * 0.8 : d.score * 0.1;
            }))
        .force("charge", d3.forceManyBody()
            .strength(-400)
            .distanceMax(400))
        .force("collision", d3.forceCollide()
            .radius(d => radiusScale(d.centrality) + 18)
            .strength(0.9))
        .force("familyRepulsion", familyRepulsion)
        .force("familyGravity", familyGravity)
        .force("center", d3.forceCenter(cx, cy).strength(0.015));

    // Draw edges
    const link = zoomG.append("g")
        .selectAll("line")
        .data(data.edges)
        .join("line")
        .attr("stroke", "#c0c0c0")
        .attr("stroke-width", d => edgeWidthScale(d.score))
        .attr("stroke-opacity", 0.2);

    // Draw nodes (no drag — use zoom/pan instead)
    const node = zoomG.append("g")
        .selectAll("g")
        .data(data.nodes)
        .join("g");

    // Node circles
    node.append("circle")
        .attr("r", d => radiusScale(d.centrality))
        .attr("fill", d => familyColor(d.family))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .style("cursor", "pointer");

    // Node label background pill — guarantees text is always readable
    node.append("rect")
        .attr("class", "label-bg")
        .attr("fill", "rgba(250,250,250,0.85)")
        .attr("rx", 3)
        .attr("ry", 3)
        .style("pointer-events", "none");

    // Node label text
    const labelText = node.append("text")
        .text(d => d.name)
        .attr("dx", d => radiusScale(d.centrality) + 4)
        .attr("dy", "0.35em")
        .attr("font-size", "9px")
        .attr("font-weight", 500)
        .attr("font-family", "-apple-system, sans-serif")
        .attr("fill", "#1a1a1a")
        .style("pointer-events", "none")
        .style("user-select", "none");

    // Size the background pills to fit text (after first render tick)
    requestAnimationFrame(() => {
        node.each(function(d) {
            const g = d3.select(this);
            const text = g.select("text");
            const bg = g.select(".label-bg");
            try {
                const bbox = text.node().getBBox();
                bg.attr("x", bbox.x - 2)
                  .attr("y", bbox.y - 1)
                  .attr("width", bbox.width + 4)
                  .attr("height", bbox.height + 2);
            } catch(e) {}
        });
    });

    // ---- Selection + Hover logic ----
    const selected = new Set();  // locked/clicked node IDs

    function edgeId(e) {
        const s = typeof e.source === "object" ? e.source.id : e.source;
        const t = typeof e.target === "object" ? e.target.id : e.target;
        return { src: s, tgt: t };
    }

    function getConnected(nodeIds) {
        // All nodes connected to any node in the set (plus the set itself)
        const connected = new Set(nodeIds);
        data.edges.forEach(e => {
            const { src, tgt } = edgeId(e);
            if (nodeIds.has(src)) connected.add(tgt);
            if (nodeIds.has(tgt)) connected.add(src);
        });
        return connected;
    }

    function isHighlightedEdge(e, nodeIds) {
        const { src, tgt } = edgeId(e);
        return nodeIds.has(src) || nodeIds.has(tgt);
    }

    function edgeHighlightColor(e, nodeIds) {
        const { src, tgt } = edgeId(e);
        // Color by whichever selected node this edge touches
        for (const id of nodeIds) {
            if (src === id || tgt === id) {
                const n = data.nodes.find(x => x.id === id);
                if (n) return familyColor(n.family);
            }
        }
        return "#c0c0c0";
    }

    // mode: "node" = show selected + their connections, "family" = only selected nodes + within-edges
    let highlightMode = "node";

    function applyHighlight(activeIds) {
        if (activeIds.size === 0) {
            link.attr("stroke", "#c0c0c0")
                .attr("stroke-opacity", 0.2)
                .attr("stroke-width", d => edgeWidthScale(d.score));
            node.select("circle").attr("opacity", 1);
            node.select("text").attr("opacity", 1);
            node.select(".label-bg").attr("opacity", 1);
            return;
        }

        if (highlightMode === "family") {
            // Family mode: only highlight edges between selected nodes
            const isWithinEdge = (e) => {
                const { src, tgt } = edgeId(e);
                return activeIds.has(src) && activeIds.has(tgt);
            };
            link.attr("stroke", l => isWithinEdge(l) ? edgeHighlightColor(l, activeIds) : "#e8e8e8")
                .attr("stroke-opacity", l => isWithinEdge(l) ? 0.85 : 0.08)
                .attr("stroke-width", l => isWithinEdge(l) ? edgeWidthScale(l.score) * 1.4 : edgeWidthScale(l.score) * 0.3);
            node.select("circle").attr("opacity", n => activeIds.has(n.id) ? 1 : 0.12);
            node.select("text").attr("opacity", n => activeIds.has(n.id) ? 1 : 0.08);
            node.select(".label-bg").attr("opacity", n => activeIds.has(n.id) ? 1 : 0.08);
        } else {
            // Node mode: show selected + all their connections
            const connected = getConnected(activeIds);
            link.attr("stroke", l => isHighlightedEdge(l, activeIds) ? edgeHighlightColor(l, activeIds) : "#e8e8e8")
                .attr("stroke-opacity", l => isHighlightedEdge(l, activeIds) ? 0.85 : 0.08)
                .attr("stroke-width", l => isHighlightedEdge(l, activeIds) ? edgeWidthScale(l.score) * 1.4 : edgeWidthScale(l.score) * 0.3);
            node.select("circle").attr("opacity", n => connected.has(n.id) ? 1 : 0.12);
            node.select("text").attr("opacity", n => connected.has(n.id) ? 1 : 0.08);
            node.select(".label-bg").attr("opacity", n => connected.has(n.id) ? 1 : 0.08);
        }
    }

    // Build tooltip HTML for a single node
    function buildTooltip(d) {
        const neighbors = data.edges
            .filter(e => { const {src, tgt} = edgeId(e); return src === d.id || tgt === d.id; })
            .map(e => {
                const {src, tgt} = edgeId(e);
                const otherId = src === d.id ? tgt : src;
                const other = data.nodes.find(n => n.id === otherId);
                return { name: other ? other.name : otherId, score: e.score };
            })
            .sort((a, b) => b.score - a.score);

        return `<strong>${d.name}</strong> (${d.family})<br>
            <span style="opacity:0.7">Centrality: ${d.centrality.toFixed(3)}</span><br>
            <span style="opacity:0.7">Connected to:</span><br>
            ${neighbors.slice(0, 6).map(n =>
                `&nbsp;&nbsp;${n.name}: ${n.score.toFixed(3)}`
            ).join("<br>")}
            ${neighbors.length > 6 ? `<br>&nbsp;&nbsp;...+${neighbors.length - 6} more` : ""}`;
    }

    // Show persistent tooltip for all selected nodes
    function showSelectionTooltip() {
        if (selected.size === 0) {
            tooltip.style.display = "none";
            return;
        }
        const selectedNodes = data.nodes.filter(n => selected.has(n.id));
        tooltip.innerHTML = selectedNodes.map(d => buildTooltip(d)).join("<hr style='border:none;border-top:1px solid rgba(255,255,255,0.2);margin:6px 0'>");
        tooltip.style.display = "block";
        // Position near the centroid of selected nodes
        const svgRect = svg.node().getBoundingClientRect();
        const avgX = d3.mean(selectedNodes, d => d.x);
        const avgY = d3.mean(selectedNodes, d => d.y);
        const scaleX = svgRect.width / width;
        const scaleY = svgRect.height / height;
        tooltip.style.left = (svgRect.left + avgX * scaleX + 20) + "px";
        tooltip.style.top = (svgRect.top + avgY * scaleY - 20) + "px";
    }

    // Click node: toggle selection, show persistent tooltip
    node.on("click", function(event, d) {
        event.stopPropagation();
        highlightMode = "node";
        if (selected.has(d.id)) {
            selected.delete(d.id);
        } else {
            selected.add(d.id);
        }
        applyHighlight(selected);
        showSelectionTooltip();
    });

    // Click blank space: clear all selections
    // Use mousedown on SVG to catch clicks that aren't on nodes/labels
    svg.on("click", function(event) {
        // Only clear if clicking the SVG background itself (not a node or family label)
        const tag = event.target.tagName;
        if (tag === "svg" || tag === "rect" && !event.target.closest(".family-labels")) {
            selected.clear();
            applyHighlight(selected);
            tooltip.style.display = "none";
        }
    });

    // Hover: only activates when nothing is selected
    node.on("mouseover", function(event, d) {
        if (selected.size > 0) return;
        applyHighlight(new Set([d.id]));
        tooltip.style.display = "block";
        tooltip.innerHTML = buildTooltip(d);
    })
    .on("mousemove", function(event) {
        if (selected.size > 0) return;
        tooltip.style.left = (event.clientX + 14) + "px";
        tooltip.style.top = (event.clientY - 14) + "px";
    })
    .on("mouseout", function() {
        if (selected.size > 0) return;
        applyHighlight(selected);
        tooltip.style.display = "none";
    });

    // Family labels — clickable, floating above edges
    const familyList = [...new Set(data.nodes.map(n => n.family))];

    const familyLabelGroup = zoomG.append("g").attr("class", "family-labels");
    const familyLabels = familyLabelGroup.selectAll("g")
        .data(familyList)
        .join("g")
        .style("cursor", "pointer")
        .style("user-select", "none")
        .style("-webkit-user-select", "none");

    familyLabels.append("rect")
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", "rgba(255,255,255,0.88)")
        .attr("stroke", d => familyColor(d))
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.7);

    familyLabels.append("text")
        .text(d => d)
        .attr("font-size", "15px")
        .attr("font-weight", 700)
        .attr("font-family", "-apple-system, sans-serif")
        .attr("fill", d => familyColor(d))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .style("pointer-events", "none");

    // Click family label: select all nodes in that family
    familyLabels.on("click", function(event, family) {
        event.stopPropagation();
        highlightMode = "family";
        const familyNodeIds = data.nodes.filter(n => n.family === family).map(n => n.id);
        // Toggle: if all are already selected, deselect them; else clear + select this family
        const allSelected = familyNodeIds.every(id => selected.has(id));
        selected.clear();
        if (!allSelected) {
            familyNodeIds.forEach(id => selected.add(id));
        }
        applyHighlight(selected);
        if (selected.size > 0) {
            tooltip.style.display = "block";
            tooltip.innerHTML = `<strong>${family}</strong><br>` +
                `<span style="opacity:0.7">${familyNodeIds.length} languages</span><br>` +
                familyNodeIds.map(id => {
                    const n = data.nodes.find(x => x.id === id);
                    return n ? `&nbsp;&nbsp;${n.name}` : "";
                }).join("<br>");
            // Position near the family label
            const members = data.nodes.filter(n => n.family === family);
            const svgRect = svg.node().getBoundingClientRect();
            const avgX = d3.mean(members, d => d.x);
            const avgY = d3.mean(members, d => d.y);
            const transform = d3.zoomTransform(svg.node());
            tooltip.style.left = (svgRect.left + transform.applyX(avgX) + 20) + "px";
            tooltip.style.top = (svgRect.top + transform.applyY(avgY)) + "px";
        } else {
            tooltip.style.display = "none";
        }
    });

    // Re-append node group so nodes render on top of family labels
    zoomG.node().appendChild(node.node().parentNode);

    // Tick
    const pad = { left: 30, right: 100, top: 30, bottom: 30 };
    simulation.on("tick", () => {
        // Keep nodes + labels fully within viewBox
        data.nodes.forEach(d => {
            const r = radiusScale(d.centrality);
            d.x = Math.max(pad.left + r, Math.min(width - pad.right - r, d.x));
            d.y = Math.max(pad.top + r, Math.min(height - pad.bottom - r, d.y));
        });

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);

        // Update family label positions at cluster centroids
        familyLabels.each(function(family) {
            const members = data.nodes.filter(n => n.family === family);
            if (members.length === 0) return;

            // Find the topmost node in the cluster to place label above it
            const cx = d3.mean(members, m => m.x);
            const topY = d3.min(members, m => m.y);
            const labelY = topY - 30;  // above the highest node

            const g = d3.select(this);
            const textEl = g.select("text");
            // Clamp within viewBox
            const clampedX = Math.max(70, Math.min(width - 70, cx));
            const clampedY = Math.max(16, Math.min(height - 16, labelY));
            textEl.attr("x", clampedX).attr("y", clampedY);

            // Size the background rect to fit text with generous padding
            const bbox = textEl.node().getBBox();
            g.select("rect")
                .attr("x", bbox.x - 10)
                .attr("y", bbox.y - 5)
                .attr("width", bbox.width + 20)
                .attr("height", bbox.height + 10);
        });
    });

    // Reset button — clear selections, reset zoom, reheat simulation
    document.getElementById("networkResetBtn").onclick = () => {
        selected.clear();
        applyHighlight(selected);
        tooltip.style.display = "none";
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
        simulation.alpha(0.5).restart();
    };

    // Build legend
    const families = [...new Set(data.nodes.map(n => n.family))].sort();
    const legend = document.getElementById("networkLegend");
    legend.innerHTML = families.map(f =>
        `<span class="network-legend-item">
            <span class="network-legend-dot" style="background:${familyColor(f)}"></span>
            ${f}
        </span>`
    ).join("");
}

// ---- Compare Tool ----

const compareLookups = {};  // lang_code -> { en_word: { f, r, s } }

// LibreTranslate fallback for words not in our dictionary
const LT_MIRRORS = [
    "https://translate.fedilab.app/translate",
    "https://lt.vern.cc/translate",
    "https://translate.argosopentech.com/translate",
];
// Map our codes to LibreTranslate codes (only where they differ or exist)
const LT_CODES = {
    "zh": "zh-Hans", "nb": "nb", "tl": "tl", "sh": "sr",
    // Most of our ISO 639-1 codes match LibreTranslate directly
};

async function liveTranslate(word, targetCode) {
    const ltCode = LT_CODES[targetCode] || targetCode;
    for (const mirror of LT_MIRRORS) {
        try {
            const resp = await fetch(mirror, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ q: word, source: "en", target: ltCode }),
                signal: AbortSignal.timeout(4000),
            });
            if (!resp.ok) continue;
            const data = await resp.json();
            if (data.translatedText && data.translatedText.toLowerCase() !== word.toLowerCase()) {
                return data.translatedText;
            }
        } catch (e) { continue; }
    }
    return null;
}

async function loadLookup(code) {
    if (compareLookups[code]) return compareLookups[code];
    try {
        const resp = await fetch(`${DATA_BASE}/lookup/${code}.json`);
        compareLookups[code] = await resp.json();
    } catch (e) {
        compareLookups[code] = {};
    }
    return compareLookups[code];
}

function initCompare() {
    const langA = document.getElementById("compareLangA");
    const langB = document.getElementById("compareLangB");
    const input = document.getElementById("compareWordInput");
    const suggestions = document.getElementById("compareSuggestions");

    // Populate language dropdowns from summary data
    const langOptions = summaryData
        .map(d => ({ code: d.code, name: d.lang }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Add English as source option
    langA.innerHTML = `<option value="en">English</option>`;

    langB.innerHTML = langOptions.map(d =>
        `<option value="${d.code}" ${d.code === "fr" ? "selected" : ""}>${d.name}</option>`
    ).join("");

    let debounceTimer = null;

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => runCompare(), 150);
        showSuggestions();
    });

    input.addEventListener("focus", () => showSuggestions());
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".compare-left")) suggestions.classList.remove("visible");
    });

    langB.addEventListener("change", () => runCompare());

    async function showSuggestions() {
        const word = input.value.trim().toLowerCase();
        if (word.length < 1) { suggestions.classList.remove("visible"); return; }

        const code = langB.value;
        const lookup = await loadLookup(code);
        const words = Object.keys(lookup);
        const matches = words.filter(w => w.startsWith(word)).slice(0, 8);

        if (matches.length === 0) { suggestions.classList.remove("visible"); return; }

        suggestions.innerHTML = matches.map(w =>
            `<div class="compare-suggestion" data-word="${w}">${w} → ${lookup[w].f}</div>`
        ).join("");
        suggestions.classList.add("visible");

        suggestions.querySelectorAll(".compare-suggestion").forEach(el => {
            el.addEventListener("click", () => {
                input.value = el.dataset.word;
                suggestions.classList.remove("visible");
                runCompare();
            });
        });
    }

    async function runCompare() {
        const word = input.value.trim().toLowerCase();
        const code = langB.value;
        const resultEl = document.getElementById("compareResult");
        const detailsEl = document.getElementById("compareDetails");

        if (!word) {
            resultEl.innerHTML = `<span class="compare-placeholder">Translation will appear here</span>`;
            detailsEl.classList.add("hidden");
            return;
        }

        const lookup = await loadLookup(code);
        let entry = lookup[word];
        let source = "dictionary";

        // Fallback: live translation via LibreTranslate
        if (!entry) {
            resultEl.innerHTML = `<span class="compare-placeholder">Translating...</span>`;
            const translated = await liveTranslate(word, code);
            if (!translated) {
                resultEl.innerHTML = `<span class="compare-placeholder">Word not found</span>`;
                detailsEl.classList.add("hidden");
                return;
            }
            entry = { f: translated, r: translated.toLowerCase() };
            source = "live";
        }

        // Show translation
        const foreign = entry.f;
        const romanized = entry.r;
        const showRom = romanized !== foreign;
        const liveTag = source === "live" ? `<span style="margin-left:8px;font-size:0.7rem;background:#e8f4ff;color:var(--accent);padding:2px 6px;border-radius:4px">LIVE</span>` : "";

        resultEl.innerHTML = `<strong style="font-size:1.2rem">${foreign}</strong>` +
            (showRom ? `<span style="margin-left:8px;color:var(--text-secondary);font-family:var(--mono);font-size:0.9rem">${romanized}</span>` : "") +
            liveTag;

        // Compute detailed metrics client-side
        const metrics = computeMetrics(word, romanized);

        // Show details
        detailsEl.classList.remove("hidden");
        document.getElementById("compareWordA").textContent = word;
        document.getElementById("compareWordB").textContent = foreign;

        const romLine = document.getElementById("compareRomanized");
        romLine.textContent = showRom ? `Romanized: ${romanized}  →  compared as "${romanized}" vs "${word}"` : `Compared as "${foreign}" vs "${word}"`;

        const color = metrics.composite >= 0.7 ? "var(--green)" : metrics.composite >= 0.4 ? "var(--yellow)" : "var(--red)";
        document.getElementById("compareScoreBig").innerHTML =
            `<span style="color:${color}">${metrics.composite.toFixed(3)}</span>` +
            `<span class="score-label">Composite Score</span>`;

        document.getElementById("compareMetrics").innerHTML = [
            { label: "Levenshtein", value: metrics.levenshtein },
            { label: "Jaro-Winkler", value: metrics.jaroWinkler },
            { label: "Bigram", value: metrics.bigram },
            { label: "Trigram", value: metrics.trigram },
            { label: "Length Sim", value: metrics.lengthSim },
        ].map(m => {
            const c = m.value >= 0.7 ? "var(--green)" : m.value >= 0.4 ? "var(--yellow)" : "var(--red)";
            return `<div class="compare-metric">
                <div class="compare-metric-value" style="color:${c}">${m.value.toFixed(3)}</div>
                <div class="compare-metric-label">${m.label}</div>
            </div>`;
        }).join("");
    }
}

// Client-side metric computation (mirrors Python logic)
function computeMetrics(s1, s2) {
    s1 = s1.toLowerCase(); s2 = s2.toLowerCase();

    // Normalized Levenshtein
    const levDist = levenshteinDist(s1, s2);
    const maxLen = Math.max(s1.length, s2.length) || 1;
    const normLev = 1 - levDist / maxLen;

    // Jaro-Winkler
    const jw = jaroWinkler(s1, s2);

    // N-gram Jaccard
    const bigram = ngramJaccard(s1, s2, 2);
    const trigram = ngramJaccard(s1, s2, 3);

    // Length similarity
    const lengthSim = 1 - Math.abs(s1.length - s2.length) / maxLen;

    // Composite (same weights as Python)
    const composite = normLev * 0.30 + jw * 0.25 + bigram * 0.10 + trigram * 0.05 + lengthSim * 0.05;
    // Phonetic metrics (Metaphone/Soundex) are hard to implement in JS, use remaining 0.25 weight on lev+jw
    const compositeAdj = composite + normLev * 0.125 + jw * 0.125;

    return { composite: compositeAdj, levenshtein: normLev, jaroWinkler: jw, bigram, trigram, lengthSim };
}

function levenshteinDist(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
    }
    return dp[m][n];
}

function jaroWinkler(s1, s2) {
    if (s1 === s2) return 1;
    const len1 = s1.length, len2 = s2.length;
    if (!len1 || !len2) return 0;
    const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    let matches = 0, transpositions = 0;
    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchDist);
        const end = Math.min(i + matchDist + 1, len2);
        for (let j = start; j < end; j++) {
            if (s2Matches[j] || s1[i] !== s2[j]) continue;
            s1Matches[i] = true; s2Matches[j] = true; matches++; break;
        }
    }
    if (!matches) return 0;
    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }
    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
        if (s1[i] === s2[i]) prefix++; else break;
    }
    return jaro + prefix * 0.1 * (1 - jaro);
}

function ngramJaccard(s1, s2, n) {
    if (s1.length < n && s2.length < n) return 1;
    const grams = (s, n) => { const g = new Set(); for (let i = 0; i <= s.length - n; i++) g.add(s.slice(i, i + n)); return g; };
    const g1 = grams(s1, n), g2 = grams(s2, n);
    if (!g1.size && !g2.size) return 1;
    let inter = 0;
    g1.forEach(g => { if (g2.has(g)) inter++; });
    const union = g1.size + g2.size - inter;
    return union ? inter / union : 0;
}

// ---- Heatmap ----

let crossData = null;

async function loadAndRenderHeatmap() {
    try {
        const resp = await fetch(`${DATA_BASE}/cross_matrix.json`);
        crossData = await resp.json();
        // Filter out Bengali (unreliable due to small sample sizes)
        crossData.languages = crossData.languages.filter(l => l.code !== "bn");
        crossData.pairs = crossData.pairs.filter(p => p.a !== "bn" && p.b !== "bn");
        renderHeatmap("avg");

        document.getElementById("heatmapSort").addEventListener("change", (e) => {
            renderHeatmap(e.target.value);
        });

        renderTopPairs();
    } catch (e) {
        console.warn("Cross-language matrix not available:", e);
    }
}

function heatmapColor(value) {
    // Blue sequential: white -> light blue -> deep blue
    const stops = [
        [0.0, 247, 251, 255],
        [0.2, 198, 219, 239],
        [0.4, 107, 174, 214],
        [0.6, 33, 113, 181],
        [1.0, 8, 48, 107],
    ];
    for (let i = 1; i < stops.length; i++) {
        if (value <= stops[i][0]) {
            const t = (value - stops[i-1][0]) / (stops[i][0] - stops[i-1][0]);
            const r = Math.round(stops[i-1][1] + t * (stops[i][1] - stops[i-1][1]));
            const g = Math.round(stops[i-1][2] + t * (stops[i][2] - stops[i-1][2]));
            const b = Math.round(stops[i-1][3] + t * (stops[i][3] - stops[i-1][3]));
            return `rgb(${r},${g},${b})`;
        }
    }
    return "rgb(8,48,107)";
}

function renderHeatmap(sortMode) {
    if (!crossData) return;

    let langs = [...crossData.languages];

    // Sort languages
    if (sortMode === "family") {
        langs.sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));
    } else if (sortMode === "name") {
        langs.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "avg") {
        // Sort by average similarity to all others
        const avgMap = {};
        for (const l of langs) {
            let sum = 0, count = 0;
            for (const l2 of langs) {
                const key = `${l.code}-${l2.code}`;
                if (crossData.matrix[key] !== undefined) {
                    sum += crossData.matrix[key];
                    count++;
                }
            }
            avgMap[l.code] = count > 0 ? sum / count : 0;
        }
        langs.sort((a, b) => avgMap[b.code] - avgMap[a.code]);
    }

    const n = langs.length;
    const cellSize = Math.max(14, Math.min(20, Math.floor(900 / n)));
    const labelWidth = 100;
    const labelHeight = 100;
    const width = labelWidth + n * cellSize;
    const height = labelHeight + n * cellSize;

    const canvas = document.getElementById("heatmapCanvas");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Draw cells
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const key = `${langs[i].code}-${langs[j].code}`;
            const val = crossData.matrix[key];
            const x = labelWidth + j * cellSize;
            const y = labelHeight + i * cellSize;

            if (val !== undefined) {
                ctx.fillStyle = heatmapColor(val);
            } else {
                ctx.fillStyle = "#f0f0f0";
            }
            ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
        }
    }

    // Draw row labels (left)
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.min(11, cellSize - 2)}px -apple-system, sans-serif`;
    for (let i = 0; i < n; i++) {
        ctx.fillStyle = familyColor(langs[i].family);
        ctx.fillText(langs[i].name, labelWidth - 6, labelHeight + i * cellSize + cellSize / 2);
    }

    // Draw column labels (top, rotated)
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let j = 0; j < n; j++) {
        ctx.save();
        ctx.translate(labelWidth + j * cellSize + cellSize / 2, labelHeight - 4);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = familyColor(langs[j].family);
        ctx.fillText(langs[j].name, 0, 0);
        ctx.restore();
    }
    ctx.restore();

    // Tooltip on hover
    const tooltip = document.getElementById("heatmapTooltip");
    canvas.onmousemove = (e) => {
        // Convert mouse position to CSS-pixel coords within the canvas.
        // getBoundingClientRect gives CSS size; divide to get ratio.
        const rect = canvas.getBoundingClientRect();
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        const col = Math.floor((mx - labelWidth) / cellSize);
        const row = Math.floor((my - labelHeight) / cellSize);

        if (row >= 0 && row < n && col >= 0 && col < n) {
            const key = `${langs[row].code}-${langs[col].code}`;
            const val = crossData.matrix[key];
            if (val !== undefined) {
                tooltip.style.display = "block";
                tooltip.style.left = (e.clientX + 12) + "px";
                tooltip.style.top = (e.clientY - 10) + "px";
                tooltip.innerHTML = `<strong>${langs[row].name}</strong> ↔ <strong>${langs[col].name}</strong><br>Score: ${val.toFixed(4)}`;
            } else {
                tooltip.style.display = "none";
            }
        } else {
            tooltip.style.display = "none";
        }
    };

    canvas.onmouseleave = () => { tooltip.style.display = "none"; };
}

function renderTopPairs() {
    if (!crossData || !crossData.pairs) return;

    // Filter out pairs with very small overlap (< 500)
    const filtered = crossData.pairs.filter(p => p.n >= 500);
    const top = filtered.slice(0, 20);
    const bottom = filtered.slice(-15);

    const container = document.getElementById("heatmapTopPairs");
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div>
                <h3 style="margin-bottom: 8px;">Most Similar Language Pairs</h3>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Language A</th><th>Language B</th><th>Score</th><th>Pairs</th></tr></thead>
                        <tbody>
                            ${top.map(p => `
                                <tr>
                                    <td><strong>${p.a_name}</strong></td>
                                    <td><strong>${p.b_name}</strong></td>
                                    <td class="score-cell" style="color:${scoreColor(p.score)}">${p.score.toFixed(4)}</td>
                                    <td class="score-cell">${p.n.toLocaleString()}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h3 style="margin-bottom: 8px;">Least Similar Language Pairs</h3>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Language A</th><th>Language B</th><th>Score</th><th>Pairs</th></tr></thead>
                        <tbody>
                            ${bottom.reverse().map(p => `
                                <tr>
                                    <td><strong>${p.a_name}</strong></td>
                                    <td><strong>${p.b_name}</strong></td>
                                    <td class="score-cell" style="color:${scoreColor(p.score)}">${p.score.toFixed(4)}</td>
                                    <td class="score-cell">${p.n.toLocaleString()}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ---- Go ----
init();
