# rc-pulse

**RevenueCat subscription health monitor. Pull your key metrics from the Charts API and get a clear pulse report — in the terminal, as Markdown, JSON, or a visual HTML dashboard.**

Two interfaces for two audiences:
- **CLI** — for agents, scripts, GitHub Actions, and developers who want composable JSON output
- **Dashboard** — a visual HTML report for humans, with MRR trend charts, a health score gauge, and signal cards

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  rc-pulse · Dark Noise  2026-03-16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Health Score: 72/100  🟡 Good

  OVERVIEW
  Active Subscribers  2529
  Active Trials       65
  Active Users (28d)  14.0k
  New Customers (28d) 1.6k

  KEY METRICS
  MRR         $4.6k  ↑ +3.2% MoM
  Revenue/mo  $5.1k  ↑ +2.8% MoM
  Churn Rate  4.1%  (avg: 4.8%)
  Trial Conv. 38.2%  → flat MoM

  SIGNALS
  ✓ MRR Growth          +3.2% MoM
  ✓ Churn               4.1% (below avg 4.8%)
  ✓ Revenue             +2.8% MoM
  ~ Trial Conversion    38.2% (stable)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## What It Does

`rc-pulse` calls the [RevenueCat Charts API v2](https://www.revenuecat.com/docs/api-v2) and returns a subscription health report with:

- **MRR** and month-over-month trend
- **Churn rate** vs. historical average
- **Revenue** per month with trend
- **Trial conversion rate** trend
- **Overview snapshot**: active subscribers, trials, users, new customers
- **Health score** (0–100) with graded signals

Use it locally for quick checks, or automate it as a weekly digest in GitHub Actions, Slack, or any CI pipeline.

## Quickstart

### npx (no install)

```bash
npx rc-pulse --api-key sk_YOUR_KEY --project-id proj_YOUR_ID
```

### Global install

```bash
npm install -g rc-pulse
rc-pulse --api-key sk_YOUR_KEY --project-id proj_YOUR_ID
```

### With environment variables

```bash
export RC_API_KEY=sk_YOUR_KEY
export RC_PROJECT_ID=proj_YOUR_ID
rc-pulse
```

## Output Formats

### Terminal (default)
```bash
rc-pulse --api-key sk_xxx --project-id proj_xxx
```

### Dashboard — Visual HTML report
```bash
# Open an interactive dashboard in your browser (auto-launches)
rc-pulse serve --api-key sk_xxx --project-id proj_xxx

# Or generate a standalone HTML file to share or deploy
rc-pulse --api-key sk_xxx --project-id proj_xxx --output html > report.html
open report.html
```

The dashboard includes:
- Animated health score gauge (0–100)
- MRR trend chart (12-month history)
- Churn rate vs. historical average (bar chart)
- Overview metric cards with trend badges
- Color-coded signals section

### Markdown (for Notion, GitHub, Slack bots)
```bash
rc-pulse --api-key sk_xxx --project-id proj_xxx --output markdown
rc-pulse --output markdown > weekly-report.md
```

### JSON (for agents, scripts, custom integrations)
```bash
rc-pulse --output json | jq '.metrics.mrr'
rc-pulse --output json > report.json
```

## Finding Your Project ID

```bash
rc-pulse --api-key sk_YOUR_KEY --list-projects
```

This lists all projects accessible with the key:

```
Projects:
  proj058a6330  Dark Noise
  proj1234abcd  My Other App
```

## GitHub Actions: Weekly Pulse

Add this to your repo and configure `RC_API_KEY` + `RC_PROJECT_ID` as repository secrets:

```yaml
# .github/workflows/weekly-pulse.yml
name: Weekly Subscription Pulse

on:
  schedule:
    - cron: "0 9 * * 1"  # Every Monday at 9am UTC
  workflow_dispatch:

jobs:
  pulse:
    runs-on: ubuntu-latest
    steps:
      - name: Run rc-pulse
        run: npx rc-pulse --output markdown >> $GITHUB_STEP_SUMMARY
        env:
          RC_API_KEY: ${{ secrets.RC_API_KEY }}
          RC_PROJECT_ID: ${{ secrets.RC_PROJECT_ID }}
```

The Markdown output renders directly in GitHub's workflow summary view — no external service needed.

## API Requirements

- A **secret API key** from your RevenueCat dashboard (Settings → API Keys)
- The key needs `charts_metrics:charts:read` permission
- Works with the RevenueCat Charts API v2

## Health Score

The health score (0–100) is computed from:

| Signal | Good | Warning | Bad |
|--------|------|---------|-----|
| MRR trend | > +5% MoM | 0–5% MoM | Negative |
| Churn vs avg | > 1% below avg | ±1% of avg | > 1% above avg |
| Revenue trend | > +3% MoM | Flat | < -5% MoM |
| Trial conversion | > +5% MoM | ±5% | < -5% MoM |

**Grades:**
- 80–100: A (Healthy 💚)
- 65–79: B (Good 🟡)
- 50–64: C (Needs attention 🟠)
- 35–49: D (At risk 🔴)
- 0–34: F (Warning 🔴)

## Development

```bash
git clone https://github.com/dimitriharding/rc-pulse
cd rc-pulse
npm install
npm run build

# Run in dev mode
npm run dev -- --api-key sk_xxx --project-id proj_xxx
```

## License

MIT
