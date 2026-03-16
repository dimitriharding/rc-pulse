import type { ChartData, OverviewData } from "./types.js";

const BASE_URL = "https://api.revenuecat.com/v2";

export class RCChartsClient {
  private apiKey: string;
  private projectId: string;

  constructor(apiKey: string, projectId: string) {
    this.apiKey = apiKey;
    this.projectId = projectId;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(
        `RC API error ${res.status}: ${(error as any).message || res.statusText}`
      );
    }

    return res.json() as Promise<T>;
  }

  async getOverview(): Promise<OverviewData> {
    return this.get<OverviewData>(`/projects/${this.projectId}/metrics/overview`);
  }

  async getChart(chartName: string, resolution: "day" | "week" | "month" = "month"): Promise<ChartData> {
    return this.get<ChartData>(`/projects/${this.projectId}/charts/${chartName}`, {
      resolution,
    });
  }

  async getProjects(): Promise<{ items: Array<{ id: string; name: string }> }> {
    return this.get("/projects");
  }
}
