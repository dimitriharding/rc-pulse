export interface ChartValue {
  cohort: number;
  incomplete: boolean;
  measure: number;
  value: number;
}

export interface ChartMeasure {
  chartable: boolean;
  decimal_precision: number;
  description: string;
  display_name: string;
  tabulable: boolean;
  unit: string;
}

export interface ChartSummary {
  average: Record<string, number>;
  total?: Record<string, number>;
}

export interface ChartData {
  category: string;
  description: string;
  display_name: string;
  end_date: number;
  measures: ChartMeasure[];
  object: string;
  resolution: string;
  start_date: number;
  summary: ChartSummary;
  values: ChartValue[];
}

export interface OverviewMetric {
  description: string;
  id: string;
  last_updated_at: number | null;
  last_updated_at_iso8601: string | null;
  name: string;
  object: string;
  period: string;
  unit: string;
  value: number;
}

export interface OverviewData {
  metrics: OverviewMetric[];
}

export interface PulseConfig {
  apiKey: string;
  projectId: string;
  output: "terminal" | "markdown" | "json";
  periods?: number;
}

export interface PulseMetrics {
  mrr: {
    current: number;
    previous: number;
    trend: number;
    history: Array<{ date: Date; value: number }>;
  };
  churn: {
    current: number;
    average: number;
    trend: number;
  };
  revenue: {
    current: number;
    previous: number;
    trend: number;
    total: number;
  };
  trialConversion: {
    current: number;
    previous: number;
    trend: number;
  } | null;
  overview: {
    activeSubscriptions: number;
    activeTrials: number;
    activeUsers: number;
    newCustomers: number;
  };
}

export interface HealthScore {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  signals: Array<{ label: string; status: "good" | "warning" | "bad"; detail: string }>;
}
