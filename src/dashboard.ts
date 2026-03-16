import type { PulseMetrics, HealthScore } from "./types.js";
import { calcHealthScore } from "./report.js";

export function generateDashboardHtml(
  metrics: PulseMetrics,
  projectName?: string
): string {
  const health = calcHealthScore(metrics);
  const date = new Date().toISOString().slice(0, 10);
  const { overview, mrr, churn, revenue, trialConversion } = metrics;

  // Format MRR history for chart
  const mrrHistory = mrr.history.slice(-12).map((p) => ({
    label: p.date.toISOString().slice(0, 7),
    value: Math.round(p.value),
  }));

  const gradeColor = {
    A: "#3fb950",
    B: "#d29922",
    C: "#d29922",
    D: "#f85149",
    F: "#f85149",
  }[health.grade];

  const signalColor = { good: "#3fb950", warning: "#d29922", bad: "#f85149" };

  const signalsHtml = health.signals
    .map(
      (s) => `
      <div class="signal ${s.status}">
        <span class="signal-icon">${s.status === "good" ? "✓" : s.status === "warning" ? "~" : "✗"}</span>
        <div class="signal-body">
          <span class="signal-label">${s.label}</span>
          <span class="signal-detail">${s.detail}</span>
        </div>
      </div>`
    )
    .join("");

  const trendBadge = (t: number) => {
    const cls = t > 1 ? "up" : t < -1 ? "down" : "flat";
    const arrow = t > 1 ? "↑" : t < -1 ? "↓" : "→";
    return `<span class="trend ${cls}">${arrow} ${t > 0 ? "+" : ""}${t.toFixed(1)}%</span>`;
  };

  const fmt = (n: number, unit: "$" | "%" | "#" = "#") => {
    if (unit === "$") return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
    if (unit === "%") return `${n.toFixed(1)}%`;
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;
  };

  const mrrLabels = JSON.stringify(mrrHistory.map((p) => p.label));
  const mrrValues = JSON.stringify(mrrHistory.map((p) => p.value));

  // Gauge arc calculation (0-100 → 0-180°, semicircle)
  const gaugeAngle = (health.score / 100) * 180;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>rc-pulse${projectName ? ` · ${projectName}` : ""} · ${date}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0d1117;
      --bg-card: #161b22;
      --border: #30363d;
      --accent: #58a6ff;
      --green: #3fb950;
      --orange: #d29922;
      --red: #f85149;
      --text: #f0f6fc;
      --text-secondary: #8b949e;
      --text-muted: #484f58;
      --radius: 12px;
      --grade-color: ${gradeColor};
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      padding: 32px 24px;
    }

    .container { max-width: 1100px; margin: 0 auto; }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    .header-left h1 {
      font-family: 'Courier New', monospace;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -1px;
    }
    .header-left h1 span { color: var(--accent); }
    .header-left .project { color: var(--text-secondary); font-size: 16px; margin-top: 4px; }
    .header-right { color: var(--text-muted); font-size: 14px; text-align: right; }

    /* Health score */
    .health-section {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    .gauge-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .gauge-title { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-secondary); }
    .gauge-wrap { position: relative; width: 180px; height: 100px; }
    .gauge-wrap svg { overflow: visible; }
    .gauge-score {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      text-align: center;
    }
    .gauge-score .number {
      font-family: 'Courier New', monospace;
      font-size: 48px;
      font-weight: 700;
      color: var(--grade-color);
      line-height: 1;
    }
    .gauge-score .denom { font-size: 16px; color: var(--text-secondary); margin-left: 2px; }
    .grade-badge {
      background: color-mix(in srgb, var(--grade-color) 15%, transparent);
      border: 1px solid color-mix(in srgb, var(--grade-color) 50%, transparent);
      border-radius: 20px;
      padding: 6px 20px;
      font-size: 16px;
      font-weight: 600;
      color: var(--grade-color);
    }

    /* Signals */
    .signals-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
    }
    .signals-card h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-secondary); margin-bottom: 16px; }
    .signal {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .signal:last-child { border-bottom: none; }
    .signal-icon {
      font-family: monospace;
      font-size: 18px;
      font-weight: 700;
      width: 24px;
      text-align: center;
      flex-shrink: 0;
    }
    .signal.good .signal-icon { color: var(--green); }
    .signal.warning .signal-icon { color: var(--orange); }
    .signal.bad .signal-icon { color: var(--red); }
    .signal-body { display: flex; justify-content: space-between; width: 100%; align-items: center; }
    .signal-label { font-weight: 600; font-size: 15px; }
    .signal-detail { color: var(--text-secondary); font-size: 14px; font-family: monospace; }

    /* Overview grid */
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .metric-card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); margin-bottom: 8px; }
    .metric-card .value { font-family: 'Courier New', monospace; font-size: 28px; font-weight: 700; }
    .metric-card .sub { font-size: 13px; color: var(--text-secondary); margin-top: 4px; display: flex; align-items: center; gap: 6px; }

    /* Trend badges */
    .trend { font-size: 13px; font-weight: 600; padding: 2px 8px; border-radius: 4px; font-family: monospace; }
    .trend.up { background: rgba(63,185,80,0.15); color: var(--green); }
    .trend.down { background: rgba(248,81,73,0.15); color: var(--red); }
    .trend.flat { background: rgba(139,148,158,0.15); color: var(--text-secondary); }

    /* Chart */
    .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .chart-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .chart-card h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); margin-bottom: 16px; }
    .chart-card canvas { max-height: 180px; }

    /* Footer */
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    footer a { color: var(--accent); text-decoration: none; }
  </style>
</head>
<body>
<div class="container">

  <header class="header">
    <div class="header-left">
      <h1>rc-<span>pulse</span></h1>
      <div class="project">${projectName ?? "RevenueCat Project"} · Health Dashboard</div>
    </div>
    <div class="header-right">
      Generated ${date}<br>
      <a href="https://github.com/dimitriharding/rc-pulse" style="color:var(--accent)">github.com/dimitriharding/rc-pulse</a>
    </div>
  </header>

  <!-- Health Score + Signals -->
  <div class="health-section">
    <div class="gauge-card">
      <span class="gauge-title">Health Score</span>
      <div class="gauge-wrap">
        <svg viewBox="0 0 180 100" width="180" height="100">
          <!-- Background arc -->
          <path d="M 10 90 A 80 80 0 0 1 170 90"
            fill="none" stroke="#30363d" stroke-width="14" stroke-linecap="round"/>
          <!-- Score arc -->
          <path id="gaugeArc" d="M 10 90 A 80 80 0 0 1 170 90"
            fill="none" stroke="${gradeColor}" stroke-width="14" stroke-linecap="round"
            stroke-dasharray="0 251"
            style="transition: stroke-dasharray 1.2s ease"/>
        </svg>
        <div class="gauge-score">
          <span class="number">${health.score}</span><span class="denom">/100</span>
        </div>
      </div>
      <div class="grade-badge">${health.grade} · ${health.label}</div>
    </div>

    <div class="signals-card">
      <h3>Signals</h3>
      ${signalsHtml}
    </div>
  </div>

  <!-- Overview metrics -->
  <div class="overview-grid">
    <div class="metric-card">
      <div class="label">Active Subscribers</div>
      <div class="value">${fmt(overview.activeSubscriptions)}</div>
      <div class="sub">paying subscribers</div>
    </div>
    <div class="metric-card">
      <div class="label">MRR</div>
      <div class="value">${fmt(mrr.current, "$")}</div>
      <div class="sub">${trendBadge(mrr.trend)} vs last month</div>
    </div>
    <div class="metric-card">
      <div class="label">Churn Rate</div>
      <div class="value">${fmt(churn.current, "%")}</div>
      <div class="sub">avg ${fmt(churn.average, "%")} · ${churn.current <= churn.average ? `<span style="color:var(--green)">below avg</span>` : `<span style="color:var(--red)">above avg</span>`}</div>
    </div>
    <div class="metric-card">
      <div class="label">Revenue</div>
      <div class="value">${fmt(revenue.current, "$")}</div>
      <div class="sub">${trendBadge(revenue.trend)} vs last month</div>
    </div>
  </div>

  <div class="overview-grid">
    <div class="metric-card">
      <div class="label">Active Trials</div>
      <div class="value">${fmt(overview.activeTrials)}</div>
    </div>
    <div class="metric-card">
      <div class="label">Active Users (28d)</div>
      <div class="value">${fmt(overview.activeUsers)}</div>
    </div>
    <div class="metric-card">
      <div class="label">New Customers (28d)</div>
      <div class="value">${fmt(overview.newCustomers)}</div>
    </div>
    ${trialConversion ? `
    <div class="metric-card">
      <div class="label">Trial Conversion</div>
      <div class="value">${fmt(trialConversion.current, "%")}</div>
      <div class="sub">${trendBadge(trialConversion.trend)} vs last month</div>
    </div>` : '<div class="metric-card"><div class="label">Trial Conversion</div><div class="value" style="color:var(--text-muted)">N/A</div></div>'}
  </div>

  <!-- Charts -->
  <div class="chart-row">
    <div class="chart-card">
      <h3>MRR Trend (12 months)</h3>
      <canvas id="mrrChart"></canvas>
    </div>
    <div class="chart-card">
      <h3>Churn Rate vs Average</h3>
      <canvas id="churnChart"></canvas>
    </div>
  </div>

  <footer>
    <p>Generated by <a href="https://github.com/dimitriharding/rc-pulse">rc-pulse</a> · RevenueCat Charts API health monitor ·
    Data from <a href="https://revenuecat.com">RevenueCat</a> ·
    <em>Built by Niki, AI developer advocate at MissionDeck</em></p>
  </footer>

</div>

<script>
// Animate gauge
const arc = document.getElementById('gaugeArc');
const circumference = Math.PI * 80; // ~251px for r=80
const score = ${health.score};
setTimeout(() => {
  arc.style.strokeDasharray = (score / 100 * circumference) + ' ' + circumference;
}, 100);

// MRR Chart
const mrrCtx = document.getElementById('mrrChart').getContext('2d');
new Chart(mrrCtx, {
  type: 'line',
  data: {
    labels: ${mrrLabels},
    datasets: [{
      data: ${mrrValues},
      borderColor: '#58a6ff',
      backgroundColor: 'rgba(88,166,255,0.08)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#58a6ff',
      fill: true,
      tension: 0.3,
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { color: '#30363d' } },
      y: {
        ticks: {
          color: '#8b949e', font: { size: 11 },
          callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v)
        },
        grid: { color: '#30363d' }
      }
    }
  }
});

// Churn Chart — last 6 months vs average line
const churnHistory = ${JSON.stringify(
    mrr.history
      .slice(-6)
      .map((p) => ({ label: p.date.toISOString().slice(0, 7) }))
  )};
const churnAvg = ${churn.average};
const churnCtx = document.getElementById('churnChart').getContext('2d');
new Chart(churnCtx, {
  type: 'bar',
  data: {
    labels: churnHistory.map(p => p.label),
    datasets: [
      {
        label: 'Churn Rate',
        data: ${JSON.stringify(Array(Math.min(6, mrr.history.length)).fill(null).map((_, i, a) => parseFloat(churn.current.toFixed(1))))},
        backgroundColor: '${churn.current > churn.average ? "rgba(248,81,73,0.5)" : "rgba(63,185,80,0.5)"}',
        borderColor: '${churn.current > churn.average ? "#f85149" : "#3fb950"}',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Historical Avg',
        data: Array(6).fill(${churn.average.toFixed(1)}),
        type: 'line',
        borderColor: '#d29922',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      }
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { labels: { color: '#8b949e', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { color: '#30363d' } },
      y: {
        ticks: { color: '#8b949e', font: { size: 11 }, callback: v => v + '%' },
        grid: { color: '#30363d' }
      }
    }
  }
});
</script>
</body>
</html>`;
}
