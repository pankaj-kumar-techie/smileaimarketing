"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconSearch, IconFilter } from "@/components/icons";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { EmptyState } from "@/components/admin/EmptyState";

type Business = {
  id: string;
  name: string;
  website: string;
  status: string;
  opportunityScore: number;
  city: string;
  state?: string;
  contacts?: { id: string }[];
  audits?: { id: string }[];
};

// Values must match the Prisma BusinessStatus enum exactly (prisma/schema.prisma) —
// any value here that isn't a real enum member makes its column permanently
// empty and its status-change actions fail server-side.
const STAGES = [
  { label: "Discovered", value: "DISCOVERED", color: "text-muted-foreground" },
  { label: "Qualified", value: "QUALIFIED", color: "text-indigo-400" },
  { label: "Auditing", value: "AUDITING", color: "text-cyan-400" },
  { label: "Audited", value: "AUDITED", color: "text-sky-400" },
  { label: "Pending Approval", value: "OUTREACH_PENDING", color: "text-orange-400" },
  { label: "Contacted", value: "OUTREACH_ACTIVE", color: "text-amber-400" },
  { label: "Won", value: "CONVERTED", color: "text-emerald-400" },
  { label: "Disqualified", value: "DISQUALIFIED", color: "text-rose-400" },
];

export default function AdminPipelinePage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [actionMessage, setActionMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [activeMobileStage, setActiveMobileStage] = useState("DISCOVERED");

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/businesses");
      const data = await res.json();
      if (res.ok) setBusinesses(data.businesses || []);
    } catch (err) {
      console.error("Error fetching pipeline:", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPipeline();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPipeline]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionMessage("");
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActionMessage(`Lead updated to ${newStatus.replace(/_/g, " ")}`);
        await fetchPipeline();
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleMarkWon = async (id: string) => {
    setActionMessage("");
    const dealValueInput = window.prompt("Deal value in dollars (leave blank to skip):");
    if (dealValueInput === null) return;

    const dollars = dealValueInput.trim() ? Number(dealValueInput.trim()) : undefined;
    if (dollars !== undefined && (Number.isNaN(dollars) || dollars < 0)) {
      setActionMessage("Deal value must be a positive number");
      return;
    }

    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CONVERTED",
          markWon: true,
          ...(dollars !== undefined ? { dealValueCents: Math.round(dollars * 100) } : {}),
        }),
      });
      if (res.ok) {
        setActionMessage("Marked as won");
        await fetchPipeline();
      }
    } catch (err) {
      console.error("Mark won error:", err);
    }
  };

  const cities = Array.from(new Set(businesses.map((b) => b.city).filter(Boolean)));

  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch =
      !searchQuery ||
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = cityFilter === "ALL" || b.city === cityFilter;
    return matchesSearch && matchesCity;
  });

  const getNextRecommendedAction = (b: Business) => {
    if (b.status === "DISCOVERED") return "Qualify Lead";
    if (b.status === "QUALIFIED") return "Run Audit";
    if (b.status === "AUDITING") return "Awaiting Audit Results";
    if (b.status === "AUDITED") return "Find Contact";
    if (b.status === "OUTREACH_PENDING") return "Review & Approve Email";
    if (b.status === "OUTREACH_ACTIVE") return "Awaiting Reply";
    if (b.status === "CONVERTED") return "Onboard Practice";
    if (b.status === "DISQUALIFIED") return "Archived";
    return "Re-engage Lead";
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-foreground sm:text-[32px]">Sales Pipeline</h1>
          <p className="text-body-small text-muted-foreground">
            Track and advance practice prospects through active conversion stages.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div role="alert" className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs font-bold text-primary">
          {actionMessage}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads by practice name or city..."
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <IconFilter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Cities ({cities.length})</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile Stage Selector Tabs (Visible on < 1024px) */}
      <div className="flex overflow-x-auto rounded-xl border border-border bg-surface p-1 gap-1 lg:hidden">
        {STAGES.map((stage) => {
          const count = filteredBusinesses.filter((b) => b.status === stage.value).length;
          const isActive = activeMobileStage === stage.value;
          return (
            <button
              key={stage.value}
              onClick={() => setActiveMobileStage(stage.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors min-h-[44px] ${
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <span>{stage.label}</span>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Column Display (< 1024px) */}
      <div className="block lg:hidden">
        {STAGES.filter((s) => s.value === activeMobileStage).map((stage) => {
          const list = filteredBusinesses.filter((b) => b.status === stage.value);
          return (
            <div key={stage.value} className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <span className={`text-xs font-extrabold uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{list.length} leads</span>
              </div>
              {list.length === 0 ? (
                <EmptyState title="No leads in this stage" compact />
              ) : (
                <div className="space-y-3">
                  {list.map((b) => (
                    <PipelineCard key={b.id} business={b} nextAction={getNextRecommendedAction(b)} onUpdateStatus={handleUpdateStatus} onMarkWon={handleMarkWon} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Kanban Board (>= 1024px) */}
      <div className="hidden lg:block overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => {
            const list = filteredBusinesses.filter((b) => b.status === stage.value);
            return (
              <div
                key={stage.value}
                className="flex w-72 flex-col rounded-xl border border-border bg-surface shadow-xs shrink-0"
              >
                {/* Sticky Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/80 bg-surface p-3.5 rounded-t-xl">
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{list.length}</span>
                </div>

                {/* Column Scroll Container */}
                <div className="max-h-[68vh] overflow-y-auto p-3 space-y-2.5">
                  {list.length === 0 ? (
                    <EmptyState title="Stage empty" compact />
                  ) : (
                    list.map((b) => (
                      <PipelineCard key={b.id} business={b} nextAction={getNextRecommendedAction(b)} onUpdateStatus={handleUpdateStatus} onMarkWon={handleMarkWon} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PipelineCard({
  business,
  nextAction,
  onUpdateStatus,
  onMarkWon,
}: {
  business: Business;
  nextAction: string;
  onUpdateStatus: (id: string, newStatus: string) => Promise<void>;
  onMarkWon: (id: string) => Promise<void>;
}) {
  const isLateStage = business.status === "OUTREACH_ACTIVE";

  return (
    <div className="rounded-lg border border-border/90 bg-background p-3 shadow-xs transition-colors hover:border-primary/40">
      <Link href={`/admin/businesses/${business.id}`} className="block truncate text-xs font-bold text-foreground hover:text-primary">
        {business.name}
      </Link>
      <p className="truncate text-[11px] text-muted-foreground">{business.city || "Location Pending"}</p>

      <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
        <span className="text-[11px] font-bold text-primary">Score {business.opportunityScore}/100</span>
        <span className="text-[10px] font-semibold text-muted-foreground">{nextAction}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/30 pt-2">
        <Link
          href={`/admin/businesses/${business.id}`}
          className="inline-flex h-7 items-center rounded-md bg-surface-muted px-2.5 text-[11px] font-bold text-foreground hover:bg-border"
        >
          View lead
        </Link>

        <div className="flex items-center gap-1">
          {/* Show direct Mark Won ONLY on late stages */}
          {isLateStage && business.status !== "CONVERTED" && (
            <button
              onClick={() => void onMarkWon(business.id)}
              className="inline-flex h-7 items-center rounded-md bg-emerald-500/10 px-2 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20"
            >
              Won
            </button>
          )}

          <ActionMenu
            items={[
              { label: "View Details", onClick: () => (window.location.href = `/admin/businesses/${business.id}`) },
              { label: "Mark Qualified", onClick: () => void onUpdateStatus(business.id, "QUALIFIED") },
              { label: "Move to Audited", onClick: () => void onUpdateStatus(business.id, "AUDITED") },
              { label: "Move to Contacted", onClick: () => void onUpdateStatus(business.id, "OUTREACH_ACTIVE") },
              { label: "Mark Won", variant: "success", onClick: () => void onMarkWon(business.id) },
              { label: "Mark Disqualified", variant: "danger", onClick: () => void onUpdateStatus(business.id, "DISQUALIFIED") },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
