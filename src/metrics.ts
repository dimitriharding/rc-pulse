import type { RCChartsClient } from "./client.js";
import type { ChartData, PulseMetrics } from "./types.js";

function getLastNMonths(chart: ChartData, n: number): number[] {
  const measureIndex = chart.measures.findIndex((m) => m.chartable);
  const values = chart.values
    .filter((v) => v.measure === measureIndex && !v.incomplete)
    .sort((a, b) => b.cohort - a.cohort)
    .slice(0, n)
    .map((v) => v.value);
  return values;
}

function getHistoryByMonth(
  chart: ChartData,
  measureIndex: number
): Array<{ date: Date; value: number }> {
  return chart.values
    .filter((v) => v.measure === measureIndex && !v.incomplete)
    .sort((a, b) => a.cohort - b.cohort)
    .map((v) => ({ date: new Date(v.cohort * 1000), value: v.value }));
}

function calcTrendPct(current: number, previous: number): number {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function fetchPulseMetrics(client: RCChartsClient): Promise<PulseMetrics> {
  const [overview, mrrChart, churnChart, revenueChart, trialConversionChart] =
    await Promise.allSettled([
      client.getOverview(),
      client.getChart("mrr", "month"),
      client.getChart("churn", "month"),
      client.getChart("revenue", "month"),
      client.getChart("trial_conversion_rate", "month"),
    ]);

  // Overview metrics
  const overviewData =
    overview.status === "fulfilled" ? overview.value : null;
  const activeSubscriptions =
    overviewData?.metrics.find((m) => m.id === "active_subscriptions")?.value ?? 0;
  const activeTrials =
    overviewData?.metrics.find((m) => m.id === "active_trials")?.value ?? 0;
  const activeUsers =
    overviewData?.metrics.find((m) => m.id === "active_users")?.value ?? 0;
  const newCustomers =
    overviewData?.metrics.find((m) => m.id === "new_customers")?.value ?? 0;

  // MRR
  let mrrMetrics: PulseMetrics["mrr"] = {
    current: 0,
    previous: 0,
    trend: 0,
    history: [],
  };
  if (mrrChart.status === "fulfilled") {
    const chart = mrrChart.value;
    const months = getLastNMonths(chart, 3);
    const current = months[0] ?? 0;
    const previous = months[1] ?? 0;
    mrrMetrics = {
      current,
      previous,
      trend: calcTrendPct(current, previous),
      history: getHistoryByMonth(chart, 0),
    };
  }

  // Churn
  let churnMetrics: PulseMetrics["churn"] = { current: 0, average: 0, trend: 0 };
  if (churnChart.status === "fulfilled") {
    const chart = churnChart.value;
    const churnRateIndex = chart.measures.findIndex(
      (m) => m.display_name === "Churn Rate"
    );
    const months = chart.values
      .filter((v) => v.measure === churnRateIndex && !v.incomplete)
      .sort((a, b) => b.cohort - a.cohort);
    const current = months[0]?.value ?? 0;
    const previous = months[1]?.value ?? 0;
    const average = chart.summary.average["Churn Rate"] ?? 0;
    churnMetrics = {
      current,
      average: Math.round(average * 10) / 10,
      trend: calcTrendPct(current, previous),
    };
  }

  // Revenue
  let revenueMetrics: PulseMetrics["revenue"] = {
    current: 0,
    previous: 0,
    trend: 0,
    total: 0,
  };
  if (revenueChart.status === "fulfilled") {
    const chart = revenueChart.value;
    const months = getLastNMonths(chart, 3);
    const current = months[0] ?? 0;
    const previous = months[1] ?? 0;
    revenueMetrics = {
      current,
      previous,
      trend: calcTrendPct(current, previous),
      total: chart.summary.total?.["Revenue"] ?? 0,
    };
  }

  // Trial conversion
  let trialConversionMetrics: PulseMetrics["trialConversion"] = null;
  if (trialConversionChart.status === "fulfilled") {
    const chart = trialConversionChart.value;
    const months = getLastNMonths(chart, 3);
    const current = months[0] ?? 0;
    const previous = months[1] ?? 0;
    trialConversionMetrics = {
      current,
      previous,
      trend: calcTrendPct(current, previous),
    };
  }

  return {
    mrr: mrrMetrics,
    churn: churnMetrics,
    revenue: revenueMetrics,
    trialConversion: trialConversionMetrics,
    overview: {
      activeSubscriptions,
      activeTrials,
      activeUsers,
      newCustomers,
    },
  };
}
