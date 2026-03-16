#!/usr/bin/env node
import { RCChartsClient } from "./client.js";
import { fetchPulseMetrics } from "./metrics.js";
import { formatTerminal, formatMarkdown, formatJson } from "./report.js";

const VERSION = "1.0.0";

function usage(): void {
  console.log(`
rc-pulse v${VERSION} — RevenueCat subscription health monitor

Usage:
  rc-pulse [options]

Options:
  --api-key <key>         RevenueCat secret API key (or RC_API_KEY env var)
  --project-id <id>       RevenueCat project ID (or RC_PROJECT_ID env var)
  --output <format>       Output format: terminal (default), markdown, json
  --list-projects         List all projects for the given API key and exit
  --version               Print version
  --help                  Show this help

Examples:
  rc-pulse --api-key sk_xxx --project-id proj_xxx
  rc-pulse --api-key sk_xxx --project-id proj_xxx --output markdown
  rc-pulse --api-key sk_xxx --project-id proj_xxx --output json > report.json

Environment variables:
  RC_API_KEY       RevenueCat secret API key
  RC_PROJECT_ID    RevenueCat project ID
`);
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`rc-pulse v${VERSION}`);
    process.exit(0);
  }

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  }

  const apiKey = getArg("--api-key") ?? process.env.RC_API_KEY;
  const projectId = getArg("--project-id") ?? process.env.RC_PROJECT_ID;
  const output = (getArg("--output") ?? "terminal") as "terminal" | "markdown" | "json";

  if (!apiKey) {
    console.error("Error: --api-key or RC_API_KEY required");
    process.exit(1);
  }

  const client = new RCChartsClient(apiKey, projectId ?? "");

  // List projects mode
  if (args.includes("--list-projects")) {
    const projects = await client.getProjects();
    console.log("\nProjects:");
    for (const p of projects.items) {
      console.log(`  ${p.id}  ${p.name}`);
    }
    console.log();
    process.exit(0);
  }

  if (!projectId) {
    console.error(
      "Error: --project-id or RC_PROJECT_ID required.\n" +
        "Use --list-projects to discover your project ID."
    );
    process.exit(1);
  }

  // Fetch project name
  let projectName: string | undefined;
  try {
    const projects = await client.getProjects();
    projectName = projects.items.find((p) => p.id === projectId)?.name;
  } catch {
    // non-fatal
  }

  if (output !== "json") {
    process.stderr.write("Fetching metrics from RevenueCat Charts API...\n");
  }

  const metrics = await fetchPulseMetrics(client);

  switch (output) {
    case "terminal":
      console.log(formatTerminal(metrics, projectName));
      break;
    case "markdown":
      console.log(formatMarkdown(metrics, projectName));
      break;
    case "json":
      console.log(formatJson(metrics, projectName));
      break;
    default:
      console.error(`Unknown output format: ${output}`);
      process.exit(1);
  }
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
