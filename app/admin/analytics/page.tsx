"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { EmptyState } from "@/components/admin/EmptyState";

type FunnelStage = { key: string; label: string; count: number };
type FunnelResponse = {
  stages: FunnelStage[];
  won: { count: number; revenueCents: number };
  pdfDownloads: number;
  sources: string[];
  campaigns: string[];
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("ALL");
  const [campaign, setCampaign] = useState("ALL");

  const fetchFunnel = useCallback(async (s: string, c: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s !== "ALL") params.set("source", s);
      if (c !== "ALL") params.set("campaign", c);
      const res = await fetch(`/api/admin/analytics/funnel?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (err) {
      console.error("Failed to load analytics funnel:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchFunnel(source, campaign);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, campaign]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  const stages = data?.stages || [];
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-foreground sm:text-[32px]">Analytics</h1>
          <p className="text-body-small text-muted-foreground">
            Who came, what they did, and which leads turned into revenue — full funnel, by acquisition source.
          </p>
        </div>
      </div>

      {/* Segment filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="source-filter" className="text-xs font-semibold text-muted-foreground">
            Source
          </label>
          <select
            id="source-filter"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All sources</option>
            {(data?.sources || []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="campaign-filter" className="text-xs font-semibold text-muted-foreground">
            Campaign
          </label>
          <select
            id="campaign-filter"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All campaigns</option>
            {(data?.campaigns || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {stages.length === 0 || stages.every((s) => s.count === 0) ? (
        <EmptyState title="No tracked activity yet" message="Events will appear here once visitors start landing on the site." />
      ) : (
        <>
          {/* Funnel */}
          <AdminCard title="Funnel">
            <div className="space-y-2.5">
              {stages.map((stage, i) => {
                const prev = i > 0 ? stages[i - 1].count : null;
                const conversionRate = prev && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
                const widthPct = Math.max(4, Math.round((stage.count / maxCount) * 100));
                return (
                  <div key={stage.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{stage.label}</span>
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{stage.count.toLocaleString()}</strong>
                        {conversionRate !== null && <span className="ml-1.5">({conversionRate}% of prior)</span>}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminCard>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AdminCard title="Clients Won">
              <p className="text-heading-2 font-bold text-foreground">{data?.won.count ?? 0}</p>
            </AdminCard>
            <AdminCard title="Revenue">
              <p className="text-heading-2 font-bold text-foreground">
                ${((data?.won.revenueCents ?? 0) / 100).toLocaleString()}
              </p>
              <p className="mt-0.5 text-metadata text-muted-foreground">Manually entered on &ldquo;Mark Won&rdquo;</p>
            </AdminCard>
            <AdminCard title="Lead-to-Won Rate">
              <p className="text-heading-2 font-bold text-foreground">
                {(() => {
                  const leads = stages.find((s) => s.key === "leads_captured")?.count || 0;
                  const won = data?.won.count ?? 0;
                  return leads > 0 ? `${Math.round((won / leads) * 100)}%` : "—";
                })()}
              </p>
            </AdminCard>
            <AdminCard title="PDF Downloads">
              <p className="text-heading-2 font-bold text-foreground">{data?.pdfDownloads ?? 0}</p>
            </AdminCard>
          </div>
        </>
      )}
    </div>
  );
}
