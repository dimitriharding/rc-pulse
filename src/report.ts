import type { PulseMetrics, HealthScore } from "./types.js";

function fmt(n: number, unit: "$" | "%" | "#" = "#"): string {
  if (unit === "$") {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${n.toFixed(0)}`;
  }
  if (unit === "%") return `${n.toFixed(1)}%`;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}

function trendIcon(trend: number): string {
  if (trend > 3) return "↑";
  if (trend < -3) return "↓";
  return "→";
}

function trendLabel(trend: number, inverse = false): string {
  const isGood = inverse ? trend < 0 : trend > 0;
  const isBad = inverse ? trend > 0 : trend < 0;
  if (isGood) return `+${trend.toFixed(1)}% MoM`;
  if (isBad) return `${trend.toFixed(1)}% MoM`;
  return "flat MoM";
}

export function calcHealthScore(metrics: PulseMetrics): HealthScore {
  const signals: HealthScore["signals"] = [];
  let score = 50; // neutral start

  // MRR trend
  if (metrics.mrr.trend > 5) {
    score += 15;
    signals.push({ label: "MRR Growth", status: "good", detail: `+${metrics.mrr.trend.toFixed(1)}% MoM` });
  } else if (metrics.mrr.trend >= 0) {
    score += 5;
    signals.push({ label: "MRR Growth", status: "warning", detail: `+${metrics.mrr.trend.toFixed(1)}% MoM (flat)` });
  } else {
    score -= 15;
    signals.push({ label: "MRR Decline", status: "bad", detail: `${metrics.mrr.trend.toFixed(1)}% MoM` });
  }

  // Churn vs average
  const churnDelta = metrics.churn.current - metrics.churn.average;
  if (churnDelta < -1) {
    score += 15;
    signals.push({ label: "Churn", status: "good", detail: `${metrics.churn.current.toFixed(1)}% (below avg ${metrics.churn.average.toFixed(1)}%)` });
  } else if (churnDelta <= 1) {
    score += 5;
    signals.push({ label: "Churn", status: "warning", detail: `${metrics.churn.current.toFixed(1)}% (near avg ${metrics.churn.average.toFixed(1)}%)` });
  } else {
    score -= 15;
    signals.push({ label: "Churn Spike", status: "bad", detail: `${metrics.churn.current.toFixed(1)}% (above avg ${metrics.churn.average.toFixed(1)}%)` });
  }

  // Revenue trend
  if (metrics.revenue.trend > 3) {
    score += 10;
    signals.push({ label: "Revenue", status: "good", detail: `+${metrics.revenue.trend.toFixed(1)}% MoM` });
  } else if (metrics.revenue.trend < -5) {
    score -= 10;
    signals.push({ label: "Revenue", status: "bad", detail: `${metrics.revenue.trend.toFixed(1)}% MoM` });
  } else {
    score += 3;
    signals.push({ label: "Revenue", status: "warning", detail: `${metrics.revenue.trend.toFixed(1)}% MoM` });
  }

  // Trial conversion
  if (metrics.trialConversion) {
    if (metrics.trialConversion.trend > 5) {
      score += 10;
      signals.push({ label: "Trial Conversion", status: "good", detail: `${metrics.trialConversion.current.toFixed(1)}% (+${metrics.trialConversion.trend.toFixed(1)}% MoM)` });
    } else if (metrics.trialConversion.trend < -5) {
      score -= 10;
      signals.push({ label: "Trial Conversion", status: "bad", detail: `${metrics.trialConversion.current.toFixed(1)}% (${metrics.trialConversion.trend.toFixed(1)}% MoM)` });
    } else {
      signals.push({ label: "Trial Conversion", status: "warning", detail: `${metrics.trialConversion.current.toFixed(1)}% (stable)` });
    }
  }

  score = Math.max(0, Math.min(100, score));

  let grade: HealthScore["grade"];
  let label: string;
  if (score >= 80) { grade = "A"; label = "Healthy"; }
  else if (score >= 65) { grade = "B"; label = "Good"; }
  else if (score >= 50) { grade = "C"; label = "Needs attention"; }
  else if (score >= 35) { grade = "D"; label = "At risk"; }
  else { grade = "F"; label = "Warning"; }

  return { score, grade, label, signals };
}

export function formatTerminal(metrics: PulseMetrics, projectName?: string): string {
  const health = calcHealthScore(metrics);
  const { overview, mrr, churn, revenue, trialConversion } = metrics;

  const gradeEmoji = { A: "💚", B: "🟡", C: "🟠", D: "🔴", F: "🔴" }[health.grade];
  const lines: string[] = [];

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`  rc-pulse${projectName ? ` · ${projectName}` : ""}  ${new Date().toISOString().slice(0, 10)}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push(`  Health Score: ${health.score}/100  ${gradeEmoji} ${health.label}`);
  lines.push("");
  lines.push("  OVERVIEW");
  lines.push(`  Active Subscribers  ${fmt(overview.activeSubscriptions)}`);
  lines.push(`  Active Trials       ${fmt(overview.activeTrials)}`);
  lines.push(`  Active Users (28d)  ${fmt(overview.activeUsers)}`);
  lines.push(`  New Customers (28d) ${fmt(overview.newCustomers)}`);
  lines.push("");
  lines.push("  KEY METRICS");
  lines.push(`  MRR         ${fmt(mrr.current, "$")}  ${trendIcon(mrr.trend)} ${trendLabel(mrr.trend)}`);
  lines.push(`  Revenue/mo  ${fmt(revenue.current, "$")}  ${trendIcon(revenue.trend)} ${trendLabel(revenue.trend)}`);
  lines.push(`  Churn Rate  ${fmt(churn.current, "%")}  (avg: ${fmt(churn.average, "%")})`);
  if (trialConversion) {
    lines.push(`  Trial Conv. ${fmt(trialConversion.current, "%")}  ${trendIcon(trialConversion.trend)} ${trendLabel(trialConversion.trend)}`);
  }
  lines.push("");
  lines.push("  SIGNALS");
  for (const signal of health.signals) {
    const icon = { good: "✓", warning: "~", bad: "✗" }[signal.status];
    lines.push(`  ${icon} ${signal.label.padEnd(18)} ${signal.detail}`);
  }
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  return lines.join("\n");
}

export function formatMarkdown(metrics: PulseMetrics, projectName?: string): string {
  const health = calcHealthScore(metrics);
  const { overview, mrr, churn, revenue, trialConversion } = metrics;
  const date = new Date().toISOString().slice(0, 10);
  const gradeEmoji = { A: "💚", B: "🟡", C: "🟠", D: "🔴", F: "🔴" }[health.grade];

  const lines: string[] = [];
  lines.push(`# rc-pulse Report${projectName ? ` — ${projectName}` : ""}`);
  lines.push(`*Generated: ${date}*`);
  lines.push("");
  lines.push(`## Health Score: ${health.score}/100 ${gradeEmoji} ${health.label}`);
  lines.push("");
  lines.push("## Overview");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Active Subscribers | ${fmt(overview.activeSubscriptions)} |`);
  lines.push(`| Active Trials | ${fmt(overview.activeTrials)} |`);
  lines.push(`| Active Users (28d) | ${fmt(overview.activeUsers)} |`);
  lines.push(`| New Customers (28d) | ${fmt(overview.newCustomers)} |`);
  lines.push("");
  lines.push("## Key Metrics");
  lines.push("| Metric | Current | MoM Trend |");
  lines.push("|--------|---------|-----------|");
  lines.push(`| MRR | ${fmt(mrr.current, "$")} | ${trendLabel(mrr.trend)} |`);
  lines.push(`| Revenue | ${fmt(revenue.current, "$")} | ${trendLabel(revenue.trend)} |`);
  lines.push(`| Churn Rate | ${fmt(churn.current, "%")} | avg: ${fmt(churn.average, "%")} |`);
  if (trialConversion) {
    lines.push(`| Trial Conversion | ${fmt(trialConversion.current, "%")} | ${trendLabel(trialConversion.trend)} |`);
  }
  lines.push("");
  lines.push("## Signals");
  for (const signal of health.signals) {
    const icon = { good: "✅", warning: "⚠️", bad: "❌" }[signal.status];
    lines.push(`- ${icon} **${signal.label}**: ${signal.detail}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("*Generated by [rc-pulse](https://github.com/dimitriharding/rc-pulse) — RevenueCat Charts API health monitor.*");

  return lines.join("\n");
}

export function formatJson(metrics: PulseMetrics, projectName?: string): string {
  const health = calcHealthScore(metrics);
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      project: projectName ?? null,
      health,
      metrics,
    },
    null,
    2
  );
}
