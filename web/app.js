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
};

function familyColor(family) {
    return FAMILY_COLORS[family] || "#999";
}

function scoreColor(score) {
    if (score >= 0.7) return "var(--green)";
    if (score >= 0.4) return "var(--yellow)";
    return "var(--red)";
}

// ---- Init ----
async function init() {
    const resp = await fetch(`${DATA_BASE}/summary.json`);
    summaryData = await resp.json();
    document.getElementById("lang-count").textContent = summaryData.length;
    renderMainChart();
    renderFamilyChart();
    renderBandsChart();
    renderTable();
    loadAndRenderHeatmap();
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

// ---- Heatmap ----

let crossData = null;

async function loadAndRenderHeatmap() {
    try {
        const resp = await fetch(`${DATA_BASE}/cross_matrix.json`);
        crossData = await resp.json();
        renderHeatmap("family");

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
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
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
