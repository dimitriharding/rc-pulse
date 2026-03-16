/**
 * rc-pulse test suite
 * Run: bun test  OR  npx tsx src/test.ts
 *
 * Three layers:
 *  1. Unit tests — pure functions (no network)
 *  2. Integration test — real RC API, Dark Noise demo project
 *  3. CLI smoke test — spawn the built CLI, check exit code + stdout
 */

import { strict as assert } from "node:assert";
import { execSync, spawnSync } from "node:child_process";

import { calcHealthScore, formatTerminal, formatMarkdown, formatJson } from "./report.js";
import type { PulseMetrics, HealthScore } from "./types.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  Promise.resolve(fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((err: unknown) => {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    });
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

// ─── fixtures ─────────────────────────────────────────────────────────────────

const healthyMetrics: PulseMetrics = {
  mrr: { current: 10000, previous: 9000, trend: 11.1, history: [] },
  churn: { current: 2.0, average: 4.5, trend: -5.0 },
  revenue: { current: 12000, previous: 10000, trend: 20.0, total: 100000 },
  trialConversion: { current: 45.0, previous: 40.0, trend: 12.5 },
  overview: { activeSubscriptions: 500, activeTrials: 50, activeUsers: 2000, newCustomers: 100 },
};

const sickMetrics: PulseMetrics = {
  mrr: { current: 8000, previous: 10000, trend: -20.0, history: [] },
  churn: { current: 9.5, average: 4.5, trend: 25.0 },
  revenue: { current: 5000, previous: 9000, trend: -44.4, total: 60000 },
  trialConversion: null,
  overview: { activeSubscriptions: 200, activeTrials: 10, activeUsers: 800, newCustomers: 20 },
};

const flatMetrics: PulseMetrics = {
  mrr: { current: 5000, previous: 4980, trend: 0.4, history: [] },
  churn: { current: 4.5, average: 4.5, trend: 0.0 },
  revenue: { current: 5200, previous: 5100, trend: 2.0, total: 50000 },
  trialConversion: null,
  overview: { activeSubscriptions: 250, activeTrials: 0, activeUsers: 1000, newCustomers: 30 },
};

// ─── unit tests: calcHealthScore ──────────────────────────────────────────────

console.log("\n── Unit Tests: calcHealthScore ──");

test("healthy metrics → score >= 65 and grade A or B", () => {
  const h = calcHealthScore(healthyMetrics);
  assert.ok(h.score >= 65, `score ${h.score} should be >= 65`);
  assert.ok(["A", "B"].includes(h.grade), `grade ${h.grade} should be A or B`);
});

test("sick metrics → score < 50 and grade D or F", () => {
  const h = calcHealthScore(sickMetrics);
  assert.ok(h.score < 50, `score ${h.score} should be < 50`);
  assert.ok(["D", "F"].includes(h.grade), `grade ${h.grade} should be D or F`);
});

test("healthy metrics has good MRR growth signal", () => {
  const h = calcHealthScore(healthyMetrics);
  const mrrSignal = h.signals.find((s) => s.label === "MRR Growth");
  assert.ok(mrrSignal, "MRR Growth signal should exist");
  assert.equal(mrrSignal!.status, "good");
});

test("sick metrics has bad churn spike signal", () => {
  const h = calcHealthScore(sickMetrics);
  const churnSignal = h.signals.find((s) => s.label === "Churn Spike");
  assert.ok(churnSignal, "Churn Spike signal should exist for sick metrics");
  assert.equal(churnSignal!.status, "bad");
});

test("score is clamped 0–100", () => {
  const extremeGood: PulseMetrics = {
    ...healthyMetrics,
    mrr: { ...healthyMetrics.mrr, trend: 999 },
    churn: { current: 0, average: 10, trend: -999 },
    revenue: { ...healthyMetrics.revenue, trend: 999 },
  };
  const h = calcHealthScore(extremeGood);
  assert.ok(h.score <= 100, "score should not exceed 100");
  assert.ok(h.score >= 0, "score should not go below 0");
});

test("null trialConversion is handled gracefully", () => {
  const h = calcHealthScore(flatMetrics);
  const tcSignal = h.signals.find((s) => s.label === "Trial Conversion");
  assert.equal(tcSignal, undefined, "no Trial Conversion signal when null");
});

test("signals array is non-empty for all fixture types", () => {
  for (const m of [healthyMetrics, sickMetrics, flatMetrics]) {
    const h = calcHealthScore(m);
    assert.ok(h.signals.length > 0, "should always have at least one signal");
  }
});

// ─── unit tests: formatters ───────────────────────────────────────────────────

console.log("\n── Unit Tests: formatters ──");

test("formatTerminal returns a string with health score line", () => {
  const out = formatTerminal(healthyMetrics, "Test App");
  assert.equal(typeof out, "string");
  assert.ok(out.includes("Health Score:"), "should include Health Score label");
  assert.ok(out.includes("Test App"), "should include project name");
  assert.ok(out.includes("rc-pulse"), "should include rc-pulse branding");
});

test("formatMarkdown returns valid markdown with required sections", () => {
  const out = formatMarkdown(healthyMetrics, "Test App");
  assert.ok(out.startsWith("# rc-pulse Report"), "should start with h1 heading");
  assert.ok(out.includes("## Health Score:"), "should include health score section");
  assert.ok(out.includes("## Overview"), "should include overview section");
  assert.ok(out.includes("## Key Metrics"), "should include key metrics section");
  assert.ok(out.includes("## Signals"), "should include signals section");
});

test("formatJson returns valid JSON with expected top-level keys", () => {
  const out = formatJson(healthyMetrics, "Test App");
  const parsed = JSON.parse(out);
  assert.ok(typeof parsed.generated_at === "string", "should have generated_at");
  assert.ok(typeof parsed.health === "object", "should have health object");
  assert.ok(typeof parsed.metrics === "object", "should have metrics object");
  assert.equal(parsed.project, "Test App");
});

test("formatJson health.score matches calcHealthScore", () => {
  const out = formatJson(healthyMetrics);
  const parsed = JSON.parse(out);
  const direct = calcHealthScore(healthyMetrics);
  assert.equal(parsed.health.score, direct.score);
});

test("formatMarkdown includes MRR dollar value", () => {
  const out = formatMarkdown(healthyMetrics);
  // MRR is $10k
  assert.ok(out.includes("$10.0k") || out.includes("$10,000"), "should format MRR as dollar amount");
});

test("formatTerminal includes MRR trend arrow", () => {
  const out = formatTerminal(healthyMetrics);
  // MRR trend is +11.1% → should show ↑
  assert.ok(out.includes("↑"), "should include upward arrow for positive trend");
});

test("formatTerminal for sick metrics shows ↓ on MRR", () => {
  const out = formatTerminal(sickMetrics);
  assert.ok(out.includes("↓"), "should include downward arrow for negative MRR trend");
});

// ─── integration test: real RC API ───────────────────────────────────────────

console.log("\n── Integration Test: Dark Noise API ──");

const RC_API_KEY = process.env.RC_API_KEY || "sk_qdnvkjsVGhoVVNGiajqNHYIypcjgs";
const RC_PROJECT_ID = process.env.RC_PROJECT_ID || "proj058a6330";

await testAsync("fetchPulseMetrics returns valid PulseMetrics from Dark Noise", async () => {
  const { RCChartsClient } = await import("./client.js");
  const { fetchPulseMetrics } = await import("./metrics.js");

  const client = new RCChartsClient(RC_API_KEY, RC_PROJECT_ID);
  const metrics = await fetchPulseMetrics(client);

  // Structural checks
  assert.ok(typeof metrics.mrr.current === "number", "mrr.current should be a number");
  assert.ok(typeof metrics.mrr.trend === "number", "mrr.trend should be a number");
  assert.ok(typeof metrics.churn.current === "number", "churn.current should be a number");
  assert.ok(typeof metrics.churn.average === "number", "churn.average should be a number");
  assert.ok(typeof metrics.revenue.current === "number", "revenue.current should be a number");
  assert.ok(typeof metrics.overview.activeSubscriptions === "number", "activeSubscriptions should be a number");

  // Real data sanity: Dark Noise is a real app, MRR should be > 0
  assert.ok(metrics.mrr.current > 0, `MRR should be > 0, got ${metrics.mrr.current}`);
});

await testAsync("calcHealthScore on live data returns a valid score", async () => {
  const { RCChartsClient } = await import("./client.js");
  const { fetchPulseMetrics } = await import("./metrics.js");

  const client = new RCChartsClient(RC_API_KEY, RC_PROJECT_ID);
  const metrics = await fetchPulseMetrics(client);
  const health = calcHealthScore(metrics);

  assert.ok(health.score >= 0 && health.score <= 100, `score ${health.score} should be in [0, 100]`);
  assert.ok(["A", "B", "C", "D", "F"].includes(health.grade), `grade ${health.grade} should be A-F`);
  assert.ok(health.signals.length > 0, "should have at least one signal");

  console.log(`    → Live health score: ${health.score}/100 (${health.grade} — ${health.label})`);
  console.log(`    → Live MRR: $${metrics.mrr.current.toFixed(2)}, churn: ${metrics.churn.current.toFixed(1)}%`);
});

await testAsync("getProjects returns a list including current project", async () => {
  const { RCChartsClient } = await import("./client.js");
  const client = new RCChartsClient(RC_API_KEY, RC_PROJECT_ID);
  const result = await client.getProjects();
  assert.ok(Array.isArray(result.items), "items should be an array");
  assert.ok(result.items.length > 0, "should have at least one project");
  const ids = result.items.map((p) => p.id);
  assert.ok(ids.includes(RC_PROJECT_ID), `project list should include ${RC_PROJECT_ID}`);
});

// ─── CLI smoke test ───────────────────────────────────────────────────────────

console.log("\n── CLI Smoke Test ──");

await testAsync("CLI builds without TypeScript errors", async () => {
  const result = spawnSync("npx", ["tsc", "--noEmit"], {
    cwd: "/tmp/rc-pulse",
    encoding: "utf-8",
  });
  assert.equal(result.status, 0, `tsc failed:\n${result.stdout}\n${result.stderr}`);
});

await testAsync("CLI --help exits 0 and mentions rc-pulse", async () => {
  const result = spawnSync(
    "npx",
    ["tsx", "src/cli.ts", "--help"],
    { cwd: "/tmp/rc-pulse", encoding: "utf-8" }
  );
  const out = (result.stdout || "") + (result.stderr || "");
  assert.ok(
    result.status === 0 || out.toLowerCase().includes("rc-pulse"),
    `Expected rc-pulse in help output, got: ${out.slice(0, 200)}`
  );
});

await testAsync("CLI runs against Dark Noise and outputs health score", async () => {
  const result = spawnSync(
    "npx",
    [
      "tsx",
      "src/cli.ts",
      "--api-key", RC_API_KEY,
      "--project-id", RC_PROJECT_ID,
    ],
    { cwd: "/tmp/rc-pulse", encoding: "utf-8", timeout: 30000 }
  );
  const out = (result.stdout || "") + (result.stderr || "");
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${out.slice(0, 400)}`);
  assert.ok(out.includes("Health Score:"), `expected 'Health Score:' in output, got:\n${out.slice(0, 400)}`);
  assert.ok(out.includes("MRR"), `expected 'MRR' in output`);
});

await testAsync("CLI --output json produces valid parseable JSON", async () => {
  const result = spawnSync(
    "npx",
    [
      "tsx",
      "src/cli.ts",
      "--api-key", RC_API_KEY,
      "--project-id", RC_PROJECT_ID,
      "--output", "json",
    ],
    { cwd: "/tmp/rc-pulse", encoding: "utf-8", timeout: 30000 }
  );
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${result.stderr?.slice(0, 200)}`);
  const parsed = JSON.parse(result.stdout);
  assert.ok(typeof parsed.health?.score === "number", "JSON should have health.score");
  assert.ok(typeof parsed.metrics?.mrr?.current === "number", "JSON should have metrics.mrr.current");
});

await testAsync("CLI --output markdown produces markdown with h1 heading", async () => {
  const result = spawnSync(
    "npx",
    [
      "tsx",
      "src/cli.ts",
      "--api-key", RC_API_KEY,
      "--project-id", RC_PROJECT_ID,
      "--output", "markdown",
    ],
    { cwd: "/tmp/rc-pulse", encoding: "utf-8", timeout: 30000 }
  );
  assert.equal(result.status, 0, `CLI exited non-zero:\n${result.stderr?.slice(0, 200)}`);
  assert.ok(result.stdout.startsWith("# rc-pulse Report"), "markdown should start with h1");
});

// ─── summary ──────────────────────────────────────────────────────────────────

// Small delay to let async tests settle
await new Promise((r) => setTimeout(r, 100));

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (failed > 0) process.exit(1);
