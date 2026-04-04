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

// ---- Go ----
init();
